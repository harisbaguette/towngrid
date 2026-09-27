# UI reference correction — 2026-09-26

The two user-provided sheets, `image(20260926-011420).png` and `image(20260926-011435).png`, are the visual authority for interface components.

## Applied components

- 011420: blue ribbon titles, gold progression fill, cream paper, spiral binding, circular navigation seals. Promotion progress now reflects the mean completion of the actual next-rank requirements.
- 011435: blue and cream awnings, folded paper category tabs, catalog cards with a name at the top and a coin-price strip at the bottom, framed facility cards.
- Construction catalog, facility information, modal menus, HUD, and world selection use the same component vocabulary.
- Removed numbered onboarding headings, repeated faction summary, and the facility-size subtitle. Existing nation policies, race membership, operations and production information remain accessible.
- Controls are live HTML with the existing Radix tabs, dialogs and switches. Keyboard handling and game logic are preserved. No screenshot is used as a clickable interface.
- Existing map artwork, models, animation, audio, simulation, and save data were not modified.

## Verification

- TypeScript check passed after the UI changes.
- Source whitespace check passed.
- The supervised preview reported running, but its approved browser address returned `net::ERR_BLOCKED_BY_CLIENT`. No alternative address or browser surface was used. New desktop/mobile rendering and interactions have therefore not been visually verified in this revision. Previous gameplay screenshots do not represent this UI revision.
- Production compilation is performed by the Sites publication workflow.
