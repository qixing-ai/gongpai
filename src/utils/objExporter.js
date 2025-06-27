// OBJ模型导出工具
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

  // 添加面（三角形）
  addFace(v1, v2, v3, uv1, uv2, uv3) {
    this.faces.push({ vertices: [v1, v2, v3], uvs: [uv1, uv2, uv3] });
  }

  // 创建轮廓点（统一的点生成函数）
  createPoints(type, params) {
    const points = [];
    
    if (type === 'rectangle') {
      const { width, height, borderRadius = 0, centerX = 0, centerY = 0 } = params;
      const w = width / 2;
      const h = height / 2;
      const r = Math.min(borderRadius, Math.min(width, height) / 4);
      
      if (r > 0.1) {
        // 圆角矩形
        const segments = 8;
        const corners = [
          { cx: centerX + w - r, cy: centerY + h - r, startAngle: 0 },
          { cx: centerX - w + r, cy: centerY + h - r, startAngle: Math.PI / 2 },
          { cx: centerX - w + r, cy: centerY - h + r, startAngle: Math.PI },
          { cx: centerX + w - r, cy: centerY - h + r, startAngle: Math.PI * 1.5 }
        ];
        
        corners.forEach(corner => {
          for (let i = 0; i <= segments; i++) {
            const angle = corner.startAngle + (Math.PI / 2) * (i / segments);
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
      const { radius, centerX, centerY, segments = 16 } = params;
      for (let i = 0; i < segments; i++) {
        const angle = (2 * Math.PI * i) / segments;
        points.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        });
      }
    }
    
    return points;
  }

  // 创建顶点和UV（统一的顶点生成函数）
  createVerticesAndUVs(points, thickness, width, height) {
    const vertices = [];
    const uvs = [];
    
    // 正面和背面
    for (let layer = 0; layer < 2; layer++) {
      const z = layer === 0 ? thickness / 2 : -thickness / 2;
      
      points.forEach(point => {
        vertices.push(this.addVertex(point.x, point.y, z));
        const u = (point.x + width / 2) / width;
        const v = (point.y + height / 2) / height;
        uvs.push(this.addUV(u, v));
      });
    }
    
    return { vertices, uvs };
  }

  // 生成面（正面、背面、侧面）
  generateFaces(vertices, uvs, pointCount, hasHole = false, holeVertices = [], holeUVs = []) {
    if (hasHole) {
      // 带孔洞的面
      this.createStripsToHole(
        vertices.slice(0, pointCount), uvs.slice(0, pointCount),
        holeVertices.slice(0, holeUVs.length / 2), holeUVs.slice(0, holeUVs.length / 2),
        true
      );
      this.createStripsToHole(
        vertices.slice(pointCount), uvs.slice(pointCount),
        holeVertices.slice(holeUVs.length / 2), holeUVs.slice(holeUVs.length / 2),
        false
      );
    } else {
      // 普通面
      const centerFront = this.addVertex(0, 0, 1);
      const centerBack = this.addVertex(0, 0, -1);
      const centerUV = this.addUV(0.5, 0.5);
      
      // 正面
      for (let i = 0; i < pointCount; i++) {
        const next = (i + 1) % pointCount;
        this.addFace(centerFront, vertices[i], vertices[next], centerUV, uvs[i], uvs[next]);
      }
      
      // 背面
      for (let i = 0; i < pointCount; i++) {
        const next = (i + 1) % pointCount;
        this.addFace(centerBack, vertices[pointCount + next], vertices[pointCount + i], centerUV, uvs[pointCount + next], uvs[pointCount + i]);
      }
    }
    
    // 侧面
    this.generateSideFaces(vertices, uvs, pointCount, false);
    if (hasHole) {
      this.generateSideFaces(holeVertices, holeUVs, holeUVs.length / 2, true);
    }
  }

  // 条带连接法（处理孔洞）
  createStripsToHole(outerVertices, outerUVs, innerVertices, innerUVs, isFront) {
    const strips = Math.max(outerVertices.length, innerVertices.length);
    
    for (let i = 0; i < strips; i++) {
      const outerIdx1 = Math.floor(i * outerVertices.length / strips) % outerVertices.length;
      const outerIdx2 = Math.floor((i + 1) * outerVertices.length / strips) % outerVertices.length;
      const innerIdx1 = Math.floor(i * innerVertices.length / strips) % innerVertices.length;
      const innerIdx2 = Math.floor((i + 1) * innerVertices.length / strips) % innerVertices.length;
      
      const [ov1, ov2, iv1, iv2] = [outerVertices[outerIdx1], outerVertices[outerIdx2], innerVertices[innerIdx1], innerVertices[innerIdx2]];
      const [ouv1, ouv2, iuv1, iuv2] = [outerUVs[outerIdx1], outerUVs[outerIdx2], innerUVs[innerIdx1], innerUVs[innerIdx2]];
      
      if (isFront) {
        this.addFace(ov1, ov2, iv1, ouv1, ouv2, iuv1);
        this.addFace(ov2, iv2, iv1, ouv2, iuv2, iuv1);
      } else {
        this.addFace(ov1, iv1, ov2, ouv1, iuv1, ouv2);
        this.addFace(ov2, iv1, iv2, ouv2, iuv1, iuv2);
      }
    }
  }

  // 生成侧面
  generateSideFaces(vertices, uvs, pointCount, inward) {
    for (let i = 0; i < pointCount; i++) {
      const next = (i + 1) % pointCount;
      const [v1, v2, v3, v4] = [vertices[i], vertices[next], vertices[i + pointCount], vertices[next + pointCount]];
      const [uv1, uv2, uv3, uv4] = [uvs[i], uvs[next], uvs[i + pointCount], uvs[next + pointCount]];
      
      if (inward) {
        this.addFace(v1, v3, v2, uv1, uv3, uv2);
        this.addFace(v2, v3, v4, uv2, uv3, uv4);
      } else {
        this.addFace(v1, v2, v3, uv1, uv2, uv3);
        this.addFace(v2, v4, v3, uv2, uv4, uv3);
      }
    }
  }

  // 主要生成函数
  generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, textSettings) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;

    const { width, height, borderRadius } = badgeSettings;
    const thickness = 2.0;

    // 创建外轮廓
    const outerPoints = this.createPoints('rectangle', { width, height, borderRadius });
    const outer = this.createVerticesAndUVs(outerPoints, thickness, width, height);

    if (holeSettings.enabled) {
      // 创建孔洞
      const holeX = 0;
      const holeY = height / 2 - holeSettings.offsetY;
      const holeParams = holeSettings.shape === 'circle' 
        ? { radius: holeSettings.size / 2, centerX: holeX, centerY: holeY }
        : { width: holeSettings.width, height: holeSettings.height, centerX: holeX, centerY: holeY, borderRadius: holeSettings.borderRadius };
      
      const innerPoints = this.createPoints(holeSettings.shape === 'circle' ? 'circle' : 'rectangle', holeParams);
      const inner = this.createVerticesAndUVs(innerPoints, thickness, width, height);
      
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length, true, inner.vertices, inner.uvs);
    } else {
      this.generateFaces(outer.vertices, outer.uvs, outerPoints.length);
    }

    return this.generateOBJContent(badgeSettings, imageSettings, textSettings);
  }

  // 生成OBJ文件内容
  generateOBJContent(badgeSettings, imageSettings, textSettings) {
    let obj = `# 工牌 OBJ 模型\n# 尺寸: ${badgeSettings.width}mm x ${badgeSettings.height}mm x 2mm\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
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
  generateTextureCanvas(badgeSettings, imageSettings, textSettings) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const resolution = 512;
    
    canvas.width = canvas.height = resolution;
    const scaleX = resolution / badgeSettings.width;
    const scaleY = resolution / badgeSettings.height;
    
    // 背景
    ctx.fillStyle = badgeSettings.backgroundColor;
    ctx.fillRect(0, 0, resolution, resolution);
    
    // 绘制图片和文字
    if (imageSettings.src) {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.globalAlpha = imageSettings.opacity;
          ctx.drawImage(img, imageSettings.x * scaleX, imageSettings.y * scaleY, imageSettings.width * scaleX, imageSettings.height * scaleY);
          this.drawText(ctx, textSettings, badgeSettings, scaleX, scaleY);
          resolve(canvas);
        };
        img.src = imageSettings.src;
      });
    } else {
      this.drawText(ctx, textSettings, badgeSettings, scaleX, scaleY);
      return Promise.resolve(canvas);
    }
  }

  // 绘制文字
  drawText(ctx, textSettings, badgeSettings, scaleX, scaleY) {
    if (!textSettings.content) return;
    
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = textSettings.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${textSettings.fontSize * scaleX}px ${textSettings.fontFamily}`;
    
    const x = (textSettings.x + textSettings.fontSize * 2) * scaleX;
    const y = (textSettings.y + textSettings.fontSize / 2) * scaleY;
    const lineHeight = textSettings.fontSize * scaleX * textSettings.lineHeight;
    
    textSettings.content.split('\n').forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight);
    });
  }
}

// 导出函数
export async function exportBadgeAsOBJ(badgeSettings, holeSettings, imageSettings, textSettings) {
  const exporter = new BadgeOBJExporter();
  
  try {
    const objContent = exporter.generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, textSettings);
    const mtlContent = exporter.generateMTLContent();
    const textureCanvas = await exporter.generateTextureCanvas(badgeSettings, imageSettings, textSettings);
    
    // 下载文件
    const downloads = [
      { content: objContent, filename: 'badge.obj', type: 'text/plain' },
      { content: mtlContent, filename: 'badge.mtl', type: 'text/plain' }
    ];
    
    downloads.forEach(({ content, filename, type }) => {
      const blob = new Blob([content], { type });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    
    textureCanvas.toBlob(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'badge_texture.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
    
    return { success: true, message: '工牌OBJ模型导出成功！已下载3个文件：badge.obj、badge.mtl、badge_texture.png' };
  } catch (error) {
    return { success: false, message: '导出失败：' + error.message };
  }
} 