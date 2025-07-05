import { isPointInPolygon, isPointInHole, isNormalCorrect } from './utils.js';

export class MeshProcessor {
  constructor(exporter) {
    this.exporter = exporter;
  }

  // 添加带法线检查的面
  addFaceWithNormalCheck(v1, v2, v3, uv1, uv2, uv3, isFront) {
    // 检查当前顶点顺序的法线方向
    if (isNormalCorrect(v1, v2, v3, isFront, this.exporter.vertices)) {
      // 法线方向正确，直接添加
      this.exporter.addFace(v1, v2, v3, uv1, uv2, uv3);
    } else {
      // 法线方向错误，翻转顶点顺序
      this.exporter.addFace(v1, v3, v2, uv1, uv3, uv2);
    }
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
    this.exporter.geometryGenerator.generateSideFaces(vertices, uvs, pointCount, false);
    if (holeInfo.enabled) {
      // 孔洞内侧面
      this.exporter.geometryGenerator.generateSideFaces(holeInfo.vertices, holeInfo.uvs, holePointCount, true);
    }
  }

  // 创建重拓扑网格顶点 - 专门用于高密度网格生成
  createRetopologyMeshVertices(boundaryVertices, isFront, badgeSettings, thickness, holeVertices = null, holeParams = null, holeType = null, isSingleSidedBack = false) {
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 直接使用用户设置的网格密度
    const gridDensity = this.exporter.meshDensity.density;
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
        let isValid = isPointInPolygon(x, y, boundaryVertices, this.exporter.vertices);
        if (holeVertices && isValid) {
          // 优化：使用快速的孔洞检查算法替换通用的多边形检查
          isValid = !isPointInHole(x, y, holeParams, holeType);
        }
        
        if (isValid) {
          const vertexIndex = this.exporter.addVertex(x, y, z);
          
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
          
          const uvIndex = this.exporter.addUV(uvU, uvV);

          if (this.exporter.for3DPrinting) {
            this.exporter.updateVertexColor(vertexIndex, uvU, uvV);
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
        const vertex = this.exporter.vertices[vIdx - 1];
        if (vertex) {
          // 计算孔洞边界点的UV坐标
          const u = (vertex.x + width / 2) / width;
          const v_coord = (vertex.y + height / 2) / height;
          
          // 背面使用镜像UV坐标
          const uvU = isFront ? u : (1.0 - u);
          const uvV = v_coord;
          const uvIndex = this.exporter.addUV(uvU, uvV);
          
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
              this.exporter.addFace(v1.index, v2.index, v4.index, v1.uvIndex, v2.uvIndex, v4.uvIndex);
              this.exporter.addFace(v1.index, v4.index, v3.index, v1.uvIndex, v4.uvIndex, v3.uvIndex);
            } else {
              this.exporter.addFace(v1.index, v4.index, v2.index, v1.uvIndex, v4.uvIndex, v2.uvIndex);
              this.exporter.addFace(v1.index, v3.index, v4.index, v1.uvIndex, v3.uvIndex, v4.uvIndex);
            }
          } else {
            // 使用v2-v3对角线分割
            if (isFront) {
              this.exporter.addFace(v1.index, v2.index, v3.index, v1.uvIndex, v2.uvIndex, v3.uvIndex);
              this.exporter.addFace(v2.index, v4.index, v3.index, v2.uvIndex, v4.uvIndex, v3.uvIndex);
            } else {
              this.exporter.addFace(v1.index, v3.index, v2.index, v1.uvIndex, v3.uvIndex, v2.uvIndex);
              this.exporter.addFace(v2.index, v3.index, v4.index, v2.uvIndex, v3.uvIndex, v4.uvIndex);
            }
          }
          triangleCount += 2;
        } else if (v1 && v2 && v3) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.exporter.addFace(v1.index, v2.index, v3.index, v1.uvIndex, v2.uvIndex, v3.uvIndex);
          } else {
            this.exporter.addFace(v1.index, v3.index, v2.index, v1.uvIndex, v3.uvIndex, v2.uvIndex);
          }
          triangleCount += 1;
        } else if (v2 && v3 && v4) {
          // 处理边界不完整的三角形
          if (isFront) {
            this.exporter.addFace(v2.index, v4.index, v3.index, v2.uvIndex, v4.uvIndex, v3.uvIndex);
          } else {
            this.exporter.addFace(v2.index, v3.index, v4.index, v2.uvIndex, v3.uvIndex, v4.uvIndex);
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
      const firstUv = this.exporter.uvs[outerUVs[0] - 1];
      if (firstUv) {
        isSingleSidedBack = outerUVs.every(uvIndex => {
          const uv = this.exporter.uvs[uvIndex - 1];
          return uv && uv.u === firstUv.u && uv.v === firstUv.v;
        });
      }
    }

    // 总是使用重拓扑算法
    const { meshNodes, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
      outerVertices, isFront, badgeSettings, thickness, innerVertices, holeParams, holeType, isSingleSidedBack
    );
    
    this.generateRetopologyTriangles(meshNodes, gridWidth, gridHeight, isFront);
    
    if (this.exporter.meshQuality.enableBoundaryConnection) {
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
    const boundaryPoints = boundaryVertices.map(v => this.exporter.vertices[v - 1]);
    
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

  // 修复角落缺口的专门算法 - 增强版
  fixCornerGaps(meshNodes, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false, badgeSettings = { width: 100, height: 100 }) {
    const validMeshVertices = meshNodes.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    const { width, height } = badgeSettings;
    const boundaryPoints = boundaryVertices.map(v => this.exporter.vertices[v - 1]);
    
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
} 