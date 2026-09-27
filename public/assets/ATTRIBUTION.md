# Asset credits

All third-party assets included here are CC0 (public domain dedication).

- Kenney, **Fantasy Town Kit** (2.0): https://kenney.nl/assets/fantasy-town-kit . Original GLB modules, trees, rocks, carts, banners, lanterns and windmill parts. Source archive includes `town/LICENSE.txt`. Architecture is assembled from these modules; race palettes and layouts are project modifications.
- Quaternius, **Ultimate Animated Character Pack** (November 2019): https://opengameart.org/content/animated-characters-pack . Thirteen original rigged character models converted from FBX to GLB; Idle, Walk, Walk_Carry, PickUp and Victory clips retained. Body proportions, colours and missing fantasy accessories are project modifications. Original CC0 declaration: https://creativecommons.org/publicdomain/zero/1.0/ . The base pack contains humans, an elf, goblins, vikings, a wizard, and a witch. The dwarf, orc, demon and beastfolk are adaptations, not separately purchased race packs.
- Kenney, **RPG Audio**: https://kenney.nl/assets/rpg-audio . Original Ogg effects. Source archive includes `audio/LICENSE.txt`.

The production machinery and functional props not provided by these packs, fantasy political map, race accessories, synthesized music, weather, water and bird sounds were authored for this prototype. Third-party assets were retrieved September 24, 2026. No Town Star artwork, game code or audio is included.

## Modern industry and vehicles
Kenney City Kit Industrial 2.0: https://kenney.nl/assets/city-kit-industrial
Kenney Car Kit 3.1: https://kenney.nl/assets/car-kit
Both packs are CC0. Factory motion, production equipment and race attachments are project adaptations.

Kenney Train Kit 1.1: https://kenney.nl/assets/train-kit — CC0.

Quaternius Textured Cute Monster Pack: https://opengameart.org/content/textured-cute-monster-pack — CC0. Ghost and Demon rigs, textures and animations converted from FBX to GLB.
Titan uses the licensed StoneTitan rig listed below. Centaur combines a licensed humanoid rig with the project horse body; not a dedicated authored centaur rig.

## Quality pass — animated creatures (2026-09-24)

- **StoneTitan.glb**: Shyr, [Stan — The Golem](https://shyr-games.itch.io/stan-the-golem), CC0. Free original FBX converted to GLB with its texture and idle/walk/attack/hit/death clips. Used as a stone-born titan variation.
- **Wolf.glb / Fox.glb**: Quaternius, [Ultimate Animated Animals](https://quaternius.com/packs/ultimateanimatedanimals.html), CC0. Official glTF repackaged to GLB. Idle/walk/attack/hit/death.
- **Dragon.glb / Bat.glb**: Quaternius, [LowPoly Animated Monsters](https://opengameart.org/content/lowpoly-animated-monsters), CC0. Flying, attack, hit and death. Flying supplies locomotion aliases.
- **MantaRay.glb**: Quaternius, [Animated Fish](https://opengameart.org/content/animated-fish), CC0. Swimming only; floating magical creature locomotion. No authored attack or death animation.

License records are in `characters/LICENSE-*.txt`. The centaur still uses the project's custom horse body and an adapted licensed human rig. It is not a downloaded standalone centaur. No paid or unlicensed replacement was used.

## 2026-09-25 release hardening

- Kenney RPG Audio MP3 copies are transcodes of the bundled CC0 OGG clips, provided as a decode fallback.
- Centaur: custom horse lower body, harness and courier satchels, joined to the licensed Quaternius humanoid upper-body rig. Four-leg gait is project-authored. It is not a downloaded dedicated centaur model. Free candidates with usable animation and a web-compatible distribution license could not be fully acquired and verified.

## 2026-09-26 expansion

24 additional imported GLBs are listed in `refresh-manifest.json`, with creator sources, hashes, animation clips and CC0 licenses in `REFRESH_CREDITS.md` / `licenses/`. The files include Kenney Factory, Commercial, Watercraft and Train assets; Quaternius Farm Buildings, Horse and Robot. Hospital and bank use adapted commercial storefronts with project role indicators.

Background music is **calm theme** by pebonius; ambient music is **Forest Ambience** by TinyWorlds. Both creator-posted CC0 sources are listed in `audio/music-sources.json`. Original audio remains unchanged; extra MP3/OGG counterparts are codec transcodes. Music crossfades at replay. Generated tones remain as loading fallbacks and action accents. No source user-interface artwork was redistributed; the supplied reference's palette, ribbons and cards were implemented as CSS components.

## World terrain illustration (2026-09-26)
`world/irdea-terrain.webp`: generated for ERDYNTH with OpenAI image generation, informed by user-provided visual references. Decorative terrain under the exact interactive country geometry; no text or baked UI.

Rounded canopy geometry and rounded roof tile skins were authored in this project where a matching reusable source was unavailable. Existing licensed walls, framing, characters, machinery, vehicles, and authored movement clips remain in use.


## Original residents and rounded props — 2026-09-26

`erdynth/Resident_*.glb` (18 appearances), `Tugboat.glb`, `PatrolBoat.glb`, `Lighthouse.glb`, `Pickaxe.glb`, `Axe.glb`, `Hammer.glb`, `Lantern.glb` and `Bucket.glb` are original project-authored geometry and materials. Editable source: `scripts/build-erdynth-assets.mjs`. The supplied images guided shape, colour and proportions; the image files are not redistributed. Each resident includes original articulated Idle, Walk, Walk_Carry and Work clips. The centaurs now have a standalone original quadruped body and gait. No KayKit mesh, texture or animation is used in the shipped residents.

The earlier playable character/centaur/titan entries above are historical. Their source files remain for save-independent legacy and enemy assets, but all playable residents now use `erdynth/Resident_*.glb`. Existing external architecture, vehicles, creatures and sounds remain separately credited above. `erdynth/manifest.json` lists the exact original asset inventory and mesh sizes.
