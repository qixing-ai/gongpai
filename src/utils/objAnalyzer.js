// OBJ模型分析工具
export class BadgeOBJAnalyzer {
  // 分析工牌OBJ模型的面和顶点数量
  static analyzeBadgeModel(badgeSettings, holeSettings) {
    const analysis = {
      vertices: 0,
      faces: 0,
      breakdown: {
        outerShape: {},
        hole: {},
        total: {}
      }
    };

    const { width, height, borderRadius } = badgeSettings;
    
    // 分析外轮廓
    const outerPoints = this.calculatePointCount('rectangle', { width, height, borderRadius });
    analysis.breakdown.outerShape = {
      points: outerPoints,
      vertices: outerPoints * 2 + 2, // 正面+背面的轮廓点 + 2个中心点
      faces: this.calculateFacesForShape(outerPoints, false)
    };

    // 分析孔洞（如果存在）
    if (holeSettings.enabled) {
      let holePoints;
      if (holeSettings.shape === 'circle') {
        const radius = holeSettings.size / 2;
        holePoints = this.calculatePointCount('circle', { radius });
      } else if (holeSettings.shape === 'oval') {
        const avgRadius = (holeSettings.size + holeSettings.size * 0.6) / 4;
        holePoints = this.calculatePointCount('oval', { avgRadius });
      } else {
        holePoints = this.calculatePointCount('rectangle', { 
          width: holeSettings.width, 
          height: holeSettings.height, 
          borderRadius: holeSettings.borderRadius 
        });
      }
      
      analysis.breakdown.hole = {
        points: holePoints,
        vertices: holePoints * 2, // 正面+背面的轮廓点
        faces: this.calculateFacesForHole(outerPoints, holePoints)
      };
      
      // 带孔洞的总计算
      analysis.breakdown.total = {
        vertices: analysis.breakdown.outerShape.vertices + analysis.breakdown.hole.vertices,
        faces: analysis.breakdown.hole.faces
      };
    } else {
      // 无孔洞的总计算
      analysis.breakdown.total = {
        vertices: analysis.breakdown.outerShape.vertices,
        faces: analysis.breakdown.outerShape.faces
      };
    }

    analysis.vertices = analysis.breakdown.total.vertices;
    analysis.faces = analysis.breakdown.total.faces;

    return analysis;
  }

  // 计算轮廓点数量
  static calculatePointCount(type, params) {
    if (type === 'rectangle') {
      const { width, height, borderRadius = 0 } = params;
      const r = Math.min(borderRadius, Math.min(width, height) / 4);
      
      if (r > 0.1) {
        // 圆角矩形：4个角，每个角16个分段，加1个起始点
        return 4 * (16 + 1);
      } else {
        // 普通矩形：4个顶点
        return 4;
      }
    } else if (type === 'circle') {
      const { radius } = params;
      // 根据圆形大小动态调整分段数
      return Math.max(32, Math.min(128, Math.round(radius * 8)));
    } else if (type === 'oval') {
      const { avgRadius } = params;
      // 根据椭圆平均半径调整分段数
      return Math.max(32, Math.min(128, Math.round(avgRadius * 8)));
    }
    return 0;
  }

  // 计算无孔洞形状的面数
  static calculateFacesForShape(pointCount, hasHole) {
    if (hasHole) return 0; // 有孔洞时使用不同的计算方法
    
    return {
      front: pointCount,      // 正面：从中心点到每个轮廓边的三角形
      back: pointCount,       // 背面：同正面
      sides: pointCount * 2,  // 侧面：每个边有2个三角形
      total: pointCount * 4
    };
  }

  // 计算带孔洞的面数
  static calculateFacesForHole(outerPoints, holePoints) {
    const strips = Math.max(outerPoints, holePoints);
    
    return {
      front: strips * 2,      // 正面：条带连接，每个条带2个三角形
      back: strips * 2,       // 背面：同正面
      outerSides: outerPoints * 2,  // 外轮廓侧面
      holeSides: holePoints * 2,    // 孔洞侧面
      total: strips * 4 + outerPoints * 2 + holePoints * 2
    };
  }

  // 生成详细分析报告
  static generateAnalysisReport(badgeSettings, holeSettings) {
    const analysis = this.analyzeBadgeModel(badgeSettings, holeSettings);
    
    const report = {
      summary: `工牌OBJ模型包含 ${analysis.vertices} 个顶点和 ${analysis.faces} 个三角面`,
      details: {
        vertices: analysis.vertices,
        faces: analysis.faces,
        modelType: holeSettings.enabled ? '带孔洞模型' : '实心模型',
        dimensions: `${badgeSettings.width}mm × ${badgeSettings.height}mm × 2mm`
      },
      breakdown: analysis.breakdown,
      complexity: this.getComplexityLevel(analysis.faces)
    };

    return report;
  }

  // 获取模型复杂度等级
  static getComplexityLevel(faceCount) {
    if (faceCount < 100) return '简单';
    if (faceCount < 500) return '中等';
    if (faceCount < 1000) return '复杂';
    return '高复杂度';
  }
}

// 导出分析函数
export function analyzeBadgeOBJ(badgeSettings, holeSettings) {
  return BadgeOBJAnalyzer.generateAnalysisReport(badgeSettings, holeSettings);
} 