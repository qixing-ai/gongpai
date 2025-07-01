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
      // console.warn('3D打印模式需要一个有效的纹理画布来提取顶点颜色。');
    }

    // 网格划分密度设置 - 只用一个参数 density
    this.meshDensity = { density: 20 }; // 默认值
    this.meshQuality = { 
      enableBoundaryConnection: true,  // 是否启用边界连接
      maxBoundaryConnections: 3,       // 最大边界连接数
    };
  }

  // 设置网格密度
  setMeshDensity(density) {
    this.meshDensity = { density };
  }

  // 设置网格质量
  setMeshQuality(enableBoundaryConnection = true, maxBoundaryConnections = 3) {
    this.meshQuality = { 
      enableBoundaryConnection, 
      maxBoundaryConnections,
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
      // console.warn('跳过退化三角形：重复顶点索引', { v1, v2, v3 });
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
  generateFaces(vertices, uvs, pointCount, holeInfo, thickness, badgeSettings) {
    const holePointCount = holeInfo.enabled ? holeInfo.uvs.length / 2 : 0;
    
    const frontFaceArgs = [
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        true, badgeSettings, thickness,
        holeInfo.enabled ? holeInfo.vertices.slice(0, holePointCount) : null,
        holeInfo.enabled ? holeInfo.uvs.slice(0, holePointCount) : null,
        holeInfo.params,
        holeInfo.type
    ];
    this.createMeshedFace(...frontFaceArgs);
      
    const backFaceArgs = [
        vertices.slice(pointCount), uvs.slice(pointCount),
        false, badgeSettings, thickness,
        holeInfo.enabled ? holeInfo.vertices.slice(holePointCount) : null,
        holeInfo.enabled ? holeInfo.uvs.slice(holePointCount) : null,
        holeInfo.params,
        holeInfo.type
    ];
    this.createMeshedFace(...backFaceArgs);
    
    // 外侧面
    this.generateSideFaces(vertices, uvs, pointCount, false);
    if (holeInfo.enabled) {
      // 孔洞内侧面
      this.generateSideFaces(holeInfo.vertices, holeInfo.uvs, holePointCount, true);
    }
  }

  // 创建重拓扑网格顶点 - 专门用于高密度网格生成
  createRetopologyMeshVertices(boundaryVertices, isFront, badgeSettings, thickness, holeVertices = null, holeParams = null, holeType = null) {
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 直接使用用户设置的网格密度
    const gridDensity = this.meshDensity.density;
    const meshNodes = [];
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
          // 优化：使用快速的孔洞检查算法替换通用的多边形检查
          isValid = !this.isPointInHole(x, y, holeParams, holeType);
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

          meshNodes.push({ 
            index: vertexIndex, 
            uvIndex,
            x, 
            y, 
            gridX: i, 
            gridY: j,
            isHoleBoundary: false
          });
        } else {
          meshNodes.push(null);
        }
      }
    }
    
    // 如果有孔洞边界点，将它们也加入到主面网格中
    if (holeVertices && holeVertices.length > 0) {
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
          meshNodes.push({
            index: vIdx,
            uvIndex,
            x: vertex.x,
            y: vertex.y,
            gridX: null, // 孔洞边界点不属于规则网格
            gridY: null,
            isHoleBoundary: true // 标记为孔洞边界点
          });
        }
      });
    }
    
    return { meshNodes, gridWidth, gridHeight };
  }

  // 生成重拓扑三角面 - 优化的四边形分割算法
  generateRetopologyTriangles(meshNodes, gridWidth, gridHeight, isFront) {
    let triangleCount = 0;
    
    for (let j = 0; j < gridHeight; j++) {
      for (let i = 0; i < gridWidth; i++) {
        const idx = j * (gridWidth + 1) + i;
        const v1 = meshNodes[idx];              // 左下
        const v2 = meshNodes[idx + 1];          // 右下
        const v3 = meshNodes[idx + gridWidth + 1];     // 左上
        const v4 = meshNodes[idx + gridWidth + 2];     // 右上
        
        // 只有当四个顶点都存在时才生成三角形
        if (v1 && v2 && v3 && v4) {
          // 使用优化的对角线分割策略，确保三角形质量
          // 计算两种分割方式的对角线长度
          const diag1 = Math.sqrt((v1.x - v4.x) ** 2 + (v1.y - v4.y) ** 2);
          const diag2 = Math.sqrt((v2.x - v3.x) ** 2 + (v2.y - v3.y) ** 2);
          
          if (diag1 <= diag2) {
            // 使用v1-v4对角线分割
            if (isFront) {
              this.addFace(v1.index, v2.index, v4.index, v1.uvIndex, v2.uvIndex, v4.uvIndex);
              this.addFace(v1.index, v4.index, v3.index, v1.uvIndex, v4.uvIndex, v3.uvIndex);
            } else {
              this.addFace(v1.index, v4.index, v2.index, v1.uvIndex, v4.uvIndex, v2.uvIndex);
              this.addFace(v1.index, v3.index, v4.index, v1.uvIndex, v3.uvIndex, v4.uvIndex);
            }
          } else {
            // 使用v2-v3对角线分割
            if (isFront) {
              this.addFace(v1.index, v2.index, v3.index, v1.uvIndex, v2.uvIndex, v3.uvIndex);
              this.addFace(v2.index, v4.index, v3.index, v2.uvIndex, v4.uvIndex, v3.uvIndex);
            } else {
              this.addFace(v1.index, v3.index, v2.index, v1.uvIndex, v3.uvIndex, v2.uvIndex);
              this.addFace(v2.index, v3.index, v4.index, v2.uvIndex, v3.uvIndex, v4.uvIndex);
            }
          }
          triangleCount += 2;
        } else if (v1 && v2 && v3) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.addFace(v1.index, v2.index, v3.index, v1.uvIndex, v2.uvIndex, v3.uvIndex);
          } else {
            this.addFace(v1.index, v3.index, v2.index, v1.uvIndex, v3.uvIndex, v2.uvIndex);
          }
          triangleCount += 1;
        } else if (v2 && v3 && v4) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.addFace(v2.index, v4.index, v3.index, v2.uvIndex, v4.uvIndex, v3.uvIndex);
          } else {
            this.addFace(v2.index, v3.index, v4.index, v2.uvIndex, v3.uvIndex, v4.uvIndex);
          }
          triangleCount += 1;
        }
      }
    }
    
    return triangleCount;
  }

  // 为重拓扑网格创建空间索引，以加速最近点搜索
  _createSpatialGrid(vertices, cellSize) {
    const grid = new Map();
    if (cellSize <= 0) {
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
  createMeshedFace(outerVertices, outerUVs, isFront, badgeSettings, thickness, innerVertices = null, innerUVs = null, holeParams = null, holeType = null) {
    const hasHole = !!innerVertices;

    // 总是使用重拓扑算法
    const { meshNodes, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
      outerVertices, isFront, badgeSettings, thickness, innerVertices, holeParams, holeType
    );
    
    this.generateRetopologyTriangles(meshNodes, gridWidth, gridHeight, isFront);
    
    if (this.meshQuality.enableBoundaryConnection) {
      // 执行边界连接
      this.createRetopologyBoundaryConnection(meshNodes, gridWidth, gridHeight, outerVertices, outerUVs, isFront, false, badgeSettings);
      if (hasHole) {
        this.createRetopologyBoundaryConnection(meshNodes, gridWidth, gridHeight, innerVertices, innerUVs, isFront, true, badgeSettings);
      }
      
      // 执行角落修复 - 专门修复挖孔和四个角连接处的破洞
      this.fixCornerGaps(meshNodes, gridWidth, gridHeight, outerVertices, outerUVs, isFront, false, badgeSettings);
      if (hasHole) {
        this.fixCornerGaps(meshNodes, gridWidth, gridHeight, innerVertices, innerUVs, isFront, true, badgeSettings);
      }
    }
  }

  // 重拓扑专用的边界连接算法 - 优化边界到网格的连接
  createRetopologyBoundaryConnection(meshNodes, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false, badgeSettings = { width: 100, height: 100 }) {
    const validMeshVertices = meshNodes.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 获取边界顶点的实际坐标
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 优化：使用空间网格加速最近点查找
    const cellSize = Math.max(badgeSettings.width, badgeSettings.height) / Math.max(gridWidth, gridHeight, 1);
    const spatialGrid = this._createSpatialGrid(validMeshVertices.filter(v => !v.isHoleBoundary), cellSize);
    
    if (isHole) {
      // 孔洞边界：增强的连接算法，确保孔洞边界与主面网格紧密连接
      const holeBoundaryMeshVertices = validMeshVertices.filter(mv => mv.isHoleBoundary);
      
      if (holeBoundaryMeshVertices.length > 0) {
        let connectionCount = 0;
        
        // 为每个孔洞边界点创建多个连接
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
            // 查找多个最近的非孔洞边界的主面网格点
            const searchCandidates = this._queryNearbyVertices(spatialGrid, (mv1.x + mv2.x) / 2, (mv1.y + mv2.y) / 2, 3);
            const nearbyMeshVertices = searchCandidates
              .map(mv => ({
                ...mv,
                distance1: Math.sqrt((mv.x - mv1.x) ** 2 + (mv.y - mv1.y) ** 2),
                distance2: Math.sqrt((mv.x - mv2.x) ** 2 + (mv.y - mv2.y) ** 2),
                avgDistance: Math.sqrt((mv.x - (mv1.x + mv2.x) / 2) ** 2 + (mv.y - (mv1.y + mv2.y) / 2) ** 2)
              }))
              .sort((a, b) => a.avgDistance - b.avgDistance)
              .slice(0, 3); // 使用更多连接点
            
            // 为每个找到的网格点创建连接三角形
            nearbyMeshVertices.forEach((nearbyVertex, idx) => {
              if (nearbyVertex.uvIndex) {
                // 生成连接三角形，确保法线方向正确
                this.addFaceWithNormalCheck(bv1, bv2, nearbyVertex.index, buv1, buv2, nearbyVertex.uvIndex, isFront);
                connectionCount++;
                
                // 如果还有下一个网格点，创建额外的填充三角形
                if (idx < nearbyMeshVertices.length - 1) {
                  const nextVertex = nearbyMeshVertices[idx + 1];
                  if (nextVertex.uvIndex) {
                    this.addFaceWithNormalCheck(bv2, nearbyVertex.index, nextVertex.index, buv2, nearbyVertex.uvIndex, nextVertex.uvIndex, isFront);
                    connectionCount++;
                  }
                }
              }
            });
          }
        }
        
        // 额外的孔洞边界填充：为相邻的边界点创建扇形连接
        for (let i = 0; i < boundaryVertices.length; i++) {
          const nextI = (i + 1) % boundaryVertices.length;
          const nextNextI = (i + 2) % boundaryVertices.length;
          
          const bv1 = boundaryVertices[i];
          const bv2 = boundaryVertices[nextI];
          const bv3 = boundaryVertices[nextNextI];
          const buv1 = boundaryUVs[i];
          const buv2 = boundaryUVs[nextI];
          const buv3 = boundaryUVs[nextNextI];
          
          // 查找边界点附近的网格点
          const mv1 = holeBoundaryMeshVertices.find(mv => mv.index === bv1);
          const mv2 = holeBoundaryMeshVertices.find(mv => mv.index === bv2);
          
          if (mv1 && mv2) {
            const searchCandidates = this._queryNearbyVertices(spatialGrid, (mv1.x + mv2.x) / 2, (mv1.y + mv2.y) / 2, 2);
            const nearestVertex = searchCandidates
              .map(mv => ({
                ...mv,
                distance: Math.sqrt((mv.x - (mv1.x + mv2.x) / 2) ** 2 + (mv.y - (mv1.y + mv2.y) / 2) ** 2)
              }))
              .sort((a, b) => a.distance - b.distance)[0];
            
            if (nearestVertex && nearestVertex.uvIndex) {
              // 创建扇形三角形连接
              this.addFaceWithNormalCheck(bv1, bv2, nearestVertex.index, buv1, buv2, nearestVertex.uvIndex, isFront);
              this.addFaceWithNormalCheck(bv2, bv3, nearestVertex.index, buv2, buv3, nearestVertex.uvIndex, isFront);
              connectionCount += 2;
            }
          }
        }
      }
    } else {
      // 外边界的连接逻辑 - 增强版
      const connectionMap = new Map();
    
      boundaryPoints.forEach((bp, bpIndex) => {
        // 使用空间网格进行优化 - 增加搜索半径
        const searchCandidates = this._queryNearbyVertices(spatialGrid, bp.x, bp.y, 3);
        
        // 外边界：查找更多的网格点
        const nearbyVertices = searchCandidates
          .map(mv => ({
            ...mv,
            distanceSq: (mv.x - bp.x) ** 2 + (mv.y - bp.y) ** 2
          }))
          .sort((a, b) => a.distanceSq - b.distanceSq)
          .slice(0, Math.min(4, searchCandidates.length)); // 增加到4个连接点
        connectionMap.set(bpIndex, nearbyVertices);
      });
      
      // 生成连接三角形 - 增强连接策略
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
          
          // 策略1：基本连接
          const mv1 = currentConnections[0];
          const mv2 = nextConnections[0];
          
          if (mv1.uvIndex && mv2.uvIndex) {
            // 外边界：正常顶点顺序
            this.addFaceWithNormalCheck(bv1, mv1.index, bv2, buv1, mv1.uvIndex, buv2, isFront);
            this.addFaceWithNormalCheck(mv1.index, mv2.index, bv2, mv1.uvIndex, mv2.uvIndex, buv2, isFront);
            connectionCount += 2;
          }
          
          // 策略2：额外的连接点
          if (currentConnections.length > 1 && nextConnections.length > 1) {
            const mv3 = currentConnections[1];
            const mv4 = nextConnections[1];
            
            if (mv3.uvIndex && mv4.uvIndex) {
              // 创建额外的填充三角形
              this.addFaceWithNormalCheck(mv1.index, mv3.index, mv2.index, mv1.uvIndex, mv3.uvIndex, mv2.uvIndex, isFront);
              this.addFaceWithNormalCheck(mv3.index, mv4.index, mv2.index, mv3.uvIndex, mv4.uvIndex, mv2.uvIndex, isFront);
              connectionCount += 2;
            }
          }
          
          // 策略3：扇形连接
          if (currentConnections.length >= 2) {
            for (let j = 1; j < Math.min(3, currentConnections.length); j++) {
              const additionalVertex = currentConnections[j];
              if (additionalVertex.uvIndex) {
                this.addFaceWithNormalCheck(bv1, mv1.index, additionalVertex.index, buv1, mv1.uvIndex, additionalVertex.uvIndex, isFront);
                connectionCount++;
              }
            }
          }
        }
      }
      
      // 策略4：额外的边界填充 - 为每个边界点创建到多个网格点的连接
      boundaryPoints.forEach((bp, bpIndex) => {
        const connections = connectionMap.get(bpIndex) || [];
        if (connections.length >= 2) {
          const bv = boundaryVertices[bpIndex];
          const buv = boundaryUVs[bpIndex];
          
          // 为每个边界点创建扇形连接
          for (let i = 0; i < connections.length - 1; i++) {
            const mv1 = connections[i];
            const mv2 = connections[i + 1];
            
            if (mv1.uvIndex && mv2.uvIndex) {
              this.addFaceWithNormalCheck(bv, mv1.index, mv2.index, buv, mv1.uvIndex, mv2.uvIndex, isFront);
              connectionCount++;
            }
          }
        }
      });
    }
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

  // 修复角落缺口的专门算法 - 增强版
  fixCornerGaps(meshNodes, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false, badgeSettings = { width: 100, height: 100 }) {
    const validMeshVertices = meshNodes.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    const { width, height } = badgeSettings;
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 创建空间网格用于快速查找
    const cellSize = Math.max(width, height) / Math.max(gridWidth, gridHeight, 1);
    const spatialGrid = this._createSpatialGrid(validMeshVertices.filter(v => !v.isHoleBoundary), cellSize);
    
    // 角落检测阈值 - 孔洞使用更宽松的阈值
    const cornerThreshold = isHole ? 0.20 : 0.15; // 增加到20%和15%
    
    // 计算边界包围盒
    const minX = Math.min(...boundaryPoints.map(p => p.x));
    const maxX = Math.max(...boundaryPoints.map(p => p.x));
    const minY = Math.min(...boundaryPoints.map(p => p.y));
    const maxY = Math.max(...boundaryPoints.map(p => p.y));
    
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    
    // 检测四个角落区域 - 更精确的角落定义
    const corners = [
      { name: 'topLeft', x: minX, y: maxY, threshold: cornerThreshold, searchRadius: 4 },
      { name: 'topRight', x: maxX, y: maxY, threshold: cornerThreshold, searchRadius: 4 },
      { name: 'bottomLeft', x: minX, y: minY, threshold: cornerThreshold, searchRadius: 4 },
      { name: 'bottomRight', x: maxX, y: minY, threshold: cornerThreshold, searchRadius: 4 }
    ];
    
    let totalFixedGaps = 0;
    
    corners.forEach(corner => {
      const cornerSize = Math.min(bboxWidth, bboxHeight) * corner.threshold;
      
      // 查找角落附近的边界点 - 扩大搜索范围
      const nearbyBoundaryPoints = [];
      boundaryPoints.forEach((bp, bpIndex) => {
        const distance = Math.sqrt((bp.x - corner.x) ** 2 + (bp.y - corner.y) ** 2);
        if (distance <= cornerSize) {
          nearbyBoundaryPoints.push({ point: bp, index: bpIndex, distance });
        }
      });
      
      if (nearbyBoundaryPoints.length >= 2) {
        // 按距离排序
        nearbyBoundaryPoints.sort((a, b) => a.distance - b.distance);
        
        // 查找角落附近的网格点 - 增加搜索半径
        const searchCandidates = this._queryNearbyVertices(spatialGrid, corner.x, corner.y, corner.searchRadius);
        const nearbyMeshVertices = searchCandidates
          .map(mv => ({
            ...mv,
            distance: Math.sqrt((mv.x - corner.x) ** 2 + (mv.y - corner.y) ** 2)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, isHole ? 8 : 6); // 增加连接点数量
        
        if (nearbyMeshVertices.length > 0) {
          // 策略1：为角落区域创建额外的连接三角形
          for (let i = 0; i < nearbyBoundaryPoints.length - 1; i++) {
            const bp1 = nearbyBoundaryPoints[i];
            const bp2 = nearbyBoundaryPoints[i + 1];
            
            // 为每个边界点对创建多个连接
            for (let j = 0; j < Math.min(3, nearbyMeshVertices.length); j++) {
              const meshVertex = nearbyMeshVertices[j];
              
              if (meshVertex && meshVertex.uvIndex) {
                const bv1 = boundaryVertices[bp1.index];
                const bv2 = boundaryVertices[bp2.index];
                const buv1 = boundaryUVs[bp1.index];
                const buv2 = boundaryUVs[bp2.index];
                
                // 创建连接三角形，确保法线方向正确
                if (isHole) {
                  // 孔洞：使用反向顶点顺序
                  this.addFaceWithNormalCheck(bv1, bv2, meshVertex.index, buv1, buv2, meshVertex.uvIndex, isFront);
                } else {
                  // 外边界：使用正常顶点顺序
                  this.addFaceWithNormalCheck(bv1, meshVertex.index, bv2, buv1, meshVertex.uvIndex, buv2, isFront);
                }
                totalFixedGaps++;
              }
            }
          }
          
          // 策略2：创建网格点之间的填充三角形
          if (nearbyMeshVertices.length >= 2) {
            for (let i = 0; i < nearbyMeshVertices.length - 1; i++) {
              const mv1 = nearbyMeshVertices[i];
              const mv2 = nearbyMeshVertices[i + 1];
              
              if (mv1.uvIndex && mv2.uvIndex) {
                // 找到最近的边界点作为第三个顶点
                const nearestBoundaryPoint = nearbyBoundaryPoints[0];
                const bv = boundaryVertices[nearestBoundaryPoint.index];
                const buv = boundaryUVs[nearestBoundaryPoint.index];
                
                if (isHole) {
                  this.addFaceWithNormalCheck(bv, mv2.index, mv1.index, buv, mv2.uvIndex, mv1.uvIndex, isFront);
                } else {
                  this.addFaceWithNormalCheck(bv, mv1.index, mv2.index, buv, mv1.uvIndex, mv2.uvIndex, isFront);
                }
                totalFixedGaps++;
              }
            }
          }
          
          // 策略3：创建扇形连接 - 为每个边界点创建到多个网格点的连接
          nearbyBoundaryPoints.slice(0, 3).forEach((bp, bpIdx) => {
            const bv = boundaryVertices[bp.index];
            const buv = boundaryUVs[bp.index];
            
            // 为每个边界点创建到多个网格点的扇形连接
            for (let i = 0; i < Math.min(4, nearbyMeshVertices.length - 1); i++) {
              const mv1 = nearbyMeshVertices[i];
              const mv2 = nearbyMeshVertices[i + 1];
              
              if (mv1.uvIndex && mv2.uvIndex) {
                if (isHole) {
                  this.addFaceWithNormalCheck(bv, mv1.index, mv2.index, buv, mv1.uvIndex, mv2.uvIndex, isFront);
                } else {
                  this.addFaceWithNormalCheck(bv, mv1.index, mv2.index, buv, mv1.uvIndex, mv2.uvIndex, isFront);
                }
                totalFixedGaps++;
              }
            }
          });
          
          // 策略4：创建角落中心的填充三角形
          if (nearbyMeshVertices.length >= 3) {
            const centerVertex = nearbyMeshVertices[0];
            if (centerVertex && centerVertex.uvIndex) {
              for (let i = 1; i < nearbyMeshVertices.length - 1; i++) {
                const mv1 = nearbyMeshVertices[i];
                const mv2 = nearbyMeshVertices[i + 1];
                
                if (mv1.uvIndex && mv2.uvIndex) {
                  this.addFaceWithNormalCheck(centerVertex.index, mv1.index, mv2.index, centerVertex.uvIndex, mv1.uvIndex, mv2.uvIndex, isFront);
                  totalFixedGaps++;
                }
              }
            }
          }
        }
      }
    });
    
    return totalFixedGaps;
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

  // 专门用于判断点是否在孔洞内的快速算法
  isPointInHole(x, y, holeParams, holeType) {
    if (!holeParams || !holeType) {
      return false;
    }

    const { centerX, centerY } = holeParams;

    if (holeType === 'circle') {
      const { radius } = holeParams;
      return (x - centerX) ** 2 + (y - centerY) ** 2 < radius ** 2;
    }

    if (holeType === 'oval') {
      const radiusX = holeParams.width / 2;
      const radiusY = holeParams.height / 2;
      // Handle potential division by zero
      if (radiusX === 0 || radiusY === 0) return false;
      return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 < 1;
    }

    if (holeType === 'rectangle') {
      const { width, height, borderRadius = 0 } = holeParams;
      const w = width / 2;
      const h = height / 2;

      // Simple Axis-Aligned Bounding Box check first for speed
      if (x < centerX - w || x > centerX + w || y < centerY - h || y > centerY + h) {
          return false;
      }
      
      if (borderRadius <= 0.1) {
        // It's inside the bounding box and no border radius, so it's in.
        return true;
      }

      // Check for rounded rectangle
      const dx = Math.abs(x - centerX);
      const dy = Math.abs(y - centerY);

      if (dx <= w - borderRadius || dy <= h - borderRadius) return true;
      
      // Check corner regions
      const cornerDistSq = (dx - (w - borderRadius)) ** 2 + (dy - (h - borderRadius)) ** 2;
      return cornerDistSq <= borderRadius ** 2;
    }

    return false; // Fallback for unsupported types
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

    const holeInfo = { enabled: false };
    if (holeSettings.enabled) {
      const { holeParams, holeType } = this.calculateHoleParams(holeSettings, width, height);
      const innerPoints = this.createPoints(holeType, holeParams);
      const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height, doubleSided);
      holeInfo.enabled = true;
      holeInfo.vertices = inner.vertices;
      holeInfo.uvs = inner.uvs;
      holeInfo.params = holeParams;
      holeInfo.type = holeType;
    }
    
    this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, holeInfo, thickness, { width, height });
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
      
      const holeInfo = { enabled: false };
      if (holeSettings.enabled) {
        const { holeParams, holeType } = this.calculateHoleParams(holeSettings, width, height);
        const innerPoints = this.createPoints(holeType, holeParams);
        const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height, true);
        holeInfo.enabled = true;
        holeInfo.vertices = inner.vertices;
        holeInfo.uvs = inner.uvs;
        holeInfo.params = holeParams;
        holeInfo.type = holeType;
      }

      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, holeInfo, thickness, badgeSettings);
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
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
        // console.error('无法加载贴图图片:', e);
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
  }
}, options = {}) { // 接受新的options参数
  try {
    const exporter = new BadgeOBJExporter(options); // 将options传给构造函数
    
    // 1. 设置网格密度和质量
    exporter.setMeshDensity(exportSettings.meshDensity.density);
    exporter.setMeshQuality(
      exportSettings.meshQuality.enableBoundaryConnection !== false, 
      exportSettings.meshQuality.maxBoundaryConnections || 3
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
