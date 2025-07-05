import { BadgeOBJExporter } from './BadgeOBJExporter.js';

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
    
    // 2. 修正：确保自适应细分设置总是被应用
    // 无论调用者是否提供了subdivision对象，都使用一个默认值来确保功能开启。
    const subdivisionSettings = exportSettings.subdivision || {
      enabled: true,
      threshold: 0.05,
      maxDepth: 5
    };

    exporter.setSubdivisionSettings(
      subdivisionSettings.enabled !== false,
      subdivisionSettings.threshold || 0.05,
      subdivisionSettings.maxDepth || 5
    );
    
    // 2. 生成几何体
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