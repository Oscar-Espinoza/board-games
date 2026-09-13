# Azul redesign: tokens

Every value here is lifted from the accepted Table Light mockups, not invented. The five tile colours are **unchanged** from what already ships — only their location changes.

Read [components](components.md) for what each token is used on, and [migration](migration.md) for the order the work happens in.

## Why a token module at all

The five tile colours are currently written out in four separate places:

| Where                                    | Form                                                               |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `games/azul/src/Tile.svelte`             | CSS custom properties on per-colour classes (`--glaze`, `--motif`) |
| `games/azul/src/effects.ts`              | the `paints` map, glaze plus a unicode fallback glyph              |
| `games/azul/src/HelpScene.svelte`        | the `palette` array, glazes only, used as SVG `fill`               |
| `apps/web/src/lib/catalog/BoxArt.svelte` | a lighter cover-art array                                          |

The first three are the same five colours written three times, and they must stay in step because they render the same tile in three contexts: the table, a flying tile during animation, and the illustrated rulebook. They collapse into one module.

**`BoxArt.svelte` is deliberately left alone.** Its `#216e9b`, `#e5af3b`, `#b94a3c`, `#283b46`, `#fcf3df` are a lighter cover-art palette chosen to read on a box face at catalogue size, not a stale copy of the tile glazes. Those five hexes appear nowhere else in the repository. Folding them into the game palette would change the catalogue artwork, which is outside this redesign, and importing the game package from `apps/web/src/lib/catalog/` would violate the catalogue's no-eager-game-imports rule. It keeps its own values and gains a comment pointing here.

## Where the module lives

`games/azul/src/palette.ts` holds the colours as TypeScript constants, and `games/azul/src/tokens.css` holds the surface and geometry custom properties scoped to `.azul-table`, imported from `Board.svelte`.

Game-local, not shared. AGENTS.md is explicit that each game owns its own UI and that only demonstrated shared concepts move into the small game contract; one game's palette is not that. `packages/shared/src/index.ts` carries a standing comment that it is metadata only and importing the catalogue must not pull in game presentation, and `packages/game-core` holds contract types with no runtime values. Neither is a home for this.

`apps/web/src/lib/catalog/guides/AzulScene.svelte` already reaches directly into `games/azul/src/HelpScene.svelte` by relative path, so the guide picks the new palette up for free through that component. No new package export is needed: nothing outside the game imports the palette, so `games/azul/package.json` keeps its existing `./server`, `./Board.svelte` and `./practice` entries.

## Palette

Unchanged values, one definition. `glaze` is the tile body, `motif` is the original SVG pattern drawn on it.

| Colour | Glaze     | Motif     | Fallback glyph |
| ------ | --------- | --------- | -------------- |
| Blue   | `#1766a0` | `#c9e5f4` | `◆`            |
| Yellow | `#edb737` | `#7d5015` | `☀`            |
| Red    | `#ae4235` | `#ffddbb` | `❯`            |
| Black  | `#24313b` | `#d6b893` | `▦`            |
| White  | `#faf2da` | `#368c9e` | `✿`            |
| Marker | `#f5e8c9` | `#15364c` | `1`            |

The glyphs exist only because `effects.ts` draws a flying tile as a plain `<span>` with text in it rather than mounting a real `Tile`. They stay until that changes.

`Tile.svelte` keeps `class="tile {color}"` — the browser suite selects `.tile.blue` and asserts the accepted board's markup contains the literal string `tile blue`, so the class is a contract, not decoration. What changes is that the colour comes from an inline `style="--glaze:…;--motif:…"` read from `palette.ts`, and the six per-colour CSS blocks in that file are deleted rather than becoming a fourth copy.

## Type

| Token            | Value                                              | Replaces                                                     |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `--azul-display` | `'Marcellus', Georgia, serif`                      | the scattered `Georgia, serif` display strings               |
| `--azul-ui`      | `'Karla', 'Helvetica Neue', system-ui, sans-serif` | `font-family: Arial, Helvetica, sans-serif` on `.azul-table` |

Both faces are OFL and self-hosted as woff2 under `apps/web/static/fonts/` (a directory that does not exist yet), subset to latin and latin-ext so Spanish keeps its accents, with the licence file shipped alongside. They are applied **inside `.azul-table` only**, so the redesign cannot silently restyle the other six games.

Two pieces of dead type wiring are noted but **not** part of this migration: `apps/web/src/app.css` declares `'DM Sans'` and `'Fraunces'` that nothing ever loads — no `@font-face`, no `<link>`, no `apps/web/static/` — so the whole catalogue currently renders in `system-ui` and Georgia; and `games/codenames/src/Board.svelte` reads a `--font-body` variable that is never defined anywhere. Both are small cleanups for whenever someone touches typography catalogue-wide.

## Ink

| Token                   | Value     | Used on                                |
| ----------------------- | --------- | -------------------------------------- |
| `--azul-ink`            | `#2b2117` | text on a board                        |
| `--azul-ink-soft`       | `#7e6e58` | labels and penalty numerals on a board |
| `--azul-table-ink`      | `#f3e2bd` | text on the table surface              |
| `--azul-table-ink-soft` | `#b39c74` | seat names, round number, prop labels  |
| `--azul-accent`         | `#e0b168` | brass accent: active seat, callouts    |
| `--azul-accent-strong`  | `#f4d29a` | hover and focus of the same            |

## Surfaces

The table is a four-layer stack; keeping them as separate tokens is what lets the lamp and the vignette move independently of the wood.

| Token                | Value                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--azul-table-wood`  | `radial-gradient(ellipse 96% 78% at 50% 30%, #6d4b2c 0%, #513723 38%, #31210f 72%, #1c1208 100%)` over `#1a1008`                  |
| `--azul-table-lamp`  | `radial-gradient(ellipse 46% 34% at 50% 27%, #ffdca61c 0%, #ffdca60d 42%, transparent 72%)`                                       |
| `--azul-table-grain` | `repeating-linear-gradient(93deg, #00000000 0 3px, #0000001a 3px 4px, #00000000 4px 11px, #ffffff0a 11px 12px)`, `overlay` at 0.5 |
| `--azul-vignette`    | `radial-gradient(ellipse 74% 66% at 50% 42%, transparent 46%, #0c0703b3 100%)`                                                    |

| Token                 | Value                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `--azul-board`        | `linear-gradient(158deg, #fdf7e8 0%, #f5ead3 52%, #eddfc2 100%)`                                      |
| `--azul-board-edge`   | `#c9b28c`                                                                                             |
| `--azul-board-radius` | `10px`                                                                                                |
| `--azul-board-shadow` | `0 30px 52px -20px #000000a6, 0 8px 16px #00000055, inset 0 1px 0 #fffdf4, inset 0 0 0 1px #ffffff70` |
| `--azul-disc`         | `radial-gradient(circle at 36% 28%, #fdf5e2, #f0e3c4 56%, #dbc79c 100%)`                              |
| `--azul-disc-edge`    | `#b99a68`                                                                                             |
| `--azul-disc-shadow`  | `0 18px 26px -10px #000000a0, 0 4px 7px #00000055, inset 0 1px 0 #fffdf3`                             |
| `--azul-disc-print`   | `#2f6a85` at 42% opacity                                                                              |

The current values these replace are the flat navy `radial-gradient(ellipse at 50% 35%, #254b63 0, #142c43 60%, #102333 100%)` on `.azul-table`, the eight-stop hard-edged `radial-gradient` on `.factory`, and the `linear-gradient(120deg, #fff9e8, #f4e8cf)` on `.player-board`.

## What is printed on the board

| Token                | Value                                               | Meaning                                               |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `--azul-slot-border` | `1px solid #00000016`                               | an empty pattern-line square                          |
| `--azul-slot-fill`   | `#0000000a`                                         | the same                                              |
| `--azul-slot-shadow` | `inset 0 1px 2px #00000012`                         | the same                                              |
| `--azul-print-fill`  | `color-mix(in srgb, var(--glaze) 15%, transparent)` | the faded colour printed in an empty **wall** cell    |
| `--azul-print-motif` | `color-mix(in srgb, var(--glaze) 55%, transparent)` | the faded motif in that cell                          |
| `--azul-chevron`     | `#00000038`                                         | the ▶ printed between a pattern line and its wall row |

These sit at 15% and 55% rather than the current 12% mix because the faded wall printing is too weak to read at the sizes an opponent board uses. The pattern lines carry **no** colour information — that is correct on the retail board and correct here; see [components](components.md).

## Score marker

| Token               | Value                                          |
| ------------------- | ---------------------------------------------- |
| `--azul-pin`        | `linear-gradient(158deg, #f2d69c, #c99a4e)`    |
| `--azul-pin-ink`    | `#3a2a12`                                      |
| `--azul-pin-border` | `1px solid #ffffff8c`                          |
| `--azul-pin-shadow` | `0 2px 4px #00000055`                          |
| `--azul-rail`       | `linear-gradient(90deg, #00000018, #00000010)` |
| `--azul-rail-tick`  | `#00000033`                                    |

The marker is a small square, matching the physical token, not a dot. It replaces nothing: there is no score track on the board today.

## Geometry

| Token                | Desktop | Phone  | Note                                                 |
| -------------------- | ------- | ------ | ---------------------------------------------------- |
| `--tile`             | `34px`  | `27px` | already exists on `.player-board`, currently 33 / 23 |
| `--gap`              | `4px`   | `3px`  | already exists, currently 5 / 3                      |
| `--row`              | `38px`  | `44px` | new; the phone value **is** the tap target           |
| `--azul-tile-radius` | `14%`   | `14%`  | unchanged                                            |
| `--azul-disc-size`   | `104px` | `56px` | currently a fixed 112px with a 104px phone override  |

Opponent boards run at `--tile: 19px` on desktop and `8px` on a phone, which is what makes them fit as real boards rather than text; see [mobile](mobile.md).

## Tile relief

`--azul-tile-shadow`: `inset 0 2px 1px #ffffffb0, inset 0 -3px 2px #00000047, 1px 4px 5px #00000055`

A small change from the current `inset 0 2px 1px #fff9, inset 0 -3px 2px #0004, 1px 3px 3px #0004` — a slightly stronger cast shadow, so tiles sit on the board under the lamp instead of being flush with it. Paired with the existing `linear-gradient(148deg, #ffffff2e, transparent 58%)` gloss over the glaze.

This token also has to be applied by `effects.ts`, which builds the flying tile's appearance in JavaScript. See [motion](motion.md).
