import { shuffle } from '@board-games/game-core';
import type { GameDefinition } from '@board-games/game-core';
import { idealPoses, plug, separate, type Pose } from './layout.js';

/** Venezuelan pairs domino: double-six, four seats, partners opposite. */
export const TARGET = 100;
export type Tile = { id: number; a: number; b: number };
export const TILES: readonly Tile[] = Object.freeze(
  Array.from({ length: 7 }, (_, a) =>
    Array.from({ length: 7 - a }, (_, i) => ({ id: 0, a, b: a + i })),
  )
    .flat()
    .map((t, id) => Object.freeze({ ...t, id })),
);
export const DOUBLE_SIX = TILES.findIndex((t) => t.a === 6 && t.b === 6);
export const pips = (id: number) => TILES[id].a + TILES[id].b;
export type End = 'left' | 'right';
/** A placed tile with its pips oriented left→right along the chain. */
export type Link = { id: number; left: number; right: number; seq: number };
export type Team = 0 | 1;
export const teamOf = (seat: number): Team => (seat % 2) as Team;
export type Action =
  | { type: 'PLAY'; tileId: number; end: End; force: number }
  | { type: 'PASS' }
  | { type: 'ARRANGE' }
  | { type: 'RENAME_TEAM'; team: Team; name: string }
  | { type: 'NEXT_HAND' };
export type Legal =
  { type: 'PLAY'; tileId: number; end: End } | { type: 'PASS' };
export type Last =
  | { type: 'play'; seat: number; id: number; end: End; force: number }
  | { type: 'pass'; seat: number }
  | null;
export type Result = {
  kind: 'domino' | 'tranque';
  /** Winning team, or null for a tied tranque. */
  winner: Team | null;
  /** Seat that went out (domino) or held the lowest count (tranque). */
  seat: number | null;
  points: number;
  teamPips: [number, number];
  hands: number[][];
};
export type State = {
  players: string[];
  hands: number[][];
  chain: Link[];
  turn: number;
  leader: number;
  passes: number;
  handNumber: number;
  teams: [string, string];
  scores: [number, number];
  /** Where each tile on the table actually rests; cosmetic only. */
  poses: Record<number, Pose>;
  last: Last;
  result: Result | null;
  phase: 'playing' | 'scored' | 'finished';
  revision: number;
};
export type PublicState = Omit<State, 'hands'> & {
  handCounts: number[];
  ends: { left: number; right: number } | null;
};
export type Private = { hand: number[]; legal: Legal[] };
export type View = { public: PublicState; private: Private };

function deal(s: State, random: () => number) {
  const ids = TILES.map((t) => t.id);
  shuffle(ids, random);
  s.hands = s.players.map((_, i) =>
    ids.slice(i * 7, i * 7 + 7).sort((x, y) => x - y),
  );
  s.chain = [];
  s.poses = {};
  s.passes = 0;
  s.last = null;
  s.result = null;
  s.phase = 'playing';
  s.turn = s.leader;
}
export function create(players: string[], random: () => number): State {
  if (players.length !== 4 || new Set(players).size !== 4)
    throw new Error('DOMINO_PLAYERS');
  const s: State = {
    players: [...players],
    hands: [],
    chain: [],
    turn: 0,
    leader: 0,
    passes: 0,
    handNumber: 1,
    teams: ['Nosotros', 'Ellos'],
    scores: [0, 0],
    poses: {},
    last: null,
    result: null,
    phase: 'playing',
    revision: 0,
  };
  deal(s, random);
  // The double six opens the first hand.
  s.leader = s.turn = s.hands.findIndex((h) => h.includes(DOUBLE_SIX));
  return s;
}
export const ends = (chain: Link[]) =>
  chain.length
    ? { left: chain[0].left, right: chain[chain.length - 1].right }
    : null;
export function legalFor(s: State, seat: number): Legal[] {
  if (s.phase !== 'playing' || s.turn !== seat) return [];
  const hand = s.hands[seat];
  if (!s.chain.length) {
    const opening =
      s.handNumber === 1 ? hand.filter((id) => id === DOUBLE_SIX) : hand;
    return opening.map((tileId) => ({ type: 'PLAY', tileId, end: 'right' }));
  }
  const e = ends(s.chain)!;
  const legal: Legal[] = [];
  for (const tileId of hand) {
    const { a, b } = TILES[tileId];
    if (a === e.left || b === e.left)
      legal.push({ type: 'PLAY', tileId, end: 'left' });
    if (a === e.right || b === e.right)
      legal.push({ type: 'PLAY', tileId, end: 'right' });
  }
  return legal.length ? legal : [{ type: 'PASS' }];
}
const canPlay = (s: State, seat: number) => {
  const e = ends(s.chain);
  return (
    !e ||
    s.hands[seat].some((id) =>
      [TILES[id].a, TILES[id].b].some((v) => v === e.left || v === e.right),
    )
  );
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((k) => Object.hasOwn(value, k))
  );
}
export function validate(s: State, actor: string, input: unknown): Action {
  const seat = s.players.indexOf(actor);
  if (seat < 0) throw new Error('DOMINO_SEAT');
  if (!object(input) || typeof input.type !== 'string')
    throw new Error('DOMINO_ACTION');
  switch (input.type) {
    case 'ARRANGE':
    case 'NEXT_HAND':
    case 'PASS':
      if (!exact(input, ['type'])) throw new Error('DOMINO_ACTION');
      break;
    case 'RENAME_TEAM':
      if (
        !exact(input, ['type', 'team', 'name']) ||
        (input.team !== 0 && input.team !== 1) ||
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.trim().length > 16
      )
        throw new Error('DOMINO_NAME');
      break;
    case 'PLAY':
      if (
        !exact(input, ['type', 'tileId', 'end', 'force']) ||
        !Number.isInteger(input.tileId) ||
        (input.end !== 'left' && input.end !== 'right') ||
        typeof input.force !== 'number' ||
        !(input.force >= 0 && input.force <= 1)
      )
        throw new Error('DOMINO_ACTION');
      break;
    default:
      throw new Error('DOMINO_ACTION');
  }
  const action = input as Action;
  if (action.type === 'NEXT_HAND' && s.phase !== 'scored')
    throw new Error('DOMINO_PHASE');
  if (action.type === 'PASS' || action.type === 'PLAY') {
    const legal = legalFor(s, seat);
    if (!legal.length) throw new Error('DOMINO_TURN');
    const ok =
      action.type === 'PASS'
        ? legal[0].type === 'PASS'
        : legal.some(
            (l) =>
              l.type === 'PLAY' &&
              l.tileId === action.tileId &&
              (s.chain.length === 0 || l.end === action.end),
          );
    if (!ok) throw new Error('DOMINO_ILLEGAL');
  }
  return action;
}
/** A hard strike shoves nearby tiles; cosmetic and seeded by the server. */
function scatter(
  s: State,
  placed: number,
  force: number,
  random: () => number,
) {
  if (force <= 0.55) return;
  const k = (force - 0.55) / 0.45;
  const at = s.chain.findIndex((l) => l.id === placed);
  const home = idealPoses(s.chain);
  const clamp = (v: number, c: number, m: number) =>
    Math.max(c - m, Math.min(c + m, v));
  s.chain.forEach((link, i) => {
    const d = Math.abs(i - at);
    const reach = k * Math.exp(-d / 4) * (0.35 + random() * 0.65);
    const angle = random() * Math.PI * 2;
    const p = s.poses[link.id];
    const h = home[link.id];
    s.poses[link.id] = {
      x: clamp(p.x + Math.cos(angle) * reach * 0.7, h.x, 1.4),
      y: clamp(p.y + Math.sin(angle) * reach * 0.7, h.y, 1.4),
      angle: clamp(p.angle + (random() - 0.5) * reach * 50, h.angle, 35),
    };
  });
  separate(s.poses);
}
/** The chain once `tileId` is attached at `end`; pips oriented along it. */
export function attach(chain: Link[], tileId: number, end: End): Link[] {
  const { a, b } = TILES[tileId];
  const seq = chain.length;
  const e = ends(chain);
  if (!e) return [{ id: tileId, left: a, right: b, seq }];
  if (end === 'left') {
    const right = e.left;
    return [{ id: tileId, left: a === right ? b : a, right, seq }, ...chain];
  }
  const left = e.right;
  return [...chain, { id: tileId, left, right: a === left ? b : a, seq }];
}
function score(s: State, kind: Result['kind'], seat: number | null) {
  const counts = s.hands.map((h) => h.reduce((sum, id) => sum + pips(id), 0));
  const teamPips: [number, number] = [
    counts[0] + counts[2],
    counts[1] + counts[3],
  ];
  const total = teamPips[0] + teamPips[1];
  let winner: Team | null = kind === 'domino' ? teamOf(seat!) : null;
  if (kind === 'tranque' && teamPips[0] !== teamPips[1])
    winner = teamPips[0] < teamPips[1] ? 0 : 1;
  if (kind === 'tranque' && winner !== null) {
    const members = [winner, winner + 2];
    seat = counts[members[0]] <= counts[members[1]] ? members[0] : members[1];
  }
  const points = winner === null ? 0 : total;
  if (winner !== null) s.scores[winner] += points;
  s.result = {
    kind,
    winner,
    seat,
    points,
    teamPips,
    hands: s.hands.map((h) => [...h]),
  };
  s.phase = s.scores.some((v) => v >= TARGET) ? 'finished' : 'scored';
}
export function apply(
  state: State,
  actor: string,
  input: unknown,
  random: () => number,
): State {
  const action = validate(state, actor, input);
  const s = structuredClone(state);
  const seat = s.players.indexOf(actor);
  s.revision++;
  if (action.type === 'ARRANGE') s.poses = idealPoses(s.chain);
  else if (action.type === 'RENAME_TEAM')
    s.teams[action.team] = action.name.trim();
  else if (action.type === 'NEXT_HAND') {
    s.handNumber++;
    s.leader = (s.leader + 1) % 4;
    deal(s, random);
  } else if (action.type === 'PASS') {
    s.passes++;
    s.last = { type: 'pass', seat };
    s.turn = (s.turn + 1) % 4;
  } else {
    const end = s.chain.length ? action.end : 'right';
    s.chain = attach(s.chain, action.tileId, end);
    s.poses[action.tileId] = plug(s.chain, s.poses, action.tileId);
    s.hands[seat] = s.hands[seat].filter((id) => id !== action.tileId);
    s.passes = 0;
    s.last = {
      type: 'play',
      seat,
      id: action.tileId,
      end,
      force: action.force,
    };
    scatter(s, action.tileId, action.force, random);
    if (!s.hands[seat].length) score(s, 'domino', seat);
    else if (s.players.every((_, i) => !canPlay(s, i)))
      score(s, 'tranque', null);
    else s.turn = (s.turn + 1) % 4;
  }
  return s;
}
export function view(s: State, playerId?: string): View {
  const seat = playerId ? s.players.indexOf(playerId) : -1;
  const { hands, ...rest } = s;
  return {
    public: structuredClone({
      ...rest,
      handCounts: hands.map((h) => h.length),
      ends: ends(s.chain),
    }),
    private: {
      hand: seat >= 0 ? [...hands[seat]] : [],
      legal: seat >= 0 ? legalFor(s, seat) : [],
    },
  };
}
export const domino: GameDefinition<State> = {
  id: 'domino',
  minPlayers: 4,
  maxPlayers: 4,
  create,
  apply,
  view,
  isFinished: (s) => s.phase === 'finished',
};
