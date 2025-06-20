#!/usr/bin/env python3
"""
创建自适应尺寸的立方体GLB工牌模型
自动分析图像尺寸并计算合适的物理尺寸
"""

import numpy as np
from PIL import Image
import base64
import os
import io
from pygltflib import (
    GLTF2, Scene, Node, Mesh, Primitive, Accessor, BufferView, Buffer,
    Material, PbrMetallicRoughness, TextureInfo, Image as GLTFImage, 
    Sampler, Texture, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, 
    UNSIGNED_SHORT, FLOAT
)

# 常量定义
DEFAULT_THICKNESS_CM = 0.5
DEFAULT_SIZE_CM = 6.0
TEXTURE_SIZE = 512
MATERIAL_METALLIC = 0.05
MATERIAL_ROUGHNESS = 0.85

# 纹理文件候选列表
TEXTURE_CANDIDATES = [
    "wechat_2025-06-20_092203_424.png",
    "image.png", 
    "texture.png", 
    "badge.png"
]

def analyze_image_and_load_texture(img_path):
    """分析图片尺寸并加载纹理（合并原来的两个函数）"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None, None, None
    
    try:
        img = Image.open(img_path)
        width, height = img.size
        aspect_ratio = width / height
        
        print(f"📸 图片: {os.path.basename(img_path)} ({width}x{height})")
        
        # 计算物理尺寸
        if aspect_ratio < 1.0:
            # 竖向工牌
            real_width_cm = DEFAULT_SIZE_CM
            real_height_cm = real_width_cm / aspect_ratio
        else:
            # 横向工牌
            real_height_cm = DEFAULT_SIZE_CM
            real_width_cm = real_height_cm * aspect_ratio
        
        # 转换为米
        dimensions = (
            real_width_cm / 100,
            real_height_cm / 100,
            DEFAULT_THICKNESS_CM / 100
        )
        
        print(f"📏 尺寸: {real_width_cm:.1f}x{real_height_cm:.1f}x{DEFAULT_THICKNESS_CM:.1f} cm")
        
        # 加载并处理纹理
        if img.mode != 'RGB':
            img = img.convert('RGB')
        texture_img = img.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)
        
        return dimensions, texture_img
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None

def create_cube_geometry(width, height, thickness):
    """创建立方体几何数据"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    
    # 8个基本顶点
    base_verts = np.array([
        [-half_w, -half_h, -half_t], [half_w, -half_h, -half_t],  # 0,1: 下后
        [half_w, half_h, -half_t], [-half_w, half_h, -half_t],    # 2,3: 上后
        [-half_w, -half_h, half_t], [half_w, -half_h, half_t],    # 4,5: 下前
        [half_w, half_h, half_t], [-half_w, half_h, half_t],      # 6,7: 上前
    ])
    
    # 每个面的数据（顶点、UV、法向量）
    face_data = [
        # 前面 (Z+)
        ([4,5,6,7], [[0,0],[1,0],[1,1],[0,1]], [0,0,1]),
        # 后面 (Z-)
        ([0,3,2,1], [[0,0],[0,1],[1,1],[1,0]], [0,0,-1]),
        # 右面 (X+)
        ([5,1,2,6], [[0.98,0],[0.98,1],[1,1],[1,0]], [1,0,0]),
        # 左面 (X-)
        ([4,7,3,0], [[0.02,0],[0.02,1],[0,1],[0,0]], [-1,0,0]),
        # 上面 (Y+)
        ([7,6,2,3], [[0,0.98],[1,0.98],[1,1],[0,1]], [0,1,0]),
        # 下面 (Y-)
        ([4,0,1,5], [[0,0],[1,0],[1,0.02],[0,0.02]], [0,-1,0]),
    ]
    
    vertices, uvs, normals = [], [], []
    indices = []
    
    for i, (vert_indices, face_uvs, normal) in enumerate(face_data):
        base_idx = len(vertices)
        # 添加顶点、UV、法向量
        for vi, uv in zip(vert_indices, face_uvs):
            vertices.append(base_verts[vi])
            uvs.append(uv)
            normals.append(normal)
        
        # 添加面索引（两个三角形）
        indices.extend([base_idx, base_idx+1, base_idx+2])
        indices.extend([base_idx, base_idx+2, base_idx+3])
    
    return (
        np.array(vertices, dtype=np.float32),
        np.array(uvs, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.uint16)
    )

def create_buffer_data(vertices, uvs, normals, indices, texture_img):
    """创建所有缓冲区数据"""
    # 几何数据
    vertex_data = vertices.tobytes()
    uv_data = uvs.tobytes()
    normal_data = normals.tobytes()
    index_data = indices.tobytes()
    
    if texture_img:
        # 纹理数据
        img_bytes = io.BytesIO()
        texture_img.save(img_bytes, format='PNG')
        img_data = img_bytes.getvalue()
        
        # 计算偏移量（4字节对齐）
        padding = (4 - (len(img_data) % 4)) % 4
        geometry_offset = len(img_data) + padding
        
        offsets = {
            'texture': (0, len(img_data)),
            'vertex': (geometry_offset, len(vertex_data)),
            'uv': (geometry_offset + len(vertex_data), len(uv_data)),
            'normal': (geometry_offset + len(vertex_data) + len(uv_data), len(normal_data)),
            'index': (geometry_offset + len(vertex_data) + len(uv_data) + len(normal_data), len(index_data)),
            'has_texture': True
        }
        
        all_data = img_data + b'\x00' * padding + vertex_data + uv_data + normal_data + index_data
    else:
        offsets = {
            'vertex': (0, len(vertex_data)),
            'uv': (len(vertex_data), len(uv_data)),
            'normal': (len(vertex_data) + len(uv_data), len(normal_data)),
            'index': (len(vertex_data) + len(uv_data) + len(normal_data), len(index_data)),
            'has_texture': False
        }
        all_data = vertex_data + uv_data + normal_data + index_data
    
    return all_data, offsets

def create_accessors(vertices, uvs, normals, indices, has_texture):
    """创建所有访问器"""
    bv_offset = 1 if has_texture else 0
    
    accessors = []
    
    # 顶点访问器
    vertex_accessor = Accessor()
    vertex_accessor.bufferView = bv_offset
    vertex_accessor.componentType = FLOAT
    vertex_accessor.count = len(vertices)
    vertex_accessor.type = "VEC3"
    vertex_accessor.min = vertices.min(axis=0).tolist()
    vertex_accessor.max = vertices.max(axis=0).tolist()
    accessors.append(vertex_accessor)
    
    # UV、法向量、索引访问器
    accessor_configs = [
        (bv_offset + 1, FLOAT, len(uvs), "VEC2"),      # UV
        (bv_offset + 2, FLOAT, len(normals), "VEC3"),  # 法向量
        (bv_offset + 3, UNSIGNED_SHORT, len(indices), "SCALAR")  # 索引
    ]
    
    for buffer_view, component_type, count, type_name in accessor_configs:
        accessor = Accessor()
        accessor.bufferView = buffer_view
        accessor.componentType = component_type
        accessor.count = count
        accessor.type = type_name
        accessors.append(accessor)
    
    return accessors

def create_gltf(vertices, uvs, normals, indices, texture_img, output_path):
    """创建GLTF文件"""
    gltf = GLTF2()
    
    # 创建缓冲区数据
    all_data, offsets = create_buffer_data(vertices, uvs, normals, indices, texture_img)
    
    # Buffer
    buffer = Buffer()
    buffer.byteLength = len(all_data)
    buffer.uri = f"data:application/octet-stream;base64,{base64.b64encode(all_data).decode('ascii')}"
    gltf.buffers = [buffer]
    
    # BufferViews
    buffer_views = []
    
    if offsets['has_texture']:
        # 纹理BufferView
        texture_bv = BufferView()
        texture_bv.buffer = 0
        texture_bv.byteOffset, texture_bv.byteLength = offsets['texture']
        buffer_views.append(texture_bv)
    
    # 几何数据BufferViews
    for name, target in [('vertex', ARRAY_BUFFER), ('uv', ARRAY_BUFFER), 
                        ('normal', ARRAY_BUFFER), ('index', ELEMENT_ARRAY_BUFFER)]:
        bv = BufferView()
        bv.buffer = 0
        bv.byteOffset, bv.byteLength = offsets[name]
        bv.target = target
        buffer_views.append(bv)
    
    gltf.bufferViews = buffer_views
    
    # Accessors
    gltf.accessors = create_accessors(vertices, uvs, normals, indices, offsets['has_texture'])
    
    # 纹理和材质
    if offsets['has_texture']:
        # 图像、采样器、纹理
        gltf.images = [GLTFImage(mimeType="image/png", bufferView=0)]
        gltf.samplers = [Sampler(magFilter=9729, minFilter=9729, wrapS=10497, wrapT=10497)]
        gltf.textures = [Texture(sampler=0, source=0)]
        
        # 材质（带纹理）
        pbr = PbrMetallicRoughness(
            metallicFactor=MATERIAL_METALLIC,
            roughnessFactor=MATERIAL_ROUGHNESS,
            baseColorTexture=TextureInfo(index=0)
        )
    else:
        # 材质（无纹理）
        pbr = PbrMetallicRoughness(
            metallicFactor=MATERIAL_METALLIC,
            roughnessFactor=MATERIAL_ROUGHNESS,
            baseColorFactor=[0.9, 0.9, 0.9, 1.0]
        )
    
    gltf.materials = [Material(name="BadgeMaterial", pbrMetallicRoughness=pbr)]
    
    # 网格
    primitive = Primitive()
    primitive.attributes.POSITION = 0
    primitive.attributes.TEXCOORD_0 = 1
    primitive.attributes.NORMAL = 2
    primitive.indices = 3
    primitive.material = 0
    
    gltf.meshes = [Mesh(name="BadgeMesh", primitives=[primitive])]
    
    # 场景
    gltf.nodes = [Node(name="BadgeNode", mesh=0)]
    gltf.scenes = [Scene(name="BadgeScene", nodes=[0])]
    gltf.scene = 0
    
    # 导出
    try:
        gltf.save(output_path)
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"✅ 导出成功: {os.path.basename(output_path)} ({file_size:,} 字节)")
            return True
    except Exception as e:
        print(f"❌ 导出失败: {e}")
    
    return False

def find_texture_file():
    """查找可用的纹理文件"""
    for filename in TEXTURE_CANDIDATES:
        path = os.path.join(os.getcwd(), filename)
        if os.path.exists(path):
            return path
    return None

def main():
    """主函数"""
    print("🔲 自适应立方体GLB工牌生成器")
    print("=" * 40)
    
    # 查找并处理纹理文件
    texture_path = find_texture_file()
    if not texture_path:
        print("❌ 未找到任何图像文件")
        return
    
    # 分析图像并加载纹理
    result = analyze_image_and_load_texture(texture_path)
    if not result[0]:
        print("⚠️ 使用默认尺寸")
        dimensions = (0.060, 0.091, 0.005)
        texture_img = None
    else:
        dimensions, texture_img = result
    
    # 生成输出文件名
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    output_path = os.path.join(os.getcwd(), f"工牌_{base_name}_简化版.glb")
    
    # 创建几何数据
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_geometry(*dimensions)
    
    # 创建GLB文件
    print("📦 生成GLB文件...")
    success = create_gltf(vertices, uvs, normals, indices, texture_img, output_path)
    
    if success:
        width_m, height_m, thickness_m = dimensions
        print(f"\n🎉 生成完成!")
        print(f"📁 文件: {os.path.basename(output_path)}")
        print(f"📏 尺寸: {width_m*100:.1f}x{height_m*100:.1f}x{thickness_m*100:.1f} cm")
    else:
        print("\n❌ 生成失败")

if __name__ == "__main__":
    main() 