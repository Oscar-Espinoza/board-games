import { shuffle } from '@board-games/game-core';
import type { GameDefinition } from '@board-games/game-core';

export const colors = ['blue', 'yellow', 'red', 'black', 'white'] as const;
export type Color = (typeof colors)[number];
export const wallColors: readonly (readonly Color[])[] = Object.freeze([
  Object.freeze(['blue', 'yellow', 'red', 'black', 'white'] as Color[]),
  Object.freeze(['white', 'blue', 'yellow', 'red', 'black'] as Color[]),
  Object.freeze(['black', 'white', 'blue', 'yellow', 'red'] as Color[]),
  Object.freeze(['red', 'black', 'white', 'blue', 'yellow'] as Color[]),
  Object.freeze(['yellow', 'red', 'black', 'white', 'blue'] as Color[]),
]);
export const penalties = [1, 1, 2, 2, 2, 3, 3] as const;
export type Source = { kind: 'factory'; index: number } | { kind: 'center' };
export type Destination = { kind: 'pattern'; row: number } | { kind: 'floor' };
export type Action = {
  type: 'DRAFT';
  source: Source;
  color: Color;
  destination: Destination;
};
export type Bonus = { rows: number; columns: number; colors: number };
export type Board = {
  patterns: { color: Color | null; count: number }[];
  wall: boolean[][];
  floor: (Color | 'marker')[];
  score: number;
  wallPoints: number;
  floorDeductions: number;
  floorLoss: number;
  bonus: Bonus;
};
export type Scoring = {
  cells: [number, number][];
  horizontal: number;
  vertical: number;
  points: number;
};
export type Event =
  | {
      type: 'travel';
      reason: 'draft' | 'spill' | 'marker' | 'overflow' | 'deal';
      color: Color | 'marker';
      from: string;
      to: string;
    }
  | {
      type: 'wall';
      player: string;
      color: Color;
      row: number;
      column: number;
      from: string;
      to: string;
      scoring: Scoring;
    }
  | { type: 'penalty'; player: string; deduction: number; loss: number }
  | { type: 'finish'; player: string; bonus: Bonus; score: number };
export type PublicState = {
  players: string[];
  boards: Board[];
  factories: Color[][];
  center: Color[];
  turn: number;
  starter: number;
  markerOwner: string | null;
  roundNumber: number;
  phase: 'drafting' | 'finished';
  revision: number;
  winners: string[];
  events: Event[];
  bagCount: number;
  discardCount: number;
};
export type State = Omit<PublicState, 'bagCount' | 'discardCount'> & {
  bag: Color[];
  discard: Color[];
};
export type View = { public: PublicState; private: Record<string, never> };
const emptyBoard = (): Board => ({
  patterns: Array.from({ length: 5 }, () => ({ color: null, count: 0 })),
  wall: Array.from({ length: 5 }, () => Array(5).fill(false)),
  floor: [],
  score: 0,
  wallPoints: 0,
  floorDeductions: 0,
  floorLoss: 0,
  bonus: { rows: 0, columns: 0, colors: 0 },
});
export function refill(s: State, random: () => number) {
  s.factories = Array.from({ length: s.players.length * 2 + 1 }, () => []);
  for (let f = 0; f < s.factories.length; f++)
    for (let slot = 0; slot < 4; slot++) {
      if (!s.bag.length && s.discard.length) {
        s.bag = s.discard;
        s.discard = [];
        shuffle(s.bag, random);
      }
      const color = s.bag.pop();
      if (!color) return;
      s.factories[f].push(color);
      s.events.push({
        type: 'travel',
        reason: 'deal',
        color,
        from: 'bag',
        to: `factory/${f}/${slot}`,
      });
    }
}
export function create(players: string[], random: () => number): State {
  if (
    players.length < 2 ||
    players.length > 4 ||
    new Set(players).size !== players.length
  )
    throw new Error('AZUL_PLAYERS');
  const bag = colors.flatMap((color) => Array<Color>(20).fill(color));
  shuffle(bag, random);
  const starter = Math.floor(random() * players.length);
  const s: State = {
    players: [...players],
    boards: players.map(emptyBoard),
    bag,
    discard: [],
    factories: [],
    center: [],
    turn: starter,
    starter,
    markerOwner: null,
    roundNumber: 1,
    revision: 0,
    phase: 'drafting',
    winners: [],
    events: [],
  };
  refill(s, random);
  s.events = [];
  return s;
}
export function rowIssue(
  board: Board,
  color: Color,
  row: number,
): 'full' | 'mixed' | 'wall' | null {
  const pattern = board.patterns[row];
  if (pattern.count === row + 1) return 'full';
  if (pattern.color !== null && pattern.color !== color) return 'mixed';
  if (board.wall[row][wallColors[row].indexOf(color)]) return 'wall';
  return null;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
function integer(n: unknown, max: number): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < max;
}
export function validate(s: State, actor: string, input: unknown): Action {
  if (s.phase !== 'drafting') throw new Error('AZUL_FINISHED');
  if (s.players[s.turn] !== actor) throw new Error('AZUL_TURN');
  if (
    !object(input) ||
    !exact(input, ['type', 'source', 'color', 'destination']) ||
    input.type !== 'DRAFT' ||
    !colors.includes(input.color as Color) ||
    !object(input.source) ||
    !object(input.destination)
  )
    throw new Error('AZUL_ACTION');
  const { source, destination } = input;
  if (
    !(source.kind === 'center' && exact(source, ['kind'])) &&
    !(
      source.kind === 'factory' &&
      exact(source, ['kind', 'index']) &&
      integer(source.index, s.factories.length)
    )
  )
    throw new Error('AZUL_SOURCE');
  if (
    !(destination.kind === 'floor' && exact(destination, ['kind'])) &&
    !(
      destination.kind === 'pattern' &&
      exact(destination, ['kind', 'row']) &&
      integer(destination.row, 5)
    )
  )
    throw new Error('AZUL_DESTINATION');
  const action = input as unknown as Action;
  const supply =
    action.source.kind === 'center'
      ? s.center
      : s.factories[action.source.index];
  if (!supply.includes(action.color)) throw new Error('AZUL_EMPTY');
  if (
    action.destination.kind === 'pattern' &&
    rowIssue(s.boards[s.turn], action.color, action.destination.row)
  )
    throw new Error('AZUL_ROW');
  return action;
}
export function scorePlacement(
  wall: boolean[][],
  row: number,
  column: number,
): Scoring {
  const horizontal: [number, number][] = [[row, column]],
    vertical: [number, number][] = [[row, column]];
  for (const direction of [-1, 1]) {
    for (
      let c = column + direction;
      c >= 0 && c < 5 && wall[row][c];
      c += direction
    )
      horizontal.push([row, c]);
    for (
      let r = row + direction;
      r >= 0 && r < 5 && wall[r][column];
      r += direction
    )
      vertical.push([r, column]);
  }
  return {
    horizontal: horizontal.length,
    vertical: vertical.length,
    points:
      horizontal.length === 1 && vertical.length === 1
        ? 1
        : (horizontal.length > 1 ? horizontal.length : 0) +
          (vertical.length > 1 ? vertical.length : 0),
    cells: [...horizontal, ...vertical.slice(1)],
  };
}
export function bonuses(wall: boolean[][]): Bonus {
  return {
    rows: wall.filter((row) => row.every(Boolean)).length * 2,
    columns:
      Array.from({ length: 5 }, (_, c) => wall.every((row) => row[c])).filter(
        Boolean,
      ).length * 7,
    colors:
      colors.filter((color) =>
        wall.every((row, r) => row[wallColors[r].indexOf(color)]),
      ).length * 10,
  };
}
export function resolveRound(s: State, random: () => number) {
  s.boards.forEach((board, p) => {
    const player = s.players[p];
    board.patterns.forEach((pattern, row) => {
      if (pattern.count !== row + 1 || !pattern.color) return;
      const color = pattern.color,
        column = wallColors[row].indexOf(color);
      board.wall[row][column] = true;
      const scoring = scorePlacement(board.wall, row, column);
      board.score += scoring.points;
      board.wallPoints += scoring.points;
      s.events.push({
        type: 'wall',
        player,
        color,
        row,
        column,
        from: `${player}/pattern/${row}/0`,
        to: `${player}/wall/${row}/${column}`,
        scoring,
      });
      s.discard.push(...Array<Color>(row).fill(color));
      pattern.count = 0;
      pattern.color = null;
    });
    const deduction = board.floor.reduce((sum, _, i) => sum + penalties[i], 0),
      loss = Math.min(board.score, deduction);
    board.score -= loss;
    board.floorDeductions += deduction;
    board.floorLoss += loss;
    if (deduction) s.events.push({ type: 'penalty', player, deduction, loss });
    s.discard.push(
      ...board.floor.filter((color): color is Color => color !== 'marker'),
    );
    board.floor = [];
  });
  if (s.boards.some((board) => board.wall.some((row) => row.every(Boolean)))) {
    s.phase = 'finished';
    s.boards.forEach((board, p) => {
      board.bonus = bonuses(board.wall);
      board.score +=
        board.bonus.rows + board.bonus.columns + board.bonus.colors;
      s.events.push({
        type: 'finish',
        player: s.players[p],
        bonus: { ...board.bonus },
        score: board.score,
      });
    });
    const best = Math.max(...s.boards.map((b) => b.score));
    const rows = Math.max(
      ...s.boards.filter((b) => b.score === best).map((b) => b.bonus.rows),
    );
    s.winners = s.players.filter(
      (_, p) => s.boards[p].score === best && s.boards[p].bonus.rows === rows,
    );
    return;
  }
  if (s.markerOwner !== null) s.starter = s.players.indexOf(s.markerOwner);
  s.markerOwner = null;
  s.turn = s.starter;
  s.roundNumber++;
  refill(s, random);
}
export function apply(
  state: State,
  actor: string,
  input: unknown,
  random: () => number,
): State {
  const a = validate(state, actor, input),
    s = structuredClone(state);
  s.events = [];
  s.revision++;
  const board = s.boards[s.turn];
  const floor = (
    color: Color | 'marker',
    from: string,
    reason: 'draft' | 'marker' | 'overflow',
  ) => {
    const to =
      board.floor.length < 7
        ? `${actor}/floor/${board.floor.length}`
        : color === 'marker'
          ? `${actor}/marker`
          : 'discard';
    if (board.floor.length < 7) board.floor.push(color);
    else if (color !== 'marker') s.discard.push(color);
    s.events.push({ type: 'travel', reason, color, from, to });
  };
  if (a.source.kind === 'center' && s.markerOwner === null) {
    s.markerOwner = actor;
    floor('marker', 'center/marker', 'marker');
  }
  const supply =
    a.source.kind === 'center' ? s.center : s.factories[a.source.index];
  supply.forEach((color, slot) => {
    const from =
      a.source.kind === 'center'
        ? `center/${color}`
        : `factory/${a.source.index}/${slot}`;
    if (color !== a.color) {
      if (a.source.kind === 'factory') {
        s.center.push(color);
        s.events.push({
          type: 'travel',
          reason: 'spill',
          color,
          from,
          to: `center/${color}`,
        });
      }
      return;
    }
    if (
      a.destination.kind === 'pattern' &&
      board.patterns[a.destination.row].count < a.destination.row + 1
    ) {
      const pattern = board.patterns[a.destination.row];
      pattern.color = color;
      s.events.push({
        type: 'travel',
        reason: 'draft',
        color,
        from,
        to: `${actor}/pattern/${a.destination.row}/${pattern.count++}`,
      });
    } else
      floor(color, from, a.destination.kind === 'floor' ? 'draft' : 'overflow');
  });
  if (a.source.kind === 'center')
    s.center = s.center.filter((color) => color !== a.color);
  else s.factories[a.source.index] = [];
  if (!s.center.length && s.factories.every((f) => !f.length))
    resolveRound(s, random);
  else s.turn = (s.turn + 1) % s.players.length;
  return s;
}
export function view(s: State, _player?: string): View {
  // Whitelist at the only network projection boundary; never include bag order.
  return {
    public: structuredClone({
      players: s.players,
      boards: s.boards.map((b) => ({
        patterns: b.patterns.map((p) => ({ color: p.color, count: p.count })),
        wall: b.wall,
        floor: b.floor,
        score: b.score,
        wallPoints: b.wallPoints,
        floorDeductions: b.floorDeductions,
        floorLoss: b.floorLoss,
        bonus: {
          rows: b.bonus.rows,
          columns: b.bonus.columns,
          colors: b.bonus.colors,
        },
      })),
      factories: s.factories,
      center: s.center,
      turn: s.turn,
      starter: s.starter,
      markerOwner: s.markerOwner,
      roundNumber: s.roundNumber,
      phase: s.phase,
      revision: s.revision,
      winners: s.winners,
      events: s.events,
      bagCount: s.bag.length,
      discardCount: s.discard.length,
    }),
    private: {},
  };
}
export const azul: GameDefinition<State> = {
  id: 'azul',
  minPlayers: 2,
  maxPlayers: 4,
  create,
  apply,
  view,
  isFinished: (s) => s.phase === 'finished',
};
