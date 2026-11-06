# CATAN

Behaviour, rules coverage and controls are in [docs/games/catan.md](../../docs/games/catan.md);
artwork provenance in [docs/games/catan-assets.md](../../docs/games/catan-assets.md).

Source map (`src/`):

- `index.ts` the rules and the recipient `playerView`. `create` accepts optional
  `{ setup: 'variable' | 'beginner' }`. Ordinary actions are checked against
  `legalActions`; offers and discards carry open-ended quantities and validate them
  in their own cases. Rule rejections are English sentences, shown as is.
- `limits.ts` the rule numbers (bank size, offer limit, offer check) the table also reads.
- `board.ts` topology and published layouts. `presentation.ts` the typed events of an
  accepted action; `timing.ts` the pacing that effects and sound share.
- `Board.svelte` the table: SVG island, seats, hand, trade panels. `effects.ts`
  (motion and classic audio), `dice-throw.ts`, `pixel/` and `pixel.css` (the 8-bit
  skin, loaded the first time it is chosen), `table/` (pieces, costs, artwork).
- `practice.ts` the seeded fixtures behind `/practice/catan`; it never creates a room.
