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
FIXED_WIDTH_CM, FIXED_HEIGHT_CM, DEFAULT_THICKNESS_CM = 6.0, 9.0, 0.2
BORDER_CM = 0.5  # 减小边框到0.2cm
TEXTURE_SIZE = 512
FRONT_BACK_SUBDIVISIONS, SIDE_SUBDIVISIONS = 512, 2
TEXTURE_FILE = "1.png"
OUTPUT_DIR = "output"  # 输出目录

# 一字孔常量定义
HOLE_WIDTH_MM = 9.0    # 孔宽度（毫米）
HOLE_HEIGHT_MM = 2.0   # 孔高度（毫米）
HOLE_TOP_DISTANCE_CM = 8.7  # 距离顶部距离（厘米）

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
            print(f"📐 添加上下填充: {new_size[0]}x{new_size[1]}")
        else:
            new_size = (int(h * badge_ratio), h)
            offset = ((new_size[0] - w) // 2, 0)
            print(f"📐 添加左右填充: {new_size[0]}x{new_size[1]}")
        
        padded_img = PILImage.new('RGB', new_size, (255, 255, 255))
        padded_img.paste(img, offset)
        
        # 创建带边框的纹理
        border_h = int(TEXTURE_SIZE * BORDER_CM / FIXED_WIDTH_CM)
        border_v = int(TEXTURE_SIZE * BORDER_CM / FIXED_HEIGHT_CM)
        inner_size = (TEXTURE_SIZE - 2 * border_h, TEXTURE_SIZE - 2 * border_v)
        
        print(f"🎨 纹理边框: 水平{border_h}px, 垂直{border_v}px")
        print(f"📷 图片区域: {inner_size[0]}x{inner_size[1]}px (在{TEXTURE_SIZE}x{TEXTURE_SIZE}px纹理中)")
        
        texture_img = PILImage.new('RGB', (TEXTURE_SIZE, TEXTURE_SIZE), (255, 255, 255))  # 白色边框
        center_img = padded_img.resize(inner_size, PILImage.LANCZOS)
        texture_img.paste(center_img, (border_h, border_v))
        
        print(f"📏 固定尺寸: {FIXED_WIDTH_CM:.1f}x{FIXED_HEIGHT_CM:.1f}x{DEFAULT_THICKNESS_CM:.1f} cm")
        return dimensions, texture_img
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        return None, None

def create_face_mesh(corners, uvs, normal, subdivisions):
    """创建单个面的网格数据"""
    vertices, face_uvs, normals, indices = [], [], [], []
    
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            
            # 双线性插值
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

def create_cube_geometry(width, height, thickness):
    """创建立方体几何体"""
    half_w, half_h, half_t = width/2, height/2, thickness/2
    u_border = BORDER_CM / FIXED_WIDTH_CM  # 边框占宽度的比例
    v_border = BORDER_CM / FIXED_HEIGHT_CM  # 边框占高度的比例
    
    print(f"🔲 边框设置: {BORDER_CM}cm")
    print(f"📐 UV边框比例: u={u_border:.3f} ({u_border*100:.1f}%), v={v_border:.3f} ({v_border*100:.1f}%)")
    
    # 一字孔参数（使用常量，单位：米）
    hole_width = HOLE_WIDTH_MM / 1000   # 转换毫米到米
    hole_height = HOLE_HEIGHT_MM / 1000  # 转换毫米到米
    hole_y_offset = height - (HOLE_TOP_DISTANCE_CM / 100)  # 距离顶部的绝对位置
    
    print(f"🕳️ 一字孔设置: {HOLE_WIDTH_MM:.1f}x{HOLE_HEIGHT_MM:.1f}mm, 距顶部{HOLE_TOP_DISTANCE_CM:.1f}cm")
    
    # 面配置：[顶点坐标, UV坐标, 法线, 细分数]
    faces = []
    
    # 前面和后面 - 需要考虑孔洞
    front_back_faces = [
        # 前面
        ([[-half_w, -half_h, half_t], [half_w, -half_h, half_t], 
          [half_w, half_h, half_t], [-half_w, half_h, half_t]], 
         [[1, 0], [0, 0], [0, 1], [1, 1]], 
         [0, 0, 1]),
        # 后面
        ([[half_w, -half_h, -half_t], [-half_w, -half_h, -half_t], 
          [-half_w, half_h, -half_t], [half_w, half_h, -half_t]], 
         [[1, 0], [0, 0], [0, 1], [1, 1]], 
         [0, 0, -1])
    ]
    
    # 为前后面创建带孔洞的网格
    for corners, uvs, normal in front_back_faces:
        vertices, face_uvs, normals, indices = create_face_with_hole(
            [np.array(v) for v in corners], uvs, normal, FRONT_BACK_SUBDIVISIONS,
            hole_width, hole_height, hole_y_offset, width, height)
        faces.append((vertices, face_uvs, normals, indices))
    
    # 四个侧面 - 低细分，使用边框白色
    side_faces = [
        ([[half_w, -half_h, half_t], [half_w, -half_h, -half_t], 
          [half_w, half_h, -half_t], [half_w, half_h, half_t]], [1, 0, 0]),
        ([[-half_w, -half_h, -half_t], [-half_w, -half_h, half_t], 
          [-half_w, half_h, half_t], [-half_w, half_h, -half_t]], [-1, 0, 0]),
        ([[-half_w, half_h, half_t], [half_w, half_h, half_t], 
          [half_w, half_h, -half_t], [-half_w, half_h, -half_t]], [0, 1, 0]),
        ([[-half_w, -half_h, -half_t], [half_w, -half_h, -half_t], 
          [half_w, -half_h, half_t], [-half_w, -half_h, half_t]], [0, -1, 0])
    ]
    
    # 为侧面添加边框UV - 指向纹理边框区域
    for corners, normal in side_faces:
        if normal[0] != 0:  # 左右侧面 - 使用左右边框
            uv = [[0, 0], [0, 1], [0, 1], [0, 0]]  # 指向纹理左边框
        else:  # 上下侧面 - 使用上下边框
            uv = [[0, 0], [1, 0], [1, 0], [0, 0]]  # 指向纹理下边框
        
        vertices, face_uvs, normals, indices = create_face_mesh(
            [np.array(v) for v in corners], uv, normal, SIDE_SUBDIVISIONS)
        faces.append((vertices, face_uvs, normals, indices))
    
    # 添加孔洞内壁面
    hole_faces = create_hole_inner_faces(hole_width, hole_height, hole_y_offset, thickness)
    faces.extend(hole_faces)
    
    # 合并所有面的数据
    all_vertices, all_uvs, all_normals, all_indices = [], [], [], []
    for face_data in faces:
        if len(face_data) == 4:  # 标准面数据
            vertices, face_uvs, normals, indices = face_data
        else:  # 预处理过的面数据
            vertices, face_uvs, normals, indices = face_data
        
        base_idx = len(all_vertices)
        all_vertices.extend(vertices)
        all_uvs.extend(face_uvs)
        all_normals.extend(normals)
        all_indices.extend([idx + base_idx for idx in indices])
    
    return (np.array(all_vertices, dtype=np.float32), 
            np.array(all_uvs, dtype=np.float32),
            np.array(all_normals, dtype=np.float32), 
            np.array(all_indices, dtype=np.uint32))

def create_face_with_hole(corners, uvs, normal, subdivisions, hole_width, hole_height, hole_y_offset, badge_width, badge_height):
    """创建带孔洞的面网格"""
    vertices, face_uvs, normals, indices = [], [], [], []
    
    # 计算孔洞在面坐标系中的位置
    hole_center_y = hole_y_offset - badge_height/2  # 转换到面坐标系
    hole_left = -hole_width / 2
    hole_right = hole_width / 2
    hole_bottom = hole_center_y - hole_height / 2
    hole_top = hole_center_y + hole_height / 2
    
    # 生成网格点
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            
            # 双线性插值计算位置
            pos = ((1-u)*(1-v)*corners[0] + u*(1-v)*corners[1] + 
                   u*v*corners[2] + (1-u)*v*corners[3])
            uv_coord = ((1-u)*(1-v)*np.array(uvs[0]) + u*(1-v)*np.array(uvs[1]) + 
                       u*v*np.array(uvs[2]) + (1-u)*v*np.array(uvs[3]))
            
            # 检查是否在孔洞内
            world_x = pos[0]
            world_y = pos[1]
            
            # 如果点在孔洞内，跳过
            if (hole_left <= world_x <= hole_right and 
                hole_bottom <= world_y <= hole_top):
                continue
            
            vertices.append(pos)
            face_uvs.append(uv_coord)
            normals.append(normal)
    
    # 重新生成索引（跳过孔洞区域）
    vertex_map = {}  # 映射原始网格位置到新的顶点索引
    current_idx = 0
    
    for i in range(subdivisions + 1):
        for j in range(subdivisions + 1):
            u, v = i / subdivisions, j / subdivisions
            pos = ((1-u)*(1-v)*corners[0] + u*(1-v)*corners[1] + 
                   u*v*corners[2] + (1-u)*v*corners[3])
            
            world_x = pos[0]
            world_y = pos[1]
            
            if not (hole_left <= world_x <= hole_right and 
                   hole_bottom <= world_y <= hole_top):
                vertex_map[(i, j)] = current_idx
                current_idx += 1
    
    # 生成三角形索引
    for i in range(subdivisions):
        for j in range(subdivisions):
            # 检查四个角点是否都存在
            corners_exist = [
                (i, j) in vertex_map,
                (i+1, j) in vertex_map,
                (i+1, j+1) in vertex_map,
                (i, j+1) in vertex_map
            ]
            
            if all(corners_exist):
                # 所有角点都存在，添加两个三角形
                v0 = vertex_map[(i, j)]
                v1 = vertex_map[(i+1, j)]
                v2 = vertex_map[(i+1, j+1)]
                v3 = vertex_map[(i, j+1)]
                
                indices.extend([v0, v1, v2, v0, v2, v3])
    
    return vertices, face_uvs, normals, indices

def create_hole_inner_faces(hole_width, hole_height, hole_y_offset, thickness):
    """创建孔洞内壁面"""
    half_w = hole_width / 2
    half_h = hole_height / 2
    half_t = thickness / 2
    center_y = hole_y_offset - FIXED_HEIGHT_CM / 200  # 转换到世界坐标
    
    # 孔洞四个内壁面
    inner_faces = []
    
    # 上壁面
    corners = [[-half_w, center_y + half_h, half_t], [half_w, center_y + half_h, half_t],
               [half_w, center_y + half_h, -half_t], [-half_w, center_y + half_h, -half_t]]
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
    normal = [0, -1, 0]
    vertices, face_uvs, normals, indices = create_face_mesh(
        [np.array(v) for v in corners], uvs, normal, 2)
    inner_faces.append((vertices, face_uvs, normals, indices))
    
    # 下壁面
    corners = [[half_w, center_y - half_h, half_t], [-half_w, center_y - half_h, half_t],
               [-half_w, center_y - half_h, -half_t], [half_w, center_y - half_h, -half_t]]
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
    normal = [0, 1, 0]
    vertices, face_uvs, normals, indices = create_face_mesh(
        [np.array(v) for v in corners], uvs, normal, 2)
    inner_faces.append((vertices, face_uvs, normals, indices))
    
    # 左壁面
    corners = [[-half_w, center_y - half_h, half_t], [-half_w, center_y + half_h, half_t],
               [-half_w, center_y + half_h, -half_t], [-half_w, center_y - half_h, -half_t]]
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
    normal = [1, 0, 0]
    vertices, face_uvs, normals, indices = create_face_mesh(
        [np.array(v) for v in corners], uvs, normal, 2)
    inner_faces.append((vertices, face_uvs, normals, indices))
    
    # 右壁面
    corners = [[half_w, center_y + half_h, half_t], [half_w, center_y - half_h, half_t],
               [half_w, center_y - half_h, -half_t], [half_w, center_y + half_h, -half_t]]
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
    normal = [-1, 0, 0]
    vertices, face_uvs, normals, indices = create_face_mesh(
        [np.array(v) for v in corners], uvs, normal, 2)
    inner_faces.append((vertices, face_uvs, normals, indices))
    
    return inner_faces

def create_glb_model(vertices, uvs, normals, indices, texture_img, output_path):
    """创建并保存GLB文件"""
    # 准备几何数据
    geo_data = [vertices.tobytes(), uvs.tobytes(), normals.tobytes(),
                (indices.astype(np.uint16) if len(vertices) < 65536 else indices).tobytes()]
    
    # 处理纹理数据
    if texture_img:
        img_bytes = io.BytesIO()
        texture_img.save(img_bytes, format='PNG')
        img_data = img_bytes.getvalue()
        padding = (4 - (len(img_data) % 4)) % 4
        all_data = img_data + b'\x00' * padding + b''.join(geo_data)
        img_offset = (0, len(img_data))
        geo_offset = len(img_data) + padding
    else:
        all_data = b''.join(geo_data)
        geo_offset = 0
    
    # 创建GLTF对象
    gltf = GLTF2()
    gltf.buffers = [Buffer(byteLength=len(all_data),
                          uri=f"data:application/octet-stream;base64,{base64.b64encode(all_data).decode()}")]
    
    # 缓冲区视图和访问器
    buffer_views = []
    accessors = []
    
    if texture_img:
        buffer_views.append(BufferView(buffer=0, byteOffset=img_offset[0], byteLength=img_offset[1]))
        start_idx = 1
    else:
        start_idx = 0
    
    # 几何数据的缓冲区视图
    targets = [ARRAY_BUFFER, ARRAY_BUFFER, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER]
    offset = geo_offset
    for i, (data, target) in enumerate(zip(geo_data, targets)):
        buffer_views.append(BufferView(buffer=0, byteOffset=offset, byteLength=len(data), target=target))
        offset += len(data)
    
    gltf.bufferViews = buffer_views
    
    # 访问器
    bv_offset = start_idx
    gltf.accessors = [
        Accessor(bufferView=bv_offset, componentType=FLOAT, count=len(vertices), type="VEC3",
                min=vertices.min(axis=0).tolist(), max=vertices.max(axis=0).tolist()),
        Accessor(bufferView=bv_offset+1, componentType=FLOAT, count=len(uvs), type="VEC2"),
        Accessor(bufferView=bv_offset+2, componentType=FLOAT, count=len(normals), type="VEC3"),
        Accessor(bufferView=bv_offset+3, componentType=UNSIGNED_SHORT if len(vertices) < 65536 else UNSIGNED_INT, 
                count=len(indices), type="SCALAR")
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
        if hasattr(mesh.visual, 'uv') and mesh.visual.uv is not None:
            if (hasattr(mesh.visual, 'material') and mesh.visual.material and 
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
        
        if hasattr(mesh.visual, 'kind') and mesh.visual.kind == 'vertex' and mesh.visual.vertex_colors is not None:
            mesh.export(obj_path, **export_kwargs)
            print(f"✅ 顶点颜色OBJ导出成功: {os.path.basename(obj_path)}")
            return True
        elif hasattr(mesh.visual, 'kind') and mesh.visual.kind == 'face' and mesh.visual.face_colors is not None:
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
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"📁 创建输出目录: {OUTPUT_DIR}")
    
    # 处理纹理
    texture_path = os.path.join(os.getcwd(), TEXTURE_FILE)
    if not os.path.exists(texture_path):
        print("❌ 未找到图像文件")
        return
    
    dimensions, texture_img = load_and_process_texture(texture_path) or (
        (FIXED_WIDTH_CM / 100, FIXED_HEIGHT_CM / 100, DEFAULT_THICKNESS_CM / 100), None)
    
    if texture_img is None:
        print("⚠️ 使用默认尺寸")
    
    # 生成文件路径（保存到output目录）
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