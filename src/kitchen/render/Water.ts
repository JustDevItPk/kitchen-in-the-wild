/**
 * Sink basin water — fresnel-ish Physical/Standard material with absorption tint,
 * gentle ripple, rim foam. Avoid heavy transmission on WebGPU (often blacks out).
 */

import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { KitchenParams } from '../params';
import { ablated } from '../params';
import type { ApplianceSpec } from '../layout/types';
import { sinkWaterPose } from '../geo/Appliances';

export interface WaterSystem {
  group: Group;
  update(worldTime: number): void;
}

export function buildSinkWater(
  sink: ApplianceSpec,
  params: KitchenParams,
): WaterSystem | null {
  if (ablated(params, 'sinkwater')) return null;

  const pose = sinkWaterPose(sink);
  const group = new Group();
  group.name = 'sink-water';
  group.position.set(pose.x, pose.y, pose.z);
  group.rotation.y = pose.yaw;

  const waterMat = new MeshStandardMaterial({
    color: new Color(0x4a7a8a),
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.72,
    side: DoubleSide,
    envMapIntensity: 1,
  });

  const water = new Mesh(
    new CylinderGeometry(pose.radius, pose.radius * 0.95, 0.025, 48),
    waterMat,
  );
  water.position.y = -0.02;
  water.receiveShadow = true;
  water.name = 'water-surface';
  group.add(water);

  const foamMat = new MeshStandardMaterial({
    color: new Color(0xd8e8f0),
    roughness: 0.7,
    metalness: 0,
    transparent: true,
    opacity: 0.4,
    side: DoubleSide,
    depthWrite: false,
  });
  const foam = new Mesh(
    new CylinderGeometry(pose.radius * 1.02, pose.radius * 0.98, 0.008, 48, 1, true),
    foamMat,
  );
  foam.position.y = -0.01;
  group.add(foam);

  const baseY = water.position.y;

  return {
    group,
    update(worldTime: number) {
      const w = Math.sin(worldTime * 1.7) * 0.002 + Math.sin(worldTime * 3.1 + 1.2) * 0.001;
      water.position.y = baseY + w;
      const sx = 1 + Math.sin(worldTime * 2.3) * 0.008;
      const sz = 1 + Math.cos(worldTime * 1.9) * 0.008;
      water.scale.set(sx, 1, sz);
      foam.scale.set(sx * 1.01, 1, sz * 1.01);
    },
  };
}
