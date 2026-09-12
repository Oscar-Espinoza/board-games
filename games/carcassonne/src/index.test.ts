import { describe, test, expect } from 'bun:test';
import {
  createGame,
  applyAction,
  playerView,
  supply,
  type State,
} from './index.js';
import { tiles, inventory, modules, presets, edge } from './tiles.js';
import {
  graph,
  points,
  placements,
  legalPlacement,
  node,
  type Placed,
} from './features.js';
import { seeded } from './practice.js';
import { EventGate } from './effects.js';
const tile = (id: string, x: number, y: number, rotation = 0): Placed => ({
  id,
  x,
  y,
  rotation,
  turn: 0,
});
function fixture(board: Placed[], current = 'B') {
  const s = createGame(['a', 'b']);
  s.config = { farmers: true, modules: [...modules], first: 0 };
  s.board = Object.fromEntries(board.map((t) => [`${t.x},${t.y}`, t]));
  s.phase = 'place';
  s.stage = 'place';
  s.turn = 1;
  s.current = current;
  s.deck = ['B', 'B', 'B'];
  s.messages = [1, 2, 3, 4, 5, 6, 7, 8];
  return s;
}
function choose(s: State, kind?: string, target?: string) {
  const p = s.pending!;
  const o = p.options.find(
    (o) => (!kind || o.kind === kind) && (!target || o.target === target),
  )!;
  expect(o).toBeDefined();
  return applyAction(
    s,
    p.actor,
    { type: 'choose', prompt: p.id, choice: o.id },
    seeded(123),
  );
}
function place(s: State, x: number, y: number, rotation = 0) {
  return applyAction(
    s,
    s.players[s.active],
    { type: 'place', turn: s.turn, x, y, rotation },
    seeded(1),
  );
}
describe('inventory and topology', () => {
  test('72 base / 178 full-box landscape tiles; messages are separate', () => {
    expect(inventory([])).toHaveLength(72);
    expect(inventory([...modules])).toHaveLength(178);
    expect(inventory(['inns', 'traders'])).toHaveLength(118);
    for (let mask = 0; mask < 2048; mask++) {
      const enabled = modules.filter((_, i) => mask & (1 << i));
      const deck = inventory(enabled);
      expect(
        deck.every(
          (id) => !tiles[id].edges.includes('V') || enabled.includes('river'),
        ),
      ).toBe(true);
    }
  });
  test('each exterior endpoint and meadow half-edge belongs to exactly one region', () => {
    for (const t of Object.values(tiles)) {
      for (let side = 0; side < 4; side++) {
        const feature = t.regions.filter(
          (r) => r.kind !== 'field' && r.ports.includes(side),
        );
        expect(feature.length, `${t.id}/${side}`).toBe(
          t.edges[side] === 'F' ? 0 : 1,
        );
        for (let half = 0; half < 2; half++)
          expect(
            t.regions.filter(
              (r) => r.kind === 'field' && r.ports.includes(side * 2 + half),
            ).length,
            `${t.id}/field/${side}/${half}`,
          ).toBe(t.edges[side] === 'C' ? 0 : 1);
      }
      for (let r = 0; r < 4; r++)
        for (let side = 0; side < 4; side++)
          expect(edge(t, r, side)).toBe(t.edges[(side - r + 4) % 4]);
    }
  });
  test('city cap above a through road has one upper meadow and one lower meadow', () => {
    const s = fixture([tile('D', 0, 0)]);
    const fs = graph(s).filter((f) => f.kind === 'field');
    expect(fs).toHaveLength(2);
    expect(
      fs.filter(
        (f) =>
          tiles.D.regions.find((r) => f.nodes.includes('0,0/' + r.id))?.cities
            .length,
      ),
    ).toHaveLength(1);
  });
  test('bridge keeps roads separate; road-end monastery has one surrounding field', () => {
    expect(
      graph(fixture([tile('HB', 0, 0)])).filter((f) => f.kind === 'road'),
    ).toHaveLength(2);
    expect(
      graph(fixture([tile('HJ', 0, 0)])).filter((f) => f.kind === 'field'),
    ).toHaveLength(1);
  });
  test('edge matching checks every neighbor and prohibits disconnected placement', () => {
    const s = fixture([tile('D', 0, 0), tile('B', 1, -1)]);
    expect(legalPlacement(s.board, 'E', 0, -1, 2)).toBe(true);
    expect(legalPlacement(s.board, 'U', 0, -1, 0)).toBe(false);
    expect(legalPlacement(s.board, 'B', 8, 8, 0)).toBe(false);
    expect(legalPlacement(s.board, 'B', 0, 0, 0)).toBe(false);
  });
});
describe('authoritative scoring and expansion regressions', () => {
  test('completed tied city awards full points and returns both knights', () => {
    let s = fixture([tile('E', 0, 0)], 'E');
    s.figures = [
      { id: 1, owner: 'a', tile: '0,0', region: 'c0', type: 'meeple' },
      { id: 2, owner: 'b', tile: '0,0', region: 'c0', type: 'meeple' },
    ];
    s = place(s, 0, -1, 2);
    s = choose(s, 'skip');
    while (s.pending?.kind === 'marker') s = choose(s);
    expect(s.scores.a[0]).toBe(4);
    expect(s.scores.b[0]).toBe(4);
    expect(s.figures).toHaveLength(0);
  });
  test('3.1 unfinished inn roads and cathedral cities retain ordinary final points', () => {
    let s = fixture([tile('EA', 0, 0), tile('EKa', 5, 0)]);
    const fs = graph(s);
    expect(
      points(
        fs.find((f) => f.kind === 'road')!,
        true,
      ),
    ).toBe(1);
    expect(
      points(
        fs.find((f) => f.kind === 'city')!,
        true,
      ),
    ).toBe(1);
    expect(
      points({ ...fs.find((f) => f.kind === 'road')!, complete: true }, false),
    ).toBe(2);
  });
  test('goods belong to the completing player, independently of city ownership', () => {
    let s = fixture([tile('HG', 0, 0)], 'N');
    s.figures = [
      { id: 1, owner: 'b', tile: '0,0', region: 'c0', type: 'meeple' },
    ]; // finish its two open city edges with separate caps
    s.board['0,-1'] = tile('E', 0, -1, 2);
    s.current = 'E';
    s = place(s, -1, 0, 1);
    s = choose(s, 'skip');
    expect(s.goods.a).toEqual([0, 1, 0]);
    expect(s.goods.b).toEqual([0, 0, 0]);
  });
  test('builder triggers on extension, returns, and grants an extra turn', () => {
    let s = fixture([tile('U', 0, 0)], 'U');
    s.figures = [
      {
        id: 1,
        owner: 'a',
        tile: '0,0',
        region: 'r0',
        type: 'meeple',
        attachment: 'builder',
      },
    ];
    s = place(s, 0, 1);
    expect(s.figures[0].attachment).toBeUndefined();
    s = choose(s, 'skip');
    expect(s.active).toBe(0);
    expect(s.turn).toBe(2);
    expect(s.events.some((e) => e.kind === 'extra')).toBe(true);
  });
  test('large meeple wins against a single standard meeple', () => {
    const s = fixture([tile('E', 0, 0)]);
    s.figures = [
      { id: 1, owner: 'a', tile: '0,0', region: 'c0', type: 'large' },
      { id: 2, owner: 'b', tile: '0,0', region: 'c0', type: 'meeple' },
    ];
    expect(graph(s).find((f) => f.kind === 'city')!.leaders).toEqual(['a']);
  });
  test('remote occupation blocks deployment into a connected road', () => {
    let s = fixture([tile('U', 0, 0)], 'U');
    s.figures = [
      { id: 1, owner: 'b', tile: '0,0', region: 'r0', type: 'meeple' },
    ];
    s = place(s, 0, 1);
    expect(
      s.pending!.options.filter((o) => o.target === '0,1/r0'),
    ).toHaveLength(0);
  });
  test('ferry graphs split and merge when the connection changes', () => {
    const s = fixture([tile('FerryE', 0, 0)]);
    s.board['0,0'].ferry = ['r0', 'r1'];
    let fs = graph(s).filter((f) => f.kind === 'road');
    expect(fs).toHaveLength(3);
    expect(fs.find((f) => f.nodes.includes('0,0/r0'))!.nodes).toContain(
      '0,0/r1',
    );
    s.board['0,0'].ferry = ['r0', 'r2'];
    fs = graph(s).filter((f) => f.kind === 'road');
    expect(fs.find((f) => f.nodes.includes('0,0/r0'))!.nodes).not.toContain(
      '0,0/r1',
    );
  });
  test('invalid and stale intentions preserve state and never consume randomness', () => {
    const s = fixture([tile('D', 0, 0)]);
    const before = JSON.stringify(s);
    let calls = 0;
    for (const action of [
      { type: 'place', turn: 0, x: 0, y: 1, rotation: 0 },
      { type: 'place', turn: 1, x: 99, y: 99, rotation: 0 },
      { type: 'choose', prompt: 0, choice: '0' },
    ])
      expect(() =>
        applyAction(s, 'a', action, () => {
          calls++;
          return 0.5;
        }),
      ).toThrow();
    expect(() =>
      applyAction(
        s,
        'b',
        { type: 'place', turn: 1, x: 0, y: 1, rotation: 0 },
        () => 0.5,
      ),
    ).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    expect(calls).toBe(0);
  });
  test('projection never leaks future order or aliases canonical objects', () => {
    const s = fixture([tile('D', 0, 0)]);
    const v = playerView(s, 'a');
    const json = JSON.stringify(v);
    for (const hidden of ['"deck":', '"messages":', '"random":', '"seed":'])
      expect(json).not.toContain(hidden);
    v.public.board['0,0'].id = 'B';
    expect(s.board['0,0'].id).toBe('D');
  });
});
test('setup configuration belongs to the authoritative host', () => {
  const random = seeded(12);
  const s = createGame(['a', 'b']);
  const action = {
    type: 'config',
    version: 0,
    config: { farmers: false, modules: [], first: 1 },
  };
  expect(() => applyAction(s, 'b', action, random, { hostId: 'a' })).toThrow();
  const changed = applyAction(s, 'a', action, random, { hostId: 'a' });
  expect(changed.config).toEqual(action.config);
  expect(changed.setupVersion).toBe(1);
});

for (const [preset, count] of [
  ['learn', 3],
  ['base', 3],
  ['classic', 3],
  ['full', 3],
  ['full', 2],
  ['full', 6],
] as const)
  test(`seeded ${preset} ${count}-seat match settles every choice, finishes once and conserves figures`, () => {
    const random = seeded(787);
    let s = createGame(
      Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i)),
    );
    s.config = { ...structuredClone(presets[preset]), first: 0 };
    for (const p of s.players)
      s = applyAction(s, p, { type: 'ready', version: 0 }, random);
    let n = 0;
    while (s.phase !== 'finished' && n++ < 4000) {
      if (s.phase === 'place') {
        const legal = placements(s.board, s.current!);
        const v = legal[Math.floor(random() * legal.length)];
        s = applyAction(
          s,
          s.players[s.active],
          { type: 'place', turn: s.turn, ...v },
          random,
        );
      } else {
        const p = s.pending!;
        const o = p.options[Math.floor(random() * p.options.length)];
        s = applyAction(
          s,
          p.actor,
          { type: 'choose', prompt: p.id, choice: o.id },
          random,
        );
      }
      for (const p of s.players)
        for (const type of ['meeple', 'large', 'abbot'] as const)
          expect(supply(s, p, type)).toBeGreaterThanOrEqual(0);
    }
    expect(s.phase).toBe('finished');
    expect(n).toBeLessThan(4000);
    expect(s.winners.length).toBeGreaterThan(0);
    expect(s.events.filter((e) => e.kind === 'win')).toHaveLength(1);
  }, 30000);
test('presentation establishes a silent snapshot baseline and suppresses old events', () => {
  const gate = new EventGate();
  const event = { id: 1, turn: 1, kind: 'place' };
  expect(gate.take(1, [event])).toEqual([]);
  expect(gate.take(1, [event])).toEqual([]);
  expect(gate.take(1, [event, { ...event, id: 2 }])).toHaveLength(1);
  expect(gate.take(2, [event])).toEqual([]);
});

test('shield city triggers pigs globally and lets the farmer return', () => {
  let s = fixture([tile('M', 0, 0), tile('E', 0, -1, 2)], 'E');
  s.figures = [
    {
      id: 1,
      owner: 'b',
      tile: '0,0',
      region: 'f0',
      type: 'meeple',
      attachment: 'pig',
    },
  ];
  s = place(s, 1, 0, 3);
  s = choose(s, 'skip');
  expect(s.pending?.kind).toBe('pig');
  expect(s.pending?.actor).toBe('b');
  expect(s.turnPoints.b).toBe(3);
  s = choose(s, 'return');
  expect(s.figures).toHaveLength(0);
});
test('gold completion order awards overlapping gold only to the chosen feature owners', () => {
  let s = fixture(
    [
      tile('D', 0, 0),
      tile('E', 0, -1, 2),
      tile('A', 1, 0, 1),
      tile('A', -1, 0, 3),
    ],
    'B',
  );
  s.figures = [
    { id: 1, owner: 'a', tile: '0,0', region: 'r0', type: 'meeple' },
    { id: 2, owner: 'b', tile: '0,0', region: 'c0', type: 'meeple' },
  ];
  s.goldMap['0,0'] = 1;
  s = place(s, 0, 1);
  s = choose(s, 'skip');
  expect(s.pending?.kind).toBe('score');
  s = choose(s, 'score', '0,-1/c0');
  expect(s.gold.b).toBe(1);
  expect(s.gold.a).toBe(0);
});
test('flight commits a server roll, misses without fallback and cannot be replayed', () => {
  let s = fixture([tile('B', 0, 0)], 'FlyG');
  s = place(s, 1, 0);
  const prompt = s.pending!;
  const fly = prompt.options.find((o) => o.kind === 'fly')!;
  let calls = 0;
  const a = { type: 'choose', prompt: prompt.id, choice: fly.id };
  const next = applyAction(s, 'a', a, () => {
    calls++;
    return 0.99;
  });
  expect(calls).toBe(1);
  expect(next.events.find((e) => e.kind === 'flight')?.detail).toBe('3');
  expect(next.figures).toHaveLength(0);
  expect(() =>
    applyAction(next, 'a', a, () => {
      calls++;
      return 0;
    }),
  ).toThrow();
  expect(calls).toBe(1);
});
test('mage adds distinct tile count; witch rounds cathedral points up', () => {
  const s = fixture([tile('Q', 0, 0)]);
  s.magic.mage = '0,0/c0';
  let f = graph(s).find((f) => f.kind === 'city')!;
  expect(points(f)).toBe(5);
  s.magic = { mage: null, witch: '0,0/c0' };
  f = graph(s).find((f) => f.kind === 'city')!;
  expect(points({ ...f, cathedral: true })).toBe(3);
});
function messageFixture(number: number) {
  let s = fixture([tile('Q', 0, 0), tile('U', 3, 0), tile('B', 6, 0)]);
  s.last = '0,0';
  s.phase = 'decision';
  s.stage = 'markers';
  s.turnPoints = { a: 5 };
  s.messages = [number];
  s.pending = {
    id: 1,
    kind: 'marker',
    actor: 'a',
    options: [{ id: '0', kind: 'marker', value: 0 }],
  };
  s.serial = 1;
  s.figureSerial = 3;
  s.figures = [
    { id: 1, owner: 'a', tile: '0,0', region: 'c0', type: 'meeple' },
    { id: 2, owner: 'a', tile: '3,0', region: 'r0', type: 'meeple' },
    { id: 3, owner: 'a', tile: '6,0', region: 'm0', type: 'abbot' },
  ];
  return choose(s);
}
for (let number = 1; number <= 8; number++)
  test(`message ${number} has its own outcome and never draws a second message`, () => {
    let s = messageFixture(number);
    expect(s.pending?.kind).toBe('message');
    const before = s.figures.length;
    s = choose(s, 'message');
    const expected = [7, 6, 6, 5, 7, 7, 5, 7][number - 1];
    expect(s.scores.a[0]).toBe(expected);
    expect(s.figures.length).toBe(number === 8 ? before - 1 : before);
    expect(s.events.filter((e) => e.kind === 'message')).toHaveLength(1);
    if (number === 4) expect(s.active).toBe(0);
  });
test('crop circle participants start left of the active player and clean up attachments', () => {
  let s = fixture([tile('U', 0, 0)], 'CropA');
  s.figures = [
    {
      id: 1,
      owner: 'b',
      tile: '0,0',
      region: 'r0',
      type: 'meeple',
      attachment: 'builder',
    },
  ];
  s = place(s, 0, 1, 2);
  s = choose(s, 'skip');
  expect(s.pending?.kind).toBe('cropMode');
  s = choose(s, 'remove');
  expect(s.pending?.actor).toBe('b');
  s = choose(s, 'return');
  expect(s.figures).toHaveLength(0);
});
test('river setup uses source then lake last; ordinary river tiles never enter river-disabled decks', () => {
  const random = seeded(17);
  let s = createGame(['a', 'b']);
  for (const p of s.players)
    s = applyAction(s, p, { type: 'ready', version: 0 }, random);
  expect(s.board['0,0'].id).toBe('F1');
  const river = [s.current!, ...s.deck].filter((id) =>
    tiles[id].edges.includes('V'),
  );
  expect(river).toHaveLength(13);
  expect(river.at(-1)).toBe('F12');
  expect(
    [...s.deck.slice(13)].every((id) => !tiles[id].edges.includes('V')),
  ).toBe(true);
});

test('fields deduplicate multiple contacts with one city; distinct fields may score that city', () => {
  const s = fixture([tile('F', 0, 0), tile('E', 1, 0, 3), tile('E', -1, 0, 1)]);
  const fs = graph(s).filter(
    (f) => f.kind === 'field' && f.tiles.includes('0,0'),
  );
  expect(fs).toHaveLength(2);
  expect(fs.map((f) => f.cities.length)).toEqual([1, 1]);
  expect(fs.map((f) => points(f, true))).toEqual([3, 3]);
});
test('inns V exposes two distinct, immediately completed short roads', () => {
  const fs = graph(fixture([tile('EV', 0, 0)])).filter(
    (f) => f.kind === 'road' && f.complete,
  );
  expect(fs).toHaveLength(2);
  expect(fs.map((f) => points(f))).toEqual([1, 1]);
});
test('truly unplaceable draw is replaced without consuming random state', () => {
  let s = fixture([tile('B', 0, 0)], 'B');
  s.deck = ['C', 'B'];
  s = place(s, 1, 0);
  s = choose(s, 'skip');
  expect(s.discarded).toBe(1);
  expect(s.current).toBe('B');
  expect(s.events.filter((e) => e.kind === 'discard')).toHaveLength(1);
});
for (const [n, expected] of [
  [1, 1],
  [3, 3],
  [4, 8],
  [6, 12],
  [7, 21],
  [9, 27],
  [10, 40],
])
  test(`final gold quantity ${n} scores ${expected}`, () => {
    let s = fixture([tile('B', 0, 0)]);
    s.gold.a = n;
    s.deck = [];
    s = place(s, 1, 0);
    s = choose(s, 'skip');
    expect(s.phase).toBe('finished');
    expect(s.scores.a[0]).toBe(expected);
  });
test('robbers wrap the physical track, do not deduct victim points, and do not chain', () => {
  let s = createGame(['a', 'b', 'c']);
  s.config = { farmers: true, modules: ['robbers'], first: 0 };
  s.board = { '0,0': tile('B', 0, 0) };
  s.phase = 'decision';
  s.stage = 'markers';
  s.current = 'B';
  s.last = '0,0';
  s.turn = 1;
  s.deck = ['B'];
  s.scores.a = [49, 0];
  s.turnPoints = { a: 4 };
  s.robbers.b = 49;
  s.robbers.c = 0;
  s.pending = {
    id: 1,
    kind: 'marker',
    actor: 'a',
    options: [{ id: '0', kind: 'marker', value: 0 }],
  };
  s = choose(s);
  expect(s.pending?.kind).toBe('reward');
  s = choose(s);
  expect(s.scores.a[0]).toBe(53);
  expect(s.scores.b[0]).toBe(2);
  expect(s.scores.c[0]).toBe(0);
  expect(s.robbers.c).toBe(2);
  expect(s.robbers.b).toBeNull();
});
test('reconnection baselines suppress all offline events before accepting new ones', () => {
  const g = new EventGate();
  const e = { id: 1, turn: 1, kind: 'place' };
  g.take(1, [e]);
  g.take(1, [e], false);
  expect(g.take(1, [e, { ...e, id: 2 }])).toEqual([]);
  expect(g.take(1, [e, { ...e, id: 2 }, { ...e, id: 3 }])).toHaveLength(1);
});

test('a field touching both halves of a joined city counts that city once', () => {
  const s = fixture([
    tile('E', 0, 0),
    tile('E', 0, -1, 2),
    tile('B', 1, 0),
    tile('B', 1, -1),
  ]);
  const fs = graph(s).filter((f) => f.kind === 'field');
  expect(fs).toHaveLength(1);
  expect(fs[0].cities).toHaveLength(1);
  expect(points(fs[0], true)).toBe(3);
});

test('Traders C bridge does not join the city-access road to the crossing road', () => {
  const fs = graph(fixture([tile('HC', 0, 0)]));
  expect(fs.filter((f) => f.kind === 'road')).toHaveLength(2);
  expect(fs.filter((f) => f.kind === 'field')).toHaveLength(4);
});
