import React, { useEffect } from 'react';
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
  useEffect(() => {
    if (imageSettings.src && !imageSettings.aspectRatio) {
      const img = new window.Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setImageSettings(prev => ({
          ...prev,
          height: formatSize(prev.width / aspectRatio),
          aspectRatio: aspectRatio,
        }));
      };
      img.src = imageSettings.src;
    }
  }, [imageSettings.src, imageSettings.aspectRatio, setImageSettings, formatSize]);

  const handleWidthChange = (value) => {
    const newWidth = formatSize(value || 0);
    setImageSettings(prev => {
      const newSettings = { ...prev, width: newWidth };
      if (prev.aspectRatio) {
        newSettings.height = formatSize(newWidth / prev.aspectRatio);
      }
      return newSettings;
    });
  };

  const handleHeightChange = (value) => {
    const newHeight = formatSize(value || 0);
    setImageSettings(prev => {
      const newSettings = { ...prev, height: newHeight };
      if (prev.aspectRatio) {
        newSettings.width = formatSize(newHeight * prev.aspectRatio);
      }
      return newSettings;
    });
  };

  // 处理图片上传
  const handleImageUpload = (info) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imgSrc = e.target.result;
        const img = new window.Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const newWidth = 30; // Default width in mm
          setImageSettings(prev => ({
            ...prev,
            src: imgSrc,
            width: newWidth,
            height: formatSize(newWidth / aspectRatio),
            aspectRatio,
          }));
          message.success('图片上传成功');
        };
        img.src = imgSrc;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card 
      title="工牌设置" 
      size="small"
      style={{ height: '100%', overflowY: 'auto' }}
      styles={{ body: { padding: '8px' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={2}>
        {/* 工牌尺寸设置 */}
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>工牌尺寸</Text>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>宽度</Text></Col>
              <Col span={14}>
                <Slider
                  min={UNIT_CONFIG.BADGE.WIDTH.min}
                  max={UNIT_CONFIG.BADGE.WIDTH.max}
                  step={UNIT_CONFIG.BADGE.WIDTH.step}
                  value={badgeSettings.width}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, width: formatSize(value) }))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.BADGE.WIDTH.min}
                  max={UNIT_CONFIG.BADGE.WIDTH.max}
                  step={UNIT_CONFIG.BADGE.WIDTH.step}
                  value={badgeSettings.width}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, width: formatSize(value || 0) }))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>高度</Text></Col>
              <Col span={14}>
                <Slider
                  min={UNIT_CONFIG.BADGE.HEIGHT.min}
                  max={UNIT_CONFIG.BADGE.HEIGHT.max}
                  step={UNIT_CONFIG.BADGE.HEIGHT.step}
                  value={badgeSettings.height}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, height: formatSize(value) }))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.BADGE.HEIGHT.min}
                  max={UNIT_CONFIG.BADGE.HEIGHT.max}
                  step={UNIT_CONFIG.BADGE.HEIGHT.step}
                  value={badgeSettings.height}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, height: formatSize(value || 0) }))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>圆角</Text></Col>
              <Col span={14}>
                <Slider
                  min={UNIT_CONFIG.BADGE.BORDER_RADIUS.min}
                  max={UNIT_CONFIG.BADGE.BORDER_RADIUS.max}
                  step={UNIT_CONFIG.BADGE.BORDER_RADIUS.step}
                  value={badgeSettings.borderRadius}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, borderRadius: formatSize(value) }))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.BADGE.BORDER_RADIUS.min}
                  max={UNIT_CONFIG.BADGE.BORDER_RADIUS.max}
                  step={UNIT_CONFIG.BADGE.BORDER_RADIUS.step}
                  value={badgeSettings.borderRadius}
                  onChange={(value) => setBadgeSettings(prev => ({ ...prev, borderRadius: formatSize(value || 0) }))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={6}><Text>背景颜色</Text></Col>
              <Col span={18}>
                <ColorPicker
                  value={badgeSettings.backgroundColor}
                  onChange={(color) => setBadgeSettings(prev => ({ ...prev, backgroundColor: color.toHexString() }))}
                  style={{ width: '100%' }}
                  size="small"
                />
              </Col>
            </Row>
          </Space>
        </div>

        {/* 穿孔设置 */}
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>穿孔设置</Text>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
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
                <Row align="middle" gutter={8}>
                  <Col span={4}><Text>形状</Text></Col>
                  <Col span={20}>
                    <Select
                      value={holeSettings.shape}
                      onChange={(value) => setHoleSettings(prev => ({ ...prev, shape: value }))}
                      style={{ width: '100%' }}
                      size="small"
                    >
                      <Select.Option value="circle">圆形</Select.Option>
                      <Select.Option value="rectangle">矩形</Select.Option>
                    </Select>
                  </Col>
                </Row>
                
                {holeSettings.shape === 'rectangle' ? (
                  <>
                    <Row gutter={8} align="middle">
                      <Col span={12}>
                        <Row align="middle" gutter={8}>
                          <Col span={8}><Text>宽度</Text></Col>
                          <Col span={16}>
                            <Slider
                              min={UNIT_CONFIG.HOLE.WIDTH.min}
                              max={UNIT_CONFIG.HOLE.WIDTH.max}
                              step={UNIT_CONFIG.HOLE.WIDTH.step}
                              value={holeSettings.width}
                              onChange={(value) => setHoleSettings(prev => ({ ...prev, width: formatSize(value) }))}
                              size="small"
                            />
                          </Col>
                        </Row>
                      </Col>
                      <Col span={12}>
                        <InputNumber
                            min={UNIT_CONFIG.HOLE.WIDTH.min}
                            max={UNIT_CONFIG.HOLE.WIDTH.max}
                            step={UNIT_CONFIG.HOLE.WIDTH.step}
                            value={holeSettings.width}
                            onChange={(value) => setHoleSettings(prev => ({ ...prev, width: formatSize(value || 0) }))}
                            size="small"
                            style={{ width: '100%' }}
                          />
                      </Col>
                    </Row>
                    <Row gutter={8} align="middle">
                      <Col span={12}>
                        <Row align="middle" gutter={8}>
                          <Col span={8}><Text>高度</Text></Col>
                          <Col span={16}>
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
                      </Col>
                      <Col span={12}>
                        <InputNumber
                          min={UNIT_CONFIG.HOLE.HEIGHT.min}
                          max={UNIT_CONFIG.HOLE.HEIGHT.max}
                          step={UNIT_CONFIG.HOLE.HEIGHT.step}
                          value={holeSettings.height}
                          onChange={(value) => setHoleSettings(prev => ({ ...prev, height: formatSize(value || 0) }))}
                          size="small"
                          style={{ width: '100%' }}
                        />
                      </Col>
                    </Row>
                    <Row align="middle" gutter={8}>
                      <Col span={4}><Text>倒角</Text></Col>
                      <Col span={14}>
                        <Slider
                          min={UNIT_CONFIG.HOLE.BORDER_RADIUS.min}
                          max={Math.min(holeSettings.width, holeSettings.height) / 2}
                          step={UNIT_CONFIG.HOLE.BORDER_RADIUS.step}
                          value={holeSettings.borderRadius}
                          onChange={(value) => setHoleSettings(prev => ({ ...prev, borderRadius: formatSize(value) }))}
                          size="small"
                        />
                      </Col>
                      <Col span={6}>
                        <InputNumber
                          min={UNIT_CONFIG.HOLE.BORDER_RADIUS.min}
                          max={Math.min(holeSettings.width, holeSettings.height) / 2}
                          step={UNIT_CONFIG.HOLE.BORDER_RADIUS.step}
                          value={holeSettings.borderRadius}
                          onChange={(value) => setHoleSettings(prev => ({ ...prev, borderRadius: formatSize(value || 0) }))}
                          size="small"
                          style={{ width: '100%' }}
                        />
                      </Col>
                    </Row>
                  </>
                ) : (
                  <Row align="middle" gutter={8}>
                    <Col span={4}><Text>大小</Text></Col>
                    <Col span={14}>
                      <Slider
                        min={UNIT_CONFIG.HOLE.SIZE.min}
                        max={UNIT_CONFIG.HOLE.SIZE.max}
                        step={UNIT_CONFIG.HOLE.SIZE.step}
                        value={holeSettings.size}
                        onChange={(value) => setHoleSettings(prev => ({ ...prev, size: formatSize(value) }))}
                        size="small"
                      />
                    </Col>
                    <Col span={6}>
                      <InputNumber
                        min={UNIT_CONFIG.HOLE.SIZE.min}
                        max={UNIT_CONFIG.HOLE.SIZE.max}
                        step={UNIT_CONFIG.HOLE.SIZE.step}
                        value={holeSettings.size}
                        onChange={(value) => setHoleSettings(prev => ({ ...prev, size: formatSize(value || 0) }))}
                        size="small"
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                )}
                
                <Row align="middle" gutter={8}>
                  <Col span={6}><Text>垂直偏移</Text></Col>
                  <Col span={12}>
                    <Slider
                      min={UNIT_CONFIG.HOLE.OFFSET_Y.min}
                      max={UNIT_CONFIG.HOLE.OFFSET_Y.max}
                      step={UNIT_CONFIG.HOLE.OFFSET_Y.step}
                      value={holeSettings.offsetY}
                      onChange={(value) => setHoleSettings(prev => ({ ...prev, offsetY: formatSize(value) }))}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={UNIT_CONFIG.HOLE.OFFSET_Y.min}
                      max={UNIT_CONFIG.HOLE.OFFSET_Y.max}
                      step={UNIT_CONFIG.HOLE.OFFSET_Y.step}
                      value={holeSettings.offsetY}
                      onChange={(value) => setHoleSettings(prev => ({ ...prev, offsetY: formatSize(value || 0) }))}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  </Col>
                </Row>
              </>
            )}
          </Space>
        </div>

        {/* 图片设置 */}
        <div>
          <Text strong style={{ fontSize: '13px', marginBottom: 4, display: 'block' }}>图片设置</Text>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
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
                <Row align="middle" gutter={8}>
                  <Col span={6}><Text>宽度</Text></Col>
                  <Col span={12}>
                    <Slider
                      min={UNIT_CONFIG.IMAGE.SIZE.min}
                      max={UNIT_CONFIG.IMAGE.SIZE.max}
                      step={UNIT_CONFIG.IMAGE.SIZE.step}
                      value={imageSettings.width}
                      onChange={handleWidthChange}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.SIZE.min}
                      max={UNIT_CONFIG.IMAGE.SIZE.max}
                      step={UNIT_CONFIG.IMAGE.SIZE.step}
                      value={imageSettings.width}
                      onChange={handleWidthChange}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Col>
                </Row>
                <Row align="middle" gutter={8}>
                  <Col span={6}><Text>高度</Text></Col>
                  <Col span={12}>
                    <Slider
                      min={UNIT_CONFIG.IMAGE.SIZE.min}
                      max={UNIT_CONFIG.IMAGE.SIZE.max}
                      step={UNIT_CONFIG.IMAGE.SIZE.step}
                      value={imageSettings.height}
                      onChange={handleHeightChange}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.SIZE.min}
                      max={UNIT_CONFIG.IMAGE.SIZE.max}
                      step={UNIT_CONFIG.IMAGE.SIZE.step}
                      value={imageSettings.height}
                      onChange={handleHeightChange}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Col>
                </Row>
                <Row align="middle" gutter={8}>
                  <Col span={6}><Text>位置 X</Text></Col>
                  <Col span={12}>
                    <Slider
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.width - imageSettings.width}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.x}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, x: formatSize(value) }))}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.width - imageSettings.width}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.x}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, x: formatSize(value || 0) }))}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Col>
                </Row>
                <Row align="middle" gutter={8}>
                  <Col span={6}><Text>位置 Y</Text></Col>
                  <Col span={12}>
                    <Slider
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.height - imageSettings.height}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.y}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, y: formatSize(value) }))}
                      size="small"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      min={UNIT_CONFIG.IMAGE.POSITION.min}
                      max={badgeSettings.height - imageSettings.height}
                      step={UNIT_CONFIG.IMAGE.POSITION.step}
                      value={imageSettings.y}
                      onChange={(value) => setImageSettings(prev => ({ ...prev, y: formatSize(value || 0) }))}
                      style={{ width: '100%' }}
                      size="small"
                    />
                  </Col>
                </Row>
              </>
            )}
          </Space>
        </div>
      </Space>
    </Card>
  );
};

export default BadgeSettings;