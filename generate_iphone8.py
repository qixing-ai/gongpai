#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""iPhone 8 3D模型生成器 - 生成向外凸起圆弧边缘的iPhone 8模型"""

import math
import os

class iPhone8Generator:
    def __init__(self):
        # iPhone 8尺寸参数
        self.width = 6.73
        self.height = 13.84
        self.depth = 0.20
        self.corner_radius = 1.0
        self.edge_radius = 0.04
        
        self.vertices = []
        self.faces = []
    
    def add_vertex(self, x, y, z):
        """添加顶点并返回索引"""
        self.vertices.append([x, y, z])
        return len(self.vertices) - 1
    
    def add_face(self, v1, v2, v3):
        """添加三角面"""
        self.faces.append([v1, v2, v3])
    
    def add_quad(self, v1, v2, v3, v4):
        """添加四边形（两个三角面）"""
        self.add_face(v1, v2, v3)
        self.add_face(v1, v3, v4)
    
    def create_rounded_rectangle(self, width, height, radius, z, segments=32):
        """创建圆角矩形轮廓"""
        vertices = []
        half_w, half_h = width / 2, height / 2
        
        # 四个圆角中心点
        corners = [
            (half_w - radius, half_h - radius),   # 右上
            (-half_w + radius, half_h - radius),  # 左上
            (-half_w + radius, -half_h + radius), # 左下
            (half_w - radius, -half_h + radius)   # 右下
        ]
        
        # 为每个圆角生成弧线顶点
        for i, (cx, cy) in enumerate(corners):
            start_angle = i * math.pi / 2
            for j in range(segments):
                angle = start_angle + j * (math.pi / 2) / segments
                x = cx + radius * math.cos(angle)
                y = cy + radius * math.sin(angle)
                vertices.append(self.add_vertex(x, y, z))
        
        return vertices
    
    def create_edge_profile(self, outline_vertices, segments=16):
        """创建边缘轮廓层"""
        all_layers = []
        
        for layer in range(segments + 1):
            t = layer / segments
            z_pos = -self.depth/2 + t * self.depth
            
            # 使用正弦函数创建凸起效果
            convex_factor = math.sin(t * math.pi) * self.edge_radius
            expand_factor = 1 + convex_factor / max(self.width, self.height) * 4
            
            layer_vertices = []
            for vertex_idx in outline_vertices:
                x, y, _ = self.vertices[vertex_idx]
                layer_vertices.append(self.add_vertex(
                    x * expand_factor, y * expand_factor, z_pos
                ))
            
            all_layers.append(layer_vertices)
        
        return all_layers
    
    def connect_layers(self, layers):
        """连接相邻层形成侧面"""
        for i in range(len(layers) - 1):
            current, next_layer = layers[i], layers[i + 1]
            num_vertices = len(current)
            
            for j in range(num_vertices):
                next_j = (j + 1) % num_vertices
                self.add_quad(
                    current[j], current[next_j],
                    next_layer[next_j], next_layer[j]
                )
    
    def triangulate_surface(self, vertices, z, is_front=True):
        """三角化表面"""
        if len(vertices) < 3:
            return
        
        center = self.add_vertex(0, 0, z)
        for i in range(len(vertices)):
            next_i = (i + 1) % len(vertices)
            if is_front:
                self.add_face(center, vertices[i], vertices[next_i])
            else:
                self.add_face(center, vertices[next_i], vertices[i])
    
    def connect_surface_to_edge(self, surface_vertices, edge_vertices):
        """连接表面到边缘"""
        if len(surface_vertices) != len(edge_vertices):
            return
        
        num_vertices = len(edge_vertices)
        for i in range(num_vertices):
            next_i = (i + 1) % num_vertices
            self.add_quad(
                surface_vertices[i], surface_vertices[next_i],
                edge_vertices[next_i], edge_vertices[i]
            )
    
    def generate(self):
        """生成完整模型"""
        print("正在生成iPhone 8模型...")
        
        # 1. 创建外轮廓
        outline = self.create_rounded_rectangle(
            self.width, self.height, self.corner_radius, 0, segments=40
        )
        
        # 2. 创建边缘轮廓层
        edge_layers = self.create_edge_profile(outline, segments=20)
        
        # 3. 连接边缘层形成侧面
        self.connect_layers(edge_layers)
        
        # 4. 创建内表面
        inner_margin = self.edge_radius * 0.2
        inner_width = self.width - inner_margin * 2
        inner_height = self.height - inner_margin * 2
        inner_radius = self.corner_radius - inner_margin
        surface_z_offset = self.edge_radius * 0.3
        
        top_surface = self.create_rounded_rectangle(
            inner_width, inner_height, inner_radius,
            self.depth/2 - surface_z_offset, segments=40
        )
        
        bottom_surface = self.create_rounded_rectangle(
            inner_width, inner_height, inner_radius,
            -self.depth/2 + surface_z_offset, segments=40
        )
        
        # 5. 连接表面到边缘
        self.connect_surface_to_edge(top_surface, edge_layers[-1])
        self.connect_surface_to_edge(bottom_surface, edge_layers[0])
        
        # 6. 三角化表面中心
        self.triangulate_surface(top_surface, self.depth/2 - surface_z_offset, True)
        self.triangulate_surface(bottom_surface, -self.depth/2 + surface_z_offset, False)
        
        print(f"模型生成完成！顶点数：{len(self.vertices)}，面数：{len(self.faces)}")
    
    def save_obj(self, filename):
        """保存为OBJ格式"""
        os.makedirs('output', exist_ok=True)
        filepath = os.path.join('output', filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            # 文件头信息
            f.write("# iPhone 8 3D模型\n")
            f.write(f"# 顶点数: {len(self.vertices)} 面数: {len(self.faces)}\n\n")
            
            # 顶点数据
            for x, y, z in self.vertices:
                f.write(f"v {x:.6f} {y:.6f} {z:.6f}\n")
            
            f.write("\n")
            
            # 面数据
            for v1, v2, v3 in self.faces:
                f.write(f"f {v1+1} {v2+1} {v3+1}\n")
        
        print(f"模型已保存至: {filepath}")

def main():
    """主函数"""
    print("iPhone 8 3D模型生成器")
    print("=" * 30)
    
    generator = iPhone8Generator()
    generator.generate()
    generator.save_obj("iphone8_seamless.obj")
    
    print(f"\n模型规格:")
    print(f"- 尺寸: {generator.width} × {generator.height} × {generator.depth}")
    print(f"- 顶点数: {len(generator.vertices)}")
    print(f"- 面数: {len(generator.faces)}")
    print(f"- 特性: 向外凸起圆弧边缘，无缝连接")
    print("\n✅ iPhone 8模型生成完成！")

if __name__ == "__main__":
    main() 