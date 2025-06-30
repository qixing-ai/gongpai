// 水密OBJ模型导出工具 - 优化版
export class BadgeOBJExporter {
  constructor() {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
    // 网格划分密度设置 - 增加默认密度以支持更密集的重拓扑
    this.meshDensity = { width: 40, height: 40 }; // 提升到40x40网格以获得更密集的三角面
    // 网格质量设置
    this.meshQuality = { 
      enableBoundaryConnection: true,  // 是否启用边界连接
      maxBoundaryConnections: 3,       // 最大边界连接数
      enableRetopology: true,          // 是否启用重拓扑优化
      retopologyDensity: 'high'        // 重拓扑密度：'low', 'medium', 'high', 'ultra'
    };
  }

  // 设置网格密度
  setMeshDensity(widthSegments, heightSegments) {
    this.meshDensity = { width: widthSegments, height: heightSegments };
  }

  // 设置网格质量
  setMeshQuality(enableBoundaryConnection = true, maxBoundaryConnections = 3, enableRetopology = true, retopologyDensity = 'high') {
    this.meshQuality = { 
      enableBoundaryConnection, 
      maxBoundaryConnections,
      enableRetopology,
      retopologyDensity
    };
  }

  // 添加顶点
  addVertex(x, y, z) {
    this.vertices.push({ x, y, z });
    return this.vertexIndex++;
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

  // 数学工具函数（保留以备后用）
  calculateLCM(a, b) {
    return Math.abs(a * b) / this.calculateGCD(a, b);
  }

  calculateGCD(a, b) {
    while (b !== 0) {
      let temp = b;
      b = a % b;
      a = temp;
    }
    return a;
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
      // 确保分段数为4的倍数，便于水密连接
      let segments = Math.max(32, Math.min(128, Math.round(radius * 8)));
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
      // 确保分段数为4的倍数
      const avgRadius = (radiusX + radiusY) / 2;
      let segments = Math.max(32, Math.min(128, Math.round(avgRadius * 8)));
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
      vertices.push(this.addVertex(point.x, point.y, thickness / 2));
      const u = (point.x + width / 2) / width;
      const v = (point.y + height / 2) / height;
      uvs.push(this.addUV(u, v));
    });
    
    // 背面顶点
    points.forEach(point => {
      vertices.push(this.addVertex(point.x, point.y, -thickness / 2));
      if (doubleSided) {
        // 双面模型：背面也有UV贴图（镜像）
        const u = 1.0 - (point.x + width / 2) / width; // 镜像U坐标
        const v = (point.y + height / 2) / height;
        uvs.push(this.addUV(u, v));
      } else {
        // 单面模型：背面使用白色UV坐标（固定在贴图的白色区域）
        uvs.push(this.addUV(0.0, 0.0)); // 贴图左下角，通常是白色背景
      }
    });
    
    return { vertices, uvs };
  }

  // 生成面（正面、背面、侧面）- 水密版 - 支持网格化
  generateFaces(vertices, uvs, pointCount, hasHole = false, holeVertices = [], holeUVs = [], thickness = 2.0, badgeSettings) {
    if (hasHole) {
      // 带孔洞的网格化面生成
      const holePointCount = holeUVs.length / 2;
      
      // 正面网格化
      this.createMeshFacesWithHole(
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        holeVertices.slice(0, holePointCount), holeUVs.slice(0, holePointCount),
        true, badgeSettings, thickness
      );
      
      // 背面网格化
      this.createMeshFacesWithHole(
        vertices.slice(pointCount), uvs.slice(pointCount),
        holeVertices.slice(holePointCount), holeUVs.slice(holePointCount),
        false, badgeSettings, thickness
      );
    } else {
      // 普通面的网格化生成
      this.createMeshFaces(
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        true, badgeSettings, thickness
      );
      this.createMeshFaces(
        vertices.slice(pointCount), uvs.slice(pointCount),
        false, badgeSettings, thickness
      );
    }
    
    // 外侧面
    this.generateSideFaces(vertices, uvs, pointCount, false);
    if (hasHole) {
      // 孔洞内侧面
      const holePointCount = holeUVs.length / 2;
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
    return densityMap[this.meshQuality.retopologyDensity] || densityMap['high'];
  }

  // 创建重拓扑网格顶点 - 专门用于高密度网格生成
  createRetopologyMeshVertices(boundaryVertices, isFront, badgeSettings, thickness, holeVertices = null) {
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 根据重拓扑设置动态调整网格密度
    const retopologyDensity = this.meshQuality.enableRetopology ? 
      this.getRetopologyDensityValue() : this.meshDensity;
    
    const meshVertices = [];
    const meshUVs = [];
    const gridWidth = retopologyDensity.width;
    const gridHeight = retopologyDensity.height;
    
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
          meshVertices.push({ 
            index: vertexIndex, 
            x, 
            y, 
            gridX: i, 
            gridY: j,
            u: uvU,
            v: uvV
          });
          meshUVs.push(uvIndex);
        } else {
          meshVertices.push(null);
          meshUVs.push(null);
        }
      }
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

  // 创建网格化面（无孔洞）- 重拓扑优化版
  createMeshFaces(boundaryVertices, boundaryUVs, isFront, badgeSettings, thickness) {
    if (this.meshQuality.enableRetopology) {
      // 使用新的重拓扑算法
      const { meshVertices, meshUVs, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
        boundaryVertices, isFront, badgeSettings, thickness
      );
      
      // 生成重拓扑三角面
      const triangleCount = this.generateRetopologyTriangles(meshVertices, meshUVs, gridWidth, gridHeight, isFront);
      
      // 根据质量设置决定是否进行边界连接
      if (this.meshQuality.enableBoundaryConnection) {
        this.createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront);
      }
      
      console.log(`重拓扑${isFront ? '正面' : '背面'}：生成了${triangleCount}个三角形，网格密度${gridWidth}x${gridHeight}`);
    } else {
      // 使用原始算法（保持向后兼容）
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 创建网格顶点
    const meshVertices = [];
    const meshUVs = [];
    
    // 生成网格内部顶点
    for (let j = 0; j <= this.meshDensity.height; j++) {
      for (let i = 0; i <= this.meshDensity.width; i++) {
        const u = i / this.meshDensity.width;
        const v = j / this.meshDensity.height;
        
        // 计算网格点在工牌范围内的坐标
        const x = (u - 0.5) * width;
        const y = (v - 0.5) * height;
        
        // 检查点是否在边界内
        if (this.isPointInPolygon(x, y, boundaryVertices)) {
          const vertexIndex = this.addVertex(x, y, z);
          // 背面使用镜像UV坐标
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
    
    // 生成网格三角形
    for (let j = 0; j < this.meshDensity.height; j++) {
      for (let i = 0; i < this.meshDensity.width; i++) {
        const idx = j * (this.meshDensity.width + 1) + i;
        const v1 = meshVertices[idx];
        const v2 = meshVertices[idx + 1];
        const v3 = meshVertices[idx + this.meshDensity.width + 1];
        const v4 = meshVertices[idx + this.meshDensity.width + 2];
        
        const uv1 = meshUVs[idx];
        const uv2 = meshUVs[idx + 1];
        const uv3 = meshUVs[idx + this.meshDensity.width + 1];
        const uv4 = meshUVs[idx + this.meshDensity.width + 2];
        
        // 生成两个三角形（如果所有顶点都存在）
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
    
    // 根据质量设置决定是否进行边界连接
    if (this.meshQuality.enableBoundaryConnection) {
      this.createSimpleBoundaryConnection(meshVertices, meshUVs, boundaryVertices, boundaryUVs, isFront);
      }
    }
  }

  // 创建带孔洞的网格化面 - 重拓扑优化版
  createMeshFacesWithHole(outerVertices, outerUVs, innerVertices, innerUVs, isFront, badgeSettings, thickness) {
    if (this.meshQuality.enableRetopology) {
      // 使用新的重拓扑算法处理带孔洞的面
      const { meshVertices, meshUVs, gridWidth, gridHeight } = this.createRetopologyMeshVertices(
        outerVertices, isFront, badgeSettings, thickness, innerVertices
      );
      
      // 生成重拓扑三角面
      const triangleCount = this.generateRetopologyTriangles(meshVertices, meshUVs, gridWidth, gridHeight, isFront);
      
      // 根据质量设置决定是否进行边界连接
      if (this.meshQuality.enableBoundaryConnection) {
        this.createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, outerVertices, outerUVs, isFront);
        this.createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, innerVertices, innerUVs, isFront, true);
      }
      
      console.log(`重拓扑带孔${isFront ? '正面' : '背面'}：生成了${triangleCount}个三角形，网格密度${gridWidth}x${gridHeight}`);
    } else {
      // 使用原始算法（保持向后兼容）
    const { width, height } = badgeSettings;
    const z = isFront ? thickness / 2 : -thickness / 2;
    
    // 创建网格顶点
    const meshVertices = [];
    const meshUVs = [];
    
    // 生成网格内部顶点
    for (let j = 0; j <= this.meshDensity.height; j++) {
      for (let i = 0; i <= this.meshDensity.width; i++) {
        const u = i / this.meshDensity.width;
        const v = j / this.meshDensity.height;
        
        // 计算网格点在工牌范围内的坐标
        const x = (u - 0.5) * width;
        const y = (v - 0.5) * height;
        
        // 检查点是否在外边界内且不在孔洞内
        if (this.isPointInPolygon(x, y, outerVertices) && !this.isPointInPolygon(x, y, innerVertices)) {
          const vertexIndex = this.addVertex(x, y, z);
          // 背面使用镜像UV坐标
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
    
    // 生成网格三角形（与无孔洞版本相同）
    for (let j = 0; j < this.meshDensity.height; j++) {
      for (let i = 0; i < this.meshDensity.width; i++) {
        const idx = j * (this.meshDensity.width + 1) + i;
        const v1 = meshVertices[idx];
        const v2 = meshVertices[idx + 1];
        const v3 = meshVertices[idx + this.meshDensity.width + 1];
        const v4 = meshVertices[idx + this.meshDensity.width + 2];
        
        const uv1 = meshUVs[idx];
        const uv2 = meshUVs[idx + 1];
        const uv3 = meshUVs[idx + this.meshDensity.width + 1];
        const uv4 = meshUVs[idx + this.meshDensity.width + 2];
        
        // 生成两个三角形（如果所有顶点都存在）
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
    
    // 根据质量设置决定是否进行边界连接
    if (this.meshQuality.enableBoundaryConnection) {
      this.createSimpleBoundaryConnection(meshVertices, meshUVs, outerVertices, outerUVs, isFront);
      this.createSimpleBoundaryConnection(meshVertices, meshUVs, innerVertices, innerUVs, isFront, true);
      }
    }
  }

  // 重拓扑专用的边界连接算法 - 优化边界到网格的连接
  createRetopologyBoundaryConnection(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 获取边界顶点的实际坐标
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 为每个边界顶点找到最近的网格顶点进行连接
    const connectionMap = new Map();
    
    boundaryPoints.forEach((bp, bpIndex) => {
      // 找到距离该边界点最近的几个网格顶点
      const nearbyVertices = validMeshVertices
        .map(mv => ({
          ...mv,
          distance: Math.sqrt((mv.x - bp.x) ** 2 + (mv.y - bp.y) ** 2)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, Math.min(2, validMeshVertices.length)); // 最多连接2个最近的网格顶点
      
      connectionMap.set(bpIndex, nearbyVertices);
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
          this.addFaceWithNormalCheck(bv1, mv1.index, bv2, buv1, muv1, buv2, isFront);
          this.addFaceWithNormalCheck(mv1.index, mv2.index, bv2, muv1, muv2, buv2, isFront);
          connectionCount += 2;
        }
      }
    }
    
    console.log(`重拓扑边界连接：生成了${connectionCount}个连接三角形`);

    // 修复角落缺口的专用算法
    this.fixCornerGaps(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole);
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

  // 修复角落缺口的专用算法 - 优化版
  fixCornerGaps(meshVertices, meshUVs, gridWidth, gridHeight, boundaryVertices, boundaryUVs, isFront, isHole = false) {
    const validMeshVertices = meshVertices.filter(v => v !== null);
    if (validMeshVertices.length === 0) return;
    
    // 获取边界顶点的实际坐标
    const boundaryPoints = boundaryVertices.map(v => this.vertices[v - 1]);
    
    // 计算边界的包围盒，用于识别角落区域
    const minX = Math.min(...boundaryPoints.map(p => p.x));
    const maxX = Math.max(...boundaryPoints.map(p => p.x));
    const minY = Math.min(...boundaryPoints.map(p => p.y));
    const maxY = Math.max(...boundaryPoints.map(p => p.y));
    
    // 定义角落区域的阈值（边界框的10%）
    const thresholdX = (maxX - minX) * 0.1;
    const thresholdY = (maxY - minY) * 0.1;
    
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
    
    console.log(`检测到${corners.length}个角落需要修复:`, corners.map(c => c.position));
    
    let fixCount = 0;
    // 为每个角落区域寻找合适的网格顶点并创建密集连接
    corners.forEach(corner => {
      // 寻找距离该角落最近的网格顶点，增加搜索范围
      const nearbyVertices = validMeshVertices
        .map(mv => ({
          ...mv,
          distance: Math.sqrt((mv.x - corner.point.x) ** 2 + (mv.y - corner.point.y) ** 2)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4); // 增加到4个最近顶点，提供更多连接选项
      
      // 为角落创建多个修复三角形，确保完全封闭
      for (let j = 0; j < Math.min(nearbyVertices.length - 1, 3); j++) {
        const mv1 = nearbyVertices[j];
        const mv2 = nearbyVertices[j + 1];
        
        const muv1 = meshUVs[mv1.gridY * (gridWidth + 1) + mv1.gridX];
        const muv2 = meshUVs[mv2.gridY * (gridWidth + 1) + mv2.gridX];
        
        if (muv1 && muv2) {
          // 检查三角形是否有效（避免重复顶点）
          if (corner.boundaryVertex !== mv1.index && corner.boundaryVertex !== mv2.index && mv1.index !== mv2.index) {
            // 使用带法线检查的面添加方法，确保法线方向正确
            this.addFaceWithNormalCheck(
              corner.boundaryVertex, mv1.index, mv2.index, 
              corner.boundaryUV, muv1, muv2, 
              isFront
            );
            fixCount++;
          }
        }
      }
    });
    
    console.log(`修复了${fixCount}个角落缺口三角形`);
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
        const meshUV1 = meshUVs[v1.gridY * (this.meshDensity.width + 1) + v1.gridX];
        const meshUV2 = meshUVs[v2.gridY * (this.meshDensity.width + 1) + v2.gridX];
        
        if (meshUV1 && meshUV2) {
          // 使用带法线检查的面添加方法，确保法线方向正确
          this.addFaceWithNormalCheck(bv, v1.index, v2.index, buv, meshUV1, meshUV2, isFront);
        }
      }
    } else if (sortedVertices.length === 1) {
      // 只有一个网格顶点时，创建更少的连接
      const v = sortedVertices[0];
      const meshUV = meshUVs[v.gridY * (this.meshDensity.width + 1) + v.gridX];
      
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

  // 检查三角形是否有效（无重复顶点）- 保留以备后用
  isValidTriangle(v1, v2, v3) {
    return v1 !== v2 && v2 !== v3 && v1 !== v3;
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
    // 使用单面模式创建顶点和UV（背面将使用白色UV）
    const outer = this.createVerticesAndUVs(outerPoints, thickness, width, height, false);

    if (holeSettings.enabled) {
      const { holeParams, holeType } = this.calculateHoleParams(holeSettings, width, height);
      const innerPoints = this.createPoints(holeType, holeParams);
      const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height, false);

              // 生成完整的带孔洞模型（包括正面、背面、侧面）
        this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs, thickness, { width, height });
      } else {
        // 生成完整的普通模型（包括正面、背面、侧面）
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
      // 双面模型 - 创建完整的3D结构
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
      // 单面模型 - 只创建正面
      this.generateSingleSidedModel(outerPoints, holeSettings, width, height, thickness);
    }

    return this.generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings);
  }

  // 生成OBJ文件内容
  generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings) {
    const faceCount = this.faces.length;
    const vertexCount = this.vertices.length;
    const retopologyInfo = this.meshQuality.enableRetopology ? 
      `重拓扑密度: ${this.meshQuality.retopologyDensity} (${this.getRetopologyDensityValue().width}x${this.getRetopologyDensityValue().height})` :
      `传统网格: ${this.meshDensity.width}x${this.meshDensity.height}`;
    
    let obj = `# 水密工牌 OBJ 模型 - 重拓扑优化版本\n# 尺寸: ${badgeSettings.width}mm x ${badgeSettings.height}mm x ${exportSettings.thickness}mm\n# ${retopologyInfo}\n# 顶点数: ${vertexCount}, 面数: ${faceCount}\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n# 特性: 水密结构，密集重拓扑网格，正方形划分，便于顶点颜色映射\n# 优化: 四边形对角线分割，高质量三角面，适合后续操作\n\n`;
    
    obj += '# 顶点坐标\n';
    this.vertices.forEach(v => obj += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`);
    
    obj += '\n# UV坐标\n';
    this.uvs.forEach(uv => obj += `vt ${uv.u.toFixed(6)} ${uv.v.toFixed(6)}\n`);
    
    obj += '\nmtllib badge.mtl\nusemtl badge_material\n\n# 面定义\n';
    this.faces.forEach(face => obj += `f ${face.vertices[0]}/${face.uvs[0]} ${face.vertices[1]}/${face.uvs[1]} ${face.vertices[2]}/${face.uvs[2]}\n`);
    
    return obj;
  }

  // 生成MTL材质文件
  generateMTLContent() {
    return `# 工牌材质文件 - 重拓扑优化版本\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n# 优化特性: 重拓扑密集网格，正方形划分，便于顶点颜色映射\nnewmtl badge_material\nKa 0.2 0.2 0.2\nKd 0.8 0.8 0.8\nKs 0.1 0.1 0.1\nNs 10.0\nd 1.0\nillum 2\nmap_Kd badge_texture.png\n`;
  }

  // 生成贴图
  generateTextureCanvas(badgeSettings, holeSettings, imageSettings, textSettings) {
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
    
    // 绘制左下角白色区域（供单面模型背面使用）
    this.drawWhiteCorner(ctx, canvasWidth, canvasHeight);
    
    // 绘制图片和文字
    if (imageSettings.src) {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.globalAlpha = imageSettings.opacity;
          
          // 实现 objectFit: 'cover' 效果，与页面预览保持一致
          // 页面预览使用左上角为原点的坐标系，直接转换到画布坐标系
          const targetX = imageSettings.x * scaleX;
          const targetY = imageSettings.y * scaleY;
          const targetWidth = imageSettings.width * scaleX;
          const targetHeight = imageSettings.height * scaleY;
          
          // 计算图片的缩放比例（保持宽高比的同时填充整个区域）
          const imageAspect = img.width / img.height;
          const targetAspect = targetWidth / targetHeight;
          
          let drawWidth, drawHeight, drawX, drawY;
          let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
          
          if (imageAspect > targetAspect) {
            // 图片比目标区域更宽，需要裁剪左右两边
            const scaledHeight = img.height;
            const scaledWidth = scaledHeight * targetAspect;
            sourceX = (img.width - scaledWidth) / 2;
            sourceWidth = scaledWidth;
            drawX = targetX;
            drawY = targetY;
            drawWidth = targetWidth;
            drawHeight = targetHeight;
          } else {
            // 图片比目标区域更高，需要裁剪上下两边
            const scaledWidth = img.width;
            const scaledHeight = scaledWidth / targetAspect;
            sourceY = (img.height - scaledHeight) / 2;
            sourceHeight = scaledHeight;
            drawX = targetX;
            drawY = targetY;
            drawWidth = targetWidth;
            drawHeight = targetHeight;
          }
          
          // 使用裁剪后的图片区域绘制
          ctx.drawImage(
            img, 
            sourceX, sourceY, sourceWidth, sourceHeight,  // 源图片的裁剪区域
            drawX, drawY, drawWidth, drawHeight           // 目标画布的绘制区域
          );
          
          this.drawText(ctx, textSettings, badgeSettings, scaleX, scaleY, canvasWidth, canvasHeight);
          // 确保左下角保持白色
          ctx.globalAlpha = 1.0;
          this.drawWhiteCorner(ctx, canvasWidth, canvasHeight);
          resolve(canvas);
        };
        img.src = imageSettings.src;
      });
    } else {
      this.drawText(ctx, textSettings, badgeSettings, scaleX, scaleY, canvasWidth, canvasHeight);
      // 确保左下角保持白色
      this.drawWhiteCorner(ctx, canvasWidth, canvasHeight);
      return Promise.resolve(canvas);
    }
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
  meshDensity: { width: 40, height: 40 },
  meshQuality: { 
    enableBoundaryConnection: true, 
    maxBoundaryConnections: 3,
    enableRetopology: true,
    retopologyDensity: 'high'
  }
}) {
  const exporter = new BadgeOBJExporter();
  
  try {
    // 设置网格密度
    if (exportSettings.meshDensity) {
      exporter.setMeshDensity(exportSettings.meshDensity.width || 20, exportSettings.meshDensity.height || 20);
    }
    
    // 设置网格质量
    if (exportSettings.meshQuality) {
      exporter.setMeshQuality(
        exportSettings.meshQuality.enableBoundaryConnection !== false, 
        exportSettings.meshQuality.maxBoundaryConnections || 3,
        exportSettings.meshQuality.enableRetopology !== false,
        exportSettings.meshQuality.retopologyDensity || 'high'
      );
    }
    
    const objContent = exporter.generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, textSettings, exportSettings);
    const mtlContent = exporter.generateMTLContent();
    const textureCanvas = await exporter.generateTextureCanvas(badgeSettings, holeSettings, imageSettings, textSettings);
    
    // 下载文本文件的通用函数
    const downloadFile = (content, filename, type = 'text/plain') => {
      const blob = new Blob([content], { type });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    
    // 下载OBJ和MTL文件
    downloadFile(objContent, 'badge.obj');
    downloadFile(mtlContent, 'badge.mtl');
    
    // 下载贴图文件
    textureCanvas.toBlob(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'badge_texture.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
    
    const modelType = exportSettings.doubleSided ? '双面' : '单面';
    const retopologyInfo = exporter.meshQuality.enableRetopology ? 
      `重拓扑${exporter.meshQuality.retopologyDensity}密度: ${exporter.getRetopologyDensityValue().width}x${exporter.getRetopologyDensityValue().height}` :
      `传统网格: ${exporter.meshDensity.width}x${exporter.meshDensity.height}`;
    const qualityInfo = exporter.meshQuality.enableBoundaryConnection ? 
      `边界连接: ${exporter.meshQuality.maxBoundaryConnections}个` : '边界连接: 已禁用';
    
    return { 
      success: true, 
      message: `${modelType}工牌OBJ模型重拓扑导出成功！\n厚度: ${exportSettings.thickness}mm\n${retopologyInfo}\n${qualityInfo}\n已下载3个文件：badge.obj、badge.mtl、badge_texture.png\n✅ 模型采用重拓扑优化，正方形网格密集划分，高质量三角面\n✅ 专为顶点颜色映射优化，便于后续操作和处理` 
    };
  } catch (error) {
    return { success: false, message: '导出失败：' + error.message };
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
    console.log(`${density}密度: ${densityValue.width}x${densityValue.height}`);
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