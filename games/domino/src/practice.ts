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
let tables = 0;

/** Four seats at one screen; `actor` is whoever is to move. */
export function practice() {
  const random = seeded(Date.now());
  let state = create(
    players.map((p) => p.id),
    random,
  );
  return {
    /** A new match restarts revision counts, so a Board keys its round on this. */
    generation: ++tables,
    players,
    get actor() {
      return players[state.turn].id;
    },
    view: (seat: string) => view(state, seat),
    send(seat: string, action: unknown) {
      state = apply(state, seat, action, random);
    },
  } satisfies PracticeTable<View> & { generation: number };
}
