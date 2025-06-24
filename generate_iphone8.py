#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
iPhone 8 3D模型生成器
生成向外凸起圆弧边缘的iPhone 8模型
"""

import math
import os

class iPhone8Generator:
    def __init__(self):
        # iPhone 8尺寸
        self.width = 6.73
        self.height = 13.84
        self.depth = 0.73
        self.corner_radius = 1.0
        self.edge_radius = 0.15
        
        self.vertices = []
        self.faces = []
    
    def add_vertex(self, x, y, z):
        """添加顶点"""
        self.vertices.append([x, y, z])
        return len(self.vertices) - 1
    
    def add_face(self, v1, v2, v3):
        """添加三角面"""
        self.faces.append([v1, v2, v3])
    
    def add_quad(self, v1, v2, v3, v4):
        """添加四边形"""
        self.add_face(v1, v2, v3)
        self.add_face(v1, v3, v4)
    
    def create_rounded_rectangle(self, width, height, radius, z, segments=16):
        """创建圆角矩形轮廓"""
        vertices = []
        half_w = width / 2
        half_h = height / 2
        
        corners = [
            (half_w - radius, half_h - radius),   # 右上
            (-half_w + radius, half_h - radius),  # 左上
            (-half_w + radius, -half_h + radius), # 左下
            (half_w - radius, -half_h + radius)   # 右下
        ]
        
        for i, (cx, cy) in enumerate(corners):
            start_angle = i * math.pi / 2
            for j in range(segments):
                angle = start_angle + j * (math.pi / 2) / segments
                x = cx + radius * math.cos(angle)
                y = cy + radius * math.sin(angle)
                vertices.append(self.add_vertex(x, y, z))
        
        return vertices
    
    def create_convex_edge(self, outline_vertices, base_z, segments=6):
        """创建向外凸起的圆弧边缘"""
        edge_layers = []
        
        for layer in range(segments + 1):
            layer_vertices = []
            t = layer / segments
            angle = t * math.pi / 2
            
            z_offset = self.edge_radius * math.sin(angle)
            expand_factor = 1 + self.edge_radius * math.sin(angle) / max(self.width, self.height) * 2
            
            if base_z > 0:
                z_pos = base_z - z_offset
            else:
                z_pos = base_z + z_offset
            
            for vertex_idx in outline_vertices:
                x, y, _ = self.vertices[vertex_idx]
                x_expanded = x * expand_factor
                y_expanded = y * expand_factor
                layer_vertices.append(self.add_vertex(x_expanded, y_expanded, z_pos))
            
            edge_layers.append(layer_vertices)
        
        return edge_layers
    
    def connect_layers(self, edge_layers, is_top=True):
        """连接边缘层"""
        for i in range(len(edge_layers) - 1):
            current_layer = edge_layers[i]
            next_layer = edge_layers[i + 1]
            
            num_vertices = len(current_layer)
            for j in range(num_vertices):
                next_j = (j + 1) % num_vertices
                
                if is_top:
                    self.add_quad(
                        current_layer[j], next_layer[j],
                        next_layer[next_j], current_layer[next_j]
                    )
                else:
                    self.add_quad(
                        current_layer[j], current_layer[next_j],
                        next_layer[next_j], next_layer[j]
                    )
    
    def connect_sides(self, top_outer, bottom_outer):
        """连接上下边缘"""
        num_vertices = len(top_outer)
        for i in range(num_vertices):
            next_i = (i + 1) % num_vertices
            self.add_quad(
                top_outer[i], top_outer[next_i],
                bottom_outer[next_i], bottom_outer[i]
            )
    
    def triangulate_face(self, vertices, z, is_front=True):
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
    
    def generate(self):
        """生成iPhone 8模型"""
        print("正在生成iPhone 8模型...")
        
        # 创建内层轮廓
        top_inner = self.create_rounded_rectangle(
            self.width, self.height, self.corner_radius, 
            self.depth/2 - self.edge_radius
        )
        
        bottom_inner = self.create_rounded_rectangle(
            self.width, self.height, self.corner_radius, 
            -self.depth/2 + self.edge_radius
        )
        
        # 创建凸起边缘
        top_edge_layers = self.create_convex_edge(top_inner, self.depth/2 - self.edge_radius)
        bottom_edge_layers = self.create_convex_edge(bottom_inner, -self.depth/2 + self.edge_radius)
        
        # 连接所有面
        self.connect_layers(top_edge_layers, is_top=True)
        self.connect_layers(bottom_edge_layers, is_top=False)
        self.connect_sides(top_edge_layers[-1], bottom_edge_layers[-1])
        
        # 添加上下表面
        self.triangulate_face(top_inner, self.depth/2 - self.edge_radius, True)
        self.triangulate_face(bottom_inner, -self.depth/2 + self.edge_radius, False)
        
        print(f"模型生成完成！顶点数：{len(self.vertices)}，面数：{len(self.faces)}")
    
    def save_obj(self, filename):
        """保存为OBJ格式"""
        # 确保output目录存在
        os.makedirs('output', exist_ok=True)
        
        filepath = os.path.join('output', filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("# iPhone 8 3D模型\n")
            f.write("# 向外凸起圆弧边缘\n")
            f.write(f"# 顶点数: {len(self.vertices)}\n")
            f.write(f"# 面数: {len(self.faces)}\n\n")
            
            # 写入顶点
            for vertex in self.vertices:
                f.write(f"v {vertex[0]:.6f} {vertex[1]:.6f} {vertex[2]:.6f}\n")
            
            f.write("\n")
            
            # 写入面
            for face in self.faces:
                f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
        
        print(f"模型已保存至: {filepath}")

def main():
    """主函数"""
    print("iPhone 8 3D模型生成器")
    print("=" * 30)
    
    generator = iPhone8Generator()
    generator.generate()
    generator.save_obj("iphone8.obj")
    
    print("\n模型规格:")
    print(f"- 尺寸: {generator.width} × {generator.height} × {generator.depth}")
    print(f"- 顶点数: {len(generator.vertices)}")
    print(f"- 面数: {len(generator.faces)}")
    print(f"- 边缘: 向外凸起圆弧")
    
    print("\n✅ iPhone 8模型生成完成！")

if __name__ == "__main__":
    main() 