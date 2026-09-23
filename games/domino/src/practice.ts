import { seeded } from '@board-games/game-core';
/** Local-only pass-and-play table. Never imported by the server or catalog metadata. */
import { create, apply, view, type State } from './index.js';
export const seats = ['Luis', 'María', 'Carlos', 'Roberto'].map((name, i) => ({
  id: `patio-${i}`,
  name,
  connected: true,
  reservedUntil: null,
}));
export function practice(seed = Date.now()) {
  const random = seeded(seed);
  let state: State = create(
    seats.map((p) => p.id),
    random,
  );
  return {
    players: seats,
    get turn() {
      return seats[state.turn].id;
    },
    view: (id: string) => view(state, id),
    send(id: string, action: unknown) {
      state = apply(state, id, action, random);
    },
  };
}
