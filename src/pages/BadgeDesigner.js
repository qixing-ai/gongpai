import React, { useState, useRef, useCallback } from 'react';
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
  // 工牌设置
  const [badgeSettings, setBadgeSettings] = useState({
    width: 63,
    height: 90,
    backgroundColor: '#ffffff',
    borderRadius: 20,
  });

  // 穿孔设置
  const [holeSettings, setHoleSettings] = useState({
    enabled: false,
    shape: 'circle',
    size: 6,
    offsetY: 3,
    width: 6,
    height: 4,
    borderRadius: 2,
  });

  // 图片设置
  const [imageSettings, setImageSettings] = useState({
    src: null,
    width: 30,
    height: 30,
    x: 17,
    y: 23,
    opacity: 1,
  });

  // 文字设置
  const [textSettings, setTextSettings] = useState({
    content: '张三\n技术部',
    fontSize: 1.5, // 以毫米为单位
    color: '#000000',
    fontFamily: 'Microsoft YaHei',
    x: 26,
    y: 68,
    lineHeight: 1.4,
  });

  // 拖拽状态
  const [dragState, setDragState] = useState({
    isDragging: false,
    dragType: null, // 'image' 或 'text'
    startX: 0,
    startY: 0,
    elementStartX: 0,
    elementStartY: 0,
  });

  // 选中状态
  const [selectedElement, setSelectedElement] = useState(null); // 'image' 或 'text'

  // 工牌尺寸拖拽状态
  const [resizeState, setResizeState] = useState({
    isResizing: false,
    resizeType: null, // 'width', 'height', 'corner'
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  // 图片尺寸拖拽状态
  const [imageResizeState, setImageResizeState] = useState({
    isResizing: false,
    resizeType: null, // 'width', 'height', 'corner'
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  // 穿孔拖拽状态
  const [holeResizeState, setHoleResizeState] = useState({
    isResizing: false,
    resizeType: null, // 'size', 'width', 'height', 'corner', 'position'
    startX: 0,
    startY: 0,
    startSize: 0,
    startWidth: 0,
    startHeight: 0,
    startOffsetY: 0,
  });

  const badgePreviewRef = useRef(null);

  // 处理图片上传
  const handleImageUpload = (info) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSettings(prev => ({
          ...prev,
          src: e.target.result
        }));
        message.success('图片上传成功');
      };
      reader.readAsDataURL(file);
    }
  };

  // 开始拖拽
  const handleMouseDown = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElement(type);
    
    setDragState({
      isDragging: true,
      dragType: type,
      startX: e.clientX,
      startY: e.clientY,
      elementStartX: type === 'image' ? imageSettings.x : textSettings.x,
      elementStartY: type === 'image' ? imageSettings.y : textSettings.y,
    });
  }, [imageSettings.x, imageSettings.y, textSettings.x, textSettings.y]);

  // 双击编辑文字
  const handleDoubleClick = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'text') {
      // 可以在这里添加内联编辑功能
      message.info('双击文字可快速编辑（功能开发中）');
    }
  }, []);



  // 开始调整工牌尺寸
  const handleResizeStart = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizeState({
      isResizing: true,
      resizeType: type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: badgeSettings.width,
      startHeight: badgeSettings.height,
    });
  }, [badgeSettings.width, badgeSettings.height]);

  // 调整工牌尺寸中
  const handleResizeMove = useCallback((e) => {
    if (!resizeState.isResizing) return;
    
    const scale = 4;
    const deltaX = (e.clientX - resizeState.startX) / scale;
    const deltaY = (e.clientY - resizeState.startY) / scale;
    
    let newWidth = resizeState.startWidth;
    let newHeight = resizeState.startHeight;
    
    switch (resizeState.resizeType) {
      case 'width':
        newWidth = Math.max(50, Math.min(120, resizeState.startWidth + deltaX));
        break;
      case 'height':
        newHeight = Math.max(30, Math.min(200, resizeState.startHeight + deltaY));
        break;
      case 'corner':
        newWidth = Math.max(50, Math.min(120, resizeState.startWidth + deltaX));
        newHeight = Math.max(30, Math.min(200, resizeState.startHeight + deltaY));
        break;
    }
    
    setBadgeSettings(prev => ({
      ...prev,
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    }));
  }, [resizeState]);

  // 结束调整工牌尺寸
  const handleResizeEnd = useCallback(() => {
    setResizeState({
      isResizing: false,
      resizeType: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
    });
  }, []);

  // 开始调整图片尺寸
  const handleImageResizeStart = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    setImageResizeState({
      isResizing: true,
      resizeType: type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: imageSettings.width,
      startHeight: imageSettings.height,
    });
  }, [imageSettings.width, imageSettings.height]);

  // 调整图片尺寸中
  const handleImageResizeMove = useCallback((e) => {
    if (!imageResizeState.isResizing) return;
    
    const scale = 4;
    const deltaX = (e.clientX - imageResizeState.startX) / scale;
    const deltaY = (e.clientY - imageResizeState.startY) / scale;
    
    let newWidth = imageResizeState.startWidth;
    let newHeight = imageResizeState.startHeight;
    
    switch (imageResizeState.resizeType) {
      case 'width':
        newWidth = Math.max(10, Math.min(80, imageResizeState.startWidth + deltaX));
        break;
      case 'height':
        newHeight = Math.max(10, Math.min(80, imageResizeState.startHeight + deltaY));
        break;
      case 'corner':
        newWidth = Math.max(10, Math.min(80, imageResizeState.startWidth + deltaX));
        newHeight = Math.max(10, Math.min(80, imageResizeState.startHeight + deltaY));
        break;
    }
    
    setImageSettings(prev => ({
      ...prev,
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    }));
  }, [imageResizeState]);

  // 结束调整图片尺寸
  const handleImageResizeEnd = useCallback(() => {
    setImageResizeState({
      isResizing: false,
      resizeType: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
    });
  }, []);

  // 开始调整穿孔尺寸
  const handleHoleResizeStart = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    
    setHoleResizeState({
      isResizing: true,
      resizeType: type,
      startX: e.clientX,
      startY: e.clientY,
      startSize: holeSettings.size,
      startWidth: holeSettings.width,
      startHeight: holeSettings.height,
      startOffsetY: holeSettings.offsetY,
    });
  }, [holeSettings.size, holeSettings.width, holeSettings.height, holeSettings.offsetY]);

  // 调整穿孔尺寸中
  const handleHoleResizeMove = useCallback((e) => {
    if (!holeResizeState.isResizing) return;
    
    const scale = 4;
    const deltaX = (e.clientX - holeResizeState.startX) / scale;
    const deltaY = (e.clientY - holeResizeState.startY) / scale;
    
    switch (holeResizeState.resizeType) {
      case 'size':
        const newSize = Math.max(3, Math.min(15, holeResizeState.startSize + deltaX));
        setHoleSettings(prev => ({ ...prev, size: Math.round(newSize * 2) / 2 }));
        break;
      case 'width':
        const newWidth = Math.max(3, Math.min(20, holeResizeState.startWidth + deltaX));
        setHoleSettings(prev => ({ ...prev, width: Math.round(newWidth * 2) / 2 }));
        break;
      case 'height':
        const newHeight = Math.max(2, Math.min(15, holeResizeState.startHeight + deltaY));
        setHoleSettings(prev => ({ ...prev, height: Math.round(newHeight * 2) / 2 }));
        break;
      case 'corner':
        const newCornerWidth = Math.max(3, Math.min(20, holeResizeState.startWidth + deltaX));
        const newCornerHeight = Math.max(2, Math.min(15, holeResizeState.startHeight + deltaY));
        setHoleSettings(prev => ({ 
          ...prev, 
          width: Math.round(newCornerWidth * 2) / 2,
          height: Math.round(newCornerHeight * 2) / 2
        }));
        break;
      case 'position':
        const newOffsetY = Math.max(3, Math.min(20, holeResizeState.startOffsetY + deltaY));
        setHoleSettings(prev => ({ ...prev, offsetY: Math.round(newOffsetY * 2) / 2 }));
        break;
    }
  }, [holeResizeState]);

  // 结束调整穿孔尺寸
  const handleHoleResizeEnd = useCallback(() => {
    setHoleResizeState({
      isResizing: false,
      resizeType: null,
      startX: 0,
      startY: 0,
      startSize: 0,
      startWidth: 0,
      startHeight: 0,
      startOffsetY: 0,
    });
  }, []);

  // 拖拽中
  const handleMouseMove = useCallback((e) => {
    if (!dragState.isDragging) return;
    
    const scale = 4;
    const deltaX = (e.clientX - dragState.startX) / scale;
    const deltaY = (e.clientY - dragState.startY) / scale;
    
    const newX = Math.max(0, Math.min(
      badgeSettings.width - (dragState.dragType === 'image' ? imageSettings.width : 20),
      dragState.elementStartX + deltaX
    ));
    const newY = Math.max(0, Math.min(
      badgeSettings.height - (dragState.dragType === 'image' ? imageSettings.height : 20),
      dragState.elementStartY + deltaY
    ));

    if (dragState.dragType === 'image') {
      setImageSettings(prev => ({
        ...prev,
        x: Math.round(newX),
        y: Math.round(newY)
      }));
    } else if (dragState.dragType === 'text') {
      setTextSettings(prev => ({
        ...prev,
        x: Math.round(newX),
        y: Math.round(newY)
      }));
    }
  }, [dragState, badgeSettings.width, badgeSettings.height, imageSettings.width, imageSettings.height]);

  // 结束拖拽
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      dragType: null,
      startX: 0,
      startY: 0,
      elementStartX: 0,
      elementStartY: 0,
    });
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e) => {
    if (!selectedElement) return;
    
    const step = e.shiftKey ? 5 : 1; // Shift + 方向键移动5mm，否则1mm
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            x: Math.max(0, prev.x - step)
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            x: Math.max(0, prev.x - step)
          }));
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            x: Math.min(badgeSettings.width - prev.width, prev.x + step)
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            x: Math.min(badgeSettings.width - 20, prev.x + step)
          }));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            y: Math.max(0, prev.y - step)
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            y: Math.max(0, prev.y - step)
          }));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedElement === 'image') {
          setImageSettings(prev => ({
            ...prev,
            y: Math.min(badgeSettings.height - prev.height, prev.y + step)
          }));
        } else if (selectedElement === 'text') {
          setTextSettings(prev => ({
            ...prev,
            y: Math.min(badgeSettings.height - 20, prev.y + step)
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
  }, [selectedElement, badgeSettings.width, badgeSettings.height]);

  // 添加全局事件监听
  React.useEffect(() => {
    const isDraggingOrResizing = dragState.isDragging || resizeState.isResizing || imageResizeState.isResizing || holeResizeState.isResizing;
    
    if (isDraggingOrResizing) {
      if (dragState.isDragging) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
      if (resizeState.isResizing) {
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
      }
      if (imageResizeState.isResizing) {
        document.addEventListener('mousemove', handleImageResizeMove);
        document.addEventListener('mouseup', handleImageResizeEnd);
      }
      if (holeResizeState.isResizing) {
        document.addEventListener('mousemove', handleHoleResizeMove);
        document.addEventListener('mouseup', handleHoleResizeEnd);
      }
      
      let cursor = '';
      if (dragState.isDragging) cursor = 'grabbing';
      else if (resizeState.isResizing) cursor = 'nw-resize';
      else if (imageResizeState.isResizing) {
        switch (imageResizeState.resizeType) {
          case 'width': cursor = 'ew-resize'; break;
          case 'height': cursor = 'ns-resize'; break;
          case 'corner': cursor = 'nw-resize'; break;
          default: cursor = 'nw-resize';
        }
      }
      else if (holeResizeState.isResizing) {
        switch (holeResizeState.resizeType) {
          case 'size': cursor = 'ew-resize'; break;
          case 'width': cursor = 'ew-resize'; break;
          case 'height': cursor = 'ns-resize'; break;
          case 'corner': cursor = 'nw-resize'; break;
          case 'position': cursor = 'ns-resize'; break;
          default: cursor = 'nw-resize';
        }
      }
      
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('mousemove', handleImageResizeMove);
      document.removeEventListener('mouseup', handleImageResizeEnd);
      document.removeEventListener('mousemove', handleHoleResizeMove);
      document.removeEventListener('mouseup', handleHoleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('mousemove', handleImageResizeMove);
      document.removeEventListener('mouseup', handleImageResizeEnd);
      document.removeEventListener('mousemove', handleHoleResizeMove);
      document.removeEventListener('mouseup', handleHoleResizeEnd);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragState.isDragging, resizeState.isResizing, imageResizeState.isResizing, holeResizeState.isResizing, handleMouseMove, handleMouseUp, handleResizeMove, handleResizeEnd, handleImageResizeMove, handleImageResizeEnd, handleHoleResizeMove, handleHoleResizeEnd, handleKeyDown]);

  // 渲染工牌预览
  const renderBadgePreview = () => {
    const scale = 4;
    const badgeWidth = badgeSettings.width * scale;
    const badgeHeight = badgeSettings.height * scale;

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div
          ref={badgePreviewRef}
          style={{
            width: badgeWidth,
            height: badgeHeight,
            backgroundColor: badgeSettings.backgroundColor,
            borderRadius: badgeSettings.borderRadius,
            position: 'relative',
            border: selectedElement === 'badge' ? '2px solid #1890ff' : '1px solid #d9d9d9',
            margin: '20px auto',
            overflow: 'visible',
            boxShadow: selectedElement === 'badge' ? '0 0 8px rgba(24, 144, 255, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            cursor: dragState.isDragging ? 'grabbing' : 'pointer',
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
              top: holeSettings.offsetY * scale,
              left: '50%',
              transform: 'translateX(-50%)',
              width: holeSettings.shape === 'rectangle' ? holeSettings.width * scale : holeSettings.size * scale,
              height: holeSettings.shape === 'rectangle' ? holeSettings.height * scale : holeSettings.size * scale,
              backgroundColor: 'white',
              border: selectedElement === 'hole' ? '2px solid #52c41a' : '2px solid #999',
              borderRadius: holeSettings.shape === 'circle' ? '50%' : 
                          holeSettings.shape === 'oval' ? '50%' : 
                          holeSettings.shape === 'rectangle' ? holeSettings.borderRadius * scale : '2px',
              cursor: 'pointer',
              boxShadow: selectedElement === 'hole' ? '0 0 8px rgba(82, 196, 26, 0.3)' : 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedElement('hole');
            }}
          >
            {/* 穿孔调整手柄 - 只在选中时显示 */}
            {selectedElement === 'hole' && (
              <>
                {holeSettings.shape === 'rectangle' ? (
                  <>
                    {/* 右侧宽度调整手柄 */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: -5,
                        transform: 'translateY(-50%)',
                        width: 8,
                        height: 16,
                        backgroundColor: '#52c41a',
                        borderRadius: 2,
                        cursor: 'ew-resize',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '6px',
                        transition: 'opacity 0.2s',
                        zIndex: 10,
                      }}
                      onMouseDown={(e) => handleHoleResizeStart(e, 'width')}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.8}
                      title="拖拽调整宽度"
                    >
                      ↔
                    </div>
                    
                    {/* 底部高度调整手柄 */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -5,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 16,
                        height: 8,
                        backgroundColor: '#52c41a',
                        borderRadius: 2,
                        cursor: 'ns-resize',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '6px',
                        transition: 'opacity 0.2s',
                        zIndex: 10,
                      }}
                      onMouseDown={(e) => handleHoleResizeStart(e, 'height')}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.8}
                      title="拖拽调整高度"
                    >
                      ↕
                    </div>
                    
                    {/* 右下角双向调整手柄 */}
                    <div
                      style={{
                        position: 'absolute',
                        right: -5,
                        bottom: -5,
                        width: 10,
                        height: 10,
                        backgroundColor: '#52c41a',
                        borderRadius: 2,
                        cursor: 'nw-resize',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '6px',
                        transition: 'opacity 0.2s',
                        zIndex: 10,
                      }}
                      onMouseDown={(e) => handleHoleResizeStart(e, 'corner')}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.8}
                      title="拖拽同时调整宽度和高度"
                    >
                      ⤡
                    </div>
                  </>
                ) : (
                  /* 圆形和椭圆的尺寸调整手柄 */
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: -5,
                      transform: 'translateY(-50%)',
                      width: 8,
                      height: 16,
                      backgroundColor: '#52c41a',
                      borderRadius: 2,
                      cursor: 'ew-resize',
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '6px',
                      transition: 'opacity 0.2s',
                      zIndex: 10,
                    }}
                    onMouseDown={(e) => handleHoleResizeStart(e, 'size')}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.8}
                    title="拖拽调整大小"
                  >
                    ↔
                  </div>
                )}
                
                {/* 垂直位置调整手柄 */}
                <div
                  style={{
                    position: 'absolute',
                    top: -15,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 8,
                    backgroundColor: '#fa8c16',
                    borderRadius: 2,
                    cursor: 'ns-resize',
                    opacity: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '6px',
                    transition: 'opacity 0.2s',
                    zIndex: 10,
                  }}
                  onMouseDown={(e) => handleHoleResizeStart(e, 'position')}
                  onMouseEnter={(e) => e.target.style.opacity = 1}
                  onMouseLeave={(e) => e.target.style.opacity = 0.8}
                  title="拖拽调整垂直位置"
                >
                  ↕
                </div>
              </>
            )}
          </div>
        )}

        {/* 图片 */}
        {imageSettings.src && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              style={{
                position: 'absolute',
                left: imageSettings.x * scale,
                top: imageSettings.y * scale,
                width: imageSettings.width * scale,
                height: imageSettings.height * scale,
                cursor: dragState.isDragging && dragState.dragType === 'image' ? 'grabbing' : 'grab',
                border: selectedElement === 'image' ? '2px solid #1890ff' : 
                       (dragState.dragType === 'image' && dragState.isDragging ? '2px dashed #1890ff' : '2px solid transparent'),
                borderRadius: '4px',
                boxShadow: selectedElement === 'image' ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
              }}
              onMouseDown={(e) => handleMouseDown(e, 'image')}
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
              
              {/* 图片尺寸调整手柄 - 只在选中时显示 */}
              {selectedElement === 'image' && (
                <>
                  {/* 右侧宽度调整手柄 */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -5,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 10,
                      height: 20,
                      backgroundColor: '#1890ff',
                      borderRadius: 3,
                      cursor: 'ew-resize',
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '6px',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseDown={(e) => handleImageResizeStart(e, 'width')}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.8}
                    title="拖拽调整宽度"
                  >
                    ↔
                  </div>
                  
                  {/* 底部高度调整手柄 */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -5,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 20,
                      height: 10,
                      backgroundColor: '#1890ff',
                      borderRadius: 3,
                      cursor: 'ns-resize',
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '6px',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseDown={(e) => handleImageResizeStart(e, 'height')}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.8}
                    title="拖拽调整高度"
                  >
                    ↕
                  </div>
                  
                  {/* 右下角双向调整手柄 */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -5,
                      bottom: -5,
                      width: 12,
                      height: 12,
                      backgroundColor: '#1890ff',
                      borderRadius: 2,
                      cursor: 'nw-resize',
                      opacity: 0.8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '6px',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseDown={(e) => handleImageResizeStart(e, 'corner')}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.8}
                    title="拖拽同时调整宽度和高度"
                  >
                    ⤡
                  </div>
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
                  opacity: dragState.dragType === 'image' && dragState.isDragging ? 1 : 0,
                  transition: 'opacity 0.2s',
                  pointerEvents: 'none',
                }}
              >
                拖拽调整位置
              </div>
            </div>
          </div>
        )}

        {/* 文字 */}
        <div
          style={{
            position: 'absolute',
            left: textSettings.x * scale,
            top: textSettings.y * scale,
            cursor: dragState.isDragging && dragState.dragType === 'text' ? 'grabbing' : 'grab',
            border: selectedElement === 'text' ? '2px solid #1890ff' :
                   (dragState.dragType === 'text' && dragState.isDragging ? '2px dashed #1890ff' : '2px solid transparent'),
            borderRadius: '4px',
            padding: '2px',
            minWidth: '20px',
            minHeight: '20px',
            boxShadow: selectedElement === 'text' ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
          }}
          onMouseDown={(e) => handleMouseDown(e, 'text')}
          onDoubleClick={(e) => handleDoubleClick(e, 'text')}
        >
          <div
            style={{
              fontSize: textSettings.fontSize * scale * 2.5, // 调整转换比例
              color: textSettings.color,
              fontFamily: textSettings.fontFamily,
              lineHeight: textSettings.lineHeight,
              whiteSpace: 'pre-line',
              maxWidth: (badgeSettings.width - textSettings.x - 5) * scale,
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
              opacity: dragState.dragType === 'text' && dragState.isDragging ? 1 : 0,
              transition: 'opacity 0.2s',
              pointerEvents: 'none',
            }}
          >
            拖拽调整位置
          </div>
        </div>
        </div>
        
        {/* 工牌调整手柄 - 只在选中工牌时显示 */}
        {selectedElement === 'badge' && (
          <>
            {/* 右侧宽度调整手柄 */}
            <div
              style={{
                position: 'absolute',
                right: -5,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 10,
                height: 40,
                backgroundColor: '#1890ff',
                borderRadius: 5,
                cursor: 'ew-resize',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '8px',
                transition: 'opacity 0.2s',
              }}
              onMouseDown={(e) => handleResizeStart(e, 'width')}
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0.7}
              title="拖拽调整宽度"
            >
              ↔
            </div>
            
            {/* 底部高度调整手柄 */}
            <div
              style={{
                position: 'absolute',
                bottom: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 40,
                height: 10,
                backgroundColor: '#1890ff',
                borderRadius: 5,
                cursor: 'ns-resize',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '8px',
                transition: 'opacity 0.2s',
              }}
              onMouseDown={(e) => handleResizeStart(e, 'height')}
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0.7}
              title="拖拽调整高度"
            >
              ↕
            </div>
            
            {/* 右下角双向调整手柄 */}
            <div
              style={{
                position: 'absolute',
                right: -5,
                bottom: -5,
                width: 15,
                height: 15,
                backgroundColor: '#1890ff',
                borderRadius: 3,
                cursor: 'nw-resize',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '8px',
                transition: 'opacity 0.2s',
              }}
              onMouseDown={(e) => handleResizeStart(e, 'corner')}
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0.7}
              title="拖拽同时调整宽度和高度"
            >
              ⤡
            </div>
          </>
        )}
      </div>
    );
  };

  // 导出工牌
  const exportBadge = () => {
    message.success('工牌导出功能开发中...');
  };

  // 重置设计
  const resetDesign = () => {
    setBadgeSettings({
      width: 63,
      height: 90,
      backgroundColor: '#ffffff',
      borderRadius: 20,
    });
    setHoleSettings({
      enabled: false,
      shape: 'circle',
      size: 6,
      offsetY: 3,
      width: 6,
      height: 4,
      borderRadius: 2,
    });
    setImageSettings({
      src: null,
      width: 30,
      height: 30,
      x: 17,
      y: 23,
      opacity: 1,
    });
    setTextSettings({
      content: '张三\n技术部',
      fontSize: 1.5,
      color: '#000000',
      fontFamily: 'Microsoft YaHei',
      x: 26,
      y: 68,
      lineHeight: 1.4,
    });
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
              导出工牌
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
                  <Text>宽度: {badgeSettings.width}mm</Text>
                  <Slider
                    min={50}
                    max={120}
                    value={badgeSettings.width}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, width: value }))}
                  />
                </div>
                <div>
                  <Text>高度: {badgeSettings.height}mm</Text>
                  <Slider
                    min={30}
                    max={200}
                    value={badgeSettings.height}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, height: value }))}
                  />
                </div>
                <div>
                  <Text>圆角: {badgeSettings.borderRadius}px</Text>
                  <Slider
                    min={0}
                    max={20}
                    value={badgeSettings.borderRadius}
                    onChange={(value) => setBadgeSettings(prev => ({ ...prev, borderRadius: value }))}
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
                            <Text>宽度: {holeSettings.width}mm</Text>
                            <Slider
                              min={3}
                              max={20}
                              value={holeSettings.width}
                              onChange={(value) => setHoleSettings(prev => ({ ...prev, width: value }))}
                            />
                          </Col>
                          <Col span={12}>
                            <Text>高度: {holeSettings.height}mm</Text>
                            <Slider
                              min={2}
                              max={15}
                              value={holeSettings.height}
                              onChange={(value) => setHoleSettings(prev => ({ ...prev, height: value }))}
                            />
                          </Col>
                        </Row>
                        <div>
                          <Text>倒角: {holeSettings.borderRadius}mm</Text>
                          <Slider
                            min={0}
                            max={Math.min(holeSettings.width, holeSettings.height) / 2}
                            step={0.5}
                            value={holeSettings.borderRadius}
                            onChange={(value) => setHoleSettings(prev => ({ ...prev, borderRadius: value }))}
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <Text>大小: {holeSettings.size}mm</Text>
                        <Slider
                          min={3}
                          max={15}
                          value={holeSettings.size}
                          onChange={(value) => setHoleSettings(prev => ({ ...prev, size: value }))}
                        />
                      </div>
                    )}
                    
                    <div>
                      <Text>垂直偏移: {holeSettings.offsetY}mm</Text>
                      <Slider
                        min={3}
                        max={20}
                        value={holeSettings.offsetY}
                        onChange={(value) => setHoleSettings(prev => ({ ...prev, offsetY: value }))}
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
                          min={10}
                          max={80}
                          value={imageSettings.width}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, width: value }))}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Text>高度(mm)</Text>
                        <InputNumber
                          min={10}
                          max={80}
                          value={imageSettings.height}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, height: value }))}
                          style={{ width: '100%' }}
                        />
                      </Col>
                    </Row>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text>X位置(mm)</Text>
                        <InputNumber
                          min={0}
                          max={badgeSettings.width - 10}
                          value={imageSettings.x}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, x: value }))}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Text>Y位置(mm)</Text>
                        <InputNumber
                          min={0}
                          max={badgeSettings.height - 10}
                          value={imageSettings.y}
                          onChange={(value) => setImageSettings(prev => ({ ...prev, y: value }))}
                          style={{ width: '100%' }}
                        />
                      </Col>
                    </Row>
                    <div>
                      <Text>透明度: {Math.round(imageSettings.opacity * 100)}%</Text>
                      <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        value={imageSettings.opacity}
                        onChange={(value) => setImageSettings(prev => ({ ...prev, opacity: value }))}
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
                      实际尺寸: {badgeSettings.width}mm × {badgeSettings.height}mm
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      💡 提示：点击选中元素显示调整手柄 • 拖拽调整尺寸和位置 • 方向键微调 • Delete删除 • Esc取消选中
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
                      <Text>字号: {textSettings.fontSize}mm</Text>
                      <Slider
                        min={1}
                        max={4}
                        step={0.25}
                        value={textSettings.fontSize}
                        onChange={(value) => setTextSettings(prev => ({ ...prev, fontSize: value }))}
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
                    <Text>位置 X: {textSettings.x}mm</Text>
                    <Slider
                      min={0}
                      max={badgeSettings.width - 10}
                      value={textSettings.x}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, x: value }))}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>位置 Y: {textSettings.y}mm</Text>
                    <Slider
                      min={0}
                      max={badgeSettings.height - 10}
                      value={textSettings.y}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, y: value }))}
                      size="small"
                    />
                  </div>
                  <div>
                    <Text>行高: {textSettings.lineHeight}</Text>
                    <Slider
                      min={1}
                      max={2}
                      step={0.1}
                      value={textSettings.lineHeight}
                      onChange={(value) => setTextSettings(prev => ({ ...prev, lineHeight: value }))}
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