import type { uno } from './index.js';
export type UnoView = ReturnType<typeof uno.view>;

export const consecutive = (before: UnoView, after: UnoView) =>
  after.public.revision === before.public.revision + 1;

/** Cards a seat holds now beyond what it held before (0 for a seat unseen before). */
export function gained(before: UnoView, seat: { id: string; count: number }) {
  return (
    seat.count -
    (before.public.players.find((p) => p.id === seat.id)?.count ?? seat.count)
  );
}

/** Only recipient-visible differences are used. Opponent draw faces are never available. */
export function movements(before: UnoView, after: UnoView, playerId: string) {
  if (!consecutive(before, after)) return [];
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
    const count = gained(before, seat);
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

/**
 * Players who called UNO in this revision. Only a declared last card leaves a
 * player at one card without being catchable; wild plays resolve after the colour.
 */
export function unoCalls(before: UnoView, after: UnoView) {
  if (!consecutive(before, after)) return [];
  if (after.public.phase === 'color') return [];
  return after.public.players
    .filter((seat) => {
      if (seat.count !== 1 || after.public.catchable === seat.id) return false;
      const was = before.public.players.find((p) => p.id === seat.id)?.count;
      return (
        was === 2 ||
        (was === 1 &&
          before.public.phase === 'color' &&
          before.public.turn === seat.id)
      );
    })
    .map((seat) => seat.id);
}

export function bigDraws(before: UnoView, after: UnoView) {
  if (!consecutive(before, after)) return [];
  return after.public.players.flatMap((seat) => {
    const count = gained(before, seat);
    return count >= 2 ? [{ id: seat.id, count }] : [];
  });
}
