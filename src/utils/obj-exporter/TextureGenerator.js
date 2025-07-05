export class TextureGenerator {
  // 异步加载图片
  async loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }

  // 绘制文字
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

  drawWhiteCorner(ctx, canvasWidth, canvasHeight) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 2, 2); // 在左上角(0,0)处画一个2x2的白色像素块
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
} 