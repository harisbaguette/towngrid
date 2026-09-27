# Original 3D asset pass — 2026-09-26

The user changed direction from sourcing free models to creating matching models directly. The acquired KayKit candidates are not included in this release.

## Delivered geometry

- 18 playable resident appearances across the existing two alliances: human, dwarf, titan, elf, spirit, centaur and fae. Human and elf alliances remain grouped as before.
- Female and male residents have separate identities, hair, clothing and portraits; spirits retain a neutral presentation. Gender changes no production or combat values.
- Original tugboat, patrol boat, lighthouse, pickaxe, axe, hammer, lantern and bucket. The user's four images guided rounded silhouettes and restrained colours. References themselves are not bundled.
- Editable, deterministic source: `scripts/build-erdynth-assets.mjs`. Runtime GLB inventory: `public/assets/erdynth/manifest.json`. All 26 assets total approximately 12.1 MB before transport compression.
- Four embedded clips per resident: Idle, Walk, Walk_Carry and Work. The game uses idle, walking and carrying; Work is included for future work-station animation. Centaur models have four independently animated legs.
- Resident portraits render the same model used on the map. Save migration assigns missing appearance/gender fields without replacing existing names or economic state.
- Boats bob in the harbor/river/coastal scenery. The lighthouse beam rotates. Tools and lanterns appear in the corresponding facility models. The industrial tour includes an active dock.

## Rendering fixes

- Replaced triangle painter ordering inside CPU-rendered model sprites with per-pixel depth. This removes holes and visible triangle seams where curved surfaces overlap.
- Interpolated vertex lighting preserves roundness in CPU mode; WebGL retains the original material and lighting path.
- Reduced authored geometry from 19.8 MB to 12.1 MB and bounded pose caching. Animation cache entries use actual clip phase and appearance identity.

## Checks

- `node tests/original-assets.mjs`: all 18 residents / 72 embedded clips / 8 props parse; animated limbs and carry motion are distinct; both alliances preserve identities across save/load; older saves acquire identities without changing names.
- `node tests/software-depth.mjs`: intersecting geometry resolves the nearest surface per pixel.
- `node tests/quality.mjs`: 10 existing gameplay/save/production scenario groups pass.
- `npx tsc --noEmit`: passes.
- Live browser: original resident portraits, both alliance families, ships, lighthouse and pickaxe inspected at enlarged scale; walking poses checked. Actual game map includes the original tugboat and residents. The 390×844 resident dialog keeps portraits and text in one readable column. Browser CPU-render timing was checked, but this pass does not certify a device-specific frame rate.

This is an asset and rendering update to the existing prototype. It does not establish a completed commercial release or replace every legacy building, enemy, vehicle and audio asset.
