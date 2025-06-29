// 统一尺寸配置常量
export const UNIT_CONFIG = {
  // 单位转换
  mmToPx: (mm) => mm * 3.78, // 1mm ≈ 3.78px (96 DPI)
  pxToMm: (px) => px / 3.78,
  
  // 预览缩放
  PREVIEW_SCALE: 4,
  
  // 尺寸限制 (mm)
  BADGE: {
    WIDTH: { min: 40, max: 120, step: 1 },
    HEIGHT: { min: 30, max: 200, step: 1 },
    BORDER_RADIUS: { min: 0, max: 20, step: 0.5 }
  },
  HOLE: {
    SIZE: { min: 3, max: 15, step: 0.5 },
    WIDTH: { min: 3, max: 20, step: 0.5 },
    HEIGHT: { min: 2, max: 15, step: 0.5 },
    OFFSET_Y: { min: 1, max: 20, step: 0.5 },
    BORDER_RADIUS: { min: 0, max: 10, step: 0.5 }
  },
  IMAGE: {
    SIZE: { min: 10, max: 80, step: 1 },
    POSITION: { min: 0, step: 1 },
    OPACITY: { min: 0, max: 1, step: 0.1 }
  },
  TEXT: {
    FONT_SIZE: { min: 2, max: 8, step: 0.5 },
    POSITION: { min: 0, step: 1 },
    LINE_HEIGHT: { min: 1, max: 2, step: 0.1 }
  }
}; 