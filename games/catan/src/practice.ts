import { seeded, type Player } from '@board-games/game-core';
import type { PracticeTable } from '@board-games/shared/ui';
import { applyAction, createGame, playerView, type State } from './index.js';

const players: Player[] = ['Coral', 'Azure', 'Pearl', 'Amber'].map(
  (name, i) => ({
    id: `practice-${i}`,
    name,
    connected: true,
    reservedUntil: null,
  }),
);
/** Fixed seeds: every reset deals the same board and rolls the same dice. */
const FIXTURE_SEED = 42,
  DICE_SEED = 10;
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
/** Local fixtures only. Never imported by room creation or the catalog. */
function scenarioState(scenario: Scenario): State {
  const s = createGame(
    players.map((p) => p.id),
    seeded(FIXTURE_SEED),
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
/** The seat that must act next; during discards, each pending seat in turn. */
function nextActor(state: State, current: string) {
  if (state.phase.type === 'discard') {
    const pending = state.phase.pending ?? {};
    return pending[current] ? current : (Object.keys(pending)[0] ?? current);
  }
  return state.phase.player ?? current;
}

export function practice(
  scenario: Scenario,
): PracticeTable<ReturnType<typeof playerView>> {
  let state = scenarioState(scenario);
  let actor = state.phase.player!;
  const random = seeded(DICE_SEED);
  return {
    players,
    get actor() {
      return actor;
    },
    get finished() {
      return state.phase.type === 'finished';
    },
    view: (seat) => playerView(state, seat),
    send(seat, action) {
      state = applyAction(state, seat, action, random);
      actor = nextActor(state, seat);
    },
  };
}
