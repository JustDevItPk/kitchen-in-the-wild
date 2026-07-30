/**
 * World constants — the single place defining world dimensions, grid sizes,
 * vertical scale, and biome identifiers. The macro layout (where the massif,
 * valley, karst zone, and lake live) is in MacroMap.ts.
 *
 * Kitchen-pad demo uses a ~512 m near world; far-shell mountains still extend
 * to FAR_RADIUS so the glass vista reads as LAAS outdoors.
 */

/** world edge length in meters; world spans [-WORLD_HALF, +WORLD_HALF]² */
export const WORLD_SIZE = 512;
export const WORLD_HALF = WORLD_SIZE / 2;

/** final composed heightfield resolution (~1 m/texel at 512) */
export const HEIGHT_RES = 512;
/** erosion / hydrology simulation grid (~2 m/texel) */
export const SIM_RES = 256;

/** vertical range: heights are meters above sea/datum 0 */
export const LAKE_LEVEL = 142;
export const VALLEY_FLOOR = 165;
export const KARST_PLATEAU = 380;
export const TREELINE = 950;
export const SNOWLINE_BASE = 1050;
export const SUMMIT_MAX = 1620;

/** far-shell vista ring: analytic terrain from WORLD_HALF out to FAR_RADIUS */
export const FAR_RADIUS = 14000;

/** biome ids (stored quantized in classification texture r-channel) */
export const enum Biome {
  Alpine = 0, // rock, scree, snow above treeline
  Subalpine = 1, // krummholz, sparse stunted conifers, heath
  Conifer = 2, // montane spruce/pine forest
  KarstForest = 3, // broadleaf forest among karst towers & ravines (refs 1–3)
  Meadow = 4, // grassland with flowers
  Wetland = 5, // lake margins, sedges, moisture-lovers
  COUNT = 6,
}

export const BIOME_NAMES: readonly string[] = [
  'alpine',
  'subalpine',
  'conifer',
  'karst-forest',
  'meadow',
  'wetland',
];

/** quality presets — smaller grids, never fewer systems */
export interface QualityConfig {
  heightRes: number;
  simRes: number;
  erosionIters: number;
  tileVerts: number; // vertices per tile edge
}

export function qualityConfig(preset: 'low' | 'high' | 'ultra'): QualityConfig {
  switch (preset) {
    case 'low':
      return { heightRes: 256, simRes: 128, erosionIters: 400, tileVerts: 49 };
    case 'ultra':
      return { heightRes: 512, simRes: 256, erosionIters: 700, tileVerts: 81 };
    case 'high':
      return { heightRes: HEIGHT_RES, simRes: SIM_RES, erosionIters: 520, tileVerts: 65 };
  }
}
