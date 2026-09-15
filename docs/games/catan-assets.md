# Catan artwork provenance

The original SVG illustrations, authored for this repository on September 7,
2026, are preserved in `games/catan/assets/`. No commercial card faces, rulebook
artwork, stock textures, external models or recorded audio are distributed.

`games/catan/assets/draw.py` is the deterministic authoring source for six
terrain paintings and five development faces. Its art-only seeds never consume game randomness. Run it from the assets
directory when regenerating the original artwork.

The original Svelte board imported individual terrain SVGs through Vite. They were
content-hashed and requested only after Catan is selected. The board's SVG owns
number tokens, roads, buildings, robber, ports and legal placement targets.
Unused terrain variants, portraits, resource icons and the old GPU atlas were
removed along with their generator branches. Historical artwork remains in Git
history; the maintained generator emits only artwork used by the current board.

The game is an unofficial implementation. Its name identifies the game; the
original rule references are preserved in the source snapshot recorded in
[the migration decision](../adr/009-typescript-catalog.md).

The second island UI adds original SVG resource illustrations in
`games/catan/src/ResourceArt.svelte`, a procedural water texture in
`games/catan/assets/ocean.svg`, shaded pieces and an illustrated hooded robber.
Resource-card faces reuse the repository's terrain art behind those illustrations;
they are not scans of commercially printed cards. Harbor icons use the same resource
illustrations. Dice faces are CSS pips; landing audio is synthesized locally with
Web Audio bass oscillators and filtered noise. No external assets or services are
required during play.

## Physical tabletop migration — September 15, 2026

[ADR 022](../adr/022-catan-physical-table.md) replaces those presentation materials
in the real board. New images were generated with the built-in image-generation
tool using the user-supplied `catan-new-ui.png` as the visual reference. They are
original generated materials, not commercial card scans. All selected assets
live in `games/catan/assets/` and are bundled by Vite only with Catan.

| Assets                                            | Purpose                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tabletop-ocean.webp`                             | Empty decorative ocean/wood/foliage/map/compass/ship environment; no game state or UI                    |
| `table-water.webp`, `table-wood.webp`             | Material samples from that environment; water sample retired after visual review, wood used for controls |
| `painted-{wood,wool,wheat,brick,ore,desert}.webp` | Six individual 512px terrain paintings clipped to actual SVG hexes                                       |
| `resource-{wood,wool,wheat,brick,ore}.webp`       | Transparent 256px illustrations reused in cards, trade and costs                                         |
| `development-compass.webp`                        | Transparent compass illustration for development stacks; actual private card names remain HTML           |

The two 3×2 source atlases were mechanically split into equal cells and encoded
with `cwebp`; resource alpha is preserved. The background is quality 88, terrain
quality 90, resource illustrations quality 88. Original generated PNGs remain
outside the repository; runtime assets never depend on those paths. Legacy SVG
authoring sources remain available for the catalog guide and provenance.

### Generation prompts

All calls used the supplied image as a style/composition reference and the built-in
tool, not the API/CLI fallback. The production prompt set was:

1. **Environment:** Generate the empty premium tabletop environment in 16:9:
   luminous rich blue ocean across the central 65%, weathered dark warm wooden
   planks along left/right edges and bottom, tropical leaves, thick hemp ropes,
   antique parchment maps, brass compass at lower left, rocky islets and surf,
   and a wooden sailing ship at middle right. Nearly directly overhead, richly
   detailed painted miniature diorama with warm light and contact shadows.
   Remove the entire board, terrain tiles, harbors, playing pieces, dice, cards,
   plaques, buttons and all text. Center is continuous water. Scenery stays within
   the outer 24%; bottom wood within the bottom 15%.
2. **Terrain atlas:** Exactly six equal square paintings in a 3×2 grid with no
   gaps, borders or text. Top row: dense broadleaf/fir woodland; light green
   meadow with tiny white sheep; golden wheat rows. Bottom row: terracotta clay
   quarry with stacked bricks; craggy charcoal-gray mountain ridges; golden sand
   dunes. Nearly top-down painted physical board materials and warm light. Fill
   each cell to its edges. No hex outlines, roads, buildings, tokens, numbers,
   harbors, water or interface; the app clips these paintings into real hexes.
3. **Resource atlas:** Transparent 3×2 grid of six isolated objects, centered in
   equal square cells with clear margins: cut bark-covered logs, a white sheep
   with dark face, a golden wheat sheaf; stacked terracotta bricks, gray metallic
   ore rocks, an antique gold compass medallion. Premium detailed painted physical
   miniatures, warm upper-left light, tiny grounding shadows, clear silhouettes.
   No text, numbers, card borders, landscapes or extra objects.
