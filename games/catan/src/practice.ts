import {
  applyAction,
  createGame,
  playerView,
  type Action,
  type State,
} from './index.js';

export const seats = ['Coral', 'Azure', 'Pearl', 'Amber'].map((name, i) => ({
  id: `practice-${i}`,
  name,
}));
export const scenarios = [
  'setup',
  'building',
  'production',
  'robber',
  'monopoly',
  'trading',
  'awards',
  'victory',
] as const;
export type Scenario = (typeof scenarios)[number];
export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/** Local fixtures only. Never imported by room creation or the catalog. */
export function scenarioState(scenario: Scenario): State {
  const s = createGame(
    seats.map((p) => p.id),
    seeded(42),
    scenario === 'setup' ? 'variable' : 'beginner',
  );
  if (scenario === 'setup') return s;
  const actor = s.players[s.primary],
    i = s.primary;
  // Redistribute from the finite bank; do not introduce extra resource cards.
  s.bank = s.bank.map(
    (n, r) => n + s.hands.reduce((total, hand) => total + hand[r], 0),
  );
  s.hands = s.hands.map(() => [0, 0, 0, 0, 0]);
  s.hands.forEach((hand) =>
    hand.forEach((_, r) => {
      hand[r] = 4;
      s.bank[r] -= 4;
    }),
  );
  s.phase = {
    type: 'turn',
    player: actor,
    stage: scenario === 'production' ? 'production' : 'actions',
  };
  const card = (
    kind: 'MONOPOLY' | 'KNIGHT' | 'VICTORY_POINT',
    played = false,
  ) => {
    s.deck.splice(s.deck.indexOf(kind), 1);
    if (played) s.played[i].push(kind);
    else s.development[i].push({ kind, bought: 0 });
  };
  if (scenario === 'robber')
    s.phase = { type: 'robber', player: actor, resume: 'actions' };
  if (scenario === 'monopoly') card('MONOPOLY');
  if (scenario === 'awards') {
    card('KNIGHT', true);
    card('KNIGHT', true);
    card('KNIGHT');
  }
  if (scenario === 'victory') {
    for (let n = 0; n < 5; n++) card('VICTORY_POINT');
    for (let n = 0; n < 3; n++) card('KNIGHT', true);
    s.army = actor;
  }
  return s;
}
export function practice(scenario: Scenario) {
  let state = scenarioState(scenario);
  const random = seeded(10);
  return {
    get state() {
      return state;
    },
    view: (seat: string) => playerView(state, seat),
    send(seat: string, action: Action) {
      state = applyAction(state, seat, action, random);
    },
  };
}

/** The next required seat in the local sandbox, including each pending discard. */
export function practiceSeat(state: State, current: string): string {
  if (state.phase.type === 'discard') {
    const pending = state.phase.pending ?? {};
    return pending[current] ? current : (Object.keys(pending)[0] ?? current);
  }
  return state.phase.type === 'finished'
    ? current
    : (state.phase.player ?? current);
}
