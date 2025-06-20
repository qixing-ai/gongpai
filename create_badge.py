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
from pygltflib import (
    GLTF2, Buffer, BufferView, Accessor, Material, PbrMetallicRoughness, 
    TextureInfo, Image, Sampler, Texture, Mesh, Primitive, Attributes, Node, Scene,
    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, FLOAT, UNSIGNED_SHORT, UNSIGNED_INT
)

# 常量定义
FIXED_WIDTH_CM, FIXED_HEIGHT_CM, DEFAULT_THICKNESS_CM = 6.0, 9.0, 0.2
BORDER_CM = 0.5
TEXTURE_SIZE = 512
FRONT_BACK_SUBDIVISIONS, SIDE_SUBDIVISIONS = 512, 2
TEXTURE_FILE = "1.png"
OUTPUT_DIR = "output"

# 一字孔常量定义
HOLE_WIDTH_MM = 9.0
HOLE_HEIGHT_MM = 2.0
HOLE_TOP_DISTANCE_CM = 8.7

def load_and_process_texture(img_path):
    """加载并处理纹理图像"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None
    
    try:
        img = PILImage.open(img_path).convert('RGB')
        w, h = img.size
        print(f"📸 图片: {os.path.basename(img_path)} ({w}x{h})")
        
        # 固定工牌尺寸
        dimensions = (FIXED_WIDTH_CM / 100, FIXED_HEIGHT_CM / 100, DEFAULT_THICKNESS_CM / 100)
        badge_ratio = FIXED_WIDTH_CM / FIXED_HEIGHT_CM
        img_ratio = w / h
        
        # 调整图片尺寸
        if img_ratio > badge_ratio:
            new_size = (w, int(w / badge_ratio))
            offset = (0, (new_size[1] - h) // 2)
        else:
            new_size = (int(h * badge_ratio), h)
            offset = ((new_size[0] - w) // 2, 0)
        
        padded_img = PILImage.new('RGB', new_size, (255, 255, 255))
        padded_img.paste(img, offset)
        
        # 创建带边框的纹理
        border_h = int(TEXTURE_SIZE * BORDER_CM / FIXED_WIDTH_CM)
        border_v = int(TEXTURE_SIZE * BORDER_CM / FIXED_HEIGHT_CM)
        inner_size = (TEXTURE_SIZE - 2 * border_h, TEXTURE_SIZE - 2 * border_v)
        
        texture_img = PILImage.new('RGB', (TEXTURE_SIZE, TEXTURE_SIZE), (255, 255, 255))
        center_img = padded_img.resize(inner_size, PILImage.LANCZOS)
        texture_img.paste(center_img, (border_h, border_v))
        
        print(f"📏 固定尺寸: {FIXED_WIDTH_CM:.1f}x{FIXED_HEIGHT_CM:.1f}x{DEFAULT_THICKNESS_CM:.1f} cm")
        return dimensions, texture_img
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None

def bilinear_interpolate(corners, uvs, u, v):
    """双线性插值计算位置和UV"""
    pos = ((1-u)*(1-v)*corners[0] + u*(1-v)*corners[1] + 
           u*v*corners[2] + (1-u)*v*corners[3])
    uv = ((1-u)*(1-v)*np.array(uvs[0]) + u*(1-v)*np.array(uvs[1]) + 
          u*v*np.array(uvs[2]) + (1-u)*v*np.array(uvs[3]))
    return pos, uv

def create_face_mesh(corners, uvs, normal, subdivisions):
    """创建单个面的网格数据"""
    vertices, face_uvs, normals, indices = [], [], [], []
    
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            pos, uv = bilinear_interpolate(corners, uvs, u, v)
            
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

def is_point_in_hole(x, y, hole_bounds):
    """检查点是否在孔洞内"""
    left, right, bottom, top = hole_bounds
    return left <= x <= right and bottom <= y <= top

def create_face_with_hole(corners, uvs, normal, subdivisions, hole_bounds):
    """创建带孔洞的面网格"""
    vertices, face_uvs, normals, indices = [], [], [], []
    vertex_map = {}
    current_idx = 0
    
    # 生成顶点（跳过孔洞内的点）
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            pos, uv_coord = bilinear_interpolate(corners, uvs, u, v)
            
            if not is_point_in_hole(pos[0], pos[1], hole_bounds):
                vertices.append(pos)
                face_uvs.append(uv_coord)
                normals.append(normal)
                vertex_map[(i, j)] = current_idx
                current_idx += 1
    
    # 生成三角形索引
    for i in range(subdivisions):
        for j in range(subdivisions):
            quad_vertices = [(i, j), (i+1, j), (i+1, j+1), (i, j+1)]
            if all(pos in vertex_map for pos in quad_vertices):
                v0, v1, v2, v3 = [vertex_map[pos] for pos in quad_vertices]
                indices.extend([v0, v1, v2, v0, v2, v3])
    
    return vertices, face_uvs, normals, indices

def create_hole_wall(corners, uvs, normal):
    """创建孔洞内壁面"""
    return create_face_mesh([np.array(v) for v in corners], uvs, normal, 2)

def create_cube_geometry(width, height, thickness):
    """创建立方体几何体"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    
    # 孔洞参数
    hole_width = HOLE_WIDTH_MM / 1000
    hole_height = HOLE_HEIGHT_MM / 1000
    hole_y_offset = height - (HOLE_TOP_DISTANCE_CM / 100)
    hole_center_y = hole_y_offset - height/2
    
    hole_bounds = (-hole_width/2, hole_width/2, 
                   hole_center_y - hole_height/2, hole_center_y + hole_height/2)
    
    print(f"🕳️ 一字孔设置: {HOLE_WIDTH_MM:.1f}x{HOLE_HEIGHT_MM:.1f}mm, 距顶部{HOLE_TOP_DISTANCE_CM:.1f}cm")
    
    faces = []
    
    # 前后面（带孔洞）
    front_back_configs = [
        ([[-half_w, -half_h, half_t], [half_w, -half_h, half_t], 
          [half_w, half_h, half_t], [-half_w, half_h, half_t]], [0, 0, 1]),
        ([[half_w, -half_h, -half_t], [-half_w, -half_h, -half_t], 
          [-half_w, half_h, -half_t], [half_w, half_h, -half_t]], [0, 0, -1])
    ]
    
    for corners, normal in front_back_configs:
        uvs = [[1, 0], [0, 0], [0, 1], [1, 1]]
        face_data = create_face_with_hole([np.array(v) for v in corners], uvs, normal, 
                                        FRONT_BACK_SUBDIVISIONS, hole_bounds)
        faces.append(face_data)
    
    # 四个侧面
    side_configs = [
        ([[half_w, -half_h, half_t], [half_w, -half_h, -half_t], 
          [half_w, half_h, -half_t], [half_w, half_h, half_t]], [1, 0, 0]),
        ([[-half_w, -half_h, -half_t], [-half_w, -half_h, half_t], 
          [-half_w, half_h, half_t], [-half_w, half_h, -half_t]], [-1, 0, 0]),
        ([[-half_w, half_h, half_t], [half_w, half_h, half_t], 
          [half_w, half_h, -half_t], [-half_w, half_h, -half_t]], [0, 1, 0]),
        ([[-half_w, -half_h, -half_t], [half_w, -half_h, -half_t], 
          [half_w, -half_h, half_t], [-half_w, -half_h, half_t]], [0, -1, 0])
    ]
    
    for corners, normal in side_configs:
        # 侧面使用边框UV
        uv = [[0, 0], [0, 1], [0, 1], [0, 0]] if normal[0] != 0 else [[0, 0], [1, 0], [1, 0], [0, 0]]
        face_data = create_face_mesh([np.array(v) for v in corners], uv, normal, SIDE_SUBDIVISIONS)
        faces.append(face_data)
    
    # 孔洞内壁面
    center_y = hole_y_offset - FIXED_HEIGHT_CM / 200
    half_hw, half_hh = hole_width/2, hole_height/2
    
    hole_walls = [
        # 上壁
        ([[-half_hw, center_y + half_hh, half_t], [half_hw, center_y + half_hh, half_t],
          [half_hw, center_y + half_hh, -half_t], [-half_hw, center_y + half_hh, -half_t]], [0, -1, 0]),
        # 下壁
        ([[half_hw, center_y - half_hh, half_t], [-half_hw, center_y - half_hh, half_t],
          [-half_hw, center_y - half_hh, -half_t], [half_hw, center_y - half_hh, -half_t]], [0, 1, 0]),
        # 左壁
        ([[-half_hw, center_y - half_hh, half_t], [-half_hw, center_y + half_hh, half_t],
          [-half_hw, center_y + half_hh, -half_t], [-half_hw, center_y - half_hh, -half_t]], [1, 0, 0]),
        # 右壁
        ([[half_hw, center_y + half_hh, half_t], [half_hw, center_y - half_hh, half_t],
          [half_hw, center_y - half_hh, -half_t], [half_hw, center_y + half_hh, -half_t]], [-1, 0, 0])
    ]
    
    for corners, normal in hole_walls:
        uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
        faces.append(create_hole_wall(corners, uvs, normal))
    
    # 合并所有面的数据
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    for vertices, face_uvs, normals, indices in faces:
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(face_uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    return (np.array(all_vertices, dtype=np.float32), 
            np.array(all_uvs, dtype=np.float32),
            np.array(all_normals, dtype=np.float32), 
            np.array(all_indices, dtype=np.uint32))

def create_glb_model(vertices, uvs, normals, indices, texture_img, output_path):
    """创建并保存GLB文件"""
    # 准备几何数据
    index_type = np.uint16 if len(vertices) < 65536 else np.uint32
    geo_data = [vertices.tobytes(), uvs.tobytes(), normals.tobytes(), indices.astype(index_type).tobytes()]
    
    # 处理纹理数据
    if texture_img:
        img_bytes = io.BytesIO()
        texture_img.save(img_bytes, format='PNG')
        img_data = img_bytes.getvalue()
        padding = (4 - (len(img_data) % 4)) % 4
        all_data = img_data + b'\x00' * padding + b''.join(geo_data)
        geo_offset = len(img_data) + padding
    else:
        all_data = b''.join(geo_data)
        geo_offset = 0
    
    # 创建GLTF对象
    gltf = GLTF2()
    gltf.buffers = [Buffer(byteLength=len(all_data),
                          uri=f"data:application/octet-stream;base64,{base64.b64encode(all_data).decode()}")]
    
    # 创建缓冲区视图
    buffer_views = []
    if texture_img:
        buffer_views.append(BufferView(buffer=0, byteOffset=0, byteLength=len(img_data)))
    
    targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER]
    offset = geo_offset
    for data, target in zip(geo_data, targets):
        buffer_views.append(BufferView(buffer=0, byteOffset=offset, byteLength=len(data), target=target))
        offset += len(data)
    
    gltf.bufferViews = buffer_views
    
    # 创建访问器
    bv_offset = 1 if texture_img else 0
    component_type = UNSIGNED_SHORT if len(vertices) < 65536 else UNSIGNED_INT
    
    gltf.accessors = [
        Accessor(bufferView=bv_offset, componentType=FLOAT, count=len(vertices), type="VEC3",
                min=vertices.min(axis=0).tolist(), max=vertices.max(axis=0).tolist()),
        Accessor(bufferView=bv_offset+1, componentType=FLOAT, count=len(uvs), type="VEC2"),
        Accessor(bufferView=bv_offset+2, componentType=FLOAT, count=len(normals), type="VEC3"),
        Accessor(bufferView=bv_offset+3, componentType=component_type, count=len(indices), type="SCALAR")
    ]
    
    # 创建材质
    if texture_img:
        gltf.images = [Image(mimeType="image/png", bufferView=0)]
        gltf.samplers = [Sampler(magFilter=9729, minFilter=9729, wrapS=10497, wrapT=10497)]
        gltf.textures = [Texture(sampler=0, source=0)]
        pbr = PbrMetallicRoughness(baseColorTexture=TextureInfo(index=0))
    else:
        pbr = PbrMetallicRoughness(baseColorFactor=[0.9, 0.9, 0.9, 1.0])
    
    gltf.materials = [Material(name="BadgeMaterial", pbrMetallicRoughness=pbr)]
    
    # 创建网格和场景
    primitive = Primitive(attributes=Attributes(POSITION=0, TEXCOORD_0=1, NORMAL=2), indices=3, material=0)
    gltf.meshes = [Mesh(name="BadgeMesh", primitives=[primitive])]
    gltf.nodes = [Node(name="BadgeNode", mesh=0)]
    gltf.scenes = [Scene(name="BadgeScene", nodes=[0])]
    gltf.scene = 0
    
    # 保存文件
    try:
        gltf.save(output_path)
        file_size = os.path.getsize(output_path)
        print(f"✅ GLB导出成功: {os.path.basename(output_path)} ({file_size:,} 字节)")
        return True
    except Exception as e:
        print(f"❌ GLB导出失败: {e}")
        return False

def convert_glb_to_obj(glb_path, obj_path):
    """转换GLB到OBJ格式"""
    try:
        print("🔄 转换GLB到OBJ...")
        scene = trimesh.load(glb_path, file_type='glb')
        mesh = (trimesh.util.concatenate([g for g in scene.geometry.values()]) 
                if isinstance(scene, trimesh.Scene) else scene)
        
        # 尝试提取纹理颜色
        if (hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None and
            hasattr(mesh.visual, 'material') and mesh.visual.material and 
            hasattr(mesh.visual.material, 'baseColorTexture') and 
            mesh.visual.material.baseColorTexture):
            
            texture = mesh.visual.material.baseColorTexture
            texture_array = np.array(texture)
            tex_h, tex_w = texture_array.shape[:2]
            
            u_coords = np.clip(mesh.visual.uv[:, 0] * (tex_w - 1), 0, tex_w - 1).astype(int)
            v_coords = np.clip((1 - mesh.visual.uv[:, 1]) * (tex_h - 1), 0, tex_h - 1).astype(int)
            colors = texture_array[v_coords, u_coords, :3]
            
            mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, vertex_colors=colors)
            mesh.export(obj_path, file_type='obj', include_color=True, include_normals=False, include_texture=False)
            print(f"✅ 带纹理颜色的OBJ导出成功: {os.path.basename(obj_path)}")
            return True
        
        # 处理其他颜色类型
        export_kwargs = {'file_type': 'obj', 'include_color': True, 'include_normals': False, 'include_texture': False}
        
        if hasattr(mesh.visual, 'kind'):
            if mesh.visual.kind == 'vertex' and mesh.visual.vertex_colors is not None:
                mesh.export(obj_path, **export_kwargs)
                print(f"✅ 顶点颜色OBJ导出成功: {os.path.basename(obj_path)}")
                return True
            elif mesh.visual.kind == 'face' and mesh.visual.face_colors is not None:
                # 面颜色转顶点颜色
                face_colors = mesh.visual.face_colors
                vertex_colors = np.zeros((len(mesh.vertices), 3))
                vertex_counts = np.zeros(len(mesh.vertices))
                
                for i, face in enumerate(mesh.faces):
                    vertex_colors[face] += face_colors[i, :3]
                    vertex_counts[face] += 1
                
                vertex_counts[vertex_counts == 0] = 1
                vertex_colors = (vertex_colors / vertex_counts[:, np.newaxis]).astype(np.uint8)
                
                colored_mesh = trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, vertex_colors=vertex_colors)
                colored_mesh.export(obj_path, **export_kwargs)
                print(f"✅ 面颜色转换OBJ导出成功: {os.path.basename(obj_path)}")
                return True
        
        # 无颜色导出
        mesh.export(obj_path, file_type='obj')
        print(f"✅ 无颜色OBJ导出成功: {os.path.basename(obj_path)}")
        return True
        
    except Exception as e:
        print(f"❌ OBJ转换失败: {e}")
        return False

def main():
    """主函数"""
    print("🔲 固定尺寸立方体GLB工牌生成器 - 简化版")
    print("=" * 50)
    print("📐 固定尺寸: 6.0x9.0x0.2 cm - 图片自适应缩放")
    
    # 创建输出目录
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 处理纹理
    texture_path = os.path.join(os.getcwd(), TEXTURE_FILE)
    if not os.path.exists(texture_path):
        print("❌ 未找到图像文件")
        return
    
    dimensions, texture_img = load_and_process_texture(texture_path) or (
        (FIXED_WIDTH_CM / 100, FIXED_HEIGHT_CM / 100, DEFAULT_THICKNESS_CM / 100), None)
    
    if texture_img is None:
        print("⚠️ 使用默认尺寸")
    
    # 生成文件路径
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    glb_path = os.path.join(OUTPUT_DIR, f"工牌_{base_name}.glb")
    obj_path = os.path.join(OUTPUT_DIR, f"工牌_{base_name}.obj")
    
    # 创建几何体
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_geometry(*dimensions)
    
    # 导出GLB
    print("📦 生成GLB文件...")
    if create_glb_model(vertices, uvs, normals, indices, texture_img, glb_path):
        w, h, t = dimensions
        print(f"📁 GLB文件: {os.path.basename(glb_path)}")
        print(f"📏 尺寸: {w*100:.1f}x{h*100:.1f}x{t*100:.1f} cm")
        
        # 转换OBJ
        print("\n📋 转换为OBJ格式...")
        if convert_glb_to_obj(glb_path, obj_path):
            print(f"📁 OBJ文件: {os.path.basename(obj_path)}")
            print(f"\n🎉 完成! 已生成GLB和OBJ两种格式")
        else:
            print("\n⚠️ OBJ转换失败，但GLB已生成")
    else:
        print("\n❌ 生成失败")

if __name__ == "__main__":
    main() 