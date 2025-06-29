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
  );
};

export default BadgeSettings; 