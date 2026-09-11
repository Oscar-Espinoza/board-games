import type { GameView } from '@board-games/game-core';
import type { Action, Card, Color } from './index.js';

/** Practice opponents know their own hand and the server's legal choices only. */
export function botAction(view: GameView): Action | null {
  const { hand, legalActions } = view.private as {
    hand: Card[];
    legalActions: Action[];
  };
  const catchUno = legalActions.find((a) => a.type === 'CATCH_UNO');
  if (catchUno) return catchUno;
  const colorChoices = legalActions.filter((a) => a.type === 'CHOOSE_COLOR');
  if (colorChoices.length) {
    const count = (color: Color) =>
      hand.filter((c) => c.color === color).length;
    return colorChoices.sort((a, b) => count(b.color) - count(a.color))[0]!;
  }
  const plays = legalActions.filter((a) => a.type === 'PLAY_CARD');
  // Preserve wild cards where possible; always declare when going down to one.
  plays.sort((a, b) => {
    const wild = (id: number) =>
      Number(hand.find((c) => c.id === id)?.color === null);
    return wild(a.cardId) - wild(b.cardId) || Number(b.uno) - Number(a.uno);
  });
  return plays[0] ?? legalActions.find((a) => a.type === 'DRAW') ?? null;
}
