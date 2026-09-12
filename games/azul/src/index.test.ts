import { test, expect } from 'bun:test';
import {
  create,
  apply,
  view,
  wallColors,
  scorePlacement,
  bonuses,
  refill,
  resolveRound,
  colors,
  rowIssue,
  type State,
  type Color,
  type Action,
} from './index.js';
import { seeded, inventory, fixture } from './practice.js';
const players = ['a', 'b', 'c', 'd'];
const draft = (
  color: Color = 'blue',
  row: number | null = 0,
  source: Action['source'] = { kind: 'factory', index: 0 },
): Action => ({
  type: 'DRAFT',
  source,
  color,
  destination: row === null ? { kind: 'floor' } : { kind: 'pattern', row },
});
function simple() {
  const s = create(players.slice(0, 2), seeded());
  s.turn = 0;
  s.starter = 0;
  s.factories = s.factories.map(() => []);
  s.factories[0] = ['blue', 'blue', 'red', 'yellow'];
  s.factories[1] = ['white'];
  s.center = [];
  return s;
}
const act = (s: State, a: unknown) => apply(s, s.players[s.turn], a, seeded());
function conserved(s: State) {
  expect(inventory(s)).toEqual({
    blue: 20,
    yellow: 20,
    red: 20,
    black: 20,
    white: 20,
  });
  expect(s.boards.every((b) => b.floor.length <= 7 && b.score >= 0)).toBe(true);
  expect(
    s.boards.flatMap((b) => b.floor).filter((c) => c === 'marker').length,
  ).toBeLessThanOrEqual(1);
}
for (const count of [2, 3, 4])
  test(`setup and full seeded conserved ${count}-seat games`, () => {
    for (const seed of [1, 27, 892]) {
      const random = seeded(seed);
      let s = create(players.slice(0, count), random);
      expect(s.factories).toHaveLength(count * 2 + 1);
      expect(s.factories.every((f) => f.length === 4)).toBe(true);
      expect(s.bag).toHaveLength(100 - (count * 2 + 1) * 4);
      let steps = 0;
      while (s.phase !== 'finished' && steps++ < 2000) {
        conserved(s);
        const source: Action['source'] = s.factories.some((f) => f.length)
          ? { kind: 'factory', index: s.factories.findIndex((f) => f.length) }
          : { kind: 'center' };
        const supply =
          source.kind === 'center' ? s.center : s.factories[source.index];
        const color = supply[0];
        const board = s.boards[s.turn];
        const row = board.patterns.findIndex(
          (_, r) => !rowIssue(board, color, r),
        );
        s = apply(
          s,
          s.players[s.turn],
          draft(color, row === -1 ? null : row, source),
          random,
        );
      }
      expect(s.phase).toBe('finished');
      expect(s.winners.length).toBeGreaterThan(0);
      conserved(s);
      expect(view(s).private).toEqual({});
      expect(JSON.stringify(view(s))).not.toContain('"bag":');
    }
  });
test('independent publisher wall transcription', () =>
  expect(wallColors).toEqual([
    ['blue', 'yellow', 'red', 'black', 'white'],
    ['white', 'blue', 'yellow', 'red', 'black'],
    ['black', 'white', 'blue', 'yellow', 'red'],
    ['red', 'black', 'white', 'blue', 'yellow'],
    ['yellow', 'red', 'black', 'white', 'blue'],
  ]));
test('setup deterministic and rejects unsupported or repeated seats', () => {
  expect(create(['a', 'b'], seeded(3))).toEqual(create(['a', 'b'], seeded(3)));
  for (const p of [[], ['a'], ['a', 'a'], ['a', 'b', 'c', 'd', 'e']])
    expect(() => create(p, seeded())).toThrow();
});
test('mixed factory draft is immutable, all of chosen color and spill destinations are exact', () => {
  const s = simple(),
    before = structuredClone(s);
  const next = act(s, draft('blue', 1));
  expect(s).toEqual(before);
  expect(next.boards[0].patterns[1]).toEqual({ color: 'blue', count: 2 });
  expect(next.center).toEqual(['red', 'yellow']);
  expect(next.factories[0]).toEqual([]);
  expect(next.turn).toBe(1);
  expect(next.revision).toBe(1);
  expect(next.events).toEqual([
    {
      type: 'travel',
      reason: 'draft',
      color: 'blue',
      from: 'factory/0/0',
      to: 'a/pattern/1/0',
    },
    {
      type: 'travel',
      reason: 'draft',
      color: 'blue',
      from: 'factory/0/1',
      to: 'a/pattern/1/1',
    },
    {
      type: 'travel',
      reason: 'spill',
      color: 'red',
      from: 'factory/0/2',
      to: 'center/red',
    },
    {
      type: 'travel',
      reason: 'spill',
      color: 'yellow',
      from: 'factory/0/3',
      to: 'center/yellow',
    },
  ]);
});
test('voluntary floor and excess from a short pattern', () => {
  let s = act(simple(), draft('blue', null));
  expect(s.boards[0].floor).toEqual(['blue', 'blue']);
  s = act(simple(), draft('blue', 0));
  expect(s.boards[0].patterns[0].count).toBe(1);
  expect(s.boards[0].floor).toEqual(['blue']);
});
test('center marker is inserted before colored overflow and preserves full-floor next starter', () => {
  for (const count of [0, 6, 7]) {
    const s = simple();
    s.center = ['blue', 'blue'];
    s.boards[0].floor = Array(count).fill('red');
    const next = act(s, draft('blue', null, { kind: 'center' }));
    expect(next.markerOwner).toBe('a');
    expect(next.boards[0].floor).toHaveLength(Math.min(7, count + 3));
    if (count < 7) expect(next.boards[0].floor[count]).toBe('marker');
    else
      expect(next.events[0]).toMatchObject({
        to: 'a/marker',
        reason: 'marker',
      });
    expect(next.discard.length - s.discard.length).toBe(count >= 6 ? 2 : 0);
    expect(next.events[0]).toMatchObject({ color: 'marker' });
  }
});
test('marker only claimed once', () => {
  const s = simple();
  s.center = ['blue', 'blue'];
  s.markerOwner = 'b';
  s.boards[1].floor = ['marker'];
  const next = act(s, draft('blue', null, { kind: 'center' }));
  expect(next.boards[0].floor).toEqual(['blue', 'blue']);
  expect(next.markerOwner).toBe('b');
});
test('all-monochrome round skips a marker-only turn and retains starter', () => {
  const s = simple();
  s.factories = s.factories.map(() => []);
  s.factories[0] = ['blue'];
  s.starter = 1;
  const next = act(s, draft());
  expect(next.roundNumber).toBe(2);
  expect(next.turn).toBe(1);
  expect(next.markerOwner).toBe(null);
});
test('marker owner starts next round', () => {
  const s = simple();
  s.factories = s.factories.map(() => []);
  s.center = ['blue'];
  s.turn = 1;
  const next = act(s, draft('blue', 0, { kind: 'center' }));
  expect(next.turn).toBe(1);
  expect(next.starter).toBe(1);
  expect(next.markerOwner).toBe(null);
  expect(next.boards[1].floor).toEqual([]);
});
test('every malformed intention rejects before mutation or randomness', () => {
  const s = simple(),
    before = structuredClone(s);
  let calls = 0;
  const random = () => {
    calls++;
    return 0.5;
  };
  for (const input of [
    null,
    [],
    {},
    'DRAFT',
    { ...draft(), actor: 'b' },
    { ...draft(), quantity: 1 },
    { ...draft(), color: 'purple' },
    { ...draft(), source: { kind: 'factory', index: -1 } },
    { ...draft(), source: { kind: 'factory', index: 0.5 } },
    { ...draft(), source: { kind: 'factory', index: 5 } },
    { ...draft(), source: { kind: 'center', index: 0 } },
    { ...draft(), destination: { kind: 'pattern', row: 5 } },
    { ...draft(), destination: { kind: 'pattern', row: NaN } },
    { ...draft(), destination: { kind: 'floor', row: 0 } },
    draft('black'),
  ]) {
    expect(() => apply(s, 'a', input, random)).toThrow();
    expect(s).toEqual(before);
  }
  expect(() => apply(s, 'b', draft(), random)).toThrow();
  expect(calls).toBe(0);
});
test('conflicting, full and occupied-wall rows reject', () => {
  for (const kind of ['full', 'mixed', 'wall']) {
    const s = simple();
    if (kind === 'full') s.boards[0].patterns[0] = { color: 'blue', count: 1 };
    if (kind === 'mixed') s.boards[0].patterns[1] = { color: 'red', count: 1 };
    if (kind === 'wall') s.boards[0].wall[1][1] = true;
    const before = structuredClone(s);
    expect(() => act(s, draft('blue', kind === 'full' ? 0 : 1))).toThrow();
    expect(s).toEqual(before);
  }
});
test('isolated, horizontal, vertical and crossing scores; gaps and diagonals excluded', () => {
  const blank = () => Array.from({ length: 5 }, () => Array(5).fill(false));
  let w = blank();
  w[2][2] = true;
  w[1][1] = true;
  expect(scorePlacement(w, 2, 2).points).toBe(1);
  w = blank();
  [0, 1, 2, 3].forEach((c) => (w[2][c] = true));
  expect(scorePlacement(w, 2, 2).points).toBe(4);
  w = blank();
  [1, 2, 3].forEach((r) => (w[r][2] = true));
  expect(scorePlacement(w, 2, 2).points).toBe(3);
  [0, 1, 3].forEach((c) => (w[2][c] = true));
  expect(scorePlacement(w, 2, 2)).toMatchObject({
    horizontal: 4,
    vertical: 3,
    points: 7,
  });
  w = blank();
  w[2][2] = true;
  w[2][4] = true;
  expect(scorePlacement(w, 2, 2).points).toBe(1);
});
test('top-to-bottom transfers include earlier placements and preserve incomplete patterns', () => {
  const s = fixture('scoring');
  const next = act(s, draft());
  const wall = next.events.filter((e) => e.type === 'wall');
  expect(wall.map((e) => e.row)).toEqual([0, 1]);
  expect(wall.map((e) => e.scoring.points)).toEqual([2, 6]);
  expect(next.boards[0].patterns[3]).toEqual({ color: 'red', count: 2 });
  conserved(next);
});
test('floor penalty occurs after wall points, records printed and actual loss, zero clamp', () => {
  const s = simple();
  s.factories = s.factories.map(() => []);
  s.factories[0] = ['blue'];
  s.boards[0].floor = ['red', 'yellow', 'black', 'white'];
  const next = act(s, draft());
  expect(next.boards[0]).toMatchObject({
    score: 0,
    wallPoints: 1,
    floorDeductions: 6,
    floorLoss: 1,
  });
  expect(next.events).toContainEqual({
    type: 'penalty',
    player: 'a',
    deduction: 6,
    loss: 1,
  });
});
test('refill finishes bag before recycling and permits a partial factory on shortage', () => {
  const s = simple();
  s.bag = ['red'];
  s.discard = ['blue', 'blue'];
  s.events = [];
  refill(s, () => 0);
  expect(s.factories[0]).toEqual(['red', 'blue', 'blue']);
  expect(s.factories.slice(1).flat()).toEqual([]);
  expect(s.events).toHaveLength(3);
  expect(s.bag).toEqual([]);
  expect(s.discard).toEqual([]);
});
test('independent bonuses and uncapped score', () => {
  const s = simple();
  const w = s.boards[0].wall;
  w[0] = [true, true, true, true, true];
  for (let r = 0; r < 5; r++) {
    w[r][0] = true;
    w[r][r] = true;
  }
  expect(bonuses(w)).toEqual({ rows: 2, columns: 7, colors: 10 });
  s.boards[0].score = 101;
  resolveRound(s, seeded());
  expect(s.boards[0].score).toBe(120);
});
test('finish resolves every player, shared victory, rejects later actions and cannot add bonuses twice', () => {
  const s = fixture('finish'),
    next = act(s, draft());
  expect(next.phase).toBe('finished');
  expect(next.winners).toEqual(s.players);
  expect(next.boards.map((b) => b.score)).toEqual([16, 16]);
  expect(next.events.filter((e) => e.type === 'wall')).toHaveLength(2);
  const before = structuredClone(next);
  expect(() => act(next, draft())).toThrow();
  expect(next).toEqual(before);
  conserved(next);
});
test('ties compare completed rows, trigger need not win', () => {
  const s = simple();
  s.boards[0].wall[0].fill(true);
  s.boards[1].wall[0].fill(true);
  s.boards[1].wall[1].fill(true);
  s.boards[0].score = 12;
  s.boards[1].score = 10;
  resolveRound(s, seeded());
  expect(s.boards.map((b) => b.score)).toEqual([14, 14]);
  expect(s.winners).toEqual(['b']);
});
test('projection is isolated and bag order never appears in any public event', () => {
  const s = act(simple(), draft('blue', 1)),
    a = view(s),
    b = view(s);
  expect(Object.keys(a.public).sort()).toEqual(
    [
      'players',
      'boards',
      'factories',
      'center',
      'turn',
      'starter',
      'markerOwner',
      'roundNumber',
      'phase',
      'revision',
      'winners',
      'events',
      'bagCount',
      'discardCount',
    ].sort(),
  );
  expect(a.private).toEqual({});
  a.public.boards[0].patterns[1].count = 5;
  a.public.factories[1].push('black');
  (a.public.events[0] as { from: string }).from = 'secret';
  expect(view(s)).toEqual(b);
  expect(JSON.stringify(b)).not.toMatch(
    /"(?:bag|discard|random|token|credentials)":/,
  );
});
for (const scenario of [
  'start2',
  'start4',
  'overflow',
  'scoring',
  'finish',
] as const)
  test(`practice ${scenario} has conserved physical inventory`, () =>
    conserved(fixture(scenario)));
