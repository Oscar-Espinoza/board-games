import { test, expect } from 'bun:test';
import { littleSecret as game } from './index.js';
import { normalize, distribution } from './engine.js';
import { practice, seeded, scenarios, practiceRules } from './practice.js';
import type { State, Role, Power } from './types.js';
import content from './words.json';
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);
function started(count = 5, powers = false) {
  let s = game.create(ids(count), seeded(1), { powers });
  for (const p of s.players)
    s = game.apply(s, p, { type: 'ready', version: 0 }, seeded(42));
  return s;
}
const act = (s: State, p: string, a: unknown) =>
  game.apply(s, p, a, seeded(56), { hostId: s.players[0]! });
function voting(s: State) {
  s = act(
    s,
    s.players.find((p) => !s.eliminated.includes(p))!,
    { type: 'volunteer', mission: s.mission },
  );
  while (s.phase === 'clues')
    s = act(s, s.speaker!, {
      type: 'clue',
      mission: s.mission,
      cycle: s.cycle,
    });
  return act(s, s.players[0]!, {
    type: 'openVote',
    mission: s.mission,
    cycle: s.cycle,
  });
}
function eliminate(s: State, target: string) {
  if (s.phase === 'volunteer') s = voting(s);
  else {
    while (s.phase === 'clues')
      s = act(s, s.speaker!, {
        type: 'clue',
        mission: s.mission,
        cycle: s.cycle,
      });
    s = act(s, s.players[0]!, {
      type: 'openVote',
      mission: s.mission,
      cycle: s.cycle,
    });
  }
  const alive = s.players.filter((p) => !s.eliminated.includes(p));
  for (const p of alive)
    s = act(s, p, {
      type: 'vote',
      ballotId: s.ballotId,
      target: p === target ? alive.find((q) => q !== p) : target,
    });
  return s;
}
function reject(s: State, p: string, a: unknown) {
  const before = structuredClone(s);
  expect(() => act(s, p, a)).toThrow('ls_error');
  expect(s).toEqual(before);
}
for (let n = 3; n <= 9; n++)
  test(`${n} seats receive exactly the classic distribution and private uncertainty`, () => {
    const s = started(n),
      counts = ['disciple', 'infiltrator', 'journalist'].map(
        (r) => Object.values(s.roles).filter((v) => v === r).length,
      );
    expect(counts).toEqual(distribution[n]!);
    for (const p of s.players) {
      const v = game.view(s, p);
      expect(v.private.role).toBe(
        s.roles[p] === 'journalist' ? 'journalist' : null,
      );
      expect(v.private.password).toBe(
        s.roles[p] === 'journalist'
          ? null
          : s.roles[p] === 'disciple'
            ? s.password
            : s.alternative,
      );
      expect(v.private.solution).toBeNull();
      expect(JSON.stringify(v.public)).not.toContain(
        JSON.stringify(s.password),
      );
      expect(v.public).not.toHaveProperty('roles');
    }
  });
test('invalid counts, duplicate seats, malformed options and randomness reject without mutation', () => {
  for (const n of [0, 1, 2, 10])
    expect(() => game.create(ids(n), Math.random)).toThrow();
  expect(() => game.create(['a', 'a', 'b'], Math.random)).toThrow();
  for (const o of [
    true,
    [],
    { wordLanguage: 'fr' },
    { powers: 'yes' },
    { powers: true },
  ])
    expect(() => game.create(ids(3), Math.random, o)).toThrow();
  let s = game.create(ids(3), Math.random);
  s = act(s, 'p0', { type: 'ready', version: 0 });
  s = act(s, 'p1', { type: 'ready', version: 0 });
  const before = structuredClone(s);
  for (const r of [NaN, 1, -1, Infinity])
    expect(() =>
      game.apply(s, 'p2', { type: 'ready', version: 0 }, () => r),
    ).toThrow();
  expect(s).toEqual(before);
  expect(started()).toEqual(started());
});
test('host authority, setup versions, presence, replacement and readiness', () => {
  let s = game.create(ids(6), Math.random);
  reject(s, 'p1', { type: 'configure', version: 0, options: { powers: true } });
  s = act(s, 'p0', { type: 'ready', version: 0 });
  s = game.apply(
    s,
    'p2',
    {
      type: 'configure',
      version: 0,
      options: { powers: true, wordLanguage: 'es' },
    },
    Math.random,
    { hostId: 'p2' },
  );
  expect(s.ready).toEqual([]);
  reject(s, 'p1', { type: 'ready', version: 0 });
  s = game.presence(s, ['p0', 'p1'], 'p3');
  expect(s.setupVersion).toBe(2);
  reject(s, 'p0', { type: 'ready', version: 2 });
  s = game.presence(s, s.players);
  for (const p of s.players) s = act(s, p, { type: 'ready', version: 2 });
  expect(s.phase).toBe('volunteer');
  expect(Object.keys(s.powers)).toHaveLength(6);
  reject(s, 'p0', {
    type: 'configure',
    version: 2,
    options: { powers: false },
  });
});
test('volunteer race, speaker order, power clues and host debate authority', () => {
  let s = started(6, true);
  s.powers = {
    p0: 'mime',
    p1: 'novice',
    p2: 'elder',
    p3: 'sage',
    p4: 'revenant',
    p5: 'dictator',
  };
  s = act(s, 'p2', { type: 'volunteer', mission: 1 });
  reject(s, 'p3', { type: 'volunteer', mission: 1 });
  reject(s, 'p1', { type: 'clue', mission: 1, cycle: 1 });
  reject(s, 'p2', { type: 'clue', mission: 1, cycle: 0 });
  const speakers = [];
  while (s.phase === 'clues') {
    speakers.push(s.speaker);
    s = act(s, s.speaker!, { type: 'clue', mission: 1, cycle: 1 });
  }
  expect(speakers).toEqual(['p2', 'p3', 'p4', 'p5', 'p0', 'p1']);
  reject(s, 'p1', { type: 'openVote', mission: 1, cycle: 1 });
  s = game.apply(
    s,
    'p1',
    { type: 'openVote', mission: 1, cycle: 1 },
    Math.random,
    { hostId: 'p1' },
  );
  expect(s.phase).toBe('vote');
});
test('ballots immutable and private; all reveal together with weights', () => {
  let s = voting(started(6, true));
  s.powers = { p5: 'dictator' };
  for (let i = 0; i < 5; i++)
    s = act(s, `p${i}`, {
      type: 'vote',
      ballotId: s.ballotId,
      target: i === 1 ? 'p0' : 'p1',
    });
  expect(s.events).toEqual([]);
  expect(s.history.some((e) => e.type === 'ballots')).toBe(false);
  expect(game.view(s, 'p5').private.ballot).toBeNull();
  reject(s, 'p0', { type: 'vote', ballotId: s.ballotId, target: 'p2' });
  reject(s, 'p5', { type: 'vote', ballotId: 'old', target: 'p0' });
  reject(s, 'p5', { type: 'vote', ballotId: s.ballotId, target: 'p5' });
  s = act(s, 'p5', { type: 'vote', ballotId: s.ballotId, target: 'p0' });
  const e = s.events.find((e) => e.type === 'ballots');
  expect(e?.type === 'ballots' && e.totals).toEqual({
    p0: 3,
    p1: 4,
    p2: 0,
    p3: 0,
    p4: 0,
    p5: 0,
  });
  expect(s.eliminated).toContain('p1');
});
test('living Sage chooses tied leaders including themselves; eliminated Sage cannot choose', () => {
  const p = practice('sage');
  expect(p.state.prompt?.kind).toBe('sage');
  const actor = p.actor;
  expect(p.state.candidates).toEqual(['training-0', 'training-1']);
  const original = structuredClone(p.state);
  expect(() =>
    p.send(actor, {
      type: 'resolveTie',
      promptId: p.state.prompt!.id,
      target: 'training-2',
    }),
  ).toThrow();
  expect(p.state).toEqual(original);
  p.send(actor, {
    type: 'resolveTie',
    promptId: p.state.prompt!.id,
    target: 'training-1',
  });
  expect(p.state.eliminated).toContain('training-1');
  let s = voting(started(3));
  s.powers.p0 = 'sage';
  for (let i = 0; i < 3; i++)
    s = act(s, `p${i}`, {
      type: 'vote',
      ballotId: s.ballotId,
      target: `p${(i + 1) % 3}`,
    });
  s = act(s, 'p0', {
    type: 'resolveTie',
    promptId: s.prompt!.id,
    target: 'p0',
  });
  expect(s.eliminated).toContain('p0');
  let t = started(6, true);
  t.powers = { p0: 'sage' };
  t.roles = {
    p0: 'disciple',
    p1: 'disciple',
    p2: 'disciple',
    p3: 'disciple',
    p4: 'infiltrator',
    p5: 'journalist',
  };
  t = eliminate(t, 'p0');
  while (t.phase === 'clues')
    t = act(t, t.speaker!, { type: 'clue', mission: 1, cycle: t.cycle });
  t = act(t, 'p0', { type: 'openVote', mission: 1, cycle: t.cycle });
  const alive = t.players.slice(1);
  for (let i = 0; i < 5; i++)
    t = act(t, alive[i]!, {
      type: 'vote',
      ballotId: t.ballotId,
      target: alive[(i + 1) % 5],
    });
  expect(t.phase).toBe('tie');
  expect(t.prompt).toBeNull();
  reject(t, 'p0', { type: 'resolveTie', promptId: 'x', target: 'p1' });
});
test('multiplayer RPS repeats one/three symbols, keeps losing groups, then one loser', () => {
  const p = practice('rps');
  const candidates = [...p.state.candidates];
  for (const symbols of [
    ['rock', 'rock', 'rock'],
    ['rock', 'paper', 'scissors'],
    ['rock', 'rock', 'paper'],
  ]) {
    const id = p.state.rpsId;
    for (let i = 0; i < 3; i++) {
      p.send(candidates[i]!, { type: 'rps', rpsId: id, symbol: symbols[i] });
      if (i === 0) {
        expect(p.view(candidates[1]!).private.rps).toBeNull();
        expect(() =>
          p.send(candidates[0]!, { type: 'rps', rpsId: id, symbol: 'paper' }),
        ).toThrow();
      }
    }
    expect(p.state.rpsId).not.toBe(id);
  }
  expect(p.state.candidates).toEqual(candidates.slice(0, 2));
  const id = p.state.rpsId;
  p.send(candidates[0]!, { type: 'rps', rpsId: id, symbol: 'scissors' });
  p.send(candidates[1]!, { type: 'rps', rpsId: id, symbol: 'rock' });
  expect(p.state.eliminated).toContain(candidates[0]!);
});
test('Journalist guesses normalized aliases once, accents and ñ preserved', () => {
  const p = practice('journalist', 'es'),
    actor = p.actor,
    word = p.state.password,
    id = p.state.prompt!.id;
  expect(p.view(actor).private.solution).toBeNull();
  p.send(actor, {
    type: 'guess',
    promptId: id,
    answer: `  ${word.normalize('NFD').toUpperCase()}  `,
  });
  expect(p.state.result?.reason).toBe('guess');
  expect(p.state.result?.points[actor]).toBe(3);
  expect(Object.values(p.state.result!.points).reduce((a, b) => a + b, 0)).toBe(
    3,
  );
  expect(() =>
    p.send(actor, { type: 'guess', promptId: id, answer: word }),
  ).toThrow();
  expect(normalize(' año ')).not.toBe(normalize('ano'));
  expect(normalize(' café ')).not.toBe(normalize('cafe'));
  expect(normalize('  A  B ')).toBe('a b');
  const f = practice('journalist');
  f.state.aliases.push('accepted alias');
  f.send(f.actor, {
    type: 'guess',
    promptId: f.state.prompt!.id,
    answer: ' ACCEPTED   ALIAS ',
  });
  expect(f.state.result?.reason).toBe('guess');
});
test('Journalist failure keeps solution hidden through own Revenant choice', () => {
  const p = practice('journalist');
  const actor = p.actor;
  p.state.powers[actor] = 'revenant';
  p.state.reactions.push({ kind: 'revenant', actor });
  p.send(actor, {
    type: 'guess',
    promptId: p.state.prompt!.id,
    answer: 'incorrect',
  });
  expect(p.state.prompt?.kind).toBe('revenant');
  expect(p.view(actor).private.solution).toBeNull();
  p.send(actor, {
    type: 'revenant',
    promptId: p.state.prompt!.id,
    target: null,
  });
  expect(p.view(actor).private.solution).not.toBeNull();
  expect(p.state.phase).toBe('clues');
});
test('Revenant victim Journalist reacts before scoring; guessing success skips further revenge', () => {
  const p = practice('revenant');
  expect(p.view(p.actor).private.solution).toBeNull();
  p.send(p.actor, {
    type: 'revenant',
    promptId: p.state.prompt!.id,
    target: 'training-4',
  });
  expect(p.state.prompt?.kind).toBe('journalist');
  expect(p.view('training-4').private.solution).toBeNull();
  p.send(p.actor, {
    type: 'guess',
    promptId: p.state.prompt!.id,
    answer: p.state.password,
  });
  expect(p.state.result?.reason).toBe('guess');
  const q = practice('journalist');
  q.state.reactions.push({ kind: 'revenant', actor: q.actor });
  q.send(q.actor, {
    type: 'guess',
    promptId: q.state.prompt!.id,
    answer: q.state.password,
  });
  expect(q.state.reactions).toEqual([]);
  expect(q.state.prompt).toBeNull();
});
test('resolve revenge at two survivors and resume after original voting victim', () => {
  let s = started(3);
  s.roles = { p0: 'disciple', p1: 'infiltrator', p2: 'disciple' };
  s.powers = { p0: 'revenant' };
  s = eliminate(s, 'p0');
  expect(s.phase).toBe('reactions');
  expect(s.result).toBeNull();
  s = act(s, 'p0', { type: 'revenant', promptId: s.prompt!.id, target: 'p1' });
  expect(s.eliminated).toHaveLength(2);
  expect(s.result?.points).toEqual({ p0: 1, p1: 0, p2: 1 });
  const p = practice('revenant');
  p.send(p.actor, {
    type: 'revenant',
    promptId: p.state.prompt!.id,
    target: 'training-2',
  });
  expect(p.state.speaker).toBe('training-1');
  expect(p.state.clueOrder).not.toContain('training-2');
});
test('all scoring outcomes include eliminated teammates and coexisting intruders', () => {
  let s = started(5);
  s.roles = {
    p0: 'disciple',
    p1: 'disciple',
    p2: 'disciple',
    p3: 'infiltrator',
    p4: 'journalist',
  };
  s = eliminate(s, 'p0');
  s = eliminate(s, 'p1');
  s = eliminate(s, 'p2');
  expect(s.result?.points).toEqual({ p0: 0, p1: 0, p2: 0, p3: 2, p4: 3 });
  let t = started(7);
  t.roles = {
    p0: 'disciple',
    p1: 'disciple',
    p2: 'disciple',
    p3: 'disciple',
    p4: 'infiltrator',
    p5: 'infiltrator',
    p6: 'journalist',
  };
  for (const target of ['p4', 'p0', 'p1', 'p2', 'p3']) t = eliminate(t, target);
  expect(t.result?.points.p4).toBe(2);
  expect(t.result?.points.p5).toBe(2);
  expect(t.result?.points.p6).toBe(3);
});
test('atomic shared match victory, next mission reset, powers retained, fresh rematch', () => {
  const p = practice('scores');
  expect(p.state.result?.winners).toEqual(['training-0', 'training-1']);
  let s = started(6, true);
  s.powers = {
    p0: 'adept',
    p1: 'mime',
    p2: 'elder',
    p3: 'novice',
    p4: 'sage',
    p5: 'dictator',
  };
  s.phase = 'missionResult';
  s.result = {
    password: s.password,
    alternative: s.alternative,
    roles: s.roles,
    points: {},
    reason: 'disciples',
    winners: [],
  };
  const powers = structuredClone(s.powers),
    used = [...s.used];
  for (const p of s.players)
    s = act(s, p, { type: 'continue', mission: s.mission });
  expect(s.phase).toBe('volunteer');
  expect(s.mission).toBe(2);
  expect(s.powers).toEqual(powers);
  expect(s.used).toHaveLength(2);
  expect(s.used[1]).not.toBe(used[0]);
  expect(s.history).toHaveLength(1);
  expect(s.ballots).toEqual({});
  const fresh = game.create(s.players, Math.random, s.options);
  expect(Object.values(fresh.scores).every((v) => v === 0)).toBe(true);
  expect(fresh.used).toEqual([]);
});
test('metamorphic privacy, detached views and bounded secret-free history', () => {
  const s = voting(started(5));
  const player = s.players.find((p) => s.roles[p] === 'disciple')!;
  const before = game.view(s, player),
    changed = structuredClone(s);
  changed.alternative = 'hidden-new-word';
  changed.aliases = ['hidden-alias'];
  changed.used = ['hidden-content'];
  const others = s.players.filter((p) => p !== player);
  [changed.roles[others[0]!], changed.roles[others[1]!]] = [
    changed.roles[others[1]!]!,
    changed.roles[others[0]!]!,
  ];
  expect(game.view(changed, player)).toEqual(before);
  const voter = others[0]!;
  const committed = act(s, voter, {
    type: 'vote',
    ballotId: s.ballotId,
    target: others[1],
  });
  const altered = structuredClone(committed);
  altered.ballots[voter] = player;
  expect(game.view(altered, player)).toEqual(game.view(committed, player));
  const v = game.view(s, player);
  v.public.scores[player] = 999;
  v.public.players.length = 0;
  expect(s.scores[player]).toBe(0);
  expect(s.players).toHaveLength(5);
  const wire = JSON.stringify(v.public);
  for (const secret of [s.password, s.alternative, ...s.used])
    expect(wire).not.toContain(JSON.stringify(secret));
});
test('production packs contain exactly 300 unique original pairs per language', () => {
  for (const lang of ['en', 'es'] as const) {
    const words = new Set(),
      pairs = new Set(),
      ids = new Set();
    expect(content[lang]).toHaveLength(300);
    for (const p of content[lang]) {
      expect(p.id).toMatch(/^[a-f0-9]{12}$/);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
      expect(p.words).toHaveLength(2);
      expect(p.aliases).toHaveLength(2);
      const key = p.words.map(normalize).sort().join('|');
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
      for (const word of p.words) {
        expect(word.trim()).toBe(word);
        expect(words.has(normalize(word))).toBe(false);
        words.add(normalize(word));
      }
      for (const aliases of p.aliases)
        for (const word of aliases)
          expect(normalize(word).length).toBeGreaterThan(0);
    }
  }
});
test('all deterministic practice scenarios use detached recipient views', () => {
  for (const scenario of scenarios) {
    const p = practice(scenario);
    expect(p.view(p.actor).public.players).toHaveLength(p.seats.length);
    expect(JSON.stringify(p.view(p.actor).public)).not.toContain('training-19');
  }
});
for (const count of [3, 9])
  test(`complete ${count}-seat matches terminate and do not reuse content`, () => {
    let s = started(count);
    let steps = 0;
    while (s.phase !== 'finished' && steps++ < 500) {
      if (s.phase === 'volunteer' || s.phase === 'clues') {
        const target = s.players.find(
          (p) => !s.eliminated.includes(p) && s.roles[p] !== 'disciple',
        )!;
        s = eliminate(s, target);
      } else if (s.phase === 'reactions')
        s = act(s, s.prompt!.actor, {
          type: 'guess',
          promptId: s.prompt!.id,
          answer: 'deliberately wrong',
        });
      else if (s.phase === 'missionResult') {
        for (const p of s.players)
          s = act(s, p, { type: 'continue', mission: s.mission });
      } else throw Error(s.phase);
    }
    expect(s.phase).toBe('finished');
    expect(new Set(s.used).size).toBe(s.mission);
    expect(s.result!.winners.length).toBeGreaterThan(0);
  });

test('nine-card deck has six effects and three Adepts, independent of secret roles', () => {
  const s = started(9, true),
    powers = Object.values(s.powers);
  expect(powers.filter((p) => p === 'adept')).toHaveLength(3);
  for (const p of ['mime', 'novice', 'elder', 'sage', 'revenant', 'dictator'])
    expect(powers.filter((value) => value === p)).toHaveLength(1);
  const changed = structuredClone(s);
  changed.roles = Object.fromEntries(
    s.players.map((p) => [
      p,
      s.roles[p] === 'disciple' ? 'infiltrator' : 'disciple',
    ]),
  );
  expect(game.view(changed, s.players[0]!).public.powers).toEqual(
    game.view(s, s.players[0]!).public.powers,
  );
});
test('unrevealed RPS choices and unused aliases do not alter another recipient payload', () => {
  const p = practice('rps'),
    [first, second] = p.state.candidates;
  p.send(first!, { type: 'rps', rpsId: p.state.rpsId, symbol: 'rock' });
  const before = p.view(second!);
  p.state.rps[first!] = 'paper';
  p.state.aliases = ['private-spelling'];
  expect(p.view(second!)).toEqual(before);
});
test('repeated RPS bounds public history without exposing incomplete rounds', () => {
  const p = practice('rps');
  for (let i = 0; i < 105; i++) {
    const prompt = p.state.rpsId;
    for (const actor of p.state.candidates)
      p.send(actor, { type: 'rps', rpsId: prompt, symbol: 'rock' });
  }
  expect(p.state.history).toHaveLength(100);
  expect(p.view(p.actor).public.history.every((e) => e.type === 'rps')).toBe(
    true,
  );
});
