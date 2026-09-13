# Azul redesign mockups

**These are design mockups, not browser screenshots.** Nothing here was captured from the running application — the Azul table currently on `main` does not look like this. For actual captures of shipped behaviour see [Azul visual evidence](../../evidence/azul/README.md), which is the opposite kind of artefact and is labelled as such.

Rendered on 2026-09-13 from the Table Light artboards at 1:1, no scaling. Artwork is original CSS/SVG; the tile motifs are the ones already in `games/azul/src/Tile.svelte`. No publisher artwork is included.

- `table-light-desktop.webp`: 1440×900, three-seat table mid-round. Seven displays in a true circle, a loose centre pool, opponents as real boards, score tracks, the bag and box lid.
- `player-board.webp`: 1140×800, one board at full size with every region called out — score track, pattern lines, the printed arrow, the wall, the floor line and the first-player marker.
- `pieces.webp`: 1260×880, the five tile colours, both markers, the printed board surface and a factory display, shown in all three directions that were explored so the chosen material reads against the alternatives.
- `phone.webp`: 390×844, the same table at phone width.
- `moments.webp`: 1400×800, storyboard of the six beats worth animating, each labelled with the event that already drives it.

The three directions these came from are on a design canvas outside the repository. Table Light is the accepted one; see [ADR 017](../../adr/017-azul-table-light.md).

The corrected written specification supersedes mockup geometry: retain existing
corner controls; “in hand” is an uncommitted preview; the main screen never scrolls.
Compact layouts use colour and destination dialogs. Desktop places the supply
and playable board side by side below all opponents. See [mobile](../mobile.md).
