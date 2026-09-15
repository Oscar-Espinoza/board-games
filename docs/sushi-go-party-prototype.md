# Sushi Go Party! desktop prototype

An isolated, static Svelte composition based on the selected illustrated table reference. Route: `/prototype/sushi-go-party`. This document records the original prototype delivery. The subsequently approved [production migration](sushi-go-party-redesign.md) now shares its visual primitives, while the static fixture and route remain isolated.

## Run

From the repository root:

```sh
bun run dev
```

Open `/prototype/sushi-go-party` on the web server's printed URL. To run just the frontend, with no game server:

```sh
bun run --filter @board-games/web dev
```

Use the port printed when starting your frontend; no review server is left running.

The composition uses a 1440×900 stage, fitting proportionally in other windows. This is a desktop prototype, not a mobile redesign. The outside edges of the top and local trays and decorative props intentionally continue beyond the frame, as in the reference. All game information and interactive targets fit inside it.

## Fixture and interaction

`games/sushi-go-party/src/prototype/fixture.ts` contains fixed data with no clock, randomness, storage, network, engine initialization or opponent private card faces.

- Five players, in clockwise order: Marina → Kai → Sakura → Tomás → Emi → Marina.
- Round 2, pick 3 of 9: three collected cards per player and six remaining cards. The frozen presentation includes choosing, ready and passing badges, and a preview selection in the local hand.
- Scores/colors: Marina 47/green; Kai 7/blue; Sakura 13/pink; Tomás 17/coral; Emi 32/purple. Exact seat scores and track markers share their inputs. The decorative track loops at 60; seat scores remain exact.
- Six local cards: Salmon Nigiri, Sashimi, Dumpling, Maki, Tempura, Pudding. Maki starts selected.
- Selecting a card works with pointer or keyboard. “Keep this dish” is an intentional static action target; it does not submit, advance or simulate a game.
- Each seat's latest dish has a slight settling offset, contact shadow and small accent strokes. Five identical-back bundles and directional arrows show all five pass edges without time-dependent animation.

This is an authored visual snapshot, not a replayable engine save. Fixture values differ deliberately from the reference's placeholder scores and counts.

## Final screenshots

Both full screenshots are exactly 1440×900 pixels, at device scale factor 1.

| View                   | Chromium                                                               | WebKit                                                               |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Full viewport          | [Screenshot](../artifacts/sushi-party-prototype/chromium-1440x900.png) | [Screenshot](../artifacts/sushi-party-prototype/webkit-1440x900.png) |
| Central board          | [Close-up](../artifacts/sushi-party-prototype/chromium-board.png)      | [Close-up](../artifacts/sushi-party-prototype/webkit-board.png)      |
| Opponent seat          | [Close-up](../artifacts/sushi-party-prototype/chromium-opponent.png)   | [Close-up](../artifacts/sushi-party-prototype/webkit-opponent.png)   |
| Local tableau and hand | [Close-up](../artifacts/sushi-party-prototype/chromium-local-hand.png) | [Close-up](../artifacts/sushi-party-prototype/webkit-local-hand.png) |

## Components and files

The original components were authored under `games/sushi-go-party/src/prototype/`.
During the approved migration, `PartyBoard`, `ScoreTrack`, `ScorePawn`, `MenuTile`,
`HiddenHand`, `FoodArt`, `TableDecor` and `data.ts` moved to the adjacent `src/table/`
directory and are shared with production. Static composition components remain
in `src/prototype/`:

- `Table.svelte`: fixture composition, local seat and viewport scaling. This is the only component importing the fixture.
- `PartyBoard.svelte`, `ScoreTrack.svelte`, `ScorePawn.svelte`, `MenuTile.svelte`: physical board, integrated round/pick indicator, score stations, pawn appearance and real-text rule tiles.
- `PlayerSeat.svelte`, `PlayerTableau.svelte`, `HiddenHand.svelte`: opponent tray, public cards and count-only backs.
- `PlayingCard.svelte`, `LocalHand.svelte`, `PrimaryAction.svelte`: card appearance, selectable private hand and primary button.
- `PassingDirection.svelte`: the five desktop paths and count-only passing bundles.
- `FoodArt.svelte`, `TableDecor.svelte`: scoped original SVG food refinements and decorative tabletop objects. Nigiri and Sashimi reuse the existing `Dish.svelte`; the bundled Roboto Condensed font is reused under its existing license. No new raster assets or fonts were needed.
- `data.ts`: presentation types and the eight menu titles, rules and colors; no fixture imports.
- `fixture.ts`: the deterministic five-player scene.

Other files:

- `apps/web/src/routes/prototype/sushi-go-party/+page.svelte`: isolated route and noindex metadata.
- `games/sushi-go-party/package.json`: separate `./prototype/Table.svelte` export.
- `tests/e2e/sushi-prototype.spec.ts`: browser verification and screenshot capture using the existing Playwright configuration.
- This document and the screenshots above.

## Future production inputs

The following mapping was the original integration plan. The subsequent
[migration handoff](sushi-go-party-redesign.md) records the implemented adapters.
Components accept existing `Face`, `HandCard` and `PublicCard` shapes where applicable.

| Prototype component         | Future input                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PartyBoard` / `MenuTile`   | `view.public.menu`, `round`, `turn`; game-owned menu ordering and localized rule text. Initial hand size supplies the display's total picks.                                    |
| `ScoreTrack` / `ScorePawn`  | `view.public.players[].score`; stable seat colors keyed by player ID.                                                                                                           |
| `PlayerSeat`                | Public player `id`, `score`, `count`, plus room display name, seat position and color. Derive status from public commitments and accepted presentation state.                   |
| `PlayerTableau`             | `view.public.players[].tableau`; handle saved `desserts` separately during integration. Latest-card emphasis comes from accepted public `reveal` events.                        |
| `HiddenHand`                | Public hand count only. Never supply opponent faces.                                                                                                                            |
| `PlayingCard` / `LocalHand` | `view.private.hand` and its stable handles; local selection state and selection callback.                                                                                       |
| `PassingDirection`          | Accepted `view.public.presentation.events` with type `pass`: public `{ from, to, count }` edges. Current paths are intentionally limited to this five-seat desktop arrangement. |
| `PrimaryAction`             | Selected handle and an authorized action callback, respecting the existing commitment/prompt lifecycle.                                                                         |

Localization, other menus/player counts, extra card effects, real event timing and
action submission were outside the original prototype task and are now covered
by the production migration. The archived prototype keeps its isolated English copy.

## Visual review

Chromium captures were reviewed after each major pass against the primary reference:

1. Composition: fixed the menu's intrinsic height overflowing the track, lowered the emphasis of the background pattern, and lifted the clipped local hand.
2. Board and food: enriched food silhouettes, brought the board up to the reference position, and moved the side score stations clear of the menu.
3. Seats and passing: made newly revealed cards visible above the compact tableau fan, added settling accents, and completed the final passing arrow toward Marina.
4. Refinement: enlarged food within the tiles, softened foliage and note lettering, and checked selection/action spacing.
5. Browser parity: WebKit flattened the original 3D grid perspective. Two slightly skewed rows now reproduce the intended wider lower row consistently in both browsers.

Remaining meaningful differences from the reference:

- The CSS/SVG materials are cleaner and less painterly, especially on tray rims, foliage, food edges and shadows.
- Nigiri and Sashimi retain the existing game's simpler original illustrations. The reference has finer food highlights and print texture; the card-back ornament here is also simpler.
- Opponents display three overlapping collected cards. Two additional outgoing bundles make the complete five-player passing circuit explicit, adding some visual density near the lower corners.

## Validation

- `bun run check`: passed, zero Svelte errors or warnings.
- `bun run build`: passed.
- `bun run test`: 320 passed, 0 failed.
- `bun run test:e2e tests/e2e/sushi-prototype.spec.ts`: passed in Chromium and WebKit.
- Scoped Prettier validation for the new/changed prototype files: passed.

The browser test checks five players and score pawns, all eight exact menu rules, fifteen public cards with five newly revealed cards, six usable private-card targets, all five pass destinations, no scrolling, unclipped game information, no socket connections, no relevant console/runtime errors and selection reset on reload. Chromium reload screenshots match byte for byte. WebKit allows one-level RGB rounding in shadow compositing, plus at most 16 edge pixels with a maximum channel difference of 8. The migration rerun measured 11 such pixels (maximum 7) on a single skewed tile edge; fixture data and geometry remain deterministic.

WebKit on this machine initially lacked `libavif16` and its `libgav1-1`/`libyuv0` dependencies. They were downloaded from the configured Ubuntu archive and extracted without system installation into `/tmp/sushi-prototype-webkit.yEe3bI`. A temporary wrapper supplies those libraries:

```sh
WEBKIT_EXECUTABLE=/tmp/sushi-prototype-webkit.yEe3bI/webkit \
  bun run test:e2e tests/e2e/sushi-prototype.spec.ts
```

That temporary wrapper may disappear when `/tmp` is cleared. A normal Playwright WebKit installation with its OS dependencies needs no override. Real Safari device validation remains unverified.
