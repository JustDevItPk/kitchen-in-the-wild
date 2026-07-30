# IMPLEMENT.md — Kitchen on LAAS outdoor pad

Hand this file to a new agent thread. It is the full brief: goal, repo map, prior work, exact implementation steps, pitfalls, and acceptance checks. Do not re-litigate architecture unless blocked.

---

## 1. Goal

Ship one WebGPU scene where:

1. A **procedural kitchen** sits on a **flat cleared pad**.
2. Exactly **one wall has no cabinets**; that wall is mostly **glass**.
3. Through the glass: **LAAS outdoor world** — terrain, trees, grass, mountains (far shell) — with **minimal changes** to LAAS generation (reuse as-is).
4. World edge ~**500–512 m** (not full 4 km), with a straight flat ground area ≥ kitchen footprint, kitchen placed on it.

**Host repo:** `D:\Upwork\fable5-world-demo` (LAAS).  
**Kitchen source to copy from:** `D:\Upwork\kitchen-designer\procedural-kitchen`.

Do **not** port the entire LAAS stack into `procedural-kitchen`. Mount the kitchen inside LAAS.

---

## 2. Repo map

| Path | Role |
|------|------|
| `D:\Upwork\fable5-world-demo` | LAAS — procedural open world (WebGPU/TSL). **Primary work location.** |
| `D:\Upwork\kitchen-designer\procedural-kitchen` | Standalone kitchen POC (WebGPU). **Source of kitchen modules to copy.** |
| `D:\Upwork\kitchen-designer` | Older R3F CAD tool (walls/cabinets interactive). **Do not use as the outdoor host.** Layout math already ported into `procedural-kitchen`. |

### Run today

```bash
# Kitchen only (current)
cd D:\Upwork\kitchen-designer\procedural-kitchen
npm install && npm run dev   # http://localhost:5175/?seed=42

# LAAS only (current)
cd D:\Upwork\fable5-world-demo
npm install && npm run dev   # http://localhost:5173/?seed=1
```

Target after this work:

```text
http://localhost:5173/?scene=kitchen&seed=42&freeze=1
```

(Chrome 113+ desktop, WebGPU required.)

---

## 3. Prior kitchen POC context (already built)

Location: `procedural-kitchen/`

- Seed-driven layout (`?seed=N`), L / U / galley templates.
- Room size recently scaled ~3×: **width 12.5–17.5 m**, **depth 9.5–15.5 m** (galley slightly shallower).
- Procedural cabinets, appliances (no GLTF), sink water, DataTexture materials, indoor lights.
- **Known pitfalls already fixed** (do not regress):
  - `CanvasTexture` on WebGPU → black materials. Use **`DataTexture`** (`src/gpu/MaterialBake.ts`).
  - `RectAreaLight` + WebGL UniformsLib → black shading on WebGPU. Use **PointLight** window fill (`src/render/Lighting.ts`).
  - High `metalness` without IBL → black steel. Keep metalness ~0.28.
- Docs: `procedural-kitchen/docs/DESIGN.md`, `docs/BID.md`.
- Camera: click capture, WASD, V walk/fly, **P** copies `?cam=...`.

### Kitchen layout today (must change)

File: `procedural-kitchen/src/layout/generateLayout.ts`

- Rectangle walls; **`wall-north` (z=0) has the window**.
- **Every template still places `run-north`** under the window — **wrong for this brief**.
- Fridge only placed if north run exists; sink prefers north.
- `Room.ts` cutout is centered on wall length; `window.center` mostly used by lighting.

Coord: x along width, **z=0 = north (window)**, z=depth = south.

---

## 4. LAAS context (reuse, don’t rewrite)

Key files:

| File | Why |
|------|-----|
| `src/world/WorldConst.ts` | `WORLD_SIZE=4096`, `HEIGHT_RES`, `SIM_RES`, `FAR_RADIUS` |
| `src/debug/TerrainScene.ts` | Boot order for full outdoor world |
| `src/world/Heightfield.ts` | Height synth / compose / CPU readback |
| `src/gpu/passes/Scatter.ts` | Tree/understory accept gates — **add pad AABB exclude** |
| `src/vegetation/Forests.ts`, `GroundRing.ts` | Instanced veg |
| `src/world/TerrainTiles.ts` | CDLOD + far shell mountains |
| `src/main.ts`, `src/debug/Scenes.ts` | Scene registry |
| `docs/DELTA.md` | How LAAS quality-phased (reference for craft, not required for this task) |

Boot order (keep): Heightfield → SunSky/atmosphere → Scatter → ProbeGI → TerrainTiles/far shell → Water → VegLibrary/Forests/GroundRing → Clouds/CSM → Particles/Froxels/Post → groundProbe/spawn.

**No spawn-pad API today.** Flatten after compose; exclude veg via scatter accept.

Ablation already exists: `?ablate=water,caustics,froxels,particles,veg,grass,...`

---

## 5. Architecture (committed)

```text
LAAS TerrainScene (~512 m world)
  ├─ Heightfield + far-shell mountains
  ├─ Flat pad AABB (kitchen size + margin) @ constant Y
  ├─ Scatter/GroundRing: reject samples inside pad
  └─ Kitchen Group (copied modules)
       ├─ Empty north wall = large glass
       ├─ Cabinets on other walls + island
       └─ Indoor lights + materials
```

Glass faces outdoor vista (north / −Z toward scenic direction / NE massif preference).

---

## 6. Implementation steps (do in order)

### Step A — Kitchen: empty wall + large glass

Edit in `procedural-kitchen` first (or edit once after copy into LAAS `src/kitchen/` — prefer fix upstream then copy).

1. **`generateLayout.ts`**
   - `emptyWallId = 'north'` (fixed v1).
   - **Do not** create `run-north`.
   - Templates:
     - **L:** east + island
     - **U:** east + south (+ island)
     - **galley:** south + **west** (two runs; north empty)
   - Window: ~**70–85%** of north wall length, sill ~**0.45 m**, height ~**2.0–2.2 m**.
   - Fridge: place on west/south/east run end — **not** gated on north run.
   - Sink/range: remaining wall runs / island only.

2. **`geo/Room.ts`**
   - Drive cutout from `layout.window` (center + width + sill + height).
   - Glass spans major area of empty wall.

3. Keep north-keyed lighting/camera (`Lighting.ts`, default yaw toward window).

### Step B — Copy kitchen into LAAS

Copy into `D:\Upwork\fable5-world-demo\src\kitchen\`:

```text
layout/   (types, cabinetSplit, generateLayout)
geo/      (Room, Cabinets, Appliances, Clutter)
gpu/      (MaterialBake)
render/   (Materials, Lighting, Water, Post, Environment — Environment optional)
```

Adapt imports to LAAS package paths. Kitchen does **not** need its own Engine/main — LAAS owns the renderer.

Shared: both use **three ~0.184** + WebGPU. Kitchen uses `MeshStandardMaterial` + DataTextures; LAAS uses TSL node materials. Both can live in one `WebGPURenderer` scene.

### Step C — Shrink LAAS world ~500 m

In `src/world/WorldConst.ts`:

- `WORLD_SIZE = 512` (world `[-256,+256]²`)
- Scale `HEIGHT_RES` / `SIM_RES` with presets (e.g. high ≈ 512 / 256) so boot is tractable
- Keep large `FAR_RADIUS` for distant mountains through the window

**Grep** for hard-coded `4096` / `2048` that break at 512 and fix only what fails.

### Step D — Flat kitchen pad

New helper e.g. `src/world/KitchenPad.ts`:

1. After heightfield compose (end of generate / after `composeEroded`), set height texels in an AABB to constant Y.
2. Call `rebuildDerivedMaps` (+ biome refresh if required).
3. Pad size = kitchen `width × depth` + ~2 m margin.
4. Place pad near world origin/center; orient so kitchen **glass (−Z / north)** faces the scenic vista (default walk yaw toward NE massif is a good cue).
5. Export pad AABB + Y for scatter gate and kitchen transform.

### Step E — Exclude vegetation on pad

In `src/gpu/passes/Scatter.ts` (tree + understory + stones accept):

- If sample world pos inside pad AABB → reject (`accept = 0` / early Return).

Same idea in `GroundRing` if grass still grows through the floor.

### Step F — KitchenWorldScene glue

New `src/debug/KitchenWorldScene.ts` (pattern after `TerrainScene.ts`):

1. Run terrain boot (same order as TerrainScene).
2. Apply pad flatten **before** scatter (or flatten then re-scatter — flatten must be visible to scatter gates).
3. Build kitchen with `WorldSeed` / layout seed (can share `?seed=` or `seed.rng('kitchen')`).
4. Parent kitchen root at pad transform: Y = pad height; XZ so room origin matches pad; glass faces vista.
5. Set `hooks.initialPose` **inside** kitchen looking out the glass (`?cam=` still works).
6. `hooks.groundProbe` remains heightfield (walk on pad outside kitchen; inside kitchen floor is mesh at pad Y).

Register in scene registry / `main.ts`:

- `?scene=kitchen` → `KitchenWorldScene`
- Prefer this as the demo entry for the bid trial.

Optional default ablate for faster boots while iterating: `water,caustics,froxels,particles` (keep veg + terrain + sky + CSM + post).

### Step G — Verify + short doc note

Add `docs/KITCHEN-PAD.md` (LAAS) noting:

- `WORLD_SIZE=512`, pad rule, empty-wall rule, ablations, how to run.

---

## 7. Minimal-change policy (important)

**Change only:**

- `WorldConst` sizes
- Pad flatten + scatter/GroundRing AABB gate
- New kitchen scene + copied `src/kitchen/`
- Spawn / bookmarks for window hero

**Do not rewrite:** BarkSynth, Forests, PostStack, Atmosphere, ProbeGI (unless broken by size). Outdoor half must stay “LAAS as-is.”

---

## 8. Acceptance criteria

- [ ] `npm run dev` in LAAS → `?scene=kitchen&seed=42`
- [ ] North/glass wall has **zero** cabinet runs; other walls/island have cabinets
- [ ] Glass covers **majority** of that wall
- [ ] Through glass: terrain + trees/grass + distant mountains visible
- [ ] No trees/large veg inside kitchen AABB
- [ ] Pad under kitchen is flat; kitchen sits flush (no floating / buried floor)
- [ ] Walk/fly works; P still useful for `?cam=`
- [ ] No regression to black materials (DataTexture + no RectAreaLight)

---

## 9. Suggested todo order

1. Empty-wall + large glass in kitchen layout/Room + appliance rehome  
2. `WORLD_SIZE≈512` + pad flatten + scatter exclude  
3. Copy kitchen modules → `KitchenWorldScene` mount  
4. Register scene, hero spawn looking out glass, smoke-test + `docs/KITCHEN-PAD.md`

---

## 10. Out of scope (this thread)

- Photoreal material Phase-2/4 upgrade (NoiseBake/GTAO/TRAA) — separate pass  
- Interactive CAD draw-mode from kitchen-designer  
- Restoring full 4 km world as default for `?scene=terrain` (can keep original constants behind a flag if needed)  
- Bidding/pricing text  

---

## 11. Quick reference — important kitchen files

```text
procedural-kitchen/src/layout/generateLayout.ts   # runs, window, appliances
procedural-kitchen/src/layout/types.ts            # STANDARDS (meters)
procedural-kitchen/src/layout/cabinetSplit.ts
procedural-kitchen/src/geo/Room.ts                # window cutout
procedural-kitchen/src/geo/Cabinets.ts
procedural-kitchen/src/geo/Appliances.ts
procedural-kitchen/src/gpu/MaterialBake.ts        # DataTexture — keep
procedural-kitchen/src/render/Lighting.ts         # no RectAreaLight — keep
procedural-kitchen/src/render/Materials.ts
procedural-kitchen/src/render/Water.ts
procedural-kitchen/src/scene/KitchenScene.ts      # assembly pattern to adapt
```

## 12. Quick reference — important LAAS files

```text
src/world/WorldConst.ts
src/world/Heightfield.ts
src/debug/TerrainScene.ts
src/gpu/passes/Scatter.ts
src/vegetation/GroundRing.ts
src/main.ts
src/debug/Scenes.ts
src/core/Seed.ts / Params.ts / Engine.ts / FlyCamera.ts
```

---

## 13. One-sentence summary for the agent

**In LAAS, shrink the world to ~512 m, flatten a kitchen-sized pad and clear veg there, copy the procedural kitchen onto that pad with one cabinet-free wall that is mostly glass looking out onto untouched LAAS trees/grass/mountains.**
