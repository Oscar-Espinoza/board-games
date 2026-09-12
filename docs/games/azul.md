# Azul

Standard colored-wall Azul for 2–4 players. Each player builds a public wall by drafting ceramic tiles from shared factories and the center. This implementation uses original CSS/SVG artwork, English/Spanish Paraglide text, authoritative in-memory rooms and the existing seat/reconnect/rematch lifecycle. Gray walls, expansions, bots and undo are outside scope.

## Setup and turn

There are 100 tiles: 20 each of blue, yellow, red, black and white. Shuffle the bag using the injected random source. Put four tiles on each of 5/7/9 factories for 2/3/4 players, respectively. The first starter is uniformly random; turns proceed clockwise.

Take every tile of one color from one factory or from the center. A factory's remaining colors move into the center. Choose one legal pattern line or send the whole selection directly to the floor. No split or partial selection is accepted. Pattern lines fill from right to left, have capacities 1–5 and hold only one color; a line cannot accept a color already present in its wall row. Excess tiles fill the floor and then go directly to discard.

The first center pick claims the first player marker **before** placing its colored tiles. The marker occupies the next floor slot and its owner starts the following round. Floor slots deduct 1, 1, 2, 2, 2, 3, 3 points.

## Wall and scoring

The fixed wall's rows, left to right, are:

| Row | 1      | 2      | 3      | 4      | 5      |
| --- | ------ | ------ | ------ | ------ | ------ |
| 1   | Blue   | Yellow | Red    | Black  | White  |
| 2   | White  | Blue   | Yellow | Red    | Black  |
| 3   | Black  | White  | Blue   | Yellow | Red    |
| 4   | Red    | Black  | White  | Blue   | Yellow |
| 5   | Yellow | Red    | Black  | White  | Blue   |

When all shared colored tiles are gone, resolve **every** player's completed pattern lines from top to bottom. Move one tile from each complete line to the matching wall cell and discard the rest. Keep incomplete lines intact.

An isolated tile scores 1 point. Otherwise score the contiguous horizontal connection, if any, and contiguous vertical connection, if any, separately. The new tile counts in both connected axes: lengths 4 and 3 score 7. Diagonals and gaps do not connect. Earlier placements in the round contribute to later placements.

Apply floor deductions after wall points, stopping at zero. The ledger distinguishes printed deductions from actual score lost. Discard colored floor tiles and reset the marker. Refill factories, consuming the existing bag before shuffling recycled discards. On a total shortage, leave later factories partial or empty. Scores have no 100-point cap. The scoring explanation shows contributions from connected axes only; an isolated tile is labeled separately.

## Ending and ties

A completed horizontal wall row ends the game after **all** players resolve the round. Add 2 points per full row, 7 per full column and 10 per completed color (five tiles). Highest total wins. If tied, compare completed horizontal rows; if still tied, share victory. Results preserve boards and show the wall/floor/bonus ledger. The host may start a new match through the existing room start/rematch operation.

## Explicit table conventions

The following are deterministic app conventions; they are not claimed to be publisher clarifications:

- The first starter is random rather than based on travel history.
- A marker claimed with seven occupied floor slots stays visibly beside its owner's board. It adds no eighth-slot penalty and still grants the next start. The marker never enters bag or discard.
- If all factories happen to be monochrome and no center-colored tiles appear, no marker-only turn occurs. Keep the previous starter and reset the marker for the next round.
- Full pattern lines are not selectable. Direct floor placement remains legal.
- The final draft, all scoring, penalties, bonuses or refill form one atomic authoritative transition. Animation never requires an acknowledgement and never advances rules.

## Rules and presentation boundaries

`games/azul/src/index.ts` owns runtime validation, state, pure scoring, the reducer and the explicit public projection. Input contains only `DRAFT`, one source, one color and one destination. Actor identity comes from the server binding. Unknown extra fields are rejected. Rejected intentions neither mutate state nor consume randomness.

Every player board and score is public. The only hidden canonical information is future bag order (and canonical discard array internals); views expose aggregate counts, never future tiles. Each projection is deep-copied. Public events record accepted source/destination slots, marker/overflow, wall scoring cells, floor loss, dealt factory tiles and final bonuses. The latest event batch replaces the previous batch at each game revision.

This follows ADR 011's accepted-event boundary. A game-owned revision gate requires the same match and seat, a connected session and a consecutive game revision. Initial load, gaps, rematch, seat change, reconnect, resize, tab restoration and motion preference changes establish silent baselines. Real DOM anchors drive noninteractive tile flights; hidden opponent boards use their visible summaries. Effects cannot call rules or networking.

Audio is restrained, initially enabled at 25%, gesture-unlocked Web Audio. Unavailable audio and unavailable browser storage do not block play. Mute cancels scheduled sources. Reduced motion preserves canonical placement and scoring explanations without flights.

`/practice/azul` imports a separate local entry using the same create/apply/view operations. Its seeded openings, marker overflow, scoring and shared-finish fixtures conserve every color. One human switches between seats in settings; there are no bots or multiplayer fixture actions. The route and guide load lazily, and catalog metadata imports no game code. Changing the local workshop language preserves its accepted state and establishes a fresh presentation baseline.

## Primary sources

- [Next Move English rulebook](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf), all six printed pages, including the standard wall setup illustration.
- [Asmodee Spanish rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf), terminology and base rules.
- [Next Move Azul product page](https://www.nextmove-games.com/en/azul/azul-game/), original 2–4-player edition.

Publisher evidence and the independently transcribed wall were locked during the planning phase on 2026-09-12. No publisher artwork or PDFs are included in the repository.

## Validation

Rule tests include independent scoring examples, exact wall mapping, invalid payload/RNG immutability, every marker convention, partial refill, full conserved seeded games for all seat counts, final resolution and ties. Session tests exercise actual Socket.IO delivery, identity binding, concurrent intentions, request deduplication, reconnect, replacement/revoked credentials and rematch generations. Browser tests and inspected visual evidence are recorded in `docs/handoffs/azul.md`; the independent final review and corrections are in [Azul review](../handoffs/azul-review.md).

Actual Safari on macOS/iOS, device touch/audio quality, a multi-human game and fluent Spanish editorial review require human validation and are not established by WebKit automation.
