/** Real-world kitchen standards in meters (ported from kitchen-designer feet). */

export const STANDARDS = {
  BASE_WIDTH: 0.762, // 30"
  FILLER_WIDTH: 0.0762, // 3"
  BASE_DEPTH: 0.61, // 24"
  WALL_DEPTH: 0.305, // 12"
  WALL_CAB_START: 1.372, // 54"
  ISLAND_EXTENSION: 0.381, // 15"
  BASE_HEIGHT: 0.876, // 34.5"
  WALL_HEIGHT: 0.762, // 30"
  COUNTER_THICK: 0.038, // 1.5"
  BACKSPLASH_HEIGHT: 0.457, // 18"
  BACKSPLASH_THICK: 0.015,
  WALL_THICK: 0.12,
  WALL_HEIGHT_ROOM: 2.7,
  TOE_KICK: 0.1,
} as const;

export type RoomTemplate = 'L' | 'U' | 'galley';

export interface Vec2 {
  x: number;
  z: number;
}

export interface WallSpec {
  id: string;
  start: Vec2;
  end: Vec2;
  height: number;
  thickness: number;
  hasWindow?: boolean;
}

export type UnitKind = 'base' | 'wall' | 'filler';

export interface CabinetUnitSpec {
  id: string;
  kind: UnitKind;
  width: number;
  height: number;
  depth: number;
  /** offset along run from segment start */
  along: number;
  variant: number;
  hueShift: number;
  wear: number;
}

export interface CabinetRunSpec {
  id: string;
  start: Vec2;
  end: Vec2;
  yaw: number;
  wallAdjacent: boolean;
  isIsland: boolean;
  units: CabinetUnitSpec[];
  hasBacksplash: boolean;
  hasWallCabs: boolean;
  counterOverhang: number;
}

export type ApplianceKind = 'sink' | 'range' | 'fridge';

export interface ApplianceSpec {
  id: string;
  kind: ApplianceKind;
  position: { x: number; y: number; z: number };
  yaw: number;
  /** run id for sink/range on counter */
  runId?: string;
  along?: number;
}

export interface ClutterSpec {
  id: string;
  kind: 'bowl' | 'board' | 'jar' | 'plant' | 'crock' | 'soap' | 'pitcher' | 'lemons';
  position: { x: number; y: number; z: number };
  yaw: number;
  scale: number;
  tint: number;
}

export interface KitchenLayout {
  template: RoomTemplate;
  width: number;
  depth: number;
  walls: WallSpec[];
  floorPolygon: Vec2[];
  runs: CabinetRunSpec[];
  appliances: ApplianceSpec[];
  clutter: ClutterSpec[];
  window: { wallId: string; center: Vec2; width: number; sill: number; height: number };
}
