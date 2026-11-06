/** Deliberately local training fixtures. Never imported by multiplayer. */
import { seeded } from '@board-games/game-core';
import { m } from '@board-games/shared/messages';
import type { PracticeTable } from '@board-games/shared/ui';
import { apply, create, view } from './index.js';
import type { Assignment, Team, View } from './types.js';

export const scenarios = [
  'match',
  'midgame',
  'setup',
  'final',
  'assassin',
] as const;
export type Scenario = (typeof scenarios)[number];
export const seatCounts = [4, 5, 8, 12];

/** Training seats alternate by pairs: 0-1 red, 2-3 blue, then red on even seats. */
const teamOf = (seat: number): Team =>
  seat < 2 || (seat >= 4 && seat % 2 === 0) ? 'red' : 'blue';

export interface CodenamesPractice extends PracticeTable<View> {
  /** The active team's operative: who guesses when a bot plays the operatives. */
  readonly operative: string;
  /** While on, the table stays on the active spymaster's seat, since the human only gives clues. */
  botOperatives: boolean;
  /** Called after any seat's action is accepted, so a page can let bots reply. */
  onMove?: () => void;
}

export function practice(
  scenario: Scenario = 'match',
  { language = 'en', size = 4 }: { language?: 'en' | 'es'; size?: number } = {},
): CodenamesPractice {
  // Preset positions need a known board; a full game deals a fresh one each time.
  const random = seeded(
    scenario === 'match' || scenario === 'setup'
      ? Math.floor(Math.random() * 2 ** 31)
      : 260912,
  );
  const ids = Array.from({ length: size }, (_, i) => `training-${i}`);
  let state = create(ids, random, { boardLanguage: language });
  if (scenario !== 'setup') {
    ids.forEach((id, i) => {
      state = apply(
        state,
        id,
        {
          type: 'chooseRole',
          team: teamOf(i),
          role: i === 0 || i === 2 ? 'spymaster' : 'operative',
          version: state.setupVersion,
        },
        random,
      );
    });
    for (const id of ids)
      state = apply(
        state,
        id,
        { type: 'ready', version: state.setupVersion },
        random,
      );
  }
  const seatOf = (role: Assignment['role']) =>
    state.players.find(
      (p) =>
        state.assignments[p]?.team === state.activeTeam &&
        state.assignments[p]?.role === role,
    )!;
  const clue = (word: string, count: number | 'unlimited') => {
    state = apply(
      state,
      seatOf('spymaster'),
      { type: 'submitClue', word, count },
      random,
    );
  };
  const guessOwn = () => {
    state = apply(
      state,
      seatOf('operative'),
      {
        type: 'guess',
        card: state.board.findIndex(
          (c) => !c.revealed && c.identity === state.activeTeam,
        ),
      },
      random,
    );
  };
  const word = (en: string, es: string) => (language === 'es' ? es : en);
  if (scenario === 'midgame') {
    state.startingTeam = state.activeTeam = 'red';
    // Preserve the 9/8 starting-team deal if this seed starts blue.
    if (state.board.filter((c) => c.identity === 'red').length === 8)
      for (const c of state.board)
        if (c.identity === 'red' || c.identity === 'blue')
          c.identity = c.identity === 'red' ? 'blue' : 'red';
    clue(word('Time', 'Tiempo'), 1);
    guessOwn();
    state = apply(state, seatOf('operative'), { type: 'endTurn' }, random);
    clue(word('Water', 'Agua'), 2);
    guessOwn();
    guessOwn();
    guessOwn();
    clue(word('Music', 'Música'), 2);
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
    clue(word('Destination', 'Destino'), 1);
  return {
    botOperatives: false,
    get players() {
      return ids.map((id, i) => ({
        id,
        name: `${teamOf(i) === 'red' ? m.cn_red() : m.cn_blue()} · ${i + 1}`,
        connected: true,
        reservedUntil: null,
      }));
    },
    get operative() {
      return seatOf('operative');
    },
    get actor() {
      if (state.phase === 'setup')
        return (
          state.players.find((p) => !state.assignments[p]) ??
          state.players.find((p) => !state.ready.includes(p)) ??
          state.players[0]!
        );
      return seatOf(
        state.phase === 'clue' || this.botOperatives
          ? 'spymaster'
          : 'operative',
      );
    },
    get finished() {
      return state.phase === 'finished';
    },
    view: (seat: string) => view(state, seat),
    send(seat: string, action: unknown) {
      state = apply(state, seat, action, random);
      this.onMove?.();
    },
  };
}
