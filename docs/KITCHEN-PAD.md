# Kitchen pad scene

Mounts the procedural kitchen from `procedural-kitchen` onto a flat cleared
pad inside LAAS. Outdoor systems stay LAAS-as-is (terrain, veg, sky, far-shell
mountains); only world size, pad flatten, and veg AABB gates change.

## Run

```bash
cd D:\Upwork\fable5-world-demo
npm install && npm run dev
```

Open (Chrome 113+ desktop, WebGPU):

```text
http://localhost:5173/?scene=kitchen&seed=42&freeze=1
```

Controls: click to capture, WASD move, V walk/fly, **P** copies `?cam=...`.

## Layout rules

- `WORLD_SIZE = 512` (near field `[-256,+256]²`). `FAR_RADIUS` unchanged so
  distant mountains still read through the glass.
- Height grids scale with the world (`HEIGHT_RES=512`, `SIM_RES=256` at high).
- Empty wall = **north** (`z=0`): no cabinet run; window ~70–85% of wall width,
  sill ~0.45 m, glass height ~2.0–2.2 m.
- Templates: **L** east+island · **U** east+south(+island) · **galley** south+west.
- Pad = kitchen footprint + 2 m margin, flattened to constant Y at origin;
  scatter + GroundRing reject samples inside the pad AABB.

## Ablations

Kitchen scene defaults to ablating outdoor `water,caustics,froxels,particles`
plus post `ao,taa` (GTAO + TRAA — noisy indoors). Append more via `?ablate=...`.
Restore: `?ablate=keepwater` · `keepao` · `keeptaa`. Sink water uses
`?ablate=sinkwater` (separate from outdoor water).

## Source map

| Path | Role |
|------|------|
| `src/kitchen/` | Copied procedural kitchen (layout/geo/gpu/render) |
| `src/world/KitchenPad.ts` | Flatten + AABB + transform |
| `src/debug/KitchenWorldScene.ts` | Scene glue |
| `src/world/WorldConst.ts` | 512 m world |
| `src/gpu/passes/Scatter.ts` | Pad exclude |
| `src/vegetation/GroundRing.ts` | Pad exclude (grass/debris) |

## Quality pitfalls (materials / geo)

- **DataTexture only** — `CanvasTexture` uploads black under WebGPU (`src/kitchen/gpu/MaterialBake.ts`).
- **No RectAreaLight** — WebGL UniformsLib path blacks MeshStandard on WebGPU; use PointLight window fill.
- **Metalness ~0.25–0.35** — high metalness without IBL reads pitch-black steel.
- **aoMap UV channel** — kitchen meshes lack uv2; set `aoMap.channel = 0`.
- **Style lock** — white ceramic farmhouse + brass bridge faucet (kitchen-render). Do not adopt counter-sink dark undermount / chrome as hero style; use that ref for craft AO/density only.
- Quality loop: `docs/KITCHEN-QUALITY.md` → `docs/KITCHEN-DELTA.md`.

