// 水密OBJ模型导出工具 - 优化版
export class BadgeOBJExporter {
  constructor(options = {}) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
    this.texturePixelData = null; // 缓存纹理像素数据

    // 新增：自适应细分相关设置
    this.edgeMap = null; // 边缘强度图
    this.subdivision = {
      enabled: true, // 是否启用
      threshold: 0.05, // 边缘强度阈值，超过则细分
      maxDepth: 5,     // 最大细分深度
    };

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

  // 设置自适应细分参数
  setSubdivisionSettings(enabled = true, threshold = 0.05, maxDepth = 5) {
    this.subdivision = {
      enabled,
      threshold,
      maxDepth
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

  // 从纹理画布中获取指定UV坐标的颜色 - 升级为双线性插值
  getVertexColor(u, v) {
    if (!this.textureCanvas) return { r: 1, g: 1, b: 1 };

    // 首次调用时缓存整个纹理的像素数据以提高性能
    if (!this.texturePixelData) {
      const ctx = this.textureCanvas.getContext('2d', { willReadFrequently: true });
      this.texturePixelData = ctx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    }
    
    const w = this.texturePixelData.width;
    const h = this.texturePixelData.height;

    // V坐标通常是反的
    const texX = u * w;
    const texY = (1 - v) * h;
    
    const x1 = Math.floor(texX);
    const y1 = Math.floor(texY);

    // 计算插值因子
    const fx = texX - x1;
    const fy = texY - y1;
    
    // 获取周围四个像素的颜色
    const c11_rgb = this._getPixelFromCache(x1, y1);
    const c21_rgb = this._getPixelFromCache(x1 + 1, y1);
    const c12_rgb = this._getPixelFromCache(x1, y1 + 1);
    const c22_rgb = this._getPixelFromCache(x1 + 1, y1 + 1);
    
    const lerp = (a, b, t) => a * (1 - t) + b * t;

    // 在X方向上插值
    const r_top = lerp(c11_rgb[0], c21_rgb[0], fx);
    const g_top = lerp(c11_rgb[1], c21_rgb[1], fx);
    const b_top = lerp(c11_rgb[2], c21_rgb[2], fx);

    const r_bottom = lerp(c12_rgb[0], c22_rgb[0], fx);
    const g_bottom = lerp(c12_rgb[1], c22_rgb[1], fx);
    const b_bottom = lerp(c12_rgb[2], c22_rgb[2], fx);

    // 在Y方向上插值
    const r = lerp(r_top, r_bottom, fy);
    const g = lerp(g_top, g_bottom, fy);
    const b = lerp(b_top, b_bottom, fy);

    return {
      r: r / 255.0,
      g: g / 255.0,
      b: b / 255.0,
    };
  }
  
  // 内部辅助函数：从缓存的像素数据中安全地读取颜色
  _getPixelFromCache(x, y) {
    const w = this.texturePixelData.width;
    const h = this.texturePixelData.height;
    
    // 坐标钳制，防止越界
    const clampedX = Math.max(0, Math.min(x, w - 1));
    const clampedY = Math.max(0, Math.min(y, h - 1));
    
    const i = (clampedY * w + clampedX) * 4;
    const data = this.texturePixelData.data;
    return [data[i], data[i+1], data[i+2]];
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
  createRetopologyMeshVertices(boundaryVertices, isFront, badgeSettings, thickness, holeVertices = null, holeParams = null, holeType = null, isSingleSidedBack = false) {
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
          
          let uvU, uvV;
          if (isSingleSidedBack) {
            // 单面模型的背面，所有UV都指向(0,0)
            uvU = 0.0;
            uvV = 0.0;
          } else {
            // 背面使用镜像UV坐标以实现正确的贴图映射
            uvU = isFront ? u : (1.0 - u);
            uvV = v;
          }
          
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

    // 检查是否为单面模型的背面：通过判断其所有边界UV是否都指向同一个坐标
    let isSingleSidedBack = false;
    if (!isFront && outerUVs && outerUVs.length > 0) {
      const firstUv = this.uvs[outerUVs[0] - 1];
      if (firstUv) {
        isSingleSidedBack = outerUVs.every(uvIndex => {
          const uv = this.uvs[uvIndex - 1];
          return uv && uv.u === firstUv.u && uv.v === firstUv.v;
        });
      }
    }

    // 总是使用重拓扑算法
    const { meshNodes, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
      outerVertices, isFront, badgeSettings, thickness, innerVertices, holeParams, holeType, isSingleSidedBack
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

  // 主要生成函数
  generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, texts, exportSettings = { doubleSided: true, thickness: 2.0 }) {
    return new Promise(async (resolve, reject) => {
      try {
        const objContent = await this.generateOBJContent(badgeSettings, holeSettings, imageSettings, texts, exportSettings);
        
        let mtlContent = null;
        if (!this.for3DPrinting) {
          mtlContent = this.generateMTLContent();
        }

        let textureBlob = null;
        if (this.textureCanvas) {
          textureBlob = await new Promise(res => this.textureCanvas.toBlob(res, 'image/png'));
        }

        resolve({ objContent, mtlContent, textureBlob });
      } catch (error) {
        console.error("Error generating OBJ:", error);
        reject(error);
      }
    });
  }

  async generateOBJContent(badgeSettings, holeSettings, imageSettings, texts, exportSettings) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
    this.texturePixelData = null; // 重置缓存

    const { width, height, borderRadius } = badgeSettings;
    const thickness = exportSettings.thickness;
    const doubleSided = exportSettings.doubleSided;

    // 在生成任何几何体之前创建边缘图
    if (this.subdivision.enabled && this.textureCanvas) {
      this.createEdgeMap();
    }

    // 创建外轮廓
    const outerPoints = this.createPoints('rectangle', { width, height, borderRadius });
    const outer = this.createVerticesAndUVs(outerPoints, thickness, width, height, doubleSided);
    
    // 处理孔洞
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

    this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, holeInfo, thickness, badgeSettings);

    // 在生成OBJ内容之前，执行自适应细分
    this.performAdaptiveSubdivision();

    // 生成OBJ文件内容
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
  async generateTextureCanvas(badgeSettings, holeSettings, imageSettings, texts, exportSettings) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // 直接按照工牌的宽高比例设置画布尺寸，确保1:1对应
    const maxResolution = exportSettings?.textureResolution || 2048;
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
        throw new Error("Failed to load image for texture.");
      }
    }
    
    // 绘制文字
    for (const text of texts) {
      this.drawText(ctx, text, badgeSettings, scaleX, scaleY, canvas.width, canvas.height);
    }

    // 在单面模型的背面UV区域画一个白色小方块，避免采样到黑色
    if (!exportSettings.doubleSided) {
      this.drawWhiteCorner(ctx, canvas.width, canvas.height);
    }

    return canvas;
  }

  drawWhiteCorner(ctx, canvasWidth, canvasHeight) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 2, 2); // 在左上角(0,0)处画一个2x2的白色像素块
  }

  drawText(ctx, text, badgeSettings, scaleX, scaleY, canvasWidth, canvasHeight) {
    const { content, fontSize, color, fontFamily, x, y, lineHeight } = text;
    if (!content) return;

    const scaledFontSize = fontSize * scaleX;
    ctx.fillStyle = color;
    ctx.font = `${scaledFontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = content.split('\n');
    const startX = x * scaleX;
    const startY = y * scaleY;
    const scaledLineHeight = scaledFontSize * lineHeight;

    lines.forEach((line, index) => {
      // 为了匹配预览中的居中效果，我们需要计算每行的偏移
      const textMetrics = ctx.measureText(line);
      const textWidth = textMetrics.width;
      
      // 找出所有行中最长的一行，以它的宽度为容器宽度
      let containerWidth = 0;
      if (lines.length > 1) {
        lines.forEach(l => {
          const w = ctx.measureText(l).width;
          if (w > containerWidth) {
            containerWidth = w;
          }
        });
      } else {
        containerWidth = textWidth;
      }
      
      const offsetX = (containerWidth - textWidth) / 2;
      ctx.fillText(line, startX + offsetX, startY + index * scaledLineHeight);
    });
  }

  // 新增：计算三角形面积（用于细分决策）
  calculateTriangleArea(v1, v2, v3) {
    // 使用向量叉乘计算面积
    const AB = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const AC = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
    const crossProduct = {
      x: AB.y * AC.z - AB.z * AC.y,
      y: AB.z * AC.x - AB.x * AC.z,
      z: AB.x * AC.y - AB.y * AC.x,
    };
    return 0.5 * Math.sqrt(crossProduct.x**2 + crossProduct.y**2 + crossProduct.z**2);
  }



  // 新增：根据UV坐标从边缘图中获取强度值（使用双线性插值）
  getEdgeIntensity(u, v) {
    if (!this.edgeMap) return 0;

    const w = this.edgeMap.width;
    const h = this.edgeMap.height;

    // 将UV坐标映射到像素坐标，并确保不越界
    const texX = Math.max(0, Math.min(u * w, w - 1));
    const texY = Math.max(0, Math.min(v * h, h - 1));

    const x1 = Math.floor(texX);
    const y1 = Math.floor(texY);

    // 双线性插值需要4个点
    const x2 = Math.min(x1 + 1, w - 1);
    const y2 = Math.min(y1 + 1, h - 1);

    // 计算插值因子
    const fx = texX - x1;
    const fy = texY - y1;

    // 从边缘图中获取4个点的强度值
    const c11 = this.edgeMap.data[y1 * w + x1] || 0;
    const c21 = this.edgeMap.data[y1 * w + x2] || 0;
    const c12 = this.edgeMap.data[y2 * w + x1] || 0;
    const c22 = this.edgeMap.data[y2 * w + x2] || 0;

    const lerp = (a, b, t) => a * (1 - t) + b * t;

    // 在X方向上插值
    const top = lerp(c11, c21, fx);
    const bottom = lerp(c12, c22, fx);

    // 在Y方向上插值
    return lerp(top, bottom, fy);
  }
  
  // 新增：创建边缘图（多尺度、多算子边缘检测）
  createEdgeMap() {
    if (!this.textureCanvas) return;
    
    const ctx = this.textureCanvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    const width = imageData.width;
    const height = imageData.height;
    
    const grayscale = new Float32Array(width * height);
    
    // 1. 转为灰度图（使用更精确的权重）
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      // 考虑透明度，透明区域视为背景
      const alpha = a / 255.0;
      grayscale[i / 4] = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
    }
    
    // 2. 多尺度边缘检测
    const edgeResults = this._multiScaleEdgeDetection(grayscale, width, height);
    
    // 3. 非最大值抑制，提高边缘精度
    const suppressedEdges = this._nonMaximumSuppression(edgeResults.magnitude, edgeResults.direction, width, height);
    
    // 4. 双阈值处理和边缘连接
    const finalEdges = this._doubleThresholdAndConnect(suppressedEdges, width, height);
    
    // 5. 计算统计信息
    const validEdges = finalEdges.filter(v => v > 0);
    validEdges.sort((a, b) => a - b);
    const median = validEdges.length > 0 ? validEdges[Math.floor(validEdges.length / 2)] : 0;
    const p75 = validEdges.length > 0 ? validEdges[Math.floor(validEdges.length * 0.75)] : 0;
    const p90 = validEdges.length > 0 ? validEdges[Math.floor(validEdges.length * 0.90)] : 0;
    const maxEdge = validEdges.length > 0 ? validEdges[validEdges.length - 1] : 1;
    
    this.edgeMap = {
      data: finalEdges,
      width: width,
      height: height,
      stats: { 
        median: median / maxEdge, 
        p75: p75 / maxEdge, 
        p90: p90 / maxEdge,
        maxEdge: maxEdge
      }
    };
  }

  // 新增：多尺度边缘检测
  _multiScaleEdgeDetection(grayscale, width, height) {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    
    // Sobel算子（适合检测强边缘）
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    // Prewitt算子（适合检测弱边缘）
    const prewittX = [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]];
    const prewittY = [[-1, -1, -1], [0, 0, 0], [1, 1, 1]];
    
    // Roberts算子（适合检测细节边缘）- 更锐利
    const robertsX = [[1, 0], [0, -1]];
    const robertsY = [[0, 1], [-1, 0]];
    
    // Scharr算子（比Sobel更精确的边缘检测）
    const scharrX = [[-3, 0, 3], [-10, 0, 10], [-3, 0, 3]];
    const scharrY = [[-3, -10, -3], [0, 0, 0], [3, 10, 3]];
    
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x;
        
        // 1. Sobel检测
        let sobelGx = 0, sobelGy = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const pixel = grayscale[(y + j) * width + (x + i)];
            sobelGx += pixel * sobelX[j + 1][i + 1];
            sobelGy += pixel * sobelY[j + 1][i + 1];
          }
        }
        const sobelMag = Math.sqrt(sobelGx * sobelGx + sobelGy * sobelGy);
        
        // 2. Scharr检测（更精确）
        let scharrGx = 0, scharrGy = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const pixel = grayscale[(y + j) * width + (x + i)];
            scharrGx += pixel * scharrX[j + 1][i + 1];
            scharrGy += pixel * scharrY[j + 1][i + 1];
          }
        }
        const scharrMag = Math.sqrt(scharrGx * scharrGx + scharrGy * scharrGy);
        
        // 3. Roberts检测（最锐利）
        let robertsGx = 0, robertsGy = 0;
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const pixel = grayscale[(y + j) * width + (x + i)];
            robertsGx += pixel * robertsX[j][i];
            robertsGy += pixel * robertsY[j][i];
          }
        }
        const robertsMag = Math.sqrt(robertsGx * robertsGx + robertsGy * robertsGy);
        
        // 4. Prewitt检测
        let prewittGx = 0, prewittGy = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const pixel = grayscale[(y + j) * width + (x + i)];
            prewittGx += pixel * prewittX[j + 1][i + 1];
            prewittGy += pixel * prewittY[j + 1][i + 1];
          }
        }
        const prewittMag = Math.sqrt(prewittGx * prewittGx + prewittGy * prewittGy);
        
        // 5. 锐利的多尺度检测：使用更小、更精确的核
        let sharpGx = 0, sharpGy = 0;
        const sharpKernel = [
          [-1, 0, 1],
          [-3, 0, 3],
          [-1, 0, 1]
        ];
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const pixel = grayscale[(y + j) * width + (x + i)];
            sharpGx += pixel * sharpKernel[j + 1][i + 1];
            sharpGy += pixel * sharpKernel[i + 1][j + 1]; // 转置
          }
        }
        const sharpMag = Math.sqrt(sharpGx * sharpGx + sharpGy * sharpGy);
        
        // 6. 组合检测器结果，重新分配权重以增强锐利度
        const combinedMag = (
          sobelMag * 0.25 +       // 降低Sobel权重
          scharrMag * 0.35 +      // 增加Scharr权重（更精确）
          robertsMag * 0.25 +     // 增加Roberts权重（最锐利）
          prewittMag * 0.05 +     // 降低Prewitt权重
          sharpMag * 0.10         // 添加锐利核
        );
        magnitude[idx] = combinedMag;
        
        // 7. 计算梯度方向（基于最强的检测器）
        let finalGx, finalGy;
        if (scharrMag >= sobelMag && scharrMag >= robertsMag) {
          finalGx = scharrGx;
          finalGy = scharrGy;
        } else if (robertsMag >= sobelMag) {
          finalGx = robertsGx;
          finalGy = robertsGy;
        } else {
          finalGx = sobelGx;
          finalGy = sobelGy;
        }
        direction[idx] = Math.atan2(finalGy, finalGx);
      }
    }
    
    return { magnitude, direction };
  }

  // 新增：非最大值抑制
  _nonMaximumSuppression(magnitude, direction, width, height) {
    const suppressed = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const mag = magnitude[idx];
        const angle = direction[idx];
        
        // 将角度转换为0-180度
        let degree = (angle * 180 / Math.PI + 180) % 180;
        
        let neighbor1, neighbor2;
        
        // 根据梯度方向确定邻居像素
        if ((degree >= 0 && degree < 22.5) || (degree >= 157.5 && degree <= 180)) {
          // 水平方向
          neighbor1 = magnitude[y * width + (x - 1)];
          neighbor2 = magnitude[y * width + (x + 1)];
        } else if (degree >= 22.5 && degree < 67.5) {
          // 对角线方向（右上-左下）
          neighbor1 = magnitude[(y - 1) * width + (x + 1)];
          neighbor2 = magnitude[(y + 1) * width + (x - 1)];
        } else if (degree >= 67.5 && degree < 112.5) {
          // 垂直方向
          neighbor1 = magnitude[(y - 1) * width + x];
          neighbor2 = magnitude[(y + 1) * width + x];
        } else {
          // 对角线方向（左上-右下）
          neighbor1 = magnitude[(y - 1) * width + (x - 1)];
          neighbor2 = magnitude[(y + 1) * width + (x + 1)];
        }
        
        // 如果当前像素是局部最大值，则保留
        if (mag >= neighbor1 && mag >= neighbor2) {
          suppressed[idx] = mag;
        }
      }
    }
    
    return suppressed;
  }

  // 新增：双阈值处理和边缘连接
  _doubleThresholdAndConnect(edges, width, height) {
    const result = new Float32Array(width * height);
    
    // 计算更敏感的自适应阈值
    const validEdges = edges.filter(e => e > 0);
    if (validEdges.length === 0) return result;
    
    validEdges.sort((a, b) => a - b);
    const median = validEdges[Math.floor(validEdges.length / 2)];
    const p85 = validEdges[Math.floor(validEdges.length * 0.85)];
    const p95 = validEdges[Math.floor(validEdges.length * 0.95)];
    
    // 使用更低的阈值以保留更多细节
    const lowThreshold = median * 0.3;   // 降低低阈值
    const highThreshold = p85 * 0.4;     // 降低高阈值，使用p85而不是p90
    
    // 标记强边缘和弱边缘
    const strongEdges = new Uint8Array(width * height);
    const weakEdges = new Uint8Array(width * height);
    
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] >= highThreshold) {
        strongEdges[i] = 1;
        result[i] = edges[i];
      } else if (edges[i] >= lowThreshold) {
        weakEdges[i] = 1;
      }
    }
    
    // 更精确的边缘连接：使用4连通而不是8连通，减少过度连接
    const visited = new Uint8Array(width * height);
    const stack = [];
    
    // 从强边缘开始搜索
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (strongEdges[idx] && !visited[idx]) {
          stack.push({ x, y });
          visited[idx] = 1;
          
          while (stack.length > 0) {
            const { x: cx, y: cy } = stack.pop();
            
            // 使用4连通（上下左右），减少对角连接以保持边缘锐利
            const neighbors = [
              { dx: 0, dy: -1 }, // 上
              { dx: 0, dy: 1 },  // 下
              { dx: -1, dy: 0 }, // 左
              { dx: 1, dy: 0 }   // 右
            ];
            
            for (const { dx, dy } of neighbors) {
              const nx = cx + dx;
              const ny = cy + dy;
              const nIdx = ny * width + nx;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
                  !visited[nIdx] && weakEdges[nIdx]) {
                visited[nIdx] = 1;
                result[nIdx] = edges[nIdx];
                stack.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }
    
    return result;
  }

  // 新增：自适应细分总控函数
  performAdaptiveSubdivision() {
    if (!this.edgeMap || !this.subdivision.enabled) return;

    const facesToProcess = [...this.faces];
    this.faces = []; // 重置面数组，后面将填充细分后的结果

    for (const face of facesToProcess) {
      this.subdivideFaceRecursively(face, 0);
    }
  }

  // 新增：递归细分单个面
  subdivideFaceRecursively(face, depth) {
    const [v1_idx, v2_idx, v3_idx] = face.vertices;
    const [uv1_idx, uv2_idx, uv3_idx] = face.uvs;
    
    const uv1 = this.uvs[uv1_idx - 1];
    const uv2 = this.uvs[uv2_idx - 1];
    const uv3 = this.uvs[uv3_idx - 1];
    
    // 使用三角形边缘和中心的边缘强度进行综合判断
    const intensity1 = this.getEdgeIntensity(uv1.u, uv1.v);
    const intensity2 = this.getEdgeIntensity(uv2.u, uv2.v);
    const intensity3 = this.getEdgeIntensity(uv3.u, uv3.v);
    
    // 检查三条边的中点强度（边缘连续性）
    const edge12_u = (uv1.u + uv2.u) / 2;
    const edge12_v = (uv1.v + uv2.v) / 2;
    const edge23_u = (uv2.u + uv3.u) / 2;
    const edge23_v = (uv2.v + uv3.v) / 2;
    const edge31_u = (uv3.u + uv1.u) / 2;
    const edge31_v = (uv3.v + uv1.v) / 2;
    
    const edgeIntensity1 = this.getEdgeIntensity(edge12_u, edge12_v);
    const edgeIntensity2 = this.getEdgeIntensity(edge23_u, edge23_v);
    const edgeIntensity3 = this.getEdgeIntensity(edge31_u, edge31_v);
    
    // 三角形中心强度
    const centerIntensity = this.getEdgeIntensity(
      (uv1.u + uv2.u + uv3.u) / 3,
      (uv1.v + uv2.v + uv3.v) / 3
    );
    
    const maxVertexIntensity = Math.max(intensity1, intensity2, intensity3);
    const maxEdgeIntensity = Math.max(edgeIntensity1, edgeIntensity2, edgeIntensity3);
    const maxIntensity = Math.max(maxVertexIntensity, maxEdgeIntensity, centerIntensity);
    
    // 计算平均强度，加权边缘强度
    const avgIntensity = (intensity1 + intensity2 + intensity3 + 
                         edgeIntensity1 * 1.5 + edgeIntensity2 * 1.5 + edgeIntensity3 * 1.5 + 
                         centerIntensity) / 10;
    
    // 计算三角形在UV空间的面积
    const uvArea = Math.abs((uv2.u - uv1.u) * (uv3.v - uv1.v) - (uv3.u - uv1.u) * (uv2.v - uv1.v)) / 2;
    
    // 基于新的边缘检测系统的自适应阈值
    let adaptiveThreshold = this.subdivision.threshold;
    
    if (this.edgeMap && this.edgeMap.stats) {
      // 根据面积调整阈值
      if (uvArea > 0.002) {
        adaptiveThreshold *= 0.6; // 大面积，更积极细分
      } else if (uvArea > 0.001) {
        adaptiveThreshold *= 0.8;
      }
      
      // 根据边缘统计调整
      if (maxEdgeIntensity > this.edgeMap.stats.p75) {
        adaptiveThreshold *= 0.5; // 强边缘区域，大幅降低阈值
      } else if (maxEdgeIntensity > this.edgeMap.stats.median) {
        adaptiveThreshold *= 0.7;
      }
      
      // 如果有连续的边缘（多个边缘点都有较高强度），更积极细分
      const edgeCount = [edgeIntensity1, edgeIntensity2, edgeIntensity3]
        .filter(intensity => intensity > this.edgeMap.stats.median).length;
      if (edgeCount >= 2) {
        adaptiveThreshold *= 0.6;
      }
    }

    // 综合判断条件：
    // 1. 最大强度超过阈值
    // 2. 平均强度较高且面积较大
    // 3. 边缘连续性强（多条边都有较高强度）
    const condition1 = maxIntensity > adaptiveThreshold;
    const condition2 = avgIntensity > adaptiveThreshold * 0.5 && uvArea > 0.0008;
    const condition3 = maxEdgeIntensity > adaptiveThreshold * 0.8 && 
                      (edgeIntensity1 + edgeIntensity2 + edgeIntensity3) > adaptiveThreshold * 1.5;
    
    const shouldSubdivide = condition1 || condition2 || condition3;

    if (depth < this.subdivision.maxDepth && shouldSubdivide) {
      const v1 = this.vertices[v1_idx - 1];
      const v2 = this.vertices[v2_idx - 1];
      const v3 = this.vertices[v3_idx - 1];
      
      // 计算三条边的中点
      const m12_pos = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2, z: (v1.z + v2.z) / 2 };
      const m23_pos = { x: (v2.x + v3.x) / 2, y: (v2.y + v3.y) / 2, z: (v2.z + v3.z) / 2 };
      const m31_pos = { x: (v3.x + v1.x) / 2, y: (v3.y + v1.y) / 2, z: (v3.z + v1.z) / 2 };

      const m12_uv = { u: (uv1.u + uv2.u) / 2, v: (uv1.v + uv2.v) / 2 };
      const m23_uv = { u: (uv2.u + uv3.u) / 2, v: (uv2.v + uv3.v) / 2 };
      const m31_uv = { u: (uv3.u + uv1.u) / 2, v: (uv3.v + uv1.v) / 2 };
      
      // 添加新的顶点和UV
      const m12_v_idx = this.addVertex(m12_pos.x, m12_pos.y, m12_pos.z);
      const m23_v_idx = this.addVertex(m23_pos.x, m23_pos.y, m23_pos.z);
      const m31_v_idx = this.addVertex(m31_pos.x, m31_pos.y, m31_pos.z);

      const m12_uv_idx = this.addUV(m12_uv.u, m12_uv.v);
      const m23_uv_idx = this.addUV(m23_uv.u, m23_uv.v);
      const m31_uv_idx = this.addUV(m31_uv.u, m31_uv.v);

      if (this.for3DPrinting) {
        this.updateVertexColor(m12_v_idx, m12_uv.u, m12_uv.v);
        this.updateVertexColor(m23_v_idx, m23_uv.u, m23_uv.v);
        this.updateVertexColor(m31_v_idx, m31_uv.u, m31_uv.v);
      }
      
      // 递归细分4个新创建的三角形
      this.subdivideFaceRecursively({ vertices: [v1_idx, m12_v_idx, m31_v_idx], uvs: [uv1_idx, m12_uv_idx, m31_uv_idx] }, depth + 1);
      this.subdivideFaceRecursively({ vertices: [m12_v_idx, v2_idx, m23_v_idx], uvs: [m12_uv_idx, uv2_idx, m23_uv_idx] }, depth + 1);
      this.subdivideFaceRecursively({ vertices: [m31_v_idx, m23_v_idx, v3_idx], uvs: [m31_uv_idx, m23_uv_idx, uv3_idx] }, depth + 1);
      this.subdivideFaceRecursively({ vertices: [m12_v_idx, m23_v_idx, m31_v_idx], uvs: [m12_uv_idx, m23_uv_idx, m31_uv_idx] }, depth + 1);
      
    } else {
      // 如果不满足细分条件，则直接将当前面加入最终列表
      this.faces.push(face);
    }
  }
}

// 导出函数
export async function exportBadgeAsOBJ(badgeSettings, holeSettings, imageSettings, texts, exportSettings = { 
  doubleSided: true, 
  thickness: 2.0, 
  meshDensity: { density: 20 },
  meshQuality: { 
    enableBoundaryConnection: true, 
    maxBoundaryConnections: 3,
  }
}, options = {}) { // 接受新的options参数
  try {
    const exporter = new BadgeOBJExporter({ for3DPrinting: options.for3DPrinting });
    
    // 1. 设置网格密度和质量
    exporter.setMeshDensity(exportSettings.meshDensity.density);
    exporter.setMeshQuality(
      exportSettings.meshQuality.enableBoundaryConnection !== false, 
      exportSettings.meshQuality.maxBoundaryConnections || 3
    );
    
    // 2. 设置自适应细分参数
    if (exportSettings.subdivision) {
      exporter.setSubdivisionSettings(
        exportSettings.subdivision.enabled !== false,
        exportSettings.subdivision.threshold || 0.05,
        exportSettings.subdivision.maxDepth || 5
      );
    }
    
    // 纹理画布的生成对于两种模式都是必须的
    // 3D打印模式用它来获取顶点颜色
    // 普通模式用它来生成贴图文件
    exporter.textureCanvas = await exporter.generateTextureCanvas(badgeSettings, holeSettings, imageSettings, texts, exportSettings);
    
    // 2. 生成几何体 - 修正错误的函数调用
    const { objContent, mtlContent, textureBlob } = await exporter.generateBadgeOBJ(
      badgeSettings, 
      holeSettings, 
      imageSettings, 
      texts, 
      exportSettings
    );
    
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
      if (mtlContent) {
        downloadFile(mtlContent, 'badge.mtl');
      }

      // 生成并下载纹理图片
      if (textureBlob) {
        downloadFile(textureBlob, 'badge_texture.png', 'image/png');
      }
    }

    return { success: true, message: '模型已成功导出！' };
  } catch (error) {
    console.error("导出OBJ时发生严重错误: ", error);
    return { success: false, message: '导出失败: ' + error.message };
  }
}
