/** Local-only pass-and-play table. Never imported by the server or catalog metadata. */
import { seeded, type Player } from '@board-games/game-core';
import type { PracticeTable } from '@board-games/shared/ui';
import { create, apply, view, type View } from './index.js';

const players: Player[] = ['Luis', 'María', 'Carlos', 'Roberto'].map(
  (name, i) => ({
    id: `patio-${i}`,
    name,
    connected: true,
    reservedUntil: null,
  }),
);

/** Four seats at one screen; `actor` is whoever is to move. */
export function practice(): PracticeTable<View> {
  const random = seeded(Date.now());
  let state = create(
    players.map((p) => p.id),
    random,
  );
  return {
    players,
    get actor() {
      return players[state.turn].id;
    },
    get finished() {
      return state.phase === 'finished';
    },
    view: (seat: string) => view(state, seat),
    send(seat: string, action: unknown) {
      state = apply(state, seat, action, random);
    },
  };
}
