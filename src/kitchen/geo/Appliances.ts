/** Procedural appliances — French fridge, range, farmhouse sink + bridge faucet. */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector2,
} from 'three';
import { STANDARDS, type ApplianceSpec, type KitchenLayout } from '../layout/types';
import type { KitchenMaterials } from '../render/Materials';

export function buildAppliances(layout: KitchenLayout, mats: KitchenMaterials): Group {
  const root = new Group();
  root.name = 'appliances';

  for (const app of layout.appliances) {
    if (app.kind === 'fridge') root.add(buildFridge(app, mats));
    if (app.kind === 'range') root.add(buildRange(app, mats));
    if (app.kind === 'sink') root.add(buildSink(app, mats));
  }

  return root;
}

/** French doors + two freezer drawers + dispenser niche. */
function buildFridge(app: ApplianceSpec, mats: KitchenMaterials): Group {
  const g = new Group();
  g.position.set(app.position.x, 0, app.position.z);
  g.rotation.y = app.yaw;

  const W = 0.9;
  const D = 0.72;
  const H = 1.78;
  const gap = 0.003;

  const body = new Mesh(new BoxGeometry(W, H, D), mats.metal);
  body.position.y = H * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Soft internal darkening for cavity/reveals
  const cavityMat = mats.metal.clone();
  cavityMat.color = new Color(0x3a3e42);
  cavityMat.metalness = 0.15;
  cavityMat.roughness = 0.55;

  const upperH = 1.05;
  const drawerH = 0.32;
  const doorZ = D * 0.5 + gap;
  const doorW = (W - gap * 3) * 0.5;

  // Left French door
  const leftDoor = new Mesh(new BoxGeometry(doorW, upperH, 0.04), mats.metal);
  leftDoor.position.set(-doorW * 0.5 - gap * 0.5, H - upperH * 0.5 - 0.04, doorZ);
  leftDoor.castShadow = true;
  g.add(leftDoor);

  // Right French door
  const rightDoor = new Mesh(new BoxGeometry(doorW, upperH, 0.04), mats.metal);
  rightDoor.position.set(doorW * 0.5 + gap * 0.5, H - upperH * 0.5 - 0.04, doorZ);
  rightDoor.castShadow = true;
  g.add(rightDoor);

  // Vertical handles at center meet
  const handleL = new Mesh(new BoxGeometry(0.018, 0.55, 0.035), mats.metal);
  handleL.position.set(-0.03, H - upperH * 0.5 - 0.04, doorZ + 0.035);
  g.add(handleL);
  const handleR = handleL.clone();
  handleR.position.x = 0.03;
  g.add(handleR);

  // Dispenser niche (left door) — geo recess + cavity darkening
  const niche = new Mesh(new BoxGeometry(0.22, 0.28, 0.05), cavityMat);
  niche.position.set(-doorW * 0.35, H - 0.45, doorZ + 0.01);
  g.add(niche);
  const nicheLip = new Mesh(new BoxGeometry(0.24, 0.3, 0.012), mats.metal);
  nicheLip.position.set(-doorW * 0.35, H - 0.45, doorZ + 0.028);
  g.add(nicheLip);

  // Control strip beside dispenser
  const panel = new Mesh(new BoxGeometry(0.06, 0.22, 0.01), cavityMat);
  panel.position.set(-doorW * 0.08, H - 0.45, doorZ + 0.03);
  g.add(panel);

  // Two freezer drawers
  for (let i = 0; i < 2; i++) {
    const y = 0.08 + drawerH * 0.5 + i * (drawerH + gap);
    const drawer = new Mesh(new BoxGeometry(W - gap * 2, drawerH, 0.04), mats.metal);
    drawer.position.set(0, y, doorZ);
    drawer.castShadow = true;
    g.add(drawer);
    const pull = new Mesh(new BoxGeometry(0.42, 0.02, 0.03), mats.metal);
    pull.position.set(0, y + drawerH * 0.28, doorZ + 0.03);
    g.add(pull);
  }

  // Top reveal strip
  const topCap = new Mesh(new BoxGeometry(W - 0.01, 0.025, 0.02), cavityMat);
  topCap.position.set(0, H - 0.01, doorZ);
  g.add(topCap);

  return g;
}

function buildRange(app: ApplianceSpec, mats: KitchenMaterials): Group {
  const g = new Group();
  g.position.set(app.position.x, 0, app.position.z);
  g.rotation.y = app.yaw;

  const body = new Mesh(new BoxGeometry(0.76, STANDARDS.BASE_HEIGHT, 0.64), mats.metal);
  body.position.y = STANDARDS.BASE_HEIGHT * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const cooktopMat = mats.metal.clone();
  cooktopMat.color = new Color(0x1a1a1c);
  cooktopMat.metalness = 0.2;
  cooktopMat.roughness = 0.35;
  const cooktop = new Mesh(new BoxGeometry(0.74, 0.02, 0.62), cooktopMat);
  cooktop.position.y = STANDARDS.BASE_HEIGHT + 0.01;
  g.add(cooktop);

  for (const [bx, bz] of [
    [-0.18, -0.14],
    [0.18, -0.14],
    [-0.18, 0.14],
    [0.18, 0.14],
  ] as const) {
    const burner = new Mesh(new CylinderGeometry(0.09, 0.09, 0.015, 24), mats.metal);
    burner.position.set(bx, STANDARDS.BASE_HEIGHT + 0.02, bz);
    g.add(burner);
  }

  const panel = new Mesh(new BoxGeometry(0.74, 0.18, 0.06), mats.metal);
  panel.position.set(0, STANDARDS.BASE_HEIGHT + 0.1, -0.28);
  g.add(panel);

  return g;
}

/** White ceramic farmhouse apron + brass bridge faucet. */
export function buildSink(app: ApplianceSpec, mats: KitchenMaterials): Group {
  const g = new Group();
  g.position.set(app.position.x, app.position.y, app.position.z);
  g.rotation.y = app.yaw;
  g.name = 'sink';

  // Apron front (farmhouse silhouette)
  const apron = new Mesh(new BoxGeometry(0.82, 0.22, 0.04), mats.ceramic);
  apron.position.set(0, -0.08, 0.26);
  apron.castShadow = true;
  apron.receiveShadow = true;
  g.add(apron);

  // Outer basin shell
  const shell = new Mesh(new BoxGeometry(0.78, 0.2, 0.48), mats.ceramic);
  shell.position.set(0, -0.08, 0.02);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);

  // Interior cavity (slightly darker ceramic)
  const cavityMat = mats.ceramic.clone();
  cavityMat.color = new Color(0xe8e4dc);
  cavityMat.roughness = 0.4;
  const points: Vector2[] = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const r = 0.26 * (1 - t * 0.12);
    const y = -0.02 - t * 0.2;
    points.push(new Vector2(r, y));
  }
  points.push(new Vector2(0.02, -0.22));
  const bowl = new Mesh(new LatheGeometry(points, 36), cavityMat);
  bowl.scale.set(1.15, 1, 0.85);
  bowl.position.y = 0;
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  bowl.name = 'sink-bowl';
  g.add(bowl);

  // Thin rim lip on counter plane
  const rim = new Mesh(new BoxGeometry(0.8, 0.018, 0.5), mats.ceramic);
  rim.position.y = 0.008;
  rim.castShadow = true;
  g.add(rim);

  g.add(buildBridgeFaucet(mats.brass));

  return g;
}

/** Bridge faucet: pillars + crossbar + gooseneck + cross handles. */
function buildBridgeFaucet(brass: MeshStandardMaterial): Group {
  const g = new Group();
  g.name = 'faucet';
  const z = -0.18;
  const spread = 0.1;

  for (const sx of [-spread, spread]) {
    const base = new Mesh(new CylinderGeometry(0.022, 0.028, 0.03, 16), brass);
    base.position.set(sx, 0.03, z);
    g.add(base);
    const pillar = new Mesh(new CylinderGeometry(0.012, 0.014, 0.14, 12), brass);
    pillar.position.set(sx, 0.11, z);
    g.add(pillar);
  }

  // Cross bar
  const bar = new Mesh(new CylinderGeometry(0.01, 0.01, spread * 2 + 0.02, 10), brass);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.18, z);
  g.add(bar);

  // Gooseneck column + spout
  const neck = new Mesh(new CylinderGeometry(0.011, 0.013, 0.16, 12), brass);
  neck.position.set(0, 0.26, z);
  g.add(neck);

  const bend = new Mesh(new TorusGeometry(0.055, 0.01, 10, 16, Math.PI * 0.85), brass);
  bend.rotation.y = Math.PI / 2;
  bend.position.set(0, 0.34, z + 0.02);
  g.add(bend);

  const spout = new Mesh(new CylinderGeometry(0.009, 0.011, 0.1, 10), brass);
  spout.rotation.x = Math.PI / 2.6;
  spout.position.set(0, 0.3, z + 0.1);
  g.add(spout);

  // Cross handles on pillars
  for (const sx of [-spread, spread]) {
    const stem = new Mesh(new CylinderGeometry(0.006, 0.006, 0.04, 8), brass);
    stem.position.set(sx, 0.2, z);
    g.add(stem);
    const cross = new Mesh(new CylinderGeometry(0.005, 0.005, 0.055, 8), brass);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(sx, 0.22, z);
    g.add(cross);
    const cross2 = cross.clone();
    cross2.rotation.z = 0;
    cross2.rotation.x = Math.PI / 2;
    g.add(cross2);
  }

  return g;
}

/** World-space approx center/radius of sink water plane for the water system. */
export function sinkWaterPose(app: ApplianceSpec): {
  x: number;
  y: number;
  z: number;
  yaw: number;
  radius: number;
} {
  return {
    x: app.position.x,
    y: app.position.y - 0.05,
    z: app.position.z,
    yaw: app.yaw,
    radius: 0.22,
  };
}
