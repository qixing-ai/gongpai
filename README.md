import trimesh
import numpy as np
from PIL import Image

def convert_glb_to_obj_with_color(glb_path, obj_path):
    """
    将 GLB 文件转换为带有顶点颜色的 OBJ 文件
    
    参数:
        glb_path: 输入的 GLB 文件路径
        obj_path: 输出的 OBJ 文件路径
    """
    try:
        # 加载 GLB 文件
        scene = trimesh.load(glb_path, file_type='glb')
        
        # 处理场景或单个网格
        if isinstance(scene, trimesh.Scene):
            # 合并场景中的所有网格
            merged_mesh = trimesh.util.concatenate(
                [g for g in scene.geometry.values()]
            )
        else:
            merged_mesh = scene
        
        # 确保网格有纹理坐标
        if not merged_mesh.visual.uv is None and merged_mesh.visual.material is not None:
            # 获取纹理图像
            if hasattr(merged_mesh.visual.material, 'baseColorTexture'):
                texture = merged_mesh.visual.material.baseColorTexture
                if texture is not None:
                    # 将纹理转换为 NumPy 数组
                    texture_array = np.array(texture)
                    
                    # 获取 UV 坐标
                    uv = merged_mesh.visual.uv
                    
                    # 将 UV 坐标映射到纹理像素位置
                    # UV 坐标范围 [0,1] 映射到纹理尺寸 [0, width-1] 和 [0, height-1]
                    tex_width, tex_height = texture.size
                    u_coords = np.clip(uv[:, 0], 0, 1) * (tex_width - 1)
                    v_coords = (1 - np.clip(uv[:, 1], 0, 1)) * (tex_height - 1)  # 翻转 V 轴
                    
                    # 采样纹理颜色
                    u_coords = u_coords.astype(int)
                    v_coords = v_coords.astype(int)
                    
                    # 确保坐标在有效范围内
                    u_coords = np.clip(u_coords, 0, tex_width - 1)
                    v_coords = np.clip(v_coords, 0, tex_height - 1)
                    
                    # 获取颜色值 (RGB)
                    colors = texture_array[v_coords, u_coords, :3]
                    
                    # 创建带有顶点颜色的新网格
                    colored_mesh = trimesh.Trimesh(
                        vertices=merged_mesh.vertices,
                        faces=merged_mesh.faces,
                        vertex_colors=colors
                    )
                    
                    # 导出为 OBJ
                    with open(obj_path, 'w') as f:
                        colored_mesh.export(
                            f, 
                            file_type='obj',
                            include_color=True,
                            include_normals=False,
                            include_texture=False
                        )
                    print(f"成功导出 OBJ 文件到: {obj_path}")
                    print(f"顶点数: {len(colored_mesh.vertices)}")
                    print(f"面数: {len(colored_mesh.faces)}")
                    return
                    
        # 如果没有纹理，尝试使用现有的顶点/面颜色
        if merged_mesh.visual.kind == 'vertex' and merged_mesh.visual.vertex_colors is not None:
            # 直接导出顶点颜色
            with open(obj_path, 'w') as f:
                merged_mesh.export(
                    f, 
                    file_type='obj',
                    include_color=True,
                    include_normals=False,
                    include_texture=False
                )
            print(f"使用现有顶点颜色导出 OBJ 文件到: {obj_path}")
            return
            
        elif merged_mesh.visual.kind == 'face' and merged_mesh.visual.face_colors is not None:
            # 将面颜色转换为顶点颜色
            face_colors = merged_mesh.visual.face_colors
            vertex_colors = np.zeros((len(merged_mesh.vertices), 3))
            
            # 为每个顶点分配面颜色的平均值
            for i, face in enumerate(merged_mesh.faces):
                vertex_colors[face] += face_colors[i, :3]
                
            # 计算每个顶点被引用的次数
            vertex_counts = np.zeros(len(merged_mesh.vertices))
            for face in merged_mesh.faces:
                vertex_counts[face] += 1
                
            # 避免除以零
            vertex_counts[vertex_counts == 0] = 1
            vertex_colors /= vertex_counts[:, np.newaxis]
            
            # 创建新网格
            colored_mesh = trimesh.Trimesh(
                vertices=merged_mesh.vertices,
                faces=merged_mesh.faces,
                vertex_colors=vertex_colors.astype(np.uint8)
            )
            
            # 导出 OBJ
            with open(obj_path, 'w') as f:
                colored_mesh.export(
                    f, 
                    file_type='obj',
                    include_color=True,
                    include_normals=False,
                    include_texture=False
                )
            print(f"将面颜色转换为顶点颜色导出 OBJ 文件到: {obj_path}")
            return
        
        # 如果没有颜色信息
        print("警告: 未找到颜色信息，导出无颜色的 OBJ")
        merged_mesh.export(obj_path, file_type='obj')
        
    except Exception as e:
        print(f"转换过程中出错: {e}")
        raise

# 使用示例
glb_file = "1.glb"  # 输入 GLB 文件
obj_file = "1.obj"  # 输出 OBJ 文件

convert_glb_to_obj_with_color(glb_file, obj_file)



上面是参考代码

要求将普通的obj转换成这种顶点带颜色的obj