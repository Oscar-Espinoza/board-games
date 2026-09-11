import type { uno } from './index.js';
export type UnoView = ReturnType<typeof uno.view>;

/** Only recipient-visible differences are used. Opponent draw faces are never available. */
export function movements(before: UnoView, after: UnoView, playerId: string) {
  if (after.public.revision !== before.public.revision + 1) return [];
  const moves: {
    kind: 'play' | 'draw';
    player: string;
    cardId?: number;
    count: number;
  }[] = [];
  if (before.public.top.id !== after.public.top.id)
    moves.push({
      kind: 'play',
      player: before.public.turn,
      cardId: after.public.top.id,
      count: 1,
    });
  for (const seat of after.public.players) {
    const count =
      seat.count -
      (before.public.players.find((p) => p.id === seat.id)?.count ??
        seat.count);
    if (count <= 0) continue;
    if (seat.id === playerId) {
      const held = new Set(before.private.hand.map((card) => card.id));
      for (const card of after.private.hand)
        if (!held.has(card.id))
          moves.push({
            kind: 'draw',
            player: seat.id,
            cardId: card.id,
            count: 1,
          });
    } else moves.push({ kind: 'draw', player: seat.id, count });
  }
  return moves;
}

/** Fixed seat positions, relative to the viewer. 2–4 players occupy cardinal points. */
export function seatPosition(index: number, count: number) {
  const places: Record<number, [number, number][]> = {
    2: [
      [50, 89],
      [50, 10],
    ],
    3: [
      [50, 89],
      [9, 48],
      [91, 48],
    ],
    4: [
      [50, 89],
      [9, 48],
      [50, 10],
      [91, 48],
    ],
    5: [
      [50, 89],
      [8, 57],
      [25, 11],
      [75, 11],
      [92, 57],
    ],
    6: [
      [50, 89],
      [8, 64],
      [16, 23],
      [50, 9],
      [84, 23],
      [92, 64],
    ],
    7: [
      [50, 89],
      [8, 65],
      [10, 28],
      [34, 9],
      [66, 9],
      [90, 28],
      [92, 65],
    ],
    8: [
      [50, 89],
      [15, 79],
      [8, 46],
      [22, 12],
      [50, 9],
      [78, 12],
      [92, 46],
      [85, 79],
    ],
  };
  return places[count]?.[index] ?? [50, 10];
}
