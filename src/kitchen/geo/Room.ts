/** Room shell: walls, floor, ceiling, window opening. */

import {
  BoxGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  type Material,
} from 'three';
import { STANDARDS } from '../layout/types';
import type { KitchenLayout } from '../layout/types';
import type { KitchenMaterials } from '../render/Materials';

export function buildRoom(layout: KitchenLayout, mats: KitchenMaterials): Group {
  const root = new Group();
  root.name = 'room';

  const floor = new Mesh(
    new PlaneGeometry(layout.width, layout.depth),
    mats.tile,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(layout.width * 0.5, 0, layout.depth * 0.5);
  floor.receiveShadow = true;
  floor.name = 'floor';
  root.add(floor);

  const ceiling = new Mesh(
    new PlaneGeometry(layout.width, layout.depth),
    mats.wall,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(layout.width * 0.5, STANDARDS.WALL_HEIGHT_ROOM, layout.depth * 0.5);
  ceiling.receiveShadow = true;
  root.add(ceiling);

  for (const wall of layout.walls) {
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dz, dx);
    const cx = (wall.start.x + wall.end.x) * 0.5;
    const cz = (wall.start.z + wall.end.z) * 0.5;

    if (wall.hasWindow) {
      addWallWithWindow(root, layout, mats.wall, mats.glass, len, yaw, cx, cz, wall.height, wall.thickness);
    } else {
      const mesh = new Mesh(
        new BoxGeometry(len, wall.height, wall.thickness),
        mats.wall,
      );
      mesh.position.set(cx, wall.height * 0.5, cz);
      mesh.rotation.y = -yaw;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }

  return root;
}

/** Cutout driven by layout.window (center + width + sill + height). */
function addWallWithWindow(
  root: Group,
  layout: KitchenLayout,
  wallMat: Material,
  glassMat: Material,
  len: number,
  yaw: number,
  cx: number,
  cz: number,
  height: number,
  thickness: number,
): void {
  const w = layout.window;
  const sill = w.sill;
  const wh = Math.min(w.height, height - sill - 0.05);
  const ww = Math.min(w.width, len - 0.3);

  // Project window center onto the wall tangent to get local x-offset from mid
  const tdx = Math.cos(yaw);
  const tdz = Math.sin(yaw);
  const xOffWin = (w.center.x - cx) * tdx + (w.center.z - cz) * tdz;
  const half = len * 0.5;
  const winL = Math.max(-half, Math.min(half - ww, xOffWin - ww * 0.5));
  const winR = winL + ww;
  const leftW = Math.max(0, winL - (-half));
  const rightW = Math.max(0, half - winR);
  const headerH = Math.max(0.04, height - sill - wh);
  const winMid = (winL + winR) * 0.5;

  const parts: { w: number; h: number; y: number; xOff: number }[] = [
    { w: len, h: sill, y: sill * 0.5, xOff: 0 },
    { w: len, h: headerH, y: sill + wh + headerH * 0.5, xOff: 0 },
    { w: leftW, h: wh, y: sill + wh * 0.5, xOff: -half + leftW * 0.5 },
    { w: rightW, h: wh, y: sill + wh * 0.5, xOff: half - rightW * 0.5 },
  ];

  for (const p of parts) {
    if (p.w < 0.01 || p.h < 0.01) continue;
    const mesh = new Mesh(new BoxGeometry(p.w, p.h, thickness), wallMat);
    const lx = Math.cos(yaw) * p.xOff;
    const lz = Math.sin(yaw) * p.xOff;
    mesh.position.set(cx + lx, p.y, cz + lz);
    mesh.rotation.y = -yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Glass in the cutout — offset slightly along wall normal toward exterior (−Z for north)
  const nx = Math.sin(yaw);
  const nz = -Math.cos(yaw);
  const gx = cx + Math.cos(yaw) * winMid + nx * (-thickness * 0.2);
  const gz = cz + Math.sin(yaw) * winMid + nz * (-thickness * 0.2);
  const glass = new Mesh(new BoxGeometry(ww * 0.98, wh * 0.98, 0.02), glassMat);
  glass.position.set(gx, sill + wh * 0.5, gz);
  glass.rotation.y = -yaw;
  glass.name = 'window-glass';
  root.add(glass);
}
