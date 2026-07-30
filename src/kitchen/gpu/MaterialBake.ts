/**
 * Boot-time procedural texture synth — macro → meso → micro + cavity AO.
 * DataTexture only (CanvasTexture uploads black on WebGPU).
 */

import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  type Texture,
} from 'three';
import type { Rng } from '../../core/Seed';
import { hashCombine, mix32 } from '../../core/Seed';

export interface MaterialKit {
  woodAlbedo: Texture;
  woodRough: Texture;
  woodNormal: Texture;
  woodAo: Texture;
  stoneAlbedo: Texture;
  stoneRough: Texture;
  stoneNormal: Texture;
  brickAlbedo: Texture;
  brickRough: Texture;
  brickNormal: Texture;
  brickAo: Texture;
  tileAlbedo: Texture;
  tileRough: Texture;
  tileNormal: Texture;
  metalAlbedo: Texture;
  metalRough: Texture;
  metalNormal: Texture;
  brassAlbedo: Texture;
  brassRough: Texture;
  ceramicAlbedo: Texture;
  ceramicRough: Texture;
  wallAlbedo: Texture;
  wallRough: Texture;
  dispose(): void;
}

function hash2(x: number, y: number, seed: number): number {
  return mix32(hashCombine(hashCombine(x * 374761393, y * 668265263), seed)) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number, oct = 5): number {
  let a = 0.5;
  let f = 1;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * valueNoise(x * f, y * f, seed + i * 97);
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

/**
 * WebGPURenderer often fails to sample CanvasTexture (uploads as black).
 * Bake into an owned Uint8 DataTexture instead.
 */
function imageDataToTexture(imageData: ImageData, srgb: boolean): DataTexture {
  const data = new Uint8Array(imageData.data);
  const tex = new DataTexture(data, imageData.width, imageData.height, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.flipY = false;
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function aoFromFloat(ao: Float32Array, size: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(Math.min(1, Math.max(0, ao[i]!)) * 255);
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.flipY = false;
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function normalFromHeight(height: Float32Array, size: number, strength: number): DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const hL = height[y * size + ((x - 1 + size) % size)]!;
      const hR = height[y * size + ((x + 1) % size)]!;
      const hD = height[((y - 1 + size) % size) * size + x]!;
      const hU = height[((y + 1) % size) * size + x]!;
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const idx = i * 4;
      data[idx] = Math.floor((dx * inv * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((dy * inv * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((1 * inv * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** Warm medium oak — vertical grain, pores, cavity AO (BarkSynth method). */
function bakeWood(size: number, seed: number, rng: Rng): {
  albedo: DataTexture;
  rough: DataTexture;
  normal: DataTexture;
  ao: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const aoField = new Float32Array(size * size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);

  // Medium warm oak (kitchen-render family)
  const base = new Color().setHSL(0.075 + rng.range(-0.015, 0.015), 0.48, 0.42);
  const deep = base.clone().offsetHSL(0.01, 0.08, -0.16);
  const high = base.clone().offsetHSL(-0.005, -0.06, 0.14);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // macro tint boards
      const macro = fbm(u * 1.8, v * 1.8, seed, 3);
      const warp = fbm(u * 3.2, v * 2.4, seed + 2, 3) * 0.42;
      // meso vertical grain (stretched V)
      const grain = fbm(u * 1.6 + warp, v * 32 + warp * 2.2, seed + 3, 5);
      const meso = fbm(u * 9, v * 7, seed + 11, 3);
      const micro = fbm(u * 48, v * 48, seed + 19, 2);
      const t = grain * 0.58 + meso * 0.22 + micro * 0.08 + macro * 0.12;
      const c = deep.clone().lerp(high, t);
      // pore streaks in latewood
      const pore = Math.pow(Math.abs(Math.sin((v * 72 + warp * 14) * Math.PI)), 10);
      c.offsetHSL(0.002, 0.02, -pore * 0.055);
      // soft cavity in grain valleys (BarkSynth-style)
      const cavity = 0.55 + grain * 0.35 + (1 - pore) * 0.08;
      const ao = Math.min(1, Math.max(0.42, cavity));

      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;

      height[y * size + x] = t * 0.7 + pore * 0.15;
      aoField[y * size + x] = ao;
      // satin–matte roughness band ~0.55–0.78
      const r = 0.55 + (1 - t) * 0.18 + micro * 0.08 + pore * 0.06;
      const rv = Math.floor(Math.min(255, r * 255));
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
    normal: normalFromHeight(height, size, 5.2),
    ao: aoFromFloat(aoField, size),
  };
}

/** Near-black polished stone with soft veins (hero counters). */
function bakeStone(size: number, seed: number, rng: Rng): {
  albedo: DataTexture;
  rough: DataTexture;
  normal: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);
  const base = new Color().setHSL(0.62, 0.04, rng.range(0.06, 0.1));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const macro = fbm(u * 2.2, v * 2.0, seed, 4);
      const veinField = fbm(u * 5.5 + macro * 0.4, v * 4.2, seed + 5, 5);
      const veins = Math.abs(veinField - 0.5) * 2;
      const softVein = Math.pow(Math.max(0, 1 - veins * 2.8), 2.4);
      const speck = hash2(x, y, seed + 7);
      const micro = fbm(u * 36, v * 36, seed + 13, 2);

      const c = base.clone().offsetHSL(0.01 * (macro - 0.5), 0.01, (macro - 0.5) * 0.04);
      // soft pale veins — not chalk-white
      c.lerp(new Color(0xb8b4ae), softVein * 0.55);
      c.offsetHSL(0, 0, (speck - 0.5) * 0.015 + (micro - 0.5) * 0.01);

      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;
      height[y * size + x] = softVein * 0.35 + micro * 0.08;
      // polished: low roughness, veins slightly rougher
      const r = 0.18 + softVein * 0.12 + (1 - macro) * 0.06;
      const rv = Math.floor(Math.min(255, r * 255));
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
    normal: normalFromHeight(height, size, 3.5),
  };
}

/** Cream/tan brick backsplash with mortar relief (hero language). */
function bakeBrick(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
  normal: DataTexture;
  ao: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const aoField = new Float32Array(size * size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);

  const rows = 10;
  const cols = 6;
  const mortar = 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const row = Math.floor(v * rows);
      const rowOff = (row % 2) * 0.5;
      const col = Math.floor(u * cols + rowOff);
      const fx = (u * cols + rowOff) - col;
      const fy = v * rows - row;
      const isMortar = fx < mortar || fy < mortar || fx > 1 - mortar * 0.4 || fy > 1 - mortar;

      const cell = hash2(col, row, seed);
      const micro = fbm(u * 28, v * 28, seed + 3, 2);
      // cream / tan / soft terracotta variation
      const hue = 0.07 + cell * 0.035;
      const sat = 0.22 + cell * 0.18;
      const lit = 0.52 + cell * 0.18 + (micro - 0.5) * 0.05;
      const c = isMortar
        ? new Color().setHSL(0.08, 0.08, 0.62 + micro * 0.04)
        : new Color().setHSL(hue, sat, lit);

      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;

      const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
      const cavity = isMortar ? 0.55 : 0.72 + Math.min(1, edge / mortar) * 0.22 + micro * 0.04;
      height[y * size + x] = isMortar ? 0.12 : 0.55 + micro * 0.12;
      aoField[y * size + x] = Math.min(1, cavity);
      const r = isMortar ? 0.88 : 0.62 + micro * 0.1;
      const rv = Math.floor(r * 255);
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
    normal: normalFromHeight(height, size, 9),
    ao: aoFromFloat(aoField, size),
  };
}

function bakeTile(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
  normal: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);
  const tiles = 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const tx = u * tiles;
      const ty = v * tiles;
      const fx = tx - Math.floor(tx);
      const fy = ty - Math.floor(ty);
      const groutW = 0.06;
      const grout = fx < groutW || fy < groutW || fx > 1 - groutW || fy > 1 - groutW;
      const cell = hash2(Math.floor(tx), Math.floor(ty), seed);
      const micro = fbm(u * 30, v * 30, seed + 3, 2);
      const c = new Color().setHSL(0.08, 0.03, 0.72 + cell * 0.06 + micro * 0.03);
      if (grout) c.setHSL(0.08, 0.02, 0.45);

      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;
      height[y * size + x] = grout ? 0.15 : 0.55 + micro * 0.1;
      const r = grout ? 0.85 : 0.25 + micro * 0.1;
      const rv = Math.floor(r * 255);
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
    normal: normalFromHeight(height, size, 8),
  };
}

/** Horizontal brushed steel — soft anisotropic stretch via normals. */
function bakeMetal(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
  normal: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // horizontal grain: high frequency in U, low in V
      const brush = fbm(u * 55, v * 1.8, seed, 3);
      const stretch = fbm(u * 12, v * 0.6, seed + 4, 2);
      const scratch = Math.pow(hash2(Math.floor(x * 0.35), y, seed + 2), 14);
      const g = 0.58 + brush * 0.1 + stretch * 0.04 - scratch * 0.12;
      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(g * 255);
      img.data[i + 1] = Math.floor(g * 1.01 * 255);
      img.data[i + 2] = Math.floor(g * 1.04 * 255);
      img.data[i + 3] = 255;
      // stretch normals horizontally for soft anisotropic highlight
      height[y * size + x] = brush * 0.55 + stretch * 0.25 - scratch * 0.3;
      const r = 0.32 + brush * 0.12 + scratch * 0.18;
      const rv = Math.floor(Math.min(255, r * 255));
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
    normal: normalFromHeight(height, size, 2.8),
  };
}

/** Antique brass / bronze satin for bridge faucet. */
function bakeBrass(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);
  const deep = new Color(0x6b4a22);
  const high = new Color(0xc4a05a);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const brush = fbm(u * 40, v * 3, seed, 3);
      const mott = fbm(u * 6, v * 6, seed + 5, 2);
      const t = brush * 0.55 + mott * 0.45;
      const c = deep.clone().lerp(high, t);
      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;
      const r = 0.38 + (1 - t) * 0.2 + brush * 0.08;
      const rv = Math.floor(Math.min(255, r * 255));
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
  };
}

/** White ceramic farmhouse sink. */
function bakeCeramic(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);
  const base = new Color(0xf5f2ec);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const macro = fbm(u * 2, v * 2, seed, 3);
      const micro = fbm(u * 40, v * 40, seed + 4, 2);
      const c = base.clone().offsetHSL(0.02, 0.02, (macro - 0.5) * 0.03 + (micro - 0.5) * 0.015);
      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;
      const r = 0.28 + micro * 0.08;
      const rv = Math.floor(r * 255);
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
  };
}

function bakeWall(size: number, seed: number): {
  albedo: DataTexture;
  rough: DataTexture;
} {
  const { ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const roughCanvas = makeCanvas(size);
  const roughImg = roughCanvas.ctx.createImageData(size, size);
  const base = new Color(0xf2ebe3);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const macro = fbm(u * 1.5, v * 1.5, seed, 3);
      const micro = fbm(u * 25, v * 25, seed + 4, 2);
      const c = base.clone().offsetHSL(0, 0, (macro - 0.5) * 0.04 + (micro - 0.5) * 0.02);
      const i = (y * size + x) * 4;
      img.data[i] = Math.floor(c.r * 255);
      img.data[i + 1] = Math.floor(c.g * 255);
      img.data[i + 2] = Math.floor(c.b * 255);
      img.data[i + 3] = 255;
      const r = 0.78 + micro * 0.08;
      const rv = Math.floor(r * 255);
      roughImg.data[i] = rv;
      roughImg.data[i + 1] = rv;
      roughImg.data[i + 2] = rv;
      roughImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  roughCanvas.ctx.putImageData(roughImg, 0, 0);
  return {
    albedo: imageDataToTexture(img, true),
    rough: imageDataToTexture(roughImg, false),
  };
}

/**
 * @param size default detail size for secondary maps
 * @param hiRes wood/stone resolution (1024) — boot-critical path stays acceptable
 */
export function bakeMaterialKit(rng: Rng, size = 512, hiRes = 1024): MaterialKit {
  const woodSeed = rng.u32();
  const stoneSeed = rng.u32();
  const brickSeed = rng.u32();
  const tileSeed = rng.u32();
  const metalSeed = rng.u32();
  const brassSeed = rng.u32();
  const ceramicSeed = rng.u32();
  const wallSeed = rng.u32();

  const wood = bakeWood(hiRes, woodSeed, rng.fork('wood'));
  const stone = bakeStone(hiRes, stoneSeed, rng.fork('stone'));
  const brick = bakeBrick(size, brickSeed);
  const tile = bakeTile(size, tileSeed);
  const metal = bakeMetal(size, metalSeed);
  const brass = bakeBrass(Math.min(size, 512), brassSeed);
  const ceramic = bakeCeramic(Math.min(size, 512), ceramicSeed);
  const wall = bakeWall(size, wallSeed);

  wood.albedo.repeat.set(2.2, 2.2);
  wood.rough.repeat.set(2.2, 2.2);
  wood.normal.repeat.set(2.2, 2.2);
  wood.ao.repeat.set(2.2, 2.2);
  wood.ao.channel = 0; // MeshStandard aoMap defaults to uv2; use uv0
  stone.albedo.repeat.set(1.1, 1.1);
  stone.rough.repeat.set(1.1, 1.1);
  stone.normal.repeat.set(1.1, 1.1);
  brick.albedo.repeat.set(3.5, 2.2);
  brick.rough.repeat.set(3.5, 2.2);
  brick.normal.repeat.set(3.5, 2.2);
  brick.ao.repeat.set(3.5, 2.2);
  brick.ao.channel = 0;
  tile.albedo.repeat.set(4, 4);
  tile.rough.repeat.set(4, 4);
  tile.normal.repeat.set(4, 4);
  metal.albedo.repeat.set(1.5, 2.5);
  metal.rough.repeat.set(1.5, 2.5);
  metal.normal.repeat.set(1.5, 2.5);
  wall.albedo.repeat.set(2, 2);

  const textures = [
    wood.albedo,
    wood.rough,
    wood.normal,
    wood.ao,
    stone.albedo,
    stone.rough,
    stone.normal,
    brick.albedo,
    brick.rough,
    brick.normal,
    brick.ao,
    tile.albedo,
    tile.rough,
    tile.normal,
    metal.albedo,
    metal.rough,
    metal.normal,
    brass.albedo,
    brass.rough,
    ceramic.albedo,
    ceramic.rough,
    wall.albedo,
    wall.rough,
  ];

  return {
    woodAlbedo: wood.albedo,
    woodRough: wood.rough,
    woodNormal: wood.normal,
    woodAo: wood.ao,
    stoneAlbedo: stone.albedo,
    stoneRough: stone.rough,
    stoneNormal: stone.normal,
    brickAlbedo: brick.albedo,
    brickRough: brick.rough,
    brickNormal: brick.normal,
    brickAo: brick.ao,
    tileAlbedo: tile.albedo,
    tileRough: tile.rough,
    tileNormal: tile.normal,
    metalAlbedo: metal.albedo,
    metalRough: metal.rough,
    metalNormal: metal.normal,
    brassAlbedo: brass.albedo,
    brassRough: brass.rough,
    ceramicAlbedo: ceramic.albedo,
    ceramicRough: ceramic.rough,
    wallAlbedo: wall.albedo,
    wallRough: wall.rough,
    dispose() {
      for (const t of textures) t.dispose();
    },
  };
}
