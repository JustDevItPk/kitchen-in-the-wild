# KITCHEN-QUALITY.md — Materials (A) + geometry density (C)

Hand this file to a new agent thread. Full brief: goal, current state, refs, phases, pitfalls, acceptance. Do not re-litigate outdoor mounting or pad flatten unless blocked.

---

## 1. Goal

Raise the **LAAS-mounted** procedural kitchen from beginner MeshStandard + flat DataTexture + boxy geo to craft parity with the locked north-star stills.

Priority order: **A materials first**, then **C geometry density**.

Zero external asset files (no GLTF / HDRI / jpg textures). Procedural only. WebGPU / three r184.

Do **not** expand into outdoor pad / WORLD_SIZE / scatter / glass-wall architecture — that already shipped (`?scene=kitchen`).

---

## 2. Where to work

| Path | Role |
|------|------|
| `D:\Upwork\fable5-world-demo` | **Primary host.** Edit `src/kitchen/` only. |
| `D:\Upwork\fable5-world-demo\src\kitchen\` | Layout, geo, MaterialBake, Materials, Lighting, Water, Post, buildKitchen |
| `D:\Upwork\fable5-world-demo\src\debug\KitchenWorldScene.ts` | Mount glue — touch only if spawn/cam bookmarks needed for verify |
| `D:\Upwork\kitchen-designer\procedural-kitchen` | Older isolation POC. **Do not dual-edit** unless explicitly asked to re-sync later. |

### Run

```bash
cd D:\Upwork\fable5-world-demo
npm install && npm run dev
```

```text
http://localhost:5173/?scene=kitchen&seed=42&freeze=1&hud=1
```

Chrome 113+ desktop, WebGPU required. Click capture, WASD, V walk/fly, **P** copies `?cam=...`.

Outdoor systems (terrain, veg, PostStack GTAO/TRAA) already run. Kitchen-local “AO” is still soft discs in `src/kitchen/render/Post.ts`.

---

## 3. References (read these images; treat as acceptance targets)

| Role | Path |
|------|------|
| Wide hero + **cabinet material / panel language** / brick / farmhouse | `D:\Upwork\fable5-world-demo\reference\kitchen-render.png` |
| Counter / sink craft / AO / wood undercounter density cues | `D:\Upwork\fable5-world-demo\reference\counter-sink-render.png` |
| Appliance / brushed steel / reveals / dispenser | `D:\Upwork\fable5-world-demo\reference\friedge-render.png` |

Also study LAAS craft (**steal methods, not outdoor systems**):

- `src/gpu/passes/NoiseBake.ts`, `BarkSynth.ts` — macro→meso→micro, cavity AO packing
- `src/render/VegMaterials.ts` — Physical + dialed `specularIntensity`, `aoNode`
- `src/render/TerrainMaterial.ts`, `WaterMaterial.ts` — multi-scale maps / normals
- Process: `docs/DELTA.md` — shoot → top-10 deltas → fix top 3 → re-shoot

### Art direction (locked)

Late morning transitional kitchen from **kitchen-render**:

- Cool window fill + warm under-cabinet practicals
- Medium warm oak, vertical grain, satin–matte (not wet gloss, not cardboard)
- Raised / shaker panels + crown (match kitchen-render)
- Cream/tan brick backsplash with mortar
- Polished near-black stone counters, soft veins, sharp practical highlights
- **White ceramic farmhouse sink**; **brass/bronze bridge faucet**
- Brushed stainless appliances with **horizontal** grain and soft anisotropic stretch — not mirror chrome
- Soft contact AO in gaps; no crushed black shadows

Use counter-sink and fridge refs for **craft** (AO, anisotropy, reveals, clutter density) — **do not** swap the hero style to dark integrated sink / stainless backsplash.

**Bans:** purple AI look, glossy plastic wood, visible tiling, cloned identical doors, empty bare counters, pitch-black metal from high metalness.

---

## 4. Known pitfalls (do not regress)

Already fixed in kitchen path — keep:

1. **`CanvasTexture` on WebGPU → black materials.** Use **`DataTexture`** (`src/kitchen/gpu/MaterialBake.ts`).
2. **`RectAreaLight` + WebGL UniformsLib → black on WebGPU.** Use **PointLight** window fill (`src/kitchen/render/Lighting.ts`).
3. **High metalness without IBL → black steel.** Keep brushed metalness ~**0.25–0.35** (current steel ~0.28).
4. Terrain under kitchen: pad flatten + displacement gate already exist — **do not reopen** unless floor breakout returns.

Kitchen sink ablation key is `?ablate=sinkwater` (not outdoor `water`).

---

## 5. Current quality (baseline)

| Layer | Today |
|-------|--------|
| Textures | Canvas→DataTexture @ **512**; wood/stone/tile normals; metal/wall albedo+rough only |
| Materials | Classic **`MeshStandardMaterial` only** — no kitchen Node/Physical |
| Cabinets | Flat inset door slabs, box handles, simple toe kick |
| Appliances | Stacked boxes fridge/range; faucet = 3 cylinders; lathe sink basin |
| Clutter | bowl / board / jar / plant only |
| Lighting | Cool hemi + warm practicals; PointLight window fill |

---

## 6. Implementation phases (do in order)

### Phase A1 — Materials (cabinet wood + brick)

Files: `src/kitchen/gpu/MaterialBake.ts`, `src/kitchen/render/Materials.ts`, `src/kitchen/render/Lighting.ts`

1. Steal BarkSynth / NoiseBake method: **macro tint → meso vertical grain/pores → micro roughness**; pack **cavity AO** (`aoMap` or packed channel).
2. Raise bake size **512 → 1024** for wood/stone (boot must stay acceptable).
3. Match warm medium oak + satin (roughness ~0.55–0.75); drive UV/offset from existing per-unit `hueShift` / `wear` so doors don’t clone.
4. Brick/backsplash bake: cream/tan brick + mortar relief + tonal variation (hero), not uniform floor-tile language on the splash.
5. Strengthen cool window vs warm under-cab split (still no RectAreaLight).

Stay on **`MeshStandardMaterial`** for A1 unless a quick Physical spike is clearly better and stable on WebGPU. If Physical: dial `specularIntensity` down (LAAS veg lesson); keep metalness moderate.

### Phase A2 — Stone / metal / ceramic

Files: MaterialBake, Materials, `src/kitchen/geo/Appliances.ts` (mat assignment)

1. **Counters:** near-black polished stone, soft veins, high sharpness on practical highlights; readable without HDRI.
2. **Sink:** white ceramic farmhouse (hero continuity).
3. **Fridge:** horizontal brushed steel, soft stretch highlights (stretched UV/normal bake, or node anisotropy only if WebGPU-stable). Metalness ~0.25–0.35.
4. **Faucet:** brass/bronze satin (hero), not chrome blob.
5. Keep optional procedural env (`src/kitchen/render/Environment.ts`) as soft IBL fallback — never “fix” black metal by raising metalness.

### Phase C — Geometry density

Files: `src/kitchen/geo/Cabinets.ts`, `Appliances.ts`, `Clutter.ts`, `Room.ts`, `src/kitchen/layout/generateLayout.ts`

1. **Doors:** raised/shaker panels (stiles/rails + recessed or raised center), ~2–3 mm reveals, toe-kick depth, simple crown/light rail on wall cabs.
2. **Sink:** farmhouse apron front + bridge faucet silhouette (gooseneck + cross handles).
3. **Fridge:** French doors + two freezer drawers, vertical handles, dispenser niche with soft internal darkening (geo recess + cavity).
4. **Clutter:** expand kinds — board + lemons/bowl, utensil crock, soap bottles by sink, pitcher/greenery on island (styled density of kitchen-render, not empty).
5. Soft contact: real geometry gaps first so outdoor GTAO + kitchen discs read; upgrade discs only if still empty after geo.

### Phase verify (LAAS DELTA loop)

1. Lock **3 cameras** via **P** (`?cam=`):
   - Hero wide (inside room, across runs / toward glass or main elevation)
   - Sink 3/4 close-up
   - Fridge front
2. Screenshot `?scene=kitchen&seed=42&freeze=1` (+ each cam) → e.g. `shots/kitchen-quality/`.
3. Write **`docs/KITCHEN-DELTA.md`**: top-10 gaps vs the three refs (ranked).
4. Fix top 3; re-shoot; update DELTA (strike fixed).
5. Append short pitfalls to `docs/KITCHEN-PAD.md` or new `docs/KITCHEN-DESIGN.md` (DataTexture, metalness, farmhouse-vs-counter-sink style lock).

---

## 7. Quick reference — files to edit

```text
src/kitchen/gpu/MaterialBake.ts      # DataTexture bake — upgrade layers / res
src/kitchen/render/Materials.ts      # roughness/metalness/aoMap/normalScale
src/kitchen/render/Lighting.ts       # cool/warm split; no RectAreaLight
src/kitchen/render/Post.ts           # contact discs (secondary)
src/kitchen/render/Environment.ts    # soft IBL fallback only
src/kitchen/geo/Cabinets.ts          # shaker panels, crown, reveals
src/kitchen/geo/Appliances.ts        # farmhouse sink, bridge faucet, French fridge
src/kitchen/geo/Clutter.ts           # denser prop set
src/kitchen/geo/Room.ts              # only if window trim / splash framing needed
src/kitchen/layout/generateLayout.ts # clutter placement kinds
src/kitchen/buildKitchen.ts          # assembly; bake size call site
```

Steal-from (read, don’t port outdoor systems):

```text
src/gpu/passes/BarkSynth.ts
src/gpu/passes/NoiseBake.ts
src/render/VegMaterials.ts
docs/DELTA.md
```

---

## 8. Acceptance criteria

- [ ] Side-by-side: oak cabinets read as same family as `kitchen-render.png` (grain + shaker panels, not flat boxes)
- [ ] Sink/counter close-up: farmhouse + brass silhouette, material separation, visible AO in reveals
- [ ] Fridge reads brushed steel with reveals/dispenser, not a gray/black monolith
- [ ] No black-material regression; no external textures/meshes; DataTexture + no RectAreaLight preserved
- [ ] `docs/KITCHEN-DELTA.md` exists with ranked gaps and what was fixed
- [ ] Works at `?scene=kitchen&seed=42&freeze=1`

---

## 9. Out of scope

- Outdoor pad / WORLD_SIZE / scatter / GroundRing / glass-wall layout rules
- Full indoor GTAO/TRAA rewrite (rely on existing outdoor PostStack first)
- Interactive CAD from kitchen-designer R3F tool
- Keeping `procedural-kitchen` bit-identical
- Bidding/pricing text

---

## 10. One-sentence summary

**In LAAS `src/kitchen`, upgrade procedural materials (macro–meso–micro oak/brick/stone/brushed steel) then geometry density (shaker cabinets, farmhouse sink, French-door fridge, styled clutter) to match the three locked refs, verify with a DELTA shoot loop — without touching outdoor mounting.**
