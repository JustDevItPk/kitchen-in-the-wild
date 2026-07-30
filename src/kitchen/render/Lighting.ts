/**
 * Indoor lighting — cool window key + warm under-cab practicals.
 * No crushed blacks (LAAS Pillar B adapted to interiors).
 *
 * Note: RectAreaLight + RectAreaLightUniformsLib is a WebGL path and can
 * leave MeshStandardMaterial fully black under WebGPURenderer — avoid it.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PointLight,
} from 'three';
import type { KitchenParams } from '../params';
import { ablated } from '../params';
import type { KitchenLayout } from '../layout/types';
import { STANDARDS } from '../layout/types';

export function buildLighting(
  layout: KitchenLayout,
  params: KitchenParams,
): { group: Group; sun: DirectionalLight } {
  const group = new Group();
  group.name = 'lights';

  const t = params.timeOfDay;
  const sunWarmth = t < 9 ? 0.85 : t > 16 ? 0.55 : 1.0;
  // Cool late-morning window key (hero)
  const sunColor = new Color().setHSL(0.58, 0.22 * sunWarmth, 0.68);
  const skyTint = new Color(0xb8d0ec);
  const groundTint = new Color(0xd8c4a4);

  const giScale = ablated(params, 'gi') ? 0.25 : 1;

  // Cool-biased fill — warm comes from practicals, not ambient soup
  const hemi = new HemisphereLight(skyTint, groundTint, 0.78 * giScale);
  group.add(hemi);

  const ambient = new AmbientLight(new Color(0xfff0e6), 0.42 * giScale);
  group.add(ambient);

  // Window key light (positioned outside the north wall, aiming into the room)
  const sun = new DirectionalLight(sunColor, 3.1 * sunWarmth);
  sun.position.set(layout.window.center.x, 3.2, -2.5);
  sun.target.position.set(layout.width * 0.5, 0.9, layout.depth * 0.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.04;
  group.add(sun);
  group.add(sun.target);

  // Soft cool window fill point (replaces RectAreaLight for WebGPU)
  const windowFill = new PointLight(sunColor, 6.2 * sunWarmth, 16, 1.35);
  windowFill.position.set(
    layout.window.center.x,
    layout.window.sill + layout.window.height * 0.5,
    0.35,
  );
  group.add(windowFill);

  // Warm under-cabinet practicals — contrast against cool window
  for (const run of layout.runs) {
    if (!run.hasWallCabs) continue;
    const midX = (run.start.x + run.end.x) * 0.5;
    const midZ = (run.start.z + run.end.z) * 0.5;
    const practical = new PointLight(0xffd4a0, 2.6, 4.2, 2.0);
    practical.position.set(midX, STANDARDS.WALL_CAB_START - 0.05, midZ);
    group.add(practical);
  }

  const ceiling = new PointLight(0xfff5ea, 1.25, 28, 1.2);
  ceiling.position.set(layout.width * 0.5, STANDARDS.WALL_HEIGHT_ROOM - 0.2, layout.depth * 0.5);
  group.add(ceiling);

  // Extra mid-room fill so the larger footprint doesn't fall off into dark corners
  const midFill = new PointLight(0xffefe0, 0.55, 18, 1.3);
  midFill.position.set(layout.width * 0.4, 2.2, layout.depth * 0.45);
  group.add(midFill);

  return { group, sun };
}
