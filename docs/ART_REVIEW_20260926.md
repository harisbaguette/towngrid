# ERDYNTH — reference-driven art revision

## Corrections applied

- Restored and visually reviewed the 14 supplied asset references and both blue travel-journal UI references before editing.
- Replaced the flat political-colour map surface with one illustrated continent, inland sea, rivers, woodland, mountains and settlements. The existing keyboard-accessible 30-country selection, faction grouping, sites and trade-route overlays remain interactive.
- Increased default world scale by about 40% on desktop. Camera pan, continuous rotation and zoom remain available.
- Removed the blanket facility-name overlay by default. A hovered/selected facility receives a compact name and progress indicator; the toolbar can still display all labels.
- Added layered rounded grass/earth tiles, quieter variation in grass colour, warm road surfaces and deeper riverbanks. Fixed the CPU layer order so earth does not cover grass.
- Kept imported licensed walls, framing, factory machinery, vehicles, characters and authored animation clips. Added rounded roof tile skins and rounded canopy forms for the missing reference style, and framed production machinery with floors and workshop shells.
- Enlarged the visible horse and moved it toward the stable opening. Rounded canopy forms and the roof system use consistent warm/cool palettes.
- Improved CPU rendering with softer contact shadows, lighter diffuse shading, rounded terrain corners, grass sway and correct terrain elevation; the same scene still supports WebGL.
- Reduced the desktop build tray height and retained the supplied reference's blue paper surfaces, cream tabs, ribbon headers and model cards.

## Verified in the running game

- World atlas loads and opens the selected nation's industrial-city demonstration.
- Camera rotates and resets; facility labels toggle and selecting a stable opens its inputs, output, health and specialty controls.
- Constructed a wheat field on an empty 1×1 tile. The preview reported 90% surrounding efficiency from shade, and the built facility retained the same placement effects and requested water.
- Existing industry advanced through game days and produced cars (12 → 15 observed); inventories and sale income updated.
- 25/25 audio samples decoded. AudioContext running; measured nonzero output RMS 0.01525 after the effects check.
- 390×844 phone layout rendered without page-width overflow; building palette and camera controls remained inside the viewport.
- TypeScript check, animated Horse/Robot/Titan pose checks, ten quality scenario groups, and the placement/storage/world overhaul tests passed.

## Scope

This is a visual and usability revision to the playable prototype. It does not replace the established economy, 33 ranks, debt/family goals, site expansion, industry tree, independence, raids or successor-state simulation. It is not a claim that a final release art pass or hardware performance certification is complete.
