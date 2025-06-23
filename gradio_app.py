#!/usr/bin/env python3
"""
Gradio 3.x版本 - 3D工牌生成器
用户上传图片，生成3D工牌模型并提供下载
"""

import gradio as gr
import os
import tempfile
import shutil
from PIL import Image
from create_badge import (
    Config, load_and_process_texture, create_cube_geometry, 
    create_glb_model, convert_glb_to_obj
)

def process_image_and_generate_model(uploaded_image):
    """处理上传的图片并生成3D模型"""
    if uploaded_image is None:
        return None, None, None, "请先上传图片"
    
    try:
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        
        # 处理上传的图片
        if isinstance(uploaded_image, str):
            # 如果是文件路径
            temp_image_path = os.path.join(temp_dir, "uploaded_image.png")
            shutil.copy2(uploaded_image, temp_image_path)
        else:
            # 如果是PIL Image对象
            temp_image_path = os.path.join(temp_dir, "uploaded_image.png")
            uploaded_image.save(temp_image_path)
        
        print(f"📸 处理图片: {temp_image_path}")
        
        # 处理纹理
        result = load_and_process_texture(temp_image_path)
        if result[0] is None:
            return None, None, None, "图片处理失败"
        
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
            return None, None, None, "GLB文件生成失败"
        
        print("📋 转换为OBJ格式...")
        obj_success = convert_glb_to_obj(glb_path, obj_path)
        
        return (
            glb_path,  # 3D预览
            glb_path,  # GLB下载
            obj_path if obj_success else None,  # OBJ下载
            "✅ 模型生成成功！点击下载按钮获取文件。"
        )
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, None, f"处理失败: {str(e)}"

def create_interface():
    """创建Gradio界面"""
    
    with gr.Blocks(title="3D工牌生成器", theme=gr.themes.Soft()) as demo:
        
        gr.Markdown("""
        # 🔲 3D工牌生成器
        """)
        
        with gr.Row():
            with gr.Column(scale=1):
                # 图片上传区域
                image_input = gr.Image(
                    label="📸 上传图片",
                    type="pil",
                    height=300
                )
                
                # 生成按钮
                generate_btn = gr.Button(
                    "🚀 生成3D模型", 
                    variant="primary",
                    size="lg"
                )
                
                # 状态信息
                status_text = gr.Textbox(
                    label="状态",
                    value="请上传图片并点击生成按钮",
                    interactive=False
                )
            
            with gr.Column(scale=1):
                # 3D模型预览区域
                model_3d = gr.Model3D(
                    label="🎮 3D模型预览",
                    height=400,
                    camera_position=(0, 0, 0.1),
                    zoom_speed=1.5,
                    pan_speed=1.5,
                    clear_color=(0.0, 0.0, 0.0, 0.0),
                    display_mode="solid"
                )
                
                # 下载区域
                with gr.Row():
                    glb_download = gr.File(
                        label="📦 GLB文件下载 (推荐)",
                        visible=True
                    )
                    obj_download = gr.File(
                        label="📋 OBJ文件下载",
                        visible=True
                    )
        
        # 事件绑定 - 直接将文件路径传递给下载组件
        generate_btn.click(
            fn=process_image_and_generate_model,
            inputs=[image_input],
            outputs=[model_3d, glb_download, obj_download, status_text]
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
        server_port=9201,
        share=False,
        inbrowser=True
    )

if __name__ == "__main__":
    main() 