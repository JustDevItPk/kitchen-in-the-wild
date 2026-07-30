/** Assemble procedural kitchen group for mounting into the LAAS outdoor scene. */

import { Group } from 'three';
import type { WorldSeed } from '../core/Seed';
import { buildAppliances } from './geo/Appliances';
import { buildCabinets } from './geo/Cabinets';
import { buildClutter } from './geo/Clutter';
import { buildRoom } from './geo/Room';
import { bakeMaterialKit } from './gpu/MaterialBake';
import { generateLayout } from './layout/generateLayout';
import type { KitchenLayout } from './layout/types';
import type { KitchenParams } from './params';
import { createMaterials } from './render/Materials';
import { buildLighting } from './render/Lighting';
import { buildContactShadows } from './render/Post';
import { buildSinkWater, type WaterSystem } from './render/Water';

export interface KitchenMount {
  root: Group;
  layout: KitchenLayout;
  water: WaterSystem | null;
  dispose(): void;
}

/** Generate layout only (pad sizing before terrain scatter). */
export function layoutKitchen(seed: WorldSeed): KitchenLayout {
  return generateLayout(seed);
}

/**
 * Build kitchen meshes. Does NOT own scene background/fog/environment —
 * LAAS outdoor systems remain authoritative.
 */
export function buildKitchenMount(
  seed: WorldSeed,
  params: KitchenParams,
  layout?: KitchenLayout,
): KitchenMount {
  const lay = layout ?? generateLayout(seed);
  // Wood/stone @ 1024; secondary maps @ 512 (boot stays acceptable)
  const kit = bakeMaterialKit(seed.rng('materials'), 512, 1024);
  const mats = createMaterials(kit);

  const root = new Group();
  root.name = 'kitchen';
  root.add(buildRoom(lay, mats));

  const sink = lay.appliances.find((a) => a.kind === 'sink');
  root.add(buildCabinets(lay.runs, mats, sink));
  root.add(buildAppliances(lay, mats));
  root.add(buildClutter(lay.clutter, mats));

  const { group: lights } = buildLighting(lay, params);
  root.add(lights);

  const contacts = buildContactShadows(lay, params);
  if (contacts) root.add(contacts);

  const water = sink ? buildSinkWater(sink, params) : null;
  if (water) root.add(water.group);

  const tileRepeat = Math.max(8, Math.round(Math.max(lay.width, lay.depth) * 0.7));
  kit.tileAlbedo.repeat.set(tileRepeat, tileRepeat);
  kit.tileRough.repeat.set(tileRepeat, tileRepeat);
  kit.tileNormal.repeat.set(tileRepeat, tileRepeat);

  return {
    root,
    layout: lay,
    water,
    dispose() {
      mats.dispose();
      kit.dispose();
    },
  };
}
