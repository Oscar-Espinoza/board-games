import { seeded } from '@board-games/game-core';
/** Local-only, conserved fixtures. Never imported by server or catalog metadata. */
import {
  create,
  apply,
  view,
  colors,
  wallColors,
  type State,
  type Color,
} from './index.js';
export const seats = ['Ada', 'Bea', 'Clara', 'Diego'].map((name, i) => ({
  id: `workshop-${i}`,
  name,
  connected: true,
  reservedUntil: null,
}));
export const scenarios = [
  'start2',
  'start4',
  'start3',
  'crowded',
  'cleanup',
  'no_wall',
  'cross100',
  'overflow',
  'scoring',
  'finish',
] as const;
export type Scenario = (typeof scenarios)[number];
export function inventory(s: State) {
  const total = Object.fromEntries(colors.map((c) => [c, 0])) as Record<
    Color,
    number
  >;
  const add = (color: Color) => total[color]++;
  [...s.bag, ...s.discard, ...s.factories.flat(), ...s.center].forEach(add);
  s.boards.forEach((b) => {
    b.patterns.forEach((p) => {
      if (p.color) total[p.color] += p.count;
    });
    b.wall.forEach((row, r) =>
      row.forEach((occupied, c) => {
        if (occupied) add(wallColors[r][c]);
      }),
    );
    b.floor.forEach((c) => {
      if (c !== 'marker') add(c);
    });
  });
  return total;
}
export function fixture(scenario: Scenario = 'start2'): State {
  const s = create(
    seats
      .slice(0, scenario === 'start4' ? 4 : scenario === 'start3' ? 3 : 2)
      .map((p) => p.id),
    seeded(492),
  );
  s.turn = 0;
  s.starter = 0;
  if (scenario === 'start2' || scenario === 'start4' || scenario === 'start3')
    return s;
  s.factories = s.factories.map(() => []);
  s.center = [];
  s.bag = [];
  s.discard = [];
  if (scenario === 'crowded') {
    s.center = colors.flatMap((c) => Array<Color>(12).fill(c));
    s.factories[0] = ['blue', 'yellow', 'red', 'white'];
  } else if (scenario === 'cleanup' || scenario === 'no_wall') {
    s.center = ['blue', 'blue'];
    s.boards[0].floor = ['red', 'yellow'];
    s.boards[0].score = s.boards[0].wallPoints = 2;
    if (scenario === 'cleanup') {
      s.boards[0].patterns[1] = { color: 'blue', count: 1 };
      s.boards[0].patterns[3] = { color: 'red', count: 4 };
      s.boards[1].patterns[4] = { color: 'yellow', count: 5 };
      s.boards[1].floor = ['white', 'black'];
    }
  } else if (scenario === 'overflow') {
    s.center = ['blue', 'blue', 'blue', 'blue', 'yellow', 'red'];
    s.factories[0] = ['white', 'black', 'white', 'black'];
    s.boards[0].floor = ['red', 'yellow', 'black', 'white', 'red', 'yellow'];
    s.boards[0].patterns[1] = { color: 'blue', count: 1 };
  } else if (scenario === 'scoring') {
    s.factories[0] = ['blue'];
    const b = s.boards[0];
    b.wall[1][0] = true;
    b.wall[1][2] = true;
    b.wall[1][3] = true;
    b.wall[2][1] = true;
    b.patterns[1] = { color: 'blue', count: 2 };
    b.patterns[3] = { color: 'red', count: 2 };
    b.score = b.wallPoints = 5;
  } else {
    s.factories[0] = ['blue'];
    s.boards.forEach((b, i) => {
      b.wall[0] = [false, true, true, true, true];
      b.score = b.wallPoints = scenario === 'cross100' ? 99 : 9;
      if (i) b.patterns[0] = { color: 'blue', count: 1 };
    });
  }
  const used = inventory(s);
  for (const c of colors) {
    if (used[c] > 20) throw new Error('Invalid practice inventory');
    s.bag.push(...Array<Color>(20 - used[c]).fill(c));
  }
  return s;
}
export function practice(scenario: Scenario = 'start2') {
  const random = seeded(789);
  let state = fixture(scenario);
  return {
    get actor() {
      return state.players[state.turn];
    },
    get players() {
      return seats.filter((p) => state.players.includes(p.id));
    },
    view: (seat: string) => view(state, seat),
    send: (seat: string, action: unknown) => {
      state = apply(state, seat, action, random);
    },
  };
}
