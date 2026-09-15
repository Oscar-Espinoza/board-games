# Azul Rich & Dramatic: components

The table, five tile families, factory plate, player-board substrate, floor rail, score rail and decorative props use optimized generated WebP artwork. High-resolution sources stay under the game package rather than the browser static tree. Live tiles, empty cells, wall guides, score, penalties, bonuses, names and controls remain Svelte/HTML/SVG. Empty pattern slots have no colour information; empty walls print their assigned colours and motifs.

The existing book and settings controls retain their accessible names and safe-area offsets. The header keeps the round and live turn status. The generated bag presentation and discard plaque retain measurable `bag` and `discard` anchors and readable counts.

`PlayerBoard` keeps full/compact density, interactive/read-only rendering, anchor emission and temporary score options. Generated artwork is only its substrate. The full board exposes five 44px pattern targets, wall, printed floor penalties, translated `+2/+7/+10` bonus legend and separate score rail. Compact rendering remains noninteractive. Inspection/destination dialogs retain accessible wall labels and emit no table anchors.

The generated score marker follows a decorative 0–100 brass rail. Exact displayed scores remain uncapped, including during scoring. Above 100 only the rail position clamps; a `100+` endpoint indicator accompanies the exact score. It remains distinct from the circular first-player tile.

Pattern rows fill right to left. Decorative arrows connect them to their wall rows; legality explanations and full-size accessible cell labels stay intact. Floor slots align left below the mosaic.

Each opponent is a semantic `.opponent` article with readable name, exact score, active turn, starter and disconnected status outside the artwork. A separate inspect button covers the noninteractive preview; no controls are nested. Inspection opens the existing full-size dialog and restores focus on close. Preserve each `{id}/summary` anchor.

The supply uses one collision-checked ring at every player count. Desktop plates form a perspective-correct ellipse around a protected centre rectangle, with the local board below; compact layouts open factory colour and destination dialogs. Centre tiles occupy five deterministic colour clusters with distinct per-tile anchors, disjoint grouped controls, stable keyboard order and a separate first-player marker. Empty clusters show no digital zero. Source tiles remain canonical until acceptance.

The table renders from `visual`, separately from accepted snapshots. Temporary presentation never changes game rules or the action envelope. See [motion](motion.md) for staged scoring and cancellation.
