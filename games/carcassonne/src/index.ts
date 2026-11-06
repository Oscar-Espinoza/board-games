import { shuffled as shuffle } from '@board-games/game-core';
import type { ActionContext, GameDefinition } from '@board-games/game-core';
import { seats } from '@board-games/shared/games';
import {
  tiles,
  modules,
  presets,
  inventory,
  type Module,
  type Kind,
} from './tiles.js';
import {
  graph,
  points,
  adjacent,
  directions,
  goldTiles,
  placements,
  legalPlacement,
  key,
  node,
  split,
  regionAt,
  figureTypes,
  supply,
  type Landscape,
  type Figure,
  type Feature,
} from './features.js';
export type OptionKind =
  | 'deploy'
  | 'retrieve'
  | 'fly'
  | 'skip'
  | 'robber'
  | 'gold'
  | 'mage'
  | 'witch'
  | 'ferry'
  | 'score'
  | 'keep'
  | 'return'
  | 'marker'
  | 'reward'
  | 'two'
  | 'message'
  | 'add'
  | 'remove';
/** What a pending decision asks for; its options use `OptionKind`s. */
export type PromptKind =
  | 'robber'
  | 'gold'
  | 'magic'
  | 'deploy'
  | 'landing'
  | 'ferry'
  | 'score'
  | 'pig'
  | 'marker'
  | 'rewardMarker'
  | 'reward'
  | 'message'
  | 'cropMode'
  | 'crop';
export type EventKind =
  | 'place'
  | 'draw'
  | 'discard'
  | 'meeple'
  | 'return'
  | 'score'
  | 'final'
  | 'robber'
  | 'goods'
  | 'pig'
  | 'gold'
  | 'magic'
  | 'flight'
  | 'ferry'
  | 'win'
  | 'extra'
  | 'message';
/** Where the resolution of a turn stands; `advance` walks them in this order. */
export type Stage =
  | 'setup'
  | 'robbers'
  | 'place'
  | 'effects'
  | 'magic'
  | 'deploy'
  | 'ferries'
  | 'score'
  | 'pigs'
  | 'markers'
  | 'rewards'
  | 'messageRewards'
  | 'message'
  | 'crop'
  | 'cropPlayers'
  | 'end'
  | 'finished';
/** What a seat may send; the host's setup is `config`, everything else follows the prompt. */
export type Action =
  | {
      type: 'config';
      version: number;
      config: { farmers: boolean; modules: Module[]; first: number };
    }
  | { type: 'ready'; version: number }
  | { type: 'place'; turn: number; x: number; y: number; rotation: number }
  | { type: 'choose'; prompt: number; choice: string };
export type Option = {
  id: string;
  kind: OptionKind;
  target?: string;
  figure?: Figure['type'];
  attachment?: Figure['attachment'];
  value?: string | number;
  points?: number;
};
type Pending = {
  id: number;
  kind: PromptKind;
  actor: string;
  options: Option[];
};
export type Event = {
  id: number;
  turn: number;
  kind: EventKind;
  player?: string;
  target?: string;
  points?: number;
  feature?: Kind;
  tiles?: string[];
  detail?: string;
};
export type State = Landscape & {
  players: string[];
  connectedPlayers: string[];
  config: { farmers: boolean; modules: Module[]; first: number };
  setupVersion: number;
  ready: string[];
  phase: 'setup' | 'place' | 'decision' | 'finished';
  stage: Stage;
  turn: number;
  active: number;
  deck: string[];
  current: string | null;
  discarded: number;
  last: string | null;
  pending: Pending | null;
  serial: number;
  figureSerial: number;
  events: Event[];
  eventSerial: number;
  scores: Record<string, [number, number]>;
  goods: Record<string, number[]>;
  gold: Record<string, number>;
  goldMap: Record<string, number>;
  robbers: Record<string, number | null>;
  messages: number[];
  message: number | null;
  markers: Record<string, number>;
  turnPoints: Record<string, number>;
  robberRewards: Record<string, { player: string; points: number }[]>;
  queue: string[];
  ferryQueue: string[];
  pigQueue: number[];
  scoredCities: string[];
  extra: number;
  builderTriggered: boolean;
  flight: { roll: number; tile: string; figure: Figure['type'] } | null;
  cropMode: '' | 'add' | 'remove';
  winners: string[];
};
const clone = <T>(v: T): T => structuredClone(v);
/** Every rejection carries the message key the table translates. */
function fail(): never {
  throw new Error('carc_error');
}
const actor = (s: State) => s.players[s.active];
const ordered = (s: State, first = s.active) =>
  s.players.map((_, i) => s.players[(first + i) % s.players.length]);
function event(
  s: State,
  kind: EventKind,
  data: Omit<Partial<Event>, 'id' | 'turn' | 'kind'> = {},
) {
  s.events.push({ id: ++s.eventSerial, turn: s.turn, kind, ...data });
}
function prompt(
  s: State,
  kind: PromptKind,
  who: string,
  options: Omit<Option, 'id'>[],
) {
  if (!options.length) return false;
  s.phase = 'decision';
  s.pending = {
    id: ++s.serial,
    kind,
    actor: who,
    options: options.map((o, i) => ({ ...o, id: String(i) })),
  };
  return true;
}
/** Which of the two scoring markers (0, or 1 with the courier) takes these points. */
function markerPrompt(
  s: State,
  kind: 'marker' | 'rewardMarker',
  who: string,
  points: number | undefined,
) {
  return prompt(
    s,
    kind,
    who,
    [0, 1].map((value) => ({ kind: 'marker', value, points })),
  );
}
function attached(s: State, who: string, kind: Figure['attachment']) {
  return (
    s.figures.some((f) => f.owner === who && f.attachment === kind) ||
    (kind === 'builder' && who === actor(s) && s.builderTriggered)
  );
}
function types(
  s: State,
  kind: Kind,
  who: string,
  fly = false,
): Figure['type'][] {
  return figureTypes(s.config.modules, fly).filter(
    (t) =>
      supply(s, who, t) > 0 &&
      (kind === 'garden'
        ? t === 'abbot'
        : t === 'abbot'
          ? kind === 'monastery'
          : kind !== 'river') &&
      (kind !== 'field' || s.config.farmers),
  );
}
function deployments(
  s: State,
  tile: string,
  who: string,
  occupied = false,
  fly = false,
) {
  const gs = graph(s);
  const out: Omit<Option, 'id'>[] = [];
  for (const r of tiles[s.board[tile].id].regions) {
    if (
      r.kind === 'river' ||
      (fly && !['road', 'city', 'monastery'].includes(r.kind))
    )
      continue;
    const f = gs.find((f) => f.nodes.includes(node(tile, r.id)))!;
    if ((!occupied && f.figures.length) || (fly && f.complete)) continue;
    for (const type of types(s, r.kind, who, fly)) {
      out.push({ kind: 'deploy', target: node(tile, r.id), figure: type });
      if (s.config.modules.includes('traders')) {
        const attachment =
          r.kind === 'field'
            ? 'pig'
            : ['city', 'road'].includes(r.kind)
              ? 'builder'
              : undefined;
        if (attachment && !attached(s, who, attachment))
          out.push({
            kind: 'deploy',
            target: node(tile, r.id),
            figure: type,
            attachment,
          });
      }
    }
  }
  return out;
}
function put(s: State, o: Option, who: string) {
  const { tile, region } = split(o.target!);
  s.figures.push({
    id: ++s.figureSerial,
    owner: who,
    tile,
    region,
    type: o.figure!,
    attachment: o.attachment,
  });
  event(s, 'meeple', {
    player: who,
    target: o.target,
    detail: o.attachment ?? o.figure,
  });
}
function remove(s: State, id: number) {
  const f = s.figures.find((f) => f.id === id);
  if (f)
    event(s, 'return', { player: f.owner, target: node(f.tile, f.region) });
  s.figures = s.figures.filter((f) => f.id !== id);
}
function award(
  s: State,
  who: string,
  n: number,
  f?: Feature,
  reason: EventKind = 'score',
) {
  if (n <= 0) return;
  s.turnPoints[who] = (s.turnPoints[who] ?? 0) + n;
  event(s, reason, {
    player: who,
    points: n,
    target: f?.id,
    feature: f?.kind,
    tiles: f?.tiles,
    detail: f
      ? `${f.tiles.length}:${f.shields}:${f.cities.length}:${f.inn ? 'inn' : f.cathedral ? 'cathedral' : ''}:${f.mage ? 'mage' : f.witch ? 'witch' : ''}`
      : undefined,
  });
}
function completed(s: State) {
  return graph(s).filter(
    (f) =>
      f.complete &&
      (f.figures.length ||
        f.mage ||
        f.witch ||
        (f.kind === 'city' && !s.scoredCities.includes(f.id))),
  );
}
function scoreFeature(s: State, f: Feature) {
  for (const who of f.leaders) award(s, who, points(f), f);
  if (f.kind === 'city' && !s.scoredCities.includes(f.id)) {
    s.scoredCities.push(f.id);
    if (s.config.modules.includes('traders')) {
      f.goods.forEach((n, i) => (s.goods[actor(s)][i] += n));
      if (f.goods.some(Boolean))
        event(s, 'goods', { player: actor(s), target: f.id });
      if (f.shields > 0) {
        for (const who of ordered(s))
          for (const pig of s.figures.filter(
            (p) => p.owner === who && p.attachment === 'pig',
          ))
            if (!s.pigQueue.includes(pig.id)) s.pigQueue.push(pig.id);
      }
    }
  }
  const eligible = ordered(s).filter((p) => f.leaders.includes(p));
  let i = 0;
  for (const k of goldTiles(s, f))
    while (eligible.length && s.goldMap[k] > 0) {
      const who = eligible[i++ % eligible.length];
      s.gold[who]++;
      s.goldMap[k]--;
      event(s, 'gold', { player: who, target: k });
    }
  for (const piece of f.figures) remove(s, piece.id);
  if (f.mage) s.magic.mage = null;
  if (f.witch) s.magic.witch = null;
}
function moveScore(
  s: State,
  who: string,
  n: number,
  robbery = false,
  total = n,
) {
  if (!n) return;
  const marker = s.markers[who] ?? 0;
  const old = s.scores[who][marker] % 50;
  s.scores[who][marker] += n;
  for (const owner of s.players) {
    if (owner === who || s.robbers[owner] !== old) continue;
    if (robbery) s.robbers[owner] = s.scores[who][marker] % 50;
    else {
      (s.robberRewards[owner] ??= []).push({
        player: who,
        points: Math.ceil(total / 2),
      });
    }
  }
}
function draw(s: State) {
  s.turn++;
  s.markers = {};
  s.turnPoints = {};
  s.robberRewards = {};
  s.flight = null;
  s.builderTriggered = false;
  s.pigQueue = [];
  s.ferryQueue = [];
  s.message = null;
  while (s.deck.length) {
    const id = s.deck.shift()!;
    if (placements(s.board, id).length) {
      s.current = id;
      s.queue =
        s.config.modules.includes('robbers') && tiles[id].robber
          ? ordered(s).filter((p) => p === actor(s) || s.robbers[p] === null)
          : [];
      s.stage = 'robbers';
      event(s, 'draw', { player: actor(s), detail: id });
      return;
    }
    s.discarded++;
    event(s, 'discard', { detail: id });
  }
  finish(s);
}
function finish(s: State) {
  s.turnPoints = {};
  for (const who of s.players) {
    s.scores[who][0] += s.scores[who][1];
    s.scores[who][1] = 0;
    s.markers[who] = 0;
    if (s.robbers[who] !== null) award(s, who, 3, undefined, 'robber');
    s.robbers[who] = null;
  }
  for (const f of graph(s))
    if (f.figures.length)
      for (const who of f.leaders) award(s, who, points(f, true), f, 'final');
  if (s.config.modules.includes('traders'))
    for (let i = 0; i < 3; i++) {
      const max = Math.max(...s.players.map((p) => s.goods[p][i]));
      if (max > 0)
        for (const p of s.players)
          if (s.goods[p][i] === max) award(s, p, 10, undefined, 'goods');
    }
  for (const p of s.players) {
    const n = s.gold[p];
    award(
      s,
      p,
      n * (n < 4 ? 1 : n < 7 ? 2 : n < 10 ? 3 : 4),
      undefined,
      'gold',
    );
    s.scores[p][0] += s.turnPoints[p] ?? 0;
  }
  s.turnPoints = {};
  s.goldMap = {};
  s.phase = 'finished';
  s.stage = 'finished';
  s.current = null;
  s.pending = null;
  const high = Math.max(...s.players.map((p) => s.scores[p][0]));
  s.winners = s.players.filter((p) => s.scores[p][0] === high);
  event(s, 'win', { player: s.winners[0] });
}
function magicChoices(s: State) {
  const fs = graph(s).filter(
    (f) => ['city', 'road'].includes(f.kind) && !f.complete,
  );
  const out: Omit<Option, 'id'>[] = [];
  for (const kind of ['mage', 'witch'] as const) {
    const old = s.magic[kind],
      other = s.magic[kind === 'mage' ? 'witch' : 'mage'];
    for (const f of fs)
      if (!f.nodes.includes(old ?? '') && !f.nodes.includes(other ?? ''))
        out.push({ kind, target: f.id });
  }
  if (!out.length)
    for (const kind of ['mage', 'witch'] as const)
      if (s.magic[kind]) out.push({ kind });
  return out;
}
/** Walk each new road until its first ferry; never cross that ferry to reach a later one. */
function firstFerries(s: State) {
  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = tiles[s.board[s.last!].id].regions
    .filter((r) => r.kind === 'road')
    .map((r) => node(s.last!, r.id));
  while (queue.length) {
    const ref = queue.shift()!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const { tile, region } = split(ref);
    const p = s.board[tile],
      r = tiles[p.id].regions.find((r) => r.id === region)!;
    if (tiles[p.id].ferry && tile !== s.last) {
      if (p.ferry?.includes(region)) found.add(tile);
      continue;
    }
    for (const port of r.ports) {
      const side = (port + p.rotation) % 4;
      const [dx, dy] = directions[side];
      const k = key(p.x + dx, p.y + dy);
      const next = s.board[k];
      if (!next) continue;
      const local = (side + 2 - next.rotation + 4) % 4;
      const rr = tiles[next.id].regions.find(
        (v) => v.kind === 'road' && v.ports.includes(local),
      );
      if (rr) queue.push(node(k, rr.id));
    }
  }
  return [...found];
}
function messageOptions(s: State) {
  const number = s.message!;
  const who = actor(s);
  const fs = graph(s).filter((f) => f.figures.some((p) => p.owner === who));
  const options: Omit<Option, 'id'>[] = [{ kind: 'two', points: 2 }];
  if (number <= 3) {
    const kind = ['city', 'road', 'monastery'][number - 1];
    const eligible = fs.filter(
      (f) => f.kind === kind || (number === 3 && f.kind === 'garden'),
    );
    const min = Math.min(...eligible.map((f) => points(f, true)));
    for (const f of eligible.filter((f) => points(f, true) === min))
      options.push({ kind: 'message', target: f.id, points: min });
    if (!eligible.length) options.push({ kind: 'message', points: 0 });
  } else if (number === 4) options.push({ kind: 'message' });
  else if (number === 5)
    options.push({
      kind: 'message',
      points: fs
        .filter((f) => f.kind === 'city')
        .reduce((n, f) => n + f.shields * 2, 0),
    });
  else if (number === 6 || number === 7)
    options.push({
      kind: 'message',
      points:
        s.figures.filter(
          (f) =>
            f.owner === who &&
            regionAt(s, node(f.tile, f.region)).kind ===
              (number === 6 ? 'city' : 'field'),
        ).length * 2,
    });
  else
    for (const f of fs)
      for (const piece of f.figures.filter((p) => p.owner === who))
        options.push({
          kind: 'message',
          target: String(piece.id),
          points: f.leaders.includes(who) ? points(f, true) : 0,
        });
  return options;
}
function advance(s: State) {
  for (let guard = 0; guard < 1000 && s.phase !== 'finished'; guard++) {
    const who = actor(s);
    if (s.stage === 'robbers') {
      const p = s.queue.shift();
      if (p) {
        const spaces = [
          ...new Set(
            s.players
              .filter((v) => v !== p)
              .flatMap((v) =>
                s.scores[v]
                  .slice(0, s.config.modules.includes('messages') ? 2 : 1)
                  .map((n) => n % 50),
              ),
          ),
        ];
        const options: Omit<Option, 'id'>[] = spaces.map((n) => ({
          kind: 'robber',
          value: n,
        }));
        if (s.robbers[p] !== null) options.unshift({ kind: 'skip' });
        if (prompt(s, 'robber', p, options)) return;
      } else {
        s.stage = 'place';
        s.phase = 'place';
        s.pending = null;
        return;
      }
    } else if (s.stage === 'effects') {
      s.stage = 'magic';
      if (tiles[s.current!].gold) {
        s.goldMap[s.last!] = (s.goldMap[s.last!] ?? 0) + 1;
        const p = s.board[s.last!];
        if (
          prompt(
            s,
            'gold',
            who,
            Object.keys(s.board)
              .filter((k) => k !== s.last && adjacent(s.board[k], p))
              .map((k) => ({ kind: 'gold', target: k })),
          )
        )
          return;
      }
    } else if (s.stage === 'magic') {
      s.stage = 'deploy';
      const fs = graph(s);
      if (tiles[s.current!].magic || fs.some((f) => f.mage && f.witch)) {
        if (prompt(s, 'magic', who, magicChoices(s))) return;
      }
    } else if (s.stage === 'deploy') {
      s.stage = 'ferries';
      const options = deployments(s, s.last!, who);
      options.push({ kind: 'skip' });
      if (s.config.modules.includes('abbot'))
        for (const f of s.figures.filter(
          (f) => f.owner === who && f.type === 'abbot',
        )) {
          const feature = graph(s).find((v) =>
            v.nodes.includes(node(f.tile, f.region)),
          )!;
          options.push({
            kind: 'retrieve',
            target: String(f.id),
            points: points(feature, true),
          });
        }
      if (tiles[s.current!].flight)
        for (const type of types(s, 'road', who, true))
          options.push({ kind: 'fly', figure: type });
      prompt(s, 'deploy', who, options);
      return;
    } else if (s.stage === 'ferries') {
      if (!s.ferryQueue.length) {
        s.stage = 'score';
        continue;
      }
      const k = s.ferryQueue.shift()!;
      const p = s.board[k];
      const roads = tiles[p.id].regions.filter((r) => r.kind === 'road');
      const options: Omit<Option, 'id'>[] = [];
      if (p.ferry) options.push({ kind: 'skip' });
      for (let i = 0; i < roads.length; i++)
        for (let j = i + 1; j < roads.length; j++)
          options.push({
            kind: 'ferry',
            target: k,
            value: `${roads[i].id}:${roads[j].id}`,
          });
      if (prompt(s, 'ferry', who, options)) return;
    } else if (s.stage === 'score') {
      const fs = completed(s);
      if (!fs.length) {
        s.stage = 'pigs';
        continue;
      }
      if (
        fs.length > 1 &&
        fs.some((f) => goldTiles(s, f).some((k) => s.goldMap[k] > 0))
      ) {
        prompt(
          s,
          'score',
          who,
          fs.map((f) => ({ kind: 'score', target: f.id, points: points(f) })),
        );
        return;
      }
      scoreFeature(s, fs[0]);
    } else if (s.stage === 'pigs') {
      const id = s.pigQueue.shift();
      if (id !== undefined) {
        const pig = s.figures.find(
          (f) => f.id === id && f.attachment === 'pig',
        );
        if (!pig) continue;
        const f = graph(s).find((f) =>
          f.nodes.includes(node(pig.tile, pig.region)),
        )!;
        award(s, pig.owner, 3 * f.cities.length, f, 'pig');
        delete pig.attachment;
        prompt(s, 'pig', pig.owner, [
          { kind: 'keep', target: String(id) },
          { kind: 'return', target: String(id) },
        ]);
        return;
      }
      s.queue = ordered(s).filter((p) => (s.turnPoints[p] ?? 0) > 0);
      s.stage = 'markers';
    } else if (s.stage === 'markers') {
      const p = s.queue.shift();
      if (p) {
        if (
          s.config.modules.includes('messages') &&
          s.markers[p] === undefined
        ) {
          markerPrompt(s, 'marker', p, s.turnPoints[p]);
          return;
        }
        moveScore(s, p, s.turnPoints[p]);
      } else {
        s.queue = ordered(s).filter((p) => s.robberRewards[p]?.length);
        s.stage = 'rewards';
      }
    } else if (s.stage === 'rewards' || s.stage === 'messageRewards') {
      const p = s.queue.shift();
      if (p) {
        const options = s.robberRewards[p].map((v) => ({
          kind: 'reward' as const,
          target: v.player,
          points: v.points,
        }));
        prompt(s, 'reward', p, options);
        return;
      }
      s.stage = s.stage === 'messageRewards' ? 'crop' : 'message';
    } else if (s.stage === 'message') {
      s.stage = 'crop';
      if (
        s.config.modules.includes('messages') &&
        (s.turnPoints[who] ?? 0) > 0 &&
        s.scores[who][s.markers[who] ?? 0] % 5 === 0
      ) {
        s.robberRewards = {};
        s.message = s.messages.shift()!;
        s.messages.push(s.message);
        event(s, 'message', { player: who, detail: String(s.message) });
        prompt(s, 'message', who, messageOptions(s));
        return;
      }
    } else if (s.stage === 'crop') {
      s.stage = 'cropPlayers';
      if (tiles[s.current!].crop) {
        prompt(s, 'cropMode', who, [{ kind: 'add' }, { kind: 'remove' }]);
        return;
      }
      s.stage = 'end';
    } else if (s.stage === 'cropPlayers') {
      const p = s.queue.shift();
      if (p) {
        const kind = tiles[s.current!].crop;
        const figures = s.figures.filter(
          (f) =>
            f.owner === p && regionAt(s, node(f.tile, f.region)).kind === kind,
        );
        const options: Omit<Option, 'id'>[] = [];
        if (s.cropMode === 'remove')
          for (const f of figures)
            options.push({ kind: 'return', target: String(f.id) });
        else {
          const fs = graph(s).filter(
            (f) => f.kind === kind && f.figures.some((v) => v.owner === p),
          );
          for (const f of fs)
            for (const ref of f.nodes)
              for (const type of types(s, f.kind, p))
                options.push({ kind: 'deploy', target: ref, figure: type });
        }
        if (prompt(s, 'crop', p, options)) return;
      } else s.stage = 'end';
    } else if (s.stage === 'end') {
      if (s.extra > 0) {
        s.extra--;
        event(s, 'extra', { player: who });
      } else s.active = (s.active + 1) % s.players.length;
      draw(s);
    } else return;
  }
  if (s.phase !== 'finished')
    throw new Error('Carcassonne resolution overflow');
}
export function createGame(players: string[]): State {
  if (
    players.length < carcassonne.minPlayers ||
    players.length > carcassonne.maxPlayers ||
    new Set(players).size !== players.length
  )
    fail();
  const record = <T>(v: () => T) =>
    Object.fromEntries(players.map((p) => [p, v()]));
  return {
    players: [...players],
    connectedPlayers: [...players],
    config: { ...clone(presets.classic), first: 0 },
    setupVersion: 0,
    ready: [],
    phase: 'setup',
    stage: 'setup',
    board: {},
    figures: [],
    magic: { mage: null, witch: null },
    turn: 0,
    active: 0,
    deck: [],
    current: null,
    discarded: 0,
    last: null,
    pending: null,
    serial: 0,
    figureSerial: 0,
    events: [],
    eventSerial: 0,
    scores: record(() => [0, 0] as [number, number]),
    goods: record(() => [0, 0, 0]),
    gold: record(() => 0),
    goldMap: {},
    robbers: record(() => null),
    messages: [],
    message: null,
    markers: {},
    turnPoints: {},
    robberRewards: {},
    queue: [],
    ferryQueue: [],
    pigQueue: [],
    scoredCities: [],
    extra: 0,
    builderTriggered: false,
    flight: null,
    cropMode: '',
    winners: [],
  };
}
function start(s: State, random: () => number) {
  let deck = inventory(s.config.modules);
  const river = s.config.modules.includes('river');
  const initial = river ? 'F1' : 'D';
  deck.splice(deck.indexOf(initial), 1);
  s.board = { '0,0': { id: initial, x: 0, y: 0, rotation: 0, turn: 0 } };
  if (river) {
    const middle = deck.filter(
      (id) => tiles[id].edges.includes('V') && id !== 'F12',
    );
    s.deck = [
      ...shuffle(middle, random),
      'F12',
      ...shuffle(
        deck.filter((id) => !tiles[id].edges.includes('V')),
        random,
      ),
    ];
  } else s.deck = shuffle(deck, random);
  s.messages = shuffle([1, 2, 3, 4, 5, 6, 7, 8], random);
  s.active = s.config.first;
  draw(s);
  advance(s);
}
export function applyAction(
  original: State,
  player: string,
  input: unknown,
  random: () => number,
  context?: ActionContext,
): State {
  if (
    !original.players.includes(player) ||
    !input ||
    typeof input !== 'object' ||
    original.phase === 'finished'
  )
    fail();
  const a = input as Record<string, unknown>;
  const s = clone(original);
  if (s.phase === 'setup') {
    if (a.version !== s.setupVersion) fail();
    if (a.type === 'config') {
      if (player !== (context?.hostId ?? s.players[0])) fail();
      const cfg = a.config as State['config'];
      if (
        !cfg ||
        typeof cfg.farmers !== 'boolean' ||
        !Array.isArray(cfg.modules) ||
        cfg.modules.some((m) => !modules.includes(m)) ||
        new Set(cfg.modules).size !== cfg.modules.length ||
        !Number.isInteger(cfg.first) ||
        cfg.first < 0 ||
        cfg.first >= s.players.length
      )
        fail();
      s.config = {
        farmers: cfg.farmers,
        first: cfg.first,
        modules: [...cfg.modules],
      };
      s.setupVersion++;
      s.ready = [];
      return s;
    }
    if (a.type !== 'ready' || s.connectedPlayers.length !== s.players.length)
      fail();
    if (!s.ready.includes(player)) s.ready.push(player);
    if (s.ready.length === s.players.length) start(s, random);
    return s;
  }
  if (a.type === 'place') {
    if (
      s.phase !== 'place' ||
      player !== actor(s) ||
      a.turn !== s.turn ||
      !legalPlacement(
        s.board,
        s.current!,
        a.x as number,
        a.y as number,
        a.rotation as number,
      )
    )
      fail();
    const x = a.x as number,
      y = a.y as number,
      rotation = a.rotation as number;
    s.last = key(x, y);
    s.board[s.last] = { id: s.current!, x, y, rotation, turn: s.turn };
    event(s, 'place', { player, target: s.last, detail: s.current! });
    for (const f of graph(s).filter((f) => f.tiles.includes(s.last!)))
      for (const figure of f.figures)
        if (figure.owner === player && figure.attachment === 'builder') {
          delete figure.attachment;
          if (!s.builderTriggered) {
            s.extra++;
            s.builderTriggered = true;
          }
        }
    s.ferryQueue = [
      ...(tiles[s.current!].ferry ? [s.last] : []),
      ...firstFerries(s),
    ];
    s.phase = 'decision';
    s.stage = 'effects';
    advance(s);
    return s;
  }
  if (
    a.type !== 'choose' ||
    s.phase !== 'decision' ||
    !s.pending ||
    s.pending.actor !== player ||
    a.prompt !== s.pending.id
  )
    fail();
  const pending = s.pending!;
  const o = pending.options.find((o) => o.id === a.choice);
  if (!o) fail();
  s.pending = null;
  switch (pending.kind) {
    case 'robber':
      if (o.kind !== 'skip') s.robbers[player] = o.value as number;
      break;
    case 'gold':
      s.goldMap[o.target!] = (s.goldMap[o.target!] ?? 0) + 1;
      event(s, 'gold', { player, target: o.target });
      break;
    case 'magic':
      s.magic[o.kind as 'mage' | 'witch'] = o.target ?? null;
      event(s, 'magic', { player, target: o.target, detail: o.kind });
      break;
    case 'deploy':
      if (o.kind === 'deploy') put(s, o, player);
      else if (o.kind === 'retrieve') {
        const f = s.figures.find((f) => f.id === Number(o.target))!;
        const feature = graph(s).find((v) =>
          v.nodes.includes(node(f.tile, f.region)),
        )!;
        if (feature.complete) scoreFeature(s, feature);
        else {
          award(s, player, o.points!, feature, 'return');
          remove(s, f.id);
        }
      } else if (o.kind === 'fly') {
        const roll = 1 + Math.floor(random() * 3);
        let [dx, dy] = tiles[s.current!].flight!;
        for (let i = 0; i < s.board[s.last!].rotation; i++)
          [dx, dy] = [-dy, dx];
        const p = s.board[s.last!],
          target = key(p.x + dx * roll, p.y + dy * roll);
        s.flight = { roll, tile: target, figure: o.figure! };
        event(s, 'flight', { player, target, detail: String(roll) });
        const options = s.board[target]
          ? deployments(s, target, player, true, true).filter(
              (v) => v.figure === o.figure,
            )
          : [];
        if (prompt(s, 'landing', player, options)) return s;
      }
      break;
    case 'landing':
      put(s, o, player);
      break;
    case 'ferry':
      if (o.kind === 'ferry') {
        s.board[o.target!].ferry = (o.value as string).split(':') as [
          string,
          string,
        ];
        event(s, 'ferry', { player, target: o.target });
      }
      break;
    case 'score':
      scoreFeature(
        s,
        completed(s).find((f) => f.id === o.target)!,
      );
      break;
    case 'pig':
      if (o.kind === 'return') remove(s, Number(o.target));
      break;
    case 'marker':
      s.markers[player] = o.value as number;
      moveScore(s, player, s.turnPoints[player]);
      break;
    case 'reward':
      s.robbers[player] = null;
      if (
        s.config.modules.includes('messages') &&
        s.markers[player] === undefined
      ) {
        markerPrompt(s, 'rewardMarker', player, o.points);
        return s;
      }
      moveScore(s, player, o.points!, true);
      event(s, 'robber', { player, points: o.points });
      break;
    case 'rewardMarker':
      s.markers[player] = o.value as number;
      moveScore(s, player, o.points!, true);
      event(s, 'robber', { player, points: o.points });
      break;
    case 'message': {
      const n = o.kind === 'two' ? 2 : (o.points ?? 0);
      if (o.kind !== 'two' && s.message === 4) s.extra++;
      else {
        if (o.kind !== 'two' && s.message === 8 && o.target)
          remove(s, Number(o.target));
        s.turnPoints[player] = (s.turnPoints[player] ?? 0) + n;
        moveScore(s, player, n, false, s.turnPoints[player]);
        event(s, 'score', {
          player,
          points: n,
          target: s.message! <= 3 ? o.target : undefined,
        });
      }
      s.queue = ordered(s).filter((p) => s.robberRewards[p]?.length);
      s.stage = 'messageRewards';
      break;
    }
    case 'cropMode':
      s.cropMode = o.kind === 'remove' ? 'remove' : 'add';
      s.queue = ordered(s, (s.active + 1) % s.players.length);
      break;
    case 'crop':
      if (o.kind === 'return') remove(s, Number(o.target));
      else put(s, o, player);
      break;
    default:
      fail();
  }
  advance(s);
  return s;
}
/** Explicit allowlist: future tile/message order never enters a recipient snapshot. */
export function playerView(s: State, player: string) {
  return {
    public: {
      players: [...s.players],
      config: clone(s.config),
      setupVersion: s.setupVersion,
      ready: [...s.ready],
      phase: s.phase,
      turn: s.turn,
      active: actor(s),
      board: clone(s.board),
      figures: clone(s.figures),
      magic: clone(s.magic),
      current: s.current,
      remaining: s.deck.length,
      discarded: s.discarded,
      last: s.last,
      pending: clone(s.pending),
      scores: clone(s.scores),
      goods: clone(s.goods),
      gold: clone(s.gold),
      goldMap: clone(s.goldMap),
      robbers: clone(s.robbers),
      flight: clone(s.flight),
      message: s.message,
      events: clone(s.events),
      winners: [...s.winners],
      features: clone(graph(s)),
    },
    private: {
      placements:
        s.phase === 'place' && actor(s) === player
          ? placements(s.board, s.current!)
          : [],
    },
  };
}
export type View = ReturnType<typeof playerView>;
export const carcassonne: GameDefinition<State, View> = {
  ...seats('carcassonne'),
  create: createGame,
  apply: applyAction,
  view: playerView,
  isFinished: (s) => s.phase === 'finished',
  presence: (s, connectedPlayers, replacedPlayer) => {
    if (s.phase !== 'setup') return s;
    const next = clone(s);
    next.connectedPlayers = [...connectedPlayers];
    next.ready = next.ready.filter(
      (p) => connectedPlayers.includes(p) && p !== replacedPlayer,
    );
    if (replacedPlayer) {
      next.ready = [];
      next.setupVersion++;
    }
    return next;
  },
};
