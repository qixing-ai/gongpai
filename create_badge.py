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
TEXTURE_SIZE = 512
FRONT_BACK_SUBDIVISIONS, SIDE_SUBDIVISIONS = 512, 2
TEXTURE_FILE = "1.png"
OUTPUT_DIR = "output"

# UV映射尺寸参数
UV_MAPPING_MAX_WIDTH_CM = 5.0   # UV映射最大宽度（厘米）
UV_MAPPING_MAX_HEIGHT_CM = 7.0  # UV映射最大高度（厘米）

# 一字孔常量定义
HOLE_WIDTH_MM = 12.0
HOLE_HEIGHT_MM = 2.0
HOLE_TOP_DISTANCE_CM = 8.7

# 圆角倒角常量定义（类似iPhone 6的圆角设计）
CORNER_RADIUS_CM = 0.8  # 圆角半径，类似iPhone 6的圆角大小
CORNER_SUBDIVISIONS = 16  # 圆角细分数，数值越大越平滑

def calculate_uv_mapping_size(img_width, img_height):
    """根据图片宽高比计算不变形的UV映射尺寸"""
    max_width = UV_MAPPING_MAX_WIDTH_CM / 100   # 转换为米
    max_height = UV_MAPPING_MAX_HEIGHT_CM / 100  # 转换为米
    
    # 计算图片宽高比
    img_ratio = img_width / img_height
    max_ratio = UV_MAPPING_MAX_WIDTH_CM / UV_MAPPING_MAX_HEIGHT_CM
    
    if img_ratio > max_ratio:
        # 图片更宽，以最大宽度为准
        uv_width = max_width
        uv_height = max_width / img_ratio
    else:
        # 图片更高，以最大高度为准
        uv_height = max_height
        uv_width = max_height * img_ratio
    
    return uv_width, uv_height

def load_and_process_texture(img_path):
    """加载并处理纹理图像"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None, None
    
    try:
        img = PILImage.open(img_path).convert('RGB')
        w, h = img.size
        print(f"📸 图片: {os.path.basename(img_path)} ({w}x{h})")
        
        # 计算动态UV映射尺寸（保持图片不变形）
        uv_width, uv_height = calculate_uv_mapping_size(w, h)
        print(f"🎨 UV映射区域: {uv_width*100:.1f}x{uv_height*100:.1f} cm (保持图片比例)")
        
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
        
        # 直接使用调整后的图片作为纹理
        texture_img = padded_img.resize((TEXTURE_SIZE, TEXTURE_SIZE), PILImage.LANCZOS)
        
        print(f"📏 固定尺寸: {FIXED_WIDTH_CM:.1f}x{FIXED_HEIGHT_CM:.1f}x{DEFAULT_THICKNESS_CM:.1f} cm")
        return dimensions, texture_img, (uv_width, uv_height)
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, None

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

def generate_rounded_rectangle_mesh(width, height, radius, subdivisions, uv_mapping_size=None):
    """生成圆角矩形的网格数据（使用规则网格而不是辐射状）"""
    half_w, half_h = width / 2, height / 2
    
    # 确保圆角半径不超过矩形的一半
    max_radius = min(half_w, half_h)
    radius = min(radius, max_radius)
    
    # 创建规则网格
    grid_size = subdivisions
    vertices = []
    uvs = []
    indices = []
    
    # UV映射参数 - 使用动态尺寸或默认值
    if uv_mapping_size:
        uv_width, uv_height = uv_mapping_size
    else:
        uv_width = UV_MAPPING_MAX_WIDTH_CM / 100   # 转换为米
        uv_height = UV_MAPPING_MAX_HEIGHT_CM / 100  # 转换为米
    
    # 计算UV映射的居中偏移
    uv_offset_x = (width - uv_width) / 2
    uv_offset_y = (height - uv_height) / 2
    
    # 生成网格顶点
    for i in range(grid_size + 1):
        for j in range(grid_size + 1):
            # 在[-1, 1]范围内的参数坐标
            u_param = (i / grid_size) * 2 - 1  # -1 到 1
            v_param = (j / grid_size) * 2 - 1  # -1 到 1
            
            # 转换为世界坐标
            x = u_param * half_w
            y = v_param * half_h
            
            # 如果在圆角区域，投影到圆角边界
            corner_x = half_w - radius
            corner_y = half_h - radius
            
            if abs(x) > corner_x and abs(y) > corner_y:
                # 在圆角区域
                center_x = np.sign(x) * corner_x
                center_y = np.sign(y) * corner_y
                
                dx = x - center_x
                dy = y - center_y
                dist = np.sqrt(dx*dx + dy*dy)
                
                if dist > radius:
                    # 投影到圆角边界
                    x = center_x + (dx / dist) * radius
                    y = center_y + (dy / dist) * radius
            
            vertices.append([x, y])
            
            # 计算UV坐标 - 使用新的映射尺寸和居中逻辑
            # 将世界坐标转换为相对于UV映射区域的坐标
            x_in_uv_space = x + half_w - uv_offset_x  # 相对于UV映射区域左边界
            y_in_uv_space = y + half_h - uv_offset_y  # 相对于UV映射区域底边界
            
            # 计算UV坐标（0-1范围）
            if uv_width > 0 and uv_height > 0:
                u = x_in_uv_space / uv_width
                v = y_in_uv_space / uv_height
            else:
                u = (x + half_w) / width
                v = (y + half_h) / height
            
            # 限制UV坐标在0-1范围内，超出范围的部分将显示纹理边缘
            u = max(0, min(1, u))
            v = max(0, min(1, v))
            uvs.append([u, v])
    
    # 生成三角形索引
    for i in range(grid_size):
        for j in range(grid_size):
            # 当前四边形的四个顶点索引
            v0 = i * (grid_size + 1) + j
            v1 = v0 + 1
            v2 = v0 + (grid_size + 1)
            v3 = v2 + 1
            
            # 分成两个三角形
            indices.extend([v0, v1, v2])
            indices.extend([v1, v3, v2])
    
    return vertices, uvs, indices

def create_cube_geometry(width, height, thickness, uv_mapping_size=None):
    """创建带圆角倒角的立方体几何体（类似iPhone 6设计）"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    
    # 圆角半径
    corner_radius = CORNER_RADIUS_CM / 100  # 转换为米
    
    # 孔洞参数
    hole_width = HOLE_WIDTH_MM / 1000
    hole_height = HOLE_HEIGHT_MM / 1000
    hole_y_offset = height - (HOLE_TOP_DISTANCE_CM / 100)
    hole_center_y = hole_y_offset - height/2
    
    hole_bounds = (-hole_width/2, hole_width/2, 
                   hole_center_y - hole_height/2, hole_center_y + hole_height/2)
    
    print(f"🕳️ 一字孔设置: {HOLE_WIDTH_MM:.1f}x{HOLE_HEIGHT_MM:.1f}mm, 距顶部{HOLE_TOP_DISTANCE_CM:.1f}cm")
    print(f"📐 圆角半径: {CORNER_RADIUS_CM:.1f}cm, 细分: {CORNER_SUBDIVISIONS}")
    
    faces = []
    
    # 生成圆角矩形的前后面
    def create_rounded_face_with_hole(z_pos, normal, hole_bounds, is_front=True):
        """创建带孔洞的圆角面"""
        vertices, face_uvs, normals, indices = [], [], [], []
        
        # 生成圆角矩形网格 - 使用前后面的高分辨率
        rect_vertices, rect_uvs, rect_indices = generate_rounded_rectangle_mesh(
            width, height, corner_radius, FRONT_BACK_SUBDIVISIONS, uv_mapping_size)
        
        # 过滤掉孔洞内的顶点
        vertex_map = {}
        current_idx = 0
        
        for i, (vertex_2d, uv) in enumerate(zip(rect_vertices, rect_uvs)):
            x, y = vertex_2d
            # 检查是否在孔洞内
            if not is_point_in_hole(x, y, hole_bounds):
                pos = [x, y, z_pos]
                vertices.append(pos)
                
                # 修正UV坐标 - 只有前面进行镜像处理
                if is_front:
                    face_uvs.append([1.0 - uv[0], uv[1]])  # 前面镜像
                else:
                    face_uvs.append([uv[0], uv[1]])  # 后面保持原样
                
                normals.append(normal)
                vertex_map[i] = current_idx
                current_idx += 1
        
        # 生成三角形索引（需要重新映射）
        for i in range(0, len(rect_indices), 3):
            v0, v1, v2 = rect_indices[i:i+3]
            if v0 in vertex_map and v1 in vertex_map and v2 in vertex_map:
                if is_front:
                    indices.extend([vertex_map[v0], vertex_map[v1], vertex_map[v2]])
                else:
                    # 后面需要翻转三角形顺序
                    indices.extend([vertex_map[v0], vertex_map[v2], vertex_map[v1]])
        
        return vertices, face_uvs, normals, indices
    
    # 前后面（带孔洞的圆角面）
    front_face = create_rounded_face_with_hole(half_t, [0, 0, 1], hole_bounds, True)
    back_face = create_rounded_face_with_hole(-half_t, [0, 0, -1], hole_bounds, False)
    faces.extend([front_face, back_face])
    
    # 生成圆角侧面
    def create_rounded_side_faces():
        """创建圆角立方体的侧面"""
        side_faces = []
        
        # 使用侧面细分参数生成轮廓
        outline_subdivisions = max(32, SIDE_SUBDIVISIONS * 16)  # 侧面轮廓细分数
        
        # 生成圆角矩形轮廓
        half_w, half_h = width/2, height/2
        corner_x = half_w - corner_radius
        corner_y = half_h - corner_radius
        
        # 初始化轮廓顶点列表
        outline_vertices = []
        
        # 四个圆角的轮廓点
        corners = [
            (corner_x, corner_y, 0, np.pi/2),      # 右上角
            (-corner_x, corner_y, np.pi/2, np.pi), # 左上角
            (-corner_x, -corner_y, np.pi, 3*np.pi/2), # 左下角
            (corner_x, -corner_y, 3*np.pi/2, 2*np.pi)  # 右下角
        ]
        
        for center_x, center_y, start_angle, end_angle in corners:
            for i in range(outline_subdivisions // 4 + 1):
                angle = start_angle + i * (end_angle - start_angle) / (outline_subdivisions // 4)
                x = center_x + corner_radius * np.cos(angle)
                y = center_y + corner_radius * np.sin(angle)
                outline_vertices.append([x, y])
        
        # 为每条边创建侧面
        num_vertices = len(outline_vertices)
        for i in range(num_vertices):
            next_i = (i + 1) % num_vertices
            
            # 当前边的四个顶点
            x1, y1 = outline_vertices[i]
            x2, y2 = outline_vertices[next_i]
            
            # 创建侧面四边形
            corners = [
                [x1, y1, half_t],   # 前面点1
                [x2, y2, half_t],   # 前面点2
                [x2, y2, -half_t],  # 后面点2
                [x1, y1, -half_t]   # 后面点1
            ]
            
            # 计算法向量
            edge_vec = np.array([x2 - x1, y2 - y1, 0])
            up_vec = np.array([0, 0, 1])
            normal = np.cross(edge_vec, up_vec)
            if np.linalg.norm(normal) > 0:
                normal = normal / np.linalg.norm(normal)
            else:
                normal = [0, 0, 1]
            
            # 简化UV坐标
            uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
            
            face_data = create_face_mesh([np.array(v) for v in corners], uvs, normal, 1)
            side_faces.append(face_data)
        
        return side_faces
    
    # 添加圆角侧面
    rounded_sides = create_rounded_side_faces()
    faces.extend(rounded_sides)
    
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
    print("🔲 固定尺寸立方体GLB工牌生成器 - 动态UV映射版")
    print("=" * 50)
    print("📐 固定尺寸: 6.0x9.0x0.2 cm - 图片保持比例不变形")
    print(f"🎨 UV映射最大区域: {UV_MAPPING_MAX_WIDTH_CM:.1f}x{UV_MAPPING_MAX_HEIGHT_CM:.1f} cm")
    
    # 创建输出目录
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 处理纹理
    texture_path = os.path.join(os.getcwd(), TEXTURE_FILE)
    if not os.path.exists(texture_path):
        print("❌ 未找到图像文件")
        return
    
    result = load_and_process_texture(texture_path)
    if result[0] is None:
        print("❌ 图像处理失败")
        return
    
    dimensions, texture_img, uv_mapping_size = result
    
    # 生成文件路径
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    glb_path = os.path.join(OUTPUT_DIR, f"工牌_{base_name}.glb")
    obj_path = os.path.join(OUTPUT_DIR, f"工牌_{base_name}.obj")
    
    # 创建几何体
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_geometry(*dimensions, uv_mapping_size)
    
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