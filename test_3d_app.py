#!/usr/bin/env python3
"""
测试3D工牌生成器的功能
"""

import gradio as gr
import os
import tempfile
import shutil
from create_badge import (
    Config, load_and_process_texture, create_cube_geometry, 
    create_glb_model, convert_glb_to_obj
)

def test_model_generation():
    """测试模型生成功能"""
    # 使用示例图片
    example_image = "example_image.png"
    
    if not os.path.exists(example_image):
        print("❌ 示例图片不存在")
        return None
    
    try:
        # 创建临时目录
        temp_dir = tempfile.mkdtemp()
        
        # 复制示例图片
        temp_image_path = os.path.join(temp_dir, "test_image.png")
        shutil.copy2(example_image, temp_image_path)
        
        print(f"📸 处理图片: {temp_image_path}")
        
        # 处理纹理
        result = load_and_process_texture(temp_image_path)
        if result[0] is None:
            print("❌ 图像处理失败")
            return None
        
        dimensions, texture_img, uv_info = result
        
        # 生成文件名
        base_name = "测试工牌"
        glb_path = os.path.join(temp_dir, f"{base_name}.glb")
        
        print("🔧 创建几何数据...")
        vertices, uvs, normals, indices = create_cube_geometry(*dimensions, uv_info)
        
        print("📦 生成GLB文件...")
        glb_success = create_glb_model(vertices, uvs, normals, indices, texture_img, glb_path)
        
        if glb_success and os.path.exists(glb_path):
            print(f"✅ 成功生成GLB文件: {glb_path}")
            print(f"📁 文件大小: {os.path.getsize(glb_path):,} 字节")
            return glb_path
        else:
            print("❌ GLB文件生成失败")
            return None
            
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return None

def create_simple_3d_demo():
    """创建简单的3D演示界面"""
    
    # 生成测试模型
    test_model_path = test_model_generation()
    
    with gr.Blocks(title="3D工牌测试", theme=gr.themes.Soft()) as demo:
        
        gr.Markdown("""
        # 🔲 3D工牌生成器测试
        
        这是一个测试界面，展示3D模型预览功能。
        """)
        
        if test_model_path:
            # 3D模型预览
            model_3d = gr.Model3D(
                value=test_model_path,
                label="🎮 3D工牌预览",
                height=500,
                camera_position=(45, 45, 3),
                zoom_speed=0.5,
                clear_color=[0.9, 0.9, 0.9, 1.0]
            )
            
            gr.Markdown("""
            ### 🎮 操作说明:
            - **旋转**: 鼠标左键拖拽
            - **缩放**: 鼠标滚轮
            - **平移**: 鼠标右键拖拽
            
            如果您能看到上面的3D工牌模型，说明3D展示功能正常工作！
            """)
        else:
            gr.Markdown("❌ 无法生成测试模型，请检查配置。")
    
    return demo

if __name__ == "__main__":
    print("🚀 启动3D工牌测试界面...")
    demo = create_simple_3d_demo()
    demo.launch(
        server_name="0.0.0.0",
        server_port=7861,
        share=False,
        inbrowser=True
    ) 