# Azul redesign: migration

Nine phases, each shippable on its own. Values are in [tokens](tokens.md), the component-by-component target is in [components](components.md), and [motion](motion.md) and [mobile](mobile.md) cover the two areas with their own constraints.

Everything here is presentation. Rules, validation, the public projection, the event union, the revision gate and the action envelope are untouched, which keeps this inside the boundary [ADR 013](../adr/013-three-game-delivery.md) already set. The decision itself is [ADR 017](../adr/017-azul-table-light.md).

## Three contracts that must not break

Read these before touching anything. Each one fails quietly.

### 1. The animation anchors

`effects.ts` finds every `[data-azul-location]` element and measures its bounding rectangle before and after each state change. **Elements with zero width or height are skipped**, and a flight whose start or end anchor is missing is dropped silently — no error, no console warning, the tile just never moves.

The anchors: `factory/{index}/{slot}`, `center/{color}`, `center/marker`, `bag`, `discard`, `{id}/pattern/{row}/{slot}`, `{id}/wall/{r}/{c}`, `{id}/floor/{slot}`, `{id}/marker`, `{id}/summary`.

Restructuring markup without carrying these across breaks animation while every test still passes.

### 2. The flying tile is styled in JavaScript

`.azul-flight` has no CSS rule anywhere. Its appearance is assigned inline in `tileFlights()` on a node appended to `document.body`, outside `.azul-table`, so scoped styles and table-level custom properties cannot reach it. Restyling `Tile.svelte` alone leaves every flight looking like the old design.

The browser suite additionally pins the class name `azul-flight`, the body-level append, a Web Animations animation at `getAnimations()[0]`, and a first keyframe whose transform contains `translate(0,0)` with a later one that does not.

### 3. The browser suite pins class names and labels

`tests/e2e/azul.spec.ts` selects `.azul-table`, `.surface`, `.factory`, `.factory-tiles button:enabled`, `.center-group:enabled`, `.opponent`, `.player-board`, `.own-board`, `.own-board .mosaic`, `.own-board .pattern`, `.own-board .pattern .tile`, `.own-board .row-issue`, `.pattern:enabled`, `.slot`, `.empty-slot`, `.tile.blue`, `.confirmation`, `.explanations`, `.results`, `.result-boards article` and `.azul-flight`. It also asserts the accepted board's markup contains the literal string `tile blue`, reads `data-game-revision` off `.azul-table`, checks that the first `.slot` in a pattern row renders to the right of the second, which is what proves right-to-left filling, and requires `.own-board .pattern:enabled` to be at least 44px tall.

It matches these accessible names exactly, in English and Spanish: `Table settings`, `Close`, `Practice scenario`, `Floor line`, `Line N · …`, `Confirm tiles`, `How to play Azul`, `Search the guide`, `Take 4 · Blue diamond · Center`, `Ceramic sounds`, `Volume`, `Motion`, `Language`, `Ajustes de la mesa`, `Sonidos de cerámica`, `Cerrar`, `Wall row 1, column 1 · Blue diamond · Empty`, and the explanation strings `+6 wall points` and `+2 wall points (0 horizontal + 2 vertical)`.

`tests/e2e/three-games-library.spec.ts` asserts `.box-stage` carries `data-selected="azul"`, so catalogue artwork keeps its wiring. `scripts/three-games-library.test.ts` requires every `azul_*` and `learn_azul_*` message key to exist in both `en.json` and `es.json` with a non-empty value — any new string is a two-locale change or the suite fails.

Any rename lands in the same commit as its test update. Phases 4 and 6 are the two that genuinely restructure tested markup.

## Phase 0 — tokens, with no visual change

Create `games/azul/src/palette.ts` with the five glaze/motif pairs, the marker and the fallback glyphs. Point `effects.ts` and `HelpScene.svelte` at it and delete their local copies. Create `games/azul/src/tokens.css` with the surface, ink and geometry custom properties scoped to `.azul-table`, imported from `Board.svelte`. Change `Tile.svelte` to set `--glaze` and `--motif` inline from `palette.ts` and delete its six per-colour CSS blocks, keeping `class="tile {color}"`.

Leave `BoxArt.svelte` alone beyond a comment: its palette is a deliberately lighter cover-art set, not stale duplication. [tokens](tokens.md) explains why.

**Check:** the table should render pixel-identically. `bun run check`, `bun test ./games`, and `bun run test:e2e` with no snapshot differences. If anything moves, the extraction is wrong.

## Phase 1 — typography

Add `apps/web/static/fonts/` with Marcellus and Karla as woff2, subset latin and latin-ext, plus their OFL licence. Declare `@font-face` and apply the two faces inside `.azul-table` only.

**Check:** Spanish accents render from the subset, not a fallback. Both faces load with no layout shift. The other six games are visually unchanged — that is what scoping to `.azul-table` buys.

## Phase 2 — the table surface and the props

Replace the navy gradient on `.azul-table` with the walnut, lamp, grain and vignette stack. Drop the brass hairline. Replace the `♧` and `◇` characters in `.reserves` with the bag and box-lid SVGs, keeping their counts and their `bag` and `discard` anchors.

**Check:** contrast of table text against the new surface. Corner controls still legible.

## Phase 3 — a true ring at every player count

Rewrite `platePosition()` to return points on one circle for any count, with radius and plate size scaled to the container, and the start angle rotated so no plate sits under the heading. Delete the two-row branch. Delete the `max-width: 600px` rule that replaces the ring with a grid.

**Check:** 2, 3 and 4 seats — five, seven and nine displays — at desktop, tablet and phone widths. Plates must not overlap each other, the heading, the boards or the pool. The centre stays inside the ring at every count.

## Phase 4 — the loose centre pool

Replace the `.center-group` count chips with tiles scattered inside the ring, keeping one grouped hit target per colour with its existing accessible name, disabled state and selected state. Keep `center/{color}` and `center/marker` on the tiles.

**Check:** this is the riskiest phase for tests. The suite clicks `.center-group:enabled` and a control named `Take 4 · Blue diamond · Center`, and keyboard order across the five colours has to stay sane. Verify keyboard-only play end to end, not just pointer.

## Phase 5 — the player board

Add the score track and its marker. Add the ▶ column between pattern lines and wall. Move the floor line to the bottom left. Apply the board surface, the 4° tilt and its shadow. Strengthen the wall printing. Apply the tile relief.

**Check:** the first `.slot` in a pattern row still renders right of the second. `.own-board .pattern:enabled` still clears 44px. The `Wall row 1, column 1 · Blue diamond · Empty` label is unchanged. Re-check text enlargement at 200% — the score track adds a dense row of numerals the board did not have.

## Phase 6 — opponents as real boards

Render `PlayerBoard` at `--tile: 19px` in place of the `.opponent` text card, hiding labels and penalty numerals at that size. Keep `.opponent`, `.turn`, the `{id}/summary` anchor and the `m.azul_inspect` name, and keep the card a button that opens the existing dialog.

**Check:** the second phase that touches tested markup. Four seats at desktop and tablet without overflow. Animation now has real per-square anchors for opponents, so confirm flights land on squares rather than on the summary, and that the summary fallback still works when those squares are not rendered.

## Phase 7 — mobile

Apply the 390×844 layout and the three breakpoints from [mobile](mobile.md).

**Check:** WebKit and Chromium at 390×844 and 360×640. No horizontal scroll. Tap-target heights. Nothing painted in the status-bar band.

## Phase 8 — motion

Bring the flight's inline styling in line with the redesign, either from `palette.ts` or by mounting a real tile into the flight node. Keep every timing. Optionally split `ceramicAudio()` into the three voices described in [motion](motion.md).

**Check:** flights still start and land on the right anchors after phases 3, 4 and 6 moved things. Reduced motion still suppresses everything and Skip still settles instantly. The keyframe shape the suite pins is unchanged.

## Validation

Per AGENTS.md, run after changes rather than repeating passing checks without new evidence:

- `bun run check`
- `bun run test` — or `bun test ./games/azul` while iterating
- `bun run test:e2e` on Chromium **and** WebKit; browser changes need both
- `bun run format:check`

WebKit automation does not replace Safari on a real device, and touch quality, audio on iOS, a multi-human game and fluent Spanish editorial review still need a person. Record new captures in `docs/evidence/azul/` under the existing convention and add the after column to [screenshots](screenshots.md).

## Deliberately out of scope

- The two other directions that were explored. Not in the repository; [ADR 017](../adr/017-azul-table-light.md) records why Table Light won.
- Catalogue-wide design tokens. The other six games keep their own hard-coded values; this is the pilot, not the rollout.
- The `BoxArt.svelte` cover palette.
- The dead `'DM Sans'` and `'Fraunces'` declarations in `apps/web/src/app.css` and the undefined `--font-body` in `games/codenames/src/Board.svelte`. Real, small, and someone else's phase.
- The unused `canConfigure` prop on `Board.svelte`.
- The gray-side board variant, expansions, bots and undo, all outside the game's scope already.
