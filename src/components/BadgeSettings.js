import React from 'react';
import { Card, Space, Slider, Select, Upload, Button, ColorPicker, Radio, Row, Col, InputNumber, Typography, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const { Text } = Typography;

const BadgeSettings = ({
  badgeSettings,
  setBadgeSettings,
  holeSettings,
  setHoleSettings,
  imageSettings,
  setImageSettings,
  setSelectedElement,
  UNIT_CONFIG,
  formatSize
}) => {
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

  return (
    <Card 
      title="工牌设置" 
      size="small"
      style={{ height: '100%', overflowY: 'auto' }}
      bodyStyle={{ padding: '8px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        {/* 工牌尺寸设置 */}
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>工牌尺寸</Text>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div>
              <Text>宽度: {formatSize(badgeSettings.width)}mm</Text>
              <Slider
                min={UNIT_CONFIG.BADGE.WIDTH.min}
                max={UNIT_CONFIG.BADGE.WIDTH.max}
                step={UNIT_CONFIG.BADGE.WIDTH.step}
                value={badgeSettings.width}
                onChange={(value) => setBadgeSettings(prev => ({ ...prev, width: formatSize(value) }))}
                size="small"
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
                size="small"
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
                size="small"
              />
            </div>
            <div>
              <Text>背景颜色</Text>
              <ColorPicker
                value={badgeSettings.backgroundColor}
                onChange={(color) => setBadgeSettings(prev => ({ ...prev, backgroundColor: color.toHexString() }))}
                style={{ width: '100%', marginTop: 4 }}
                size="small"
              />
            </div>
          </Space>
        </div>

        {/* 穿孔设置 */}
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>穿孔设置</Text>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
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
              size="small"
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
                    size="small"
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
                          size="small"
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
                          size="small"
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
                        size="small"
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
                      size="small"
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
                    size="small"
                  />
                </div>
              </>
            )}
          </Space>
        </div>

        {/* 图片设置 */}
        <div>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>图片设置</Text>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={() => false}
              onChange={handleImageUpload}
            >
              <Button icon={<UploadOutlined />} block size="small">
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
                      size="small"
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
                      size="small"
                      formatter={(value) => `${formatSize(value || 0)}`}
                      parser={(value) => parseFloat(value) || 0}
                    />
                  </Col>
                </Row>
                <Row gutter={8}>
                  <Col span={12}>
                    <Text>位置 X(mm)</Text>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.width - imageSettings.width}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.x}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, x: formatSize(value || 0) }))}
                      style={{ width: '100%' }}
                      size="small"
                      formatter={(value) => `${formatSize(value || 0)}`}
                      parser={(value) => parseFloat(value) || 0}
                    />
                  </Col>
                  <Col span={12}>
                    <Text>位置 Y(mm)</Text>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.height - imageSettings.height}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.y}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, y: formatSize(value || 0) }))}
                      style={{ width: '100%' }}
                      size="small"
                      formatter={(value) => `${formatSize(value || 0)}`}
                      parser={(value) => parseFloat(value) || 0}
                    />
                  </Col>
                </Row>
                <div>
                  <Text>透明度: {formatSize(imageSettings.opacity, 2)}</Text>
                  <Slider
                    min={UNIT_CONFIG.IMAGE.OPACITY.min}
                    max={UNIT_CONFIG.IMAGE.OPACITY.max}
                    step={UNIT_CONFIG.IMAGE.OPACITY.step}
                    value={imageSettings.opacity}
                    onChange={(value) => setImageSettings(prev => ({ ...prev, opacity: formatSize(value, 2) }))}
                    size="small"
                  />
                </div>
              </>
            )}
          </Space>
        </div>
      </Space>
    </Card>
  );
};

export default BadgeSettings;