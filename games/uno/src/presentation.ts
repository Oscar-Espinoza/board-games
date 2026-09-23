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

/**
 * Opponent seat centre in % of the table, relative to the viewer (south, index 0).
 * Opponents arc across the top rim; larger tables wrap a little down the sides.
 */
export function seatPosition(index: number, count: number): [number, number] {
  if (count < 3) return [50, 11];
  const spread = count >= 5 ? Math.PI * 0.14 : 0;
  const angle =
    Math.PI - spread + ((index - 1) / (count - 2)) * (Math.PI + spread * 2);
  return [50 + 41 * Math.cos(angle), 52 + 41 * Math.sin(angle)];
}

/**
 * Players who called UNO in this revision. Only a declared last card leaves a
 * player at one card without being catchable; wild plays resolve after the colour.
 */
export function unoCalls(before: UnoView, after: UnoView) {
  if (after.public.revision !== before.public.revision + 1) return [];
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

/** Penalty-sized draws (2+) worth a "+N" bubble, from public counts only. */
export function bigDraws(before: UnoView, after: UnoView) {
  if (after.public.revision !== before.public.revision + 1) return [];
  return after.public.players.flatMap((seat) => {
    const gained =
      seat.count -
      (before.public.players.find((p) => p.id === seat.id)?.count ??
        seat.count);
    return gained >= 2 ? [{ id: seat.id, count: gained }] : [];
  });
}
