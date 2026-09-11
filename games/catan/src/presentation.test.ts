import { describe, test } from 'node:test';
import { expect } from '@playwright/test';
import { applyAction, legalActions, playerView, type State } from './index.js';
import { RevisionGate } from './presentation.js';
import {
  scenarioState,
  scenarios,
  seats,
  practice,
  practiceSeat,
} from './practice.js';
const actor = (s: State) => s.phase.player!;
const act = (s: State, type: string) =>
  applyAction(
    s,
    actor(s),
    legalActions(s, actor(s)).find((a) => a.type === type)!,
    () => 0.4,
  );

test('accepted placements emit one event; rejection preserves revision, state and randomness', () => {
  const before = scenarioState('setup'),
    snapshot = structuredClone(before);
  let consumed = false;
  expect(() =>
    applyAction(
      before,
      actor(before),
      { type: 'BUILD_CITY', vertex: 0 },
      () => {
        consumed = true;
        return 0.4;
      },
    ),
  ).toThrow();
  expect(consumed).toBe(false);
  expect(before).toEqual(snapshot);
  const after = act(before, 'BUILD_SETTLEMENT');
  expect(after.revision).toBe(1);
  expect(
    after.presentation.public.filter((e) => e.type === 'placement'),
  ).toHaveLength(1);
  expect(playerView(after, actor(before)).public.revision).toBe(1);
});

test('identical dice results have distinct accepted revisions and production events', () => {
  let state = scenarioState('production');
  const first = act(state, 'ROLL_DICE');
  state = act(first, 'END_TURN');
  const second = act(state, 'ROLL_DICE');
  expect(first.dice).toEqual(second.dice);
  expect(second.revision).toBe(first.revision + 2);
  for (const s of [first, second]) {
    expect(s.presentation.public.some((e) => e.type === 'roll')).toBe(true);
    expect(
      s.presentation.public.some(
        (e) => e.type === 'transfer' && e.reason === 'production',
      ),
    ).toBe(true);
  }
});

test('theft identity is visible only to thief and victim, never public or a bystander', () => {
  const before = scenarioState('robber'),
    thief = actor(before);
  const hex = before.board.hexes.findIndex(
    (h, hex) =>
      hex !== before.robber &&
      h.vertices.some(
        (v) =>
          before.buildings[v]?.owner && before.buildings[v]?.owner !== thief,
      ),
  );
  const moved = applyAction(
    before,
    thief,
    { type: 'MOVE_ROBBER', hex },
    () => 0.4,
  );
  const action = legalActions(moved, thief).find((a) => a.type === 'STEAL')!;
  const after = applyAction(moved, thief, action, () => 0.4);
  const publicEvent = after.presentation.public.find(
    (e) => e.type === 'transfer',
  );
  expect(publicEvent).toEqual({
    type: 'transfer',
    from: action.victim!,
    to: thief,
    count: 1,
    reason: 'theft',
  });
  for (const id of after.players) {
    const view = playerView(after, id);
    expect(view.public.events).toEqual(after.presentation.public);
    expect(view.private.events.length).toBe(
      id === thief || id === action.victim ? 1 : 0,
    );
    expect(JSON.stringify(view.public)).not.toContain('"stolen"');
  }
  moved.hands[moved.players.indexOf(action.victim!)] = [0, 0, 0, 0, 0];
  expect(
    applyAction(moved, thief, action, () => 0.4).presentation.public.some(
      (e) => e.type === 'transfer',
    ),
  ).toBe(false);
});

test('development purchase hides card kind from all other seats', () => {
  const before = scenarioState('building'),
    id = actor(before);
  const after = act(before, 'BUY_DEVELOPMENT');
  expect(after.presentation.public).toContainEqual({
    type: 'card',
    player: id,
    kind: 'purchase',
  });
  for (const p of after.players)
    expect(playerView(after, p).private.events.length).toBe(p === id ? 1 : 0);
});

test('Monopoly projects actual public counts and resource', () => {
  const before = scenarioState('monopoly'),
    id = actor(before),
    after = act(before, 'MONOPOLY');
  const transfers = after.presentation.public.filter(
    (e) => e.type === 'transfer',
  );
  expect(transfers).toHaveLength(3);
  for (const event of transfers)
    expect(event).toMatchObject({
      to: id,
      count: 4,
      resource: 0,
      reason: 'monopoly',
    });
});

test('revision gate settles duplicates, gaps, reconnects, rounds and seats', () => {
  const gate = new RevisionGate();
  expect(gate.accept(4, '1:a', true)).toBe(false);
  expect(gate.accept(5, '1:a', true)).toBe(true);
  expect(gate.accept(5, '1:a', true)).toBe(false);
  expect(gate.accept(7, '1:a', true)).toBe(false);
  expect(gate.accept(8, '1:a', false)).toBe(false);
  expect(gate.accept(9, '1:a', true)).toBe(false);
  expect(gate.accept(10, '1:a', true)).toBe(true);
  expect(gate.accept(11, '1:b', true)).toBe(false);
  expect(gate.accept(0, '2:b', true)).toBe(false);
});

describe('local scenario legality', () => {
  for (const scenario of scenarios)
    test(scenario, () => {
      const s = scenarioState(scenario);
      expect(s.players).toEqual(seats.map((p) => p.id));
      expect(s).toEqual(scenarioState(scenario));
      for (let r = 0; r < 5; r++)
        expect(
          s.bank[r] + s.hands.reduce((sum, hand) => sum + hand[r], 0),
        ).toBe(19);
      expect(
        s.deck.length + s.development.flat().length + s.played.flat().length,
      ).toBe(25);
      expect(s.bank.every((n) => n >= 0)).toBe(true);
      const action = legalActions(s, actor(s))[0];
      expect(action).toBeDefined();
      expect(() => applyAction(s, actor(s), action, () => 0.4)).not.toThrow();
    });
  test('building, awards and victory achieve the advertised result', () => {
    expect(
      act(scenarioState('building'), 'BUILD_CITY').presentation.public,
    ).toContainEqual(
      expect.objectContaining({ type: 'placement', piece: 'city' }),
    );
    const awards = scenarioState('awards');
    expect(act(awards, 'KNIGHT').army).toBe(actor(awards));
    const victory = scenarioState('victory');
    expect(playerView(victory, actor(victory)).private.points).toBe(9);
    expect(act(victory, 'BUILD_CITY').phase).toEqual({
      type: 'finished',
      winner: actor(victory),
    });
  });
  test('seat switching supports a fully completed trade', () => {
    const s = scenarioState('trading'),
      p = actor(s),
      other = s.players.find((id) => id !== p)!;
    const offered = applyAction(
      s,
      p,
      {
        type: 'OFFER',
        give: [1, 0, 0, 0, 0],
        take: [0, 1, 0, 0, 0],
        to: other,
      },
      () => 0.4,
    );
    const accepted = applyAction(
      offered,
      other,
      { type: 'ACCEPT', offer: 1 },
      () => 0.4,
    );
    expect(
      accepted.presentation.public.some((e) => e.type === 'transfer'),
    ).toBe(false);
    const traded = applyAction(
      accepted,
      p,
      { type: 'CONFIRM_TRADE', offer: 1, partner: other },
      () => 0.4,
    );
    expect(traded.presentation.public.some((e) => e.type === 'transfer')).toBe(
      true,
    );
  });
  test('practice reset returns revision zero with no events', () => {
    const local = practice('building'),
      id = actor(local.state);
    local.send(id, { type: 'END_TURN' });
    expect(local.state.revision).toBe(1);
    expect(practice('building').state.revision).toBe(0);
    expect(practice('building').view(id).public.events).toEqual([]);
  });
});

test('connection notification before resumed snapshot cannot replay a missed move', () => {
  const gate = new RevisionGate(),
    old = {},
    resumed = {};
  expect(gate.accept(2, 'a', true, old)).toBe(false);
  expect(gate.accept(2, 'a', false, old)).toBe(false);
  expect(gate.accept(2, 'a', true, old)).toBe(false);
  expect(gate.accept(3, 'a', true, resumed)).toBe(false);
  expect(gate.accept(4, 'a', true, {})).toBe(true);
});

test('older snapshots cannot make an already observed revision play again', () => {
  const gate = new RevisionGate();
  gate.accept(4, 'a', true);
  expect(gate.accept(5, 'a', true)).toBe(true);
  expect(gate.accept(4, 'a', true)).toBe(false);
  expect(gate.accept(5, 'a', true)).toBe(false);
  expect(gate.accept(6, 'a', true)).toBe(true);
});

test('throw strength is public presentation metadata and never changes the dice RNG', () => {
  const before = scenarioState('production');
  const weak = applyAction(
    before,
    actor(before),
    { type: 'ROLL_DICE', strength: 0 },
    () => 0.4,
  );
  const strong = applyAction(
    before,
    actor(before),
    { type: 'ROLL_DICE', strength: 1 },
    () => 0.4,
  );
  expect(weak.dice).toEqual(strong.dice);
  expect(weak.hands).toEqual(strong.hands);
  expect(
    strong.presentation.public.find((e) => e.type === 'roll'),
  ).toMatchObject({ strength: 1 });
  for (const strength of [-1, 1.1, NaN, Infinity, '1']) {
    let consumed = false;
    expect(() =>
      applyAction(
        before,
        actor(before),
        { type: 'ROLL_DICE', strength },
        () => {
          consumed = true;
          return 0.4;
        },
      ),
    ).toThrow();
    expect(consumed).toBe(false);
  }
});

test('practice rotation visits pending discards and returns to the robber actor', () => {
  let state = scenarioState('production');
  const roller = actor(state);
  let n = 0;
  state = applyAction(state, roller, { type: 'ROLL_DICE' }, () =>
    n++ === 0 ? 0.4 : 0.55,
  );
  expect(state.phase.type).toBe('discard');
  let seat = roller;
  const visited = new Set<string>();
  while (state.phase.type === 'discard') {
    seat = practiceSeat(state, seat);
    expect(visited.has(seat)).toBe(false);
    visited.add(seat);
    let remaining = state.phase.pending![seat];
    expect(remaining).toBeGreaterThan(0);
    const resources = state.hands[state.players.indexOf(seat)].map((amount) => {
      const count = Math.min(amount, remaining);
      remaining -= count;
      return count;
    });
    state = applyAction(state, seat, { type: 'DISCARD', resources }, () => 0.4);
  }
  expect(visited.size).toBeGreaterThan(1);
  expect(state.phase.type).toBe('robber');
  expect(practiceSeat(state, seat)).toBe(roller);
});
