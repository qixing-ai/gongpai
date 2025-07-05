export class OBJWriter {
  generateOBJContent(vertices, uvs, faces, for3DPrinting) {
    let obj = '';
    if (!for3DPrinting) {
      obj += 'mtllib badge.mtl\n';
    }

    // 顶点数据
    vertices.forEach(v => {
      if (for3DPrinting && v.color) {
        obj += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)} ${v.color.r.toFixed(4)} ${v.color.g.toFixed(4)} ${v.color.b.toFixed(4)}\n`;
      } else {
        obj += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
      }
    });

    if (!for3DPrinting) {
      // UV数据
      uvs.forEach(uv => {
        obj += `vt ${uv.u.toFixed(4)} ${uv.v.toFixed(4)}\n`;
      });

      obj += 'usemtl badge_material\n';
    }

    // 面数据
    faces.forEach(face => {
      if (for3DPrinting) {
        obj += `f ${face.vertices[0]} ${face.vertices[1]} ${face.vertices[2]}\n`;
      } else {
        obj += `f ${face.vertices[0]}/${face.uvs[0]} ${face.vertices[1]}/${face.uvs[1]} ${face.vertices[2]}/${face.uvs[2]}\n`;
      }
    });

    return obj;
  }

  generateMTLContent() {
    return `# 工牌材质文件 - 重拓扑优化版本\n# 生成时间: ${new Date().toLocaleString('zh-CN')}\n# 优化特性: 重拓扑密集网格，正方形划分，便于顶点颜色映射\nnewmtl badge_material\nKa 0.2 0.2 0.2\nKd 0.8 0.8 0.8\nKs 0.1 0.1 0.1\nNs 10.0\nd 1.0\nillum 2\nmap_Kd badge_texture.png\n`;
  }
} 