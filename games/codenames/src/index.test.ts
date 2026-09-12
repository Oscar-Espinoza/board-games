import { describe, test, expect } from 'bun:test';
import { create, apply, view, presence } from './index.js';
import { words } from './words.js';
import { seeded } from './practice.js';
import { eventGate } from './presentation.js';
import type { State, Team } from './types.js';
const ids = ['rs', 'ro', 'bs', 'bo'];
function setup(seed = 1, size = 4) {
  const random = seeded(seed);
  let s = create(
    [...ids, ...['r2', 'b2', 'r3', 'b3'].slice(0, size - 4)],
    random,
  );
  for (const [i, p] of s.players.entries())
    s = apply(
      s,
      p,
      {
        type: 'chooseRole',
        team: i < 2 || (i >= 4 && i % 2 === 0) ? 'red' : 'blue',
        role: i === 0 || i === 2 ? 'spymaster' : 'operative',
        version: s.setupVersion,
      },
      random,
    );
  return s;
}
function dealt(seed = 1) {
  let s = setup(seed);
  const random = seeded(seed);
  for (const p of ids)
    s = apply(s, p, { type: 'ready', version: s.setupVersion }, random);
  return s;
}
function actor(s: State, role = 'spymaster', opponent = false) {
  return s.players.find(
    (p) =>
      s.assignments[p]!.role === role &&
      (opponent
        ? s.assignments[p]!.team !== s.activeTeam
        : s.assignments[p]!.team === s.activeTeam),
  )!;
}
function action(s: State, p: string, a: unknown) {
  return apply(s, p, a, seeded(33));
}
function guessing(s = dealt(), count: number | 'unlimited' = 2) {
  s = action(s, actor(s), { type: 'submitClue', word: 'Ocean', count });
  return action(s, actor(s, 'spymaster', true), {
    type: 'reviewClue',
    allow: true,
  });
}
function reject(s: State, p: string, a: unknown) {
  const before = JSON.stringify(s);
  expect(() => action(s, p, a)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
describe('Codenames authoritative rules', () => {
  test('original packs are broad, NFC-distinct and server-only', () => {
    for (const pack of Object.values(words)) {
      expect(pack.length).toBeGreaterThanOrEqual(200);
      expect(
        new Set(pack.map((w) => w.normalize('NFC').toLocaleLowerCase())).size,
      ).toBe(pack.length);
      expect(pack.every((w) => w.length > 0 && w.length <= 24)).toBe(true);
    }
  });
  test('setup has no board/key; seeded correct counts and both starting teams', () => {
    expect(create(ids, seeded(1)).board).toEqual([]);
    expect(view(setup(), 'rs').private.key).toBeUndefined();
    const teams = new Set<Team>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = dealt(seed);
      teams.add(s.activeTeam);
      expect(new Set(s.board.map((c) => c.word)).size).toBe(25);
      expect(s.board.filter((c) => c.identity === s.activeTeam)).toHaveLength(
        9,
      );
      expect(s.board.filter((c) => c.identity === 'assassin')).toHaveLength(1);
      expect(s.board.filter((c) => c.identity === 'civilian')).toHaveLength(7);
      expect(s).toEqual(dealt(seed));
    }
    expect(teams.size).toBe(2);
  });
  test('contested roles, version checks, incomplete teams, readiness invalidation and 8 seats', () => {
    let s = create(ids, seeded(1));
    reject(s, 'rs', { type: 'ready', version: 0 });
    s = action(s, 'rs', {
      type: 'chooseRole',
      team: 'red',
      role: 'spymaster',
      version: 0,
    });
    reject(s, 'ro', {
      type: 'chooseRole',
      team: 'red',
      role: 'spymaster',
      version: 1,
    });
    reject(s, 'ro', {
      type: 'chooseRole',
      team: 'blue',
      role: 'operative',
      version: 0,
    });
    s = setup();
    s = action(s, 'rs', { type: 'ready', version: s.setupVersion });
    s = action(s, 'ro', {
      type: 'chooseRole',
      team: 'blue',
      role: 'operative',
      version: s.setupVersion,
    });
    expect(s.ready).toEqual([]);
    expect(s.setupVersion).toBe(5);
    expect(setup(1, 8).players).toHaveLength(8);
  });
  test('presence clears consent and prevents a disconnected deal, replacement increments version', () => {
    let s = setup();
    s = action(s, 'rs', { type: 'ready', version: s.setupVersion });
    s = presence(s, ['ro', 'bs', 'bo']);
    expect(s.ready).toEqual([]);
    reject(s, 'ro', { type: 'ready', version: s.setupVersion });
    const replacement = presence(s, ids, 'rs');
    expect(replacement.setupVersion).toBe(s.setupVersion + 1);
    expect(replacement.assignments).toEqual(s.assignments);
    const live = dealt();
    expect(presence(live, [])).toBe(live);
  });
  test('clue Unicode normalized; malformed input rejects but exact words and multiword clues are reviewed', () => {
    let s = dealt();
    const p = actor(s);
    for (const word of ['', '  ', 'a\u200bb', 'a\n', 'a'.repeat(81)])
      reject(s, p, { type: 'submitClue', word, count: 1 });
    for (const count of [-1, 10, 1.5, '1', Infinity, NaN])
      reject(s, p, { type: 'submitClue', word: 'word', count });
    s = action(s, p, {
      type: 'submitClue',
      word: '  Cafe\u0301 del mar  ',
      count: 0,
    });
    expect(s.clue?.word).toBe('Café del mar');
    expect(s.phase).toBe('clueReview');
    const exact = dealt();
    expect(
      action(exact, actor(exact), {
        type: 'submitClue',
        word: exact.board[0]!.word,
        count: 9,
      }).phase,
    ).toBe('clueReview');
  });
  test('review permissions, no guessing before approval, rejection benefit and skip', () => {
    let s = dealt();
    s = action(s, actor(s), { type: 'submitClue', word: 'sky', count: 2 });
    reject(s, actor(s, 'operative'), { type: 'guess', card: 0 });
    reject(s, actor(s), { type: 'reviewClue', allow: true });
    s = action(s, actor(s, 'spymaster', true), {
      type: 'reviewClue',
      allow: false,
    });
    const p = actor(s, 'spymaster', true);
    reject(s, p, {
      type: 'takePenalty',
      card: s.board.findIndex((c) => c.identity === s.activeTeam),
    });
    expect(action(s, p, { type: 'takePenalty', card: null }).phase).toBe(
      'clue',
    );
    const own = s.board.findIndex((c) => c.identity === s.assignments[p]!.team);
    const n = action(s, p, { type: 'takePenalty', card: own });
    expect(n.board[own]!.revealed).toBe(true);
    expect(n.activeTeam).not.toBe(s.activeTeam);
    reject(n, p, { type: 'reviewClue', allow: true });
  });
  test('finite budget plus one, mandatory first guess, unlimited and zero stop rules', () => {
    for (const count of [0, 'unlimited', 1] as const) {
      let s = guessing(dealt(), count);
      reject(s, actor(s, 'operative'), { type: 'endTurn' });
      reject(s, actor(s), { type: 'guess', card: 0 });
      const active = s.activeTeam;
      for (let i = 0; i < 2; i++) {
        s = action(s, actor(s, 'operative'), {
          type: 'guess',
          card: s.board.findIndex((c) => !c.revealed && c.identity === active),
        });
      }
      expect(s.phase).toBe(count === 1 ? 'clue' : 'guessing');
      if (count !== 1) {
        expect(s.budget.kind).toBe('unlimited');
        s = action(s, actor(s, 'operative'), { type: 'endTurn' });
        expect(s.activeTeam).not.toBe(active);
      }
    }
  });
  test('civilian and enemy immediately hand off; every malformed card rejects unchanged', () => {
    for (const kind of ['civilian', 'enemy']) {
      const s = guessing();
      const index = s.board.findIndex((c) =>
        kind === 'civilian'
          ? c.identity === 'civilian'
          : c.identity !== s.activeTeam && ['red', 'blue'].includes(c.identity),
      );
      const n = action(s, actor(s, 'operative'), {
        type: 'guess',
        card: index,
      });
      expect(n.phase).toBe('clue');
      expect(n.activeTeam).not.toBe(s.activeTeam);
    }
    const s = guessing();
    for (const card of [-1, 25, 1.3, NaN, '0', null])
      reject(s, actor(s, 'operative'), { type: 'guess', card });
    const own = s.board.findIndex((c) => c.identity === s.activeTeam);
    const n = action(s, actor(s, 'operative'), { type: 'guess', card: own });
    reject(n, actor(n, 'operative'), { type: 'guess', card: own });
  });
  test('assassin, last agent, enemy last agent and penalty win resolve before handoff', () => {
    for (const scenario of ['assassin', 'own', 'enemy', 'penalty']) {
      let s = guessing();
      const target: Team =
        scenario === 'enemy' || scenario === 'penalty'
          ? s.activeTeam === 'red'
            ? 'blue'
            : 'red'
          : s.activeTeam;
      let card = s.board.findIndex(
        (c) => c.identity === (scenario === 'assassin' ? 'assassin' : target),
      );
      if (scenario !== 'assassin')
        for (const [i, c] of s.board.entries())
          if (c.identity === target && i !== card) c.revealed = true;
      if (scenario === 'penalty') s.phase = 'penalty';
      const n = action(
        s,
        actor(
          s,
          scenario === 'penalty' ? 'spymaster' : 'operative',
          scenario === 'penalty',
        ),
        { type: scenario === 'penalty' ? 'takePenalty' : 'guess', card },
      );
      expect(n.phase).toBe('finished');
      expect(n.result?.team).toBe(
        scenario === 'assassin'
          ? s.activeTeam === 'red'
            ? 'blue'
            : 'red'
          : target,
      );
      expect(view(n, 'ro').public.board.every((c) => c.identity)).toBe(true);
      reject(n, 'rs', { type: 'submitClue', word: 'later', count: 1 });
    }
  });
  test('metamorphic privacy: unseen key permutations do not alter any operative projection', () => {
    const s = guessing(),
      other = structuredClone(s);
    const temp = other.board[0]!.identity;
    other.board[0]!.identity = other.board[1]!.identity;
    other.board[1]!.identity = temp;
    for (const p of ['ro', 'bo']) {
      expect(JSON.stringify(view(s, p))).toBe(JSON.stringify(view(other, p)));
      expect(view(s, p).private.key).toBeUndefined();
      expect(view(s, p).public.board.every((c) => !('identity' in c))).toBe(
        true,
      );
    }
    const changed = structuredClone(s);
    changed.board.reverse();
    expect(view(s, 'rs').private.key).not.toEqual(
      view(changed, 'rs').private.key,
    );
    expect(JSON.stringify(view(s, 'ro'))).not.toContain('packVersion');
  });
  test('accepted setup actions clear event batch; history bounded and projections detached', () => {
    let s = setup();
    s = action(s, 'rs', { type: 'ready', version: s.setupVersion });
    expect(s.events).toEqual([]);
    let n = dealt();
    for (let i = 0; i < 110; i++) {
      n = action(n, actor(n), { type: 'submitClue', word: 'again', count: 1 });
      n = action(n, actor(n, 'spymaster', true), {
        type: 'reviewClue',
        allow: false,
      });
      n = action(n, actor(n, 'spymaster', true), {
        type: 'takePenalty',
        card: null,
      });
    }
    expect(n.history.length).toBe(200);
    const projection = view(n, 'ro');
    projection.public.assignments.rs!.team = 'blue';
    expect(n.assignments.rs!.team).toBe('red');
  });
  test('presentation gates mount, duplicates, gaps, regressions, reconnect old snapshots, role and resets', () => {
    const gate = eventGate(),
      snap = {},
      fresh = {};
    const events = [
      {
        type: 'boardDealt' as const,
        team: 'red' as const,
        sequence: 2,
        index: 0,
      },
    ];
    expect(gate.consume('r:p:role', 1, [], true, snap)).toEqual([]);
    expect(gate.consume('r:p:role', 2, events, true, {})).toHaveLength(1);
    expect(gate.consume('r:p:role', 2, events, true, {})).toEqual([]);
    expect(gate.consume('r:p:role', 4, [], true, snap)).toEqual([]);
    gate.consume('r:p:role', 4, [], false, snap);
    expect(gate.consume('r:p:role', 4, [], true, snap)).toEqual([]);
    expect(
      gate.consume(
        'r:p:role',
        5,
        [{ ...events[0]!, sequence: 5 }],
        true,
        fresh,
      ),
    ).toEqual([]);
    expect(
      gate.consume('r:p:role', 6, [{ ...events[0]!, sequence: 6 }], true, {}),
    ).toHaveLength(1);
    gate.consume('r:p:role', 3, [], true, {});
    expect(
      gate.consume('r:p:role', 4, [{ ...events[0]!, sequence: 4 }], true, {}),
    ).toEqual([]);
    expect(
      gate.consume(
        'r:p:newrole',
        7,
        [{ ...events[0]!, sequence: 7 }],
        true,
        {},
      ),
    ).toEqual([]);
    gate.reset();
    expect(
      gate.consume(
        'r:p:newrole',
        8,
        [{ ...events[0]!, sequence: 8 }],
        true,
        {},
      ),
    ).toEqual([]);
  });
});

test('all finite counts, malformed options and every role/phase permission reject without mutation', () => {
  for (const options of [
    true,
    [],
    { boardLanguage: 'fr' },
    { allowAbbreviations: 1 },
    { allowMultiwordNames: 'yes' },
  ])
    expect(() => create(ids, seeded(1), options)).toThrow();
  for (let count = 1; count <= 9; count++)
    expect(guessing(dealt(), count).budget).toEqual({
      kind: 'finite',
      cap: count + 1,
    });
  const clue = dealt(),
    review = action(clue, actor(clue), {
      type: 'submitClue',
      word: 'Sea',
      count: 2,
    }),
    guess = guessing(clue),
    penalty = action(review, actor(review, 'spymaster', true), {
      type: 'reviewClue',
      allow: false,
    });
  for (const state of [clue, review, guess, penalty]) {
    const cases = [
      {
        input: { type: 'submitClue', word: 'Sea', count: 2 },
        phase: 'clue',
        role: 'spymaster',
        opponent: false,
      },
      {
        input: { type: 'reviewClue', allow: true },
        phase: 'clueReview',
        role: 'spymaster',
        opponent: true,
      },
      {
        input: { type: 'takePenalty', card: null },
        phase: 'penalty',
        role: 'spymaster',
        opponent: true,
      },
      {
        input: { type: 'guess', card: 0 },
        phase: 'guessing',
        role: 'operative',
        opponent: false,
      },
    ];
    for (const { input, phase, role, opponent } of cases)
      for (const player of ids) {
        if (state.phase === phase && player === actor(state, role, opponent))
          continue;
        reject(state, player, input);
      }
    for (const input of [null, [], 'guess', { type: 'undo' }])
      reject(state, 'ro', input);
    reject(state, 'unknown', { type: 'guess', card: 0 });
    const changed = structuredClone(state);
    const left = changed.board.findIndex((c) => !c.revealed),
      right = changed.board.findIndex(
        (c) => !c.revealed && c.identity !== changed.board[left]!.identity,
      );
    [changed.board[left]!.identity, changed.board[right]!.identity] = [
      changed.board[right]!.identity,
      changed.board[left]!.identity,
    ];
    for (const operative of ['ro', 'bo'])
      expect(view(changed, operative)).toEqual(view(state, operative));
    expect(view(changed, 'rs').private.key).not.toEqual(
      view(state, 'rs').private.key,
    );
  }
});

test('presentation cancels active effects on discontinuities, but repeated snapshots leave live motion alone', () => {
  let cancellations = 0;
  const gate = eventGate(() => cancellations++);
  gate.consume('round:seat:role', 1, [], true, {});
  const first = cancellations;
  gate.consume('round:seat:role', 1, [], true, {});
  expect(cancellations).toBe(first);
  gate.consume('round:seat:role', 4, [], true, {});
  expect(cancellations).toBe(first + 1);
  const event = {
    type: 'turnEnded' as const,
    team: 'red' as const,
    sequence: 5,
    index: 0,
  };
  expect(gate.consume('round:seat:role', 5, [event], true, {})).toEqual([
    event,
  ]);
  gate.consume('round:seat:role', 3, [], true, {});
  expect(cancellations).toBe(first + 2);
  gate.consume('round:other-seat:role', 6, [], true, {});
  expect(cancellations).toBe(first + 3);
  gate.reset();
  expect(cancellations).toBe(first + 4);
});
