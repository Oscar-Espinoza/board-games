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

The book in the upper-left opens rules; the upper-right gear opens settings.
Click any central rule tile for its specific entry. Opponent trays open their
complete public tableau; the local heart button opens saved desserts. Practice
settings expose other scenes, seat counts and language. The extra “Let the other
seats choose” control appears only in practice.

## Materials

No raster asset pack, remote font or image service is required.

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

Other affected files are the English/Spanish message catalogs.

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
not a miniaturized desktop board.
