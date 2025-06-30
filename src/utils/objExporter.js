// 水密OBJ模型导出工具 - 优化版
export class BadgeOBJExporter {
  constructor() {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
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

  // 生成面（正面、背面、侧面）- 水密版
  generateFaces(vertices, uvs, pointCount, hasHole = false, holeVertices = [], holeUVs = [], thickness = 2.0) {
    if (hasHole) {
      // 带孔洞的水密面生成
      const holePointCount = holeUVs.length / 2;
      
      // 正面
      this.createWatertightHoleFaces(
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        holeVertices.slice(0, holePointCount), holeUVs.slice(0, holePointCount),
        true
      );
      
      // 背面
      this.createWatertightHoleFaces(
        vertices.slice(pointCount), uvs.slice(pointCount),
        holeVertices.slice(holePointCount), holeUVs.slice(holePointCount),
        false
      );
    } else {
      // 普通面 - 使用实际厚度
      const centerFront = this.addVertex(0, 0, thickness / 2);
      const centerBack = this.addVertex(0, 0, -thickness / 2);
      const centerUV = this.addUV(0.5, 0.5);
      
      // 正面 - 确保法线向前（顺时针顺序）
      for (let i = 0; i < pointCount; i++) {
        const next = (i + 1) % pointCount;
        this.addFace(centerFront, vertices[i], vertices[next], centerUV, uvs[i], uvs[next]);
      }
      
      // 背面 - 确保法线向后（逆时针顺序）
      for (let i = 0; i < pointCount; i++) {
        const next = (i + 1) % pointCount;
        this.addFace(centerBack, vertices[pointCount + next], vertices[pointCount + i], centerUV, uvs[pointCount + next], uvs[pointCount + i]);
      }
    }
    
    // 外侧面
    this.generateSideFaces(vertices, uvs, pointCount, false);
    if (hasHole) {
      // 孔洞内侧面
      const holePointCount = holeUVs.length / 2;
      this.generateSideFaces(holeVertices, holeUVs, holePointCount, true);
    }
  }

  // 水密孔洞连接算法 - 修复重复顶点问题
  createWatertightHoleFaces(outerVertices, outerUVs, innerVertices, innerUVs, isFront) {
    const outerCount = outerVertices.length;
    const innerCount = innerVertices.length;
    
    // 使用更大的分段数来避免重复索引
    const segments = Math.max(outerCount, innerCount);
    
    // 生成连接面
    for (let i = 0; i < segments; i++) {
      // 计算外轮廓索引（均匀分布）
      const outerIdx1 = Math.floor(i * outerCount / segments) % outerCount;
      const outerIdx2 = Math.floor((i + 1) * outerCount / segments) % outerCount;
      
      // 计算内轮廓索引（均匀分布）
      const innerIdx1 = Math.floor(i * innerCount / segments) % innerCount;
      const innerIdx2 = Math.floor((i + 1) * innerCount / segments) % innerCount;
      
      // 获取顶点和UV
      const ov1 = outerVertices[outerIdx1];
      const ov2 = outerVertices[outerIdx2];
      const iv1 = innerVertices[innerIdx1];
      const iv2 = innerVertices[innerIdx2];
      
      const ouv1 = outerUVs[outerIdx1];
      const ouv2 = outerUVs[outerIdx2];
      const iuv1 = innerUVs[innerIdx1];
      const iuv2 = innerUVs[innerIdx2];
      
      // 检查是否有重复顶点，避免退化三角形
      if (this.isValidTriangle(ov1, ov2, iv1) && this.isValidTriangle(ov2, iv2, iv1)) {
        if (isFront) {
          // 正面：确保法线向前
          this.addFace(ov1, ov2, iv1, ouv1, ouv2, iuv1);
          this.addFace(ov2, iv2, iv1, ouv2, iuv2, iuv1);
        } else {
          // 背面：确保法线向后
          this.addFace(ov1, iv1, ov2, ouv1, iuv1, ouv2);
          this.addFace(ov2, iv1, iv2, ouv2, iuv1, iuv2);
        }
      } else {
        // 如果检测到退化三角形，使用单个三角形填充
        if (this.isValidTriangle(ov1, iv1, ov2)) {
          if (isFront) {
            this.addFace(ov1, ov2, iv1, ouv1, ouv2, iuv1);
          } else {
            this.addFace(ov1, iv1, ov2, ouv1, iuv1, ouv2);
          }
        }
      }
    }
  }

  // 检查三角形是否有效（无重复顶点）
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
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs, thickness);
    } else {
      // 生成完整的普通模型（包括正面、背面、侧面）
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, false, [], [], thickness);
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
        
        this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs, thickness);
      } else {
        this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, false, [], [], thickness);
      }
    } else {
      // 单面模型 - 只创建正面
      this.generateSingleSidedModel(outerPoints, holeSettings, width, height, thickness);
    }

    return this.generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings);
  }

  // 生成OBJ文件内容
  generateOBJContent(badgeSettings, imageSettings, textSettings, exportSettings) {
    let obj = `# 水密工牌 OBJ 模型\n# 尺寸: ${badgeSettings.width}mm x ${badgeSettings.height}mm x ${exportSettings.thickness}mm\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n# 特性: 水密结构，适合3D打印\n\n`;
    
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
    return `# 工牌材质文件\nnewmtl badge_material\nKa 0.2 0.2 0.2\nKd 0.8 0.8 0.8\nKs 0.1 0.1 0.1\nNs 10.0\nd 1.0\nillum 2\nmap_Kd badge_texture.png\n`;
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
export async function exportBadgeAsOBJ(badgeSettings, holeSettings, imageSettings, textSettings, exportSettings = { doubleSided: true, thickness: 2.0 }) {
  const exporter = new BadgeOBJExporter();
  
  try {
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
    return { 
      success: true, 
      message: `${modelType}工牌OBJ模型导出成功！\n厚度: ${exportSettings.thickness}mm\n已下载3个文件：badge.obj、badge.mtl、badge_texture.png\n✅ 模型已优化为水密结构，适合3D打印` 
    };
  } catch (error) {
    return { success: false, message: '导出失败：' + error.message };
  }
} 