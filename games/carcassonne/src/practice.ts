import { seeded, type Player } from '@board-games/game-core';
import type { PracticeTable } from '@board-games/shared/ui';
/** Local practice only; never imported by multiplayer initialization. No bots. */
import { placements, regionAt } from './features.js';
import { modules } from './tiles.js';
import {
  createGame,
  applyAction,
  playerView,
  type State,
  type View,
} from './index.js';
const practiceSeats = (names: string[]): Player[] =>
  names.map((name, i) => ({
    id: 'practice-' + i,
    name,
    connected: true,
    reservedUntil: null,
  }));
const seats = practiceSeats(['Rose', 'Azure', 'Amber']);
/** The `short` scenario plays only this many tiles. */
const SHORT_DECK = 17;
export const scenarios = [
  'short',
  'match',
  'table',
  'builder',
  'pig',
  'flight',
  'ferries',
  'gold',
  'magic',
  'messages',
  'crops',
] as const;
export type Scenario = (typeof scenarios)[number];
function scenarioState(scenario: Scenario): State {
  const s = createGame(seats.map((p) => p.id));
  s.config = { farmers: true, modules: [...modules], first: 0 };
  s.phase = 'place';
  s.stage = 'place';
  s.turn = 1;
  s.messages = [4, 1, 2, 3, 5, 6, 7, 8];
  s.deck = ['E', 'B', 'U', 'V', 'B'];
  const put = (id: string, x: number, y: number, rotation = 0) =>
    (s.board[`${x},${y}`] = { id, x, y, rotation, turn: 0 });
  const figure = (
    tile: string,
    region: string,
    attachment?: 'builder' | 'pig',
    owner = s.players[0],
  ) =>
    s.figures.push({
      id: ++s.figureSerial,
      owner,
      tile,
      region,
      type: 'meeple',
      attachment,
    });
  if (scenario === 'builder') {
    put('U', 0, 0);
    figure('0,0', 'r0', 'builder');
    s.current = 'U';
  } else if (scenario === 'pig') {
    put('M', 0, 0);
    put('E', 0, -1, 2);
    figure('0,0', 'f0', 'pig', s.players[1]);
    s.current = 'E';
  } else if (scenario === 'flight') {
    for (let x = -3; x <= 0; x++) put('B', x, 0);
    s.current = 'FlyG';
  } else if (scenario === 'ferries') {
    put('U', 0, 0);
    figure('0,0', 'r0');
    s.current = 'FerryE';
  } else if (scenario === 'gold') {
    put('D', 0, 0);
    s.current = 'GoldF';
  } else if (scenario === 'magic') {
    put('D', 0, 0);
    figure('0,0', 'r0');
    s.current = 'MagicA';
  } else if (scenario === 'messages') {
    put('B', 0, 0);
    s.current = 'B';
    s.last = '0,0';
    s.phase = 'decision';
    s.stage = 'markers';
    s.turnPoints = { [s.players[0]]: 5 };
    s.pending = {
      id: ++s.serial,
      kind: 'marker',
      actor: s.players[0],
      options: [
        { id: '0', kind: 'marker', value: 0 },
        { id: '1', kind: 'marker', value: 1 },
      ],
    };
  } else {
    put('U', 0, 0);
    figure('0,0', 'r0', undefined, s.players[1]);
    s.current = 'CropA';
  }
  return s;
}
const tableSeats = practiceSeats([
  'Eleanor',
  'Magnus',
  'Clara',
  'Rurik',
  'Isolde',
  'Hugo',
]);
// A reproducible developed landscape built exclusively through accepted actions:
// tiles go nearest the middle, meeples on the first road, city or monastery offered.
// A local review fixture, never a multiplayer initializer.
function paintedTable(): State {
  let s = createGame(tableSeats.map((p) => p.id));
  s.config = { farmers: true, modules: ['abbot', 'inns', 'traders'], first: 0 };
  const random = seeded(9222026);
  for (const player of s.players)
    s = applyAction(s, player, { type: 'ready', version: 0 }, random);
  for (
    let steps = 0;
    steps < 400 && (Object.keys(s.board).length < 29 || s.phase !== 'place');
    steps++
  ) {
    if (s.phase === 'place') {
      const legal = placements(s.board, s.current!);
      const cells = Object.values(s.board);
      const cx = cells.reduce((sum, t) => sum + t.x, 0) / cells.length;
      const cy = cells.reduce((sum, t) => sum + t.y, 0) / cells.length;
      legal.sort(
        (a, b) =>
          (a.x - cx) ** 2 +
          (a.y - cy) ** 2 * 3 -
          ((b.x - cx) ** 2 + (b.y - cy) ** 2 * 3),
      );
      s = applyAction(
        s,
        s.players[s.active],
        { type: 'place', turn: s.turn, ...legal[0] },
        random,
      );
    } else if (s.pending) {
      const prompt = s.pending;
      const option =
        prompt.options.find(
          (o) =>
            o.kind === 'deploy' &&
            o.figure === 'meeple' &&
            regionAt(s, o.target!).kind !== 'field',
        ) ??
        prompt.options.find((o) => o.kind === 'skip') ??
        prompt.options[0];
      s = applyAction(
        s,
        prompt.actor,
        { type: 'choose', prompt: prompt.id, choice: option.id },
        random,
      );
    } else break;
  }
  return s;
}
export function practice(scenario: Scenario = 'short'): PracticeTable<View> {
  const short = scenario === 'short';
  let state =
    scenario === 'table'
      ? paintedTable()
      : scenario === 'short' || scenario === 'match'
        ? createGame(seats.map((p) => p.id))
        : scenarioState(scenario);
  if (short) state.config = { farmers: false, modules: [], first: 0 };
  const players = scenario === 'table' ? tableSeats : seats;
  const random = seeded(3109);
  return {
    players,
    get actor() {
      return state.phase === 'setup'
        ? (state.players.find((p) => !state.ready.includes(p)) ??
            state.players[0])
        : (state.pending?.actor ?? state.players[state.active]);
    },
    get finished() {
      return state.phase === 'finished';
    },
    view: (id) => playerView(state, id),
    send(id, action) {
      if (
        state.phase === 'setup' &&
        (action as { type?: unknown })?.type === 'ready'
      ) {
        // One Start button confirms every local seat.
        let next = state;
        for (const player of players)
          next = applyAction(
            next,
            player.id,
            { type: 'ready', version: state.setupVersion },
            random,
          );
        if (short) next.deck = next.deck.slice(0, SHORT_DECK);
        state = next;
      } else state = applyAction(state, id, action, random);
    },
  };
}
