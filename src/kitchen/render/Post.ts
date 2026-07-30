/**
 * Lightweight post / contact-shadow helpers.
 * Full GTAO compute is LAAS-scale; here we approximate with:
 * - ACES tone mapping (engine)
 * - Optional soft ground contact via darkening hemisphere already in lighting
 * - SSAO-like feel via MeshStandard ambient occlusion on materials when available
 *
 * Ablation: ?ablate=bloom,ao,contact
 */

import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Group,
  Color,
} from 'three';
import type { KitchenParams } from '../params';
import { ablated } from '../params';
import type { KitchenLayout } from '../layout/types';

/** Soft contact shadow discs under heavy props (cheap stand-in for SS contact). */
export function buildContactShadows(
  layout: KitchenLayout,
  params: KitchenParams,
): Group | null {
  if (ablated(params, 'contact') || ablated(params, 'ao')) return null;

  const group = new Group();
  group.name = 'contact-shadows';
  const mat = new MeshBasicMaterial({
    color: new Color(0x1a120c),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  const addDisc = (x: number, z: number, rx: number, rz: number): void => {
    const m = new Mesh(new PlaneGeometry(rx * 2, rz * 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, z);
    m.renderOrder = 1;
    group.add(m);
  };

  for (const app of layout.appliances) {
    if (app.kind === 'fridge') addDisc(app.position.x, app.position.z, 0.4, 0.4);
    if (app.kind === 'range') addDisc(app.position.x, app.position.z, 0.42, 0.36);
  }

  // Island / run toe soft grounding along midpoints
  for (const run of layout.runs) {
    const mx = (run.start.x + run.end.x) * 0.5;
    const mz = (run.start.z + run.end.z) * 0.5;
    const len = Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z);
    addDisc(mx, mz, Math.max(0.3, len * 0.45), 0.35);
  }

  return group;
}

/** Exposure nudge from time of day — mild “grade”. */
export function exposureForTime(timeOfDay: number): number {
  if (timeOfDay < 7 || timeOfDay > 19) return 0.75;
  if (timeOfDay < 9) return 0.95;
  if (timeOfDay > 16) return 0.9;
  return 1.05;
}
