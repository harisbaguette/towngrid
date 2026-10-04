# Asset credits

The 51 UI, action, event, transport, animal and ambience sounds listed in `audio/presentation-sounds.json` are original procedural synthesis. Rebuild the OGG/MP3 pairs with `scripts/build-presentation-audio.py`; they contain no third-party recordings.

`pixel-environment/solarpanel`, `chocolatier`, `packshop`, `sheeppen`, `milkbarn`, `duckhouse`, `farmSheep`, `farmCow`, `farmDuck`, `farmBee`, and the wool/wax resource cutouts use OpenAI image generation with this project's pixel artwork as references. Sources and packing instructions are in `art-source/pixel-environment/farm-v11/`. Animal poses are generated sprite frames; travel paths and animation playback are code-driven.

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

The 51 active TownGrid compositions and their individual authors, source links, licenses and modifications are listed in [audio/LICENSE.txt](audio/LICENSE.txt) and `audio/music-sources.json`. The game also displays these credits in Settings → Asset credits. Runtime music uses two-pass normalization to −20 LUFS and −2 dBTP, OGG/MP3 conversion and playback crossfades. Original audio and manifests are in `art-source/audio/bright-town/` and `art-source/audio/world-score/`.

Additional syncopika compositions: [happy tune](https://opengameart.org/content/happy-tune), [happy bgm 090719](https://opengameart.org/content/happy-bgm-090719), [step step step](https://opengameart.org/content/step-step-step-happy-piano-bgm), [fun bgm 022824](https://opengameart.org/content/fun-bgm-022824) under CC BY 3.0, and [adventure bgm idea](https://opengameart.org/content/adventure-bgm-idea) under CC BY 4.0. Juhani Junkala / SubspaceAudio JRPG and Sparklin Labs / Pixel-boy Superpowers selections use CC0 1.0. The silent tail of `score-biome-marsh` is trimmed at 67.3 seconds. Recover originals with `python scripts/fetch-world-score.py`; rebuild with `python scripts/pack-town-music.py`.

**Forest Ambience** by TinyWorlds is a CC0 environment recording. The archived **calm theme** by pebonius, **Town 3** by Alex McCulloch, and **A New Town** by cynicmusic are no longer in the playlist. Their original credits and per-file sources remain in `audio/music-sources.json`. Generated tones remain as loading fallbacks and action accents. No source user-interface artwork was redistributed; the supplied reference's palette, ribbons and cards were implemented as CSS components.

## World terrain illustration (2026-09-26)
`world/irdea-terrain.webp`: generated for ERDYNTH with OpenAI image generation, informed by user-provided visual references. Decorative terrain under the exact interactive country geometry; no text or baked UI. Not drawn since the 2026-09-28 grid map redesign; kept for the art archive.

Rounded canopy geometry and rounded roof tile skins were authored in this project where a matching reusable source was unavailable. These legacy geometry assets are archived; the current game uses pixel artwork and no longer loads GLB models.


## Original residents and rounded props — 2026-09-26

`erdynth/Resident_*.glb` (18 appearances), `Tugboat.glb`, `PatrolBoat.glb`, `Lighthouse.glb`, `Pickaxe.glb`, `Axe.glb`, `Hammer.glb`, `Lantern.glb` and `Bucket.glb` are original project-authored geometry and materials. Editable source: `scripts/build-erdynth-assets.mjs`. The supplied images guided shape, colour and proportions; the image files are not redistributed. Each resident includes original articulated Idle, Walk, Walk_Carry and Work clips. The centaurs now have a standalone original quadruped body and gait. No KayKit mesh, texture or animation is used in the shipped residents.

The character/centaur/titan and original GLB entries above are historical. Their source files remain as an archive; current residents and enemies use `pixel-characters/`. External archived architecture, vehicles and creatures, and the sounds still used by the game, remain separately credited above. `erdynth/manifest.json` lists the original archived inventory and mesh sizes.


## TownGrid completion artwork (2026-09-28)

`pixel-environment/cargoWagon`, `cargoRaft`, `cargoSteamer`, `cargoShip`, `cargoFerry`, `cargoSled`, `cargoPlane`, `cargoAirship`, `cargoTruckEmpty`, `cargoTrainEmpty` and `supportArt`: created with OpenAI image generation for this project. Four-view sources and extraction coordinates are preserved under `art-source/pixel-environment/completion-v8/` and `pack-manifest.json`. `resourceGoods` and `resources/*.png` reuse the project’s authored resource cutouts and the new service icons; `src/app/game/resource-art.js` records each source.

The `*Motion`, `*Body` and `*Hoist` atlases added on 2026-09-29 reuse those vehicle pixels and the existing port illustrations. They are scripted component animation/extraction, not new generated or hand-drawn frame sequences. Editable coordinates and the baker are `art-source/pixel-environment/motion-v10/rig.json` and `scripts/pack-environment-motion.mjs`.


## TownGrid pixel screen refresh (2026-09-29)

`screens/pixel-v2/*.webp`: nine illustrations created with OpenAI image generation using the project’s prior screen concepts as references. Source PNGs, prompts and reference paths are preserved in `art-source/screen-concepts/2026-09-29/pixel-refresh/manifest.json`. The approved brand artwork is reused separately. Earlier screen images remain archived and are not in the runtime screen deck.

`screens/daily-v3/*.webp`: eighteen additional daily scenes and four screen-transition illustrations created with OpenAI image generation. Daily scenes reference the existing TownGrid character portraits and pixel screen artwork; character IDs, reference paths, prompts and original PNGs are preserved in `art-source/screen-concepts/2026-09-29/daily-expansion/manifest.json`. Files ending in `-thumb.webp` are reduced gallery previews of the same artwork.

## TownGrid world atlas (2026-09-29)

`world-atlas/*.png`: sixteen pixel terrain and settlement sprites created with OpenAI image generation for TownGrid. Original sheets and packing metadata are preserved under `art-source/world-atlas/`. `world-atlas/terrain.webp` combines those sprites with project-authored ground, shore and river rendering based on the actual world grid. Rebuild with `node scripts/pack-world-atlas.mjs`.
