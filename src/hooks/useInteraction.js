import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';

const useInteraction = (
  badgeSettings,
  setBadgeSettings,
  holeSettings,
  setHoleSettings,
  imageSettings,
  setImageSettings,
  texts,
  setTexts,
  UNIT_CONFIG
) => {
  // 统一的交互状态
  const [interactionState, setInteractionState] = useState({
    type: null, // 'drag', 'resize-badge', 'resize-image', 'resize-hole'
    element: null, // { type: 'badge' }, { type: 'image' }, { type: 'text', id: '...' }, { type: 'hole' }
    resizeType: null, // 'width', 'height', 'corner', 'size', 'position'
    startX: 0,
    startY: 0,
    startValues: {},
  });

  // 选中状态
  const [selectedElement, setSelectedElement] = useState(null);

  // 数值格式化函数
  const formatSize = (value, precision = 1) => {
    return Math.round(value * (10 ** precision)) / (10 ** precision);
  };

  // 尺寸验证函数
  const validateSize = (value, config) => {
    return Math.max(config.min, Math.min(config.max, formatSize(value, 1)));
  };

  // 开始交互（拖拽或调整尺寸）
  const startInteraction = useCallback((e, type, element, resizeType = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 如果交互元素是文字，确保它被选中
    if (element?.type === 'text') {
      setSelectedElement(element);
    }

    const startValues = {};
    if (type === 'drag') {
      if (element?.type === 'image') {
        startValues.x = imageSettings.x;
        startValues.y = imageSettings.y;
      } else if (element?.type === 'text') {
        const text = texts.find(t => t.id === element.id);
        if (text) {
          startValues.x = text.x;
          startValues.y = text.y;
        }
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
  }, [imageSettings, texts, badgeSettings, holeSettings]);

  // 处理交互移动
  const handleInteractionMove = useCallback((e) => {
    if (!interactionState.type) return;
    
    const deltaX = (e.clientX - interactionState.startX) / UNIT_CONFIG.PREVIEW_SCALE;
    const deltaY = (e.clientY - interactionState.startY) / UNIT_CONFIG.PREVIEW_SCALE;
    
    const { type, element, resizeType, startValues } = interactionState;
    
    if (type === 'drag') {
      if (!element) return;

      let maxX, maxY;
      
      if (element.type === 'image') {
        maxX = badgeSettings.width - imageSettings.width;
        maxY = badgeSettings.height - imageSettings.height;
        const newX = validateSize(startValues.x + deltaX, { min: 0, max: maxX });
        const newY = validateSize(startValues.y + deltaY, { min: 0, max: maxY });
        setImageSettings(prev => ({ ...prev, x: newX, y: newY }));

      } else if (element.type === 'text') {
        const text = texts.find(t => t.id === element.id);
        if (text) {
            // 简易边界检测，未来可以根据文字实际渲染宽度进行优化
          maxX = badgeSettings.width - 10;
          maxY = badgeSettings.height - 10;
          const newX = validateSize(startValues.x + deltaX, { min: 0, max: maxX });
          const newY = validateSize(startValues.y + deltaY, { min: 0, max: maxY });

          setTexts(currentTexts => currentTexts.map(t =>
            t.id === element.id ? { ...t, x: newX, y: newY } : t
          ));
        }
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
  }, [interactionState, badgeSettings, imageSettings, texts, setBadgeSettings, setImageSettings, setTexts, setHoleSettings, UNIT_CONFIG]);

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
  const handleDoubleClick = useCallback((e, element) => {
    e.preventDefault();
    e.stopPropagation();
    if (element?.type === 'text') {
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
        if (selectedElement?.type === 'image') {
          setImageSettings(prev => ({ 
            ...prev, 
            x: validateSize(prev.x - step, { min: 0, max: badgeSettings.width - prev.width })
          }));
        } else if (selectedElement?.type === 'text') {
          setTexts(prevTexts => prevTexts.map(t => 
            t.id === selectedElement.id 
            ? { ...t, x: validateSize(t.x - step, { min: 0, max: badgeSettings.width - 10 }) } 
            : t
          ));
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (selectedElement?.type === 'image') {
          setImageSettings(prev => ({
            ...prev,
            x: validateSize(prev.x + step, { min: 0, max: badgeSettings.width - prev.width })
          }));
        } else if (selectedElement?.type === 'text') {
          setTexts(prevTexts => prevTexts.map(t => 
            t.id === selectedElement.id 
            ? { ...t, x: validateSize(t.x + step, { min: 0, max: badgeSettings.width - 10 }) } 
            : t
          ));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (selectedElement?.type === 'image') {
          setImageSettings(prev => ({ 
            ...prev, 
            y: validateSize(prev.y - step, { min: 0, max: badgeSettings.height - prev.height })
          }));
        } else if (selectedElement?.type === 'text') {
          setTexts(prevTexts => prevTexts.map(t => 
            t.id === selectedElement.id 
            ? { ...t, y: validateSize(t.y - step, { min: 0, max: badgeSettings.height - 10 }) } 
            : t
          ));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedElement?.type === 'image') {
          setImageSettings(prev => ({
            ...prev,
            y: validateSize(prev.y + step, { min: 0, max: badgeSettings.height - prev.height })
          }));
        } else if (selectedElement?.type === 'text') {
          setTexts(prevTexts => prevTexts.map(t => 
            t.id === selectedElement.id 
            ? { ...t, y: validateSize(t.y + step, { min: 0, max: badgeSettings.height - 10 }) } 
            : t
          ));
        }
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selectedElement?.type === 'image') {
          setImageSettings(prev => ({ ...prev, src: null }));
          setSelectedElement(null);
          message.success('图片已删除');
        } else if (selectedElement?.type === 'hole') {
          setHoleSettings(prev => ({ ...prev, enabled: false }));
          setSelectedElement(null);
          message.success('穿孔已删除');
        } else if (selectedElement?.type === 'text') {
          setTexts(prev => prev.filter(t => t.id !== selectedElement.id));
          setSelectedElement(null);
          message.success('文字已删除');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSelectedElement(null);
        break;
    }
  }, [selectedElement, badgeSettings, setImageSettings, setTexts, setHoleSettings]);

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

  return {
    interactionState,
    selectedElement,
    setSelectedElement,
    startInteraction,
    handleDoubleClick,
    formatSize,
    validateSize
  };
};

export default useInteraction; 