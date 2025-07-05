import { uvInTriangle } from './utils.js';

export class AdaptiveSubdivision {
  constructor(exporter) {
    this.exporter = exporter;
    this.edgeMap = null;
  }

  // 新增：根据UV坐标从边缘图中获取强度值（使用双线性插值）
  getEdgeIntensity(u, v) {
    if (!this.edgeMap) return 0;

    const w = this.edgeMap.width;
    const h = this.edgeMap.height;

    // 将UV坐标映射到像素坐标，并确保不越界
    const texX = Math.max(0, Math.min(u * w, w - 1));
    const texY = Math.max(0, Math.min((1 - v) * h, h - 1)); // 修正：V坐标需要反转以匹配纹理

    const x1 = Math.floor(texX);
    const y1 = Math.floor(texY);

    // 双线性插值需要4个点
    const x2 = Math.min(x1 + 1, w - 1);
    const y2 = Math.min(y1 + 1, h - 1);

    // 计算插值因子
    const fx = texX - x1;
    const fy = texY - y1;

    // 从边缘图中获取4个点的强度值
    const c11 = this.edgeMap.data[y1 * w + x1] || 0;
    const c21 = this.edgeMap.data[y1 * w + x2] || 0;
    const c12 = this.edgeMap.data[y2 * w + x1] || 0;
    const c22 = this.edgeMap.data[y2 * w + x2] || 0;

    const lerp = (a, b, t) => a * (1 - t) + b * t;

    // 在X方向上插值
    const top = lerp(c11, c21, fx);
    const bottom = lerp(c12, c22, fx);

    // 在Y方向上插值
    return lerp(top, bottom, fy);
  }
  
  // 新增：创建边缘图（多尺度、多算子边缘检测）
  createEdgeMap() {
    const textureCanvas = this.exporter.textureCanvas;
    if (!textureCanvas) return;
    
    const ctx = textureCanvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, textureCanvas.width, textureCanvas.height);
    const width = imageData.width;
    const height = imageData.height;
    
    const grayscale = new Float32Array(width * height);
    
    // 1. 转为灰度图（使用更精确的权重）
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      // 考虑透明度，透明区域视为背景
      const alpha = a / 255.0;
      grayscale[i / 4] = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
    }
    
    // 2. 简化但可靠的Sobel边缘检测
    const edges = new Float32Array(width * height);
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    // V13 - 恢复预处理模糊以抑制噪声，同时采用平衡的增强策略
    const blurred = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        // 简单的3x3均值滤波
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            sum += grayscale[(y + j) * width + (x + i)];
          }
        }
        blurred[y * width + x] = sum / 9.0;
      }
    }
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        // 应用Sobel算子到模糊后的图像，以获得更平滑的边缘
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const pixel = blurred[(y + j) * width + (x + i)];
            gx += pixel * sobelX[j + 1][i + 1];
            gy += pixel * sobelY[j + 1][i + 1];
          }
        }
        
        // 计算梯度幅值，并增强较小的梯度
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        // 使用幂函数增强弱边缘 - V13: 平衡点
        edges[y * width + x] = Math.pow(magnitude, 0.6);
      }
    }
    
    // 3. 更激进的归一化：使用更低的百分位数 - V13: 恢复到更稳定的90百分位
    let maxEdge = 0;
    const edgeArray = Array.from(edges).filter(v => v > 0).sort((a, b) => a - b);
    if (edgeArray.length > 0) {
      // 使用90百分位，这是一个在亮度和噪声之间较好的平衡
      const p90Index = Math.floor(edgeArray.length * 0.90);
      maxEdge = edgeArray[p90Index] || edgeArray[edgeArray.length - 1];
    }
    
    if (maxEdge > 0) {
      for (let i = 0; i < edges.length; i++) {
        edges[i] = Math.min(1.0, edges[i] / maxEdge);
      }
    }
    
    // 4. 存储边缘图
    this.edgeMap = {
      data: edges,
      width: width,
      height: height,
    };
  }

  // 新增：像素级反查法，预处理所有需要强制细分的三角面
  markForceSubdivideFaces() {
    if (!this.edgeMap) return new Set();
    const threshold = this.exporter.subdivision.threshold * 0.1; // 极低阈值
    const w = this.edgeMap.width;
    const h = this.edgeMap.height;
    const faces = this.exporter.faces;
    const uvs = this.exporter.uvs;
    const forceSet = new Set();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (this.edgeMap.data[idx] > threshold) {
          const u = x / w;
          const v = 1 - (y / h);
          for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const uv1 = uvs[face.uvs[0] - 1];
            const uv2 = uvs[face.uvs[1] - 1];
            const uv3 = uvs[face.uvs[2] - 1];
            if (uvInTriangle(u, v, uv1, uv2, uv3)) {
              forceSet.add(i);
            }
          }
        }
      }
    }
    return forceSet;
  }

  // 修改：自适应细分总控函数，支持像素级反查法
  performAdaptiveSubdivision() {
    if (!this.edgeMap || !this.exporter.subdivision.enabled) return;

    // 1. 先标记所有需要强制细分的三角面
    const forceSet = this.markForceSubdivideFaces();
    const facesToProcess = [...this.exporter.faces];
    this.exporter.faces = []; // 重置面数组，后面将填充细分后的结果

    for (let i = 0; i < facesToProcess.length; i++) {
      this.subdivideFaceRecursively(facesToProcess[i], 0, forceSet, i);
    }
  }

  // 修改：递归细分单个面，支持forceSet
  subdivideFaceRecursively(face, depth, forceSet = null, faceIdx = -1) {
    const [v1_idx, v2_idx, v3_idx] = face.vertices;
    const [uv1_idx, uv2_idx, uv3_idx] = face.uvs;
    const uvs = this.exporter.uvs;
    const uv1 = uvs[uv1_idx - 1];
    const uv2 = uvs[uv2_idx - 1];
    const uv3 = uvs[uv3_idx - 1];

    // 使用三角形边缘和中心的边缘强度进行综合判断
    const intensity1 = this.getEdgeIntensity(uv1.u, uv1.v);
    const intensity2 = this.getEdgeIntensity(uv2.u, uv2.v);
    const intensity3 = this.getEdgeIntensity(uv3.u, uv3.v);
    
    // 检查三条边的中点强度（边缘连续性）
    const edge12_u = (uv1.u + uv2.u) / 2;
    const edge12_v = (uv1.v + uv2.v) / 2;
    const edge23_u = (uv2.u + uv3.u) / 2;
    const edge23_v = (uv2.v + uv3.v) / 2;
    const edge31_u = (uv3.u + uv1.u) / 2;
    const edge31_v = (uv3.v + uv1.v) / 2;
    
    const edgeIntensity1 = this.getEdgeIntensity(edge12_u, edge12_v);
    const edgeIntensity2 = this.getEdgeIntensity(edge23_u, edge23_v);
    const edgeIntensity3 = this.getEdgeIntensity(edge31_u, edge31_v);
    
    // 三角形中心强度
    const centerIntensity = this.getEdgeIntensity(
      (uv1.u + uv2.u + uv3.u) / 3,
      (uv1.v + uv2.v + uv3.v) / 3
    );
    
    const maxVertexIntensity = Math.max(intensity1, intensity2, intensity3);
    const maxEdgeIntensity = Math.max(edgeIntensity1, edgeIntensity2, edgeIntensity3);
    const maxIntensity = Math.max(maxVertexIntensity, maxEdgeIntensity, centerIntensity);
    
    // 新增：计算强度范围，用于判断是否跨越了边缘
    const minVertexIntensity = Math.min(intensity1, intensity2, intensity3);
    const minEdgeIntensity = Math.min(edgeIntensity1, edgeIntensity2, edgeIntensity3);
    const minIntensity = Math.min(minVertexIntensity, minEdgeIntensity, centerIntensity);
    const intensityRange = maxIntensity - minIntensity;
    
    // 计算平均强度，加权边缘强度
    const avgIntensity = (intensity1 + intensity2 + intensity3 + 
                         edgeIntensity1 * 1.5 + edgeIntensity2 * 1.5 + edgeIntensity3 * 1.5 + 
                         centerIntensity) / 10;
    
    // 计算三角形在UV空间的面积
    const uvArea = Math.abs((uv2.u - uv1.u) * (uv3.v - uv1.v) - (uv3.u - uv1.u) * (uv2.v - uv1.v)) / 2;
    
    // V15 - "终极攻势"：基于V10的成功逻辑，将所有阈值推向极限
    const baseThreshold = this.exporter.subdivision.threshold;

    // 条件1: 任何细节（极限阈值）
    const condition1 = maxIntensity > (baseThreshold * 0.05);

    // 条件2: 任何变化（极限阈值）
    const condition2 = intensityRange > (baseThreshold * 0.02);
    
    // 条件3: 大面积安全网（极限宽松）
    const condition3 = uvArea > 0.0003 && intensityRange > (baseThreshold * 0.01);

    // 条件4: 极微量强度区域
    const condition4 = avgIntensity > (baseThreshold * 0.02) && uvArea > 0.00005;

    // 条件5: 任何边缘响应（极限宽松）
    const hasAnyEdge = edgeIntensity1 > 0 || edgeIntensity2 > 0 || edgeIntensity3 > 0;
    const condition5 = hasAnyEdge && uvArea > 0.0001;

    // 条件6: 中等面积强制细分（更小面积）
    const condition6 = uvArea > 0.0008;

    // 条件7: 任何顶点响应（极限宽松）
    const hasAnyVertex = intensity1 > 0 || intensity2 > 0 || intensity3 > 0 || centerIntensity > 0;
    const condition7 = hasAnyVertex && uvArea > 0.00005;

    // 条件8: 微弱信号的大区域（极限宽松）
    const condition8 = avgIntensity > (baseThreshold * 0.01) && uvArea > 0.0004;

    // 条件9: 任何信号的中等区域（极限宽松）
    const hasAnyIntensity = maxIntensity > 0;
    const condition9 = hasAnyIntensity && uvArea > 0.0002;

    // 条件10: 强制细分面积（更小面积）
    const condition10 = uvArea > 0.0005;

    // V16: 新增：大三角面内部多点采样，防止漏判
    let extraSampleStrong = false;
    if (uvArea > 0.0005) { // 只对大三角面进行额外的高成本采样
      const baryCoords = [
        [0.25, 0.25, 0.5], [0.5, 0.25, 0.25], [0.25, 0.5, 0.25],
        [1/3, 1/3, 1/3],   [0.5, 0.5, 0],     [0, 0.5, 0.5], [0.5, 0, 0.5]
      ];
      for (const [a, b, c] of baryCoords) {
        const u = uv1.u * a + uv2.u * b + uv3.u * c;
        const v = uv1.v * a + uv2.v * b + uv3.v * c;
        const intensity = this.getEdgeIntensity(u, v);
        if (intensity > (baseThreshold * 0.1)) { // 使用一个灵敏的阈值
          extraSampleStrong = true;
          break;
        }
      }
    }
    const condition11 = extraSampleStrong;

    const shouldSubdivide = condition1 || condition2 || condition3 || condition4 || condition5 || 
                           condition6 || condition7 || condition8 || condition9 || condition10 || condition11;

    let forceMaxDepth = false;
    if (forceSet && faceIdx >= 0 && forceSet.has(faceIdx)) {
      forceMaxDepth = true;
    }
    if ((depth < this.exporter.subdivision.maxDepth && shouldSubdivide) || (forceMaxDepth && depth < this.exporter.subdivision.maxDepth)) {
      const v1 = this.exporter.vertices[v1_idx - 1];
      const v2 = this.exporter.vertices[v2_idx - 1];
      const v3 = this.exporter.vertices[v3_idx - 1];
      
      // 计算三条边的中点
      const m12_pos = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2, z: (v1.z + v2.z) / 2 };
      const m23_pos = { x: (v2.x + v3.x) / 2, y: (v2.y + v3.y) / 2, z: (v2.z + v3.z) / 2 };
      const m31_pos = { x: (v3.x + v1.x) / 2, y: (v3.y + v1.y) / 2, z: (v3.z + v1.z) / 2 };

      const m12_uv = { u: (uv1.u + uv2.u) / 2, v: (uv1.v + uv2.v) / 2 };
      const m23_uv = { u: (uv2.u + uv3.u) / 2, v: (uv2.v + uv3.v) / 2 };
      const m31_uv = { u: (uv3.u + uv1.u) / 2, v: (uv3.v + uv1.v) / 2 };
      
      // 添加新的顶点和UV
      const m12_v_idx = this.exporter.addVertex(m12_pos.x, m12_pos.y, m12_pos.z);
      const m23_v_idx = this.exporter.addVertex(m23_pos.x, m23_pos.y, m23_pos.z);
      const m31_v_idx = this.exporter.addVertex(m31_pos.x, m31_pos.y, m31_pos.z);

      const m12_uv_idx = this.exporter.addUV(m12_uv.u, m12_uv.v);
      const m23_uv_idx = this.exporter.addUV(m23_uv.u, m23_uv.v);
      const m31_uv_idx = this.exporter.addUV(m31_uv.u, m31_uv.v);

      if (this.exporter.for3DPrinting) {
        this.exporter.updateVertexColor(m12_v_idx, m12_uv.u, m12_uv.v);
        this.exporter.updateVertexColor(m23_v_idx, m23_uv.u, m23_uv.v);
        this.exporter.updateVertexColor(m31_v_idx, m31_uv.u, m31_uv.v);
      }
      
      const triangle1 = { vertices: [v1_idx, m12_v_idx, m31_v_idx], uvs: [uv1_idx, m12_uv_idx, m31_uv_idx] };
      const triangle2 = { vertices: [m12_v_idx, v2_idx, m23_v_idx], uvs: [m12_uv_idx, uv2_idx, m23_uv_idx] };
      const triangle3 = { vertices: [m31_v_idx, m23_v_idx, v3_idx], uvs: [m31_uv_idx, m23_uv_idx, uv3_idx] };
      const triangle4 = { vertices: [m12_v_idx, m23_v_idx, m31_v_idx], uvs: [m12_uv_idx, m23_uv_idx, m31_uv_idx] };
      
      // 递归细分4个新创建的三角形
      this.subdivideFaceRecursively(triangle1, depth + 1, forceSet, faceIdx);
      this.subdivideFaceRecursively(triangle2, depth + 1, forceSet, faceIdx);
      this.subdivideFaceRecursively(triangle3, depth + 1, forceSet, faceIdx);
      this.subdivideFaceRecursively(triangle4, depth + 1, forceSet, faceIdx);
      
    } else {
      // 如果不满足细分条件，则直接将当前面加入最终列表
      this.exporter.faces.push(face);
    }
  }
}