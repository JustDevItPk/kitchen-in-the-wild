/** Shared MeshStandardMaterial factory from baked kit. */

import { Color, DoubleSide, MeshStandardMaterial } from 'three';
import type { MaterialKit } from '../gpu/MaterialBake';

export type KitchenMaterials = {
  wood: MeshStandardMaterial;
  woodDark: MeshStandardMaterial;
  stone: MeshStandardMaterial;
  brick: MeshStandardMaterial;
  tile: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  brass: MeshStandardMaterial;
  ceramic: MeshStandardMaterial;
  wall: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  dispose(): void;
};

export function createMaterials(kit: MaterialKit): KitchenMaterials {
  // Explicit base colors so a failed map upload never falls back to black*white=black
  const wood = new MeshStandardMaterial({
    color: new Color(0xc49a68),
    map: kit.woodAlbedo,
    roughnessMap: kit.woodRough,
    normalMap: kit.woodNormal,
    aoMap: kit.woodAo,
    aoMapIntensity: 0.85,
    roughness: 0.65,
    metalness: 0.0,
  });
  wood.normalScale.set(0.55, 0.55);

  const woodDark = new MeshStandardMaterial({
    color: new Color(0x8f6844),
    map: kit.woodAlbedo,
    roughnessMap: kit.woodRough,
    normalMap: kit.woodNormal,
    aoMap: kit.woodAo,
    aoMapIntensity: 0.9,
    roughness: 0.72,
    metalness: 0.0,
  });
  woodDark.normalScale.set(0.55, 0.55);

  const stone = new MeshStandardMaterial({
    color: new Color(0x1a1a1c),
    map: kit.stoneAlbedo,
    roughnessMap: kit.stoneRough,
    normalMap: kit.stoneNormal,
    roughness: 0.28,
    metalness: 0.02,
  });
  stone.normalScale.set(0.35, 0.35);

  const brick = new MeshStandardMaterial({
    color: new Color(0xd4b896),
    map: kit.brickAlbedo,
    roughnessMap: kit.brickRough,
    normalMap: kit.brickNormal,
    aoMap: kit.brickAo,
    aoMapIntensity: 0.9,
    roughness: 0.72,
    metalness: 0.0,
  });
  brick.normalScale.set(0.85, 0.85);

  const tile = new MeshStandardMaterial({
    color: new Color(0xd8d2c8),
    map: kit.tileAlbedo,
    roughnessMap: kit.tileRough,
    normalMap: kit.tileNormal,
    roughness: 0.45,
    metalness: 0.0,
  });
  tile.normalScale.set(0.65, 0.65);

  const metal = new MeshStandardMaterial({
    color: new Color(0xd0d4d8),
    map: kit.metalAlbedo,
    roughnessMap: kit.metalRough,
    normalMap: kit.metalNormal,
    // WebGPU PMREM/RoomEnvironment may be unavailable — keep metalness
    // moderate so brushed steel still reads without IBL (high metalness = black).
    roughness: 0.4,
    metalness: 0.3,
  });
  metal.normalScale.set(0.9, 0.25); // soft horizontal stretch

  const brass = new MeshStandardMaterial({
    color: new Color(0xc9a05a),
    map: kit.brassAlbedo,
    roughnessMap: kit.brassRough,
    roughness: 0.48,
    metalness: 0.22,
  });

  const ceramic = new MeshStandardMaterial({
    color: new Color(0xf3f0ea),
    map: kit.ceramicAlbedo,
    roughnessMap: kit.ceramicRough,
    roughness: 0.32,
    metalness: 0.0,
  });

  const wall = new MeshStandardMaterial({
    color: new Color(0xf0ebe4),
    map: kit.wallAlbedo,
    roughnessMap: kit.wallRough,
    roughness: 0.85,
    metalness: 0.0,
    side: DoubleSide,
  });

  const glass = new MeshStandardMaterial({
    color: new Color(0xa8c8e8),
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
    side: DoubleSide,
    depthWrite: false,
  });

  const mats = [wood, woodDark, stone, brick, tile, metal, brass, ceramic, wall, glass];
  return {
    wood,
    woodDark,
    stone,
    brick,
    tile,
    metal,
    brass,
    ceramic,
    wall,
    glass,
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}
