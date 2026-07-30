/**
 * Cabinet run splitting — ported from kitchen-designer cabinetEngine.
 * Greedy pack of standard widths + filler remainder.
 */

import type { Rng } from '../../core/Seed';
import { STANDARDS, type CabinetUnitSpec, type UnitKind } from './types';

const STANDARD_WIDTHS = [
  STANDARDS.BASE_WIDTH,
  STANDARDS.BASE_WIDTH * 0.75,
  STANDARDS.BASE_WIDTH * 0.5,
  STANDARDS.BASE_WIDTH * 0.25,
];

export function runLength(start: { x: number; z: number }, end: { x: number; z: number }): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.hypot(dx, dz);
}

export function runYaw(start: { x: number; z: number }, end: { x: number; z: number }): number {
  return Math.atan2(-(end.z - start.z), end.x - start.x);
}

/** Split a run length into base/wall units + optional end filler. */
export function splitIntoUnits(
  length: number,
  kind: 'base' | 'wall',
  rng: Rng,
): CabinetUnitSpec[] {
  const units: CabinetUnitSpec[] = [];
  let remaining = length;
  let along = 0;
  let idx = 0;

  const widths = [...STANDARD_WIDTHS].sort((a, b) => b - a);

  while (remaining > STANDARDS.FILLER_WIDTH + 1e-4) {
    let placed = false;
    for (const w of widths) {
      if (w <= remaining + 1e-4 && (remaining - w < STANDARDS.FILLER_WIDTH || remaining - w >= STANDARDS.FILLER_WIDTH || w === remaining)) {
        if (remaining - w > 0 && remaining - w < STANDARDS.FILLER_WIDTH && w !== remaining) {
          continue;
        }
        pushUnit(units, kind, w, along, rng, idx++);
        along += w;
        remaining -= w;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // take largest that fits
      const fit = widths.find((w) => w <= remaining);
      if (!fit) break;
      pushUnit(units, kind, fit, along, rng, idx++);
      along += fit;
      remaining -= fit;
    }
    if (idx > 40) break;
  }

  if (remaining >= STANDARDS.FILLER_WIDTH * 0.5) {
    units.push({
      id: `filler-${idx}`,
      kind: 'filler',
      width: remaining,
      height: kind === 'base' ? STANDARDS.BASE_HEIGHT : STANDARDS.WALL_HEIGHT,
      depth: kind === 'base' ? STANDARDS.BASE_DEPTH : STANDARDS.WALL_DEPTH,
      along,
      variant: rng.int(4),
      hueShift: rng.range(-0.02, 0.02),
      wear: rng.range(0, 0.35),
    });
  }

  return units;
}

function pushUnit(
  units: CabinetUnitSpec[],
  kind: UnitKind,
  width: number,
  along: number,
  rng: Rng,
  idx: number,
): void {
  units.push({
    id: `${kind}-${idx}`,
    kind,
    width,
    height: kind === 'base' ? STANDARDS.BASE_HEIGHT : STANDARDS.WALL_HEIGHT,
    depth: kind === 'base' ? STANDARDS.BASE_DEPTH : STANDARDS.WALL_DEPTH,
    along,
    variant: rng.int(4),
    hueShift: rng.range(-0.04, 0.04),
    wear: rng.range(0.05, 0.55),
  });
}

/** Point along a run at distance `along`, offset inward by `inset`. */
export function pointOnRun(
  start: { x: number; z: number },
  end: { x: number; z: number },
  along: number,
  inset: number,
): { x: number; z: number; yaw: number } {
  const len = runLength(start, end);
  const t = len > 1e-6 ? along / len : 0;
  const x = start.x + (end.x - start.x) * t;
  const z = start.z + (end.z - start.z) * t;
  const yaw = runYaw(start, end);
  // inward normal (left of direction in XZ)
  const dx = (end.x - start.x) / (len || 1);
  const dz = (end.z - start.z) / (len || 1);
  const nx = -dz;
  const nz = dx;
  return { x: x + nx * inset, z: z + nz * inset, yaw };
}
