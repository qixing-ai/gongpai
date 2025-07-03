import React from 'react';
import { Card, Space, Slider, Select, ColorPicker, Input, Typography, Radio, Row, Col, InputNumber, Button, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TextSettings = ({
  texts,
  setTexts,
  badgeSettings,
  exportSettings,
  setExportSettings,
  selectedElement,
  setSelectedElement,
  UNIT_CONFIG,
  formatSize
}) => {

  const selectedText = texts.find(t => selectedElement && selectedElement.type === 'text' && t.id === selectedElement.id);

  const handleUpdate = (prop, value) => {
    if (!selectedText) return;
    const newTexts = texts.map(t =>
      t.id === selectedText.id ? { ...t, [prop]: value } : t
    );
    setTexts(newTexts);
  };

  const addText = () => {
    const newText = {
      id: `text-${Date.now()}`,
      content: '新文字',
      fontSize: 4,
      color: '#000000',
      fontFamily: 'Microsoft YaHei',
      x: badgeSettings.width / 2 - 10,
      y: badgeSettings.height / 2,
      lineHeight: 1.4,
    };
    const newTexts = [...texts, newText];
    setTexts(newTexts);
    setSelectedElement({ type: 'text', id: newText.id });
  };

  const deleteText = () => {
    if (!selectedText) return;
    const newTexts = texts.filter(t => t.id !== selectedText.id);
    setTexts(newTexts);
    setSelectedElement(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', height: '100%' }}>
      {/* 文字设置 */}
      <Card 
        title="文字设置" 
        size="small"
        style={{ flex: 1 }}
        styles={{ body: { padding: '8px' } }}
        extra={<Button icon={<PlusOutlined />} size="small" onClick={addText}>添加</Button>}
      >
        {selectedText ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div>
              <Text>文字内容</Text>
              <Input.TextArea
                value={selectedText.content}
                onChange={(e) => handleUpdate('content', e.target.value)}
                placeholder="输入文字内容"
                rows={3}
                style={{ marginTop: 4 }}
              />
            </div>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>字体</Text></Col>
              <Col span={20}>
                <Select
                  value={selectedText.fontFamily}
                  onChange={(value) => handleUpdate('fontFamily', value)}
                  style={{ width: '100%' }}
                  size="small"
                >
                  <Select.Option value="'Noto Sans SC', sans-serif">思源黑体</Select.Option>
                  <Select.Option value="'Noto Serif SC', serif">思源宋体</Select.Option>
                  <Select.Option value="'ZCOOL KuaiLe', cursive">站酷快乐体</Select.Option>
                  <Select.Option value="'ZCOOL XiaoWei', cursive">站酷小薇体</Select.Option>
                  <Select.Option value="'ZCOOL QingKe HuangYou', cursive">站酷黄油体</Select.Option>
                  <Select.Option value="'Ma Shan Zheng', cursive">马善政</Select.Option>
                  <Select.Option value="'Long Cang', cursive">龙藏体</Select.Option>
                  <Select.Option value="'Zhi Mang Xing', cursive">之芒行书</Select.Option>
                  <Select.Option value="'KaiTi', 'STKaiti', cursive">系统楷体</Select.Option>
                  <Select.Option value="'FangSong', 'STFangsong', serif">系统仿宋</Select.Option>
                  <Select.Option value="Arial, sans-serif">Arial</Select.Option>
                </Select>
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>字号</Text></Col>
              <Col span={14}>
                <Slider
                  min={UNIT_CONFIG.TEXT.FONT_SIZE.min}
                  max={UNIT_CONFIG.TEXT.FONT_SIZE.max}
                  step={UNIT_CONFIG.TEXT.FONT_SIZE.step}
                  value={selectedText.fontSize}
                  onChange={(value) => handleUpdate('fontSize', formatSize(value))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.TEXT.FONT_SIZE.min}
                  max={UNIT_CONFIG.TEXT.FONT_SIZE.max}
                  step={UNIT_CONFIG.TEXT.FONT_SIZE.step}
                  value={selectedText.fontSize}
                  onChange={(value) => handleUpdate('fontSize', formatSize(value || 0))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>颜色</Text></Col>
              <Col span={20}>
                <ColorPicker
                  value={selectedText.color}
                  onChange={(color) => handleUpdate('color', color.toHexString())}
                  style={{ width: '100%' }}
                  size="small"
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={5}><Text>位置 X</Text></Col>
              <Col span={13}>
                <Slider
                  min={UNIT_CONFIG.TEXT.POSITION.min}
                  max={badgeSettings.width}
                  step={UNIT_CONFIG.TEXT.POSITION.step}
                  value={selectedText.x}
                  onChange={(value) => handleUpdate('x', formatSize(value))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.TEXT.POSITION.min}
                  max={badgeSettings.width}
                  step={UNIT_CONFIG.TEXT.POSITION.step}
                  value={selectedText.x}
                  onChange={(value) => handleUpdate('x', formatSize(value || 0))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={5}><Text>位置 Y</Text></Col>
              <Col span={13}>
                <Slider
                  min={UNIT_CONFIG.TEXT.POSITION.min}
                  max={badgeSettings.height}
                  step={UNIT_CONFIG.TEXT.POSITION.step}
                  value={selectedText.y}
                  onChange={(value) => handleUpdate('y', formatSize(value))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.TEXT.POSITION.min}
                  max={badgeSettings.height}
                  step={UNIT_CONFIG.TEXT.POSITION.step}
                  value={selectedText.y}
                  onChange={(value) => handleUpdate('y', formatSize(value || 0))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Row align="middle" gutter={8}>
              <Col span={4}><Text>行高</Text></Col>
              <Col span={14}>
                <Slider
                  min={UNIT_CONFIG.TEXT.LINE_HEIGHT.min}
                  max={UNIT_CONFIG.TEXT.LINE_HEIGHT.max}
                  step={UNIT_CONFIG.TEXT.LINE_HEIGHT.step}
                  value={selectedText.lineHeight}
                  onChange={(value) => handleUpdate('lineHeight', formatSize(value, 1))}
                  size="small"
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  min={UNIT_CONFIG.TEXT.LINE_HEIGHT.min}
                  max={UNIT_CONFIG.TEXT.LINE_HEIGHT.max}
                  step={UNIT_CONFIG.TEXT.LINE_HEIGHT.step}
                  value={selectedText.lineHeight}
                  onChange={(value) => handleUpdate('lineHeight', formatSize(value, 1))}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={deleteText}
              size="small"
              style={{ width: '100%', marginTop: 8 }}
            >
              删除文字
            </Button>
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请在预览区选择一个文字框进行编辑，或添加一个新的文字框。">
          </Empty>
        )}
      </Card>

      {/* 导出设置 */}
      <Card 
        title="导出设置" 
        size="small"
        style={{ flex: 'none' }}
        styles={{ body: { padding: '8px' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div>
            <Text>模型类型</Text>
            <Radio.Group
              value={exportSettings.doubleSided}
              onChange={(e) => setExportSettings(prev => ({ ...prev, doubleSided: e.target.value }))}
              style={{ width: '100%', marginTop: 4 }}
              size="small"
            >
              <Radio value={true}>双面模型</Radio>
              <Radio value={false}>单面模型</Radio>
            </Radio.Group>
          </div>
          
          <Row align="middle" gutter={8}>
            <Col span={4}><Text>厚度</Text></Col>
            <Col span={14}>
              <Slider
                min={0.5}
                max={10.0}
                step={0.1}
                value={exportSettings.thickness}
                onChange={(value) => setExportSettings(prev => ({ ...prev, thickness: formatSize(value, 1) }))}
                size="small"
              />
            </Col>
            <Col span={6}>
              <InputNumber
                min={0.5}
                max={10.0}
                step={0.1}
                value={exportSettings.thickness}
                onChange={(value) => setExportSettings(prev => ({ ...prev, thickness: formatSize(value, 1) }))}
                size="small"
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
          
          <Row align="middle" gutter={8}>
            <Col span={6}><Text>网格密度</Text></Col>
            <Col span={12}>
              <Slider
                min={200}
                max={1500}
                step={100}
                value={exportSettings.meshDensity?.density || 500}
                onChange={(value) => setExportSettings(prev => ({
                  ...prev,
                  meshDensity: { density: value }
                }))}
                size="small"
              />
            </Col>
            <Col span={6}>
              <InputNumber
                  min={200}
                  max={1500}
                  step={100}
                  value={exportSettings.meshDensity?.density || 500}
                  onChange={(value) => setExportSettings(prev => ({
                    ...prev,
                    meshDensity: { density: value || 200 }
                  }))}
                  size="small"
                  style={{ width: '100%' }}
                />
            </Col>
          </Row>
          <Text style={{ fontSize: '11px', color: '#666' }}>
            密度越高，三角面越密集。较高密度(&gt;800)会增加文件大小和处理时间
          </Text>
          <Row align="middle" gutter={8}>
            <Col span={8}><Text>贴图分辨率</Text></Col>
            <Col span={16}>
              <Select
                value={exportSettings.textureResolution}
                onChange={(value) => setExportSettings(prev => ({ ...prev, textureResolution: value }))}
                style={{ width: '100%' }}
                size="small"
              >
                <Select.Option value={1024}>1024x1024</Select.Option>
                <Select.Option value={2048}>2048x2048</Select.Option>
                <Select.Option value={4096}>4096x4096 (高)</Select.Option>
                <Select.Option value={8192}>8192x8192 (极高)</Select.Option>
              </Select>
            </Col>
          </Row>
          <Text style={{ fontSize: '11px', color: '#666' }}>
            更高的分辨率会带来更清晰的纹理，但会增加文件大小。
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default TextSettings; 