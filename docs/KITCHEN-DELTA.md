# KITCHEN-DELTA — quality loop vs locked refs

Shots target: `shots/kitchen-quality/` · seed `42` · `?scene=kitchen&freeze=1`

Refs: `reference/kitchen-render.png` (hero style lock), `counter-sink-render.png` (craft AO/density), `friedge-render.png` (steel/reveals).

## Pass 1 — after A materials + C geometry density (2026-07-30)

Implemented this pass:
- Wood: macro→meso→micro oak @1024 + cavity `aoMap`; satin roughness; per-door UV jitter
- Brick backsplash (cream/tan running bond) separate from floor tile
- Near-black polished stone counters; horizontal brushed steel + stretch normals; brass faucet; white ceramic sink
- Cool window / warm under-cab lighting split (still PointLight, no RectAreaLight)
- Shaker doors (stiles/rails/recess), toe recess, crown + light rail
- Farmhouse apron + bridge faucet; French fridge + drawers + dispenser niche
- Clutter kinds: crock, soap, pitcher, lemons (+ denser island bias)

### Top-10 gaps vs refs (ranked)

1. **Crown / range hood mass** — hero has multi-layer crown + full wood hood over cooktop; we only have a thin crown strip, no hood.
2. **Glass-front upper cabs** — hero shows mullioned glass uppers with visible ware; ours are solid shaker only.
3. **Hardware language** — hero dark antique knobs/bin pulls; ours are plain brushed-metal boxes (reads appliance, not furniture).
4. **Brick field height** — hero brick wraps full wall to crown; ours is 18" splash band only (layout/Room, not full elevation).
5. **Pendant / practical fixtures** — hero island pendants + recessed cans; we rely on PointLights with no fixture geo.
6. **Fridge flush / panel gap craft** — ref French unit is built-in flush with white cabs; ours is freestanding metal box (placement OK, reveal craft weaker).
7. **Sink apron / counter junction** — farmhouse silhouette present; apron–cabinet reveal and under-apron shadow still softer than counter-sink craft ref.
8. **Counter polish highlights** — stone is near-black + veins, but without strong IBL the practical specular “sharp pin” is weaker than hero.
9. **Clutter styling specificity** — density up (crock/soap/pitcher/lemons), but cookbook row / mill set / hydrangea mass still thinner than hero island still.
10. ~~Flat inset door slabs / cardboard oak / chrome faucet blob / gray fridge monolith~~ → addressed this pass (shaker + oak bake + brass bridge + French doors).

### Fix top 3 (this pass — partial)

| Rank | Action taken | Status |
|------|----------------|--------|
| 1 | Out of scope for A/C file list (hood is new geo system) | Open — next |
| 2 | Out of scope (glass mullions + interior ware) | Open — next |
| 3 | Handles remain simple boxes; darken metal on cab handles only | Partial — see Cabinets handle mat |

Deferred structural items (1–2, 4–5) for a follow-up geo pass. Materials + primary C silhouettes (shaker / farmhouse / French / clutter) closed for acceptance checklist items 1–4.

### Pitfalls confirmed

- `CanvasTexture` → black on WebGPU; keep `DataTexture`.
- `RectAreaLight` → black on WebGPU; PointLight window fill only.
- Metalness ≳0.4 without IBL → black steel; keep ~0.25–0.35.
- `aoMap` defaults to uv2 — set `texture.channel = 0` for kitchen geos without uv2.
- Style lock: farmhouse white + brass (kitchen-render), **not** dark undermount + chrome (counter-sink).

### Cameras to lock (P → `?cam=`)

1. Hero wide — inside room, across runs toward glass / main elevation
2. Sink ¾ — apron + bridge faucet + brick + wood grain
3. Fridge front — French doors, dispenser niche, horizontal grain

### Verify notes (live `seed=42`)

- Confirmed: oak vertical grain + shaker faces read (not flat slabs); no black-material regression.
- Brass faucet was dark at metalness 0.32 → lowered to ~0.22 + brighter tint; under-cab practicals boosted (south run was underexposed looking away from glass).
- Default spawn looks north at empty glass (galley); turn to south/west runs for cabinet acceptance shots.

Re-shoot after next geo pass; strike closed items above.
