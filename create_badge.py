#!/usr/bin/env python3
"""
创建自适应尺寸的立方体GLB工牌模型
自动分析图像尺寸并计算合适的物理尺寸
"""

import numpy as np
from PIL import Image as PILImage
import base64
import os
import io
import trimesh
from pygltflib import *

# 常量定义
DEFAULT_THICKNESS_CM = 0.5
DEFAULT_SIZE_CM = 6.0
TEXTURE_SIZE = 512
FRONT_BACK_SUBDIVISIONS = 512
SIDE_SUBDIVISIONS = 2
TEXTURE_CANDIDATES = [
    "wechat_2025-06-20_092203_424.png",
    "image.png", 
    "texture.png", 
    "badge.png"
]

def load_texture(img_path):
    """加载并处理纹理图像"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None
    
    try:
        img = PILImage.open(img_path).convert('RGB')
        width, height = img.size
        aspect_ratio = width / height
        
        print(f"📸 图片: {os.path.basename(img_path)} ({width}x{height})")
        
        # 计算物理尺寸
        if aspect_ratio < 1.0:
            real_width_cm = DEFAULT_SIZE_CM
            real_height_cm = real_width_cm / aspect_ratio
        else:
            real_height_cm = DEFAULT_SIZE_CM
            real_width_cm = real_height_cm * aspect_ratio
        
        dimensions = (real_width_cm / 100, real_height_cm / 100, DEFAULT_THICKNESS_CM / 100)
        texture_img = img.resize((TEXTURE_SIZE, TEXTURE_SIZE), PILImage.LANCZOS)
        
        print(f"📏 尺寸: {real_width_cm:.1f}x{real_height_cm:.1f}x{DEFAULT_THICKNESS_CM:.1f} cm")
        return dimensions, texture_img
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None

def create_face_vertices(corners, uvs, normal, subdivisions):
    """创建面的顶点数据"""
    vertices, face_uvs, normals, indices = [], [], [], []
    
    # 生成顶点网格
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            
            # 双线性插值计算位置和UV
            pos = ((1-u)*(1-v)*corners[0] + u*(1-v)*corners[1] + 
                   u*v*corners[2] + (1-u)*v*corners[3])
            uv = ((1-u)*(1-v)*np.array(uvs[0]) + u*(1-v)*np.array(uvs[1]) + 
                  u*v*np.array(uvs[2]) + (1-u)*v*np.array(uvs[3]))
            
            vertices.append(pos)
            face_uvs.append(uv)
            normals.append(normal)
    
    # 生成三角形索引
    for i in range(subdivisions):
        for j in range(subdivisions):
            base = i * (subdivisions + 1) + j
            indices.extend([base, base + 1, base + subdivisions + 2, 
                          base, base + subdivisions + 2, base + subdivisions + 1])
    
    return vertices, face_uvs, normals, indices

def create_cube_mesh(width, height, thickness):
    """
    创建立方体网格数据
    
    修复镜像问题：
    - 前面：从左下角开始的顶点顺序，使用标准UV映射 (0,0)→(1,0)→(1,1)→(0,1)
    - 后面：从右下角开始的顶点顺序，使用水平翻转UV映射 (1,0)→(0,0)→(0,1)→(1,1)
    - 这样确保两个面都显示正确方向的纹理，避免左右反转
    """
    half_w, half_h, half_t = width/2, height/2, thickness/2
    
    # 定义六个面的顶点、UV和法线
    face_configs = [
        # 前面 - 高细分，正常UV映射
        # 顶点顺序: [左下前, 右下前, 右上前, 左下前] - 从左下开始逆时针
        ([[-half_w, -half_h, half_t], [half_w, -half_h, half_t], 
          [half_w, half_h, half_t], [-half_w, half_h, half_t]], 
         [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, 1], FRONT_BACK_SUBDIVISIONS),
        
        # 后面 - 高细分，水平翻转UV映射以修复镜像问题
        # 顶点顺序: [右下后, 左下后, 左上后, 右上后] - 从右下开始逆时针
        ([[half_w, -half_h, -half_t], [-half_w, -half_h, -half_t], 
          [-half_w, half_h, -half_t], [half_w, half_h, -half_t]], 
         [[1, 0], [0, 0], [0, 1], [1, 1]], [0, 0, -1], FRONT_BACK_SUBDIVISIONS),
        
        # 四个侧面 - 低细分
        ([[half_w, -half_h, half_t], [half_w, -half_h, -half_t], 
          [half_w, half_h, -half_t], [half_w, half_h, half_t]], 
         [[0.98, 0], [0.98, 1], [1, 1], [1, 0]], [1, 0, 0], SIDE_SUBDIVISIONS),
        ([[-half_w, -half_h, -half_t], [-half_w, -half_h, half_t], 
          [-half_w, half_h, half_t], [-half_w, half_h, -half_t]], 
         [[0.02, 0], [0.02, 1], [0, 1], [0, 0]], [-1, 0, 0], SIDE_SUBDIVISIONS),
        ([[-half_w, half_h, half_t], [half_w, half_h, half_t], 
          [half_w, half_h, -half_t], [-half_w, half_h, -half_t]], 
         [[0, 0.98], [1, 0.98], [1, 1], [0, 1]], [0, 1, 0], SIDE_SUBDIVISIONS),
        ([[-half_w, -half_h, -half_t], [half_w, -half_h, -half_t], 
          [half_w, -half_h, half_t], [-half_w, -half_h, half_t]], 
         [[0, 0], [1, 0], [1, 0.02], [0, 0.02]], [0, -1, 0], SIDE_SUBDIVISIONS)
    ]
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    # 处理每个面
    for corners, uvs, normal, subdivisions in face_configs:
        vertices, face_uvs, normals, indices = create_face_vertices(
            [np.array(v) for v in corners], uvs, normal, subdivisions)
        
        # 添加到总数据并调整索引
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(face_uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    return (np.array(all_vertices, dtype=np.float32), 
            np.array(all_uvs, dtype=np.float32),
            np.array(all_normals, dtype=np.float32), 
            np.array(all_indices, dtype=np.uint32))

def create_glb_file(vertices, uvs, normals, indices, texture_img, output_path):
    """创建并保存GLB文件"""
    # 准备数据
    vertex_data = vertices.tobytes()
    uv_data = uvs.tobytes()
    normal_data = normals.tobytes()
    use_uint16 = len(vertices) < 65536
    index_data = (indices.astype(np.uint16) if use_uint16 else indices).tobytes()
    
    # 组织缓冲区数据
    if texture_img:
        img_bytes = io.BytesIO()
        texture_img.save(img_bytes, format='PNG')
        img_data = img_bytes.getvalue()
        padding = (4 - (len(img_data) % 4)) % 4
        geo_offset = len(img_data) + padding
        all_data = img_data + b'\x00' * padding + vertex_data + uv_data + normal_data + index_data
        data_offsets = [
            (0, len(img_data)),
            (geo_offset, len(vertex_data)),
            (geo_offset + len(vertex_data), len(uv_data)),
            (geo_offset + len(vertex_data) + len(uv_data), len(normal_data)),
            (geo_offset + len(vertex_data) + len(uv_data) + len(normal_data), len(index_data))
        ]
    else:
        all_data = vertex_data + uv_data + normal_data + index_data
        data_offsets = [
            (0, len(vertex_data)),
            (len(vertex_data), len(uv_data)),
            (len(vertex_data) + len(uv_data), len(normal_data)),
            (len(vertex_data) + len(uv_data) + len(normal_data), len(index_data))
        ]
    
    # 创建GLTF对象
    gltf = GLTF2()
    
    # 缓冲区
    gltf.buffers = [Buffer(
        byteLength=len(all_data),
        uri=f"data:application/octet-stream;base64,{base64.b64encode(all_data).decode()}"
    )]
    
    # 缓冲区视图
    buffer_views = []
    if texture_img:
        buffer_views.append(BufferView(buffer=0, byteOffset=data_offsets[0][0], byteLength=data_offsets[0][1]))
        start_idx = 1
    else:
        start_idx = 0
    
    targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER]
    for i, target in enumerate(targets):
        offset, length = data_offsets[start_idx + i]
        buffer_views.append(BufferView(buffer=0, byteOffset=offset, byteLength=length, target=target))
    gltf.bufferViews = buffer_views
    
    # 访问器
    bv_offset = 1 if texture_img else 0
    gltf.accessors = [
        Accessor(bufferView=bv_offset, componentType=FLOAT, count=len(vertices), type="VEC3",
                min=vertices.min(axis=0).tolist(), max=vertices.max(axis=0).tolist()),
        Accessor(bufferView=bv_offset+1, componentType=FLOAT, count=len(uvs), type="VEC2"),
        Accessor(bufferView=bv_offset+2, componentType=FLOAT, count=len(normals), type="VEC3"),
        Accessor(bufferView=bv_offset+3, componentType=UNSIGNED_SHORT if use_uint16 else UNSIGNED_INT, 
                count=len(indices), type="SCALAR")
    ]
    
    # 材质和纹理
    if texture_img:
        gltf.images = [Image(mimeType="image/png", bufferView=0)]
        gltf.samplers = [Sampler(magFilter=9729, minFilter=9729, wrapS=10497, wrapT=10497)]
        gltf.textures = [Texture(sampler=0, source=0)]
        pbr = PbrMetallicRoughness(baseColorTexture=TextureInfo(index=0))
    else:
        pbr = PbrMetallicRoughness(baseColorFactor=[0.9, 0.9, 0.9, 1.0])
    
    gltf.materials = [Material(name="BadgeMaterial", pbrMetallicRoughness=pbr)]
    
    # 网格和场景
    primitive = Primitive(attributes=Attributes(POSITION=0, TEXCOORD_0=1, NORMAL=2), indices=3, material=0)
    gltf.meshes = [Mesh(name="BadgeMesh", primitives=[primitive])]
    gltf.nodes = [Node(name="BadgeNode", mesh=0)]
    gltf.scenes = [Scene(name="BadgeScene", nodes=[0])]
    gltf.scene = 0
    
    # 保存文件
    try:
        gltf.save(output_path)
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"✅ 导出成功: {os.path.basename(output_path)} ({file_size:,} 字节)")
            return True
    except Exception as e:
        print(f"❌ 导出失败: {e}")
    return False

def extract_vertex_colors(mesh, uv):
    """从纹理提取顶点颜色"""
    if not (hasattr(mesh.visual, 'material') and mesh.visual.material and 
            hasattr(mesh.visual.material, 'baseColorTexture') and 
            mesh.visual.material.baseColorTexture):
        return None
    
    texture = mesh.visual.material.baseColorTexture
    texture_array = np.array(texture)
    tex_h, tex_w = texture_array.shape[:2]
    
    # UV坐标映射到纹理像素
    u_coords = np.clip(uv[:, 0] * (tex_w - 1), 0, tex_w - 1).astype(int)
    v_coords = np.clip((1 - uv[:, 1]) * (tex_h - 1), 0, tex_h - 1).astype(int)
    
    return texture_array[v_coords, u_coords, :3]

def convert_face_to_vertex_colors(mesh):
    """将面颜色转换为顶点颜色"""
    face_colors = mesh.visual.face_colors
    vertex_colors = np.zeros((len(mesh.vertices), 3))
    vertex_counts = np.zeros(len(mesh.vertices))
    
    for i, face in enumerate(mesh.faces):
        vertex_colors[face] += face_colors[i, :3]
        vertex_counts[face] += 1
    
    vertex_counts[vertex_counts == 0] = 1
    return (vertex_colors / vertex_counts[:, np.newaxis]).astype(np.uint8)

def convert_to_obj(glb_path, obj_path):
    """转换GLB到OBJ格式"""
    try:
        print("🔄 开始转换GLB到OBJ...")
        scene = trimesh.load(glb_path, file_type='glb')
        
        # 获取网格
        mesh = (trimesh.util.concatenate([g for g in scene.geometry.values()]) 
                if isinstance(scene, trimesh.Scene) else scene)
        
        # 尝试提取纹理颜色
        if hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None:
            colors = extract_vertex_colors(mesh, mesh.visual.uv)
            if colors is not None:
                mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, vertex_colors=colors)
                mesh.export(obj_path, file_type='obj', include_color=True, include_normals=False, include_texture=False)
                print(f"✅ 成功导出带颜色的OBJ文件: {os.path.basename(obj_path)}")
                print(f"📊 顶点数: {len(mesh.vertices)}, 面数: {len(mesh.faces)}")
                return True
        
        # 处理现有颜色
        if hasattr(mesh.visual, 'kind'):
            if mesh.visual.kind == 'vertex' and mesh.visual.vertex_colors is not None:
                mesh.export(obj_path, file_type='obj', include_color=True, include_normals=False, include_texture=False)
                print(f"✅ 使用现有顶点颜色导出OBJ文件: {os.path.basename(obj_path)}")
                return True
            elif mesh.visual.kind == 'face' and mesh.visual.face_colors is not None:
                vertex_colors = convert_face_to_vertex_colors(mesh)
                colored_mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, vertex_colors=vertex_colors)
                colored_mesh.export(obj_path, file_type='obj', include_color=True, include_normals=False, include_texture=False)
                print(f"✅ 将面颜色转换为顶点颜色导出OBJ文件: {os.path.basename(obj_path)}")
                return True
        
        # 无颜色导出
        print("⚠️ 未找到颜色信息，导出无颜色的OBJ")
        mesh.export(obj_path, file_type='obj')
        return True
        
    except Exception as e:
        print(f"❌ 转换过程中出错: {e}")
        return False

def find_texture_file():
    """查找纹理文件"""
    for filename in TEXTURE_CANDIDATES:
        path = os.path.join(os.getcwd(), filename)
        if os.path.exists(path):
            return path
    return None

def main():
    """主函数"""
    print("🔲 自适应立方体GLB工牌生成器")
    print("=" * 40)
    print("📐 自动选择: 中密度 (128x128) - 平衡质量")
    
    # 查找并处理纹理
    texture_path = find_texture_file()
    if not texture_path:
        print("❌ 未找到任何图像文件")
        return
    
    result = load_texture(texture_path)
    if result[0]:
        dimensions, texture_img = result
    else:
        print("⚠️ 使用默认尺寸")
        dimensions = (0.060, 0.091, 0.005)
        texture_img = None
    
    # 生成文件名
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    glb_path = f"工牌_{base_name}_简化版.glb"
    obj_path = f"工牌_{base_name}_简化版.obj"
    
    # 创建和导出模型
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_mesh(*dimensions)
    
    print("📦 生成GLB文件...")
    if create_glb_file(vertices, uvs, normals, indices, texture_img, glb_path):
        width_m, height_m, thickness_m = dimensions
        print(f"\n🎉 GLB生成完成!")
        print(f"📁 GLB文件: {os.path.basename(glb_path)}")
        print(f"📏 尺寸: {width_m*100:.1f}x{height_m*100:.1f}x{thickness_m*100:.1f} cm")
        
        print("\n📋 开始转换为OBJ格式...")
        if convert_to_obj(glb_path, obj_path):
            print(f"📁 OBJ文件: {os.path.basename(obj_path)}")
            print(f"\n🎉 全部完成! 已生成GLB和OBJ两种格式的工牌文件")
        else:
            print("\n⚠️ OBJ转换失败，但GLB文件已成功生成")
    else:
        print("\n❌ 生成失败")

if __name__ == "__main__":
    main() 