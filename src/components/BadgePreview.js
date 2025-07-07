import React, { useRef, useCallback } from 'react';
import { Card, Space, Typography, Divider, message } from 'antd';

const { Text } = Typography;

const BadgePreview = ({
  badgeSettings,
  holeSettings,
  imageSettings,
  texts,
  selectedElement,
  setSelectedElement,
  interactionState,
  startInteraction,
  handleDoubleClick,
  UNIT_CONFIG,
  formatSize
}) => {
  const badgePreviewRef = useRef(null);

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
            border: '2px solid transparent',
            outline: selectedElement?.type === 'badge' ? '2px solid #1890ff' : 'none',
            margin: '10px auto',
            overflow: 'visible',
            boxShadow: selectedElement?.type === 'badge' ? '0 0 8px rgba(24, 144, 255, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            cursor: interactionState.type === 'drag' ? 'grabbing' : 'pointer',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedElement({ type: 'badge' });
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
                border: selectedElement?.type === 'hole' ? '2px solid #52c41a' : '2px solid #999',
                borderRadius: holeSettings.shape === 'circle' ? '50%' : 
                            holeSettings.shape === 'oval' ? '50%' : 
                            holeSettings.shape === 'rectangle' ? holeSettings.borderRadius * UNIT_CONFIG.PREVIEW_SCALE + 'px' : '2px',
                cursor: 'pointer',
                boxShadow: selectedElement?.type === 'hole' ? '0 0 8px rgba(82, 196, 26, 0.3)' : 'none',
                zIndex: selectedElement?.type === 'hole' ? 2 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ type: 'hole' });
              }}
            >
              {/* 穿孔调整手柄 */}
              {selectedElement?.type === 'hole' && (
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
                cursor: interactionState.type === 'drag' && interactionState.element?.type === 'image' ? 'grabbing' : 'grab',
                border: selectedElement?.type === 'image' ? '2px solid #1890ff' : 
                       (interactionState.element?.type === 'image' && interactionState.type === 'drag' ? '2px dashed #1890ff' : '2px solid transparent'),
                borderRadius: '4px',
                boxShadow: selectedElement?.type === 'image' ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
                zIndex: selectedElement?.type === 'image' ? 2 : 1,
              }}
              onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: 'image' });
                  startInteraction(e, 'drag', { type: 'image' });
              }}
              onDoubleClick={(e) => handleDoubleClick(e, { type: 'image' })}
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
              {selectedElement?.type === 'image' && (
                <>
                  {renderResizeHandle('right center-y', 'width', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', { type: 'image' }, 'width'), '拖拽调整宽度')}
                  {renderResizeHandle('bottom center-x', 'height', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', { type: 'image' }, 'height'), '拖拽调整高度')}
                  {renderResizeHandle('right bottom', 'corner', '#1890ff',
                    (e) => startInteraction(e, 'resize-image', { type: 'image' }, 'corner'), '拖拽同时调整宽度和高度')}
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
                  opacity: interactionState.element?.type === 'image' && interactionState.type === 'drag' ? 1 : 0,
                  transition: 'opacity 0.2s',
                  pointerEvents: 'none',
                }}
              >
                拖拽调整位置
              </div>
            </div>
          )}

          {/* 文字 */}
          {texts.map(text => (
            <div
              key={text.id}
              style={{
                position: 'absolute',
                left: text.x * UNIT_CONFIG.PREVIEW_SCALE,
                top: text.y * UNIT_CONFIG.PREVIEW_SCALE,
                cursor: interactionState.type === 'drag' && interactionState.element?.id === text.id ? 'grabbing' : 'grab',
                border: selectedElement?.type === 'text' && selectedElement?.id === text.id 
                  ? '2px solid #1890ff' 
                  : (interactionState.element?.id === text.id && interactionState.type === 'drag' 
                    ? '2px dashed #1890ff' 
                    : '2px solid transparent'),
                borderRadius: '4px',
                padding: '2px',
                minWidth: '20px',
                minHeight: '20px',
                boxShadow: selectedElement?.type === 'text' && selectedElement?.id === text.id ? '0 0 8px rgba(24, 144, 255, 0.3)' : 'none',
                zIndex: selectedElement?.type === 'text' && selectedElement?.id === text.id ? 2 : 1, // bring selected to front
              }}
              onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedElement({ type: 'text', id: text.id });
                  startInteraction(e, 'drag', { type: 'text', id: text.id });
              }}
              onDoubleClick={(e) => handleDoubleClick(e, { type: 'text', id: text.id })}
            >
              <div
                style={{
                  fontSize: text.fontSize * UNIT_CONFIG.PREVIEW_SCALE,
                  color: text.color,
                  fontFamily: text.fontFamily,
                  lineHeight: text.lineHeight,
                  whiteSpace: 'pre-line',
                  maxWidth: (badgeSettings.width - text.x - 5) * UNIT_CONFIG.PREVIEW_SCALE,
                  textAlign: 'left',
                  pointerEvents: 'none',
                }}
              >
                {text.content}
              </div>
              {/* 拖拽提示 */}
              {selectedElement?.type === 'text' && selectedElement?.id === text.id && (
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
                    opacity: interactionState.element?.id === text.id && interactionState.type === 'drag' ? 1 : 0,
                    transition: 'opacity 0.2s',
                    pointerEvents: 'none',
                  }}
                >
                  拖拽调整位置
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Badge 调整手柄 */}
        {selectedElement?.type === 'badge' && (
          <div style={{
            position: 'absolute', 
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: badgeWidth, 
            height: badgeHeight,
            pointerEvents: 'none'
          }}>
            <div style={{position: 'relative', width: '100%', height: '100%', pointerEvents: 'auto'}}>
                {renderResizeHandle('right center-y', 'width', '#1890ff',
                  (e) => startInteraction(e, 'resize-badge', 'badge', 'width'), '拖拽调整宽度')}
                {renderResizeHandle('bottom center-x', 'height', '#1890ff',
                  (e) => startInteraction(e, 'resize-badge', 'badge', 'height'), '拖拽调整高度')}
                {renderResizeHandle('right bottom', 'corner', '#1890ff',
                  (e) => startInteraction(e, 'resize-badge', 'badge', 'corner'), '拖拽同时调整宽度和高度')}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card 
      title="工牌预览" 
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { padding: '8px' } }}
    >
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 'calc(100vh - 220px)',
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
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ textAlign: 'center' }}>
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            实际尺寸: {formatSize(badgeSettings.width)}mm × {formatSize(badgeSettings.height)}mm
          </Text>
          <Text type="secondary" style={{ fontSize: '10px' }}>
            📏 所有尺寸单位均为毫米(mm) • 预览放大{UNIT_CONFIG.PREVIEW_SCALE}倍显示
          </Text>
          <Text type="secondary" style={{ fontSize: '10px' }}>
            💡 提示：点击选中元素显示调整手柄 • 拖拽调整尺寸和位置
          </Text>
        </Space>
      </div>
    </Card>
  );
};

export default BadgePreview; 