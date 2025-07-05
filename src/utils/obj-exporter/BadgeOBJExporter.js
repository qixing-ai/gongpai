import { GeometryGenerator } from './GeometryGenerator.js';
import { MeshProcessor } from './MeshProcessor.js';
import { AdaptiveSubdivision } from './AdaptiveSubdivision.js';
import { OBJWriter } from './OBJWriter.js';
import { TextureGenerator } from './TextureGenerator.js';

export class BadgeOBJExporter {
  constructor(options = {}) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
    this.texturePixelData = null;

    this.subdivision = {
      enabled: true,
      threshold: 0.05,
      maxDepth: 5,
    };

    this.for3DPrinting = options.for3DPrinting || false;
    this.textureCanvas = options.textureCanvas || null;
    
    this.meshDensity = { density: 20 };
    this.meshQuality = { 
      enableBoundaryConnection: true,
      maxBoundaryConnections: 3,
    };

    // Instantiate helpers
    this.geometryGenerator = new GeometryGenerator(this);
    this.meshProcessor = new MeshProcessor(this);
    this.adaptiveSubdivision = new AdaptiveSubdivision(this);
    this.objWriter = new OBJWriter();
    this.textureGenerator = new TextureGenerator();
  }

  setMeshDensity(density) {
    this.meshDensity = { density };
  }

  setMeshQuality(enableBoundaryConnection = true, maxBoundaryConnections = 3) {
    this.meshQuality = { 
      enableBoundaryConnection, 
      maxBoundaryConnections,
    };
  }

  setSubdivisionSettings(enabled = true, threshold = 0.05, maxDepth = 5) {
    this.subdivision = {
      enabled,
      threshold,
      maxDepth
    };
  }

  addVertex(x, y, z) {
    const vertex = { x, y, z };
    if (this.for3DPrinting && this.textureCanvas) {
      vertex.color = { r: 1, g: 1, b: 1 };
    }
    this.vertices.push(vertex);
    return this.vertexIndex++;
  }

  updateVertexColor(vertexIndex, u, v) {
    if (this.for3DPrinting && this.textureCanvas && vertexIndex > 0 && vertexIndex <= this.vertices.length) {
      const color = this.getVertexColor(u, v);
      this.vertices[vertexIndex - 1].color = color;
    }
  }

  getVertexColor(u, v) {
    if (!this.textureCanvas) return { r: 1, g: 1, b: 1 };

    if (!this.texturePixelData) {
      const ctx = this.textureCanvas.getContext('2d', { willReadFrequently: true });
      this.texturePixelData = ctx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height);
    }
    
    const w = this.texturePixelData.width;
    const h = this.texturePixelData.height;

    const texX = u * w;
    const texY = (1 - v) * h;
    
    const x1 = Math.floor(texX);
    const y1 = Math.floor(texY);

    const fx = texX - x1;
    const fy = texY - y1;
    
    const c11_rgb = this._getPixelFromCache(x1, y1);
    const c21_rgb = this._getPixelFromCache(x1 + 1, y1);
    const c12_rgb = this._getPixelFromCache(x1, y1 + 1);
    const c22_rgb = this._getPixelFromCache(x1 + 1, y1 + 1);
    
    const lerp = (a, b, t) => a * (1 - t) + b * t;

    const r_top = lerp(c11_rgb[0], c21_rgb[0], fx);
    const g_top = lerp(c11_rgb[1], c21_rgb[1], fx);
    const b_top = lerp(c11_rgb[2], c21_rgb[2], fx);

    const r_bottom = lerp(c12_rgb[0], c22_rgb[0], fx);
    const g_bottom = lerp(c12_rgb[1], c22_rgb[1], fx);
    const b_bottom = lerp(c12_rgb[2], c22_rgb[2], fx);

    const r = lerp(r_top, r_bottom, fy);
    const g = lerp(g_top, g_bottom, fy);
    const b = lerp(b_top, b_bottom, fy);

    return {
      r: r / 255.0,
      g: g / 255.0,
      b: b / 255.0,
    };
  }
  
  _getPixelFromCache(x, y) {
    const w = this.texturePixelData.width;
    const h = this.texturePixelData.height;
    
    const clampedX = Math.max(0, Math.min(x, w - 1));
    const clampedY = Math.max(0, Math.min(y, h - 1));
    
    const i = (clampedY * w + clampedX) * 4;
    const data = this.texturePixelData.data;
    return [data[i], data[i+1], data[i+2]];
  }

  addUV(u, v) {
    this.uvs.push({ u, v });
    return this.uvs.length;
  }

  addFace(v1, v2, v3, uv1, uv2, uv3) {
    if (v1 !== v2 && v2 !== v3 && v1 !== v3) {
      this.faces.push({ vertices: [v1, v2, v3], uvs: [uv1, uv2, uv3] });
    }
  }

  async generateBadgeOBJ(badgeSettings, holeSettings, imageSettings, texts, exportSettings) {
    this.vertices = [];
    this.uvs = [];
    this.faces = [];
    this.vertexIndex = 1;
    this.texturePixelData = null;

    const { width, height, borderRadius } = badgeSettings;
    const thickness = exportSettings.thickness;
    const doubleSided = exportSettings.doubleSided;
    
    // Generate texture first as it's needed for other steps
    this.textureCanvas = await this.textureGenerator.generateTextureCanvas(badgeSettings, holeSettings, imageSettings, texts, exportSettings);

    if (this.subdivision.enabled && this.textureCanvas) {
      this.adaptiveSubdivision.createEdgeMap();
    }

    const outerPoints = this.geometryGenerator.createPoints('rectangle', { width, height, borderRadius });
    const outer = this.geometryGenerator.createVerticesAndUVs(outerPoints, thickness, width, height, doubleSided);
    
    const holeInfo = { enabled: false };
    if (holeSettings.enabled) {
      const { holeParams, holeType } = this.geometryGenerator.calculateHoleParams(holeSettings, width, height);
      const innerPoints = this.geometryGenerator.createPoints(holeType, holeParams);
      const inner = this.geometryGenerator.createVerticesAndUVs(innerPoints, thickness, width, height, doubleSided);
      holeInfo.enabled = true;
      holeInfo.vertices = inner.vertices;
      holeInfo.uvs = inner.uvs;
      holeInfo.params = holeParams;
      holeInfo.type = holeType;
    }

    this.meshProcessor.generateFaces(outer.vertices, outer.uvs, outerPoints.length, holeInfo, thickness, badgeSettings);

    this.adaptiveSubdivision.performAdaptiveSubdivision();

    const objContent = this.objWriter.generateOBJContent(this.vertices, this.uvs, this.faces, this.for3DPrinting);
    
    let mtlContent = null;
    if (!this.for3DPrinting) {
      mtlContent = this.objWriter.generateMTLContent();
    }

    let textureBlob = null;
    if (this.textureCanvas) {
      textureBlob = await new Promise(res => this.textureCanvas.toBlob(res, 'image/png'));
    }

    return { objContent, mtlContent, textureBlob };
  }
} 