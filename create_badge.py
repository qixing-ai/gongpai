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
    # 计算相对于孔洞中心的坐标
    rel_x = x - hole_center_x
    rel_y = y - hole_center_y
    
    # 孔洞的半宽和半高
    half_width = hole_width / 2
    half_height = hole_height / 2
    
    # 如果点在孔洞的主要矩形区域内
    if abs(rel_x) <= half_width - corner_radius or abs(rel_y) <= half_height - corner_radius:
        if abs(rel_x) <= half_width and abs(rel_y) <= half_height:
            return True
    
    # 检查四个圆角区域
    corner_centers = [
        (half_width - corner_radius, half_height - corner_radius),    # 右上
        (-half_width + corner_radius, half_height - corner_radius),   # 左上
        (-half_width + corner_radius, -half_height + corner_radius),  # 左下
        (half_width - corner_radius, -half_height + corner_radius)    # 右下
    ]
    
    for corner_x, corner_y in corner_centers:
        # 检查点是否在这个圆角的影响范围内
        if (abs(rel_x) > half_width - corner_radius and abs(rel_y) > half_height - corner_radius and
            np.sign(rel_x) == np.sign(corner_x) and np.sign(rel_y) == np.sign(corner_y)):
            # 计算到圆角中心的距离
            dx = rel_x - corner_x
            dy = rel_y - corner_y
            dist = np.sqrt(dx*dx + dy*dy)
            if dist <= corner_radius:
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
        
        badge_width = Config.FIXED_WIDTH
        badge_height = Config.FIXED_HEIGHT
        badge_thickness = Config.DEFAULT_THICKNESS
        dimensions = (badge_width, badge_height, badge_thickness)
        
        max_uv_width = Config.UV_MAPPING_MAX_WIDTH
        max_uv_height = Config.UV_MAPPING_MAX_HEIGHT
        
        # 根据图片比例动态计算UV映射区域
        if img_ratio > (max_uv_width / max_uv_height):
            uv_width = max_uv_width
            uv_height = max_uv_width / img_ratio
        else:
            uv_height = max_uv_height
            uv_width = max_uv_height * img_ratio
        
        uv_width = min(uv_width, badge_width * 0.9)
        uv_height = min(uv_height, badge_height * 0.9)
        
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
        
        uv_start_x = paste_x / texture_size
        uv_end_x = (paste_x + new_width) / texture_size
        uv_start_y = paste_y / texture_size
        uv_end_y = (paste_y + new_height) / texture_size
        
        uv_info = {
            'width': uv_width,
            'height': uv_height,
            'uv_bounds': (uv_start_x, uv_end_x, uv_start_y, uv_end_y)
        }
        
        return dimensions, texture_img, uv_info
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, None

def create_face_mesh(width, height, thickness, hole_bounds, uv_info, is_front=True):
    """创建带边缘倒角的面网格"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    z_pos = half_t if is_front else -half_t
    normal = [0, 0, 1] if is_front else [0, 0, -1]
    
    vertices, uvs, normals, indices = [], [], [], []
    vertex_map = {}
    current_idx = 0
    
    uv_width = uv_info['width']
    uv_height = uv_info['height']
    uv_start_x, uv_end_x, uv_start_y, uv_end_y = uv_info['uv_bounds']
    
    uv_offset_x = (width - uv_width) / 2
    uv_offset_y = (height - uv_height) / 2
    
    corner_radius = Config.CORNER_RADIUS
    edge_radius = Config.EDGE_RADIUS
    
    subdivisions = Config.SUBDIVISIONS
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            x = (i / subdivisions - 0.5) * width
            y = (j / subdivisions - 0.5) * height
            z = z_pos
            
            # 计算到边缘的距离
            dist_to_left = x + half_w
            dist_to_right = half_w - x
            dist_to_bottom = y + half_h
            dist_to_top = half_h - y
            
            # 找到最近的边缘距离
            min_edge_dist = min(dist_to_left, dist_to_right, dist_to_bottom, dist_to_top)
            
            # 边缘倒角处理
            if min_edge_dist < edge_radius:
                # 计算倒角后的Z坐标
                edge_factor = min_edge_dist / edge_radius
                if edge_factor < 0:
                    edge_factor = 0
                
                # 使用平滑的倒角曲线
                curve_factor = np.sqrt(1 - (1 - edge_factor) ** 2)  # 圆弧倒角
                z_offset = edge_radius * (1 - curve_factor)
                
                # 根据是否是正面调整Z坐标
                if is_front:
                    z = z_pos - z_offset
                else:
                    z = z_pos + z_offset
            
            # 角部倒角处理（优先级更高）
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
                    
                    # 角部也应用边缘倒角
                    if min_edge_dist < edge_radius:
                        edge_factor = min_edge_dist / edge_radius
                        if edge_factor < 0:
                            edge_factor = 0
                        curve_factor = np.sqrt(1 - (1 - edge_factor) ** 2)
                        z_offset = edge_radius * (1 - curve_factor)
                        if is_front:
                            z = z_pos - z_offset
                        else:
                            z = z_pos + z_offset
            
            # 检查带倒角的孔洞
            hole_width = Config.HOLE_WIDTH
            hole_height = Config.HOLE_HEIGHT
            hole_corner_radius = Config.HOLE_CORNER_RADIUS
            hole_y_offset = height - (Config.HOLE_TOP_DISTANCE)
            hole_center_y = hole_y_offset - height/2
            hole_center_x = 0  # 孔洞在中心
            
            if is_point_in_rounded_hole(x, y, hole_center_x, hole_center_y, hole_width, hole_height, hole_corner_radius):
                continue
                
            vertices.append([x, y, z])
            
            # 计算法向量（考虑边缘倾斜）
            if min_edge_dist < edge_radius:
                # 边缘区域的法向量需要调整
                edge_normal_factor = min_edge_dist / edge_radius
                if edge_normal_factor < 0:
                    edge_normal_factor = 0
                
                # 根据最近的边确定倾斜方向
                if dist_to_left == min_edge_dist:  # 左边
                    edge_normal = [-1, 0, 0]
                elif dist_to_right == min_edge_dist:  # 右边
                    edge_normal = [1, 0, 0]
                elif dist_to_bottom == min_edge_dist:  # 下边
                    edge_normal = [0, -1, 0]
                else:  # 上边
                    edge_normal = [0, 1, 0]
                
                # 混合面法向量和边法向量
                face_normal = np.array(normal)
                edge_normal = np.array(edge_normal)
                mixed_normal = face_normal * edge_normal_factor + edge_normal * (1 - edge_normal_factor)
                mixed_normal = mixed_normal / np.linalg.norm(mixed_normal)
                normals.append(mixed_normal.tolist())
            else:
                normals.append(normal)
            
            # 计算UV坐标
            x_in_uv_region = x + width/2 - uv_offset_x
            y_in_uv_region = y + height/2 - uv_offset_y
            
            u_in_region = x_in_uv_region / uv_width if uv_width > 0 else 0.5
            v_in_region = y_in_uv_region / uv_height if uv_height > 0 else 0.5
            
            if 0 <= u_in_region <= 1 and 0 <= v_in_region <= 1:
                u = uv_start_x + u_in_region * (uv_end_x - uv_start_x)
                v = uv_start_y + v_in_region * (uv_end_y - uv_start_y)
            else:
                u = 0.5
                v = 0.5
            
            if is_front:
                uvs.append([1.0 - u, v])
            else:
                uvs.append([u, v])
            
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

def create_side_mesh(width, height, thickness):
    """创建与边缘倒角匹配的侧面网格"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    corner_radius = Config.CORNER_RADIUS
    edge_radius = Config.EDGE_RADIUS
    
    # 生成轮廓点时考虑边缘倒角
    outline_points = 64  # 增加点数以获得更平滑的效果
    corner_x = half_w - corner_radius
    corner_y = half_h - corner_radius
    
    outline_vertices = []
    
    # 四个角的圆弧
    corners = [
        (corner_x, corner_y, 0, np.pi/2),           # 右上
        (-corner_x, corner_y, np.pi/2, np.pi),      # 左上
        (-corner_x, -corner_y, np.pi, 3*np.pi/2),   # 左下
        (corner_x, -corner_y, 3*np.pi/2, 2*np.pi)   # 右下
    ]
    
    for center_x, center_y, start_angle, end_angle in corners:
        for i in range(outline_points // 4 + 1):
            angle = start_angle + i * (end_angle - start_angle) / (outline_points // 4)
            x = center_x + corner_radius * np.cos(angle)
            y = center_y + corner_radius * np.sin(angle)
            outline_vertices.append([x, y])
    
    # 创建侧面网格
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    for i in range(len(outline_vertices)):
        next_i = (i + 1) % len(outline_vertices)
        x1, y1 = outline_vertices[i]
        x2, y2 = outline_vertices[next_i]
        
        # 计算这两个点到边缘的距离
        def get_edge_distance(x, y):
            dist_to_left = x + half_w
            dist_to_right = half_w - x
            dist_to_bottom = y + half_h
            dist_to_top = half_h - y
            return min(dist_to_left, dist_to_right, dist_to_bottom, dist_to_top)
        
        # 计算边缘倒角后的Z坐标
        def get_edge_z(x, y, is_front):
            min_edge_dist = get_edge_distance(x, y)
            base_z = half_t if is_front else -half_t
            
            if min_edge_dist < edge_radius:
                edge_factor = min_edge_dist / edge_radius
                if edge_factor < 0:
                    edge_factor = 0
                curve_factor = np.sqrt(1 - (1 - edge_factor) ** 2)
                z_offset = edge_radius * (1 - curve_factor)
                
                if is_front:
                    return base_z - z_offset
                else:
                    return base_z + z_offset
            return base_z
        
        # 计算四个顶点的Z坐标
        z1_front = get_edge_z(x1, y1, True)
        z2_front = get_edge_z(x2, y2, True)
        z1_back = get_edge_z(x1, y1, False)
        z2_back = get_edge_z(x2, y2, False)
        
        # 创建四边形
        quad_vertices = [
            [x1, y1, z1_front],  # 前面点1
            [x2, y2, z2_front],  # 前面点2
            [x2, y2, z2_back],   # 后面点2
            [x1, y1, z1_back]    # 后面点1
        ]
        
        quad_uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
        
        # 计算法向量
        edge_vec = np.array([x2 - x1, y2 - y1, 0])
        normal = np.cross(edge_vec, [0, 0, 1])
        if np.linalg.norm(normal) > 0:
            normal = normal / np.linalg.norm(normal)
        
        base_idx = len(all_vertices)
        all_vertices.extend(quad_vertices)
        all_uvs.extend(quad_uvs)
        all_normals.extend([normal] * 4)
        all_indices.extend([base_idx, base_idx + 1, base_idx + 2, 
                           base_idx, base_idx + 2, base_idx + 3])
    
    return all_vertices, all_uvs, all_normals, all_indices

def create_hole_mesh(width, height, thickness):
    """创建带倒角的孔洞内壁网格，考虑边缘倒角"""
    hole_width = Config.HOLE_WIDTH
    hole_height = Config.HOLE_HEIGHT
    hole_corner_radius = Config.HOLE_CORNER_RADIUS
    edge_radius = Config.EDGE_RADIUS
    hole_y_offset = height - (Config.HOLE_TOP_DISTANCE)
    center_y = hole_y_offset - height/2
    center_x = 0  # 孔洞在中心
    half_hw, half_hh, half_t = hole_width/2, hole_height/2, thickness/2
    half_w, half_h = width/2, height/2
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    # 生成孔洞轮廓点（带倒角）
    outline_points = 32  # 每个圆角的点数
    outline_vertices = []
    
    # 四个圆角的中心点
    corner_centers = [
        (center_x + half_hw - hole_corner_radius, center_y + half_hh - hole_corner_radius),  # 右上
        (center_x - half_hw + hole_corner_radius, center_y + half_hh - hole_corner_radius),  # 左上
        (center_x - half_hw + hole_corner_radius, center_y - half_hh + hole_corner_radius),  # 左下
        (center_x + half_hw - hole_corner_radius, center_y - half_hh + hole_corner_radius)   # 右下
    ]
    
    # 每个圆角的角度范围
    angle_ranges = [
        (0, np.pi/2),           # 右上角
        (np.pi/2, np.pi),       # 左上角
        (np.pi, 3*np.pi/2),     # 左下角
        (3*np.pi/2, 2*np.pi)    # 右下角
    ]
    
    # 生成每个圆角的点
    for (corner_x, corner_y), (start_angle, end_angle) in zip(corner_centers, angle_ranges):
        for i in range(outline_points // 4 + 1):
            angle = start_angle + i * (end_angle - start_angle) / (outline_points // 4)
            x = corner_x + hole_corner_radius * np.cos(angle)
            y = corner_y + hole_corner_radius * np.sin(angle)
            outline_vertices.append([x, y])
    
    # 移除重复的点
    unique_vertices = []
    for vertex in outline_vertices:
        is_duplicate = False
        for existing in unique_vertices:
            if abs(vertex[0] - existing[0]) < 1e-6 and abs(vertex[1] - existing[1]) < 1e-6:
                is_duplicate = True
                break
        if not is_duplicate:
            unique_vertices.append(vertex)
    
    outline_vertices = unique_vertices
    
    # 计算边缘倒角后的Z坐标的辅助函数
    def get_edge_z(x, y, is_front):
        dist_to_left = x + half_w
        dist_to_right = half_w - x
        dist_to_bottom = y + half_h
        dist_to_top = half_h - y
        min_edge_dist = min(dist_to_left, dist_to_right, dist_to_bottom, dist_to_top)
        
        base_z = half_t if is_front else -half_t
        
        if min_edge_dist < edge_radius:
            edge_factor = min_edge_dist / edge_radius
            if edge_factor < 0:
                edge_factor = 0
            curve_factor = np.sqrt(1 - (1 - edge_factor) ** 2)
            z_offset = edge_radius * (1 - curve_factor)
            
            if is_front:
                return base_z - z_offset
            else:
                return base_z + z_offset
        return base_z
    
    # 为每个轮廓边创建内壁
    for i in range(len(outline_vertices)):
        next_i = (i + 1) % len(outline_vertices)
        x1, y1 = outline_vertices[i]
        x2, y2 = outline_vertices[next_i]
        
        # 计算考虑边缘倒角的Z坐标
        z1_front = get_edge_z(x1, y1, True)
        z2_front = get_edge_z(x2, y2, True)
        z1_back = get_edge_z(x1, y1, False)
        z2_back = get_edge_z(x2, y2, False)
        
        # 创建四边形内壁
        quad_vertices = [
            [x1, y1, z1_front],  # 顶部前
            [x2, y2, z2_front],  # 顶部后
            [x2, y2, z2_back],   # 底部后
            [x1, y1, z1_back]    # 底部前
        ]
        
        quad_uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
        
        # 计算法向量（指向孔洞内部）
        edge_vec = np.array([x2 - x1, y2 - y1, 0])
        outward_normal = np.cross([0, 0, 1], edge_vec)
        if np.linalg.norm(outward_normal) > 0:
            outward_normal = outward_normal / np.linalg.norm(outward_normal)
        
        base_idx = len(all_vertices)
        all_vertices.extend(quad_vertices)
        all_uvs.extend(quad_uvs)
        all_normals.extend([outward_normal] * 4)
        
        # 添加三角形索引（内表面朝内）
        all_indices.extend([
            base_idx, base_idx + 2, base_idx + 1,  # 第一个三角形
            base_idx, base_idx + 3, base_idx + 2   # 第二个三角形
        ])
    
    return all_vertices, all_uvs, all_normals, all_indices

def create_cube_geometry(width, height, thickness, uv_info=None):
    """创建立方体几何体"""
    hole_width = Config.HOLE_WIDTH
    hole_height = Config.HOLE_HEIGHT
    hole_y_offset = height - (Config.HOLE_TOP_DISTANCE)
    center_y = hole_y_offset - height/2
    hole_bounds = (-hole_width/2, hole_width/2, center_y - hole_height/2, center_y + hole_height/2)
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    # 前后面
    for is_front in [True, False]:
        vertices, uvs, normals, indices = create_face_mesh(width, height, thickness, hole_bounds, uv_info, is_front)
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    # 侧面
    vertices, uvs, normals, indices = create_side_mesh(width, height, thickness)
    base_idx = len(all_vertices)
    all_vertices.extend(vertices)
    all_uvs.extend(uvs)
    all_normals.extend(normals)
    all_indices.extend([idx + base_idx for idx in indices])
    
    # 孔洞内壁
    vertices, uvs, normals, indices = create_hole_mesh(width, height, thickness)
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
    
    buffer_views = []
    if texture_img:
        buffer_views.append(BufferView(buffer=0, byteOffset=0, byteLength=len(img_data)))
    
    targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER]
    offset = geo_offset
    for data, target in zip(geo_data, targets):
        buffer_views.append(BufferView(buffer=0, byteOffset=offset, byteLength=len(data), target=target))
        offset += len(data)
    
    gltf.bufferViews = buffer_views
    
    bv_offset = 1 if texture_img else 0
    component_type = UNSIGNED_SHORT if len(vertices) < 65536 else UNSIGNED_INT
    
    gltf.accessors = [
        Accessor(bufferView=bv_offset, componentType=FLOAT, count=len(vertices), type="VEC3",
                min=vertices.min(axis=0).tolist(), max=vertices.max(axis=0).tolist()),
        Accessor(bufferView=bv_offset+1, componentType=FLOAT, count=len(uvs), type="VEC2"),
        Accessor(bufferView=bv_offset+2, componentType=FLOAT, count=len(normals), type="VEC3"),
        Accessor(bufferView=bv_offset+3, componentType=component_type, count=len(indices), type="SCALAR")
    ]
    
    if texture_img:
        gltf.images = [Image(mimeType="image/png", bufferView=0)]
        gltf.samplers = [Sampler(magFilter=9729, minFilter=9729, wrapS=10497, wrapT=10497)]
        gltf.textures = [Texture(sampler=0, source=0)]
        pbr = PbrMetallicRoughness(baseColorTexture=TextureInfo(index=0))
    else:
        pbr = PbrMetallicRoughness(baseColorFactor=[0.9, 0.9, 0.9, 1.0])
    
    gltf.materials = [Material(name="BadgeMaterial", pbrMetallicRoughness=pbr)]
    
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
            print(f"✅ OBJ导出成功: {os.path.basename(obj_path)}")
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