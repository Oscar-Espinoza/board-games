# ADR 024: Carcassonne painted wooden table

Status: accepted. September 22, 2026.

The existing Carcassonne redesign is completed as a game-owned painted wooden
table. It supersedes ADR 012's presentation choices while retaining its engine,
privacy, resumable-choice and accepted-event contracts.

Local WebP materials under `apps/web/static/games/carcassonne/` provide the table,
meadow, town, earth, abbey and keep imagery. SVG clips town materials to actual city
regions and draws roads, river banks, shields, goods and expansion symbols from
the existing tile definitions. All controls and game text remain Svelte/SVG.
Marcellus is bundled locally with its OFL license. Materials introduce no remote
asset dependency, extra runtime or rule change.

One affine ground plane owns rendering and inverse pointer coordinates. Wheel
zoom preserves the world point beneath the pointer; two-finger movement pans and
zooms around the moving midpoint. Upright numbered wooden figures counteract the
ground transform; farmers lie down and attachments remain beside their owner.
Tile drops select a local preview and still require confirmation. Invalid or
cancelled drops do not submit a placement. Arrows, rotation keys, Space-drag,
Shift+arrows and fixed camera buttons preserve alternatives to dragging.

Desktop uses a left player column, bottom tile/piece tray and separate lower-right
camera controls. At widths of 900px or less, or heights of 540px or less, the table
uses a horizontal scrollable player strip and compact tray. Piece supply expands
on request and becomes directly available during deployment. The table itself
never scrolls; dialogs, setup and long choices retain their own scrolling.

The shared production tile renderer also supplies lazy catalog lessons.
`/practice/carcassonne?scenario=table` is a deterministic six-seat, 29-tile playable
review fixture. It never changes production decks or eager catalog metadata.

See [rules and controls](../games/carcassonne.md).
