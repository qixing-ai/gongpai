export class GeometryGenerator {
  constructor(exporter) {
    this.exporter = exporter;
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
      let segments = Math.max(64, this.exporter.meshDensity.density * 2, Math.round(radius * 8));
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
      let segments = Math.max(64, this.exporter.meshDensity.density * 2, Math.round(avgRadius * 8));
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
      const vertexIndex = this.exporter.addVertex(point.x, point.y, thickness / 2);
      vertices.push(vertexIndex);
      const u = (point.x + width / 2) / width;
      const v = (point.y + height / 2) / height;
      const uvIndex = this.exporter.addUV(u, v);
      uvs.push(uvIndex);
      if (this.exporter.for3DPrinting) {
        this.exporter.updateVertexColor(vertexIndex, u, v);
      }
    });
    
    // 背面顶点
    points.forEach(point => {
      const vertexIndex = this.exporter.addVertex(point.x, point.y, -thickness / 2);
      vertices.push(vertexIndex);

      if (doubleSided) {
        // 双面模型：背面也有UV贴图（镜像）
        const u = 1.0 - (point.x + width / 2) / width; // 镜像U坐标
        const v = (point.y + height / 2) / height;
        const uvIndex = this.exporter.addUV(u, v);
        uvs.push(uvIndex);
        if (this.exporter.for3DPrinting) {
          this.exporter.updateVertexColor(vertexIndex, u, v);
        }
      } else {
        // 单面模型：背面使用白色UV坐标（固定在贴图的白色区域）
        const u = 0.0;
        const v = 0.0;
        const uvIndex = this.exporter.addUV(u, v);
        uvs.push(uvIndex);
        if (this.exporter.for3DPrinting) {
          this.exporter.updateVertexColor(vertexIndex, u, v); // 使用白色
        }
      }
    });
    
    return { vertices, uvs };
  }

  // 生成侧面 - 侧面不使用贴图映射
  generateSideFaces(vertices, uvs, pointCount, inward) {
    // 创建侧面专用的白色UV坐标
    const sideUV = this.exporter.addUV(0.0, 0.0); // 固定使用白色区域
    
    for (let i = 0; i < pointCount; i++) {
      const next = (i + 1) % pointCount;
      const [v1, v2, v3, v4] = [vertices[i], vertices[next], vertices[i + pointCount], vertices[next + pointCount]];
      
      if (inward) {
        // 孔洞内侧面 - 法线向内（修正顶点顺序）
        this.exporter.addFace(v1, v2, v3, sideUV, sideUV, sideUV);
        this.exporter.addFace(v2, v4, v3, sideUV, sideUV, sideUV);
      } else {
        // 外侧面 - 法线向外（修正顶点顺序）
        this.exporter.addFace(v1, v3, v2, sideUV, sideUV, sideUV);
        this.exporter.addFace(v2, v3, v4, sideUV, sideUV, sideUV);
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
} 