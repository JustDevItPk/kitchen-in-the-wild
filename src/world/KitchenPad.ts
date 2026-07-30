/**
 * Flat cleared pad under the procedural kitchen.
 * Flattens heightfield texels in an AABB to constant Y, then refreshes
 * derived maps + biome so scatter / walk probes see the pad.
 */

import type { Renderer } from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  float,
  instanceIndex,
} from 'three/tsl';
import type { NF, NV2 } from '../gpu/TSLTypes';
import { runBiomeSnow } from '../gpu/passes/BiomeSnow';
import type { Heightfield } from './Heightfield';
import { WORLD_SIZE } from './WorldConst';

export interface KitchenPad {
  /** inclusive world AABB (meters) */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** kitchen floor world Y (m) */
  y: number;
  /** heightfield flatten Y — slightly below floor so mesh never z-fights */
  terrainY: number;
  /** kitchen footprint used to size the pad */
  kitchenWidth: number;
  kitchenDepth: number;
}

/** How far below the kitchen floor the heightfield is buried (m). */
const TERRAIN_SINK = 0.18;
/** Extra clearance under the kitchen mesh (m). */
const FLOOR_LIFT = 0.04;

/** Active pad for scatter / grass / displacement gates (null = no exclude). */
let activePad: KitchenPad | null = null;

export function getKitchenPad(): KitchenPad | null {
  return activePad;
}

export function setKitchenPad(pad: KitchenPad | null): void {
  activePad = pad;
}

/** True when world xz is inside the active pad AABB (CPU). */
export function inKitchenPad(x: number, z: number, pad: KitchenPad | null = activePad): boolean {
  if (!pad) return false;
  return x >= pad.minX && x <= pad.maxX && z >= pad.minZ && z <= pad.maxZ;
}

/**
 * TSL gate: 0 inside pad (kill micro-displacement / bumps), 1 outside.
 * Soft 1.5 m apron so the seam doesn't cliff.
 */
export function padReliefGate(wpos: NV2): NF {
  const pad = getKitchenPad();
  if (!pad) return float(1);
  // signed distance outside AABB (0 inside, positive outside)
  const dx = wpos.x.sub(float((pad.minX + pad.maxX) * 0.5)).abs().sub(float((pad.maxX - pad.minX) * 0.5));
  const dz = wpos.y.sub(float((pad.minZ + pad.maxZ) * 0.5)).abs().sub(float((pad.maxZ - pad.minZ) * 0.5));
  const outside = dx.max(float(0)).max(dz.max(float(0)));
  return outside.div(1.5).min(1);
}

/**
 * Place a pad centered near world origin.
 * Kitchen local origin is SW corner (0,0); glass faces −Z (north).
 */
export function makeKitchenPad(
  kitchenWidth: number,
  kitchenDepth: number,
  margin = 3,
  centerX = 0,
  centerZ = 0,
): Omit<KitchenPad, 'y' | 'terrainY'> {
  const halfW = kitchenWidth * 0.5 + margin;
  const halfD = kitchenDepth * 0.5 + margin;
  return {
    minX: centerX - halfW,
    maxX: centerX + halfW,
    minZ: centerZ - halfD,
    maxZ: centerZ + halfD,
    kitchenWidth,
    kitchenDepth,
  };
}

/**
 * Flatten height texels inside the pad AABB to a constant buried Y,
 * rebuild normals/height tex, reclassify biome, refresh CPU readback.
 */
export async function flattenKitchenPad(
  renderer: Renderer,
  hf: Heightfield,
  padIn: Omit<KitchenPad, 'y' | 'terrainY'>,
): Promise<KitchenPad> {
  const cx = (padIn.minX + padIn.maxX) * 0.5;
  const cz = (padIn.minZ + padIn.maxZ) * 0.5;
  // Sample several points and take the MAX so the floor clears any residual
  // high spots before we force the pad flat.
  const samples = [
    hf.heightAtCpu(cx, cz),
    hf.heightAtCpu(padIn.minX + 1, padIn.minZ + 1),
    hf.heightAtCpu(padIn.maxX - 1, padIn.minZ + 1),
    hf.heightAtCpu(padIn.minX + 1, padIn.maxZ - 1),
    hf.heightAtCpu(padIn.maxX - 1, padIn.maxZ - 1),
  ];
  const surfaceY = Math.max(...samples);
  const terrainY = surfaceY - TERRAIN_SINK;
  const pad: KitchenPad = {
    ...padIn,
    y: surfaceY + FLOOR_LIFT,
    terrainY,
  };

  const res = hf.res;
  const minX = float(pad.minX);
  const maxX = float(pad.maxX);
  const minZ = float(pad.minZ);
  const maxZ = float(pad.maxZ);
  const yFlat = float(terrainY);
  const worldSize = float(WORLD_SIZE);

  const kernel = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(res * res), () => {
      Return();
    });
    const ix = i.mod(res);
    const iz = i.div(res);
    // texel centers → world xz (same mapping as Heightfield.uvFromWorld inverse)
    const wx = float(ix).add(0.5).div(res).sub(0.5).mul(worldSize);
    const wz = float(iz).add(0.5).div(res).sub(0.5).mul(worldSize);
    const inside = wx
      .greaterThanEqual(minX)
      .and(wx.lessThanEqual(maxX))
      .and(wz.greaterThanEqual(minZ))
      .and(wz.lessThanEqual(maxZ));
    If(inside, () => {
      hf.height.element(i).assign(yFlat);
    });
  })().compute(res * res);
  kernel.setName('kitchenPadFlatten');
  await renderer.computeAsync(kernel);

  await hf.rebuildDerivedMaps(renderer);

  // Biome reclassify so veg density / rock exposure match the flat pad
  if (hf.fieldsTex && hf.biomeTex) {
    hf.biomeTex = await runBiomeSnow(renderer, hf.height, {
      res: hf.res,
      mp: hf.mp,
      normalTex: hf.normalTex,
      fieldsTex: hf.fieldsTex,
    });
  }

  const ab = await renderer.getArrayBufferAsync(hf.height.value);
  hf.cpuHeights = new Float32Array(ab);

  setKitchenPad(pad);
  return pad;
}

/**
 * World transform for a kitchen whose local origin is the SW corner (x=0,z=0),
 * north glass at z=0. Centers the footprint on the pad with glass facing −Z.
 */
export function kitchenWorldTransform(pad: KitchenPad): {
  x: number;
  y: number;
  z: number;
} {
  const marginX = (pad.maxX - pad.minX - pad.kitchenWidth) * 0.5;
  const marginZ = (pad.maxZ - pad.minZ - pad.kitchenDepth) * 0.5;
  return {
    x: pad.minX + marginX,
    y: pad.y,
    z: pad.minZ + marginZ,
  };
}
