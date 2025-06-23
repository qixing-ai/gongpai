#!/usr/bin/env python3
"""
Gradio 3.x版本 - 3D工牌生成器
用户上传图片，生成3D工牌模型并提供下载
"""

import gradio as gr
import os
import tempfile
import shutil
from create_badge import (
    Config, load_and_process_texture, create_cube_geometry, 
    create_glb_model, convert_glb_to_obj
)

def process_image_and_generate_model(uploaded_image):
    """处理上传的图片并生成3D模型"""
    if uploaded_image is None:
        return None, None, "❌ 请先上传图片"
    
    try:
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        
        # 保存上传的图片
        temp_image_path = os.path.join(temp_dir, "uploaded_image.png")
        shutil.copy2(uploaded_image, temp_image_path)
        
        print(f"📸 处理图片: {temp_image_path}")
        
        # 处理纹理
        result = load_and_process_texture(temp_image_path)
        if result[0] is None:
            return None, None, "❌ 图像处理失败"
        
        dimensions, texture_img, uv_info = result
        
        # 生成文件名
        base_name = "工牌_模型"
        glb_path = os.path.join(temp_dir, f"{base_name}.glb")
        obj_path = os.path.join(temp_dir, f"{base_name}.obj")
        
        print("🔧 创建几何数据...")
        vertices, uvs, normals, indices = create_cube_geometry(*dimensions, uv_info)
        
        print("📦 生成GLB文件...")
        glb_success = create_glb_model(vertices, uvs, normals, indices, texture_img, glb_path)
        
        if not glb_success:
            return None, None, "❌ GLB文件生成失败"
        
        print("📋 转换为OBJ格式...")
        obj_success = convert_glb_to_obj(glb_path, obj_path)
        
        # 获取文件大小信息
        glb_size = os.path.getsize(glb_path) if os.path.exists(glb_path) else 0
        obj_size = os.path.getsize(obj_path) if os.path.exists(obj_path) else 0
        
        # 准备状态信息
        status_info = f"""✅ 模型生成成功！

📊 模型信息:
• 尺寸: {Config.FIXED_WIDTH*100:.1f}cm × {Config.FIXED_HEIGHT*100:.1f}cm × {Config.DEFAULT_THICKNESS*100:.1f}cm
• 顶点数: {len(vertices):,}
• 面数: {len(indices)//3:,}

📁 文件信息:
• GLB文件: {glb_size:,} 字节
• OBJ文件: {obj_size:,} 字节 {'✅' if obj_success else '❌'}

💡 提示: 
- GLB格式适合3D查看器，包含纹理信息
- OBJ格式适合导入3D建模软件进一步编辑
- 建议使用Blender、MeshLab等软件查看3D模型"""
        
        return (
            glb_path,  # GLB下载
            obj_path if obj_success else None,  # OBJ下载
            status_info  # 状态信息
        )
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, f"❌ 处理失败: {str(e)}"

def create_interface():
    """创建Gradio界面"""
    
    with gr.Blocks(title="3D工牌生成器") as demo:
        
        gr.Markdown("""
        # 🔲 3D工牌生成器
        
        上传图片，自动生成精美的3D工牌模型！
        
        **特点:**
        - 📏 固定尺寸: 6.0cm × 9.0cm × 0.2cm
        - 🎨 自适应图片比例和纹理映射
        - 🕳️ 自动添加挂绳孔
        - 🔄 支持GLB和OBJ两种格式下载
        - 🏗️ 专业级建模质量
        """)
        
        with gr.Row():
            with gr.Column():
                # 图片上传区域
                image_input = gr.Image(
                    label="📸 上传图片",
                    type="filepath"
                )
                
                # 生成按钮
                generate_btn = gr.Button(
                    "🚀 生成3D模型", 
                    variant="primary"
                )
            
            with gr.Column():
                # 下载区域
                glb_download = gr.File(
                    label="📦 下载GLB文件 (推荐)"
                )
                obj_download = gr.File(
                    label="📋 下载OBJ文件"
                )
        
        # 状态信息
        status_output = gr.Textbox(
            label="📋 生成状态",
            lines=12,
            interactive=False
        )
        
        # 事件绑定
        generate_btn.click(
            fn=process_image_and_generate_model,
            inputs=[image_input],
            outputs=[glb_download, obj_download, status_output]
        )
        
        # 图片上传提示
        image_input.change(
            fn=lambda img: "📸 图片已上传，点击生成按钮开始处理..." if img else "",
            inputs=[image_input],
            outputs=[status_output]
        )
    
    return demo

def main():
    """启动Gradio应用"""
    print("🚀 启动3D工牌生成器Web界面...")
    
    # 确保输出目录存在
    os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
    
    # 创建并启动界面
    demo = create_interface()
    
    # 启动服务器
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        inbrowser=True
    )

if __name__ == "__main__":
    main() 