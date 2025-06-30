import React, { useState } from 'react';
import { Card, Input, Button, Space, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { Text } = Typography;

const OBJColorConverter = () => {
  const [hexColor, setHexColor] = useState('#ff0000');
  const [rgbColor, setRgbColor] = useState('');

  // 十六进制转RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16) / 255;
      const g = parseInt(result[2], 16) / 255;
      const b = parseInt(result[3], 16) / 255;
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
    }
    return '';
  };

  const handleConvert = () => {
    const rgb = hexToRgb(hexColor);
    if (rgb) {
      setRgbColor(rgb);
    } else {
      message.error('无效的颜色格式');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  return (
    <Card 
      title="OBJ颜色转换" 
      size="small"
      style={{ height: '100%' }}
      bodyStyle={{ padding: '8px' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        <div>
          <Text style={{ fontSize: '12px' }}>HEX颜色：</Text>
          <Space size={4}>
            <Input
              value={hexColor}
              onChange={(e) => setHexColor(e.target.value)}
              placeholder="#ff0000"
              size="small"
              style={{ width: 80 }}
            />
            <Button type="primary" onClick={handleConvert} size="small">
              转换
            </Button>
          </Space>
        </div>
        
        {rgbColor && (
          <div>
            <Text style={{ fontSize: '12px' }}>OBJ RGB：</Text>
            <Space size={4}>
              <Input
                value={rgbColor}
                readOnly
                size="small"
                style={{ width: 120, fontSize: '11px' }}
              />
              <Button 
                icon={<CopyOutlined />} 
                onClick={() => copyToClipboard(rgbColor)}
                size="small"
                title="复制"
              />
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default OBJColorConverter; 