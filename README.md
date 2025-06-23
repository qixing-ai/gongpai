# 🔲 3D工牌生成器

一个完整的3D工牌生成解决方案，支持命令行和Web界面两种使用方式。

## 📋 项目概述

本项目可以根据用户上传的图片自动生成精美的3D工牌模型，具有以下特点：

- 📏 **标准尺寸**: 6.0cm × 9.0cm × 0.2cm
- 🎨 **智能适配**: 自动调整图片比例和纹理映射
- 🕳️ **挂绳孔**: 自动添加标准挂绳孔
- 🔄 **多格式**: 支持GLB和OBJ两种格式输出
- 🏗️ **专业级**: 高质量建模，支持倒角和平滑处理

## 🚀 使用方式

### 方式1：Web界面（推荐）

最简单的使用方式，通过浏览器操作：

```bash
# 1. 激活环境
conda activate badge_env

# 2. 安装依赖
pip install "gradio==3.50.0"
pip install -r requirements.txt

# 3. 启动Web界面
python gradio_app.py

# 4. 访问 http://127.0.0.1:7863
```

详细说明请查看：[README_gradio.md](README_gradio.md)

### 方式2：命令行

适合批量处理和自动化：

```bash
# 激活环境
conda activate badge_env

# 生成3D模型
python create_badge.py
```

## 📁 项目结构

```
├── gradio_app.py          # Web界面主程序（推荐）
├── create_badge.py        # 核心3D建模逻辑
├── requirements.txt       # 依赖包列表
├── README_gradio.md       # Web界面详细说明
├── run_gradio.py         # 启动脚本
├── example_image.png     # 示例图片
└── output/               # 输出目录
```

## 🔧 环境要求

- Python 3.8+
- 8GB+ RAM（推荐）
- 支持的操作系统：Windows、macOS、Linux

## 📦 主要依赖

- `gradio==3.50.0` - Web界面框架
- `numpy>=1.21.0` - 数值计算
- `Pillow>=9.0.0` - 图像处理
- `trimesh>=3.15.0` - 3D网格处理
- `pygltflib>=1.15.0` - GLB文件生成

## 🎯 快速开始

1. **克隆项目**
   ```bash
   git clone <项目地址>
   cd 工牌
   ```

2. **设置环境**
   ```bash
   conda create -n badge_env python=3.9
   conda activate badge_env
   pip install -r requirements.txt
   ```

3. **启动应用**
   ```bash
   python gradio3_app.py
   ```

4. **开始使用**
   - 访问显示的URL
   - 上传图片
   - 生成并下载3D模型

## 📸 使用示例

1. 准备一张清晰的照片（建议1024x1024以上）
2. 通过Web界面上传
3. 点击"生成3D模型"
4. 下载GLB文件
5. 在Blender、MeshLab等软件中查看

## 🔍 查看3D模型

### 推荐软件
- **Blender** (免费): 专业3D建模软件
- **MeshLab** (免费): 3D网格查看器
- **Windows 3D Viewer**: Windows内置查看器

### 在线查看器
- [GLB Viewer](https://gltf-viewer.donmccurdy.com/)
- [Three.js Editor](https://threejs.org/editor/)

## 🐛 问题排除

常见问题及解决方案请查看 [README_gradio_final.md](README_gradio_final.md) 中的故障排除部分。

## 📞 技术支持

如遇问题，请检查：
1. 控制台错误信息
2. 依赖包是否正确安装
3. 图片格式和大小
4. 网络连接状态

---

**提示**: 推荐使用Web界面版本，操作简单，功能完整。