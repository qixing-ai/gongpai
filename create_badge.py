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

# 配置常量
class Config:
    # 工牌尺寸
    FIXED_WIDTH_CM = 6.0
    FIXED_HEIGHT_CM = 9.0
    DEFAULT_THICKNESS_CM = 0.2
    
    # 纹理设置
    TEXTURE_SIZE = 512
    TEXTURE_FILE = "1.png"
    OUTPUT_DIR = "output"
    
    # 网格细分 - 简化
    SUBDIVISIONS = 512  # 统一细分数
    
    # UV映射区域
    UV_MAPPING_MAX_WIDTH_CM = 5.0
    UV_MAPPING_MAX_HEIGHT_CM = 7.0
    
    # 孔洞参数
    HOLE_WIDTH_MM = 12.0
    HOLE_HEIGHT_MM = 2.0
    HOLE_TOP_DISTANCE_CM = 8.7
    
    # 圆角参数
    CORNER_RADIUS_CM = 0.8

def load_and_process_texture(img_path):
    """加载并处理纹理图像"""
    if not os.path.exists(img_path):
        print(f"❌ 图片文件不存在: {img_path}")
        return None, None, None
    
    try:
        img = PILImage.open(img_path).convert('RGB')
        w, h = img.size
        print(f"📸 图片: {os.path.basename(img_path)} ({w}x{h})")
        
        # 图片原始比例
        img_ratio = w / h
        print(f"📐 图片比例: {img_ratio:.2f} (宽:高)")
        
        # 工牌尺寸（米）
        badge_width = Config.FIXED_WIDTH_CM / 100
        badge_height = Config.FIXED_HEIGHT_CM / 100
        badge_thickness = Config.DEFAULT_THICKNESS_CM / 100
        dimensions = (badge_width, badge_height, badge_thickness)
        
        # 计算最大可用UV映射区域（米）
        max_uv_width = Config.UV_MAPPING_MAX_WIDTH_CM / 100
        max_uv_height = Config.UV_MAPPING_MAX_HEIGHT_CM / 100
        
        # 根据图片比例动态计算UV映射区域，保持图片不变形
        # 在最大区域内按图片比例缩放
        if img_ratio > (max_uv_width / max_uv_height):
            # 图片较宽，以宽度为准
            uv_width = max_uv_width
            uv_height = max_uv_width / img_ratio
        else:
            # 图片较高，以高度为准
            uv_height = max_uv_height
            uv_width = max_uv_height * img_ratio
        
        # 确保UV区域不超出工牌边界
        uv_width = min(uv_width, badge_width * 0.9)  # 留10%边距
        uv_height = min(uv_height, badge_height * 0.9)  # 留10%边距
        
        print(f"🎨 UV映射区域: {uv_width*100:.1f}x{uv_height*100:.1f} cm (保持比例 {uv_width/uv_height:.2f})")
        print(f"📏 工牌尺寸: {Config.FIXED_WIDTH_CM:.1f}x{Config.FIXED_HEIGHT_CM:.1f}x{Config.DEFAULT_THICKNESS_CM:.1f} cm")
        
        # 创建纹理图像 - 保持原始比例，不强制拉伸
        # 直接调整图像到纹理尺寸，保持比例
        texture_size = Config.TEXTURE_SIZE
        if img_ratio > 1:
            # 宽图
            new_width = texture_size
            new_height = int(texture_size / img_ratio)
        else:
            # 高图
            new_height = texture_size
            new_width = int(texture_size * img_ratio)
        
        # 调整图像尺寸
        resized_img = img.resize((new_width, new_height), PILImage.LANCZOS)
        
        # 创建正方形纹理，居中放置图像
        texture_img = PILImage.new('RGB', (texture_size, texture_size), (255, 255, 255))
        paste_x = (texture_size - new_width) // 2
        paste_y = (texture_size - new_height) // 2
        texture_img.paste(resized_img, (paste_x, paste_y))
        
        # 计算实际UV坐标范围（在正方形纹理中图像的位置）
        uv_start_x = paste_x / texture_size
        uv_end_x = (paste_x + new_width) / texture_size
        uv_start_y = paste_y / texture_size
        uv_end_y = (paste_y + new_height) / texture_size
        
        uv_info = {
            'width': uv_width,
            'height': uv_height,
            'uv_bounds': (uv_start_x, uv_end_x, uv_start_y, uv_end_y)
        }
        
        print(f"🖼️ 纹理UV范围: X({uv_start_x:.3f}-{uv_end_x:.3f}), Y({uv_start_y:.3f}-{uv_end_y:.3f})")
        
        return dimensions, texture_img, uv_info
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None, None

def create_face_mesh(width, height, thickness, hole_bounds, uv_info, is_front=True):
    """创建面网格（支持动态UV映射）"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    z_pos = half_t if is_front else -half_t
    normal = [0, 0, 1] if is_front else [0, 0, -1]
    
    vertices, uvs, normals, indices = [], [], [], []
    vertex_map = {}
    current_idx = 0
    
    # 获取UV映射信息
    uv_width = uv_info['width']
    uv_height = uv_info['height']
    uv_start_x, uv_end_x, uv_start_y, uv_end_y = uv_info['uv_bounds']
    
    # UV映射区域在工牌上的位置（居中）
    uv_offset_x = (width - uv_width) / 2
    uv_offset_y = (height - uv_height) / 2
    
    print(f"🎯 UV映射: 物理区域 {uv_width*100:.1f}x{uv_height*100:.1f}cm, 纹理范围 ({uv_start_x:.3f},{uv_start_y:.3f})-({uv_end_x:.3f},{uv_end_y:.3f})")
    
    # 简化网格生成
    subdivisions = Config.SUBDIVISIONS
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            # 计算位置
            x = (i / subdivisions - 0.5) * width
            y = (j / subdivisions - 0.5) * height
            
            # 简化圆角处理
            corner_radius = Config.CORNER_RADIUS_CM / 100
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
            
            # 检查孔洞
            left, right, bottom, top = hole_bounds
            if left <= x <= right and bottom <= y <= top:
                continue
                
            vertices.append([x, y, z_pos])
            normals.append(normal)
            
            # 计算UV坐标 - 关键改进：保持图片比例不变形
            # 将世界坐标转换为UV映射区域内的相对坐标
            x_in_uv_region = x + width/2 - uv_offset_x  # 相对于UV区域左边界
            y_in_uv_region = y + height/2 - uv_offset_y  # 相对于UV区域下边界
            
            # 计算在UV区域内的归一化坐标 (0-1)
            u_in_region = x_in_uv_region / uv_width if uv_width > 0 else 0.5
            v_in_region = y_in_uv_region / uv_height if uv_height > 0 else 0.5
            
            # 将区域内坐标映射到实际纹理坐标
            if 0 <= u_in_region <= 1 and 0 <= v_in_region <= 1:
                # 在UV映射区域内，使用实际纹理坐标
                u = uv_start_x + u_in_region * (uv_end_x - uv_start_x)
                v = uv_start_y + v_in_region * (uv_end_y - uv_start_y)
            else:
                # 在UV映射区域外，使用白色背景区域
                u = 0.5  # 纹理中心的白色区域
                v = 0.5
            
            # 前后面UV坐标处理
            if is_front:
                uvs.append([1.0 - u, v])  # 前面保持正常方向
            else:
                uvs.append([u, v])  # 后面左右翻转（镜像效果）
            
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
    """创建侧面网格（简化版）"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    corner_radius = Config.CORNER_RADIUS_CM / 100
    
    # 简化轮廓生成
    outline_points = 32
    corner_x = half_w - corner_radius
    corner_y = half_h - corner_radius
    
    outline_vertices = []
    # 四个圆角
    corners = [(corner_x, corner_y, 0, np.pi/2), (-corner_x, corner_y, np.pi/2, np.pi),
               (-corner_x, -corner_y, np.pi, 3*np.pi/2), (corner_x, -corner_y, 3*np.pi/2, 2*np.pi)]
    
    for center_x, center_y, start_angle, end_angle in corners:
        for i in range(outline_points // 4 + 1):
            angle = start_angle + i * (end_angle - start_angle) / (outline_points // 4)
            x = center_x + corner_radius * np.cos(angle)
            y = center_y + corner_radius * np.sin(angle)
            outline_vertices.append([x, y])
    
    # 创建侧面
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    for i in range(len(outline_vertices)):
        next_i = (i + 1) % len(outline_vertices)
        x1, y1 = outline_vertices[i]
        x2, y2 = outline_vertices[next_i]
        
        # 四个顶点
        quad_vertices = [[x1, y1, half_t], [x2, y2, half_t], [x2, y2, -half_t], [x1, y1, -half_t]]
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
    """创建孔洞内壁网格（简化版）"""
    hole_width = Config.HOLE_WIDTH_MM / 1000
    hole_height = Config.HOLE_HEIGHT_MM / 1000
    hole_y_offset = height - (Config.HOLE_TOP_DISTANCE_CM / 100)
    center_y = hole_y_offset - height/2
    half_hw, half_hh, half_t = hole_width/2, hole_height/2, thickness/2
    
    # 四个内壁
    walls = [
        # 上壁、下壁、左壁、右壁
        ([[-half_hw, center_y + half_hh, half_t], [half_hw, center_y + half_hh, half_t],
          [half_hw, center_y + half_hh, -half_t], [-half_hw, center_y + half_hh, -half_t]], [0, -1, 0]),
        ([[half_hw, center_y - half_hh, half_t], [-half_hw, center_y - half_hh, half_t],
          [-half_hw, center_y - half_hh, -half_t], [half_hw, center_y - half_hh, -half_t]], [0, 1, 0]),
        ([[-half_hw, center_y - half_hh, half_t], [-half_hw, center_y + half_hh, half_t],
          [-half_hw, center_y + half_hh, -half_t], [-half_hw, center_y - half_hh, -half_t]], [1, 0, 0]),
        ([[half_hw, center_y + half_hh, half_t], [half_hw, center_y - half_hh, half_t],
          [half_hw, center_y - half_hh, -half_t], [half_hw, center_y + half_hh, -half_t]], [-1, 0, 0])
    ]
    
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    
    for corners, normal in walls:
        uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
        base_idx = len(all_vertices)
        all_vertices.extend(corners)
        all_uvs.extend(uvs)
        all_normals.extend([normal] * 4)
        all_indices.extend([base_idx, base_idx + 1, base_idx + 2, 
                           base_idx, base_idx + 2, base_idx + 3])
    
    return all_vertices, all_uvs, all_normals, all_indices

def create_cube_geometry(width, height, thickness, uv_info=None):
    """创建立方体几何体（支持动态UV映射）"""
    print(f"🕳️ 一字孔设置: {Config.HOLE_WIDTH_MM:.1f}x{Config.HOLE_HEIGHT_MM:.1f}mm, 距顶部{Config.HOLE_TOP_DISTANCE_CM:.1f}cm")
    print(f"📐 圆角半径: {Config.CORNER_RADIUS_CM:.1f}cm")
    
    # 孔洞边界
    hole_width = Config.HOLE_WIDTH_MM / 1000
    hole_height = Config.HOLE_HEIGHT_MM / 1000
    hole_y_offset = height - (Config.HOLE_TOP_DISTANCE_CM / 100)
    center_y = hole_y_offset - height/2
    hole_bounds = (-hole_width/2, hole_width/2, center_y - hole_height/2, center_y + hole_height/2)
    
    # 创建所有面
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
    """创建并保存GLB文件（简化版）"""
    # 准备数据
    index_type = np.uint16 if len(vertices) < 65536 else np.uint32
    geo_data = [vertices.tobytes(), uvs.tobytes(), normals.tobytes(), indices.astype(index_type).tobytes()]
    
    # 处理纹理
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
    
    # 创建GLTF
    gltf = GLTF2()
    gltf.buffers = [Buffer(byteLength=len(all_data),
                          uri=f"data:application/octet-stream;base64,{base64.b64encode(all_data).decode()}")]
    
    # 缓冲区视图
    buffer_views = []
    if texture_img:
        buffer_views.append(BufferView(buffer=0, byteOffset=0, byteLength=len(img_data)))
    
    targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER]
    offset = geo_offset
    for data, target in zip(geo_data, targets):
        buffer_views.append(BufferView(buffer=0, byteOffset=offset, byteLength=len(data), target=target))
        offset += len(data)
    
    gltf.bufferViews = buffer_views
    
    # 访问器
    bv_offset = 1 if texture_img else 0
    component_type = UNSIGNED_SHORT if len(vertices) < 65536 else UNSIGNED_INT
    
    gltf.accessors = [
        Accessor(bufferView=bv_offset, componentType=FLOAT, count=len(vertices), type="VEC3",
                min=vertices.min(axis=0).tolist(), max=vertices.max(axis=0).tolist()),
        Accessor(bufferView=bv_offset+1, componentType=FLOAT, count=len(uvs), type="VEC2"),
        Accessor(bufferView=bv_offset+2, componentType=FLOAT, count=len(normals), type="VEC3"),
        Accessor(bufferView=bv_offset+3, componentType=component_type, count=len(indices), type="SCALAR")
    ]
    
    # 材质
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
    
    # 保存
    try:
        gltf.save(output_path)
        file_size = os.path.getsize(output_path)
        print(f"✅ GLB导出成功: {os.path.basename(output_path)} ({file_size:,} 字节)")
        return True
    except Exception as e:
        print(f"❌ GLB导出失败: {e}")
        return False

def convert_glb_to_obj(glb_path, obj_path):
    """转换GLB到OBJ格式（简化版）"""
    try:
        print("🔄 转换GLB到OBJ...")
        scene = trimesh.load(glb_path, file_type='glb')
        mesh = (trimesh.util.concatenate([g for g in scene.geometry.values()]) 
                if isinstance(scene, trimesh.Scene) else scene)
        
        # 简化纹理处理
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
            print(f"✅ 带纹理颜色的OBJ导出成功: {os.path.basename(obj_path)}")
        else:
            mesh.export(obj_path, file_type='obj')
            print(f"✅ OBJ导出成功: {os.path.basename(obj_path)}")
        
        return True
        
    except Exception as e:
        print(f"❌ OBJ转换失败: {e}")
        return False

def main():
    """主函数"""
    print("🔲 固定尺寸立方体GLB工牌生成器 - 简化版")
    print("=" * 50)
    print("📐 固定尺寸: 6.0x9.0x0.2 cm - 图片保持比例不变形")
    print(f"🎨 UV映射最大区域: {Config.UV_MAPPING_MAX_WIDTH_CM:.1f}x{Config.UV_MAPPING_MAX_HEIGHT_CM:.1f} cm")
    
    # 创建输出目录
    os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
    
    # 处理纹理
    texture_path = os.path.join(os.getcwd(), Config.TEXTURE_FILE)
    if not os.path.exists(texture_path):
        print("❌ 未找到图像文件")
        return
    
    result = load_and_process_texture(texture_path)
    if result[0] is None:
        print("❌ 图像处理失败")
        return
    
    dimensions, texture_img, uv_info = result
    
    # 生成文件路径
    base_name = os.path.splitext(os.path.basename(texture_path))[0]
    glb_path = os.path.join(Config.OUTPUT_DIR, f"工牌_{base_name}.glb")
    obj_path = os.path.join(Config.OUTPUT_DIR, f"工牌_{base_name}.obj")
    
    # 创建几何体
    print("🔧 创建几何数据...")
    vertices, uvs, normals, indices = create_cube_geometry(*dimensions, uv_info)
    
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