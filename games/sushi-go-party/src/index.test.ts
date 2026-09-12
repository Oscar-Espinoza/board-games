import { describe, expect, test } from 'bun:test';
import {
  apply,
  create,
  view,
  presence,
  assertConservation,
  type State,
  type Pick,
} from './index.js';
import { manifest, face, type Kind, type Played } from './cards.js';
import { presets, validMenu } from './menus.js';
import {
  seeded,
  startPractice,
  demonstrationAction,
  arrangeHand,
} from './practice.js';
import { roundGroups, dessertGroups, onigiriScore } from './scoring.js';
import { EventCursor } from './presentation.js';
const cards = (kind: Kind, count: number, variant = ''): Played[] =>
  Array.from({ length: count }, (_, i) => ({
    ...face(kind, variant),
    id: `test-${kind}-${i}`,
    physical: `test-${kind}-${i}`,
    playedTurn: 1,
    collectedRound: 1,
    boxed: false,
    copied: false,
    wasabi: null,
    copyCanAttach: false,
  }));
const points = (
  table: Played[][],
  kind: Kind,
  seat = 0,
  roll: Kind = 'maki',
  place = 0,
) =>
  roundGroups(table, seat, roll, place)
    .filter((g) => g.kind === kind)
    .reduce((n, g) => n + g.amount, 0);
function pick(
  s: State,
  seat: number,
  index = 0,
  utensils: string[] = [],
  copyTarget?: string,
): Pick {
  const v = view(s, s.players[seat]);
  return {
    type: 'PICK',
    round: s.round,
    turn: s.turn,
    promptId: v.private.pickPromptId!,
    card: v.private.hand[index].handle,
    utensils,
    ...(copyTarget ? { copyTarget } : {}),
  };
}
function firstTurn(s: State, random: () => number) {
  for (let i = 0; i < s.players.length; i++)
    s = apply(s, s.players[i], pick(s, i), random);
  return s;
}
function choose(s: State, choice: unknown, random: () => number) {
  return apply(
    s,
    s.players[s.prompt!.actor],
    {
      type: 'RESOLVE',
      round: s.round,
      turn: s.turn,
      promptId: s.prompt!.id,
      choice,
    },
    random,
  );
}

test('independent full physical inventory and numbered priorities', () => {
  const cs = manifest();
  expect(cs).toHaveLength(181);
  expect(new Set(cs.map((c) => c.physical)).size).toBe(181);
  expect(
    ['egg', 'salmon', 'squid'].map(
      (v) =>
        cs.filter((c) => c.face.kind === 'nigiri' && c.face.variant === v)
          .length,
    ),
  ).toEqual([4, 5, 3]);
  expect(
    ['1', '2', '3'].map(
      (v) =>
        cs.filter((c) => c.face.kind === 'maki' && c.face.variant === v).length,
    ),
  ).toEqual([4, 5, 3]);
  expect(
    cs
      .filter((c) => c.face.priority)
      .map((c) => c.face.priority)
      .sort((a, b) => a - b),
  ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(
    cs
      .filter((c) => c.face.kind === 'fruit')
      .map((c) => c.face.fruit)
      .reduce((out, fs) => out.map((n, i) => n + fs[i]), [0, 0, 0]),
  ).toEqual([10, 10, 10]);
  for (const kind of ['uramaki', 'onigiri', 'fruit'] as Kind[])
    expect(cs.filter((c) => c.face.kind === kind).length).toBe(
      { uramaki: 12, onigiri: 8, fruit: 15 }[kind as 'fruit'],
    );
});
for (let count = 2; count <= 8; count++)
  for (const [name, menu] of Object.entries(presets))
    if (validMenu(menu, count))
      test(`complete seeded ${name}, ${count} seats; every transition conserves physical cards`, () => {
        for (let seed = 1; seed <= 4; seed++) {
          const fixture = startPractice(count, menu, seed * 891 + count);
          let s = fixture.state;
          const r = fixture.random;
          let steps = 0;
          const initial = s.hands[0].length;
          expect(initial).toBe(
            count < 4 ? 10 : count < 6 ? 9 : count < 8 ? 8 : 7,
          );
          while (s.phase !== 'finished' && steps++ < 1000) {
            assertConservation(s);
            let moved = false;
            for (const p of s.players) {
              const action = demonstrationAction(s, p, r);
              if (action) {
                s = apply(s, p, action, r);
                moved = true;
                break;
              }
            }
            if (!moved) throw new Error(`stuck ${JSON.stringify(s.prompt)}`);
          }
          expect(s.phase).toBe('finished');
          assertConservation(s);
          expect(s.round).toBe(3);
          expect(s.winners.length).toBeGreaterThan(0);
          expect(s.receipts).toHaveLength(count * 3);
          for (const p of s.players) {
            const receipts = s.receipts.filter((x) => x.playerId === p);
            expect(
              receipts.reduce((n, r) => n + r.delta + r.immediate, 0),
            ).toBe(s.scores[s.players.indexOf(p)]);
          }
        }
      });

test('invalid menus, malformed actions, stale handles and frozen commitments reject before random use', () => {
  const { state: s, random } = startPractice();
  const before = structuredClone(s);
  let calls = 0;
  const never = () => {
    calls++;
    return random();
  };
  for (const action of [
    null,
    {},
    { type: 'PICK' },
    { ...pick(s, 0), utensils: ['bogus'] },
    { ...pick(s, 0), copyTarget: 'physical-1' },
    { ...pick(s, 0), secret: 'x' },
    { ...pick(s, 0), card: 'old' },
  ])
    expect(() => apply(s, s.players[0], action, never)).toThrow();
  expect(s).toEqual(before);
  expect(calls).toBe(0);
  expect(validMenu({ ...presets.first, specials: ['menu', 'menu'] }, 4)).toBe(
    false,
  );
  expect(validMenu(presets.master, 2)).toBe(false);
  expect(validMenu(presets.two, 8)).toBe(false);
  let next = apply(s, s.players[0], pick(s, 0), random);
  expect(() => apply(next, s.players[0], pick(s, 0), never)).toThrow();
  expect(view(next, s.players[1]).public.committed).toEqual([s.players[0]]);
  const payload = JSON.stringify(view(next, s.players[1]));
  expect(payload).not.toContain(s.hands[0][0].handle);
  expect(payload).not.toContain('physical-');
  expect(payload).not.toContain('commitments');
  expect(calls).toBe(0);
});
test('readiness versions and missing seats preserve pending picks across replacement', () => {
  const r = seeded(41);
  let s = create(['a', 'b'], r);
  s = apply(s, 'a', { type: 'READY', round: 0, version: 0 }, r);
  s = presence(s, ['a', 'b'], 'b');
  expect(s.ready).toEqual([]);
  expect(s.setupVersion).toBe(1);
  expect(() =>
    apply(s, 'b', { type: 'READY', round: 0, version: 0 }, r),
  ).toThrow('sgp_stale');
  for (const p of s.players)
    s = apply(s, p, { type: 'READY', round: 0, version: s.setupVersion }, r);
  s = apply(s, 'a', pick(s, 0), r);
  const copy = structuredClone(s.commitments[0]);
  s = presence(s, ['a']);
  expect(() => apply(s, 'b', pick(s, 1), r)).toThrow('sgp_disconnected');
  s = presence(s, ['a', 'b'], 'b');
  expect(s.commitments[0]).toEqual(copy);
});
test('every hand changes recipient handles on pass and old owners cannot identify cards', () => {
  const f = startPractice();
  const old = f.state.hands.flat().map((c) => c.handle);
  const s = firstTurn(f.state, f.random);
  expect(s.turn).toBe(2);
  for (const c of s.hands.flat()) expect(old).not.toContain(c.handle);
  assertConservation(s);
});
describe('score boundaries', () => {
  for (const [kind, expected] of Object.entries({
    tempura: [0, 0, 5, 5, 10, 10, 15],
    sashimi: [0, 0, 0, 10, 10, 10, 20],
    dumpling: [0, 1, 3, 6, 10, 15, 15],
    eel: [0, -3, 7, 7, 7, 7, 7],
    tofu: [0, 2, 6, 0, 0, 0, 0],
    miso: [0, 3, 6, 9, 12, 15, 18],
  }))
    test(kind, () => {
      expected.forEach((value, n) =>
        expect(points([cards(kind as Kind, n), []], kind as Kind)).toBe(value),
      );
    });
  test('optimal disjoint Onigiri layers', () => {
    expect(onigiriScore(['circle', 'triangle', 'square', 'square'])).toBe(10);
    expect(onigiriScore(['a', 'a', 'b', 'b', 'c', 'd'])).toBe(20);
    expect(onigiriScore([])).toBe(0);
  });
  test('Edamame counts opponents, caps each card at four', () =>
    expect(
      points(
        Array.from({ length: 8 }, () => cards('edamame', 2)),
        'edamame',
      ),
    ).toBe(8));
  test('Tea color semantics, boxed colorlessness and current round dessert scope C5/C6', () => {
    const tea = cards('tea', 1);
    const n = cards('nigiri', 2);
    const dessert = cards('pudding', 1);
    expect(points([[...tea, ...n, ...dessert], []], 'tea')).toBe(2);
    const boxed = cards('tempura', 3).map((c) => ({ ...c, boxed: true }));
    expect(points([[...boxed, ...tea], []], 'tea')).toBe(1);
    expect(points([[...tea, ...n, ...cards('wasabi', 1)], []], 'tea')).toBe(3);
  });
  test('multiple Soy Sauce, full tied ranks, zero Maki and Uramaki', () => {
    expect(
      points(
        [[...cards('soy', 2), ...cards('tea', 1)], cards('eel', 2)],
        'soy',
      ),
    ).toBe(8);
    const maki = (n: number) =>
      cards('maki', 1).map((c) => ({ ...c, icons: n }));
    const table = [maki(5), maki(5), maki(3), maki(1)];
    expect(table.map((_, i) => points(table, 'maki', i))).toEqual([6, 6, 3, 0]);
    expect(points([[], []], 'maki')).toBe(0);
    expect(points([[], []], 'uramaki', 0, 'uramaki')).toBe(0);
  });
  test('all-equal Temaki and Pudding conventions C4', () => {
    expect(points([[], [], []], 'temaki', 0, 'temaki')).toBe(0);
    expect(points([[], []], 'temaki', 0, 'temaki')).toBe(4);
    expect(dessertGroups([[], [], []], 0, 'pudding')[0].amount).toBe(0);
    expect(dessertGroups([[], []], 0, 'pudding')[0].amount).toBe(6);
  });
  test('ice cream quartets, fruit absence and double icons', () => {
    for (let n = 0; n <= 9; n++)
      expect(
        dessertGroups([cards('ice_cream', n), []], 0, 'ice_cream')[0].amount,
      ).toBe(Math.floor(n / 4) * 12);
    expect(dessertGroups([[], []], 0, 'fruit')[0].amount).toBe(-6);
    const fs = cards('fruit', 3).map((c) => ({ ...c, fruit: [2, 0, 0] }));
    expect(dessertGroups([fs, []], 0, 'fruit')[0].amount).toBe(6);
  });
});
test('simultaneous Miso collision, third bonus soup cannot survive, earlier soup survives', () => {
  const f = startPractice(3, {
    ...presets.first,
    specials: ['chopsticks', 'wasabi'],
  });
  let s = f.state;
  const r = f.random;
  arrangeHand(s, 0, ['chopsticks']);
  arrangeHand(s, 1, ['miso']);
  arrangeHand(s, 2, ['tempura']);
  s = firstTurn(s, r);
  const old = s.tableaus[1].find((c) => c.kind === 'miso')!.id;
  arrangeHand(s, 0, ['miso', 'miso']);
  arrangeHand(s, 1, ['miso']);
  arrangeHand(s, 2, ['tempura']);
  s = apply(s, s.players[0], pick(s, 0, 0, [s.tableaus[0][0].id]), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  s = apply(s, s.players[2], pick(s, 2), r);
  expect(s.prompt?.kind).toBe('chopsticks');
  const soup = view(s, s.players[0]).private.prompt!.cards.find(
    (c) => c.kind === 'miso',
  )!;
  s = choose(s, { type: 'card', card: soup.handle }, r);
  expect(
    s.tableaus
      .flat()
      .filter((c) => c.kind === 'miso')
      .map((c) => c.id),
  ).toEqual([old]);
  expect(s.discard.filter((c) => c.kind === 'miso')).toHaveLength(3);
  assertConservation(s);
});
test('Menu offer is saved privately, rejects Menu selection, reconnect does not draw, continuation conserves', () => {
  const f = startPractice(2, presets.sampler);
  let s = f.state;
  arrangeHand(s, 0, ['menu']);
  arrangeHand(s, 1, ['tempura']);
  s = firstTurn(s, f.random);
  expect(s.prompt?.kind).toBe('menu');
  const p = s.prompt!;
  expect(p.offer).toHaveLength(4);
  const v = view(s, s.players[0]);
  expect(view(s, s.players[1]).private.prompt).toBeNull();
  expect(JSON.stringify(view(s, s.players[1]))).not.toContain(
    p.offer[0].handle,
  );
  expect(view(presence(s, s.players), s.players[0])).toEqual(v);
  const snapshot = structuredClone(s);
  expect(() => choose(s, { type: 'card', card: 'bogus' }, f.random)).toThrow();
  expect(s).toEqual(snapshot);
  s = choose(
    s,
    { type: 'card', card: v.private.prompt!.cards[0].handle },
    f.random,
  );
  assertConservation(s);
});
test('Spoon searches left and privately offers distinct variants, exchange preserves physical copy identity', () => {
  const f = startPractice(3, presets.master);
  let s = f.state;
  const r = f.random;
  arrangeHand(s, 0, ['spoon']);
  arrangeHand(s, 1, ['tofu']);
  arrangeHand(s, 2, ['tofu']);
  s = firstTurn(s, r);
  arrangeHand(s, 0, ['tofu']);
  arrangeHand(s, 1, ['tofu', ['nigiri', 'egg'], ['nigiri', 'squid']]);
  arrangeHand(s, 2, ['tofu']);
  s = apply(s, s.players[0], pick(s, 0, 0, [s.tableaus[0][0].id]), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  s = apply(s, s.players[2], pick(s, 2), r);
  s = choose(s, { type: 'request', kind: 'nigiri' }, r);
  expect(s.prompt?.kind).toBe('supplier');
  expect(s.prompt?.actor).toBe(1);
  expect(view(s, s.players[0]).private.prompt).toBeNull();
  const supply = view(s, s.players[1]).private.prompt!;
  const card = supply.cards.find((c) => c.variant === 'egg')!;
  s = choose(s, { type: 'card', card: card.handle }, r);
  expect(
    s.tableaus[0].some((c) => c.kind === 'nigiri' && c.variant === 'egg'),
  ).toBe(true);
  assertConservation(s);
});
test('Special Order freezes copied utensil and reverts when returned C1; fresh copies cannot activate C2', () => {
  const f = startPractice(2, {
    ...presets.original,
    specials: ['chopsticks', 'special_order'],
  });
  let s = f.state;
  const r = f.random;
  arrangeHand(s, 0, ['chopsticks']);
  arrangeHand(s, 1, ['tempura']);
  s = firstTurn(s, r);
  const original = s.tableaus[0][0];
  arrangeHand(s, 0, ['special_order']);
  arrangeHand(s, 1, ['tempura']);
  s = apply(s, s.players[0], pick(s, 0, 0, [], original.id), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  const copy = s.tableaus[0].find((c) => c.copied)!;
  expect(copy.kind).toBe('chopsticks');
  expect(copy.priority).toBe(original.priority);
  arrangeHand(s, 0, ['tempura']);
  arrangeHand(s, 1, ['tempura']);
  s = apply(s, s.players[0], pick(s, 0, 0, [original.id, copy.id]), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  expect(s.prompt?.card).toBe(original.id);
  s = choose(
    s,
    {
      type: 'card',
      card: view(s, s.players[0]).private.prompt!.cards.find(
        (c) => c.kind !== 'special_order',
      )!.handle,
    },
    r,
  );
  expect(s.prompt?.card).toBe(copy.id);
  s = choose(
    s,
    {
      type: 'card',
      card: view(s, s.players[0]).private.prompt!.cards.find(
        (c) => c.kind !== 'special_order',
      )!.handle,
    },
    r,
  );
  expect(
    s.hands[1].some(
      (c) => c.physical === copy.physical && c.face.kind === 'special_order',
    ),
  ).toBe(true);
  assertConservation(s);
});
test('Special Order first turn discards instead of deadlocking', () => {
  const f = startPractice(2, presets.two);
  arrangeHand(f.state, 0, ['special_order']);
  arrangeHand(f.state, 1, ['tofu']);
  const s = firstTurn(f.state, f.random);
  expect(s.turn).toBe(2);
  expect(s.discard.some((c) => c.kind === 'special_order')).toBe(true);
  assertConservation(s);
});
test('Takeout independently breaks Wasabi links and allows later attachment C3', () => {
  for (const what of ['nigiri', 'wasabi', 'both']) {
    const f = startPractice(2, {
      ...presets.original,
      specials: ['wasabi', 'takeout'],
    });
    let s = f.state;
    const r = f.random;
    arrangeHand(s, 0, ['wasabi']);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    arrangeHand(s, 0, [['nigiri', 'squid']]);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    expect(points(s.tableaus, 'nigiri')).toBe(9);
    const wasabi = s.tableaus[0].find((c) => c.kind === 'wasabi')!,
      nigiri = s.tableaus[0].find((c) => c.kind === 'nigiri')!;
    arrangeHand(s, 0, ['takeout']);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    s = choose(
      s,
      {
        type: 'takeout',
        cards:
          what === 'both'
            ? [wasabi.id, nigiri.id]
            : [what === 'nigiri' ? nigiri.id : wasabi.id],
      },
      r,
    );
    expect(points(s.tableaus, 'nigiri')).toBe(what === 'wasabi' ? 3 : 0);
    arrangeHand(s, 0, [['nigiri', 'egg']]);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    expect(points(s.tableaus, 'nigiri')).toBe(
      what === 'nigiri' ? 3 : what === 'wasabi' ? 4 : 1,
    );
    assertConservation(s);
  }
});
test('Uramaki tied primary crossings consume places, bonus uses next award, no duplicated receipt delta', () => {
  const f = startPractice(3, {
    ...presets.points,
    specials: ['chopsticks', 'tea'],
  });
  let s = f.state;
  const r = f.random;
  for (let i = 0; i < 3; i++) arrangeHand(s, i, [['uramaki', '5']]);
  s = firstTurn(s, r);
  arrangeHand(s, 0, [['uramaki', '5']]);
  arrangeHand(s, 1, [['uramaki', '4']]);
  arrangeHand(s, 2, [['uramaki', '4']]);
  s = firstTurn(s, r);
  expect(s.scores).toEqual([8, 0, 0]);
  expect(s.uramakiPlace).toBe(1);
  arrangeHand(s, 0, ['dumpling']);
  arrangeHand(s, 1, [['uramaki', '3']]);
  arrangeHand(s, 2, [['uramaki', '3']]);
  s = firstTurn(s, r);
  expect(s.scores).toEqual([8, 5, 5]);
  expect(s.uramakiPlace).toBe(3);
  assertConservation(s);
});
test('event cursor skips reconnect, gap and match changes', () => {
  const c = new EventCursor();
  const p = {
    sequence: 3,
    round: 1,
    turn: 1,
    events: [{ type: 'committed' as const, seat: 'a' }],
  };
  expect(c.take('match-1', p)).toEqual([]);
  expect(c.take('match-1', { ...p, sequence: 4 })).toHaveLength(1);
  expect(c.take('match-1', { ...p, sequence: 7 })).toEqual([]);
  expect(c.take('match-2', { ...p, sequence: 8 })).toEqual([]);
});

test('copying unattached Nigiri offers optional attachment; copied attached source cannot attach', () => {
  for (const attachSource of [false, true]) {
    const f = startPractice(
      2,
      { ...presets.original, specials: ['wasabi', 'special_order'] },
      133,
    );
    let s = f.state;
    const r = f.random;
    arrangeHand(s, 0, [attachSource ? 'wasabi' : ['nigiri', 'egg']]);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    arrangeHand(s, 0, [attachSource ? ['nigiri', 'egg'] : 'wasabi']);
    arrangeHand(s, 1, ['tempura']);
    s = firstTurn(s, r);
    if (attachSource) {
      arrangeHand(s, 0, ['wasabi']);
      arrangeHand(s, 1, ['tempura']);
      s = firstTurn(s, r);
    }
    const target = s.tableaus[0].find((c) => c.kind === 'nigiri')!;
    arrangeHand(s, 0, ['special_order']);
    arrangeHand(s, 1, ['tempura']);
    s = apply(s, s.players[0], pick(s, 0, 0, [], target.id), r);
    s = apply(s, s.players[1], pick(s, 1), r);
    if (attachSource) {
      expect(s.prompt).toBeNull();
      expect(s.tableaus[0].find((c) => c.copied)!.wasabi).toBeNull();
    } else {
      expect(s.prompt?.kind).toBe('attach');
      s = choose(s, { type: 'attach', wasabi: null }, r);
      expect(s.tableaus[0].find((c) => c.copied)!.wasabi).toBeNull();
    }
    assertConservation(s);
  }
});
test('copied dessert is retained with its physical Special Order out of later decks', () => {
  const f = startPractice(2, { ...presets.two, dessert: 'pudding' }, 93);
  let s = f.state;
  const r = f.random;
  arrangeHand(s, 0, ['pudding']);
  arrangeHand(s, 1, ['tofu']);
  s = firstTurn(s, r);
  arrangeHand(s, 0, ['special_order']);
  arrangeHand(s, 1, ['tofu']);
  s = apply(s, s.players[0], pick(s, 0, 0, [], s.tableaus[0][0].id), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  const copied = s.tableaus[0].find((c) => c.copied)!;
  expect(copied.kind).toBe('pudding');
  while (s.round === 1) {
    for (const p of s.players) {
      const action = demonstrationAction(s, p, r);
      if (action) {
        s = apply(s, p, action, r);
        break;
      }
    }
    assertConservation(s);
  }
  expect(
    s.desserts[0].some(
      (c) => c.physical === copied.physical && c.kind === 'pudding',
    ),
  ).toBe(true);
  expect(
    [...s.deck, ...s.hands.flat()].some((c) => c.physical === copied.physical),
  ).toBe(false);
});
test('boxed source leaves existing copy intact and copied boxed card is colorless C6', () => {
  const f = startPractice(
    2,
    { ...presets.original, specials: ['special_order', 'takeout'] },
    231,
  );
  let s = f.state;
  const r = f.random;
  arrangeHand(s, 0, ['dumpling']);
  arrangeHand(s, 1, ['tempura']);
  s = firstTurn(s, r);
  const source = s.tableaus[0][0];
  arrangeHand(s, 0, ['special_order']);
  arrangeHand(s, 1, ['tempura']);
  s = apply(s, s.players[0], pick(s, 0, 0, [], source.id), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  const copy = s.tableaus[0].find((c) => c.copied)!;
  arrangeHand(s, 0, ['takeout']);
  arrangeHand(s, 1, ['tempura']);
  s = firstTurn(s, r);
  s = choose(s, { type: 'takeout', cards: [source.id] }, r);
  expect(ownCard(s, copy.id).boxed).toBe(false);
  expect(points(s.tableaus, 'dumpling')).toBe(1);
  arrangeHand(s, 0, ['special_order']);
  arrangeHand(s, 1, ['tempura']);
  s = apply(s, s.players[0], pick(s, 0, 0, [], source.id), r);
  s = apply(s, s.players[1], pick(s, 1), r);
  expect(points(s.tableaus, 'boxed' as Kind)).toBe(4);
  assertConservation(s);
});
function ownCard(s: State, id: string) {
  return s.tableaus.flat().find((c) => c.id === id)!;
}
test('failed Spoon is discarded and exact variant requests need no supplier choice', () => {
  for (const requested of ['egg', 'squid']) {
    const f = startPractice(3, presets.master, 401);
    let s = f.state;
    const r = f.random;
    arrangeHand(s, 0, ['spoon']);
    arrangeHand(s, 1, ['tofu']);
    arrangeHand(s, 2, ['tofu']);
    s = firstTurn(s, r);
    const spoon = s.tableaus[0][0];
    // Move all squid to the unused deck without manufacturing cards.
    for (let i = 1; i < s.players.length; i++)
      for (let j = 0; j < s.hands[i].length; j++)
        if (s.hands[i][j].face.variant === 'squid') {
          const k = s.deck.findIndex(
            (c) => c.face.kind === 'tofu' || c.face.kind === 'sashimi',
          );
          const old = s.hands[i][j];
          s.hands[i][j] = { ...s.deck[k], handle: old.handle };
          s.deck[k] = { physical: old.physical, face: old.face };
        }
    arrangeHand(s, 0, ['tofu']);
    arrangeHand(s, 1, ['tofu', ['nigiri', 'egg']]);
    arrangeHand(s, 2, ['tofu']);
    s = apply(s, s.players[0], pick(s, 0, 0, [spoon.id]), r);
    s = apply(s, s.players[1], pick(s, 1), r);
    s = apply(s, s.players[2], pick(s, 2), r);
    s = choose(s, { type: 'request', kind: 'nigiri', variant: requested }, r);
    expect(s.prompt).toBeNull();
    if (requested === 'squid')
      expect(s.discard.some((c) => c.physical === spoon.physical)).toBe(true);
    else
      expect(
        s.tableaus[0].some((c) => c.kind === 'nigiri' && c.variant === 'egg'),
      ).toBe(true);
    assertConservation(s);
  }
});
