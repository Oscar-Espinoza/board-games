# Catan artwork provenance

No commercial card faces, rulebook artwork, stock textures, external models or
recorded audio are distributed. The pre-redesign SVG terrain, development faces,
procedural ocean and their generator were removed once the physical-table
migration replaced every runtime use; they remain recoverable from Git history.

The game is an unofficial implementation. Its name identifies the game; the
original rule references are preserved in the source snapshot recorded in
[the migration decision](../adr/009-typescript-catalog.md).

The board SVG owns number tokens, roads, buildings, robber, ports and legal
placement targets. Resource-card faces and harbor icons use the generated local
resource illustrations. Dice faces are CSS pips; landing audio is synthesized
locally with Web Audio bass oscillators and filtered noise. No external assets or
services are required during play.

## Physical tabletop migration — September 15, 2026

[ADR 022](../adr/022-catan-physical-table.md) replaces those presentation materials
in the real board. New images were generated with the built-in image-generation
tool using the user-supplied `catan-new-ui.png` as the visual reference. They are
original generated materials, not commercial card scans. All selected assets
live in `games/catan/assets/` and are bundled by Vite only with Catan.

| Assets                                            | Purpose                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `tabletop-ocean.webp`                             | Empty decorative ocean/wood/foliage/map/compass/ship environment; no game state or UI                |
| `table-wood.webp`                                 | Small repeating wood material used for controls                                                      |
| `painted-{wood,wool,wheat,brick,ore,desert}.webp` | Six individual 384px terrain paintings clipped to actual SVG hexes                                   |
| `resource-{wood,wool,wheat,brick,ore}.webp`       | Transparent 192px illustrations reused in cards, trade and costs                                     |
| `development-compass.webp`                        | Transparent 192px compass illustration for development stacks; actual private card names remain HTML |

The two 3×2 source atlases were mechanically split into equal cells and encoded
with `cwebp`; resource alpha is preserved. Runtime WebPs were right-sized and
re-encoded after visual comparison. Original generated PNGs remain outside the
repository; runtime assets never depend on those paths.

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
