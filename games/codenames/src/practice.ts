/** Deliberately local training fixtures. Never imported by multiplayer. */
import { create, apply, view } from './index.js';
import type { State, Team } from './types.js';
export const seats = [
  'Red spymaster',
  'Red operative',
  'Blue spymaster',
  'Blue operative',
].map((name, i) => ({ id: `training-${i}`, name, connected: true }));
export const scenarios = [
  'match',
  'midgame',
  'setup',
  'final',
  'assassin',
] as const;
export type Scenario = (typeof scenarios)[number];
export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function practice(
  scenario: Scenario = 'match',
  language: 'en' | 'es' = 'en',
  size = 4,
) {
  const random = seeded(260912);
  const roster = [
    ...seats,
    ...Array.from({ length: Math.max(0, Math.min(8, size) - 4) }, (_, i) => ({
      id: `training-${i + 4}`,
      name: `Player ${i + 5}`,
      connected: true,
    })),
  ];
  let state = create(
    roster.map((p) => p.id),
    random,
    { boardLanguage: language },
  );
  if (scenario !== 'setup') {
    for (let i = 0; i < roster.length; i++)
      state = apply(
        state,
        roster[i]!.id,
        {
          type: 'chooseRole',
          team: i < 2 || (i >= 4 && i % 2 === 0) ? 'red' : 'blue',
          role: i === 0 || i === 2 ? 'spymaster' : 'operative',
          version: state.setupVersion,
        },
        random,
      );
    for (const p of roster)
      state = apply(
        state,
        p.id,
        { type: 'ready', version: state.setupVersion },
        random,
      );
  }
  const actorFor = (role: 'spymaster' | 'operative') =>
    state.players.find(
      (p) =>
        state.assignments[p]?.team === state.activeTeam &&
        state.assignments[p]?.role === role,
    )!;
  const clue = (word: string, count: number | 'unlimited') => {
    state = apply(
      state,
      actorFor('spymaster'),
      { type: 'submitClue', word, count },
      random,
    );
  };
  const guessOwn = () => {
    state = apply(
      state,
      actorFor('operative'),
      {
        type: 'guess',
        card: state.board.findIndex(
          (c) => !c.revealed && c.identity === state.activeTeam,
        ),
      },
      random,
    );
  };
  if (scenario === 'midgame') {
    // Local deterministic example: one red, three blue, then two red agents.
    state.startingTeam = state.activeTeam = 'red';
    // Preserve the 9/8 starting-team deal if this seed starts blue.
    if (state.board.filter((c) => c.identity === 'red').length === 8)
      for (const c of state.board)
        if (c.identity === 'red' || c.identity === 'blue')
          c.identity = c.identity === 'red' ? 'blue' : 'red';
    clue(language === 'es' ? 'Tiempo' : 'Time', 1);
    guessOwn();
    state = apply(state, actorFor('operative'), { type: 'endTurn' }, random);
    clue(language === 'es' ? 'Agua' : 'Water', 2);
    guessOwn();
    guessOwn();
    guessOwn();
    clue(language === 'es' ? 'Música' : 'Music', 2);
    guessOwn();
    guessOwn();
  }
  if (scenario === 'final') {
    const team = state.startingTeam;
    let left = false;
    for (const cell of state.board)
      if (cell.identity === team) {
        if (left) cell.revealed = true;
        left = true;
      }
  }
  if (scenario === 'final' || scenario === 'assassin')
    clue(language === 'es' ? 'Destino' : 'Destination', 1);
  return {
    seats: roster,
    get state(): State {
      return state;
    },
    get actor() {
      if (state.phase === 'setup')
        return (
          state.players.find((p) => !state.assignments[p]) ??
          state.players.find((p) => !state.ready.includes(p)) ??
          state.players[0]!
        );
      const team: Team = state.activeTeam;
      const role = state.phase === 'clue' ? 'spymaster' : 'operative';
      return state.players.find(
        (p) =>
          state.assignments[p]?.team === team &&
          state.assignments[p]?.role === role,
      )!;
    },
    view: (player: string) => view(state, player),
    send(player: string, action: unknown) {
      state = apply(state, player, action, random);
    },
  };
}
