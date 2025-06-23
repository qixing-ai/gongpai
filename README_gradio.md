# 🔲 3D工牌生成器 - Gradio Web界面

一个基于Gradio的Web应用，让用户可以上传图片生成3D工牌模型，支持GLB和OBJ格式下载。

## ✨ 功能特点

- 📸 **图片上传**: 支持拖拽上传等多种方式
- 🔄 **多格式下载**: 支持GLB和OBJ两种格式下载
- 📏 **固定尺寸**: 6.0cm × 9.0cm × 0.2cm的标准工牌尺寸
- 🎨 **智能适配**: 自动调整图片比例和纹理映射
- 🕳️ **挂绳孔**: 自动添加标准挂绳孔
- 🌐 **在线访问**: 支持本地和公共URL访问

## 🚀 快速开始

### 1. 环境准备

确保已激活conda环境：
```bash
conda activate badge_env
```

### 2. 安装依赖

```bash
# 安装Gradio 3.x版本（已测试稳定）
pip install "gradio==3.50.0"

# 安装其他依赖
pip install -r requirements.txt
```

### 3. 启动应用

```bash
# 推荐使用（已测试成功）
python gradio3_app.py
```

### 4. 访问界面

应用启动后会显示两个地址：
- **本地地址**: http://127.0.0.1:7863
- **公共地址**: https://xxxxx.gradio.live （72小时有效）

## 📖 使用说明

### 基本流程

1. **上传图片**
   - 点击上传区域选择图片文件
   - 支持PNG、JPG、JPEG等常见格式
   - 也可以直接拖拽图片到上传区域

2. **生成模型**
   - 点击"🚀 生成3D模型"按钮
   - 等待处理完成（通常几秒钟）

3. **下载文件**
   - GLB格式：包含纹理，适合直接查看和分享
   - OBJ格式：适合导入3D建模软件进一步编辑

### 界面说明

- **左侧面板**：图片上传、生成按钮
- **右侧面板**：文件下载区域
- **底部**：状态信息和使用说明

## 🔍 查看3D模型

### 推荐软件

- **Blender** (免费开源): 专业3D建模软件，支持GLB和OBJ
- **MeshLab** (免费): 3D网格处理和查看软件  
- **Windows 3D Viewer**: Windows内置3D查看器
- **Online GLB Viewer**: 在线GLB查看器

### 在线查看器

- [GLB Viewer](https://gltf-viewer.donmccurdy.com/)
- [Three.js Editor](https://threejs.org/editor/)
- [Babylon.js Sandbox](https://sandbox.babylonjs.com/)

## 🔧 技术细节

### 模型规格

- **尺寸**: 60mm × 90mm × 2mm
- **孔洞**: 20mm × 2mm，距离顶部8.7cm
- **倒角**: 边缘和角落都有平滑倒角
- **纹理**: 512×512像素，自适应图片比例

### 文件格式

- **GLB**: glTF二进制格式，包含几何体、材质和纹理（推荐）
- **OBJ**: Wavefront OBJ格式，包含顶点颜色信息

### 性能优化

- 使用临时目录管理文件，避免磁盘占用
- 智能纹理尺寸调整，平衡质量和性能
- 高效的网格生成算法，支持复杂几何体

## 📁 文件说明

### 主要文件

- `gradio3_app.py` - **推荐使用**，Gradio 3.x版本，已测试稳定
- `gradio_app.py` - Gradio 4.x版本，可能有兼容性问题
- `basic_gradio_app.py` - 基础版本，无3D预览
- `create_badge.py` - 核心3D建模逻辑
- `requirements.txt` - 依赖包列表

### 启动脚本

```bash
# 方式1：直接运行（推荐）
python gradio3_app.py

# 方式2：使用启动脚本
python run_gradio.py

# 方式3：命令行启动
python -m gradio3_app
```

## 🛠️ 自定义配置

可以通过修改`create_badge.py`中的`Config`类来调整参数：

```python
class Config:
    FIXED_WIDTH = 0.06      # 宽度(米)
    FIXED_HEIGHT = 0.09     # 高度(米)
    DEFAULT_THICKNESS = 0.002  # 厚度(米)
    TEXTURE_SIZE = 512      # 纹理尺寸
    SUBDIVISIONS = 512      # 网格细分数
    # ... 更多参数
```

## 📋 系统要求

- Python 3.8+
- 8GB+ RAM（推荐）
- 网络连接（用于公共URL访问）

## 🐛 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 修改gradio3_app.py中的端口号
   server_port=7864  # 改为其他端口
   ```

2. **依赖包问题**
   ```bash
   # 重新安装依赖
   pip install --upgrade -r requirements.txt
   ```

3. **图片上传失败**
   - 检查图片格式是否支持
   - 确保图片文件不超过10MB
   - 尝试转换为PNG格式

4. **模型生成失败**
   - 查看控制台错误信息
   - 确保有足够的磁盘空间
   - 检查图片是否损坏

### 版本兼容性

- ✅ **Gradio 3.50.0**: 已测试，推荐使用
- ⚠️ **Gradio 4.x**: 可能有兼容性问题
- ❌ **Gradio 2.x**: 不支持

## 🎉 使用示例

1. 启动应用：`python gradio3_app.py`
2. 访问 http://127.0.0.1:7863
3. 上传一张照片
4. 点击"生成3D模型"
5. 下载GLB文件
6. 在Blender中打开查看

## 📞 技术支持

如果遇到问题，请：
1. 检查控制台输出的错误信息
2. 确认所有依赖包已正确安装
3. 验证图片文件格式和大小
4. 尝试重启应用

## 🔄 更新日志

- **v1.0**: 初始版本，支持基本的图片上传和3D模型生成
- **v1.1**: 修复Gradio版本兼容性问题，使用3.50.0版本
- **v1.2**: 优化界面布局，改进错误处理

---

**注意**: 当前版本使用Gradio 3.50.0以确保稳定性。如需使用最新版本的Gradio，可能需要调整代码以适配新的API。 