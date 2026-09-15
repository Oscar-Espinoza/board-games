# Azul Rich & Dramatic: materials and geometry

`games/azul/src/palette.ts` owns the tile glaze/motif pairs and optimized artwork URLs. Table tiles and body-level flight tiles share the same generated transparent WebPs. `Tile.svelte` retains `class="tile {color}"`, labels and anchors; the first-player marker keeps its separate circular HTML/SVG treatment. The catalog cover remains independent.

| Tile                | Glaze   | Motif   |
| ------------------- | ------- | ------- |
| Blue                | #1766a0 | #c9e5f4 |
| Yellow              | #edb737 | #7d5015 |
| Red                 | #ae4235 | #ffddbb |
| Black               | #24313b | #d6b893 |
| White               | #faf2da | #368c9e |
| First-player marker | #f5e8c9 | #15364c |

`tokens.css` scopes typography, functional colors and fallbacks to `.azul-table`. The physical appearance comes primarily from generated raster assets: dark navy woven textile, coherent upper-left light, glazed ceramic tiles, blue/cream factory plates, printed board stock, aged brass rails and transparent edge props. Runtime CSS supplies placement, contact shadows, focus/selection states and lighting integration rather than synthesizing those materials.

Functional text remains independently contrast-checked against its composited substrate; decorative printing is not functional text. Focus and selected-state outlines use the subdued brass/blue palette but cannot depend on color alone.

Marcellus regular and Karla variable are self-hosted WOFF2 fonts under `apps/web/static/fonts/azul/`, with full upstream glyph coverage, including English and Spanish. Their OFL licences and provenance live alongside them. Table usage is scoped, with Georgia and Arial fallbacks and `font-display: swap`. Font loading that changes geometry settles presentation before new measurements.

High-resolution generation sources live under `games/azul/assets/rich/source/`;
optimized browser copies live under `apps/web/static/games/azul/rich/`. Browser
assets retain at least high-DPI resolution at their rendered size. Full board
tiles cap at 34px and playable rows remain 44px. Compact board geometry scales
independently. `geometry.ts` owns the ring and deterministic centre scattering;
the score rail prints ten-point numerals with an exact dynamic marker.
