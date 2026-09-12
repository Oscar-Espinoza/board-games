/** Local practice only; never imported by multiplayer initialization. No bots. */
import { modules } from './tiles.js';
import { createGame, applyAction, playerView, type State } from './index.js';
export const seats = ['Rose', 'Azure', 'Amber'].map((name, i) => ({
  id: 'practice-' + i,
  name,
  connected: true,
}));
export function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const scenarios = [
  'short',
  'match',
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
export function practice(scenario: Scenario = 'short') {
  const short = scenario === 'short';
  let state =
    scenario === 'short' || scenario === 'match'
      ? createGame(seats.map((p) => p.id))
      : scenarioState(scenario);
  if (short) state.config = { farmers: false, modules: [], first: 0 };
  const random = seeded(3109);
  return {
    get state() {
      return state;
    },
    get actor() {
      return state.phase === 'setup'
        ? (state.players.find((p) => !state.ready.includes(p)) ??
            state.players[0])
        : (state.pending?.actor ?? state.players[state.active]);
    },
    view: (id: string) => playerView(state, id),
    send(id: string, action: unknown) {
      const setup = state.phase === 'setup';
      state = applyAction(state, id, action, random);
      if (setup && state.phase !== 'setup' && short)
        state.deck = state.deck.slice(0, 17);
    },
  };
}
