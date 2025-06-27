import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Layout,
  Card,
  Row,
  Col,
  Slider,
  Select,
  Upload,
  Button,
  Input,
  ColorPicker,
  Space,
  Typography,
  Divider,
  InputNumber,
  Radio,
  message,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CameraOutlined,
} from '@ant-design/icons';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

const BadgeDesigner = () => {
  // 统一尺寸配置常量
  const UNIT_CONFIG = {
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

  // 数值格式化函数
  const formatSize = (value, precision = 1) => {
    return Math.round(value * (10 ** precision)) / (10 ** precision);
  };

  // 尺寸验证函数
  const validateSize = (value, config) => {
    return Math.max(config.min, Math.min(config.max, formatSize(value, 1)));
  };

  // 工牌设置 - 统一使用毫米(mm)
  const [badgeSettings, setBadgeSettings] = useState({
    width: 63,        // mm
    height: 90,       // mm
    backgroundColor: '#ffffff',
    borderRadius: 5,  // mm
  });

  // 穿孔设置 - 统一使用毫米(mm)
  const [holeSettings, setHoleSettings] = useState({
    enabled: false,
    shape: 'circle',
    size: 6,          // mm
    offsetY: 1,       // mm
    width: 6,         // mm
    height: 4,        // mm
    borderRadius: 2,  // mm
  });

  // 图片设置 - 统一使用毫米(mm)
  const [imageSettings, setImageSettings] = useState({
    src: null,
    width: 30,        // mm
    height: 30,       // mm
    x: 17,            // mm
    y: 23,            // mm
    opacity: 1,
  });

  // 文字设置 - 统一使用毫米(mm)
  const [textSettings, setTextSettings] = useState({
    content: '张三\n技术部',
    fontSize: 4,      // mm
    color: '#000000',
    fontFamily: 'Microsoft YaHei',
    x: 26,            // mm
    y: 68,            // mm
    lineHeight: 1.4,
  });

  // 统一的交互状态
  const [interactionState, setInteractionState] = useState({
    type: null, // 'drag', 'resize-badge', 'resize-image', 'resize-hole'
    element: null, // 'badge', 'image', 'text', 'hole'
    resizeType: null, // 'width', 'height', 'corner', 'size', 'position'
    startX: 0,
    startY: 0,
    startValues: {},
  });

  // 选中状态
  const [selectedElement, setSelectedElement] = useState(null);
  const badgePreviewRef = useRef(null);

  // 处理图片上传
  const handleImageUpload = (info) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSettings(prev => ({ ...prev, src: e.target.result }));
        message.success('图片上传成功');
      };
      reader.readAsDataURL(file);
    }
  };

  // 开始交互（拖拽或调整尺寸）
  const startInteraction = useCallback((e, type, element, resizeType = null) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElement(element);
    
    const startValues = {};
    if (type === 'drag') {
      if (element === 'image') {
        startValues.x = imageSettings.x;
        startValues.y = imageSettings.y;
      } else if (element === 'text') {
        startValues.x = textSettings.x;
        startValues.y = textSettings.y;
      }
    } else if (type === 'resize-badge') {
      startValues.width = badgeSettings.width;
      startValues.height = badgeSettings.height;
    } else if (type === 'resize-image') {
      startValues.width = imageSettings.width;
      startValues.height = imageSettings.height;
    } else if (type === 'resize-hole') {
      startValues.size = holeSettings.size;
      startValues.width = holeSettings.width;
      startValues.height = holeSettings.height;
      startValues.offsetY = holeSettings.offsetY;
    }
    
    setInteractionState({
      type,
      element,
      resizeType,
      startX: e.clientX,
      startY: e.clientY,
      startValues,
    });
  }, [imageSettings, textSettings, badgeSettings, holeSettings]);

  // 处理交互移动
  const handleInteractionMove = useCallback((e) => {
    if (!interactionState.type) return;
    
    const deltaX = (e.clientX - interactionState.startX) / UNIT_CONFIG.PREVIEW_SCALE;
    const deltaY = (e.clientY - interactionState.startY) / UNIT_CONFIG.PREVIEW_SCALE;
    
    const { type, element, resizeType, startValues } = interactionState;
    
    if (type === 'drag') {
      let maxX, maxY;
      
      if (element === 'image') {
        maxX = badgeSettings.width - imageSettings.width;
        maxY = badgeSettings.height - imageSettings.height;
      } else if (element === 'text') {
        maxX = badgeSettings.width - 5;
        maxY = badgeSettings.height - 5;
      }
      
      const newX = validateSize(startValues.x + deltaX, { min: 0, max: maxX });
      const newY = validateSize(startValues.y + deltaY, { min: 0, max: maxY });
      
      if (element === 'image') {
        setImageSettings(prev => ({ ...prev, x: newX, y: newY }));
      } else if (element === 'text') {
        setTextSettings(prev => ({ ...prev, x: newX, y: newY }));
      }
    } else if (type === 'resize-badge') {
      let newWidth = startValues.width;
      let newHeight = startValues.height;
      
      if (resizeType === 'width' || resizeType === 'corner') {
        newWidth = validateSize(startValues.width + deltaX, UNIT_CONFIG.BADGE.WIDTH);
      }
      if (resizeType === 'height' || resizeType === 'corner') {
        newHeight = validateSize(startValues.height + deltaY, UNIT_CONFIG.BADGE.HEIGHT);
      }
      
      setBadgeSettings(prev => ({ ...prev, width: newWidth, height: newHeight }));
    } else if (type === 'resize-image') {
      let newWidth = startValues.width;
      let newHeight = startValues.height;
      
      if (resizeType === 'width' || resizeType === 'corner') {
        newWidth = validateSize(startValues.width + deltaX, UNIT_CONFIG.IMAGE.SIZE);
      }
      if (resizeType === 'height' || resizeType === 'corner') {
        newHeight = validateSize(startValues.height + deltaY, UNIT_CONFIG.IMAGE.SIZE);
      }
      
      setImageSettings(prev => ({ ...prev, width: newWidth, height: newHeight }));
    } else if (type === 'resize-hole') {
      if (resizeType === 'size') {
        const newSize = validateSize(startValues.size + deltaX, UNIT_CONFIG.HOLE.SIZE);
        setHoleSettings(prev => ({ ...prev, size: newSize }));
      } else if (resizeType === 'width' || resizeType === 'corner') {
        const newWidth = validateSize(startValues.width + deltaX, UNIT_CONFIG.HOLE.WIDTH);
        setHoleSettings(prev => ({ ...prev, width: newWidth }));
      }
      if (resizeType === 'height' || resizeType === 'corner') {
        const newHeight = validateSize(startValues.height + deltaY, UNIT_CONFIG.HOLE.HEIGHT);
        setHoleSettings(prev => ({ ...prev, height: newHeight }));
      } else if (resizeType === 'position') {
        const newOffsetY = validateSize(startValues.offsetY + deltaY, UNIT_CONFIG.HOLE.OFFSET_Y);
        setHoleSettings(prev => ({ ...prev, offsetY: newOffsetY }));
      }
    }
  }, [interactionState, badgeSettings, imageSettings]);

  // 结束交互
  const endInteraction = useCallback(() => {
    setInteractionState({
      type: null,
      element: null,
      resizeType: null,
      startX: 0,
      startY: 0,
      startValues: {},
    });
  }, []);

  // 双击编辑文字
  const handleDoubleClick = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'text') {
      message.info('双击文字可快速编辑（功能开发中）');
    }
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e) => {
    if (!selectedElement) return;
    
    const step = e.shiftKey ? 5 : 1;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({ 
            ...prev, 
            x: validateSize(prev.x - step, { min: 0, max: badgeSettings.width - prev.width })
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({ 
            ...prev, 
            x: validateSize(prev.x - step, { min: 0, max: badgeSettings.width - 5 })
          }));
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            x: validateSize(prev.x + step, { min: 0, max: badgeSettings.width - prev.width })
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            x: validateSize(prev.x + step, { min: 0, max: badgeSettings.width - 5 })
          }));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({ 
            ...prev, 
            y: validateSize(prev.y - step, { min: 0, max: badgeSettings.height - prev.height })
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({ 
            ...prev, 
            y: validateSize(prev.y - step, { min: 0, max: badgeSettings.height - 5 })
          }));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            y: validateSize(prev.y + step, { min: 0, max: badgeSettings.height - prev.height })
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            y: validateSize(prev.y + step, { min: 0, max: badgeSettings.height - 5 })
          }));
        }
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({ ...prev, src: null }));
          setSelectedElement(null);
          message.success('图片已删除');
        } else if (selectedElement === 'hole') {
          setHoleSettings(prev => ({ ...prev, enabled: false }));
          setSelectedElement(null);
          message.success('穿孔已删除');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedElement(null);
        break;
    }
  }, [selectedElement, badgeSettings]);

  // 事件监听
  useEffect(() => {
    const isInteracting = interactionState.type !== null;
    
    if (isInteracting) {
      document.addEventListener('mousemove', handleInteractionMove);
      document.addEventListener('mouseup', endInteraction);
      
      // 设置光标样式
      const cursorMap = {
        'drag': 'grabbing',
        'resize-badge': 'nw-resize',
        'resize-image': interactionState.resizeType === 'width' ? 'ew-resize' : 
                       interactionState.resizeType === 'height' ? 'ns-resize' : 'nw-resize',
        'resize-hole': interactionState.resizeType === 'width' || interactionState.resizeType === 'size' ? 'ew-resize' :
                       interactionState.resizeType === 'height' || interactionState.resizeType === 'position' ? 'ns-resize' : 'nw-resize',
      };
      
      document.body.style.cursor = cursorMap[interactionState.type] || 'default';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleInteractionMove);
      document.removeEventListener('mouseup', endInteraction);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleInteractionMove);
      document.removeEventListener('mouseup', endInteraction);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [interactionState, handleInteractionMove, endInteraction, handleKeyDown]);

  // 渲染调整手柄的通用函数
  const renderResizeHandle = (position, type, color, onMouseDown, title) => {
    const isCorner = type === 'corner';
    const isVertical = position.includes('bottom') || position.includes('top');
    const isHorizontal = position.includes('left') || position.includes('right');
    
    const baseStyle = {
      position: 'absolute',
      backgroundColor: color,
      borderRadius: isCorner ? 2 : position.includes('right') || position.includes('left') ? 5 : 3,
      opacity: 0.8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: isCorner ? '6px' : '8px',
      transition: 'opacity 0.2s',
      cursor: isCorner ? 'nw-resize' : isHorizontal ? 'ew-resize' : 'ns-resize',
      zIndex: 10,
    };

    const positionStyle = {};
    if (position.includes('right')) positionStyle.right = -5;
    if (position.includes('left')) positionStyle.left = -5;
    if (position.includes('bottom')) positionStyle.bottom = -5;
    if (position.includes('top')) positionStyle.top = -5;
    if (position.includes('center-x')) {
      positionStyle.left = '50%';
      positionStyle.transform = 'translateX(-50%)';
    }
    if (position.includes('center-y')) {
      positionStyle.top = '50%';
      positionStyle.transform = 'translateY(-50%)';
    }

    const sizeStyle = isCorner ? 
      { width: 12, height: 12 } : 
      isVertical ? { width: 20, height: 8 } : { width: 8, height: 20 };

    const icon = isCorner ? '⤡' : isHorizontal ? '↔' : '↕';

    return (
      <div
        style={{ ...baseStyle, ...positionStyle, ...sizeStyle }}
        onMouseDown={onMouseDown}
        onMouseEnter={(e) => e.target.style.opacity = 1}
        onMouseLeave={(e) => e.target.style.opacity = 0.8}
        title={title}
      >
        {icon}
      </div>
    );
  };

  // 渲染工牌预览
  const renderBadgePreview = () => {
    const badgeWidth = badgeSettings.width * UNIT_CONFIG.PREVIEW_SCALE;
    const badgeHeight = badgeSettings.height * UNIT_CONFIG.PREVIEW_SCALE;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div
          ref={badgePreviewRef}
          style={{
            width: badgeWidth,
            height: badgeHeight,
            backgroundColor: badgeSettings.backgroundColor,
            borderRadius: badgeSettings.borderRadius * UNIT_CONFIG.PREVIEW_SCALE,
            position: 'relative',
            border: selectedElement === 'badge' ? '2px solid #1890ff' : '1px solid #d9d9d9',
            margin: '20px auto',
            overflow: 'visible',
            boxShadow: selectedElement === 'badge' ? '0 0 8px rgba(24, 144, 255, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            cursor: interactionState.type === 'drag' ? 'grabbing' : 'pointer',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedElement('badge');
            }
          }}
        >
          {/* 穿孔 */}
          {holeSettings.enabled && (
            <div
              style={{
                position: 'absolute',
                top: holeSettings.offsetY * UNIT_CONFIG.PREVIEW_SCALE,
                left: '50%',
                transform: 'translateX(-50%)',
                width: holeSettings.shape === 'rectangle' ? holeSettings.width * UNIT_CONFIG.PREVIEW_SCALE : holeSettings.size * UNIT_CONFIG.PREVIEW_SCALE,
                height: holeSettings.shape === 'rectangle' ? holeSettings.height * UNIT_CONFIG.PREVIEW_SCALE : holeSettings.size * UNIT_CONFIG.PREVIEW_SCALE,
                backgroundColor: 'white',
                border: selectedElement === 'hole' ? '2px solid #52c41a' : '2px solid #999',
                borderRadius: holeSettings.shape === 'circle' ? '50%' : 
                            holeSettings.shape === 'oval' ? '50%' : 
                            holeSettings.shape === 'rectangle' ? holeSettings.borderRadius * UNIT_CONFIG.PREVIEW_SCALE + 'px' : '2px',
                cursor: 'pointer',
                boxShadow: selectedElement === 'hole' ? '0 0 8px rgba(82, 196, 26, 0.3)' : 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement('hole');
              }}
            >
              {/* 穿孔调整手柄 */}
              {selectedElement === 'hole' && (
                <>
                  {holeSettings.shape === 'rectangle' ? (
                    <>
                      {renderResizeHandle('right center-y', 'width', '#52c41a', 
                        (e) => startInteraction(e, 'resize-hole', 'hole', 'width'), '拖拽调整宽度')}
                      {renderResizeHandle('bottom center-x', 'height', '#52c41a',
                        (e) => startInteraction(e, 'resize-hole', 'hole', 'height'), '拖拽调整高度')}
                      {renderResizeHandle('right bottom', 'corner', '#52c41a',
                        (e) => startInteraction(e, 'resize-hole', 'hole', 'corner'), '拖拽同时调整宽度和高度')}
                    </>
                  ) : (
                    renderResizeHandle('right center-y', 'size', '#52c41a',
                      (e) => startInteraction(e, 'resize-hole', 'hole', 'size'), '拖拽调整大小')
                  )}
                  {renderResizeHandle('top center-x', 'position', '#fa8c16',
                    (e) => startInteraction(e, 'resize-hole', 'hole', 'position'), '拖拽调整垂直位置')}
                </>
              )}
            </div>
          )}

          {/* 图片 */}
          {imageSettings.src && (
            <div
              style={{
                position: 'absolute',
                left: imageSettings.x * UNIT_CONFIG.PREVIEW_SCALE,
                top: imageSettings.y * UNIT_CONFIG.PREVIEW_SCALE,
                width: imageSettings.width * UNIT_CONFIG.PREVIEW_SCALE,
                height: imageSettings.height * UNIT_CONFIG.PREVIEW_SCALE,
                cursor: interactionState.type === 'drag' && interactionState.element === 'image' ? 'grabbing' : 'grab',
                border: selectedElement === 'image' ? '2px solid #1890ff' : 
                       (interactionState.element === 'image' && interactionState.type === 'drag' ? '2px dashed #1890ff' : '2px solid transparent'),
                borderRadius: '4px',
                boxShadow: selectedElement === 'image' ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
              }}
              onMouseDown={(e) => startInteraction(e, 'drag', 'image')}
              onDoubleClick={(e) => handleDoubleClick(e, 'image')}
            >
              <img
                src={imageSettings.src}
                alt="badge"
                style={{
                  width: '100%',
                  height: '100%',
                  opacity: imageSettings.opacity,
                  objectFit: 'cover',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }}
              />
              
              {/* 图片调整手柄 */}
              {selectedElement === 'image' && (
                <>
                  {renderResizeHandle('right center-y', 'width', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', 'image', 'width'), '拖拽调整宽度')}
                  {renderResizeHandle('bottom center-x', 'height', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', 'image', 'height'), '拖拽调整高度')}
                  {renderResizeHandle('right bottom', 'corner', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', 'image', 'corner'), '拖拽同时调整宽度和高度')}
                </>
              )}
              
              {/* 拖拽提示 */}
              <div
                style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  opacity: interactionState.element === 'image' && interactionState.type === 'drag' ? 1 : 0,
                  transition: 'opacity 0.2s',
                  pointerEvents: 'none',
                }}
              >
                拖拽调整位置
              </div>
            </div>
          )}

          {/* 文字 */}
          <div
            style={{
              position: 'absolute',
              left: textSettings.x * UNIT_CONFIG.PREVIEW_SCALE,
              top: textSettings.y * UNIT_CONFIG.PREVIEW_SCALE,
              cursor: interactionState.type === 'drag' && interactionState.element === 'text' ? 'grabbing' : 'grab',
              border: selectedElement === 'text' ? '2px solid #1890ff' :
                     (interactionState.element === 'text' && interactionState.type === 'drag' ? '2px dashed #1890ff' : '2px solid transparent'),
              borderRadius: '4px',
              padding: '2px',
              minWidth: '20px',
              minHeight: '20px',
              boxShadow: selectedElement === 'text' ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
            }}
            onMouseDown={(e) => startInteraction(e, 'drag', 'text')}
            onDoubleClick={(e) => handleDoubleClick(e, 'text')}
          >
            <div
              style={{
                fontSize: textSettings.fontSize * UNIT_CONFIG.PREVIEW_SCALE,
                color: textSettings.color,
                fontFamily: textSettings.fontFamily,
                lineHeight: textSettings.lineHeight,
                whiteSpace: 'pre-line',
                maxWidth: (badgeSettings.width - textSettings.x - 5) * UNIT_CONFIG.PREVIEW_SCALE,
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {textSettings.content}
            </div>
            {/* 拖拽提示 */}
            <div
              style={{
                position: 'absolute',
                top: '-25px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                opacity: interactionState.element === 'text' && interactionState.type === 'drag' ? 1 : 0,
                transition: 'opacity 0.2s',
                pointerEvents: 'none',
              }}
            >
              拖拽调整位置
            </div>
          </div>
        </div>
        
        {/* 工牌调整手柄 */}
        {selectedElement === 'badge' && (
          <>
            {renderResizeHandle('right center-y', 'width', '#1890ff',
              (e) => startInteraction(e, 'resize-badge', 'badge', 'width'), '拖拽调整宽度')}
            {renderResizeHandle('bottom center-x', 'height', '#1890ff',
              (e) => startInteraction(e, 'resize-badge', 'badge', 'height'), '拖拽调整高度')}
            {renderResizeHandle('right bottom', 'corner', '#1890ff',
              (e) => startInteraction(e, 'resize-badge', 'badge', 'corner'), '拖拽同时调整宽度和高度')}
          </>
        )}
      </div>
    );
  };

  // 导出工牌为OBJ模型
  const exportBadge = async () => {
    try {
      message.loading('正在生成OBJ模型...', 0);
      
      const { exportBadgeAsOBJ } = await import('../utils/objExporter');
      
      const result = await exportBadgeAsOBJ(
        badgeSettings, 
        holeSettings, 
        imageSettings, 
        textSettings
      );
      
      message.destroy(); // 清除loading消息
      
      if (result.success) {
        message.success(result.message, 5);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.destroy();
      message.error('导出失败：' + error.message);
      console.error('导出错误:', error);
    }
  };

  // 重置设计
  const resetDesign = () => {
    setBadgeSettings({
      width: formatSize(63),
      height: formatSize(90),
      backgroundColor: '#ffffff',
      borderRadius: formatSize(5),
    });
    setHoleSettings({
      enabled: false,
      shape: 'circle',
      size: formatSize(6),
      offsetY: formatSize(1),
      width: formatSize(6),
      height: formatSize(4),
      borderRadius: formatSize(2),
    });
    setImageSettings({
      src: null,
      width: formatSize(30),
      height: formatSize(30),
      x: formatSize(17),
      y: formatSize(23),
      opacity: formatSize(1, 1),
    });
    setTextSettings({
      content: '张三\n技术部',
      fontSize: formatSize(4),
      color: '#000000',
      fontFamily: 'Microsoft YaHei',
      x: formatSize(26),
      y: formatSize(68),
      lineHeight: formatSize(1.4, 1),
    });
    setSelectedElement(null);
    message.success('设计已重置');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            <CameraOutlined style={{ marginRight: 8 }} />
            工牌设计器
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={resetDesign}>
              重置
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportBadge}>
              导出OBJ模型
            </Button>
          </Space>
        </div>
      </Header>

      <Layout>
        <Sider width={320} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
            {/* 工牌尺寸设置 */}
            <Card title="工牌尺寸" size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>宽度: {formatSize(badgeSettings.width)}mm</Text>
                  <Slider
                    min={UNIT_CONFIG.BADGE.WIDTH.min}
                    max={UNIT_CONFIG.BADGE.WIDTH.max}
                    step={UNIT_CONFIG.BADGE.WIDTH.step}
                    value={badgeSettings.width}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, width: formatSize(value) }))}
                  />
                </div>
                <div>
                  <Text>高度: {formatSize(badgeSettings.height)}mm</Text>
                  <Slider
                    min={UNIT_CONFIG.BADGE.HEIGHT.min}
                    max={UNIT_CONFIG.BADGE.HEIGHT.max}
                    step={UNIT_CONFIG.BADGE.HEIGHT.step}
                    value={badgeSettings.height}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, height: formatSize(value) }))}
                  />
                </div>
                <div>
                  <Text>圆角: {formatSize(badgeSettings.borderRadius)}mm</Text>
                  <Slider
                    min={UNIT_CONFIG.BADGE.BORDER_RADIUS.min}
                    max={UNIT_CONFIG.BADGE.BORDER_RADIUS.max}
                    step={UNIT_CONFIG.BADGE.BORDER_RADIUS.step}
                    value={badgeSettings.borderRadius}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, borderRadius: formatSize(value) }))}
                  />
                </div>
                <div>
                  <Text>背景颜色</Text>
                  <ColorPicker
                    value={badgeSettings.backgroundColor}
                    onChange={(color) => setBadgeSettings(prev => ({ ...prev, backgroundColor: color.toHexString() }))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
              </Space>
            </Card>

            {/* 穿孔设置 */}
            <Card title="穿孔设置" size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio.Group
                  value={holeSettings.enabled}
                  onChange={(e) => {
                    setHoleSettings(prev => ({ ...prev, enabled: e.target.value }));
                    if (e.target.value) {
                      setSelectedElement('hole');
                    } else {
                      setSelectedElement(null);
                    }
                  }}
                >
                  <Radio value={true}>启用穿孔</Radio>
                  <Radio value={false}>禁用穿孔</Radio>
                </Radio.Group>
                
                {holeSettings.enabled && (
                  <>
                    <div>
                      <Text>形状</Text>
                      <Select
                        value={holeSettings.shape}
                        onChange={(value) => setHoleSettings(prev => ({ ...prev, shape: value }))}
                        style={{ width: '100%', marginTop: 4 }}
                      >
                        <Select.Option value="circle">圆形</Select.Option>
                        <Select.Option value="rectangle">矩形</Select.Option>
                        <Select.Option value="oval">椭圆</Select.Option>
                      </Select>
                    </div>
                    
                    {holeSettings.shape === 'rectangle' ? (
                      <>
                        <Row gutter={8}>
                          <Col span={12}>
                            <Text>宽度: {formatSize(holeSettings.width)}mm</Text>
                            <Slider
                              min={UNIT_CONFIG.HOLE.WIDTH.min}
                              max={UNIT_CONFIG.HOLE.WIDTH.max}
                              step={UNIT_CONFIG.HOLE.WIDTH.step}
                              value={holeSettings.width}
                              onChange={(value) => setHoleSettings(prev => ({ ...prev, width: formatSize(value) }))}
                            />
                          </Col>
                          <Col span={12}>
                            <Text>高度: {formatSize(holeSettings.height)}mm</Text>
                            <Slider
                              min={UNIT_CONFIG.HOLE.HEIGHT.min}
                              max={UNIT_CONFIG.HOLE.HEIGHT.max}
                              step={UNIT_CONFIG.HOLE.HEIGHT.step}
                              value={holeSettings.height}
                              onChange={(value) => setHoleSettings(prev => ({ ...prev, height: formatSize(value) }))}
                            />
                          </Col>
                        </Row>
                        <div>
                          <Text>倒角: {formatSize(holeSettings.borderRadius)}mm</Text>
                          <Slider
                            min={UNIT_CONFIG.HOLE.BORDER_RADIUS.min}
                            max={Math.min(holeSettings.width, holeSettings.height) / 2}
                            step={UNIT_CONFIG.HOLE.BORDER_RADIUS.step}
                            value={holeSettings.borderRadius}
                            onChange={(value) => setHoleSettings(prev => ({ ...prev, borderRadius: formatSize(value) }))}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <Text>大小: {formatSize(holeSettings.size)}mm</Text>
                        <Slider
                          min={UNIT_CONFIG.HOLE.SIZE.min}
                          max={UNIT_CONFIG.HOLE.SIZE.max}
                          step={UNIT_CONFIG.HOLE.SIZE.step}
                          value={holeSettings.size}
                          onChange={(value) => setHoleSettings(prev => ({ ...prev, size: formatSize(value) }))}
                        />
                      </div>
                    )}
                    
                    <div>
                      <Text>垂直偏移: {formatSize(holeSettings.offsetY)}mm</Text>
                      <Slider
                        min={UNIT_CONFIG.HOLE.OFFSET_Y.min}
                        max={UNIT_CONFIG.HOLE.OFFSET_Y.max}
                        step={UNIT_CONFIG.HOLE.OFFSET_Y.step}
                        value={holeSettings.offsetY}
                        onChange={(value) => setHoleSettings(prev => ({ ...prev, offsetY: formatSize(value) }))}
                      />
                    </div>
                  </>
                )}
              </Space>
            </Card>

            {/* 图片设置 */}
            <Card title="图片设置" size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleImageUpload}
                >
                  <Button icon={<UploadOutlined />} block>
                    上传图片
                  </Button>
                </Upload>
                
                {imageSettings.src && (
                  <>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text>宽度(mm)</Text>
                        <InputNumber
                          min={UNIT_CONFIG.IMAGE.SIZE.min}
                          max={UNIT_CONFIG.IMAGE.SIZE.max}
                          step={UNIT_CONFIG.IMAGE.SIZE.step}
                          value={imageSettings.width}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, width: formatSize(value || 0) }))}
                          style={{ width: '100%' }}
                          formatter={(value) => `${formatSize(value || 0)}`}
                          parser={(value) => parseFloat(value) || 0}
                        />
                      </Col>
                      <Col span={12}>
                        <Text>高度(mm)</Text>
                        <InputNumber
                          min={UNIT_CONFIG.IMAGE.SIZE.min}
                          max={UNIT_CONFIG.IMAGE.SIZE.max}
                          step={UNIT_CONFIG.IMAGE.SIZE.step}
                          value={imageSettings.height}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, height: formatSize(value || 0) }))}
                          style={{ width: '100%' }}
                          formatter={(value) => `${formatSize(value || 0)}`}
                          parser={(value) => parseFloat(value) || 0}
                        />
                      </Col>
                    </Row>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text>X位置(mm)</Text>
                        <InputNumber
                          min={UNIT_CONFIG.IMAGE.POSITION.min}
                          max={badgeSettings.width - 10}
                          step={UNIT_CONFIG.IMAGE.POSITION.step}
                          value={imageSettings.x}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, x: formatSize(value || 0) }))}
                          style={{ width: '100%' }}
                          formatter={(value) => `${formatSize(value || 0)}`}
                          parser={(value) => parseFloat(value) || 0}
                        />
                      </Col>
                      <Col span={12}>
                        <Text>Y位置(mm)</Text>
                        <InputNumber
                          min={UNIT_CONFIG.IMAGE.POSITION.min}
                          max={badgeSettings.height - 10}
                          step={UNIT_CONFIG.IMAGE.POSITION.step}
                          value={imageSettings.y}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, y: formatSize(value || 0) }))}
                          style={{ width: '100%' }}
                          formatter={(value) => `${formatSize(value || 0)}`}
                          parser={(value) => parseFloat(value) || 0}
                        />
                      </Col>
                    </Row>
                    <div>
                      <Text>透明度: {Math.round(imageSettings.opacity * 100)}%</Text>
                      <Slider
                        min={UNIT_CONFIG.IMAGE.OPACITY.min}
                        max={UNIT_CONFIG.IMAGE.OPACITY.max}
                        step={UNIT_CONFIG.IMAGE.OPACITY.step}
                        value={imageSettings.opacity}
                        onChange={(value) => setImageSettings(prev => ({ ...prev, opacity: formatSize(value, 1) }))}
                      />
                    </div>
                  </>
                )}
              </Space>
            </Card>
          </div>
        </Sider>

        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Row gutter={16} style={{ height: '100%' }}>
            <Col span={18}>
              <Card title="工牌预览" style={{ height: '100%' }}>
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    minHeight: 600,
                    background: '#fafafa',
                    borderRadius: 8,
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedElement(null);
                    }
                  }}
                >
                  {renderBadgePreview()}
                </div>
                <Divider />
                <div style={{ textAlign: 'center' }}>
                  <Space direction="vertical" size="small">
                    <Text type="secondary">
                      实际尺寸: {formatSize(badgeSettings.width)}mm × {formatSize(badgeSettings.height)}mm
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      📏 所有尺寸单位均为毫米(mm) • 预览放大{UNIT_CONFIG.PREVIEW_SCALE}倍显示
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      💡 提示：点击选中元素显示调整手柄 • 拖拽调整尺寸和位置 • 方向键微调 • Delete删除 • Esc取消选中
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px', color: '#1890ff' }}>
                      🎯 导出说明：点击"导出OBJ模型"将下载3个文件 - badge.obj（模型）、badge.mtl（材质）、badge_texture.png（贴图）
                    </Text>
                  </Space>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              {/* 文字设置 */}
              <Card title="文字设置" size="small" style={{ height: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div>
                    <Text>文字内容</Text>
                    <Input.TextArea
                      value={textSettings.content}
                      onChange={(e) => setTextSettings(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="输入文字内容"
                      rows={3}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <Text>字体</Text>
                    <Select
                      value={textSettings.fontFamily}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, fontFamily: value }))}
                      style={{ width: '100%', marginTop: 4 }}
                      size="small"
                    >
                      <Select.Option value="Microsoft YaHei">微软雅黑</Select.Option>
                      <Select.Option value="SimHei">黑体</Select.Option>
                      <Select.Option value="SimSun">宋体</Select.Option>
                      <Select.Option value="Arial">Arial</Select.Option>
                    </Select>
                  </div>
                  <div>
                    <Text>字号: {formatSize(textSettings.fontSize)}mm</Text>
                    <Slider
                      min={UNIT_CONFIG.TEXT.FONT_SIZE.min}
                      max={UNIT_CONFIG.TEXT.FONT_SIZE.max}
                      step={UNIT_CONFIG.TEXT.FONT_SIZE.step}
                      value={textSettings.fontSize}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, fontSize: formatSize(value) }))}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>颜色</Text>
                    <ColorPicker
                      value={textSettings.color}
                      onChange={(color) => setTextSettings(prev => ({ ...prev, color: color.toHexString() }))}
                      style={{ width: '100%', marginTop: 4 }}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>位置 X: {formatSize(textSettings.x)}mm</Text>
                    <Slider
                      min={UNIT_CONFIG.TEXT.POSITION.min}
                      max={badgeSettings.width - 10}
                      step={UNIT_CONFIG.TEXT.POSITION.step}
                      value={textSettings.x}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, x: formatSize(value) }))}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>位置 Y: {formatSize(textSettings.y)}mm</Text>
                    <Slider
                      min={UNIT_CONFIG.TEXT.POSITION.min}
                      max={badgeSettings.height - 10}
                      step={UNIT_CONFIG.TEXT.POSITION.step}
                      value={textSettings.y}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, y: formatSize(value) }))}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>行高: {formatSize(textSettings.lineHeight, 1)}</Text>
                    <Slider
                      min={UNIT_CONFIG.TEXT.LINE_HEIGHT.min}
                      max={UNIT_CONFIG.TEXT.LINE_HEIGHT.max}
                      step={UNIT_CONFIG.TEXT.LINE_HEIGHT.step}
                      value={textSettings.lineHeight}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, lineHeight: formatSize(value, 1) }))}
                      size="small"
                    />
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default BadgeDesigner; 