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

class Config:
    # 直接使用米为单位的尺寸参数
    FIXED_WIDTH = 0.06  # 6.0cm
    FIXED_HEIGHT = 0.09  # 9.0cm
    DEFAULT_THICKNESS = 0.002  # 0.2cm
    
    TEXTURE_SIZE = 512
    TEXTURE_FILE = "3.png"
    OUTPUT_DIR = "output"
    
    SUBDIVISIONS = 512
    
    UV_MAPPING_MAX_WIDTH = 0.05  # 5.0cm
    UV_MAPPING_MAX_HEIGHT = 0.08  # 8.0cm
    
    HOLE_WIDTH = 0.020  # 20.0mm
    HOLE_HEIGHT = 0.002  # 2.0mm
    HOLE_TOP_DISTANCE = 0.087  # 8.7cm
    HOLE_CORNER_RADIUS = 0.0006  # 0.6mm
    
    CORNER_RADIUS = 0.004  # 0.4cm
    EDGE_RADIUS = 0.001  # 0.1cm - 边缘倒角半径

def is_point_in_rounded_hole(x, y, hole_center_x, hole_center_y, hole_width, hole_height, corner_radius):
    """检查点是否在带倒角的矩形孔洞内"""
    rel_x = x - hole_center_x
    rel_y = y - hole_center_y
    half_width = hole_width / 2
    half_height = hole_height / 2
    
    # 主要矩形区域
    if abs(rel_x) <= half_width - corner_radius or abs(rel_y) <= half_height - corner_radius:
        if abs(rel_x) <= half_width and abs(rel_y) <= half_height:
            return True
    
    # 四个圆角区域
    corner_centers = [
        (half_width - corner_radius, half_height - corner_radius),
        (-half_width + corner_radius, half_height - corner_radius),
        (-half_width + corner_radius, -half_height + corner_radius),
        (half_width - corner_radius, -half_height + corner_radius)
    ]
    
    for corner_x, corner_y in corner_centers:
        if (abs(rel_x) > half_width - corner_radius and abs(rel_y) > half_height - corner_radius and
            np.sign(rel_x) == np.sign(corner_x) and np.sign(rel_y) == np.sign(corner_y)):
            dx = rel_x - corner_x
            dy = rel_y - corner_y
            if np.sqrt(dx*dx + dy*dy) <= corner_radius:
                return True
    
    return False

def load_and_process_texture(img_path):
    """加载并处理纹理图像"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None, None
    
    try:
        img = PILImage.open(img_path).convert('RGB')
        w, h = img.size
        print(f"📸 图片: {os.path.basename(img_path)} ({w}x{h})")
        
        img_ratio = w / h
        dimensions = (Config.FIXED_WIDTH, Config.FIXED_HEIGHT, Config.DEFAULT_THICKNESS)
        
        # 计算UV映射区域
        max_uv_width = Config.UV_MAPPING_MAX_WIDTH
        max_uv_height = Config.UV_MAPPING_MAX_HEIGHT
        
        if img_ratio > (max_uv_width / max_uv_height):
            uv_width = max_uv_width
            uv_height = max_uv_width / img_ratio
        else:
            uv_height = max_uv_height
            uv_width = max_uv_height * img_ratio
        
        uv_width = min(uv_width, Config.FIXED_WIDTH * 0.9)
        uv_height = min(uv_height, Config.FIXED_HEIGHT * 0.9)
        
        # 创建纹理图像
        texture_size = Config.TEXTURE_SIZE
        if img_ratio > 1:
            new_width = texture_size
            new_height = int(texture_size / img_ratio)
        else:
            new_height = texture_size
            new_width = int(texture_size * img_ratio)
        
        resized_img = img.resize((new_width, new_height), PILImage.LANCZOS)
        texture_img = PILImage.new('RGB', (texture_size, texture_size), (255, 255, 255))
        paste_x = (texture_size - new_width) // 2
        paste_y = (texture_size - new_height) // 2
        texture_img.paste(resized_img, (paste_x, paste_y))
        
        uv_info = {
            'width': uv_width,
            'height': uv_height,
            'uv_bounds': (paste_x / texture_size, (paste_x + new_width) / texture_size,
                         paste_y / texture_size, (paste_y + new_height) / texture_size)
        }
        
        return dimensions, texture_img, uv_info
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, None

def get_edge_distance(x, y, half_w, half_h):
    """计算点到边缘的最小距离"""
    return min(x + half_w, half_w - x, y + half_h, half_h - y)

def apply_edge_chamfer(z_base, edge_dist, edge_radius, is_front):
    """应用边缘倒角"""
    if edge_dist < edge_radius:
        edge_factor = max(0, edge_dist / edge_radius)
        curve_factor = np.sqrt(1 - (1 - edge_factor) ** 2)
        z_offset = edge_radius * (1 - curve_factor)
        return z_base - z_offset if is_front else z_base + z_offset
    return z_base

def apply_corner_clamp(x, y, half_w, half_h, corner_radius):
    """应用角部限制"""
    corner_x = half_w - corner_radius
    corner_y = half_h - corner_radius
    
    if abs(x) > corner_x and abs(y) > corner_y:
        center_x = np.sign(x) * corner_x
        center_y = np.sign(y) * corner_y
        dx, dy = x - center_x, y - center_y
        dist = np.sqrt(dx*dx + dy*dy)
        if dist > corner_radius:
            x = center_x + (dx / dist) * corner_radius
            y = center_y + (dy / dist) * corner_radius
    
    return x, y

def calculate_normal(edge_dist, edge_radius, normal_base, half_w, half_h, x, y):
    """计算法向量"""
    if edge_dist < edge_radius:
        edge_normal_factor = max(0, edge_dist / edge_radius)
        
        # 确定边缘方向
        dist_to_left = x + half_w
        dist_to_right = half_w - x
        dist_to_bottom = y + half_h
        dist_to_top = half_h - y
        
        if dist_to_left == edge_dist:
            edge_normal = [-1, 0, 0]
        elif dist_to_right == edge_dist:
            edge_normal = [1, 0, 0]
        elif dist_to_bottom == edge_dist:
            edge_normal = [0, -1, 0]
        else:
            edge_normal = [0, 1, 0]
        
        # 混合法向量
        face_normal = np.array(normal_base)
        edge_normal = np.array(edge_normal)
        mixed_normal = face_normal * edge_normal_factor + edge_normal * (1 - edge_normal_factor)
        return (mixed_normal / np.linalg.norm(mixed_normal)).tolist()
    
    return normal_base

def calculate_uv(x, y, width, height, uv_info, is_front):
    """计算UV坐标"""
    uv_width = uv_info['width']
    uv_height = uv_info['height']
    uv_start_x, uv_end_x, uv_start_y, uv_end_y = uv_info['uv_bounds']
    
    uv_offset_x = (width - uv_width) / 2
    uv_offset_y = (height - uv_height) / 2
    
    x_in_uv_region = x + width/2 - uv_offset_x
    y_in_uv_region = y + height/2 - uv_offset_y
    
    u_in_region = x_in_uv_region / uv_width if uv_width > 0 else 0.5
    v_in_region = y_in_uv_region / uv_height if uv_height > 0 else 0.5
    
    if 0 <= u_in_region <= 1 and 0 <= v_in_region <= 1:
        u = uv_start_x + u_in_region * (uv_end_x - uv_start_x)
        v = uv_start_y + v_in_region * (uv_end_y - uv_start_y)
    else:
        u = v = 0.5
    
    return [1.0 - u, v] if is_front else [u, v]

def create_face_mesh(width, height, thickness, uv_info, is_front=True):
    """创建带边缘倒角的面网格"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    z_pos = half_t if is_front else -half_t
    normal_base = [0, 0, 1] if is_front else [0, 0, -1]
    
    # 孔洞参数
    hole_width = Config.HOLE_WIDTH
    hole_height = Config.HOLE_HEIGHT
    hole_corner_radius = Config.HOLE_CORNER_RADIUS
    hole_y_offset = height - Config.HOLE_TOP_DISTANCE
    hole_center_y = hole_y_offset - height/2
    hole_center_x = 0
    
    vertices, uvs, normals, indices = [], [], [], []
    vertex_map = {}
    current_idx = 0
    
    subdivisions = Config.SUBDIVISIONS
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            x = (i / subdivisions - 0.5) * width
            y = (j / subdivisions - 0.5) * height
            
            # 检查是否在孔洞内
            if is_point_in_rounded_hole(x, y, hole_center_x, hole_center_y, hole_width, hole_height, hole_corner_radius):
                continue
            
            # 应用角部限制
            x, y = apply_corner_clamp(x, y, half_w, half_h, Config.CORNER_RADIUS)
            
            # 计算边缘距离和Z坐标
            edge_dist = get_edge_distance(x, y, half_w, half_h)
            z = apply_edge_chamfer(z_pos, edge_dist, Config.EDGE_RADIUS, is_front)
            
            vertices.append([x, y, z])
            normals.append(calculate_normal(edge_dist, Config.EDGE_RADIUS, normal_base, half_w, half_h, x, y))
            uvs.append(calculate_uv(x, y, width, height, uv_info, is_front))
            
            vertex_map[i * (subdivisions + 1) + j] = current_idx
            current_idx += 1
    
    # 生成索引
    for i in range(subdivisions):
        for j in range(subdivisions):
            quad = [i * (subdivisions + 1) + j, (i + 1) * (subdivisions + 1) + j,
                   (i + 1) * (subdivisions + 1) + j + 1, i * (subdivisions + 1) + j + 1]
            
            if all(idx in vertex_map for idx in quad):
                mapped = [vertex_map[idx] for idx in quad]
                if is_front:
                    indices.extend([mapped[0], mapped[1], mapped[2], mapped[0], mapped[2], mapped[3]])
                else:
                    indices.extend([mapped[0], mapped[2], mapped[1], mapped[0], mapped[3], mapped[2]])
    
    return vertices, uvs, normals, indices

def generate_outline_points(half_w, half_h, corner_radius, num_points=64):
    """生成轮廓点"""
    corner_x = half_w - corner_radius
    corner_y = half_h - corner_radius
    
    outline_vertices = []
    corners = [
        (corner_x, corner_y, 0, np.pi/2),
        (-corner_x, corner_y, np.pi/2, np.pi),
        (-corner_x, -corner_y, np.pi, 3*np.pi/2),
        (corner_x, -corner_y, 3*np.pi/2, 2*np.pi)
    ]
    
    for center_x, center_y, start_angle, end_angle in corners:
        for i in range(num_points // 4 + 1):
            angle = start_angle + i * (end_angle - start_angle) / (num_points // 4)
            x = center_x + corner_radius * np.cos(angle)
            y = center_y + corner_radius * np.sin(angle)
            outline_vertices.append([x, y])
    
    return outline_vertices

def create_side_mesh(width, height, thickness):
    """创建侧面网格"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    outline_vertices = generate_outline_points(half_w, half_h, Config.CORNER_RADIUS)
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    for i in range(len(outline_vertices)):
        next_i = (i + 1) % len(outline_vertices)
        x1, y1 = outline_vertices[i]
        x2, y2 = outline_vertices[next_i]
        
        # 计算Z坐标
        edge_dist1 = get_edge_distance(x1, y1, half_w, half_h)
        edge_dist2 = get_edge_distance(x2, y2, half_w, half_h)
        
        z1_front = apply_edge_chamfer(half_t, edge_dist1, Config.EDGE_RADIUS, True)
        z2_front = apply_edge_chamfer(half_t, edge_dist2, Config.EDGE_RADIUS, True)
        z1_back = apply_edge_chamfer(-half_t, edge_dist1, Config.EDGE_RADIUS, False)
        z2_back = apply_edge_chamfer(-half_t, edge_dist2, Config.EDGE_RADIUS, False)
        
        # 创建四边形
        quad_vertices = [
            [x1, y1, z1_front], [x2, y2, z2_front],
            [x2, y2, z2_back], [x1, y1, z1_back]
        ]
        
        # 计算法向量
        edge_vec = np.array([x2 - x1, y2 - y1, 0])
        normal = np.cross(edge_vec, [0, 0, 1])
        if np.linalg.norm(normal) > 0:
            normal = normal / np.linalg.norm(normal)
        
        base_idx = len(all_vertices)
        all_vertices.extend(quad_vertices)
        all_uvs.extend([[0, 0], [1, 0], [1, 1], [0, 1]])
        all_normals.extend([normal] * 4)
        all_indices.extend([base_idx, base_idx + 1, base_idx + 2, 
                           base_idx, base_idx + 2, base_idx + 3])
    
    return all_vertices, all_uvs, all_normals, all_indices

def create_hole_mesh(width, height, thickness):
    """创建孔洞内壁网格"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    hole_width = Config.HOLE_WIDTH
    hole_height = Config.HOLE_HEIGHT
    hole_corner_radius = Config.HOLE_CORNER_RADIUS
    hole_y_offset = height - Config.HOLE_TOP_DISTANCE
    center_y = hole_y_offset - height/2
    center_x = 0
    
    # 生成孔洞轮廓点
    half_hw, half_hh = hole_width/2, hole_height/2
    corner_centers = [
        (center_x + half_hw - hole_corner_radius, center_y + half_hh - hole_corner_radius),
        (center_x - half_hw + hole_corner_radius, center_y + half_hh - hole_corner_radius),
        (center_x - half_hw + hole_corner_radius, center_y - half_hh + hole_corner_radius),
        (center_x + half_hw - hole_corner_radius, center_y - half_hh + hole_corner_radius)
    ]
    
    angle_ranges = [(0, np.pi/2), (np.pi/2, np.pi), (np.pi, 3*np.pi/2), (3*np.pi/2, 2*np.pi)]
    
    outline_vertices = []
    for (corner_x, corner_y), (start_angle, end_angle) in zip(corner_centers, angle_ranges):
        for i in range(9):  # 每个角8个点
            angle = start_angle + i * (end_angle - start_angle) / 8
            x = corner_x + hole_corner_radius * np.cos(angle)
            y = corner_y + hole_corner_radius * np.sin(angle)
            outline_vertices.append([x, y])
    
    # 去重
    unique_vertices = []
    for vertex in outline_vertices:
        is_duplicate = any(abs(vertex[0] - existing[0]) < 1e-6 and abs(vertex[1] - existing[1]) < 1e-6 
                          for existing in unique_vertices)
        if not is_duplicate:
            unique_vertices.append(vertex)
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    for i in range(len(unique_vertices)):
        next_i = (i + 1) % len(unique_vertices)
        x1, y1 = unique_vertices[i]
        x2, y2 = unique_vertices[next_i]
        
        # 计算Z坐标
        edge_dist1 = get_edge_distance(x1, y1, half_w, half_h)
        edge_dist2 = get_edge_distance(x2, y2, half_w, half_h)
        
        z1_front = apply_edge_chamfer(half_t, edge_dist1, Config.EDGE_RADIUS, True)
        z2_front = apply_edge_chamfer(half_t, edge_dist2, Config.EDGE_RADIUS, True)
        z1_back = apply_edge_chamfer(-half_t, edge_dist1, Config.EDGE_RADIUS, False)
        z2_back = apply_edge_chamfer(-half_t, edge_dist2, Config.EDGE_RADIUS, False)
        
        # 创建内壁四边形
        quad_vertices = [
            [x1, y1, z1_front], [x2, y2, z2_front],
            [x2, y2, z2_back], [x1, y1, z1_back]
        ]
        
        # 计算内向法向量
        edge_vec = np.array([x2 - x1, y2 - y1, 0])
        outward_normal = np.cross([0, 0, 1], edge_vec)
        if np.linalg.norm(outward_normal) > 0:
            outward_normal = outward_normal / np.linalg.norm(outward_normal)
        
        base_idx = len(all_vertices)
        all_vertices.extend(quad_vertices)
        all_uvs.extend([[0, 0], [1, 0], [1, 1], [0, 1]])
        all_normals.extend([outward_normal] * 4)
        all_indices.extend([base_idx, base_idx + 2, base_idx + 1, 
                           base_idx, base_idx + 3, base_idx + 2])
    
    return all_vertices, all_uvs, all_normals, all_indices

def create_cube_geometry(width, height, thickness, uv_info):
    """创建立方体几何体"""
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    # 前后面
    for is_front in [True, False]:
        vertices, uvs, normals, indices = create_face_mesh(width, height, thickness, uv_info, is_front)
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    # 侧面和孔洞内壁
    for mesh_func in [create_side_mesh, create_hole_mesh]:
        vertices, uvs, normals, indices = mesh_func(width, height, thickness)
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    return (np.array(all_vertices, dtype=np.float32), 
            np.array(all_uvs, dtype=np.float32),
            np.array(all_normals, dtype=np.float32), 
            np.array(all_indices, dtype=np.uint32))

def create_glb_model(vertices, uvs, normals, indices, texture_img, output_path):
    """创建并保存GLB文件"""
    index_type = np.uint16 if len(vertices) < 65536 else np.uint32
    geo_data = [vertices.tobytes(), uvs.tobytes(), normals.tobytes(), indices.astype(index_type).tobytes()]
    
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
    
    # 创建材质和纹理
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
        scene = trimesh.load(glb_path, file_type='glb')
        mesh = (trimesh.util.concatenate([g for g in scene.geometry.values()]) 
                if isinstance(scene, trimesh.Scene) else scene)
        
        # 处理纹理和颜色
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
            mesh.export(obj_path, file_type='obj', include_color=True)
        else:
            mesh.export(obj_path, file_type='obj')
        
        print(f"✅ OBJ导出成功: {os.path.basename(obj_path)}")
        return True
        
    except Exception as e:
        print(f"❌ OBJ转换失败: {e}")
        return False

def main():
    """主函数"""
    print("🔲 固定尺寸立方体GLB工牌生成器")
    print("=" * 50)
    
    os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
    
    texture_path = os.path.join(os.getcwd(), Config.TEXTURE_FILE)
    if not os.path.exists(texture_path):
        print("❌ 未找到图像文件")
        return
    
    result = load_and_process_texture(texture_path)
    if result[0] is None:
        print("❌ 图像处理失败")
        return
    
    dimensions, texture_img, uv_info = result
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    glb_path = os.path.join(Config.OUTPUT_DIR, f"工牌_{base_name}.glb")
    obj_path = os.path.join(Config.OUTPUT_DIR, f"工牌_{base_name}.obj")
    
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_geometry(*dimensions, uv_info)
    
    print("📦 生成GLB文件...")
    if create_glb_model(vertices, uvs, normals, indices, texture_img, glb_path):
        print("📋 转换为OBJ格式...")
        if convert_glb_to_obj(glb_path, obj_path):
            print("🎉 完成! 已生成GLB和OBJ两种格式")
        else:
            print("⚠️ OBJ转换失败，但GLB已生成")
    else:
        print("❌ 生成失败")

if __name__ == "__main__":
    main() 