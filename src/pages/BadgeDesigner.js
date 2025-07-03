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
        density: 500         // 正方形网格分段数
      },
      meshQuality: {        // 网格质量设置
        enableBoundaryConnection: true,  // 是否启用边界连接
        maxBoundaryConnections: 3,        // 最大边界连接数
        enableRetopology: true          // 是否启用重拓扑优化
      },
      subdivision: {        // 自适应细分设置
        enabled: true,      // 是否启用自适应细分
        threshold: 0.05,    // 边缘强度阈值
        maxDepth: 5         // 最大细分深度
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
  const [edgeMapUrl, setEdgeMapUrl] = useState(null);

  const settingsColSpan = edgeMapUrl ? 5 : 6;
  const previewColSpan = edgeMapUrl ? 7 : 12;
  const edgeMapColSpan = 7;

  // 导出工牌为OBJ模型
  const exportBadge = (for3DPrinting = false) => {
    // 防止重复点击
    if (loading) {
      return;
    }
    
    setLoading(true);
    
    // 使用 setTimeout 确保 UI 有时间更新加载状态
    setTimeout(async () => {
      try {
        const loadingMessage = for3DPrinting 
          ? '正在生成用于3D打印的OBJ模型...' 
          : '正在生成OBJ模型...';
        message.loading(loadingMessage, 0);
        
        const { exportBadgeAsOBJ } = await import('../utils/objExporter');
        
        const result = await exportBadgeAsOBJ(
          badgeSettings, 
          holeSettings, 
          imageSettings, 
          texts,
          exportSettings,
          { for3DPrinting }
        );
        
        message.destroy(); // 清除loading消息
        
        if (result.success) {
          message.success(result.message, 5);
          // 新增：处理并显示Edge Map
          if (result.edgeMapCanvas) {
            const canvas = result.edgeMapCanvas;
            // 设置canvas样式以便在页面上更好地显示
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.marginTop = '16px';
            canvas.style.border = '1px solid #d9d9d9';
            canvas.style.borderRadius = '4px';

            setEdgeMapUrl(canvas.toDataURL());
          }
        } else {
          message.error(result.message);
        }
      } catch (error) {
        message.destroy();
        message.error('导出失败：' + error.message);
        console.error('导出错误:', error);
      } finally {
        // 确保加载状态被正确重置
        setLoading(false);
      }
    }, 100); // 增加延迟时间，确保UI更新
  };

  // 重置设计
  const resetDesign = () => {
    removeBadgeSettings();
    removeHoleSettings();
    removeImageSettings();
    removeTexts();
    removeExportSettings();
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
            
            {edgeMapUrl && (
              <Col span={edgeMapColSpan} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '12px 0 8px 0' }}>
                    <Title level={5} style={{ margin: 0 }}>边缘强度图</Title>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>白色区域将被优先细分</Typography.Text>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                    <img
                        src={edgeMapUrl}
                        alt="Edge Map Visualization"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            border: '1px solid #f0f0f0',
                            borderRadius: 4,
                            backgroundColor: '#000',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                    />
                </div>
              </Col>
            )}

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