import React, { useRef, useCallback } from 'react';
import { Card, Space, Typography, Divider, message } from 'antd';

const { Text } = Typography;

const BadgePreview = ({
  badgeSettings,
  holeSettings,
  imageSettings,
  textSettings,
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

  return (
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
  );
};

export default BadgePreview; 