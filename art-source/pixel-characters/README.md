# TownGrid pixel characters

Original character illustrations and sprite artwork generated for TownGrid on
2026-09-26. The supplied character images were style references; these sheets
depict TownGrid's existing named residents and six opposing race identities.

## Current runtime (2026-09-28)

All 51 identities now use 8192×512 atlases with 256 cells and a four-second
breathing portrait. Mira keeps `prototypes/mira-v3/`; the previous 23 identities
use [roster-v4](roster-v4/README.md), and 27 added professionals use
[professions-v5](professions-v5/README.md). The master manifest dispatches to each rig.
Humans use Mira, dwarves Bron, and titans Taron as their general workforce.
Other residents are reused as automatic facility staff. Vera is now a human
medical/research specialist. The legacy artwork and extraction specifications
below remain archived; the 32-cell descriptions are no longer the runtime.

## Original roster (the 27 additions are listed in professions-v5/cast.json)

| Group | Identities |
| --- | --- |
| Human | Mira, Rowan, Hana, Ethan, Vera |
| Dwarf | Marna, Bron |
| Titan | Taron |
| Elf | Silen, Ael, Lien, Elion |
| Spirit | Dew, Mist |
| Centaur | Lana, Kai |
| Fae | Fia, Eil |
| Opposing races | Ravik, Grum, Niki, Sora, Kael, Neris |

The existing human and elf alliances, resident identities, economic traits and
saved game data are retained. Gender has no statistical effect.

## Rebuild

Run from the project root with Python, Pillow, NumPy and SciPy installed:

```bash
python scripts/pack-pixel-characters.py art-source/pixel-characters/pack-manifest.json
node scripts/check-pixel-characters.mjs
```

The packer isolates figures through their authored alpha, selects the matching
poses, applies supplied correction strips, crops and scales with nearest-neighbor
sampling, then records a foot anchor for each cell. It does not paint characters.
Keep the originals and manifest together so the extraction is reproducible.

## Legacy format (retained sources)

Each `public/assets/pixel-characters/<id>/` directory contains:

- `portrait.png`: transparent character illustration.
- `sprites.png`: 1024×512 RGBA atlas, 128×128 cells, 32 cells.
- `frames.json`: direction order, columns and per-frame foot anchors.
- `walk-preview.gif`: four-direction walking preview from the runtime atlas.

Rows: SW, NW, NE, SE (front-left, back-left, back-right, front-right).

The 2026-09-27 user decision replaces free camera rotation with four diagonal
views at 90-degree intervals and fixed elevation. The 24 runtime atlases retain
only these four rows. The legacy eight-direction originals, prompts and source
corrections are preserved. The packer applies those corrections before extracting
diagonals, so authored pixels, sprite scale and anchors do not change.
New four-direction source sheets can declare `"directions": ["SW", "NW", "NE", "SE"]`
in their manifest entry; omitted directions describe legacy eight-row sources.
Runtime addressing reads row count/order from `frames.json`, including legacy
eight-row sheets, but always presents the four diagonal facings.

Columns: idle, left step, passing step, right step, carry left, carry right,
work windup, work contact. The walking sequence repeats the passing pose between
the two strides. Carrying uses two poses. Work and attack playback use the same
windup/contact columns; pickup and drop sequence existing poses. Defeat uses a
rotation and fade, not a separately drawn death animation.

Both the WebGL and CPU renderer use the same atlas, action selection and foot
anchors. The facing direction is relative to camera azimuth, so rotating the map
changes the visible character side. UI previews use CSS steps and respect reduced
motion. The resident panel offers direction and action controls.

These are generated pixel-style originals, not hand-cleaned production animation
cels. Some diagonal poses and outlines still vary slightly between action frames.
The fourth supplied action reference was a single-frame PNG; these animation
sequences are newly authored interpretations, not a copy of an unavailable GIF.
