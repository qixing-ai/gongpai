import React, { useState, useCallback, useRef } from 'react';
import {
  Layout,
  Button,
  Space,
  Typography,
  Row,
  Col,
  message,
  Spin,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  CameraOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';
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
  const [badgeSettings, setBadgeSettings, { removeItem: removeBadgeSettings }] = useLocalStorageState('badgeSettings', {
    defaultValue: {
      width: 63,        // mm
      height: 90,       // mm
      backgroundColor: '#ffffff',
      borderRadius: 5,  // mm
    }
  });

  // 穿孔设置 - 统一使用毫米(mm)
  const [holeSettings, setHoleSettings, { removeItem: removeHoleSettings }] = useLocalStorageState('holeSettings', {
    defaultValue: {
      enabled: true,
      shape: 'circle',
      size: 6,          // mm
      offsetY: 1.5,       // mm
      width: 6,         // mm
      height: 4,        // mm
      borderRadius: 2,  // mm
    }
  });

  // 图片设置 - 统一使用毫米(mm)
  const [imageSettings, setImageSettings, { removeItem: removeImageSettings }] = useLocalStorageState('imageSettings', {
    defaultValue: {
      src: null,
      width: 30,        // mm
      height: 30,       // mm
      x: 17,            // mm
      y: 23,            // mm
      opacity: 1,
    }
  });

  // 文字设置 - 统一使用毫米(mm)
  const [texts, setTexts, { removeItem: removeTexts }] = useLocalStorageState('texts', {
    defaultValue: [{
      id: `text-${Date.now()}`,
      content: 'XX\nXXX部',
      fontSize: 4,      // mm
      color: '#000000',
      fontFamily: 'Microsoft YaHei',
      x: 26,            // mm
      y: 68,            // mm
      lineHeight: 1.4,
    }]
  });

  // 导出设置 - 统一使用毫米(mm)
  const [exportSettings, setExportSettings, { removeItem: removeExportSettings }] = useLocalStorageState('exportSettings', {
    defaultValue: {
      doubleSided: true,    // 双面/单面
      thickness: 2.0,       // 厚度 mm
      textureResolution: 8192, // 贴图分辨率
      meshDensity: {        // 网格密度设置
        density: 50         // 固定为50
      },
      meshQuality: {        // 网格质量设置
        enableBoundaryConnection: true,  // 是否启用边界连接
        maxBoundaryConnections: 3,        // 最大边界连接数
        enableRetopology: true          // 是否启用重拓扑优化
      },
      subdivision: {        // 自适应细分设置
        enabled: true,      // 是否启用自适应细分
        threshold: 0.01,    // 边缘强度阈值（默认为0.01）
        maxDepth: 4         // 最大细分深度（默认为4）
      }
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
    texts,
    setTexts,
    UNIT_CONFIG
  );

  const [loading, setLoading] = useState(false);

  const settingsColSpan = 6;
  const previewColSpan = 12;

  // 导出工牌为OBJ模型
  const exportBadge = (for3DPrinting = false) => {
    if (loading) {
      return;
    }
    setLoading(true);
    setExportSettings(prev => ({
      ...prev,
      meshDensity: { density: 50 }
    }));
    setTimeout(async () => {
      try {
        const loadingMessage = for3DPrinting 
          ? '正在生成用于3D打印的OBJ模型...' 
          : '正在生成OBJ模型...';
        message.loading(loadingMessage, 0);
        const { exportBadgeAsOBJ } = await import('../utils/obj-exporter');
        const result = await exportBadgeAsOBJ(
          badgeSettings, 
          holeSettings, 
          imageSettings, 
          texts,
          { ...exportSettings, meshDensity: { density: 50 } },
          { for3DPrinting }
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
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  // 重置设计
  const resetDesign = () => {
    removeBadgeSettings();
    removeHoleSettings();
    removeImageSettings();
    removeTexts();
    removeExportSettings();
    setSelectedElement(null);
    // 重置后强制meshDensity为50
    setExportSettings(prev => ({
      ...prev,
      meshDensity: { density: 50 }
    }));
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
            <Button 
              type="default" 
              icon={<DownloadOutlined />} 
              onClick={() => exportBadge(false)} 
              size="small"
              loading={loading}
              disabled={loading}
            >
              导出OBJ模型
            </Button>
            <Button 
              type="primary" 
              icon={<PrinterOutlined />} 
              onClick={() => exportBadge(true)} 
              size="small"
              loading={loading}
              disabled={loading}
            >
              导出3D打印模型
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: 12, background: '#f5f5f5', overflow: 'hidden' }}>
        <Spin spinning={loading} tip="加载中...">
          <Row gutter={12} style={{ height: '100%' }}>
            <Col span={settingsColSpan}>
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
            <Col span={previewColSpan}>
              <BadgePreview
                badgeSettings={badgeSettings}
                holeSettings={holeSettings}
                imageSettings={imageSettings}
                texts={texts}
                selectedElement={selectedElement}
                setSelectedElement={setSelectedElement}
                interactionState={interactionState}
                startInteraction={startInteraction}
                handleDoubleClick={handleDoubleClick}
                UNIT_CONFIG={UNIT_CONFIG}
                formatSize={formatSize}
              />
            </Col>
            
            <Col span={settingsColSpan}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
                  <TextSettings
                    texts={texts}
                    setTexts={setTexts}
                    badgeSettings={badgeSettings}
                    exportSettings={exportSettings}
                    setExportSettings={setExportSettings}
                    selectedElement={selectedElement}
                    setSelectedElement={setSelectedElement}
                    UNIT_CONFIG={UNIT_CONFIG}
                    formatSize={formatSize}
                  />
                </div>
              </div>
            </Col>
          </Row>
        </Spin>
      </Content>
    </Layout>
  );
};

export default BadgeDesigner; 