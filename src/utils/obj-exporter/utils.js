// 判断点是否在多边形内（射线法）
export function isPointInPolygon(x, y, vertex_indices, all_vertices) {
  let inside = false;
  const vertexData = vertex_indices.map(v => all_vertices[v - 1]);
  
  for (let i = 0, j = vertexData.length - 1; i < vertexData.length; j = i++) {
    const xi = vertexData[i].x, yi = vertexData[i].y;
    const xj = vertexData[j].x, yj = vertexData[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// 专门用于判断点是否在孔洞内的快速算法
export function isPointInHole(x, y, holeParams, holeType) {
  if (!holeParams || !holeType) {
    return false;
  }

  const { centerX, centerY } = holeParams;

  if (holeType === 'circle') {
    const { radius } = holeParams;
    return (x - centerX) ** 2 + (y - centerY) ** 2 < radius ** 2;
  }

  if (holeType === 'oval') {
    const radiusX = holeParams.width / 2;
    const radiusY = holeParams.height / 2;
    // Handle potential division by zero
    if (radiusX === 0 || radiusY === 0) return false;
    return ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 < 1;
  }

  if (holeType === 'rectangle') {
    const { width, height, borderRadius = 0 } = holeParams;
    const w = width / 2;
    const h = height / 2;

    // Simple Axis-Aligned Bounding Box check first for speed
    if (x < centerX - w || x > centerX + w || y < centerY - h || y > centerY + h) {
        return false;
    }
    
    if (borderRadius <= 0.1) {
      // It's inside the bounding box and no border radius, so it's in.
      return true;
    }

    // Check for rounded rectangle
    const dx = Math.abs(x - centerX);
    const dy = Math.abs(y - centerY);

    if (dx <= w - borderRadius || dy <= h - borderRadius) return true;
    
    // Check corner regions
    const cornerDistSq = (dx - (w - borderRadius)) ** 2 + (dy - (h - borderRadius)) ** 2;
    return cornerDistSq <= borderRadius ** 2;
  }

  return false; // Fallback for unsupported types
}

// 计算三角形的正确法线方向
export function calculateTriangleNormal(v1_idx, v2_idx, v3_idx, all_vertices) {
  const vertex1 = all_vertices[v1_idx - 1];
  const vertex2 = all_vertices[v2_idx - 1];
  const vertex3 = all_vertices[v3_idx - 1];
  
  // 计算两个边向量
  const edge1 = {
    x: vertex2.x - vertex1.x,
    y: vertex2.y - vertex1.y,
    z: vertex2.z - vertex1.z
  };
  
  const edge2 = {
    x: vertex3.x - vertex1.x,
    y: vertex3.y - vertex1.y,
    z: vertex3.z - vertex1.z
  };
  
  // 计算叉积得到法线向量
  const normal = {
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: edge1.x * edge2.y - edge1.y * edge2.x
  };
  
  return normal;
}

// 检查三角形法线方向是否正确
export function isNormalCorrect(v1, v2, v3, isFront, all_vertices) {
  const normal = calculateTriangleNormal(v1, v2, v3, all_vertices);
  
  // 对于正面，法线应该指向正Z方向（normal.z > 0）
  // 对于背面，法线应该指向负Z方向（normal.z < 0）
  if (isFront) {
    return normal.z > 0;
  } else {
    return normal.z < 0;
  }
}

// 新增：计算三角形面积（用于细分决策）
export function calculateTriangleArea(v1, v2, v3) {
  // 使用向量叉乘计算面积
  const AB = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
  const AC = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
  const crossProduct = {
    x: AB.y * AC.z - AB.z * AC.y,
    y: AB.z * AC.x - AB.x * AC.z,
    z: AB.x * AC.y - AB.y * AC.x,
  };
  return 0.5 * Math.sqrt(crossProduct.x**2 + crossProduct.y**2 + crossProduct.z**2);
}

// 判断UV点是否在三角面内（重心坐标法）
export function uvInTriangle(u, v, uv1, uv2, uv3) {
  // 计算重心坐标
  const x = u, y = v;
  const x1 = uv1.u, y1 = uv1.v;
  const x2 = uv2.u, y2 = uv2.v;
  const x3 = uv3.u, y3 = uv3.v;
  const denom = (y2 - y3)*(x1 - x3) + (x3 - x2)*(y1 - y3);
  if (Math.abs(denom) < 1e-10) return false; // 退化三角形
  const a = ((y2 - y3)*(x - x3) + (x3 - x2)*(y - y3)) / denom;
  const b = ((y3 - y1)*(x - x3) + (x1 - x3)*(y - y3)) / denom;
  const c = 1 - a - b;
  return a >= -1e-4 && b >= -1e-4 && c >= -1e-4 && a <= 1+1e-4 && b <= 1+1e-4 && c <= 1+1e-4;
} 