import type { GameDefinition } from '@board-games/game-core';
import {
  manifest,
  identity,
  publicCard,
  isDessert,
  kinds,
  type Card,
  type Face,
  type Played,
  type HandCard,
  type Kind,
} from './cards.js';
import { presets, menuKinds, validMenu, type Menu } from './menus.js';
import {
  roundGroups,
  dessertGroups,
  type Receipt,
  type Group,
} from './scoring.js';
import {
  projectPresentation,
  type Presentation,
  type Event,
} from './presentation.js';
export type Pick = {
  type: 'PICK';
  round: number;
  turn: number;
  promptId: string;
  card: string;
  copyTarget?: string;
  utensils: string[];
};
export type Choice =
  | { type: 'card'; card: string }
  | { type: 'request'; kind: Kind; variant?: string; priority?: number }
  | { type: 'takeout'; cards: string[] }
  | { type: 'copy'; target: string | null }
  | { type: 'attach'; wasabi: string | null };
export type Action =
  | Pick
  | { type: 'READY'; round: number; version: number }
  | { type: 'SET_MENU'; version: number; menu: Menu }
  | {
      type: 'RESOLVE';
      round: number;
      turn: number;
      promptId: string;
      choice: Choice;
    };
type Entry = Card & { handle: string };
type Snapshot = Face & { boxed: boolean; copyCanAttach: boolean };
type Commitment = {
  position: number;
  card: Entry;
  action: Pick;
  copy: Snapshot | null;
};
type Effect = {
  kind: 'chopsticks' | 'spoon' | 'menu' | 'takeout' | 'copy' | 'attach';
  seat: number;
  card: string;
  priority: number;
  order: number;
};
export type Prompt = Omit<Effect, 'kind'> & {
  id: string;
  actor: number;
  kind: Effect['kind'] | 'supplier';
  offer: Entry[];
  requester?: number;
  request?: Extract<Choice, { type: 'request' }>;
};
export type State = {
  players: string[];
  connected: string[];
  phase: 'setup' | 'draft' | 'resolving' | 'round-end' | 'finished';
  round: number;
  turn: number;
  setupVersion: number;
  ready: string[];
  menu: Menu;
  manifest: Card[];
  deck: Card[];
  reserve: Card[];
  hands: Entry[][];
  commitments: (Commitment | null)[];
  pickPrompts: string[];
  tableaus: Played[][];
  desserts: Played[][];
  discard: Played[];
  queue: Effect[];
  prompt: Prompt | null;
  scores: number[];
  uramakiPlace: number;
  immediate: Group[][];
  miso: string[];
  receipts: Receipt[];
  winners: string[];
  serial: number;
  presentation: Presentation;
};
function fail(key = 'sgp_invalid'): never {
  throw new Error(key);
}
const uid = (s: State, prefix: string) => `${prefix}-${++s.serial}`;
const token = (random: () => number) =>
  Array.from({ length: 4 }, () =>
    Math.floor(random() * 0x100000000)
      .toString(16)
      .padStart(8, '0'),
  ).join('');
function shuffle<T>(a: T[], random: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
function entry(c: Card, random: () => number): Entry {
  return {
    physical: c.physical,
    face: identity(c.face),
    handle: token(random),
  };
}
function emit(s: State, event: Event) {
  s.presentation.events.push(event);
}
function renew(s: State, seat: number, random: () => number) {
  s.hands[seat] = s.hands[seat].map((c) => entry(c, random));
}
export function create(players: string[], _random: () => number): State {
  if (
    players.length < 2 ||
    players.length > 8 ||
    new Set(players).size !== players.length
  )
    fail();
  const arrays = <T>() => players.map(() => [] as T[]);
  return {
    players: [...players],
    connected: [...players],
    phase: 'setup',
    round: 0,
    turn: 0,
    setupVersion: 0,
    ready: [],
    menu: structuredClone(presets.first),
    manifest: [],
    deck: [],
    reserve: [],
    hands: arrays<Entry>(),
    commitments: players.map(() => null),
    pickPrompts: [],
    tableaus: arrays<Played>(),
    desserts: arrays<Played>(),
    discard: [],
    queue: [],
    prompt: null,
    scores: players.map(() => 0),
    uramakiPlace: 0,
    immediate: arrays<Group>(),
    miso: [],
    receipts: [],
    winners: [],
    serial: 0,
    presentation: { sequence: 0, round: 0, turn: 0, events: [] },
  };
}
function deal(s: State, random: () => number) {
  if (s.round === 0) {
    s.manifest = manifest().filter((c) =>
      menuKinds(s.menu).includes(c.face.kind),
    );
    s.deck = s.manifest.filter((c) => !isDessert(c.face));
    s.reserve = s.manifest.filter((c) => isDessert(c.face));
    shuffle(s.reserve, random);
  } else {
    for (let seat = 0; seat < s.players.length; seat++) {
      for (const c of s.tableaus[seat]) {
        if (isDessert(c)) s.desserts[seat].push(c);
        else s.deck.push(physical(s, c));
      }
      s.tableaus[seat] = [];
    }
    s.deck.push(...s.discard.map((c) => physical(s, c)));
    s.discard = [];
  }
  s.round++;
  s.turn = 1;
  s.ready = [];
  s.setupVersion++;
  s.phase = 'draft';
  s.uramakiPlace = 0;
  s.immediate = s.players.map(() => []);
  s.miso = [];
  const additions = (s.players.length <= 5 ? [5, 3, 2] : [7, 5, 3])[
    s.round - 1
  ];
  s.deck.push(...s.reserve.splice(0, additions));
  shuffle(s.deck, random);
  const size =
    s.players.length <= 3
      ? 10
      : s.players.length <= 5
        ? 9
        : s.players.length <= 7
          ? 8
          : 7;
  for (let i = 0; i < size; i++)
    for (let seat = 0; seat < s.players.length; seat++) {
      const c = s.deck.pop();
      if (!c) throw new Error('Sushi deck conservation invariant');
      s.hands[seat].push(entry(c, random));
    }
  s.pickPrompts = s.players.map(() => uid(s, 'pick'));
  s.commitments = s.players.map(() => null);
  emit(s, { type: 'deal', counts: s.hands.map((h) => h.length) });
}
function physical(s: State, c: Played): Card {
  const p = s.manifest.find((p) => p.physical === c.physical);
  if (!p) throw new Error('Unknown physical card');
  return structuredClone(p);
}
function own(s: State, seat: number, id: string) {
  return s.tableaus[seat].find((c) => c.id === id);
}
function availableWasabi(s: State, seat: number) {
  return s.tableaus[seat].filter(
    (c) =>
      !c.boxed &&
      c.kind === 'wasabi' &&
      !s.tableaus[seat].some((n) => !n.boxed && n.wasabi === c.id),
  );
}
function snapshot(c: Played): Snapshot {
  return {
    ...identity(c),
    boxed: c.boxed,
    copyCanAttach: c.kind === 'nigiri' && !c.wasabi,
  };
}
function queue(
  s: State,
  seat: number,
  c: Played,
  kind: Effect['kind'],
  priority = c.priority,
) {
  s.queue.push({
    seat,
    card: c.id,
    kind,
    priority,
    order: Number(c.id.split('-').at(-1)),
  });
}
function discard(s: State, seat: number, id: string) {
  const i = s.tableaus[seat].findIndex((c) => c.id === id);
  if (i >= 0) s.discard.push(...s.tableaus[seat].splice(i, 1));
}
function attach(s: State, seat: number, c: Played, w: Played) {
  c.wasabi = w.id;
  emit(s, { type: 'attach', seat: s.players[seat], card: c.id, wasabi: w.id });
}
function effects(s: State, seat: number, c: Played, batch: boolean) {
  if (c.boxed) return;
  if (c.kind === 'nigiri') {
    const w = availableWasabi(s, seat)[0];
    if (w) {
      if (!c.copied) attach(s, seat, c, w);
      else if (c.copyCanAttach) queue(s, seat, c, 'attach', -1);
    }
  }
  if (c.kind === 'miso') {
    s.miso.push(c.id);
    if (s.miso.length > 1) {
      for (let i = 0; i < s.players.length; i++)
        for (const id of s.miso) discard(s, i, id);
      emit(s, { type: 'miso-discard', cards: [...s.miso] });
    }
  }
  if (c.kind === 'menu' || c.kind === 'takeout') queue(s, seat, c, c.kind);
  if (c.kind === 'uramaki' && !batch) race(s, false);
}
function play(
  s: State,
  seat: number,
  card: Card,
  copy: Snapshot | null | undefined,
  batch = false,
): Played {
  const f = copy ?? card.face;
  const c: Played = {
    ...identity(f),
    id: uid(s, 'dish'),
    physical: card.physical,
    playedTurn: s.turn,
    collectedRound: s.round,
    boxed: copy?.boxed ?? false,
    copied: card.face.kind === 'special_order',
    wasabi: null,
    copyCanAttach: copy?.copyCanAttach ?? false,
  };
  s.tableaus[seat].push(c);
  if (card.face.kind === 'special_order' && copy === undefined) {
    queue(s, seat, c, 'copy', -2);
    return c;
  }
  if (card.face.kind === 'special_order' && !copy) {
    discard(s, seat, c.id);
    return c;
  }
  if (!batch) effects(s, seat, c, false);
  return c;
}
function race(s: State, residual: boolean) {
  if (s.uramakiPlace >= 3) return;
  const totals = s.tableaus.map((cs) =>
    cs
      .filter((c) => !c.boxed && c.kind === 'uramaki')
      .reduce((n, c) => n + c.icons, 0),
  );
  const ranks = [
    ...new Set(totals.filter((n) => (residual ? n > 0 : n >= 10))),
  ].sort((a, b) => b - a);
  for (const total of residual ? ranks.slice(0, 1) : ranks) {
    const seats = totals
      .map((n, i) => (n === total ? i : -1))
      .filter((i) => i >= 0);
    const points = [8, 5, 2][s.uramakiPlace] ?? 0;
    if (!points) break;
    for (const seat of seats) {
      const cards = s.tableaus[seat].filter(
        (c) => !c.boxed && c.kind === 'uramaki',
      );
      const g: Group = {
        kind: 'uramaki_immediate',
        amount: points,
        cards: cards.map((c) => c.id),
      };
      s.scores[seat] += points;
      s.immediate[seat].push(g);
      emit(s, { type: 'score', seat: s.players[seat], groups: [g] });
      for (const c of cards) discard(s, seat, c.id);
    }
    s.uramakiPlace += seats.length;
  }
}
function finishRound(s: State) {
  const final = s.round === 3;
  for (let i = 0; i < s.players.length; i++) {
    const groups = roundGroups(s.tableaus, i, s.menu.roll, s.uramakiPlace);
    if (final)
      groups.push(
        ...dessertGroups(
          s.desserts.map((old, seat) => [
            ...old,
            ...s.tableaus[seat].filter(isDessert),
          ]),
          i,
          s.menu.dessert,
        ),
      );
    const delta = groups.reduce((n, g) => n + g.amount, 0);
    s.scores[i] += delta;
    s.receipts.push({
      playerId: s.players[i],
      round: s.round,
      groups: [...s.immediate[i], ...groups],
      delta,
      immediate: s.immediate[i].reduce((n, g) => n + g.amount, 0),
      total: s.scores[i],
    });
    emit(s, { type: 'score', seat: s.players[i], groups });
  }
  s.setupVersion++;
  s.ready = [];
  s.phase = final ? 'finished' : 'round-end';
  emit(s, { type: 'round-end', round: s.round });
  if (final) {
    const best = Math.max(...s.scores);
    const tied = s.players.map((_, i) => i).filter((i) => s.scores[i] === best);
    const desserts = (i: number) =>
      s.desserts[i].length + s.tableaus[i].filter(isDessert).length;
    const count = Math.max(...tied.map(desserts));
    s.winners = tied
      .filter((i) => desserts(i) === count)
      .map((i) => s.players[i]);
    emit(s, { type: 'finished', winners: [...s.winners] });
  }
}
function advance(s: State, random: () => number) {
  if (s.hands.every((h) => h.length === 0)) {
    finishRound(s);
    return;
  }
  emit(s, {
    type: 'pass',
    edges: s.players.map((from, i) => ({
      from,
      to: s.players[(i + 1) % s.players.length],
      count: s.hands[i].length,
    })),
  });
  const old = s.hands;
  s.hands = s.players.map(
    (_, i) => old[(i - 1 + s.players.length) % s.players.length],
  );
  for (let i = 0; i < s.players.length; i++) renew(s, i, random);
  s.turn++;
  s.phase = 'draft';
  s.miso = [];
  s.commitments = s.players.map(() => null);
  s.pickPrompts = s.players.map(() => uid(s, 'pick'));
}
function drain(s: State, random: () => number) {
  while (!s.prompt && s.queue.length) {
    s.queue.sort(
      (a, b) => a.priority - b.priority || a.seat - b.seat || a.order - b.order,
    );
    const e = s.queue.shift()!;
    const c = own(s, e.seat, e.card);
    if (!c || c.boxed) continue;
    if (e.kind === 'attach' && !availableWasabi(s, e.seat).length) continue;
    if (e.kind === 'copy' && !s.tableaus[e.seat].some((t) => t.id !== c.id)) {
      discard(s, e.seat, c.id);
      continue;
    }
    const p: Prompt = { ...e, id: uid(s, 'prompt'), actor: e.seat, offer: [] };
    if (e.kind === 'menu') {
      if (s.deck.length < 4) throw new Error('Sushi Menu stock invariant');
      p.offer = s.deck.splice(-4).map((c) => entry(c, random));
    }
    s.prompt = p;
    s.phase = 'resolving';
  }
  if (!s.prompt && !s.queue.length) advance(s, random);
}
function reveal(s: State, random: () => number) {
  s.phase = 'resolving';
  const cards: { seat: string; card: ReturnType<typeof publicCard> }[] = [];
  // Freeze/collect the complete batch before any public projection is emitted.
  for (let seat = 0; seat < s.players.length; seat++) {
    const p = s.commitments[seat]!;
    const c = play(s, seat, p.card, p.copy, true);
    cards.push({ seat: s.players[seat], card: publicCard(c) });
    for (const id of p.action.utensils) {
      const utensil = own(s, seat, id)!;
      queue(s, seat, utensil, utensil.kind as 'spoon' | 'chopsticks');
    }
  }
  emit(s, { type: 'reveal', cards });
  for (let seat = 0; seat < s.players.length; seat++) {
    const c = own(s, seat, cards[seat].card.id);
    if (c) effects(s, seat, c, true);
  }
  s.commitments = s.players.map(() => null);
  race(s, false);
  drain(s, random);
}
function exact(obj: object, required: string[], optional: string[] = []) {
  const keys = Object.keys(obj);
  return (
    required.every((k) => keys.includes(k)) &&
    keys.every((k) => required.includes(k) || optional.includes(k))
  );
}
function utensilIds(s: State, seat: number) {
  return s.tableaus[seat]
    .filter(
      (c) =>
        !c.boxed &&
        c.playedTurn < s.turn &&
        (c.kind === 'spoon' ||
          (c.kind === 'chopsticks' && s.hands[seat].length > 1)),
    )
    .map((c) => c.id);
}
function requestMatches(c: Entry, r: Extract<Choice, { type: 'request' }>) {
  return (
    c.face.kind === r.kind &&
    (r.variant === undefined || r.variant === c.face.variant) &&
    (r.priority === undefined || r.priority === c.face.priority)
  );
}
function validate(s: State, seat: number, input: unknown): Action {
  if (seat < 0 || !input || typeof input !== 'object' || Array.isArray(input))
    fail();
  if (s.connected.length !== s.players.length) fail('sgp_disconnected');
  const a = input as Action;
  if (a.type === 'SET_MENU') {
    if (!exact(a, ['type', 'version', 'menu'])) fail();
    if (s.phase !== 'setup' || a.version !== s.setupVersion) fail('sgp_stale');
    if (!validMenu(a.menu, s.players.length)) fail('sgp_menu_invalid');
    return a;
  }
  if (a.type === 'READY') {
    if (!exact(a, ['type', 'round', 'version'])) fail();
    if (
      !['setup', 'round-end'].includes(s.phase) ||
      a.round !== s.round ||
      a.version !== s.setupVersion ||
      s.ready.includes(s.players[seat])
    )
      fail('sgp_stale');
    return a;
  }
  if (a.type === 'PICK') {
    if (
      !exact(
        a,
        ['type', 'round', 'turn', 'promptId', 'card', 'utensils'],
        ['copyTarget'],
      )
    )
      fail();
    if (
      s.phase !== 'draft' ||
      a.round !== s.round ||
      a.turn !== s.turn ||
      a.promptId !== s.pickPrompts[seat] ||
      s.commitments[seat]
    )
      fail('sgp_stale');
    const c = s.hands[seat].find((c) => c.handle === a.card);
    if (!c) fail('sgp_stale');
    if (
      !Array.isArray(a.utensils) ||
      new Set(a.utensils).size !== a.utensils.length ||
      a.utensils.some(
        (id) => typeof id !== 'string' || !utensilIds(s, seat).includes(id),
      )
    )
      fail();
    if (c.face.kind === 'special_order') {
      if (
        s.tableaus[seat].length &&
        (typeof a.copyTarget !== 'string' || !own(s, seat, a.copyTarget))
      )
        fail();
      if (!s.tableaus[seat].length && a.copyTarget !== undefined) fail();
    } else if (a.copyTarget !== undefined) fail();
    return a;
  }
  if (a.type === 'RESOLVE') {
    if (!exact(a, ['type', 'round', 'turn', 'promptId', 'choice'])) fail();
    const p = s.prompt;
    if (
      s.phase !== 'resolving' ||
      !p ||
      a.round !== s.round ||
      a.turn !== s.turn ||
      a.promptId !== p.id
    )
      fail('sgp_stale');
    if (p.actor !== seat) fail('sgp_wait');
    const c = a.choice;
    if (!c || typeof c !== 'object' || Array.isArray(c)) fail();
    if (p.kind === 'menu' || p.kind === 'chopsticks' || p.kind === 'supplier') {
      if (
        c.type !== 'card' ||
        !exact(c, ['type', 'card']) ||
        typeof c.card !== 'string'
      )
        fail();
      const choices = p.kind === 'menu' ? p.offer : s.hands[seat];
      const card = choices.find((x) => x.handle === c.card);
      if (!card) fail();
      if (p.kind === 'menu' && card.face.kind === 'menu') fail();
      if (p.kind === 'supplier' && !requestMatches(card, p.request!)) fail();
    } else if (p.kind === 'spoon') {
      if (
        c.type !== 'request' ||
        !exact(c, ['type', 'kind'], ['variant', 'priority']) ||
        !kinds.includes(c.kind)
      )
        fail();
      if (
        (c.variant !== undefined && typeof c.variant !== 'string') ||
        (c.priority !== undefined &&
          (!Number.isInteger(c.priority) || c.priority < 1))
      )
        fail();
      if (
        !s.manifest.some(
          (x) =>
            x.face.kind === c.kind &&
            (c.variant === undefined || x.face.variant === c.variant) &&
            (c.priority === undefined || x.face.priority === c.priority),
        )
      )
        fail();
    } else if (p.kind === 'takeout') {
      if (
        c.type !== 'takeout' ||
        !exact(c, ['type', 'cards']) ||
        !Array.isArray(c.cards) ||
        new Set(c.cards).size !== c.cards.length ||
        c.cards.some(
          (id) =>
            typeof id !== 'string' ||
            !s.tableaus[seat].some(
              (t) => t.id === id && !t.boxed && t.playedTurn < s.turn,
            ),
        )
      )
        fail();
    } else if (p.kind === 'copy') {
      if (
        c.type !== 'copy' ||
        !exact(c, ['type', 'target']) ||
        !s.tableaus[seat].some((t) => t.id !== p.card && t.id === c.target)
      )
        fail();
    } else if (p.kind === 'attach') {
      if (
        c.type !== 'attach' ||
        !exact(c, ['type', 'wasabi']) ||
        (c.wasabi !== null &&
          !availableWasabi(s, seat).some((w) => w.id === c.wasabi))
      )
        fail();
    }
    return a;
  }
  return fail();
}
function takeHand(s: State, seat: number, handle: string) {
  const i = s.hands[seat].findIndex((c) => c.handle === handle);
  if (i < 0) throw new Error('Invalid internal hand handle');
  return s.hands[seat].splice(i, 1)[0];
}
function exchange(
  s: State,
  p: Prompt,
  supplier: number,
  card: Entry,
  random: () => number,
) {
  const spoon = own(s, p.seat, p.card)!;
  s.tableaus[p.seat] = s.tableaus[p.seat].filter((c) => c.id !== spoon.id);
  s.hands[supplier].push(entry(physical(s, spoon), random));
  renew(s, supplier, random);
  const played = play(s, p.seat, card, undefined);
  emit(s, {
    type: 'utensil-exchange',
    from: s.players[supplier],
    to: s.players[p.seat],
  });
  emit(s, {
    type: 'reveal',
    cards: [{ seat: s.players[p.seat], card: publicCard(played) }],
  });
}
function resolve(s: State, c: Choice, random: () => number) {
  const p = s.prompt!;
  s.prompt = null;
  if (c.type === 'card') {
    if (p.kind === 'supplier') {
      exchange(s, p, p.actor, takeHand(s, p.actor, c.card), random);
    } else {
      let card: Entry;
      if (p.kind === 'menu') {
        card = p.offer.find((x) => x.handle === c.card)!;
        s.deck.push(
          ...p.offer
            .filter((x) => x !== card)
            .map((x) => ({ physical: x.physical, face: identity(x.face) })),
        );
        shuffle(s.deck, random);
        discard(s, p.seat, p.card);
      } else {
        card = takeHand(s, p.seat, c.card);
        const chopsticks = own(s, p.seat, p.card)!;
        s.tableaus[p.seat] = s.tableaus[p.seat].filter((x) => x.id !== p.card);
        s.hands[p.seat].push(entry(physical(s, chopsticks), random));
        renew(s, p.seat, random);
        emit(s, {
          type: 'utensil-exchange',
          from: s.players[p.seat],
          to: s.players[p.seat],
        });
      }
      const played = play(s, p.seat, card, undefined);
      emit(s, {
        type: 'reveal',
        cards: [{ seat: s.players[p.seat], card: publicCard(played) }],
      });
    }
  } else if (c.type === 'request') {
    for (let offset = 1; offset < s.players.length; offset++) {
      const supplier = (p.seat + offset) % s.players.length;
      const matches = s.hands[supplier].filter((x) => requestMatches(x, c));
      if (!matches.length) continue;
      const variants = new Set(matches.map((x) => JSON.stringify(x.face)));
      if (variants.size > 1)
        s.prompt = {
          ...p,
          id: uid(s, 'prompt'),
          kind: 'supplier',
          actor: supplier,
          request: c,
          requester: p.seat,
        };
      else
        exchange(
          s,
          p,
          supplier,
          takeHand(s, supplier, matches[0].handle),
          random,
        );
      return;
    }
    discard(s, p.seat, p.card);
  } else if (c.type === 'takeout') {
    for (const id of c.cards) {
      const t = own(s, p.seat, id)!;
      t.boxed = true;
      t.wasabi = null;
      for (const other of s.tableaus[p.seat])
        if (other.wasabi === id) other.wasabi = null;
    }
    discard(s, p.seat, p.card);
    emit(s, { type: 'takeout', seat: s.players[p.seat], cards: [...c.cards] });
  } else if (c.type === 'copy') {
    const target = own(s, p.seat, c.target!)!;
    const card = own(s, p.seat, p.card)!;
    const snap = snapshot(target);
    Object.assign(card, snap);
    card.copied = true;
    effects(s, p.seat, card, false);
    emit(s, { type: 'copy', seat: s.players[p.seat], card: publicCard(card) });
  } else if (c.type === 'attach' && c.wasabi)
    attach(s, p.seat, own(s, p.seat, p.card)!, own(s, p.seat, c.wasabi)!);
}
export function apply(
  original: State,
  player: string,
  input: unknown,
  random: () => number,
): State {
  const seat = original.players.indexOf(player);
  const action = validate(original, seat, input);
  const s = structuredClone(original);
  s.presentation = {
    sequence: original.presentation.sequence + 1,
    round: s.round,
    turn: s.turn,
    events: [],
  };
  if (action.type === 'SET_MENU') {
    s.menu = structuredClone(action.menu);
    s.setupVersion++;
    s.ready = [];
  }
  if (action.type === 'READY') {
    s.ready.push(player);
    if (s.ready.length === s.players.length) deal(s, random);
  }
  if (action.type === 'PICK') {
    const position = s.hands[seat].findIndex((c) => c.handle === action.card);
    const card = takeHand(s, seat, action.card);
    const target = action.copyTarget
      ? own(s, seat, action.copyTarget)
      : undefined;
    s.commitments[seat] = {
      position,
      card,
      action: structuredClone(action),
      copy: target ? snapshot(target) : null,
    };
    emit(s, { type: 'committed', seat: player });
    if (s.commitments.every(Boolean)) reveal(s, random);
  }
  if (action.type === 'RESOLVE') {
    resolve(s, action.choice, random);
    drain(s, random);
  }
  return s;
}
export function presence(
  original: State,
  connected: string[],
  replaced?: string,
): State {
  const s = structuredClone(original);
  s.connected = s.players.filter((p) => connected.includes(p));
  if (replaced && ['setup', 'round-end'].includes(s.phase)) {
    s.ready = [];
    s.setupVersion++;
  }
  return s;
}
function handView(c: Entry): HandCard {
  return { ...identity(c.face), handle: c.handle };
}
export function view(s: State, player: string) {
  const seat = s.players.indexOf(player);
  if (seat < 0) fail();
  const p = s.prompt;
  const ownPrompt = p?.actor === seat ? p : null;
  const commitment = s.commitments[seat];
  const visibleHand = [...s.hands[seat]];
  if (commitment) visibleHand.splice(commitment.position, 0, commitment.card);
  return {
    public: {
      phase: s.phase,
      round: s.round,
      turn: s.turn,
      setupVersion: s.setupVersion,
      menu: structuredClone(s.menu),
      ready: [...s.ready],
      committed: s.players.filter((_, i) => s.commitments[i]),
      connected: [...s.connected],
      players: s.players.map((id, i) => ({
        id,
        score: s.scores[i],
        count: s.hands[i].length + (s.commitments[i] ? 1 : 0),
        tableau: s.tableaus[i].map(publicCard),
        desserts: s.desserts[i].map(publicCard),
      })),
      prompt: p
        ? { id: p.id, actorId: s.players[p.actor], kind: p.kind }
        : null,
      discard: s.discard.map(publicCard),
      receipts: structuredClone(s.receipts),
      winners: [...s.winners],
      uramakiPlace: s.uramakiPlace,
      presentation: projectPresentation(s.presentation),
    },
    private: {
      hand: visibleHand.map(handView),
      pickPromptId: s.phase === 'draft' ? s.pickPrompts[seat] : null,
      committed: commitment
        ? {
            card: commitment.action.card,
            ...(commitment.action.copyTarget
              ? { copyTarget: commitment.action.copyTarget }
              : {}),
            utensils: [...commitment.action.utensils],
          }
        : null,
      legalUtensils:
        s.phase === 'draft' && !commitment ? utensilIds(s, seat) : [],
      copyTargets: s.tableaus[seat].map(publicCard),
      prompt: ownPrompt
        ? {
            id: ownPrompt.id,
            kind: ownPrompt.kind,
            card: ownPrompt.card,
            cards:
              ownPrompt.kind === 'menu'
                ? ownPrompt.offer
                    .filter((c) => c.face.kind !== 'menu')
                    .map(handView)
                : ownPrompt.kind === 'supplier'
                  ? s.hands[seat]
                      .filter((c) => requestMatches(c, ownPrompt.request!))
                      .map(handView)
                  : ownPrompt.kind === 'chopsticks'
                    ? s.hands[seat].map(handView)
                    : [],
            targets:
              ownPrompt.kind === 'takeout'
                ? s.tableaus[seat]
                    .filter((c) => !c.boxed && c.playedTurn < s.turn)
                    .map(publicCard)
                : ownPrompt.kind === 'copy'
                  ? s.tableaus[seat]
                      .filter((c) => c.id !== ownPrompt.card)
                      .map(publicCard)
                  : ownPrompt.kind === 'attach'
                    ? availableWasabi(s, seat).map(publicCard)
                    : [],
            requests:
              ownPrompt.kind === 'spoon'
                ? menuKinds(s.menu).map((kind) => ({
                    kind,
                    variants: [
                      ...new Set(
                        s.manifest
                          .filter((c) => c.face.kind === kind)
                          .map((c) => c.face.variant),
                      ),
                    ],
                    priorities: [
                      ...new Set(
                        s.manifest
                          .filter(
                            (c) => c.face.kind === kind && c.face.priority,
                          )
                          .map((c) => c.face.priority),
                      ),
                    ],
                  }))
                : [],
          }
        : null,
    },
  };
}
export function assertConservation(s: State) {
  const ids = [
    ...s.deck,
    ...s.reserve,
    ...s.hands.flat(),
    ...s.commitments.flatMap((c) => (c ? [c.card] : [])),
    ...s.tableaus.flat(),
    ...s.desserts.flat(),
    ...s.discard,
    ...(s.prompt?.offer ?? []),
  ].map((c) => c.physical);
  if (
    ids.length !== s.manifest.length ||
    new Set(ids).size !== ids.length ||
    s.manifest.some((c) => !ids.includes(c.physical))
  )
    throw new Error('Sushi physical card conservation failed');
}
export const sushiGoParty = {
  id: 'sushi-go-party',
  minPlayers: 2,
  maxPlayers: 8,
  create,
  apply,
  view,
  presence,
  isFinished: (s: State) => s.phase === 'finished',
} satisfies GameDefinition<State>;
