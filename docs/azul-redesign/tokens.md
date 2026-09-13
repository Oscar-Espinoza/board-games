# Azul Table Light: materials and geometry

`games/azul/src/palette.ts` owns the existing tile glaze/motif pairs. Table tiles, body-level flight tiles and guide artwork share it. `Tile.svelte` retains `class="tile {color}"` and gives the first-player marker its separate circular shape. The score marker is square. The catalog cover intentionally keeps its lighter palette and imports no game presentation.

| Tile                | Glaze   | Motif   |
| ------------------- | ------- | ------- |
| Blue                | #1766a0 | #c9e5f4 |
| Yellow              | #edb737 | #7d5015 |
| Red                 | #ae4235 | #ffddbb |
| Black               | #24313b | #d6b893 |
| White               | #faf2da | #368c9e |
| First-player marker | #f5e8c9 | #15364c |

`tokens.css` scopes surfaces and typography to `.azul-table`. Walnut ranges from #6d4b2c to #1c1208 with a warm translucent lamp and fine grain. Printed boards range from #fdf7e8 to #eddfc2; discs from #fdf5e2 to #dbc79c. Tiles have top-light relief, original SVG motifs and cast shadows. Empty wall printing uses a 23% glaze mix with the cream board.

Functional board ink is #293c40, with secondary ink #514c40. Table ink is #fff4dc, with secondary ink #f0dfbd. These replace the proposed low-contrast soft tokens. Verify the composited lightest wood and darkest board surfaces against the [4.5:1 normal-text requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); decorative print is not functional text.

Marcellus regular and Karla variable are self-hosted WOFF2 fonts under `apps/web/static/fonts/azul/`, with full upstream glyph coverage, including English and Spanish. Their OFL licences and provenance live alongside them. Table usage is scoped, with Georgia and Arial fallbacks and `font-display: swap`. Font loading that changes geometry settles presentation before new measurements.

Full board tile sizes derive from component width through container units, capped at 34px; playable rows remain 44px. Compact geometry independently scales every row and floor slot. Ring dimensions and deterministic scattering are defined in `geometry.ts`, shared with geometry tests. See [mobile](mobile.md) for dimensions and breakpoint composition.

The conservative composited wood upper bound is RGB (123.09, 89.68, 57.52),
including the lamp and white grain. Main/secondary table text contrast is
5.73:1 / 4.77:1; against the darkest board it is 8.78:1 / 6.48:1.
Score-rail ticks occur every five points, with numerals every twenty to leave
room for doubled text sizes.
