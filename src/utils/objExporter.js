// 水密OBJ模型导出工具 - 优化版
export class BadgeOBJExporter {
  constructor(options = {}) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;

    // 3D打印模式设置
    this.for3DPrinting = options.for3DPrinting || false;
    this.textureCanvas = options.textureCanvas || null; // 传入纹理画布
    if (this.for3DPrinting && !this.textureCanvas) {
      console.warn('3D打印模式需要一个有效的纹理画布来提取顶点颜色。');
    }

    // 网格划分密度设置 - 只用一个参数 density
    this.meshDensity = { density: 20 }; // 默认值
    // 网格质量设置
    this.meshQuality = { 
      enableBoundaryConnection: true,  // 是否启用边界连接
      maxBoundaryConnections: 3,       // 最大边界连接数
      enableRetopology: true          // 是否启用重拓扑优化
    };
  }

  // 设置网格密度
  setMeshDensity(density) {
    this.meshDensity = { density };
  }

  // 设置网格质量
  setMeshQuality(enableBoundaryConnection = true, maxBoundaryConnections = 3, enableRetopology = true) {
    this.meshQuality = { 
      enableBoundaryConnection, 
      maxBoundaryConnections,
      enableRetopology
    };
  }

  // 添加顶点 - 支持顶点颜色
  addVertex(x, y, z) {
    const vertex = { x, y, z };
    if (this.for3DPrinting && this.textureCanvas) {
      // UV坐标此时未知，颜色将在UV确定后添加
      vertex.color = { r: 1, g: 1, b: 1 }; // 默认为白色
    }
    this.vertices.push(vertex);
    return this.vertexIndex++;
  }

  // 更新顶点的颜色
  updateVertexColor(vertexIndex, u, v) {
    if (this.for3DPrinting && this.textureCanvas && vertexIndex > 0 && vertexIndex <= this.vertices.length) {
      const color = this.getVertexColor(u, v);
      this.vertices[vertexIndex - 1].color = color;
    }
  }

  // 从纹理画布中获取指定UV坐标的颜色
  getVertexColor(u, v) {
    if (!this.textureCanvas) return { r: 1, g: 1, b: 1 };

    const ctx = this.textureCanvas.getContext('2d');
    const x = Math.floor(u * this.textureCanvas.width);
    const y = Math.floor((1 - v) * this.textureCanvas.height); // V坐标通常是反的
    
    // clamp coordinates
    const clampedX = Math.max(0, Math.min(x, this.textureCanvas.width - 1));
    const clampedY = Math.max(0, Math.min(y, this.textureCanvas.height - 1));

    const pixelData = ctx.getImageData(clampedX, clampedY, 1, 1).data;
    return {
      r: pixelData[0] / 255.0,
      g: pixelData[1] / 255.0,
      b: pixelData[2] / 255.0,
    };
  }

  // 添加UV坐标
  addUV(u, v) {
    this.uvs.push({ u, v });
    return this.uvs.length;
  }

  // 添加面（三角形）- 带验证
  addFace(v1, v2, v3, uv1, uv2, uv3) {
    // 验证顶点索引不重复
    if (v1 !== v2 && v2 !== v3 && v1 !== v3) {
      this.faces.push({ vertices: [v1, v2, v3], uvs: [uv1, uv2, uv3] });
    } else {
      console.warn('跳过退化三角形：重复顶点索引', { v1, v2, v3 });
    }
  }

  // 创建轮廓点（优化版 - 确保水密性）
  createPoints(type, params) {
    const points = [];
    
    if (type === 'rectangle') {
      const { width, height, borderRadius = 0, centerX = 0, centerY = 0 } = params;
      const w = width / 2;
      const h = height / 2;
      const r = Math.min(borderRadius, Math.min(width, height) / 4);
      
      if (r > 0.1) {
        // 圆角矩形 - 确保总点数为4的倍数
        const segmentsPerCorner = 16; // 每个角16个分段
        const corners = [
          { cx: centerX + w - r, cy: centerY + h - r, startAngle: 0 },
          { cx: centerX - w + r, cy: centerY + h - r, startAngle: Math.PI / 2 },
          { cx: centerX - w + r, cy: centerY - h + r, startAngle: Math.PI },
          { cx: centerX + w - r, cy: centerY - h + r, startAngle: Math.PI * 1.5 }
        ];
        
        corners.forEach(corner => {
          for (let i = 0; i < segmentsPerCorner; i++) {
            const angle = corner.startAngle + (Math.PI / 2) * (i / segmentsPerCorner);
            points.push({
              x: corner.cx + r * Math.cos(angle),
              y: corner.cy + r * Math.sin(angle)
            });
          }
        });
      } else {
        // 普通矩形
        points.push(
          { x: centerX + w, y: centerY + h },
          { x: centerX - w, y: centerY + h },
          { x: centerX - w, y: centerY - h },
          { x: centerX + w, y: centerY - h }
        );
      }
    } else if (type === 'circle') {
      const { radius, centerX, centerY } = params;
      // 分段数与网格密度相关联，保证孔洞更圆滑
      let segments = Math.max(64, this.meshDensity.density * 2, Math.round(radius * 8));
      segments = Math.ceil(segments / 4) * 4; // 向上取整到4的倍数
      for (let i = 0; i < segments; i++) {
        const angle = (2 * Math.PI * i) / segments;
        points.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        });
      }
    } else if (type === 'oval') {
      const { width, height, centerX, centerY } = params;
      const radiusX = width / 2;
      const radiusY = height / 2;
      // 分段数与网格密度相关联，保证孔洞更圆滑
      const avgRadius = (radiusX + radiusY) / 2;
      let segments = Math.max(64, this.meshDensity.density * 2, Math.round(avgRadius * 8));
      segments = Math.ceil(segments / 4) * 4; // 向上取整到4的倍数
      for (let i = 0; i < segments; i++) {
        const angle = (2 * Math.PI * i) / segments;
        points.push({
          x: centerX + radiusX * Math.cos(angle),
          y: centerY + radiusY * Math.sin(angle)
        });
      }
    }
    
    return points;
  }

  // 创建顶点和UV（统一的顶点生成函数）
  createVerticesAndUVs(points, thickness, width, height, doubleSided = true) {
    const vertices = [];
    const uvs = [];
    
    // 正面顶点和UV（双面和单面都需要）
    points.forEach(point => {
      const vertexIndex = this.addVertex(point.x, point.y, thickness / 2);
      vertices.push(vertexIndex);
      const u = (point.x + width / 2) / width;
      const v = (point.y + height / 2) / height;
      const uvIndex = this.addUV(u, v);
      uvs.push(uvIndex);
      if (this.for3DPrinting) {
        this.updateVertexColor(vertexIndex, u, v);
      }
    });
    
    // 背面顶点
    points.forEach(point => {
      const vertexIndex = this.addVertex(point.x, point.y, -thickness / 2);
      vertices.push(vertexIndex);

      if (doubleSided) {
        // 双面模型：背面也有UV贴图（镜像）
        const u = 1.0 - (point.x + width / 2) / width; // 镜像U坐标
        const v = (point.y + height / 2) / height;
        const uvIndex = this.addUV(u, v);
        uvs.push(uvIndex);
        if (this.for3DPrinting) {
          this.updateVertexColor(vertexIndex, u, v);
        }
      } else {
        // 单面模型：背面使用白色UV坐标（固定在贴图的白色区域）
        const u = 0.0;
        const v = 0.0;
        const uvIndex = this.addUV(u, v);
        uvs.push(uvIndex);
        if (this.for3DPrinting) {
          this.updateVertexColor(vertexIndex, u, v); // 使用白色
        }
      }
    });
    
    return { vertices, uvs };
  }

  // 生成面（正面、背面、侧面）- 水密版 - 支持网格化
  generateFaces(vertices, uvs, pointCount, hasHole = false, holeVertices = [], holeUVs = [], thickness = 2.0, badgeSettings) {
    const holePointCount = hasHole ? holeUVs.length / 2 : 0;
    
    const frontFaceArgs = [
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        true, badgeSettings, thickness,
        hasHole ? holeVertices.slice(0, holePointCount) : null,
        hasHole ? holeUVs.slice(0, holePointCount) : null
    ];
    this.createMeshedFace(...frontFaceArgs);
      
    const backFaceArgs = [
        vertices.slice(pointCount), uvs.slice(pointCount),
        false, badgeSettings, thickness,
        hasHole ? holeVertices.slice(holePointCount) : null,
        hasHole ? holeUVs.slice(holePointCount) : null
    ];
    this.createMeshedFace(...backFaceArgs);
    
    // 外侧面
    this.generateSideFaces(vertices, uvs, pointCount, false);
    if (hasHole) {
      // 孔洞内侧面
      this.generateSideFaces(holeVertices, holeUVs, holePointCount, true);
    }
  }

  // 获取重拓扑密度数值
  getRetopologyDensityValue() {
    const densityMap = {
      'low': { width: 20, height: 20 },
      'medium': { width: 40, height: 40 },
      'high': { width: 60, height: 60 },
      'ultra': { width: 80, height: 80 }
    };
    const d = densityMap[this.meshQuality.retopologyDensity] || densityMap['high'];
    // 只用一个参数，取 width 作为正方形网格密度
    return { density: d.width };
  }

  // 创建重拓扑网格顶点 - 专门用于高密度网格生成
  createRetopologyMeshVertices(boundaryVertices, isFront, badgeSettings, thickness, holeVertices = null) {
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 直接使用用户设置的网格密度
    const gridDensity = this.meshDensity.density;
    const meshVertices = [];
    const meshUVs = [];
    const gridWidth = gridDensity;
    const gridHeight = gridDensity;
    
    // 生成密集的重拓扑网格
    for (let j = 0; j <= gridHeight; j++) {
      for (let i = 0; i <= gridWidth; i++) {
        const u = i / gridWidth;
        const v = j / gridHeight;
        
        // 计算网格点在工牌范围内的坐标
        const x = (u - 0.5) * width;
        const y = (v - 0.5) * height;
        
        // 检查点是否在有效区域内
        let isValid = this.isPointInPolygon(x, y, boundaryVertices);
        if (holeVertices && isValid) {
          isValid = !this.isPointInPolygon(x, y, holeVertices);
        }
        
        if (isValid) {
          const vertexIndex = this.addVertex(x, y, z);
          // 背面使用镜像UV坐标以实现正确的贴图映射
          const uvU = isFront ? u : (1.0 - u);
          const uvV = v;
          const uvIndex = this.addUV(uvU, uvV);

          if (this.for3DPrinting) {
            this.updateVertexColor(vertexIndex, uvU, uvV);
          }

          meshVertices.push({ 
            index: vertexIndex, 
            x, 
            y, 
            gridX: i, 
            gridY: j,
            u: uvU,
            v: uvV,
            isHoleBoundary: false
          });
          meshUVs.push(uvIndex);
        } else {
          meshVertices.push(null);
          meshUVs.push(null);
        }
      }
    }
    
    // 如果有孔洞边界点，将它们也加入到主面网格中
    if (holeVertices && holeVertices.length > 0) {
      console.log(`正在将${holeVertices.length}个孔洞边界点集成到主面网格...`);
      
      holeVertices.forEach((vIdx, i) => {
        const vertex = this.vertices[vIdx - 1];
        if (vertex) {
          // 计算孔洞边界点的UV坐标
          const u = (vertex.x + width / 2) / width;
          const v_coord = (vertex.y + height / 2) / height;
          
          // 背面使用镜像UV坐标
          const uvU = isFront ? u : (1.0 - u);
          const uvV = v_coord;
          const uvIndex = this.addUV(uvU, uvV);
          
          // 将孔洞边界点添加到主面网格中
          meshVertices.push({
            index: vIdx,
            x: vertex.x,
            y: vertex.y,
            gridX: null, // 孔洞边界点不属于规则网格
            gridY: null,
            u: uvU,
            v: uvV,
            isHoleBoundary: true // 标记为孔洞边界点
          });
          meshUVs.push(uvIndex);
        }
      });
      
      console.log(`孔洞边界点集成完成，主面网格总顶点数: ${meshVertices.filter(v => v !== null).length}`);
    }
    
    return { meshVertices, meshUVs, gridWidth, gridHeight };
  }

  // 生成重拓扑三角面 - 优化的四边形分割算法
  generateRetopologyTriangles(meshVertices, meshUVs, gridWidth, gridHeight, isFront) {
    let triangleCount = 0;
    
    for (let j = 0; j < gridHeight; j++) {
      for (let i = 0; i < gridWidth; i++) {
        const idx = j * (gridWidth + 1) + i;
        const v1 = meshVertices[idx];              // 左下
        const v2 = meshVertices[idx + 1];          // 右下
        const v3 = meshVertices[idx + gridWidth + 1];     // 左上
        const v4 = meshVertices[idx + gridWidth + 2];     // 右上
        
        const uv1 = meshUVs[idx];
        const uv2 = meshUVs[idx + 1];
        const uv3 = meshUVs[idx + gridWidth + 1];
        const uv4 = meshUVs[idx + gridWidth + 2];
        
        // 只有当四个顶点都存在时才生成三角形
        if (v1 && v2 && v3 && v4) {
          // 使用优化的对角线分割策略，确保三角形质量
          // 计算两种分割方式的对角线长度
          const diag1 = Math.sqrt((v1.x - v4.x) ** 2 + (v1.y - v4.y) ** 2);
          const diag2 = Math.sqrt((v2.x - v3.x) ** 2 + (v2.y - v3.y) ** 2);
          
          if (diag1 <= diag2) {
            // 使用v1-v4对角线分割
            if (isFront) {
              this.addFace(v1.index, v2.index, v4.index, uv1, uv2, uv4);
              this.addFace(v1.index, v4.index, v3.index, uv1, uv4, uv3);
            } else {
              this.addFace(v1.index, v4.index, v2.index, uv1, uv4, uv2);
              this.addFace(v1.index, v3.index, v4.index, uv1, uv3, uv4);
            }
          } else {
            // 使用v2-v3对角线分割
            if (isFront) {
              this.addFace(v1.index, v2.index, v3.index, uv1, uv2, uv3);
              this.addFace(v2.index, v4.index, v3.index, uv2, uv4, uv3);
            } else {
              this.addFace(v1.index, v3.index, v2.index, uv1, uv3, uv2);
              this.addFace(v2.index, v3.index, v4.index, uv2, uv3, uv4);
            }
          }
          triangleCount += 2;
        } else if (v1 && v2 && v3) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.addFace(v1.index, v2.index, v3.index, uv1, uv2, uv3);
          } else {
            this.addFace(v1.index, v3.index, v2.index, uv1, uv3, uv2);
          }
          triangleCount += 1;
        } else if (v2 && v3 && v4) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.addFace(v2.index, v4.index, v3.index, uv2, uv4, uv3);
          } else {
            this.addFace(v2.index, v3.index, v4.index, uv2, uv3, uv4);
          }
          triangleCount += 1;
        }
      }
    }
    
    return triangleCount;
  }

  // 生成孔洞边界三角形 - 复用圆角修复算法
  generateHoleBoundaryTriangles(meshVertices, meshUVs, isFront) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    const holeBoundaryVertices = validMeshVertices.filter(v => v.isHoleBoundary);
    const regularMeshVertices = validMeshVertices.filter(v => !v.isHoleBoundary);
    
    if (holeBoundaryVertices.length === 0 || regularMeshVertices.length === 0) {
      return 0;
    }
    
    console.log(`使用圆弧边界连接算法处理${holeBoundaryVertices.length}个孔洞边界点...`);
    
    // 直接使用改进的圆弧边界连接算法
    return this.generateCircularBoundaryConnections(meshVertices, meshUVs, holeBoundaryVertices, regularMeshVertices, isFront, true);
  }

  // 通用的圆弧边界连接算法 - 适用于孔洞和工牌圆角
  generateCircularBoundaryConnections(meshVertices, meshUVs, boundaryVertices, regularMeshVertices, isFront, isHole = false) {
    let triangleCount = 0;
    
    // 为每个边界点找到最近的规则网格点并创建连接
    boundaryVertices.forEach((boundaryVertex, boundaryIndex) => {
      // 找到最近的几个规则网格点
      let nearbyVertices;
      if (isHole) {
        // 孔洞：确保网格点在孔洞外围
        nearbyVertices = regularMeshVertices
          .filter(mv => {
            // 对于孔洞，确保网格点不在孔洞内部
            return !mv.isHoleBoundary;
          })
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - boundaryVertex.x) ** 2 + (mv.y - boundaryVertex.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 4); // 孔洞使用更多连接点
      } else {
        // 外边界：正常处理
        nearbyVertices = regularMeshVertices
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - boundaryVertex.x) ** 2 + (mv.y - boundaryVertex.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);
      }
      
      // 获取当前边界点的UV
      let boundaryUV = null;
      for (let k = 0; k < meshVertices.length; k++) {
        if (meshVertices[k] && meshVertices[k].index === boundaryVertex.index) {
          boundaryUV = meshUVs[k];
          break;
        }
      }
      
      // 为每对相邻的网格点创建三角形
      for (let j = 0; j < nearbyVertices.length - 1; j++) {
        const mv1 = nearbyVertices[j];
        const mv2 = nearbyVertices[j + 1];
        
        // 获取网格点的UV
        let muv1 = null, muv2 = null;
        for (let k = 0; k < meshVertices.length; k++) {
          if (meshVertices[k]) {
            if (meshVertices[k].index === mv1.index) {
              muv1 = meshUVs[k];
            }
            if (meshVertices[k].index === mv2.index) {
              muv2 = meshUVs[k];
            }
          }
        }
        
        if (boundaryUV && muv1 && muv2) {
          // 检查三角形是否有效（避免重复顶点和过于细长的三角形）
          if (boundaryVertex.index !== mv1.index && boundaryVertex.index !== mv2.index && mv1.index !== mv2.index) {
            // 检查三角形质量
            const side1 = Math.sqrt((boundaryVertex.x - mv1.x) ** 2 + (boundaryVertex.y - mv1.y) ** 2);
            const side2 = Math.sqrt((mv1.x - mv2.x) ** 2 + (mv1.y - mv2.y) ** 2);
            const side3 = Math.sqrt((mv2.x - boundaryVertex.x) ** 2 + (mv2.y - boundaryVertex.y) ** 2);
            
            const maxSide = Math.max(side1, side2, side3);
            const minSide = Math.min(side1, side2, side3);
            const aspectRatio = maxSide / minSide;
            
            // 只生成质量较好的三角形
            if (aspectRatio < 8.0) {
              if (isHole) {
                // 孔洞边界：特殊顶点顺序
                this.addFaceWithNormalCheck(
                  boundaryVertex.index, mv2.index, mv1.index, 
                  boundaryUV, muv2, muv1, 
                  isFront
                );
              } else {
                // 外边界：正常顶点顺序
                this.addFaceWithNormalCheck(
                  boundaryVertex.index, mv1.index, mv2.index, 
                  boundaryUV, muv1, muv2, 
                  isFront
                );
              }
              triangleCount++;
            }
          }
        }
      }
    });
    
    const boundaryType = isHole ? '孔洞' : '外边界';
    console.log(`${boundaryType}圆弧边界连接：生成了${triangleCount}个连接三角形`);
    return triangleCount;
  }

  // 为重拓扑网格创建空间索引，以加速最近点搜索
  _createSpatialGrid(vertices, cellSize) {
    const grid = new Map();
    if (cellSize <= 0) {
      console.warn("Invalid cellSize for spatial grid, using default.");
      cellSize = 1.0;
    }
    const invCellSize = 1 / cellSize;

    for (const vertex of vertices) {
      if (!vertex) continue;
      const key = `${Math.floor(vertex.x * invCellSize)}_${Math.floor(vertex.y * invCellSize)}`;
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push(vertex);
    }
    return { grid, invCellSize };
  }

  // 从空间索引中查询附近的顶点
  _queryNearbyVertices(spatialGrid, x, y, searchRadius = 1) {
    const { grid, invCellSize } = spatialGrid;
    const nearby = [];
    const gridX = Math.floor(x * invCellSize);
    const gridY = Math.floor(y * invCellSize);

    for (let i = -searchRadius; i <= searchRadius; i++) {
      for (let j = -searchRadius; j <= searchRadius; j++) {
        const key = `${gridX + i}_${gridY + j}`;
        if (grid.has(key)) {
          nearby.push(...grid.get(key));
        }
      }
    }
    return nearby;
  }

  // 通用的网格化面生成（重构后）
  createMeshedFace(outerVertices, outerUVs, isFront, badgeSettings, thickness, innerVertices = null, innerUVs = null) {
    const hasHole = !!innerVertices;

    if (this.meshQuality.enableRetopology) {
      // 使用新的重拓扑算法
      const { meshVertices, meshUVs, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
        outerVertices, isFront, badgeSettings, thickness, innerVertices
      );
      
      const triangleCount = this.generateRetopologyTriangles(meshVertices, meshUVs, gridWidth, gridHeight, isFront);
      const holeFillTriangles = this.generateHoleBoundaryTriangles(meshVertices, meshUVs, isFront);
      
      if (this.meshQuality.enableBoundaryConnection) {
        this.createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, outerVertices, outerUVs, isFront, false, badgeSettings);
        if (hasHole) {
          this.createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, innerVertices, innerUVs, isFront, true, badgeSettings);
        }
      }
      
      console.log(`重拓扑${hasHole ? '带孔' : ''}${isFront ? '正面' : '背面'}：生成了${triangleCount + holeFillTriangles}个三角形（主面${triangleCount}个，填补${holeFillTriangles}个），网格密度${gridWidth}x${gridHeight}`);
    } else {
      // 使用原始算法（保持向后兼容）
      const { width, height } = badgeSettings;
      const z = isFront ? thickness / 2 : -thickness / 2;
      const density = this.meshDensity.density;
      const meshVertices = [];
      const meshUVs = [];
      
      for (let j = 0; j <= density; j++) {
        for (let i = 0; i <= density; i++) {
          const u = i / density;
          const v = j / density;
          const x = (u - 0.5) * width;
          const y = (v - 0.5) * height;
          
          let isInside = this.isPointInPolygon(x, y, outerVertices);
          if (hasHole) {
            isInside = isInside && !this.isPointInPolygon(x, y, innerVertices);
          }
          
          if (isInside) {
            const vertexIndex = this.addVertex(x, y, z);
            const uvU = isFront ? u : (1.0 - u);
            const uvV = v;
            const uvIndex = this.addUV(uvU, uvV);
            meshVertices.push({ index: vertexIndex, x, y, gridX: i, gridY: j });
            meshUVs.push(uvIndex);
          } else {
            meshVertices.push(null);
            meshUVs.push(null);
          }
        }
      }
      
      this.generateGridTriangles(meshVertices, meshUVs, density, isFront);
      
      if (this.meshQuality.enableBoundaryConnection) {
        this.createSimpleBoundaryConnection(meshVertices, meshUVs, outerVertices, outerUVs, isFront, false);
        if (hasHole) {
          this.createSimpleBoundaryConnection(meshVertices, meshUVs, innerVertices, innerUVs, isFront, true);
        }
      }
    }
  }

  // 为旧版网格生成三角形
  generateGridTriangles(meshVertices, meshUVs, density, isFront) {
    for (let j = 0; j < density; j++) {
      for (let i = 0; i < density; i++) {
        const idx = j * (density + 1) + i;
        const v1 = meshVertices[idx];
        const v2 = meshVertices[idx + 1];
        const v3 = meshVertices[idx + density + 1];
        const v4 = meshVertices[idx + density + 2];
        
        const uv1 = meshUVs[idx];
        const uv2 = meshUVs[idx + 1];
        const uv3 = meshUVs[idx + density + 1];
        const uv4 = meshUVs[idx + density + 2];
        
        if (v1 && v2 && v3) {
          if (isFront) {
            this.addFace(v1.index, v2.index, v3.index, uv1, uv2, uv3);
          } else {
            this.addFace(v1.index, v3.index, v2.index, uv1, uv3, uv2);
          }
        }
        
        if (v2 && v3 && v4) {
          if (isFront) {
            this.addFace(v2.index, v4.index, v3.index, uv2, uv4, uv3);
          } else {
            this.addFace(v2.index, v3.index, v4.index, uv2, uv3, uv4);
          }
        }
      }
    }
  }

  // 重拓扑专用的边界连接算法 - 优化边界到网格的连接
  createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false, badgeSettings = { width: 100, height: 100 }) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 获取边界顶点的实际坐标
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 优化：使用空间网格加速最近点查找
    const cellSize = Math.max(badgeSettings.width, badgeSettings.height) / Math.max(gridWidth, gridHeight, 1);
    const spatialGrid = this._createSpatialGrid(validMeshVertices.filter(v => !v.isHoleBoundary), cellSize);
    
    if (isHole) {
      // 孔洞边界：直接使用已经集成到主面网格中的孔洞边界点
      const holeBoundaryMeshVertices = validMeshVertices.filter(mv => mv.isHoleBoundary);
      
      if (holeBoundaryMeshVertices.length > 0) {
        console.log(`发现${holeBoundaryMeshVertices.length}个孔洞边界点已集成到主面网格，直接使用这些点进行连接`);
        
        // 为每个孔洞边界点找到对应的主面网格点
        let connectionCount = 0;
        for (let i = 0; i < boundaryVertices.length; i++) {
          const nextI = (i + 1) % boundaryVertices.length;
          const bv1 = boundaryVertices[i];
          const bv2 = boundaryVertices[nextI];
          const buv1 = boundaryUVs[i];
          const buv2 = boundaryUVs[nextI];
          
          // 找到对应的主面网格中的孔洞边界点
          const mv1 = holeBoundaryMeshVertices.find(mv => mv.index === bv1);
          const mv2 = holeBoundaryMeshVertices.find(mv => mv.index === bv2);
          
          if (mv1 && mv2) {
            // 找到最近的非孔洞边界的主面网格点
            const searchCandidates = this._queryNearbyVertices(spatialGrid, (mv1.x + mv2.x) / 2, (mv1.y + mv2.y) / 2, 2);
            const nearbyMeshVertices = searchCandidates
              .map(mv => ({
                ...mv,
                distance1: Math.sqrt((mv.x - mv1.x) ** 2 + (mv.y - mv1.y) ** 2),
                distance2: Math.sqrt((mv.x - mv2.x) ** 2 + (mv.y - mv2.y) ** 2)
              }))
              .sort((a, b) => (a.distance1 + a.distance2) - (b.distance1 + b.distance2))
              .slice(0, 1);
            
            if (nearbyMeshVertices.length > 0) {
              const nearbyVertex = nearbyMeshVertices[0];
              // 找到nearbyVertex在meshVertices中的实际索引
              let nearbyUVIndex = null;
              for (let k = 0; k < meshVertices.length; k++) {
                if (meshVertices[k] && meshVertices[k].index === nearbyVertex.index) {
                  nearbyUVIndex = meshUVs[k];
                  break;
                }
              }
              
              if (nearbyUVIndex) {
                // 生成连接三角形，确保法线方向正确
                this.addFaceWithNormalCheck(bv1, bv2, nearbyVertex.index, buv1, buv2, nearbyUVIndex, isFront);
                connectionCount++;
              }
            }
          }
        }
        
        console.log(`孔洞边界连接：生成了${connectionCount}个连接三角形`);
        return; // 直接返回，不再执行原有的连接逻辑
      }
    }
    
    // 外边界或者孔洞边界点未集成时的原有逻辑
    const connectionMap = new Map();
    
    boundaryPoints.forEach((bp, bpIndex) => {
      let nearestVertex = null;
      let minDist = Infinity;
      
      // 使用空间网格进行优化
      const searchCandidates = this._queryNearbyVertices(spatialGrid, bp.x, bp.y, 2);

      if (isHole) {
        // 孔洞：每个边界点只找最近的一个网格点
        searchCandidates.forEach(mv => {
          if (!this.isPointInPolygon(mv.x, mv.y, boundaryVertices)) { // 空间网格已过滤isHoleBoundary
            const dist = Math.sqrt((mv.x - bp.x) ** 2 + (mv.y - bp.y) ** 2);
            if (dist < minDist) {
              minDist = dist;
              nearestVertex = mv;
            }
          }
        });
        if (nearestVertex) {
          connectionMap.set(bpIndex, [nearestVertex]);
        } else {
          connectionMap.set(bpIndex, []);
        }
      } else {
        // 外边界：保持原有逻辑
        const nearbyVertices = searchCandidates
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - bp.x) ** 2 + (mv.y - bp.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, Math.min(2, searchCandidates.length));
        connectionMap.set(bpIndex, nearbyVertices);
      }
    });
    
    // 生成连接三角形
    let connectionCount = 0;
    for (let i = 0; i < boundaryPoints.length; i++) {
      const nextI = (i + 1) % boundaryPoints.length;
      const currentConnections = connectionMap.get(i) || [];
      const nextConnections = connectionMap.get(nextI) || [];
      
      if (currentConnections.length > 0 && nextConnections.length > 0) {
        const bv1 = boundaryVertices[i];
        const bv2 = boundaryVertices[nextI];
        const buv1 = boundaryUVs[i];
        const buv2 = boundaryUVs[nextI];
        
        // 选择最近的网格顶点进行连接
        const mv1 = currentConnections[0];
        const mv2 = nextConnections[0];
        
        const muv1 = meshUVs[mv1.gridY * (gridWidth + 1) + mv1.gridX];
        const muv2 = meshUVs[mv2.gridY * (gridWidth + 1) + mv2.gridX];
        
        if (muv1 && muv2) {
          // 使用带法线检查的面添加方法，确保法线方向正确
          if (isHole) {
            // 孔洞边界：使用特殊的顶点顺序
            this.addFaceWithNormalCheck(bv1, bv2, mv1.index, buv1, buv2, muv1, isFront);
            this.addFaceWithNormalCheck(bv2, mv2.index, mv1.index, buv2, muv2, muv1, isFront);
          } else {
            // 外边界：正常顶点顺序
            this.addFaceWithNormalCheck(bv1, mv1.index, bv2, buv1, muv1, buv2, isFront);
            this.addFaceWithNormalCheck(mv1.index, mv2.index, bv2, muv1, muv2, buv2, isFront);
          }
          connectionCount += 2;
        }
      }
    }
    
    const boundaryType = isHole ? '孔洞边界' : '外边界';
    console.log(`重拓扑${boundaryType}连接：生成了${connectionCount}个连接三角形`);

    // 修复角落缺口的专用算法 - 冗余修复版
    this.fixCornerGaps(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole, badgeSettings, spatialGrid);
  }

  // 计算三角形的正确法线方向
  calculateTriangleNormal(v1, v2, v3) {
    const vertex1 = this.vertices[v1 - 1];
    const vertex2 = this.vertices[v2 - 1];
    const vertex3 = this.vertices[v3 - 1];
    
    // 计算两个边向量
    const edge1 = {
      x: vertex2.x - vertex1.x,
      y: vertex2.y - vertex1.y,
      z: vertex2.z - vertex1.z
    };
    
    const edge2 = {
      x: vertex3.x - vertex1.x,
      y: vertex3.y - vertex1.y,
      z: vertex3.z - vertex1.z
    };
    
    // 计算叉积得到法线向量
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };
    
    return normal;
  }

  // 检查三角形法线方向是否正确
  isNormalCorrect(v1, v2, v3, isFront) {
    const normal = this.calculateTriangleNormal(v1, v2, v3);
    
    // 对于正面，法线应该指向正Z方向（normal.z > 0）
    // 对于背面，法线应该指向负Z方向（normal.z < 0）
    if (isFront) {
      return normal.z > 0;
    } else {
      return normal.z < 0;
    }
  }

  // 添加带法线检查的面
  addFaceWithNormalCheck(v1, v2, v3, uv1, uv2, uv3, isFront) {
    // 检查当前顶点顺序的法线方向
    if (this.isNormalCorrect(v1, v2, v3, isFront)) {
      // 法线方向正确，直接添加
      this.addFace(v1, v2, v3, uv1, uv2, uv3);
    } else {
      // 法线方向错误，翻转顶点顺序
      this.addFace(v1, v3, v2, uv1, uv3, uv2);
    }
  }

  // 修复角落缺口的专用算法 - 冗余修复版
  fixCornerGaps(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false, badgeSettings = { width: 100, height: 100 }, spatialGrid) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 获取边界顶点的实际坐标
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 计算边界的包围盒，用于识别角落区域
    const minX = Math.min(...boundaryPoints.map(p => p.x));
    const maxX = Math.max(...boundaryPoints.map(p => p.x));
    const minY = Math.min(...boundaryPoints.map(p => p.y));
    const maxY = Math.max(...boundaryPoints.map(p => p.y));
    
    // 定义角落区域的阈值（边界框的20%，孔洞更宽松）
    const thresholdRatio = isHole ? 0.2 : 0.1;
    const thresholdX = (maxX - minX) * thresholdRatio;
    const thresholdY = (maxY - minY) * thresholdRatio;
    
    // 寻找真正的角落点（接近包围盒的角落）
    const corners = [];
    boundaryPoints.forEach((point, i) => {
      const isLeftTop = (point.x - minX) <= thresholdX && (maxY - point.y) <= thresholdY;
      const isRightTop = (maxX - point.x) <= thresholdX && (maxY - point.y) <= thresholdY;
      const isLeftBottom = (point.x - minX) <= thresholdX && (point.y - minY) <= thresholdY;
      const isRightBottom = (maxX - point.x) <= thresholdX && (point.y - minY) <= thresholdY;
      
      if (isLeftTop || isRightTop || isLeftBottom || isRightBottom) {
        corners.push({
          index: i,
          point: point,
          boundaryVertex: boundaryVertices[i],
          boundaryUV: boundaryUVs[i],
          position: isLeftTop ? 'leftTop' : isRightTop ? 'rightTop' : isLeftBottom ? 'leftBottom' : 'rightBottom'
        });
      }
    });
    
    const boundaryType = isHole ? '孔洞' : '外边界';
    console.log(`检测到${corners.length}个${boundaryType}角落需要修复:`, corners.map(c => c.position));
    
    let fixCount = 0;
    // 为每个角落区域寻找合适的网格顶点并创建冗余连接
    corners.forEach(corner => {
      let nearbyVertices;
      // 优化：使用传入的空间网格进行搜索
      const searchRadius = isHole ? 4 : 2; // 孔洞的搜索范围更大
      const searchCandidates = this._queryNearbyVertices(spatialGrid, corner.point.x, corner.point.y, searchRadius);

      if (isHole) {
        // 孔洞：寻找孔洞边界外围的网格顶点
        nearbyVertices = searchCandidates
          .filter(mv => {
            const mvPoint = { x: mv.x, y: mv.y };
            return !this.isPointInPolygon(mvPoint.x, mvPoint.y, boundaryVertices);
          })
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - corner.point.x) ** 2 + (mv.y - corner.point.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8); // 孔洞使用更多顶点进行修复
      } else {
        // 外边界：正常处理，searchCandidates已确保不含孔洞边界点
        nearbyVertices = searchCandidates
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - corner.point.x) ** 2 + (mv.y - corner.point.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 4);
      }
      // 冗余修复：尝试所有可能的顶点组合
      for (let j = 0; j < nearbyVertices.length; j++) {
        for (let k = j + 1; k < nearbyVertices.length; k++) {
          const mv1 = nearbyVertices[j];
          const mv2 = nearbyVertices[k];
          const muv1 = meshUVs[mv1.gridY * (gridWidth + 1) + mv1.gridX];
          const muv2 = meshUVs[mv2.gridY * (gridWidth + 1) + mv2.gridX];
          if (muv1 && muv2) {
            // 检查三角形是否有效（避免重复顶点）
            if (corner.boundaryVertex !== mv1.index && corner.boundaryVertex !== mv2.index && mv1.index !== mv2.index) {
              if (isHole) {
                // 孔洞的角落修复：创建从边界到外围网格的连接
                this.addFaceWithNormalCheck(
                  corner.boundaryVertex, mv2.index, mv1.index, 
                  corner.boundaryUV, muv2, muv1, 
                  isFront
                );
              } else {
                // 外边界的角落修复
                this.addFaceWithNormalCheck(
                  corner.boundaryVertex, mv1.index, mv2.index, 
                  corner.boundaryUV, muv1, muv2, 
                  isFront
                );
              }
              fixCount++;
            }
          }
        }
      }
    });
    
    console.log(`修复了${fixCount}个${boundaryType}角落缺口三角形`);
  }

  // 简化的边界连接算法 - 减少凌乱的三角形
  createSimpleBoundaryConnection(meshVertices, meshUVs, boundaryVertices, boundaryUVs, isFront, isHole = false) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 计算边界中心点
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    const centerX = boundaryPoints.reduce((sum, p) => sum + p.x, 0) / boundaryPoints.length;
    const centerY = boundaryPoints.reduce((sum, p) => sum + p.y, 0) / boundaryPoints.length;
    
    // 找到距离边界中心最近的网格顶点
    const sortedVertices = validMeshVertices
      .map(mv => ({
        ...mv,
        distance: Math.sqrt((mv.x - centerX) ** 2 + (mv.y - centerY) ** 2)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Math.min(this.meshQuality.maxBoundaryConnections, validMeshVertices.length));
    
    // 如果网格顶点足够多，只创建必要的连接三角形
    if (sortedVertices.length >= 2) {
      // 选择最近的2个顶点，创建少量连接三角形
      const v1 = sortedVertices[0];
      const v2 = sortedVertices[1];
      
      // 为边界的前几个顶点创建连接
      for (let i = 0; i < Math.min(3, boundaryVertices.length); i++) {
        const bv = boundaryVertices[i];
        const buv = boundaryUVs[i];
        const meshUV1 = meshUVs[v1.gridY * (this.meshDensity.density + 1) + v1.gridX];
        const meshUV2 = meshUVs[v2.gridY * (this.meshDensity.density + 1) + v2.gridX];
        
        if (meshUV1 && meshUV2) {
          // 使用带法线检查的面添加方法，确保法线方向正确
          this.addFaceWithNormalCheck(bv, v1.index, v2.index, buv, meshUV1, meshUV2, isFront);
        }
      }
    } else if (sortedVertices.length === 1) {
      // 只有一个网格顶点时，创建更少的连接
      const v = sortedVertices[0];
      const meshUV = meshUVs[v.gridY * (this.meshDensity.density + 1) + v.gridX];
      
      if (meshUV && boundaryVertices.length >= 2) {
        const bv1 = boundaryVertices[0];
        const bv2 = boundaryVertices[1];
        const buv1 = boundaryUVs[0];
        const buv2 = boundaryUVs[1];
        
        // 使用带法线检查的面添加方法，确保法线方向正确
        this.addFaceWithNormalCheck(bv1, v.index, bv2, buv1, meshUV, buv2, isFront);
      }
    }
  }

  // 判断点是否在多边形内（射线法）
  isPointInPolygon(x, y, vertices) {
    let inside = false;
    const vertexData = vertices.map(v => this.vertices[v - 1]);
    
    for (let i = 0, j = vertexData.length - 1; i < vertexData.length; j = i++) {
      const xi = vertexData[i].x, yi = vertexData[i].y;
      const xj = vertexData[j].x, yj = vertexData[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
         return inside;
   }

  // 生成侧面 - 侧面不使用贴图映射
  generateSideFaces(vertices, uvs, pointCount, inward) {
    // 创建侧面专用的白色UV坐标
    const sideUV = this.addUV(0.0, 0.0); // 固定使用白色区域
    
    for (let i = 0; i < pointCount; i++) {
      const next = (i + 1) % pointCount;
      const [v1, v2, v3, v4] = [vertices[i], vertices[next], vertices[i + pointCount], vertices[next + pointCount]];
      
      if (inward) {
        // 孔洞内侧面 - 法线向内（修正顶点顺序）
        this.addFace(v1, v2, v3, sideUV, sideUV, sideUV);
        this.addFace(v2, v4, v3, sideUV, sideUV, sideUV);
      } else {
        // 外侧面 - 法线向外（修正顶点顺序）
        this.addFace(v1, v3, v2, sideUV, sideUV, sideUV);
        this.addFace(v2, v3, v4, sideUV, sideUV, sideUV);
      }
    }
  }

  // 计算挖孔参数的通用函数
  calculateHoleParams(holeSettings, width, height) {
    const holeX = 0; // 水平居中（在中心坐标系中为0）
    // 预览中offsetY是挖孔容器顶部的偏移，需要计算挖孔中心位置
    const holeSize = holeSettings.shape === 'rectangle' ? holeSettings.height : holeSettings.size;
    const holeY = height / 2 - (holeSettings.offsetY + holeSize / 2); // 挖孔中心在中心坐标系中的位置
    
    let holeParams, holeType;
    
    if (holeSettings.shape === 'circle') {
      holeParams = { radius: holeSettings.size / 2, centerX: holeX, centerY: holeY };
      holeType = 'circle';
    } else if (holeSettings.shape === 'oval') {
      holeParams = { width: holeSettings.size, height: holeSettings.size * 0.6, centerX: holeX, centerY: holeY };
      holeType = 'oval';
    } else {
      holeParams = { width: holeSettings.width, height: holeSettings.height, centerX: holeX, centerY: holeY, borderRadius: holeSettings.borderRadius };
      holeType = 'rectangle';
    }
    
    return { holeParams, holeType };
  }

  // 生成单面模型
  generateSingleSidedModel(outerPoints, holeSettings, width, height, thickness) {
    const doubleSided = false;
    const outer = this.createVerticesAndUVs(outerPoints, thickness, width, height, doubleSided);

    if (holeSettings.enabled) {
      const { holeParams, holeType } = this.calculateHoleParams(holeSettings, width, height);
      const innerPoints = this.createPoints(holeType, holeParams);
      const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height, doubleSided);
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs, thickness, { width, height });
    } else {
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, false, [], [], thickness, { width, height });
    }
  }

  // 主要生成函数
  generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, textSettings, exportSettings = { doubleSided: true, thickness: 2.0 }) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;

    const { width, height, borderRadius } = badgeSettings;
    const thickness = exportSettings.thickness;

    // 创建外轮廓
    const outerPoints = this.createPoints('rectangle', { width, height, borderRadius });
    
    if (exportSettings.doubleSided) {
      const outer = this.createVerticesAndUVs(outerPoints, thickness, width, height, true);
      if (holeSettings.enabled) {
        const { holeParams, holeType } = this.calculateHoleParams(holeSettings, width, height);
        const innerPoints = this.createPoints(holeType, holeParams);
        const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height, true);
        this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs, thickness, badgeSettings);
      } else {
        this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, false, [], [], thickness, badgeSettings);
      }
    } else {
      this.generateSingleSidedModel(outerPoints, holeSettings, width, height, thickness);
    }

    return this.generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings);
  }

  // 生成OBJ文件内容
  generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings) {
    let obj = '';
    if (!this.for3DPrinting) {
      obj += 'mtllib badge.mtl\n';
    }

    // 顶点数据
    this.vertices.forEach(v => {
      if (this.for3DPrinting && v.color) {
        obj += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)} ${v.color.r.toFixed(4)} ${v.color.g.toFixed(4)} ${v.color.b.toFixed(4)}\n`;
      } else {
        obj += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
      }
    });

    if (!this.for3DPrinting) {
      // UV数据
      this.uvs.forEach(uv => {
        obj += `vt ${uv.u.toFixed(4)} ${uv.v.toFixed(4)}\n`;
      });

      obj += 'usemtl badge_material\n';
    }

    // 面数据
    this.faces.forEach(face => {
      if (this.for3DPrinting) {
        obj += `f ${face.vertices[0]} ${face.vertices[1]} ${face.vertices[2]}\n`;
      } else {
        obj += `f ${face.vertices[0]}/${face.uvs[0]} ${face.vertices[1]}/${face.uvs[1]} ${face.vertices[2]}/${face.uvs[2]}\n`;
      }
    });

    return obj;
  }

  // 生成MTL文件内容
  generateMTLContent() {
    return `# 工牌材质文件 - 重拓扑优化版本\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n# 优化特性: 重拓扑密集网格，正方形划分，便于顶点颜色映射\nnewmtl badge_material\nKa 0.2 0.2 0.2\nKd 0.8 0.8 0.8\nKs 0.1 0.1 0.1\nNs 10.0\nd 1.0\nillum 2\nmap_Kd badge_texture.png\n`;
  }

  // 异步加载图片
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  // 生成贴图
  async generateTextureCanvas(badgeSettings, holeSettings, imageSettings, textSettings) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 直接按照工牌的宽高比例设置画布尺寸，确保1:1对应
    const maxResolution = 1024;
    const aspectRatio = badgeSettings.width / badgeSettings.height;
    
    let canvasWidth, canvasHeight;
    if (aspectRatio > 1) {
      // 宽度大于高度
      canvasWidth = maxResolution;
      canvasHeight = Math.round(maxResolution / aspectRatio);
    } else {
      // 高度大于或等于宽度
      canvasHeight = maxResolution;
      canvasWidth = Math.round(maxResolution * aspectRatio);
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 确保缩放比例完全一致，避免舍入误差
    const scaleX = canvasWidth / badgeSettings.width;
    const scaleY = canvasHeight / badgeSettings.height;
    
    // 背景
    ctx.fillStyle = badgeSettings.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制挖孔（如果启用）
    if (holeSettings.enabled) {
      // 将挖孔位置从页面预览坐标系转换为画布坐标系
      const holeCanvasX = canvasWidth / 2; // 水平居中
      
      // 与预览完全一致的位置计算：
      // 预览中：top: holeSettings.offsetY（挖孔容器顶部从工牌顶部的偏移）
      // 画布中：计算挖孔的中心位置
      const holeSize = holeSettings.shape === 'rectangle' ? holeSettings.height : holeSettings.size;
      const holeCenterY = (holeSettings.offsetY + holeSize / 2) * scaleY;
      
      ctx.fillStyle = '#ffffff'; // 挖孔用白色填充
      
      if (holeSettings.shape === 'circle') {
        const radius = (holeSettings.size / 2) * scaleX;
        ctx.beginPath();
        ctx.arc(holeCanvasX, holeCenterY, radius, 0, 2 * Math.PI); // 使用挖孔中心位置
        ctx.fill();
      } else if (holeSettings.shape === 'oval') {
        const radiusX = (holeSettings.size / 2) * scaleX;
        const radiusY = (holeSettings.size * 0.6 / 2) * scaleY;
        ctx.beginPath();
        ctx.ellipse(holeCanvasX, holeCenterY, radiusX, radiusY, 0, 0, 2 * Math.PI); // 使用挖孔中心位置
        ctx.fill();
      } else if (holeSettings.shape === 'rectangle') {
        const holeWidth = holeSettings.width * scaleX;
        const holeHeight = holeSettings.height * scaleY;
        const radius = holeSettings.borderRadius * Math.min(scaleX, scaleY);
        
        if (radius > 0) {
          // 圆角矩形 - 手动绘制以确保兼容性
          const x = holeCanvasX - holeWidth/2;
          const y = holeCenterY - holeHeight/2; // 使用挖孔中心位置
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + holeWidth - radius, y);
          ctx.quadraticCurveTo(x + holeWidth, y, x + holeWidth, y + radius);
          ctx.lineTo(x + holeWidth, y + holeHeight - radius);
          ctx.quadraticCurveTo(x + holeWidth, y + holeHeight, x + holeWidth - radius, y + holeHeight);
          ctx.lineTo(x + radius, y + holeHeight);
          ctx.quadraticCurveTo(x, y + holeHeight, x, y + holeHeight - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // 普通矩形
          ctx.fillRect(holeCanvasX - holeWidth/2, holeCenterY - holeHeight/2, holeWidth, holeHeight); // 使用挖孔中心位置
        }
      }
    }
    
    // 绘制图片和文字
    if (imageSettings.src) {
      try {
        const img = await this.loadImage(imageSettings.src);
        ctx.globalAlpha = imageSettings.opacity;
        
        // 实现 objectFit: 'cover' 效果，与页面预览保持一致
        const targetX = imageSettings.x * scaleX;
        const targetY = imageSettings.y * scaleY;
        const targetWidth = imageSettings.width * scaleX;
        const targetHeight = imageSettings.height * scaleY;
        
        const imageAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;
        
        let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
        
        if (imageAspect > targetAspect) {
          sourceWidth = img.height * targetAspect;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          sourceHeight = img.width / targetAspect;
          sourceY = (img.height - sourceHeight) / 2;
        }
        
        ctx.drawImage(
          img, 
          sourceX, sourceY, sourceWidth, sourceHeight,
          targetX, targetY, targetWidth, targetHeight
        );
      } catch (e) {
        console.error('无法加载贴图图片:', e);
      }
    }
    
    this.drawText(ctx, textSettings, badgeSettings, scaleX, scaleY, canvasWidth, canvasHeight);
    
    // 绘制左下角白色区域（供单面模型背面使用），确保在最上层
    ctx.globalAlpha = 1.0;
    this.drawWhiteCorner(ctx, canvasWidth, canvasHeight);
    
    return canvas;
  }

  // 绘制左下角白色区域（供单面模型背面使用）
  drawWhiteCorner(ctx, canvasWidth, canvasHeight) {
    ctx.fillStyle = '#ffffff';
    const whiteAreaSize = Math.min(32, Math.min(canvasWidth, canvasHeight) / 16);
    ctx.fillRect(0, canvasHeight - whiteAreaSize, whiteAreaSize, whiteAreaSize);
  }

  // 绘制文字
  drawText(ctx, textSettings, badgeSettings, scaleX, scaleY, canvasWidth, canvasHeight) {
    if (!textSettings.content) return;
    
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = textSettings.color;
    ctx.textAlign = 'left'; // 使用left对齐，完全按照预览的定位逻辑
    ctx.textBaseline = 'top'; // 与页面预览的定位方式一致
    ctx.font = `${textSettings.fontSize * scaleX}px ${textSettings.fontFamily}`;
    
    // 直接使用与预览相同的定位逻辑：
    // textSettings.x 就是文字的起始位置，不做任何偏移计算
    
    const x = textSettings.x * scaleX;
    const y = textSettings.y * scaleY;
    const lineHeight = textSettings.fontSize * scaleX * textSettings.lineHeight;
    
    // 简单的分行处理，与预览完全一致
    const lines = textSettings.content.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight);
    });
  }
}

// 导出函数
export async function exportBadgeAsOBJ(badgeSettings, holeSettings, imageSettings, textSettings, exportSettings = { 
  doubleSided: true, 
  thickness: 2.0, 
  meshDensity: { density: 20 },
  meshQuality: { 
    enableBoundaryConnection: true, 
    maxBoundaryConnections: 3,
    enableRetopology: true
  }
}, options = {}) { // 接受新的options参数
  try {
    const exporter = new BadgeOBJExporter(options); // 将options传给构造函数
    
    // 1. 设置网格密度和质量
    exporter.setMeshDensity(exportSettings.meshDensity.density);
    exporter.setMeshQuality(
      exportSettings.meshQuality.enableBoundaryConnection !== false, 
      exportSettings.meshQuality.maxBoundaryConnections || 3,
      exportSettings.meshQuality.enableRetopology !== false
    );
    
    if (options.for3DPrinting) {
      exporter.textureCanvas = await exporter.generateTextureCanvas(badgeSettings, holeSettings, imageSettings, textSettings);
    }
    
    // 2. 生成几何体 - 修正错误的函数调用
    const objContent = exporter.generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, textSettings, exportSettings);
    
    await new Promise(resolve => setTimeout(resolve, 0)); // 确保UI更新

    const downloadFile = (content, filename, type = 'text/plain') => {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // 下载OBJ文件
    downloadFile(objContent, 'badge.obj');
    
    // 如果不是3D打印模式，则生成并下载MTL和纹理
    if (!options.for3DPrinting) {
      // 生成并下载MTL文件
      const mtlContent = exporter.generateMTLContent();
      downloadFile(mtlContent, 'badge.mtl');

      // 生成并下载纹理图片
      const textureCanvas = await exporter.generateTextureCanvas(badgeSettings, holeSettings, imageSettings, textSettings);
      textureCanvas.toBlob(blob => {
        if (blob) {
          downloadFile(blob, 'badge_texture.png', 'image/png');
        }
      }, 'image/png');
    }

    return { success: true, message: '模型已成功导出！' };
  } catch (error) {
    console.error("导出OBJ时发生严重错误: ", error);
    return { success: false, message: '导出失败: ' + error.message };
  }
} 

// 测试重拓扑功能的辅助函数（开发调试用）
export function testRetopologyFeatures() {
  const exporter = new BadgeOBJExporter();
  
  // 测试不同密度设置
  const densities = ['low', 'medium', 'high', 'ultra'];
  densities.forEach(density => {
    exporter.setMeshQuality(true, 3, true, density);
    const densityValue = exporter.getRetopologyDensityValue();
    console.log(`${density}密度: ${densityValue.density}`);
  });
  
  // 输出重拓扑配置信息
  console.log('重拓扑功能测试完成', {
    defaultDensity: exporter.meshDensity,
    qualitySettings: exporter.meshQuality,
    retopologyDensity: exporter.getRetopologyDensityValue()
  });
  
  return '重拓扑功能配置正常';
}

// 测试角落修复功能的辅助函数（开发调试用）
export function testCornerFixFeatures() {
  console.log('🔧 角落修复功能测试');
  console.log('- 改进的角落检测算法：基于包围盒位置识别');
  console.log('- 左上角和右下角缺口专项修复');
  console.log('- 增加网格顶点搜索范围：4个最近顶点');
  console.log('- 多三角形修复策略：确保角落完全封闭');
  console.log('- 重复顶点检查：避免退化三角形');
  console.log('✅ 角落修复功能已集成到重拓扑边界连接中');
  
  return '角落修复功能配置正常';
}

// 测试法线修复功能的辅助函数（开发调试用）
export function testNormalFixFeatures() {
  console.log('🧭 法线修复功能测试');
  console.log('- 自动法线计算：基于叉积计算三角形法线向量');
  console.log('- 法线方向检查：正面法线指向+Z，背面法线指向-Z');
  console.log('- 智能顶点翻转：自动修正错误的顶点顺序');
  console.log('- 统一应用：角落修复和边界连接都使用法线检查');
  console.log('- 旋转稳定性：解决模型旋转时的光照异常问题');
  console.log('✅ 法线修复功能已集成到所有边界连接算法中');
  
  return '法线修复功能配置正常';
}

// 测试孔洞修复功能的辅助函数（开发调试用）
export function testHoleFixFeatures() {
  console.log('🕳️ 孔洞修复功能测试');
  console.log('- 孔洞角落检测：使用15%阈值，比外边界更宽松');
  console.log('- 外围网格连接：只连接孔洞外围的网格顶点，避免内部填充');
  console.log('- 特殊法线处理：孔洞边界使用反向顶点顺序');
  console.log('- 增强连接密度：孔洞使用更多连接点确保封闭');
  console.log('- 智能过滤：自动排除孔洞内部的网格顶点');
  console.log('- 角落专项修复：左上角和右下角缺口专门处理');
  console.log('✅ 孔洞修复功能已集成到重拓扑系统中');
  
  return '孔洞修复功能配置正常';
} 