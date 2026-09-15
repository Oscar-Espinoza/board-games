# Sushi Go Party: production illustrated table

The approved desktop composition now renders the actual game in multiplayer
rooms and local practice. No server, rule, projection or room protocol changes
were needed. [ADR 021](adr/021-sushi-illustrated-table.md) records the boundary.

## Open it

Run `bun run dev` from the repository root, then use the frontend URL printed
by the command:

- `/practice/sushi-go-party`: playable, deterministic five-player midgame using
  the real engine. Select Maki to reproduce the selected-card screenshots.
- The catalog → Sushi Go Party → Start game: actual multiplayer table.
- `/prototype/sushi-go-party`: archived static reference, still isolated.

The book in the upper-left opens rules; the upper-right gear opens settings.
Click any central rule tile for its specific entry. Opponent trays open their
complete public tableau; the local heart button opens saved desserts. Practice
settings expose other scenes, seat counts and language. The extra “Let the other
seats choose” control appears only in practice.

## Screenshots and materials

Final desktop screenshots use exactly 1440×900 at device scale factor 1. They
show real round-two scores rather than the archived prototype's authored scores.

| View               | Chromium                                                                       | WebKit                                                                       |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Desktop            | [Full table](../artifacts/sushi-party-migration/chromium-desktop-1440x900.png) | [Full table](../artifacts/sushi-party-migration/webkit-desktop-1440x900.png) |
| Board              | [Close-up](../artifacts/sushi-party-migration/chromium-board.png)              | [Close-up](../artifacts/sushi-party-migration/webkit-board.png)              |
| Opponent           | [Close-up](../artifacts/sushi-party-migration/chromium-opponent.png)           | [Close-up](../artifacts/sushi-party-migration/webkit-opponent.png)           |
| Local hand/tableau | [Close-up](../artifacts/sushi-party-migration/chromium-local-hand.png)         | [Close-up](../artifacts/sushi-party-migration/webkit-local-hand.png)         |
| Rules              | [Rules](../artifacts/sushi-party-migration/chromium-rules.png)                 | [Rules](../artifacts/sushi-party-migration/webkit-rules.png)                 |
| Settings           | [Settings](../artifacts/sushi-party-migration/chromium-settings.png)           | [Settings](../artifacts/sushi-party-migration/webkit-settings.png)           |
| Accepted pass      | [Passing](../artifacts/sushi-party-migration/chromium-accepted-pass.png)       | [Passing](../artifacts/sushi-party-migration/webkit-accepted-pass.png)       |
| Eight players      | [Eight seats](../artifacts/sushi-party-migration/chromium-8-seats.png)         | [Eight seats](../artifacts/sushi-party-migration/webkit-8-seats.png)         |

The same artifact directory includes Spanish, 2/5-seat and compact viewport
captures. [Existing multiplayer evidence](evidence/sushi-go-party/README.md)
includes actual 2/8-client rooms, full matches, advanced prompts and videos.
The [prototype handoff](sushi-go-party-prototype.md) retains its original review
images. No new raster asset pack, remote font or image service is required.

## Component/state mapping

| Component/module                              | Production input and responsibility                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Board.svelte`                                | Existing recipient `view`, room names, connectivity/pending, send callback, room settings and rematch callbacks; owns selection and actor-only prompts. |
| `table/PartyBoard.svelte`, `MenuTile.svelte`  | Public menu, round/turn, player-count rule summaries and a rules callback. Eight real-text positions.                                                   |
| `table/ScoreTrack.svelte`, `ScorePawn.svelte` | Public exact scores and stable canonical-seat colors. Decorative modulo-60 track.                                                                       |
| `table/OpponentSeat.svelte`                   | Public name/score/count/tableau/saved desserts, commitment/readiness and accepted reveal IDs; callback opens full public tray.                          |
| `table/HiddenHand.svelte`                     | Public count only; identical card backs.                                                                                                                |
| `Card.svelte`, `table/FoodArt.svelte`         | Existing `HandCard`/`PublicCard` identity, variant, copied/boxed state and locale; all 26 types remain supported.                                       |
| `table/layout.ts`, `table.css`                | Local-relative 2–8-player desktop geometry, game-owned palette and localized menu adapter; approved composition and compact overrides.                  |
| `table/TableDecor.svelte`                     | Decorative SVG props and localized note text; no game state.                                                                                            |
| `effects.ts`                                  | Accepted public pass `{from,to,count}` edges and existing cancellation lifecycle; no secret faces.                                                      |
| `practice.ts` and practice route              | Conserved seeded scenes and local-only engine driver; never multiplayer initialization.                                                                 |

Other affected files are the English/Spanish message catalogs, prototype imports
of the promoted primitives, new layout tests and `tests/e2e/sushi-table.spec.ts`.
The existing multiplayer browser suite remains the behavioral regression suite.

## Visual iteration and remaining differences

The migration reused the approved board/seat geometry and original SVG art.
Viewport review corrected long-hand bottom clipping, saved-dessert overlap with
the lower-right tray, clockwise seat order, grouped score pawns and landscape
confirmation size. Real accepted-pass capture exposed and corrected skipped
practice presentation revisions without relaxing the production sequence gate.
Compact review also separated landscape opponent trays, moved the practice
advance control away from names, and removed redundant basic-card rule popovers
that covered tableaus. Utensil/copy choices and the complete rule book remain.

Meaningful differences from the reference are intentional live-state displays
(actual scores, changing menus, readiness, saved desserts and rule/settings
controls), cleaner CSS/SVG materials than the painted reference, and denser
trays when 6–8 people play. Compact screens use the retained compact layout,
not a miniaturized desktop board. Native Safari, physical touch/audio and a live
human group playtest are not claimed by automated browser verification.

## Verification environment

The browser specs capture at device scale factor 1. Multiplayer journeys use
independent desktop-host and phone-guest contexts, with the host also switching
through desktop, tablet, portrait and landscape sizes. The separate layout spec
checks every 2–8-player desktop arrangement and all eight players on compact
screens, including tray/button overlap and 44px action targets.

This Linux host needs the temporary codec-library wrapper described in the
[prototype handoff](sushi-go-party-prototype.md). Its default-JIT WebKit runs
also produced closed-page/invalid-attribute failures in longer multiplayer
journeys; disabling JavaScript JIT allowed the two-player journey to complete.
That is an automation-environment workaround, not a change to the shipped app
or proof about Safari's JIT. With that workaround, all nine WebKit cases passed
across the full and final focused runs, including the eight-player journey.
The command for this verification environment is:

```sh
JSC_useJIT=false \
WEBKIT_EXECUTABLE=/tmp/sushi-prototype-webkit.yEe3bI/webkit \
bun run test:e2e tests/e2e/sushi-go-party.spec.ts \
  tests/e2e/sushi-table.spec.ts tests/e2e/sushi-prototype.spec.ts --project=webkit
```

A normal Playwright installation with the required OS libraries does not need
the temporary executable override. Native Safari and default-JIT WebKit's long
multiplayer journeys on this machine remain unverified.

## Final checks

- `bun run check`: passed, zero Svelte errors or warnings; root TypeScript clean.
- `bun run build`: passed for frontend and server.
- `bun run test`: 323 passed, 0 failed, including the new layout/localized-menu
  and conserved five-player-fixture coverage.
- Nine distinct Chromium and nine distinct WebKit browser cases passed across
  full and focused runs. The final eight-case focused run covers both engines'
  prototype, production table, compact layouts and advanced practice prompts.
- Screenshots were inspected at 1440×900 in both engines. Static captures finish
  finite CSS transitions before capture; the accepted-pass capture pauses actual
  accepted-event hand animations instead. The archived prototype's Chromium
  reload is pixel-identical; its WebKit allowance is documented separately.
- Scoped Prettier, `git diff --check` and handoff link checks passed.

The development server and every Playwright-owned test server were stopped.
No production rule, privacy projection, multiplayer initialization or transport
was changed; unrelated existing Azul work was preserved.
