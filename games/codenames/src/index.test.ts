import { describe, test, expect } from 'bun:test';
import { create, apply, view, presence } from './index.js';
import { words } from './words.js';
import { seeded, practice } from './practice.js';
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
function operative(s: State) {
  return s.activeTeam === 'red' ? 'ro' : 'bo';
}
function spymaster(s: State) {
  return s.activeTeam === 'red' ? 'rs' : 'bs';
}
function clued(s = dealt(), count: number | 'unlimited' = 2, word = 'Ocean') {
  return action(s, spymaster(s), { type: 'submitClue', word, count });
}
function guess(s: State, identity: string) {
  return action(s, operative(s), {
    type: 'guess',
    card: s.board.findIndex((c) => c.identity === identity && !c.revealed),
  });
}
function action(s: State, p: string, a: unknown) {
  return apply(s, p, a, seeded(33));
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
      teams.add(s.startingTeam);
      expect(s.phase).toBe('clue');
      expect(s.turn).toBe(1);
      expect(s.activeTeam).toBe(s.startingTeam);
      expect(s.clueHistory).toEqual([]);
      expect(new Set(s.board.map((c) => c.word)).size).toBe(25);
      expect(s.board.filter((c) => c.identity === s.startingTeam)).toHaveLength(
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
    expect(presence(live, []).connectedPlayers).toEqual([]);
    expect(presence(live, []).phase).toBe(live.phase);
    reject(presence(live, []), spymaster(live), {
      type: 'submitClue',
      word: 'Ocean',
      count: 2,
    });
  });
  test('clues normalize NFC and trim, enforce grapheme length, count and control/format exclusion', () => {
    const s = dealt();
    expect(clued(s, 2, '  Cafe\u0301  ').clue?.word).toBe('Café');
    expect(clued(s, 9, 'é'.repeat(80)).clue?.word).toHaveLength(80);
    expect(clued(s, 1, 'a\u0301'.repeat(80)).clue?.word).toHaveLength(80);
    for (const word of [
      '',
      '  ',
      'a'.repeat(81),
      'line\nfeed',
      '\tword',
      'a\u200bb',
      'a\u202eb',
      null,
      42,
    ])
      reject(s, spymaster(s), { type: 'submitClue', word, count: 1 });
    for (const count of [-1, 10, 1.5, NaN, Infinity, '2', null, true])
      reject(s, spymaster(s), { type: 'submitClue', word: 'Ocean', count });
    for (const player of ids.filter((p) => p !== spymaster(s)))
      reject(s, player, {
        type: 'submitClue',
        word: 'Ocean',
        count: 1,
        player: spymaster(s),
      });
    const n = clued(s);
    expect(n.phase).toBe('guessing');
    expect(n.events.map((e) => e.type)).toEqual(['clueSubmitted']);
    expect(n.clueHistory).toEqual([
      { turn: 1, team: s.activeTeam, word: 'Ocean', count: 2, guesses: [] },
    ]);
    reject(n, spymaster(n), { type: 'submitClue', word: 'Again', count: 1 });
    for (const type of ['reviewClue', 'takePenalty'])
      for (const player of ids) reject(n, player, { type });
  });
  test('finite budget includes one extra guess, first guess is mandatory and handoff resets state', () => {
    let s = clued(dealt(), 1);
    expect(s.budget).toEqual({ kind: 'finite', cap: 2 });
    reject(s, operative(s), { type: 'endTurn' });
    const team = s.activeTeam;
    s = guess(s, team);
    expect(s.used).toBe(1);
    for (const player of ids.filter((p) => p !== operative(s)))
      reject(s, player, { type: 'endTurn' });
    const ended = action(s, operative(s), { type: 'endTurn' });
    expect(ended.phase).toBe('clue');
    expect(ended.turn).toBe(2);
    expect(ended.activeTeam).not.toBe(team);
    expect(ended.clue).toBeNull();
    expect(ended.used).toBe(0);
    expect(ended.events.map((e) => e.type)).toEqual(['turnEnded']);
    reject(ended, operative(ended), { type: 'endTurn' });
    s = guess(s, team);
    expect(s.phase).toBe('clue');
    expect(s.events.map((e) => e.type)).toEqual(['cardRevealed', 'turnEnded']);
    expect(s.clueHistory[0]!.guesses).toHaveLength(2);
    s = clued(s, 3);
    expect(s.clueHistory).toHaveLength(2);
    expect(s.clueHistory[1]!.turn).toBe(2);
  });
  test('zero and unlimited remove numerical limit, civilian and opposing cards still hand off', () => {
    for (const count of [0, 'unlimited'] as const) {
      let s = clued(dealt(), count);
      expect(s.budget).toEqual({ kind: 'unlimited' });
      for (let i = 0; i < 4; i++) s = guess(s, s.activeTeam);
      expect(s.used).toBe(4);
      expect(s.phase).toBe('guessing');
      for (const identity of [
        'civilian',
        s.activeTeam === 'red' ? 'blue' : 'red',
      ] as const) {
        const n = guess(s, identity);
        expect(n.phase).toBe('clue');
        expect(n.activeTeam).not.toBe(s.activeTeam);
        expect(n.clueHistory[0]!.guesses.at(-1)!.identity).toBe(identity);
      }
    }
  });
  test('only authenticated active operatives guess, malformed or duplicate actions reject unchanged', () => {
    const s = clued();
    for (const p of [...ids.filter((p) => p !== operative(s)), 'unknown'])
      reject(s, p, { type: 'guess', card: 0 });
    for (const before of [setup(), dealt()])
      reject(before, 'ro', { type: 'guess', card: 0 });
    for (const card of [-1, 25, 1.3, NaN, Infinity, '0', null])
      reject(s, operative(s), { type: 'guess', card });
    for (const input of [null, [], 'guess', { type: 'undo' }])
      reject(s, operative(s), input);
    const card = s.board.findIndex((c) => c.identity === s.activeTeam);
    const n = action(s, operative(s), { type: 'guess', card });
    reject(n, operative(n), { type: 'guess', card });
    expect(s.board[card]!.revealed).toBe(false);
    expect(n.actionSequence).toBe(s.actionSequence + 1);
    expect(n.clueHistory[0]!.guesses).toEqual([
      { card, word: s.board[card]!.word, identity: s.activeTeam },
    ]);
    for (const p of ids)
      reject(s, p, {
        type: 'chooseRole',
        team: 'red',
        role: 'operative',
        version: s.setupVersion,
      });
  });
  test('assassin immediately loses for active team regardless of forged team', () => {
    for (const activeTeam of ['red', 'blue'] as const) {
      const s = clued({ ...dealt(), activeTeam });
      const n = action(s, operative(s), {
        type: 'guess',
        card: s.board.findIndex((c) => c.identity === 'assassin'),
        team: activeTeam === 'red' ? 'blue' : 'red',
      });
      expect(n.result).toEqual({
        team: activeTeam === 'red' ? 'blue' : 'red',
        reason: 'assassin',
      });
      expect(n.phase).toBe('finished');
      expect(n.events.map((e) => e.type)).toEqual([
        'cardRevealed',
        'gameFinished',
      ]);
      expect(view(n, 'ro').public.board.every((c) => c.identity)).toBe(true);
      expect(n.clueHistory.at(-1)!.guesses.at(-1)!.identity).toBe('assassin');
      reject(n, operative(n), { type: 'guess', card: 0 });
    }
  });
  test('last agent wins before handoff, including the opponent last agent and exhausted budget', () => {
    for (const team of ['red', 'blue'] as const)
      for (const activeTeam of ['red', 'blue'] as const) {
        let s = clued({ ...dealt(), activeTeam }, 1);
        const target = s.board.findIndex((c) => c.identity === team);
        s.board.forEach((c, i) => {
          if (c.identity === team && i !== target) c.revealed = true;
        });
        s.used = 1;
        s = action(s, operative(s), { type: 'guess', card: target });
        expect(s.result).toEqual({ team, reason: 'agents' });
        expect(s.phase).toBe('finished');
        expect(s.events.map((e) => e.type)).toEqual([
          'cardRevealed',
          'gameFinished',
        ]);
        expect(view(s, operative(s)).public.remaining[team]).toBe(0);
      }
  });
  test('metamorphic privacy: unseen key permutations do not alter any operative projection', () => {
    const s = guess(clued(), 'civilian'),
      other = structuredClone(s);
    const hidden = other.board.filter((c) => !c.revealed);
    const identities = hidden.map((c) => c.identity).reverse();
    hidden.forEach((c, i) => {
      c.identity = identities[i]!;
    });
    for (const p of ['ro', 'bo']) {
      expect(JSON.stringify(view(s, p))).toBe(JSON.stringify(view(other, p)));
      expect(view(s, p).private.key).toBeUndefined();
      expect(
        view(s, p)
          .public.board.filter((c) => !c.revealed)
          .every((c) => !('identity' in c)),
      ).toBe(true);
    }
    const changed = structuredClone(s);
    changed.board.reverse();
    expect(view(s, 'rs').private.key).not.toEqual(
      view(changed, 'rs').private.key,
    );
    expect(JSON.stringify(view(s, 'ro'))).not.toContain('packVersion');
  });
  test('accepted setup actions clear event batch; all projection data is detached', () => {
    let s = setup();
    s = action(s, 'rs', { type: 'ready', version: s.setupVersion });
    expect(s.events).toEqual([]);
    const n = dealt();
    const projection = view(n, 'rs');
    projection.public.assignments.rs!.team = 'blue';
    projection.public.options.boardLanguage = 'es';
    projection.public.board[0]!.word = 'changed';
    projection.private.key![0] = 'assassin';
    projection.public.events[0]!.sequence = 999;
    expect(n.assignments.rs!.team).toBe('red');
    expect(n.options.boardLanguage).toBe('en');
    expect(n.board[0]!.word).not.toBe('changed');
    expect(n.events[0]!.sequence).not.toBe(999);
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

test('invalid options and random values reject; board language is fixed at deal', () => {
  for (const options of [true, [], { boardLanguage: 'fr' }])
    expect(() => create(ids, seeded(1), options)).toThrow();
  let s = setup();
  for (const p of ids.slice(0, 3))
    s = action(s, p, { type: 'ready', version: s.setupVersion });
  for (const value of [-1, 1, Infinity, NaN])
    expect(() =>
      apply(s, 'bo', { type: 'ready', version: s.setupVersion }, () => value),
    ).toThrow();
  expect(s.board).toEqual([]);
  const spanish = create(ids, seeded(1), { boardLanguage: 'es' });
  expect(spanish.options).toEqual({ boardLanguage: 'es' });
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
    type: 'boardDealt' as const,
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

test('local midgame history is coherent with public reveals and never enters production creation', () => {
  for (const language of ['en', 'es'] as const) {
    const s = practice('midgame', language, 8).state;
    expect(s.players).toHaveLength(8);
    expect(s.phase).toBe('guessing');
    expect(s.turn).toBe(3);
    expect(s.activeTeam).toBe('red');
    expect(s.used).toBe(2);
    expect(s.clueHistory.map((c) => c.guesses.length)).toEqual([1, 3, 2]);
    for (const team of ['red', 'blue'])
      expect(
        s.board.filter((c) => c.revealed && c.identity === team),
      ).toHaveLength(3);
    expect(s.board.find((c) => c.identity === 'assassin')!.revealed).toBe(
      false,
    );
    const projected = view(s, 'training-1');
    for (const r of projected.public.clueHistory)
      for (const g of r.guesses)
        expect(projected.public.board[g.card]!.identity).toBe(g.identity);
    const clone = structuredClone(s);
    const v = view(clone, 'training-0');
    v.public.clueHistory[0]!.guesses[0]!.word = 'changed';
    v.public.clue!.word = 'changed';
    if (v.public.budget.kind === 'finite') v.public.budget.cap = 100;
    expect(clone).toEqual(s);
  }
  expect(create(ids, seeded(1)).clueHistory).toEqual([]);
});
test('presentation admits new clue and turn events once and suppresses reconnect replay', () => {
  const gate = eventGate();
  let s = dealt();
  expect(gate.consume('one', s.actionSequence, s.events, true, s)).toEqual([]);
  s = clued(s);
  expect(
    gate.consume('one', s.actionSequence, s.events, true, s).map((e) => e.type),
  ).toEqual(['clueSubmitted']);
  s = guess(s, 'civilian');
  expect(
    gate.consume('one', s.actionSequence, s.events, true, s).map((e) => e.type),
  ).toEqual(['cardRevealed', 'turnEnded']);
  expect(gate.consume('one', s.actionSequence, s.events, true, s)).toEqual([]);
  gate.consume('one', s.actionSequence, s.events, false, s);
  expect(
    gate.consume('one', s.actionSequence, s.events, true, { ...s }),
  ).toEqual([]);
});
