# Azul Table Light: components

The table and its props use CSS and original SVG artwork. Boards and factory discs represent printed cardboard; only tiles have ceramic relief. Empty pattern slots have no colour information. Empty walls print their assigned colours and motifs more strongly.

The existing book and settings controls retain their placement, accessible names and safe-area offsets. The header keeps the round and live turn status. The bag and box-lid SVGs retain `bag` and `discard` anchors and readable counts.

`PlayerBoard` has explicit full/compact density, interactive/read-only rendering, anchor emission and temporary score options. Full board dimensions follow available component width, with playable rows at least 44px high. Compact rendering scales rows, padding, pattern, wall and floor slots independently and emits no buttons. Full-size dialogs retain accessible wall labels and emit no table anchors.

The square score marker follows a decorative 0–100 rail. Exact displayed scores remain uncapped, including during scoring. Above 100 only the rail position clamps; a `100+` endpoint indicator accompanies the exact score. This square token is separate from the circular first-player tile.

Pattern rows fill right to left. Decorative arrows connect them to their wall rows; legality explanations and full-size accessible cell labels stay intact. Floor slots align left below the mosaic.

Each opponent is a semantic `.opponent` article with readable name, exact score, active turn, starter and disconnected status outside the artwork. A separate inspect button covers the noninteractive preview; no controls are nested. Inspection opens the existing full-size dialog and restores focus on close. Preserve each `{id}/summary` anchor.

The supply uses one square ring at every player count. Compact layouts open factory colour and destination dialogs; wide, tall viewports retain direct selection. The main screen has no scroll range; details and results open in dialogs. See [mobile](mobile.md) for measured dimensions. Centre tiles occupy five deterministic colour clusters with visible counts, distinct per-tile presentation anchors, disjoint grouped controls, stable keyboard order and a separate first-player marker. Source tiles remain canonical until acceptance. The selection preview does not imply that tiles have already moved.

The table renders from `visual`, separately from accepted snapshots. Temporary presentation never changes game rules or the action envelope. See [motion](motion.md) for staged scoring and cancellation.
