/** Seeded counter clutter — styled density (hero), not empty or grid-cloned. */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { ClutterSpec } from '../layout/types';
import type { KitchenMaterials } from '../render/Materials';

export function buildClutter(items: ClutterSpec[], mats: KitchenMaterials): Group {
  const root = new Group();
  root.name = 'clutter';

  for (const item of items) {
    const g = new Group();
    g.position.set(item.position.x, item.position.y, item.position.z);
    g.rotation.y = item.yaw;
    g.scale.setScalar(item.scale);

    switch (item.kind) {
      case 'bowl':
        addBowl(g, mats, item.tint);
        break;
      case 'board':
        addBoard(g, mats);
        break;
      case 'jar':
        addJar(g, item.tint);
        break;
      case 'plant':
        addPlant(g, mats);
        break;
      case 'crock':
        addCrock(g, mats, item.tint);
        break;
      case 'soap':
        addSoap(g, item.tint);
        break;
      case 'pitcher':
        addPitcher(g, mats);
        break;
      case 'lemons':
        addLemons(g, mats, item.tint);
        break;
      default:
        addBowl(g, mats, item.tint);
    }

    root.add(g);
  }

  return root;
}

function addBowl(g: Group, mats: KitchenMaterials, tint: number): void {
  const m = mats.wood.clone();
  m.color = new Color().setHSL(0.05 + tint * 0.08, 0.35, 0.45);
  const bowl = new Mesh(new SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
  bowl.scale.y = 0.55;
  bowl.castShadow = true;
  g.add(bowl);
}

function addBoard(g: Group, mats: KitchenMaterials): void {
  const board = new Mesh(new BoxGeometry(0.32, 0.018, 0.2), mats.woodDark);
  board.castShadow = true;
  g.add(board);
}

function addJar(g: Group, tint: number): void {
  const m = new MeshStandardMaterial({
    color: new Color().setHSL(0.12, 0.4, 0.35 + tint * 0.15),
    roughness: 0.4,
    metalness: 0.05,
  });
  const jar = new Mesh(new CylinderGeometry(0.035, 0.04, 0.12, 16), m);
  jar.position.y = 0.06;
  jar.castShadow = true;
  g.add(jar);
}

function addPlant(g: Group, mats: KitchenMaterials): void {
  const pot = new Mesh(new CylinderGeometry(0.05, 0.04, 0.08, 12), mats.woodDark);
  pot.position.y = 0.04;
  pot.castShadow = true;
  g.add(pot);
  const leaf = new Mesh(
    new SphereGeometry(0.07, 10, 8),
    new MeshStandardMaterial({ color: 0x3d6b3a, roughness: 0.7 }),
  );
  leaf.position.y = 0.12;
  leaf.scale.set(1, 0.7, 1);
  g.add(leaf);
}

/** Utensil crock with spoon silhouettes. */
function addCrock(g: Group, mats: KitchenMaterials, tint: number): void {
  const crock = new Mesh(
    new CylinderGeometry(0.055, 0.048, 0.14, 16),
    new MeshStandardMaterial({
      color: new Color().setHSL(0.08, 0.08, 0.88 - tint * 0.05),
      roughness: 0.45,
    }),
  );
  crock.position.y = 0.07;
  crock.castShadow = true;
  g.add(crock);
  for (let i = 0; i < 3; i++) {
    const spoon = new Mesh(new BoxGeometry(0.012, 0.22, 0.008), mats.woodDark);
    spoon.position.set((i - 1) * 0.025, 0.18, 0.01);
    spoon.rotation.z = (i - 1) * 0.12;
    spoon.castShadow = true;
    g.add(spoon);
  }
}

/** Soap / pump bottles (sink styling cue). */
function addSoap(g: Group, tint: number): void {
  const amber = new MeshStandardMaterial({
    color: new Color().setHSL(0.08, 0.45, 0.28 + tint * 0.1),
    roughness: 0.35,
    metalness: 0.05,
  });
  for (let i = 0; i < 2; i++) {
    const bottle = new Mesh(new CylinderGeometry(0.028, 0.03, 0.14, 12), amber);
    bottle.position.set(i * 0.07 - 0.035, 0.07, 0);
    bottle.castShadow = true;
    g.add(bottle);
    const pump = new Mesh(
      new CylinderGeometry(0.012, 0.012, 0.04, 8),
      new MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.4, metalness: 0.2 }),
    );
    pump.position.set(i * 0.07 - 0.035, 0.16, 0);
    g.add(pump);
  }
}

/** Pitcher + greenery (island hero cue). */
function addPitcher(g: Group, mats: KitchenMaterials): void {
  const body = new Mesh(
    new CylinderGeometry(0.055, 0.06, 0.16, 16),
    new MeshStandardMaterial({ color: 0xf0ebe4, roughness: 0.4 }),
  );
  body.position.y = 0.08;
  body.castShadow = true;
  g.add(body);
  const handle = new Mesh(new BoxGeometry(0.02, 0.08, 0.04), mats.ceramic);
  handle.position.set(0.07, 0.1, 0);
  g.add(handle);
  const greenery = new Mesh(
    new SphereGeometry(0.1, 10, 8),
    new MeshStandardMaterial({ color: 0x4a7a48, roughness: 0.75 }),
  );
  greenery.position.y = 0.22;
  greenery.scale.set(1.1, 0.7, 1);
  g.add(greenery);
}

/** Bowl + lemons cluster. */
function addLemons(g: Group, mats: KitchenMaterials, tint: number): void {
  addBowl(g, mats, tint);
  const lemonMat = new MeshStandardMaterial({
    color: new Color().setHSL(0.14, 0.75, 0.55),
    roughness: 0.55,
  });
  for (let i = 0; i < 3; i++) {
    const lemon = new Mesh(new SphereGeometry(0.028, 10, 8), lemonMat);
    lemon.position.set((i - 1) * 0.04, 0.04, (i % 2) * 0.02);
    lemon.scale.set(1, 0.85, 1);
    lemon.castShadow = true;
    g.add(lemon);
  }
}
