# UNO rules (preserved Color Match house rules)

An ordered roster contains 2–8 distinct stable `PlayerId` seats. The first seat
starts. Deal seven cards to each player, one at a time in roster order.

The deck contains 108 cards. In each color (Red, Yellow, Green, Blue), include
one zero, two each of 1–9, two Skips, two Reverses and two +2s. Add four Wilds
and four Wild +4s. IDs 0–24 are Red, 25–49 Yellow, 50–74 Green, 75–99 Blue.
Within each group: zero at offset 0, paired numbers at 1–18, Skips at 19–20,
Reverses at 21–22, +2s at 23–24. Wilds are 100–103; Wild +4s are 104–107.

Shuffle ascending IDs using the explicit seed and versioned shuffle algorithm.
The end of the vector is the stock top. After dealing, scan from that end for
the first number and remove it as the opening discard. Other cards retain
their relative order. Its color becomes active. Direction starts clockwise.

On an ordinary turn, match the active color, top number or action symbol.
Either Wild is always playable outside a penalty stack. Both require the
acting player to choose Red, Yellow, Green or Blue in a separate action;
no other ordinary action is legal during color selection. No +4 challenges.
Alternatively draw one, even if a card could be played; drawing ends the turn.

- **Skip:** skip the next seat in the current direction.
- **Reverse:** reverse direction, then advance. With two seats it acts like Skip.
- **+2:** add two to the pending draw amount. A +2 can answer a +2 regardless of
  color, but cannot answer a Wild +4.
- **Wild +4:** add four to the pending amount. It can answer +2 or +4.
- **Pay a penalty:** instead of a legal stack, click the stock to draw the
  accumulated amount and lose the turn. No other plays answer a penalty.

When holding two cards, arm **UNO** before playing. The declaration is submitted
atomically with the play. A declaration with any other hand size is rejected.
An undeclared play leaving one card opens a catch opportunity until the next
accepted play or draw. With a Wild, the opportunity opens after color selection.
Any opponent may catch for a two-card penalty, without consuming their turn.
Rejected actions do not close a catch; the host's accepted order resolves races.
Only one catch can succeed. A catch does not affect a pending draw stack.

Emptying a hand wins. A final Wild needs color selection first. A final-card win
clears pending penalties and catches and ends further stacking. There is no
scoring between rounds.

When stock is empty, retain the top discard and shuffle all earlier discards
into the stock. Draw only what remains if a penalty exceeds available cards,
then clear the penalty. Each empty-stock draw is a pass; a full rotation of
consecutive empty-stock passes ends in a draw. A play or successful draw resets
the pass count, including cards drawn after an UNO catch.

The TypeScript port lives in `games/uno`. The server injects randomness; historical
ChaCha replay/checkpoint formats and browser bots are retired. Shared rooms
support human players, reconnecting seats and rematches. Rule tests cover card
conservation, complete rounds, penalty combinations, catches and invalid actions.

## Invariants

UNO presentation compares consecutive recipient snapshots; opponents' drawn faces are never delivered. Resynchronization cancels obsolete effects.
