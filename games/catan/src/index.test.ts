import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  applyAction,
  legalActions,
  playerView,
  longestRoute,
  produce,
  type Action,
  type State,
} from './index.js';
const rng = () => {
  let x = 42;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
};
const players = ['a', 'b', 'c', 'd', 'e', 'f'];
function setup(n = 3) {
  const random = rng();
  let s = createGame(players.slice(0, n), random);
  while (s.phase.type === 'setup') {
    const p = s.phase.player!;
    s = applyAction(s, p, legalActions(s, p)[0], random);
  }
  return s;
}
function grant(s: State, i: number, r: number[]) {
  r.forEach((n, j) => {
    s.hands[i][j] += n;
    s.bank[j] -= n;
  });
}
test('all board sizes preserve topology, snake setup, resources and component supply', () => {
  for (let n = 3; n <= 6; n++) {
    for (const mode of ['variable', 'beginner'] as const) {
      const s =
        mode === 'variable'
          ? setup(n)
          : createGame(players.slice(0, n), rng(), mode);
      assert.equal(s.board.hexes.length, n > 4 ? 30 : 19);
      assert.equal(s.board.ports.length, n > 4 ? 11 : 9);
      assert.equal(s.roads.filter(Boolean).length, n * 2);
      assert.equal(
        s.buildings.filter(Boolean).length,
        n === 5 && mode === 'beginner' ? 12 : n * 2,
      );
      assert.equal(s.phase.type, 'turn');
      for (let r = 0; r < 5; r++)
        assert.equal(
          s.bank[r] + s.hands.reduce((n, h) => n + h[r], 0),
          n > 4 ? 24 : 19,
        );
    }
  }
});
test('invalid actions cannot mutate state or consume randomness', () => {
  const s = setup(),
    before = structuredClone(s);
  assert.throws(() =>
    applyAction(s, 'outsider', { type: 'ROLL_DICE' }, () => {
      throw Error('random consumed');
    }),
  );
  assert.throws(() =>
    applyAction(s, s.phase.player!, { type: 'BUILD_CITY', vertex: 999 }, () => {
      throw Error('random consumed');
    }),
  );
  assert.deepEqual(s, before);
});
test('recipient views expose only own resource and development identities', () => {
  const s = setup();
  s.development[1].push({ kind: 'VICTORY_POINT', bought: 0 });
  const a = playerView(s, 'a');
  assert.equal(a.public.players[1].points, 2);
  assert.equal(a.public.players[1].development, 1);
  assert.equal(JSON.stringify(a).includes('VICTORY_POINT'), false);
  assert.equal('hands' in a.public, false);
  assert.equal('deck' in a.public, false);
  assert.equal(playerView(s, 'b').private.points, 3);
});
test('extension paired opportunity skips production and disallows player trading', () => {
  let s = setup(6);
  const primary = s.phase.player!;
  s.phase.stage = 'actions';
  s = applyAction(s, primary, { type: 'END_TURN' }, rng());
  assert.equal(s.phase.player, s.players[(s.primary + 3) % 6]);
  assert.equal(s.phase.stage, 'actions');
  assert.equal(s.paired, true);
  assert.throws(() =>
    applyAction(
      s,
      s.phase.player!,
      { type: 'OFFER', give: [1, 0, 0, 0, 0], take: [0, 1, 0, 0, 0] },
      rng(),
    ),
  );
  s = applyAction(s, s.phase.player!, { type: 'END_TURN' }, rng());
  assert.equal(s.paired, false);
  assert.equal(s.phase.stage, 'production');
});
test('broadcast trade requires consent then active confirmation and cannot replay', () => {
  let s = setup();
  const p = s.phase.player!,
    i = s.players.indexOf(p),
    j = (i + 1) % 3,
    q = s.players[j];
  s.phase.stage = 'actions';
  grant(s, i, [2, 0, 0, 0, 0]);
  grant(s, j, [0, 2, 0, 0, 0]);
  s = applyAction(
    s,
    p,
    { type: 'OFFER', give: [1, 0, 0, 0, 0], take: [0, 1, 0, 0, 0], to: null },
    rng(),
  );
  const id = s.offers[0].id,
    before = structuredClone(s.hands);
  s = applyAction(s, q, { type: 'ACCEPT', offer: id }, rng());
  assert.deepEqual(s.hands, before);
  s = applyAction(
    s,
    p,
    { type: 'CONFIRM_TRADE', offer: id, partner: q },
    rng(),
  );
  assert.equal(s.hands[i][0], before[i][0] - 1);
  assert.equal(s.hands[i][1], before[i][1] + 1);
  assert.equal(s.offers.length, 0);
  assert.throws(() =>
    applyAction(s, p, { type: 'CONFIRM_TRADE', offer: id, partner: q }, rng()),
  );
});
test('seven discard validates private quantities and waits for every required player', () => {
  let s = setup();
  s.hands = s.players.map(() => [8, 0, 0, 0, 0]);
  s.bank = [-5, 19, 19, 19, 19];
  const p = s.phase.player!;
  let n = 0;
  s = applyAction(s, p, { type: 'ROLL_DICE' }, () => (n++ === 0 ? 0 : 0.99));
  assert.equal(s.phase.type, 'discard');
  assert.throws(() =>
    applyAction(
      s,
      'a',
      { type: 'DISCARD', resources: [-1, 5, 0, 0, 0] },
      rng(),
    ),
  );
  for (const id of s.players)
    s = applyAction(
      s,
      id,
      { type: 'DISCARD', resources: [4, 0, 0, 0, 0] },
      rng(),
    );
  assert.equal(s.phase.type, 'robber');
  assert.equal(s.phase.player, p);
});
test('knight before rolling resumes production and cannot play a second development', () => {
  let s = setup();
  const p = s.phase.player!,
    i = s.players.indexOf(p);
  s.development[i] = [
    { kind: 'KNIGHT', bought: 0 },
    { kind: 'MONOPOLY', bought: 0 },
  ];
  s = applyAction(s, p, { type: 'KNIGHT' }, rng());
  s = applyAction(s, p, legalActions(s, p)[0], rng());
  if (s.phase.type === 'victim')
    s = applyAction(s, p, legalActions(s, p)[0], rng());
  assert.equal(s.phase.stage, 'production');
  assert.equal(
    legalActions(s, p).some((a) => a.type === 'MONOPOLY'),
    false,
  );
});
test('exact route search counts loop once and opponent building interrupts it', () => {
  const s = setup();
  s.roads.fill(null);
  s.buildings.fill(null);
  const h = s.board.hexes[0];
  for (let c = 0; c < 6; c++) {
    const a = h.vertices[c],
      b = h.vertices[(c + 1) % 6];
    s.roads[s.board.edges.findIndex((e) => e.includes(a) && e.includes(b))] =
      'a';
  }
  assert.equal(longestRoute(s, 'a'), 6);
  s.buildings[h.vertices[0]] = { owner: 'b', city: false, color: 1 };
  s.buildings[h.vertices[3]] = { owner: 'b', city: false, color: 1 };
  assert.equal(longestRoute(s, 'a'), 3);
});
test('production shortages distinguish one recipient from competing recipients', () => {
  const s = setup();
  s.buildings.fill(null);
  const hex = s.board.hexes.findIndex(
    (h) => h.resource !== null && h.vertices.length,
  );
  s.robber = (hex + 1) % s.board.hexes.length;
  const h = s.board.hexes[hex],
    r = h.resource!;
  s.board.hexes.forEach((x, i) => {
    if (i !== hex) x.number = 0;
  });
  s.buildings[h.vertices[0]] = { owner: 'a', city: true, color: 0 };
  s.bank[r] = 1;
  const before = s.hands[0][r];
  produce(s, h.number);
  assert.equal(s.hands[0][r], before + 1);
  s.bank[r] = 1;
  s.buildings[h.vertices[3]] = { owner: 'b', city: false, color: 1 };
  const hands = structuredClone(s.hands);
  produce(s, h.number);
  assert.deepEqual(s.hands, hands);
});
test('winning development purchase exposes winner points only', () => {
  let s = setup();
  const p = s.phase.player!,
    i = s.players.indexOf(p);
  s.phase.stage = 'actions';
  s.development[i] = Array.from({ length: 7 }, () => ({
    kind: 'VICTORY_POINT' as const,
    bought: 0,
  }));
  s.deck.push('VICTORY_POINT');
  grant(s, i, [0, 1, 1, 0, 1]);
  s = applyAction(s, p, { type: 'BUY_DEVELOPMENT' }, rng());
  assert.equal(s.phase.winner, p);
  assert.equal(playerView(s, p).public.players[i].points, 10);
});
test('beginner hands match the preserved Rust published-layout expectations', () => {
  assert.deepEqual(createGame(players.slice(0, 4), rng(), 'beginner').hands, [
    [1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1],
    [0, 0, 1, 2, 0],
    [0, 1, 1, 1, 0],
  ]);
  assert.deepEqual(createGame(players, rng(), 'beginner').hands, [
    [0, 1, 1, 0, 1],
    [0, 1, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [0, 1, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 0, 1, 0],
  ]);
});
test('city upgrades pay exact cost and return a settlement to supply', () => {
  let s = setup();
  const p = s.phase.player!,
    i = s.players.indexOf(p);
  s.phase.stage = 'actions';
  grant(s, i, [0, 0, 2, 0, 3]);
  const before = structuredClone(s.hands[i]),
    action = legalActions(s, p).find((a) => a.type === 'BUILD_CITY')!;
  assert.ok(action);
  s = applyAction(s, p, action, rng());
  assert.equal(s.buildings[action.vertex!]!.city, true);
  assert.equal(s.hands[i][2], before[2] - 2);
  assert.equal(s.hands[i][4], before[4] - 3);
  assert.deepEqual(playerView(s, p).public.players[i].inventory, [13, 4, 3]);
});
test('development purchase eligibility, monopoly, invention and free roads', () => {
  let s = setup();
  const p = s.phase.player!,
    i = s.players.indexOf(p);
  s.phase.stage = 'actions';
  s.development[i] = [{ kind: 'MONOPOLY', bought: s.opportunity }];
  assert.equal(
    legalActions(s, p).some((a) => a.type === 'MONOPOLY'),
    false,
  );
  s.development[i][0].bought = 0;
  const expected = s.hands.reduce((n, h) => n + h[0], 0);
  s = applyAction(s, p, { type: 'MONOPOLY', resource: 0 }, rng());
  assert.equal(s.hands[i][0], expected);
  s.playedThisTurn = false;
  s.development[i] = [{ kind: 'INVENTION', bought: 0 }];
  const before = s.hands[i][1];
  s = applyAction(
    s,
    p,
    { type: 'INVENTION', resources: [0, 2, 0, 0, 0] },
    rng(),
  );
  assert.equal(s.hands[i][1], before + 2);
  s.playedThisTurn = false;
  s.development[i] = [{ kind: 'ROAD_BUILDING', bought: 0 }];
  const hands = structuredClone(s.hands);
  s = applyAction(s, p, { type: 'ROAD_BUILDING' }, rng());
  for (let k = 0; k < 2; k++)
    s = applyAction(s, p, legalActions(s, p)[0], rng());
  assert.deepEqual(s.hands, hands);
  assert.equal(s.roads.filter((owner) => owner === p).length, 4);
  assert.equal(s.phase.type, 'turn');
});

test('complete 3–6 player games reach victory while conserving every resource', () => {
  for (const n of [3, 4, 5, 6]) {
    let seed = 987 + n;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    let s = createGame(
        ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, n),
        random,
        'beginner',
      ),
      steps = 0;
    for (; steps < 12000 && s.phase.type !== 'finished'; steps++) {
      let p = s.phase.player!,
        a: Action;
      if (s.phase.type === 'discard') {
        p = Object.keys(s.phase.pending!)[0];
        const h = s.hands[s.players.indexOf(p)],
          r = [0, 0, 0, 0, 0];
        let count = s.phase.pending![p];
        for (let k = 0; k < 5; k++) {
          r[k] = Math.min(h[k], count);
          count -= r[k];
        }
        a = { type: 'DISCARD', resources: r };
      } else {
        const legal = legalActions(s, p);
        const rank = [
          'BUILD_CITY',
          'BUILD_SETTLEMENT',
          'INVENTION',
          'MONOPOLY',
          'KNIGHT',
          'ROAD_BUILDING',
          'BUY_DEVELOPMENT',
          'BUILD_ROAD',
        ];
        a =
          legal.find((x) => x.type === 'ROLL_DICE') ??
          rank.flatMap((type) => legal.filter((x) => x.type === type))[0] ??
          legal.find((x) => x.type !== 'END_TURN' && x.type !== 'BANK_TRADE')!;
        if (!a) {
          const h = s.hands[s.players.indexOf(p)],
            costs = [
              [0, 0, 2, 0, 3],
              [1, 1, 1, 1, 0],
              [0, 1, 1, 0, 1],
              [1, 0, 0, 1, 0],
            ];
          a = legal
            .filter((x) => x.type === 'BANK_TRADE')
            .find((x) =>
              costs.some(
                (c) =>
                  h[x.take as number] < c[x.take as number] &&
                  h[x.give as number] > c[x.give as number],
              ),
            ) ?? { type: 'END_TURN' };
        }
      }
      s = applyAction(s, p, a, random);
      for (let r = 0; r < 5; r++) {
        if (
          s.bank[r] < 0 ||
          s.hands.some((h) => h[r] < 0) ||
          s.bank[r] + s.hands.reduce((n, h) => n + h[r], 0) !==
            (n > 4 ? 24 : 19)
        )
          throw Error('conservation');
      }
    }
    assert.equal(
      s.phase.type,
      'finished',
      `${n}-player game did not finish in ${steps} actions`,
    );
  }
});
