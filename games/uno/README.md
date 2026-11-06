# UNO

Rules live in `src/index.ts`: the shared room server owns the state, and `view()`
projects public table information plus only the requesting seat's hand and legal
actions (`legalActions`). `src/cards.ts` holds the deck and the card vocabulary
(colours, symbols, and the 8-bit glyph-sheet column order) that rules and table share.
The [UNO house rules](../../docs/rules.md) are the complete retained rules.

Rule rejections are English sentences; the room and the Board show them as is.
**Play solo** creates a private, server-authoritative round with three computer
opponents (`src/bot.ts`). Bots see only their own projected hand and legal choices,
declare UNO, and pause while you disconnect. Reconnect and rematch use the same
room infrastructure as multiplayer.

## Table

`Board.svelte` fills the viewport with the viewer at the south seat; opponents arc
across the top rim and wrap a little down the sides at five or more players.

Accepted consecutive snapshots drive measured card flights (`src/motion.ts`): your
played face travels from its actual hand position to the discard, and stock backs
travel to your hand before revealing their face. Opponent draws use backs only.
Initial snapshots, reconnect, rematch, revision gaps, resize and hidden tabs cancel
stale presentation. Effects never delay or mutate authoritative state.

The UNO button arms a declaration when holding two cards; it is sent atomically
with the play. Sound and card motion have independent, remembered controls; motion
starts from the reduced-motion setting. The paper sound (`src/sound.ts`) starts only
after a browser gesture, and blocked audio never stops gameplay. The 8-bit skin loads
`src/pixel.css` and `src/pixel/sound.ts` the first time it is chosen.
