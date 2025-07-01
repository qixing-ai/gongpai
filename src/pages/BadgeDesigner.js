import React, { useState, useCallback } from 'react';
import {
  Layout,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { BadgePreview, BadgeSettings, TextSettings } from '../components';
import useInteraction from '../hooks/useInteraction';
import { UNIT_CONFIG } from '../constants/unitConfig';

const { Header, Content } = Layout;
const { Title } = Typography;

const BadgeDesigner = () => {

  // 数值格式化函数
  const formatSize = (value, precision = 1) => {
    return Math.round(value * (10 ** precision)) / (10 ** precision);
  };

  // 工牌设置 - 统一使用毫米(mm)
  const [badgeSettings, setBadgeSettings] = useState({
    width: 63,        // mm
    height: 90,       // mm
    backgroundColor: '#ffffff',
    borderRadius: 5,  // mm
  });

  // 穿孔设置 - 统一使用毫米(mm)
  const [holeSettings, setHoleSettings] = useState({
    enabled: false,
    shape: 'circle',
    size: 6,          // mm
    offsetY: 1.5,       // mm
    width: 6,         // mm
    height: 4,        // mm
    borderRadius: 2,  // mm
  });

  // 图片设置 - 统一使用毫米(mm)
  const [imageSettings, setImageSettings] = useState({
    src: null,
    width: 30,        // mm
    height: 30,       // mm
    x: 17,            // mm
    y: 23,            // mm
    opacity: 1,
  });

  // 文字设置 - 统一使用毫米(mm)
  const [textSettings, setTextSettings] = useState({
    content: '张三\n技术部',
    fontSize: 4,      // mm
    color: '#000000',
    fontFamily: 'Microsoft YaHei',
    x: 26,            // mm
    y: 68,            // mm
    lineHeight: 1.4,
  });

  // 导出设置 - 统一使用毫米(mm)
  const [exportSettings, setExportSettings] = useState({
    doubleSided: true,    // 双面/单面
    thickness: 2.0,       // 厚度 mm
    meshDensity: {        // 网格密度设置
      density: 20         // 正方形网格分段数
    },
    meshQuality: {        // 网格质量设置
      enableBoundaryConnection: true,  // 是否启用边界连接
      maxBoundaryConnections: 3        // 最大边界连接数
    }
  });

  // 使用交互Hook
  const {
    interactionState,
    selectedElement,
    setSelectedElement,
    startInteraction,
    handleDoubleClick
  } = useInteraction(
    badgeSettings,
    setBadgeSettings,
    holeSettings,
    setHoleSettings,
    imageSettings,
    setImageSettings,
    textSettings,
    setTextSettings,
    UNIT_CONFIG
  );

  // 导出工牌为OBJ模型
  const exportBadge = async () => {
    try {
      message.loading('正在生成OBJ模型...', 0);
      
      const { exportBadgeAsOBJ } = await import('../utils/objExporter');
      
      const result = await exportBadgeAsOBJ(
        badgeSettings, 
        holeSettings, 
        imageSettings, 
        textSettings,
        exportSettings
      );
      
      message.destroy(); // 清除loading消息
      
      if (result.success) {
        message.success(result.message, 5);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.destroy();
      message.error('导出失败：' + error.message);
      console.error('导出错误:', error);
    }
  };

  // 重置设计
  const resetDesign = () => {
    setBadgeSettings({
      width: formatSize(63),
      height: formatSize(90),
      backgroundColor: '#ffffff',
      borderRadius: formatSize(5),
    });
    setHoleSettings({
      enabled: false,
      shape: 'circle',
      size: formatSize(6),
      offsetY: formatSize(1),
      width: formatSize(6),
      height: formatSize(4),
      borderRadius: formatSize(2),
    });
    setImageSettings({
      src: null,
      width: formatSize(30),
      height: formatSize(30),
      x: formatSize(17),
      y: formatSize(23),
      opacity: formatSize(1, 1),
    });
    setTextSettings({
      content: '张三\n技术部',
      fontSize: formatSize(4),
      color: '#000000',
      fontFamily: 'Microsoft YaHei',
      x: formatSize(26),
      y: formatSize(68),
      lineHeight: formatSize(1.4, 1),
    });
    setExportSettings({
      doubleSided: true,
      thickness: formatSize(2.0, 1),
      meshDensity: {
        density: 20
      },
      meshQuality: {
        enableBoundaryConnection: true,
        maxBoundaryConnections: 3
      }
    });
    setSelectedElement(null);
    message.success('设计已重置');
  };

  return (
    <Layout style={{ minHeight: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 16px', 
        borderBottom: '1px solid #f0f0f0',
        height: '48px',
        lineHeight: '48px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            <CameraOutlined style={{ marginRight: 8 }} />
            工牌设计器
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={resetDesign} size="small">
              重置
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={exportBadge} size="small">
              导出OBJ模型
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: 12, background: '#f5f5f5', overflow: 'hidden' }}>
        <Row gutter={12} style={{ height: '100%' }}>
          <Col span={6}>
            <BadgeSettings
              badgeSettings={badgeSettings}
              setBadgeSettings={setBadgeSettings}
              holeSettings={holeSettings}
              setHoleSettings={setHoleSettings}
              imageSettings={imageSettings}
              setImageSettings={setImageSettings}
              setSelectedElement={setSelectedElement}
              UNIT_CONFIG={UNIT_CONFIG}
              formatSize={formatSize}
            />
          </Col>
          <Col span={12}>
            <BadgePreview
              badgeSettings={badgeSettings}
              holeSettings={holeSettings}
              imageSettings={imageSettings}
              textSettings={textSettings}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              interactionState={interactionState}
              startInteraction={startInteraction}
              handleDoubleClick={handleDoubleClick}
              UNIT_CONFIG={UNIT_CONFIG}
              formatSize={formatSize}
            />
          </Col>
          <Col span={6}>
            <div style={{
              height: '90vh',
              overflow: 'auto',
              marginBottom: '8px'
            }}>
              <TextSettings
                textSettings={textSettings}
                setTextSettings={setTextSettings}
                badgeSettings={badgeSettings}
                exportSettings={exportSettings}
                setExportSettings={setExportSettings}
                UNIT_CONFIG={UNIT_CONFIG}
                formatSize={formatSize}
              />
            </div>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};

export default BadgeDesigner; 