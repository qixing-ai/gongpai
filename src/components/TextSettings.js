import React from 'react';
import { Card, Space, Slider, Select, ColorPicker, Input, Typography, Radio } from 'antd';

const { Text } = Typography;

const TextSettings = ({
  textSettings,
  setTextSettings,
  badgeSettings,
  exportSettings,
  setExportSettings,
  UNIT_CONFIG,
  formatSize
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* 文字设置 */}
      <Card 
        title="文字设置" 
        size="small"
        style={{ flex: 1 }}
        bodyStyle={{ padding: '8px' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
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

      {/* 导出设置 */}
      <Card 
        title="导出设置" 
        size="small"
        style={{ flex: 'none' }}
        bodyStyle={{ padding: '8px' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
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
          
          <div>
            <Text>厚度: {formatSize(exportSettings.thickness)}mm</Text>
            <Slider
              min={0.5}
              max={10.0}
              step={0.1}
              value={exportSettings.thickness}
              onChange={(value) => setExportSettings(prev => ({ ...prev, thickness: formatSize(value, 1) }))}
              size="small"
            />
          </div>
          
          <div>
            <Text>网格密度</Text>
            <div style={{ marginTop: 4 }}>
              <Text style={{ fontSize: '12px' }}>宽度: {exportSettings.meshDensity?.width || 20}</Text>
              <Slider
                min={10}
                max={1000}
                step={5}
                value={exportSettings.meshDensity?.width || 20}
                onChange={(value) => setExportSettings(prev => ({ 
                  ...prev, 
                  meshDensity: { ...prev.meshDensity, width: value }
                }))}
                size="small"
              />
              <Text style={{ fontSize: '12px' }}>高度: {exportSettings.meshDensity?.height || 20}</Text>
              <Slider
                min={10}
                max={1000}
                step={5}
                value={exportSettings.meshDensity?.height || 20}
                onChange={(value) => setExportSettings(prev => ({ 
                  ...prev, 
                  meshDensity: { ...prev.meshDensity, height: value }
                }))}
                size="small"
              />
              <Text style={{ fontSize: '11px', color: '#666' }}>
                密度越高，三角面越密集。超高密度(&gt;200)会显著增加文件大小和处理时间
              </Text>
            </div>
          </div>
          
          <div>
            <Text>网格质量</Text>
            <div style={{ marginTop: 4 }}>
              <div style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={exportSettings.meshQuality?.enableBoundaryConnection !== false}
                  onChange={(e) => setExportSettings(prev => ({ 
                    ...prev, 
                    meshQuality: { 
                      ...prev.meshQuality, 
                      enableBoundaryConnection: e.target.checked 
                    }
                  }))}
                  style={{ marginRight: 6 }}
                />
                <Text style={{ fontSize: '12px' }}>启用边界连接</Text>
              </div>
              {exportSettings.meshQuality?.enableBoundaryConnection !== false && (
                <div>
                  <Text style={{ fontSize: '12px' }}>最大连接数: {exportSettings.meshQuality?.maxBoundaryConnections || 3}</Text>
                  <Slider
                    min={1}
                    max={8}
                    step={1}
                    value={exportSettings.meshQuality?.maxBoundaryConnections || 3}
                    onChange={(value) => setExportSettings(prev => ({ 
                      ...prev, 
                      meshQuality: { ...prev.meshQuality, maxBoundaryConnections: value }
                    }))}
                    size="small"
                  />
                  <Text style={{ fontSize: '11px', color: '#666' }}>
                    连接数越少，背面越干净，但可能影响水密性
                  </Text>
                </div>
              )}
            </div>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default TextSettings; 