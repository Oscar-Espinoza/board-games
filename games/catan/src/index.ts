import { present, type Presentation } from './presentation.js';
import type { GameDefinition } from '@board-games/game-core';
import { makeBoard, incident, edgeId, shuffle, type Board } from './board.js';
export const resources = ['wood', 'wool', 'wheat', 'brick', 'ore'] as const;
export type Development =
  'KNIGHT' | 'MONOPOLY' | 'ROAD_BUILDING' | 'INVENTION' | 'VICTORY_POINT';
export interface Action {
  type: string;
  strength?: number;
  vertex?: number;
  edge?: number;
  hex?: number;
  victim?: string;
  resource?: number;
  resources?: number[];
  give?: number[] | number;
  take?: number[] | number;
  to?: string | null;
  offer?: number;
  partner?: string;
}
type Phase = {
  type:
    | 'setup'
    | 'turn'
    | 'discard'
    | 'robber'
    | 'victim'
    | 'free_roads'
    | 'finished';
  player?: string;
  step?: number;
  settlement?: number | null;
  stage?: 'production' | 'actions';
  resume?: 'production' | 'actions';
  pending?: Record<string, number>;
  targets?: string[];
  remaining?: number;
  winner?: string;
};
interface Building {
  owner: string | null;
  color: number;
  city: boolean;
}
interface Offer {
  id: number;
  from: string;
  to: string | null;
  give: number[];
  take: number[];
  opportunity: number;
  accepted: string[];
}
export interface State {
  players: string[];
  board: Board;
  buildings: (Building | null)[];
  roads: (string | null)[];
  hands: number[][];
  development: { kind: Development; bought: number }[][];
  played: Development[][];
  deck: Development[];
  bank: number[];
  robber: number;
  phase: Phase;
  first: number;
  primary: number;
  paired: boolean;
  opportunity: number;
  playedThisTurn: boolean;
  dice: number[] | null;
  longest: string | null;
  army: string | null;
  offers: Offer[];
  nextOffer: number;
  colors: number[];
  revision: number;
  presentation: Presentation;
}
const zero = () => [0, 0, 0, 0, 0],
  total = (a: number[]) => a.reduce((x, y) => x + y, 0),
  enough = (a: number[], b: number[]) => a.every((n, i) => n >= b[i]);
const costs = {
  BUILD_ROAD: [1, 0, 0, 1, 0],
  BUILD_SETTLEMENT: [1, 1, 1, 1, 0],
  BUILD_CITY: [0, 0, 2, 0, 3],
  BUY_DEVELOPMENT: [0, 1, 1, 0, 1],
};
function assert(
  ok: unknown,
  message = 'That action is not legal now.',
): asserts ok {
  if (!ok) throw new Error(message);
}
const active = (s: State) =>
  s.players[(s.primary + (s.paired ? 3 : 0)) % s.players.length];
const pay = (s: State, i: number, c: number[]) =>
  c.forEach((n, r) => {
    s.hands[i][r] -= n;
    s.bank[r] += n;
  });
function starting(s: State, p: string, v: number) {
  for (const h of s.board.hexes)
    if (h.vertices.includes(v) && h.resource !== null) {
      s.hands[s.players.indexOf(p)][h.resource]++;
      s.bank[h.resource]--;
    }
}
export function createGame(
  players: string[],
  random: () => number,
  setup: 'variable' | 'beginner' = 'variable',
): State {
  assert(
    players.length >= 3 &&
      players.length <= 6 &&
      new Set(players).size === players.length,
    'CATAN requires 3–6 different players.',
  );
  const extended = players.length > 4,
    board = makeBoard(extended, random, setup === 'variable');
  const deck = shuffle(
    (
      [
        ['KNIGHT', extended ? 20 : 14],
        ['MONOPOLY', extended ? 3 : 2],
        ['ROAD_BUILDING', extended ? 3 : 2],
        ['INVENTION', extended ? 3 : 2],
        ['VICTORY_POINT', 5],
      ] as [Development, number][]
    ).flatMap(([kind, n]) => Array<Development>(n).fill(kind)),
    random,
  );
  // Uniform selection is equivalent to repeated tied starting dice, without an unbounded tie loop.
  const first = Math.floor(random() * players.length),
    deserts = board.hexes.flatMap((h, i) => (h.resource === null ? [i] : []));
  const colors =
    players.length === 3
      ? [0, 1, 3]
      : players.length === 5 && setup === 'beginner'
        ? shuffle([0, 1, 2, 3, 4, 5], random).slice(0, 5)
        : players.map((_, i) => i);
  const s: State = {
    players: [...players],
    board,
    buildings: board.vertices.map(() => null),
    roads: board.edges.map(() => null),
    hands: players.map(zero),
    development: players.map(() => []),
    played: players.map(() => []),
    deck,
    bank: Array(5).fill(extended ? 24 : 19),
    robber:
      deserts[setup === 'beginner' ? 0 : Math.floor(random() * deserts.length)],
    phase: { type: 'setup', player: players[first], step: 0, settlement: null },
    first,
    primary: first,
    paired: false,
    opportunity: 1,
    playedThisTurn: false,
    dice: null,
    longest: null,
    army: null,
    offers: [],
    nextOffer: 1,
    colors,
    revision: 0,
    presentation: { public: [], recipients: {} },
  };
  if (setup === 'beginner') {
    const placements = extended
      ? [
          [
            [3, 4, 3],
            [14, 4, 3],
          ],
          [
            [17, 3, 4],
            [15, 2, 1],
          ],
          [
            [6, 1, 2],
            [9, 2, 1],
          ],
          [
            [23, 3, 2],
            [14, 2, 3],
          ],
          [
            [0, 1, 2],
            [9, 4, 5],
          ],
          [
            [26, 3, 4],
            [21, 4, 3],
          ],
        ]
      : [
          [
            [12, 2, 3],
            [1, 2, 3],
          ],
          [
            [11, 4, 3],
            [13, 2, 3],
          ],
          [
            [15, 4, 3],
            [9, 4, 3],
          ],
          [
            [6, 4, 5],
            [3, 2, 3],
          ],
        ];
    placements.forEach((pair, color) => {
      const owner = players[colors.indexOf(color)] ?? null;
      if (!owner && !extended) return;
      pair.forEach(([h, c, d], second) => {
        const v = board.hexes[h].vertices[c];
        s.buildings[v] = { owner, color, city: false };
        if (owner) {
          s.roads[edgeId(board, v, board.hexes[h].vertices[d])] = owner;
          if (second) starting(s, owner, v);
        }
      });
    });
    s.phase = { type: 'turn', player: active(s), stage: 'production' };
  }
  return s;
}
function inventory(s: State, p: string) {
  return [
    15 - s.roads.filter((x) => x === p).length,
    5 - s.buildings.filter((b) => b?.owner === p && !b.city).length,
    4 - s.buildings.filter((b) => b?.owner === p && b.city).length,
  ];
}
function distance(s: State, v: number) {
  return (
    s.buildings[v] === null &&
    incident(s.board, v).every((e) =>
      s.board.edges[e].every((w) => w === v || !s.buildings[w]),
    )
  );
}
function roadLegal(s: State, p: string, e: number) {
  return (
    s.roads[e] === null &&
    s.board.edges[e].some((v) =>
      s.buildings[v]
        ? s.buildings[v]!.owner === p
        : incident(s.board, v).some((i) => s.roads[i] === p),
    )
  );
}
export function longestRoute(s: State, p: string): number {
  function trail(v: number, used: Set<number>): number {
    if (used.size && s.buildings[v] && s.buildings[v]!.owner !== p) return 0;
    let best = 0;
    for (const e of incident(s.board, v))
      if (s.roads[e] === p && !used.has(e)) {
        used.add(e);
        best = Math.max(
          best,
          1 +
            trail(
              s.board.edges[e].find((w) => w !== v)!,
              used,
            ),
        );
        used.delete(e);
      }
    return best;
  }
  return Math.max(...s.board.vertices.map((_, v) => trail(v, new Set())));
}
function points(s: State, p: string, privatePoints: boolean) {
  return (
    s.buildings.reduce(
      (n, b) => n + (b?.owner === p ? (b.city ? 2 : 1) : 0),
      0,
    ) +
    (s.longest === p ? 2 : 0) +
    (s.army === p ? 2 : 0) +
    (privatePoints
      ? s.development[s.players.indexOf(p)].filter(
          (c) => c.kind === 'VICTORY_POINT',
        ).length
      : 0)
  );
}
function awards(s: State) {
  function award(values: number[], incumbent: string | null, min: number) {
    const max = Math.max(...values);
    if (max < min) return null;
    if (incumbent && values[s.players.indexOf(incumbent)] === max)
      return incumbent;
    const best = s.players.filter((_, i) => values[i] === max);
    return best.length === 1 ? best[0] : null;
  }
  s.longest = award(
    s.players.map((p) => longestRoute(s, p)),
    s.longest,
    5,
  );
  s.army = award(
    s.played.map((cards) => cards.filter((c) => c === 'KNIGHT').length),
    s.army,
    3,
  );
}
function ratio(s: State, p: string, r: number) {
  return Math.min(
    4,
    ...s.board.ports
      .filter((port) =>
        s.board.edges[port.edge].some((v) => s.buildings[v]?.owner === p),
      )
      .map((port) =>
        port.resource === r ? 2 : port.resource === null ? 3 : 4,
      ),
  );
}
export function legalActions(s: State, p: string): Action[] {
  const i = s.players.indexOf(p);
  if (i < 0) return [];
  const a: Action[] = [],
    phase = s.phase,
    [roads, settlements, cities] = inventory(s, p);
  if (phase.player === p) {
    if (phase.type === 'setup') {
      if (phase.settlement != null) {
        for (const edge of incident(s.board, phase.settlement))
          if (!s.roads[edge]) a.push({ type: 'BUILD_ROAD', edge });
      } else
        s.buildings.forEach((_, vertex) => {
          if (distance(s, vertex)) a.push({ type: 'BUILD_SETTLEMENT', vertex });
        });
    }
    if (phase.type === 'robber')
      s.board.hexes.forEach((_, hex) => {
        if (hex !== s.robber) a.push({ type: 'MOVE_ROBBER', hex });
      });
    if (phase.type === 'victim')
      phase.targets!.forEach((victim) => a.push({ type: 'STEAL', victim }));
    if (phase.type === 'free_roads') {
      if (roads)
        s.roads.forEach((_, edge) => {
          if (roadLegal(s, p, edge)) a.push({ type: 'BUILD_ROAD', edge });
        });
      if (!a.length) a.push({ type: 'FINISH_ROADS' });
    }
    if (phase.type === 'turn') {
      if (phase.stage === 'production') a.push({ type: 'ROLL_DICE' });
      else {
        a.push({ type: 'END_TURN' });
        if (roads && enough(s.hands[i], costs.BUILD_ROAD))
          s.roads.forEach((_, edge) => {
            if (roadLegal(s, p, edge)) a.push({ type: 'BUILD_ROAD', edge });
          });
        if (settlements && enough(s.hands[i], costs.BUILD_SETTLEMENT))
          s.buildings.forEach((_, vertex) => {
            if (
              distance(s, vertex) &&
              incident(s.board, vertex).some((e) => s.roads[e] === p)
            )
              a.push({ type: 'BUILD_SETTLEMENT', vertex });
          });
        if (cities && enough(s.hands[i], costs.BUILD_CITY))
          s.buildings.forEach((b, vertex) => {
            if (b?.owner === p && !b.city)
              a.push({ type: 'BUILD_CITY', vertex });
          });
        if (s.deck.length && enough(s.hands[i], costs.BUY_DEVELOPMENT))
          a.push({ type: 'BUY_DEVELOPMENT' });
        for (let give = 0; give < 5; give++)
          for (let take = 0; take < 5; take++)
            if (
              give !== take &&
              s.hands[i][give] >= ratio(s, p, give) &&
              s.bank[take] > 0
            )
              a.push({ type: 'BANK_TRADE', give, take });
      }
      const eligible = (kind: Development) =>
        !s.playedThisTurn &&
        s.development[i].some(
          (c) => c.kind === kind && c.bought < s.opportunity,
        );
      if (eligible('KNIGHT')) a.push({ type: 'KNIGHT' });
      if (eligible('MONOPOLY'))
        resources.forEach((_, resource) =>
          a.push({ type: 'MONOPOLY', resource }),
        );
      if (
        eligible('ROAD_BUILDING') &&
        roads &&
        s.roads.some((_, e) => roadLegal(s, p, e))
      )
        a.push({ type: 'ROAD_BUILDING' });
      if (eligible('INVENTION'))
        for (let x = 0; x < 5; x++)
          for (let y = x; y < 5; y++) {
            const r = zero();
            r[x]++;
            r[y]++;
            if (enough(s.bank, r)) a.push({ type: 'INVENTION', resources: r });
          }
    }
  }
  if (phase.type === 'turn' && phase.stage === 'actions' && !s.paired)
    for (const o of s.offers) {
      if (o.from === p) a.push({ type: 'WITHDRAW' });
      else if (
        (!o.to || o.to === p) &&
        (o.from === active(s) || p === active(s))
      ) {
        a.push({ type: 'DECLINE', offer: o.id });
        if (enough(s.hands[i], o.take)) a.push({ type: 'ACCEPT', offer: o.id });
      }
      if (p === active(s) && o.from === p)
        for (const partner of o.accepted)
          a.push({ type: 'CONFIRM_TRADE', offer: o.id, partner });
    }
  return a;
}
function quantities(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 5 &&
    value.every((n) => Number.isInteger(n) && n >= 0 && n <= 24)
  );
}
function sameAction(a: Action, b: Action) {
  const ak = Object.keys(a).sort(),
    bk = Object.keys(b).sort();
  return (
    JSON.stringify(ak) === JSON.stringify(bk) &&
    ak.every(
      (k) =>
        JSON.stringify(a[k as keyof Action]) ===
        JSON.stringify(b[k as keyof Action]),
    )
  );
}
export function applyAction(
  state: State,
  p: string,
  input: unknown,
  random: () => number,
): State {
  assert(input && typeof input === 'object' && !Array.isArray(input));
  const action = input as Action,
    i = state.players.indexOf(p);
  assert(i >= 0);
  let intention = action;
  if (action.type === 'ROLL_DICE' && action.strength !== undefined) {
    assert(
      typeof action.strength === 'number' &&
        Number.isFinite(action.strength) &&
        action.strength >= 0 &&
        action.strength <= 1,
    );
    const { strength, ...rest } = action;
    intention = rest;
  }
  // Check every ordinary action against server-derived choices before consuming randomness.
  if (action.type !== 'OFFER' && action.type !== 'DISCARD')
    assert(legalActions(state, p).some((a) => sameAction(a, intention)));
  const s = structuredClone(state),
    phase = s.phase,
    a = action;
  const resume = (stage: 'production' | 'actions' = 'actions') => {
    s.phase = { type: 'turn', player: p, stage };
  };
  const play = (kind: Development) => {
    const at = s.development[i].findIndex(
      (c) => c.kind === kind && c.bought < s.opportunity,
    );
    s.development[i].splice(at, 1);
    s.played[i].push(kind);
    s.playedThisTurn = true;
  };
  switch (a.type) {
    case 'DISCARD': {
      assert(phase.type === 'discard' && phase.pending?.[p]);
      assert(
        quantities(a.resources) &&
          total(a.resources) === phase.pending[p] &&
          enough(s.hands[i], a.resources),
        'Choose exactly the required resources.',
      );
      pay(s, i, a.resources);
      delete phase.pending[p];
      if (!Object.keys(phase.pending).length)
        s.phase = { type: 'robber', player: active(s), resume: 'actions' };
      break;
    }
    case 'OFFER': {
      assert(phase.type === 'turn' && phase.stage === 'actions' && !s.paired);
      assert(
        quantities(a.give) &&
          quantities(a.take) &&
          total(a.give) > 0 &&
          total(a.take) > 0 &&
          a.give.every((n, r) => !n || !(a.take as number[])[r]) &&
          enough(s.hands[i], a.give),
        'Offer distinct resources you own.',
      );
      const to = a.to ?? null;
      assert(
        !to ||
          (s.players.includes(to) &&
            to !== p &&
            (p === active(s) || to === active(s))),
      );
      s.offers = s.offers.filter((o) => o.from !== p);
      s.offers.push({
        id: s.nextOffer++,
        from: p,
        to,
        give: [...a.give],
        take: [...a.take],
        opportunity: s.opportunity,
        accepted: [],
      });
      break;
    }
    case 'BUILD_SETTLEMENT': {
      const v = a.vertex!;
      s.buildings[v] = { owner: p, color: s.colors[i], city: false };
      if (phase.type === 'setup') {
        if (phase.step! >= s.players.length) starting(s, p, v);
        phase.settlement = v;
      } else pay(s, i, costs.BUILD_SETTLEMENT);
      break;
    }
    case 'BUILD_CITY':
      pay(s, i, costs.BUILD_CITY);
      s.buildings[a.vertex!]!.city = true;
      break;
    case 'BUILD_ROAD': {
      s.roads[a.edge!] = p;
      if (phase.type === 'setup') {
        const step = phase.step! + 1,
          n = s.players.length;
        if (step === 2 * n) resume('production');
        else
          s.phase = {
            type: 'setup',
            step,
            player:
              s.players[(s.first + (step < n ? step : 2 * n - 1 - step)) % n],
            settlement: null,
          };
      } else if (phase.type === 'free_roads') {
        if (phase.remaining! > 1) phase.remaining!--;
        else resume(phase.resume);
      } else pay(s, i, costs.BUILD_ROAD);
      break;
    }
    case 'FINISH_ROADS':
      resume(phase.resume);
      break;
    case 'ROLL_DICE': {
      s.dice = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)];
      if (total(s.dice) === 7) {
        const pending = Object.fromEntries(
          s.players.flatMap((id, j) =>
            total(s.hands[j]) > 7
              ? [[id, Math.floor(total(s.hands[j]) / 2)]]
              : [],
          ),
        );
        s.phase = Object.keys(pending).length
          ? { type: 'discard', pending }
          : { type: 'robber', player: p, resume: 'actions' };
      } else {
        produce(s, total(s.dice));
        resume();
      }
      break;
    }
    case 'END_TURN':
      if (s.players.length > 4 && !s.paired) s.paired = true;
      else {
        s.paired = false;
        s.primary = (s.primary + 1) % s.players.length;
      }
      s.opportunity++;
      s.playedThisTurn = false;
      s.offers = [];
      s.phase = {
        type: 'turn',
        player: active(s),
        stage: s.paired ? 'actions' : 'production',
      };
      break;
    case 'BUY_DEVELOPMENT':
      pay(s, i, costs.BUY_DEVELOPMENT);
      s.development[i].push({ kind: s.deck.pop()!, bought: s.opportunity });
      break;
    case 'MOVE_ROBBER': {
      s.robber = a.hex!;
      const targets = [
        ...new Set(
          s.board.hexes[s.robber].vertices.flatMap((v) =>
            s.buildings[v]?.owner && s.buildings[v]!.owner !== p
              ? [s.buildings[v]!.owner!]
              : [],
          ),
        ),
      ];
      if (targets.length)
        s.phase = { type: 'victim', player: p, resume: phase.resume, targets };
      else resume(phase.resume);
      break;
    }
    case 'STEAL': {
      const j = s.players.indexOf(a.victim!),
        count = total(s.hands[j]);
      if (count) {
        let pick = Math.floor(random() * count);
        for (let r = 0; r < 5; r++) {
          if (pick < s.hands[j][r]) {
            s.hands[j][r]--;
            s.hands[i][r]++;
            break;
          }
          pick -= s.hands[j][r];
        }
      }
      resume(phase.resume);
      break;
    }
    case 'KNIGHT':
      play('KNIGHT');
      s.phase = { type: 'robber', player: p, resume: phase.stage };
      break;
    case 'MONOPOLY':
      play('MONOPOLY');
      s.hands.forEach((hand, j) => {
        if (j !== i) {
          s.hands[i][a.resource!] += hand[a.resource!];
          hand[a.resource!] = 0;
        }
      });
      break;
    case 'INVENTION':
      play('INVENTION');
      a.resources!.forEach((n, r) => {
        s.bank[r] -= n;
        s.hands[i][r] += n;
      });
      break;
    case 'ROAD_BUILDING':
      play('ROAD_BUILDING');
      s.phase = {
        type: 'free_roads',
        player: p,
        resume: phase.stage,
        remaining: 2,
      };
      break;
    case 'BANK_TRADE': {
      const give = a.give as number,
        take = a.take as number,
        n = ratio(s, p, give);
      s.hands[i][give] -= n;
      s.bank[give] += n;
      s.hands[i][take]++;
      s.bank[take]--;
      break;
    }
    case 'WITHDRAW':
      s.offers = s.offers.filter((o) => o.from !== p);
      break;
    case 'DECLINE': {
      const o = s.offers.find((o) => o.id === a.offer)!;
      o.accepted = o.accepted.filter((id) => id !== p);
      if (o.to === p) s.offers = s.offers.filter((x) => x !== o);
      break;
    }
    case 'ACCEPT':
    case 'CONFIRM_TRADE': {
      const o = s.offers.find((o) => o.id === a.offer)!;
      if (a.type === 'ACCEPT' && p !== active(s)) {
        if (!o.accepted.includes(p)) o.accepted.push(p);
        break;
      }
      const partner = a.type === 'ACCEPT' ? p : a.partner!,
        x = s.players.indexOf(o.from),
        y = s.players.indexOf(partner);
      assert(
        o.opportunity === s.opportunity &&
          x !== y &&
          (!o.to || o.to === partner) &&
          (o.from === active(s) || partner === active(s)) &&
          enough(s.hands[x], o.give) &&
          enough(s.hands[y], o.take),
      );
      for (let r = 0; r < 5; r++) {
        s.hands[x][r] += o.take[r] - o.give[r];
        s.hands[y][r] += o.give[r] - o.take[r];
      }
      break;
    }
  }
  if (JSON.stringify(state.hands) !== JSON.stringify(s.hands)) s.offers = [];
  awards(s);
  if (
    s.phase.type !== 'setup' &&
    s.phase.type !== 'finished' &&
    points(s, active(s), true) >= 10
  ) {
    s.phase = { type: 'finished', winner: active(s) };
    s.offers = [];
  }
  s.revision++;
  s.presentation = present(state, s, p, action);
  return s;
}
export function produce(s: State, roll: number) {
  const requests = s.players.map(zero);
  s.board.hexes.forEach((h, hex) => {
    if (hex === s.robber || h.number !== roll || h.resource === null) return;
    for (const v of h.vertices) {
      const b = s.buildings[v];
      if (b?.owner)
        requests[s.players.indexOf(b.owner)][h.resource] += b.city ? 2 : 1;
    }
  });
  for (let r = 0; r < 5; r++) {
    if (requests.reduce((n, h) => n + h[r], 0) > s.bank[r]) {
      const sole = requests.filter((h) => h[r] > 0).length === 1;
      for (const h of requests) h[r] = sole && h[r] > 0 ? s.bank[r] : 0;
    }
    requests.forEach((h, i) => {
      s.hands[i][r] += h[r];
      s.bank[r] -= h[r];
    });
  }
}
export function playerView(s: State, p: string) {
  const i = s.players.indexOf(p);
  assert(i >= 0);
  return structuredClone({
    public: {
      revision: s.revision,
      events: s.presentation.public,
      board: s.board,
      buildings: s.buildings,
      roads: s.roads,
      robber: s.robber,
      bank: s.bank,
      phase: s.phase,
      dice: s.dice,
      primary: s.players[s.primary],
      secondary:
        s.players.length > 4
          ? s.players[(s.primary + 3) % s.players.length]
          : null,
      paired: s.paired,
      opportunity: s.opportunity,
      longest: s.longest,
      army: s.army,
      offers: s.offers,
      players: s.players.map((id, j) => ({
        id,
        color: s.colors[j],
        resources: total(s.hands[j]),
        development: s.development[j].length,
        points: points(s, id, s.phase.winner === id),
        knights: s.played[j].filter((c) => c === 'KNIGHT').length,
        played: s.played[j],
        inventory: inventory(s, id),
      })),
    },
    private: {
      events: s.presentation.recipients[p] ?? [],
      hand: s.hands[i],
      development: s.development[i],
      points: points(s, p, true),
      legalActions: legalActions(s, p),
      discardRequired: s.phase.pending?.[p] ?? 0,
    },
  });
}
export const catan: GameDefinition<State> = {
  id: 'catan',
  minPlayers: 3,
  maxPlayers: 6,
  create: (players, random, options?: unknown) => {
    assert(
      options === undefined ||
        (typeof options === 'object' &&
          options !== null &&
          ['variable', 'beginner'].includes(
            (options as { setup: string }).setup,
          )),
      'Invalid CATAN setup.',
    );
    return createGame(
      players,
      random,
      (options as { setup?: 'variable' | 'beginner' } | undefined)?.setup,
    );
  },
  apply: applyAction,
  view: playerView,
  isFinished: (s) => s.phase.type === 'finished',
};
