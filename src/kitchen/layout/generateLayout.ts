/**
 * Seed-driven kitchen layout: L / U / galley templates.
 * Ports kitchen-designer standards + adjacency rules into auto generation.
 *
 * Empty-wall rule (v1): north wall has NO cabinet run — large glass only.
 */

import type { Rng } from '../../core/Seed';
import { WorldSeed } from '../../core/Seed';
import { pointOnRun, runLength, runYaw, splitIntoUnits } from './cabinetSplit';
import {
  STANDARDS,
  type ApplianceSpec,
  type CabinetRunSpec,
  type ClutterSpec,
  type KitchenLayout,
  type RoomTemplate,
  type Vec2,
  type WallSpec,
} from './types';

const EMPTY_WALL_ID = 'north' as const;

export function generateLayout(seed: WorldSeed): KitchenLayout {
  const rng = seed.rng('layout');
  const template = rng.pick(['L', 'U', 'galley'] as const satisfies readonly RoomTemplate[]);
  // ~3× previous footprint (~4–6 m → ~12–17 m) so the room reads open, not a corridor
  const width = rng.range(12.5, 17.5);
  const depth = template === 'galley' ? rng.range(9.5, 12.0) : rng.range(11.5, 15.5);

  const walls = buildWalls(width, depth);
  const floorPolygon: Vec2[] = [
    { x: 0, z: 0 },
    { x: width, z: 0 },
    { x: width, z: depth },
    { x: 0, z: depth },
  ];

  const cabRng = seed.rng('cabinets');
  const runs = buildRuns(template, width, depth, cabRng);
  const appliances = placeAppliances(runs, width, depth, cabRng);
  const clutter = placeClutter(runs, seed.rng('clutter'));

  const winFrac = rng.range(0.7, 0.85);
  const winW = width * winFrac;
  const winH = rng.range(2.0, 2.2);

  return {
    template,
    width,
    depth,
    walls,
    floorPolygon,
    runs,
    appliances,
    clutter,
    window: {
      wallId: 'wall-north',
      center: { x: width * 0.5, z: 0 },
      width: winW,
      sill: 0.45,
      height: winH,
    },
  };
}

function buildWalls(width: number, depth: number): WallSpec[] {
  const h = STANDARDS.WALL_HEIGHT_ROOM;
  const t = STANDARDS.WALL_THICK;
  return [
    { id: 'wall-south', start: { x: 0, z: depth }, end: { x: width, z: depth }, height: h, thickness: t },
    { id: 'wall-east', start: { x: width, z: depth }, end: { x: width, z: 0 }, height: h, thickness: t },
    {
      id: 'wall-north',
      start: { x: width, z: 0 },
      end: { x: 0, z: 0 },
      height: h,
      thickness: t,
      hasWindow: true,
    },
    { id: 'wall-west', start: { x: 0, z: 0 }, end: { x: 0, z: depth }, height: h, thickness: t },
  ];
}

function makeRun(
  id: string,
  start: Vec2,
  end: Vec2,
  wallAdjacent: boolean,
  isIsland: boolean,
  rng: Rng,
): CabinetRunSpec {
  const units = splitIntoUnits(runLength(start, end), 'base', rng.fork(id));
  return {
    id,
    start,
    end,
    yaw: runYaw(start, end),
    wallAdjacent,
    isIsland,
    units,
    hasBacksplash: wallAdjacent,
    hasWallCabs: wallAdjacent,
    counterOverhang: isIsland ? STANDARDS.ISLAND_EXTENSION * 0.35 : 0.03,
  };
}

/**
 * Cabinet runs — never place a run on the empty (north / glass) wall.
 *   L: east + island
 *   U: east + south (+ island often)
 *   galley: south + west
 */
function buildRuns(template: RoomTemplate, width: number, depth: number, rng: Rng): CabinetRunSpec[] {
  void EMPTY_WALL_ID;
  const inset = STANDARDS.WALL_THICK + STANDARDS.BASE_DEPTH * 0.5;
  const runs: CabinetRunSpec[] = [];

  if (template === 'L' || template === 'U') {
    const eastStart = { x: width - inset, z: inset + STANDARDS.BASE_DEPTH };
    const eastEnd = { x: width - inset, z: depth - inset };
    runs.push(makeRun('run-east', eastStart, eastEnd, true, false, rng));
  }

  if (template === 'U') {
    const southStart = { x: width - inset, z: depth - inset };
    const southEnd = { x: inset + 0.6, z: depth - inset };
    runs.push(makeRun('run-south', southStart, southEnd, true, false, rng));
  }

  if (template === 'galley') {
    const southStart = { x: width - inset, z: depth - inset };
    const southEnd = { x: inset, z: depth - inset };
    runs.push(makeRun('run-galley-south', southStart, southEnd, true, false, rng));

    const westStart = { x: inset, z: inset + STANDARDS.BASE_DEPTH };
    const westEnd = { x: inset, z: depth - inset };
    runs.push(makeRun('run-west', westStart, westEnd, true, false, rng));
  }

  // Island for L and sometimes U — larger peninsula for the bigger room
  if (template === 'L' || (template === 'U' && rng.chance(0.7))) {
    const iw = rng.range(3.2, 5.0);
    const cx = width * 0.45;
    const cz = depth * 0.48;
    const iStart = { x: cx - iw * 0.5, z: cz };
    const iEnd = { x: cx + iw * 0.5, z: cz };
    runs.push(makeRun('run-island', iStart, iEnd, false, true, rng));
  }

  return runs;
}

function placeAppliances(
  runs: CabinetRunSpec[],
  width: number,
  depth: number,
  rng: Rng,
): ApplianceSpec[] {
  const apps: ApplianceSpec[] = [];
  const east = runs.find((r) => r.id === 'run-east');
  const west = runs.find((r) => r.id === 'run-west');
  const south =
    runs.find((r) => r.id === 'run-south') ?? runs.find((r) => r.id === 'run-galley-south');
  const island = runs.find((r) => r.id === 'run-island');
  const wallRuns = runs.filter((r) => r.wallAdjacent);

  // Fridge on west / south / east run end — never gated on a north run
  // Door faces local +Z; yaw rotates that into the room.
  if (west) {
    apps.push({
      id: 'fridge',
      kind: 'fridge',
      position: {
        x: west.start.x,
        y: 0,
        z: west.start.z + 0.35,
      },
      yaw: Math.PI / 2, // face +X (into room from west)
    });
  } else if (east) {
    apps.push({
      id: 'fridge',
      kind: 'fridge',
      position: {
        x: east.start.x,
        y: 0,
        z: east.start.z + 0.35,
      },
      yaw: -Math.PI / 2, // face −X (into room from east)
    });
  } else if (south) {
    const len = runLength(south.start, south.end);
    const p = pointOnRun(south.start, south.end, Math.min(0.55, len * 0.12), 0);
    apps.push({
      id: 'fridge',
      kind: 'fridge',
      position: { x: p.x, y: 0, z: p.z },
      yaw: Math.PI, // face −Z (into room from south)
    });
  } else {
    // Fallback: west wall near north corner (no run there)
    apps.push({
      id: 'fridge',
      kind: 'fridge',
      position: {
        x: STANDARDS.WALL_THICK + 0.4,
        y: 0,
        z: STANDARDS.WALL_THICK + STANDARDS.BASE_DEPTH * 0.5 + 0.05,
      },
      yaw: Math.PI / 2,
    });
  }

  // Sink on a wall run or island (never north)
  const sinkRun =
    wallRuns.sort((a, b) => runLength(b.start, b.end) - runLength(a.start, a.end))[0] ?? island;
  if (sinkRun) {
    const len = runLength(sinkRun.start, sinkRun.end);
    const along = Math.min(len * 0.55, len - 0.45);
    const p = pointOnRun(sinkRun.start, sinkRun.end, along, 0);
    apps.push({
      id: 'sink',
      kind: 'sink',
      position: {
        x: p.x,
        y: STANDARDS.BASE_HEIGHT,
        z: p.z,
      },
      yaw: sinkRun.yaw,
      runId: sinkRun.id,
      along,
    });
  }

  // Range on a different run from the sink when possible
  const sinkId = apps.find((a) => a.kind === 'sink')?.runId;
  const rangeRun =
    runs.find((r) => r.id !== sinkId && r.id === 'run-east') ??
    runs.find((r) => r.id !== sinkId && (r.id === 'run-south' || r.id === 'run-galley-south')) ??
    runs.find((r) => r.id !== sinkId && r.id === 'run-west') ??
    island ??
    wallRuns[0];
  if (rangeRun) {
    const len = runLength(rangeRun.start, rangeRun.end);
    const along = Math.min(Math.max(0.4, len * 0.4), len - 0.4);
    const p = pointOnRun(rangeRun.start, rangeRun.end, along, 0);
    apps.push({
      id: 'range',
      kind: 'range',
      position: {
        x: p.x,
        y: 0,
        z: p.z,
      },
      yaw: rangeRun.yaw + (rangeRun.isIsland ? Math.PI : 0),
      runId: rangeRun.id,
      along,
    });
  }

  void width;
  void depth;
  void rng;
  return apps;
}

function placeClutter(runs: CabinetRunSpec[], rng: Rng): ClutterSpec[] {
  const items: ClutterSpec[] = [];
  let n = 0;
  const kinds = ['bowl', 'board', 'jar', 'plant', 'crock', 'soap', 'pitcher', 'lemons'] as const;

  for (const run of runs) {
    if (run.units.length < 2) continue;
    // Styled density: more clusters on islands + long runs
    const base = run.isIsland ? 4 : 2;
    const clusters = Math.min(6, base + Math.floor(run.units.length / 3) + rng.int(2));
    for (let c = 0; c < clusters; c++) {
      const candidates = run.units.filter((u) => u.kind !== 'filler');
      if (candidates.length === 0) continue;
      const unit = rng.pick(candidates);
      const along = unit.along + unit.width * rng.range(0.25, 0.75);
      const p = pointOnRun(run.start, run.end, along, run.isIsland ? 0 : 0.05);
      // Bias island toward pitcher/board/lemons; perimeter toward crock/soap
      let kind: (typeof kinds)[number];
      if (run.isIsland) {
        kind = rng.pick(['pitcher', 'board', 'lemons', 'bowl', 'plant'] as const);
      } else if (c === 0) {
        kind = rng.pick(['crock', 'soap', 'board', 'jar'] as const);
      } else {
        kind = rng.pick(kinds);
      }
      items.push({
        id: `clutter-${n++}`,
        kind,
        position: {
          x: p.x + rng.range(-0.08, 0.08),
          y: STANDARDS.BASE_HEIGHT + STANDARDS.COUNTER_THICK + 0.01,
          z: p.z + rng.range(-0.06, 0.06),
        },
        yaw: rng.range(0, Math.PI * 2),
        scale: rng.range(0.85, 1.15),
        tint: rng.float(),
      });
    }
  }
  return items;
}
