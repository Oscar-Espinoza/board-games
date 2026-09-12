/** Deliberately local training fixtures. Never imported by multiplayer. */
import { create, apply, view } from './index.js';
import type { State, Team } from './types.js';
export const seats = [
  'Red spymaster',
  'Red operative',
  'Blue spymaster',
  'Blue operative',
].map((name, i) => ({ id: `training-${i}`, name, connected: true }));
export const scenarios = ['match', 'setup', 'final', 'assassin'] as const;
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
) {
  const random = seeded(260912);
  let state = create(
    seats.map((p) => p.id),
    random,
    { boardLanguage: language },
  );
  if (scenario !== 'setup') {
    for (let i = 0; i < 4; i++)
      state = apply(
        state,
        seats[i]!.id,
        {
          type: 'chooseRole',
          team: i < 2 ? 'red' : 'blue',
          role: i % 2 ? 'operative' : 'spymaster',
          version: state.setupVersion,
        },
        random,
      );
    for (const p of seats)
      state = apply(
        state,
        p.id,
        { type: 'ready', version: state.setupVersion },
        random,
      );
  }
  if (scenario === 'final') {
    const team = state.activeTeam;
    let left = false;
    for (const cell of state.board)
      if (cell.identity === team) {
        if (left) cell.revealed = true;
        left = true;
      }
  }
  if (scenario === 'assassin') {
    const spy = seats.find(
      (p) =>
        state.assignments[p.id]?.team === state.activeTeam &&
        state.assignments[p.id]?.role === 'spymaster',
    )!;
    state = apply(
      state,
      spy.id,
      {
        type: 'submitClue',
        word: language === 'es' ? 'Sombra' : 'Shadow',
        count: 1,
      },
      random,
    );
    const reviewer = seats.find(
      (p) =>
        state.assignments[p.id]?.team !== state.activeTeam &&
        state.assignments[p.id]?.role === 'spymaster',
    )!;
    state = apply(
      state,
      reviewer.id,
      { type: 'reviewClue', allow: true },
      random,
    );
  }
  return {
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
      const team: Team =
        state.phase === 'clueReview' || state.phase === 'penalty'
          ? state.activeTeam === 'red'
            ? 'blue'
            : 'red'
          : state.activeTeam;
      const role = state.phase === 'guessing' ? 'operative' : 'spymaster';
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
