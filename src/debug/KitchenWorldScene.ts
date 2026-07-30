/**
 * ?scene=kitchen — procedural kitchen on a flat cleared LAAS outdoor pad.
 * Boot order mirrors TerrainScene; pad flatten runs before scatter so veg
 * gates see the AABB. Glass wall faces −Z (north) toward the scenic vista.
 */

import { BOOKMARKS, installBookmarks } from './Bookmarks';
import { Froxels } from '../gpu/passes/Froxels';
import { PARTICLE_COUNT, Particles } from '../gpu/passes/Particles';
import { ProbeGI } from '../gpu/passes/ProbeGI';
import { buildCanopyMap, runScatter } from '../gpu/passes/Scatter';
import { Forests } from '../vegetation/Forests';
import { GroundRing } from '../vegetation/GroundRing';
import { buildVegLibrary } from '../vegetation/VegLibrary';
import { CausticsBake, setCausticContext } from '../render/Caustics';
import { setWindContext, windU } from '../render/Wind';
import { sunU, updateSunUniforms } from '../render/VegMaterials';
import { buildCanopyShell } from '../world/CanopyShell';
import { Heightfield } from '../world/Heightfield';
import {
  flattenKitchenPad,
  kitchenWorldTransform,
  makeKitchenPad,
  setKitchenPad,
} from '../world/KitchenPad';
import { buildTerrainShadowProxy } from '../world/ShadowProxy';
import { TerrainTiles } from '../world/TerrainTiles';
import { WaterSurface } from '../world/WaterSurface';
import { PostStack } from '../render/PostStack';
import { setupSunShadows } from '../render/ShadowSetup';
import { Clouds } from '../sky/Clouds';
import { SunSky } from '../sky/SunSky';
import { buildKitchenMount, layoutKitchen } from '../kitchen/buildKitchen';
import { kitchenParamsFromUrl } from '../kitchen/params';
import { WorldSeed } from '../core/Seed';
import type { WorldContext } from './Scenes';

/** Faster kitchen-demo boots — outdoor water/volumetrics + noisy post stages off. */
const KITCHEN_DEFAULT_ABLATE = ['water', 'caustics', 'froxels', 'particles', 'ao', 'taa'];

export async function buildKitchenWorldScene(ctx: WorldContext): Promise<void> {
  const { engine, params, seed } = ctx;
  setKitchenPad(null);

  const q = new URLSearchParams(window.location.search);
  const ablate = new Set([
    ...KITCHEN_DEFAULT_ABLATE,
    ...(q.get('ablate') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ]);
  // ?ablate=keepwater restores outdoor water for A/B
  if (q.get('ablate')?.includes('keepwater')) {
    ablate.delete('water');
    ablate.delete('caustics');
  }
  // ?ablate=keepao / keeptaa restores GTAO / TRAA for A/B
  if (q.get('ablate')?.includes('keepao')) ablate.delete('ao');
  if (q.get('ablate')?.includes('keeptaa')) ablate.delete('taa');

  const kitchenSeed = new WorldSeed(seed.sub('kitchen'));
  const layout = layoutKitchen(kitchenSeed);

  const hf = await Heightfield.generate(
    engine.renderer,
    params,
    seed,
    (p, m) => ctx.progress(p * 0.88, m),
  );
  (engine as unknown as { heightfield?: Heightfield }).heightfield = hf;

  ctx.progress(0.89, 'kitchen: flattening pad');
  const padSpec = makeKitchenPad(layout.width, layout.depth, 3, 0, 0);
  const pad = await flattenKitchenPad(engine.renderer, hf, padSpec);

  if (hf.cpuHeights) {
    let maxH = -Infinity;
    for (let i = 0; i < hf.cpuHeights.length; i += 7) {
      const v = hf.cpuHeights[i] as number;
      if (v > maxH) maxH = v;
    }
    engine.stats.counters['terrain.maxH'] = Math.round(maxH);
  }
  engine.stats.counters['kitchen.padY'] = Math.round(pad.y * 10) / 10;

  const bootBm = params.shot !== null ? BOOKMARKS[params.shot - 1] : undefined;
  const bootTod = bootBm?.tod ?? params.timeOfDay;
  ctx.progress(0.91, 'sky: baking atmosphere LUTs');
  const sunSky = new SunSky(engine, bootTod);
  await sunSky.init(engine.renderer);
  (engine as unknown as { sunSky?: SunSky }).sunSky = sunSky;
  (window as unknown as { __laasDbg?: unknown }).__laasDbg = { engine, sunSky };

  ctx.progress(0.93, 'vegetation: scattering instances');
  const scatter = await runScatter(engine.renderer, hf, seed);
  const canopyTex = await buildCanopyMap(engine.renderer, scatter.trees);
  engine.stats.counters['veg.trees'] = scatter.trees.count;
  engine.stats.counters['veg.under'] = scatter.understory.count;
  engine.stats.counters['veg.extras'] = scatter.extras.count;
  engine.stats.counters['veg.stones'] = scatter.stones.count;

  ctx.progress(0.94, 'gi: gathering irradiance probes');
  const gi = new ProbeGI(
    hf,
    sunSky.atmosphere,
    ablate.has('canopygi') ? null : canopyTex,
  );
  await gi.init(engine.renderer);
  sunSky.dimAmbientForGI();
  engine.onUpdate(() => gi.tick(engine.renderer));

  if (!ablate.has('caustics')) {
    const bake = new CausticsBake();
    const ck = Number(q.get('caustk') ?? NaN);
    if (Number.isFinite(ck)) bake.focusK.value = ck;
    setCausticContext({ hf, bake, sunDir: sunU.dir });
    engine.onUpdate(() => bake.update(engine.renderer));
  }

  if (!ablate.has('wind') && hf.noiseA) {
    setWindContext({ noiseA: hf.noiseA, canopyTex });
    const ws = Number(q.get('wind') ?? NaN);
    if (Number.isFinite(ws)) windU.strength.value = ws;
    const wdeg = Number(q.get('winddir') ?? NaN);
    if (Number.isFinite(wdeg)) {
      windU.dir.value.set(Math.cos((wdeg * Math.PI) / 180), Math.sin((wdeg * Math.PI) / 180));
    }
  }

  ctx.progress(0.95, 'terrain: building tiles');
  const tiles = new TerrainTiles(hf, null, { gi, canopyTex });
  engine.scene.add(tiles.mesh);
  engine.scene.add(tiles.farShell);
  if (!ablate.has('proxy')) engine.scene.add(buildTerrainShadowProxy(hf));
  engine.onUpdate(() => {
    tiles.update(engine.camera);
    engine.stats.counters['terrain.tiles'] = tiles.activeTiles;
  });

  if (!ablate.has('water')) {
    const water = new WaterSurface(
      hf,
      sunSky.atmosphere,
      canopyTex,
      ablate.has('gi') ? null : gi,
    );
    engine.scene.add(water.group);
    engine.onUpdate(() => water.update(engine.camera));
  }

  let forestsRef: Forests | null = null;
  if (!ablate.has('veg')) {
    const lib = await buildVegLibrary(engine.renderer, seed, (p, m) =>
      ctx.progress(0.955 + p * 0.01, m),
    );
    const forests = new Forests(
      hf,
      scatter,
      lib,
      ablate.has('gi') ? null : gi,
      canopyTex,
    );
    forests.init(engine.renderer);
    forestsRef = forests;
    engine.scene.add(forests.group);
    updateSunUniforms(sunSky.sun);
    engine.onUpdate(() => {
      forests.update(engine.renderer, engine.camera);
      Object.assign(engine.stats.counters, forests.counterSnapshot());
    });

    if (!ablate.has('grass')) {
      const ring = new GroundRing(hf, canopyTex, seed, ablate.has('gi') ? null : gi);
      ring.init(lib.atlases.get('beech') ?? null);
      engine.scene.add(ring.group);
      engine.onUpdate(() => {
        ring.update(engine.renderer, engine.camera);
        Object.assign(engine.stats.counters, ring.counterSnapshot());
      });
    }

    if (!ablate.has('shell')) {
      engine.scene.add(buildCanopyShell(hf, canopyTex));
    }
  }

  ctx.progress(0.97, 'sky: baking cloud noise');
  const clouds = new Clouds(sunSky.atmosphere);
  await clouds.init(engine.renderer);
  let lastWt = 0;
  engine.onUpdate((_dt, wt) => {
    clouds.tick(engine.renderer, wt - lastWt);
    lastWt = wt;
  });

  const shadowRig = setupSunShadows(sunSky.sun, engine.camera, (wxz) =>
    clouds.shadowAt(wxz),
  );
  forestsRef?.setCSM(shadowRig.csm ?? null);
  (window as unknown as { __laasDbg?: Record<string, unknown> }).__laasDbg = {
    engine,
    sunSky,
    shadowRig,
  };

  if (!ablate.has('particles')) {
    const parts = new Particles(hf, canopyTex, ablate.has('gi') ? null : gi);
    engine.scene.add(parts.mesh);
    engine.onUpdate((dt) => parts.update(engine.renderer, engine.camera, dt));
    engine.stats.counters['particles'] = PARTICLE_COUNT;
  }

  let froxels: Froxels | null = null;
  if (!ablate.has('froxels')) {
    froxels = new Froxels(hf, sunSky.atmosphere, canopyTex, clouds);
    const fq = Number(q.get('fog') ?? NaN);
    if (Number.isFinite(fq)) froxels.fogK.value = fq;
    const fx = froxels;
    engine.onUpdate(() => fx.update(engine.renderer, engine.camera));
  }

  ctx.progress(0.98, 'post: building pipeline');
  const post = new PostStack(engine, sunSky.atmosphere, bootTod, clouds, froxels, {
    ablateExtra: ablate,
  });
  engine.post = post;

  ctx.hooks.setTimeOfDay = (t: number) => {
    void (async () => {
      await sunSky.setTimeOfDay(t);
      await clouds.refreshShadow(engine.renderer);
      gi.invalidate();
      post.setTimeOfDay(t);
    })();
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      void clouds.refreshShadow(engine.renderer);
      post.setTimeOfDay(sunSky.timeOfDay);
    }
  });

  // --- kitchen mount on pad -------------------------------------------------
  ctx.progress(0.99, 'kitchen: building interior');
  const kParams = kitchenParamsFromUrl(bootTod, window.location.search);
  const kitchen = buildKitchenMount(kitchenSeed, kParams, layout);
  const xform = kitchenWorldTransform(pad);
  kitchen.root.position.set(xform.x, xform.y, xform.z);
  engine.scene.add(kitchen.root);
  if (kitchen.water) {
    const wsys = kitchen.water;
    engine.onUpdate((_dt, wt) => wsys.update(wt));
  }
  engine.stats.counters['kitchen.w'] = Math.round(layout.width * 10) / 10;
  engine.stats.counters['kitchen.d'] = Math.round(layout.depth * 10) / 10;

  ctx.hooks.groundProbe = (x, z) => {
    // Inside the pad, walk on the kitchen floor (heightfield is sunk below it)
    const onPad =
      x >= pad.minX && x <= pad.maxX && z >= pad.minZ && z <= pad.maxZ;
    return {
      ground: onPad ? pad.y : hf.heightAtCpu(x, z),
      water: hf.waterYAtCpu(x, z),
    };
  };

  // Inside kitchen looking out the north glass (−Z / toward scenic NE massif)
  if (params.cam === null) {
    const eyeX = xform.x + layout.width * 0.5;
    const eyeY = xform.y + 1.65;
    const eyeZ = xform.z + layout.depth * 0.72;
    ctx.hooks.initialPose = {
      p: [eyeX, eyeY, eyeZ],
      yaw: 0, // look −Z (north / glass)
      pitch: -0.02,
    };
    ctx.hooks.initialPoseMode = 'walk';
    engine.camera.position.set(eyeX, eyeY, eyeZ);
  }

  installBookmarks(engine, hf, ctx.hooks, params);

  ctx.progress(1, 'kitchen world ready');
}
