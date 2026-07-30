/**
 * Procedural cabinets — shaker panels, crown, per-unit variants.
 * No cloned identical modules (LAAS variation law).
 */

import {
  BoxGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from 'three';
import { pointOnRun } from '../layout/cabinetSplit';
import { STANDARDS, type CabinetRunSpec, type CabinetUnitSpec } from '../layout/types';
import type { KitchenMaterials } from '../render/Materials';
import type { ApplianceSpec } from '../layout/types';

const REVEAL = 0.0025; // ~2.5 mm
const STILE = 0.055;
const RAIL = 0.055;
const PANEL_RECESS = 0.006;
const DOOR_THICK = 0.018;

export function buildCabinets(
  runs: CabinetRunSpec[],
  mats: KitchenMaterials,
  sink: ApplianceSpec | undefined,
): Group {
  const root = new Group();
  root.name = 'cabinets';

  for (const run of runs) {
    const runGroup = new Group();
    runGroup.name = run.id;

    for (const unit of run.units) {
      runGroup.add(buildUnit(run, unit, mats));
    }

    runGroup.add(buildCountertop(run, mats, sink));

    if (run.hasBacksplash) {
      runGroup.add(buildBacksplash(run, mats));
    }

    if (run.hasWallCabs) {
      for (const unit of run.units) {
        if (unit.kind === 'filler') continue;
        runGroup.add(buildWallCab(run, unit, mats));
      }
      runGroup.add(buildCrown(run, mats));
      runGroup.add(buildLightRail(run, mats));
    }

    root.add(runGroup);
  }

  return root;
}

function buildUnit(run: CabinetRunSpec, unit: CabinetUnitSpec, mats: KitchenMaterials): Group {
  const g = new Group();
  const p = pointOnRun(run.start, run.end, unit.along + unit.width * 0.5, 0);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = run.yaw;

  const mat = variantMaterial(mats, unit);
  const toe = STANDARDS.TOE_KICK;
  const bodyH = unit.height - toe - STANDARDS.COUNTER_THICK;
  const depth = unit.depth;
  const toeRecess = 0.055;

  // Toe kick — recessed deeper than carcass face
  const toeMesh = new Mesh(
    new BoxGeometry(unit.width * 0.98, toe, depth - toeRecess),
    mats.woodDark,
  );
  toeMesh.position.set(0, toe * 0.5, -toeRecess * 0.5);
  toeMesh.castShadow = true;
  toeMesh.receiveShadow = true;
  g.add(toeMesh);

  // Carcass
  const body = new Mesh(new BoxGeometry(unit.width, bodyH, depth), mat);
  body.position.set(0, toe + bodyH * 0.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const faceZ = depth * 0.5 + REVEAL;
  const doorW = unit.width - REVEAL * 2;

  if (unit.variant % 2 === 0) {
    // Full-height shaker door
    g.add(shakerDoor(doorW, bodyH * 0.92, mat, 0, toe + bodyH * 0.5, faceZ));
  } else {
    // Stacked drawer faces
    const h1 = bodyH * 0.38;
    const h2 = bodyH * 0.38;
    g.add(shakerDoor(doorW, h1, mat, 0, toe + bodyH * 0.72, faceZ));
    g.add(shakerDoor(doorW, h2, mat, 0, toe + bodyH * 0.28, faceZ));
  }

  // Handle — dark antique metal (bin pull vs vertical by variant)
  const handleMat = mats.metal.clone();
  handleMat.color = new Color(0x2a2622);
  handleMat.metalness = 0.35;
  handleMat.roughness = 0.55;
  const isPull = unit.variant >= 2;
  const handle = new Mesh(
    new BoxGeometry(isPull ? 0.12 : 0.018, isPull ? 0.018 : 0.14, 0.028),
    handleMat,
  );
  handle.position.set(
    unit.variant % 2 === 0 ? unit.width * 0.28 : 0,
    toe + bodyH * 0.55,
    faceZ + 0.02,
  );
  handle.castShadow = true;
  g.add(handle);

  return g;
}

/** Raised/shaker panel: stiles + rails + recessed center. */
function shakerDoor(
  w: number,
  h: number,
  mat: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
): Group {
  const g = new Group();
  g.position.set(x, y, z);

  const stileW = Math.min(STILE, w * 0.22);
  const railH = Math.min(RAIL, h * 0.22);
  const panelW = Math.max(0.02, w - stileW * 2);
  const panelH = Math.max(0.02, h - railH * 2);

  // Outer slab (thin) so edges read
  const outer = new Mesh(new BoxGeometry(w, h, DOOR_THICK * 0.55), mat);
  outer.castShadow = true;
  g.add(outer);

  // Left / right stiles
  const left = new Mesh(new BoxGeometry(stileW, h, DOOR_THICK), mat);
  left.position.set(-w * 0.5 + stileW * 0.5, 0, DOOR_THICK * 0.2);
  left.castShadow = true;
  g.add(left);
  const right = left.clone();
  right.position.x = w * 0.5 - stileW * 0.5;
  g.add(right);

  // Top / bottom rails
  const top = new Mesh(new BoxGeometry(panelW, railH, DOOR_THICK), mat);
  top.position.set(0, h * 0.5 - railH * 0.5, DOOR_THICK * 0.2);
  top.castShadow = true;
  g.add(top);
  const bot = top.clone();
  bot.position.y = -h * 0.5 + railH * 0.5;
  g.add(bot);

  // Recessed center panel
  const panel = new Mesh(
    new BoxGeometry(panelW * 0.98, panelH * 0.98, DOOR_THICK * 0.45),
    mat,
  );
  panel.position.set(0, 0, -PANEL_RECESS);
  panel.castShadow = true;
  panel.receiveShadow = true;
  g.add(panel);

  return g;
}

function variantMaterial(mats: KitchenMaterials, unit: CabinetUnitSpec): MeshStandardMaterial {
  const base = unit.kind === 'filler' ? mats.woodDark : mats.wood;
  const m = base.clone();
  const c = (base.color?.clone() ?? new Color(0xffffff)).offsetHSL(unit.hueShift, 0, -unit.wear * 0.08);
  m.color = c;
  m.roughness = Math.min(1, (base.roughness ?? 0.65) + unit.wear * 0.12);
  // Per-unit UV jitter so doors don't clone
  const ox = unit.hueShift * 2.5 + unit.wear * 0.4;
  const oy = unit.wear * 1.7;
  if (m.map) {
    m.map = m.map.clone();
    m.map.offset.set(ox, oy);
  }
  if (m.roughnessMap) {
    m.roughnessMap = m.roughnessMap.clone();
    m.roughnessMap.offset.set(ox, oy);
  }
  if (m.normalMap) {
    m.normalMap = m.normalMap.clone();
    m.normalMap.offset.set(ox, oy);
  }
  if (m.aoMap) {
    m.aoMap = m.aoMap.clone();
    m.aoMap.offset.set(ox, oy);
  }
  return m;
}

function buildCountertop(
  run: CabinetRunSpec,
  mats: KitchenMaterials,
  sink: ApplianceSpec | undefined,
): Mesh {
  const len = Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z);
  const depth = STANDARDS.BASE_DEPTH + run.counterOverhang * (run.isIsland ? 2 : 1);

  const shape = new Shape();
  shape.moveTo(-len * 0.5, -depth * 0.5);
  shape.lineTo(len * 0.5, -depth * 0.5);
  shape.lineTo(len * 0.5, depth * 0.5);
  shape.lineTo(-len * 0.5, depth * 0.5);
  shape.closePath();

  // Rectangular farmhouse cutout when sink belongs to this run
  if (sink?.runId === run.id && sink.along !== undefined) {
    const localX = sink.along - len * 0.5;
    const hx = 0.34;
    const hz = 0.22;
    const hole = new Shape();
    hole.moveTo(localX - hx, -hz);
    hole.lineTo(localX + hx, -hz);
    hole.lineTo(localX + hx, hz);
    hole.lineTo(localX - hx, hz);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geo = new ExtrudeGeometry(shape, {
    depth: STANDARDS.COUNTER_THICK,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);

  const mat =
    sink?.runId === run.id
      ? (() => {
          const m = mats.stone.clone();
          m.color = mats.stone.color.clone().offsetHSL(0, 0.02, -0.02);
          return m;
        })()
      : mats.stone;

  const mesh = new Mesh(geo, mat);
  const mid = pointOnRun(run.start, run.end, len * 0.5, 0);
  mesh.position.set(mid.x, STANDARDS.BASE_HEIGHT - STANDARDS.COUNTER_THICK, mid.z);
  mesh.rotation.y = run.yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `${run.id}-counter`;
  return mesh;
}

function buildBacksplash(run: CabinetRunSpec, mats: KitchenMaterials): Mesh {
  const len = Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z);
  const mesh = new Mesh(
    new BoxGeometry(len, STANDARDS.BACKSPLASH_HEIGHT, STANDARDS.BACKSPLASH_THICK),
    mats.brick,
  );
  const mid = pointOnRun(run.start, run.end, len * 0.5, -STANDARDS.BASE_DEPTH * 0.5 + 0.02);
  mesh.position.set(
    mid.x,
    STANDARDS.BASE_HEIGHT + STANDARDS.BACKSPLASH_HEIGHT * 0.5,
    mid.z,
  );
  mesh.rotation.y = run.yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildWallCab(run: CabinetRunSpec, unit: CabinetUnitSpec, mats: KitchenMaterials): Group {
  const g = new Group();
  const p = pointOnRun(run.start, run.end, unit.along + unit.width * 0.5, -0.05);
  g.position.set(p.x, STANDARDS.WALL_CAB_START, p.z);
  g.rotation.y = run.yaw;

  const mat = variantMaterial(mats, { ...unit, kind: 'wall' });
  const body = new Mesh(
    new BoxGeometry(unit.width * 0.98, STANDARDS.WALL_HEIGHT, STANDARDS.WALL_DEPTH),
    mat,
  );
  body.position.set(0, STANDARDS.WALL_HEIGHT * 0.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const doorW = unit.width * 0.92;
  const doorH = STANDARDS.WALL_HEIGHT * 0.9;
  g.add(
    shakerDoor(
      doorW,
      doorH,
      mat,
      0,
      STANDARDS.WALL_HEIGHT * 0.5,
      STANDARDS.WALL_DEPTH * 0.5 + REVEAL,
    ),
  );

  return g;
}

/** Simple crown molding strip along wall-cab tops. */
function buildCrown(run: CabinetRunSpec, mats: KitchenMaterials): Mesh {
  const len = Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z);
  const mesh = new Mesh(new BoxGeometry(len, 0.055, 0.08), mats.wood);
  const mid = pointOnRun(run.start, run.end, len * 0.5, -0.02);
  mesh.position.set(
    mid.x,
    STANDARDS.WALL_CAB_START + STANDARDS.WALL_HEIGHT + 0.02,
    mid.z,
  );
  mesh.rotation.y = run.yaw;
  mesh.castShadow = true;
  return mesh;
}

/** Light rail under wall cabs (hides under-cab practicals). */
function buildLightRail(run: CabinetRunSpec, mats: KitchenMaterials): Mesh {
  const len = Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z);
  const mesh = new Mesh(new BoxGeometry(len * 0.98, 0.03, 0.04), mats.woodDark);
  const mid = pointOnRun(run.start, run.end, len * 0.5, STANDARDS.WALL_DEPTH * 0.15);
  mesh.position.set(mid.x, STANDARDS.WALL_CAB_START - 0.02, mid.z);
  mesh.rotation.y = run.yaw;
  mesh.castShadow = true;
  return mesh;
}
