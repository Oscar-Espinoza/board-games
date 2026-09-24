import type { GameDefinition } from '@board-games/game-core';
import type {
  Assignment,
  Cell,
  Event,
  Identity,
  Options,
  PublicEvent,
  State,
  Team,
  View,
} from './types.js';
import { packVersion, words } from './words.js';
export type * from './types.js';
const other = (team: Team): Team => (team === 'red' ? 'blue' : 'red');
const fail = (): never => {
  throw new Error('cn_error');
};
function shuffle<T>(source: T[], random: () => number): T[] {
  const a = [...source];
  for (let i = a.length - 1; i > 0; i--) {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1) fail();
    const j = Math.floor(n * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
export function create(
  players: string[],
  _random: () => number,
  input?: unknown,
): State {
  if (
    players.length < 4 ||
    players.length > 12 ||
    new Set(players).size !== players.length ||
    players.some((p) => typeof p !== 'string' || !p)
  )
    fail();
  if (input != null && (typeof input !== 'object' || Array.isArray(input)))
    fail();
  const o = (input ?? {}) as Partial<Options>;
  if (o.boardLanguage !== undefined && !['en', 'es'].includes(o.boardLanguage))
    fail();
  return {
    players: [...players],
    assignments: {},
    options: {
      boardLanguage: o.boardLanguage ?? 'en',
    },
    packVersion,
    setupVersion: 0,
    ready: [],
    connectedPlayers: [...players],
    phase: 'setup',
    board: [],
    startingTeam: 'red',
    activeTeam: 'red',
    turn: 0,
    clue: null,
    budget: { kind: 'unlimited' },
    used: 0,
    clueHistory: [],
    result: null,
    actionSequence: 0,
    events: [],
  };
}
export function validRoster(s: State): boolean {
  return (
    s.players.every((p) => s.assignments[p]) &&
    (['red', 'blue'] as Team[]).every((team) => {
      const a = Object.values(s.assignments).filter((a) => a.team === team);
      return (
        a.filter((a) => a.role === 'spymaster').length === 1 &&
        a.some((a) => a.role === 'operative')
      );
    })
  );
}
export function presence(
  s: State,
  connectedPlayers: string[],
  replacedPlayer?: string,
): State {
  const connected = s.players.filter((p) => connectedPlayers.includes(p));
  if (s.phase !== 'setup') return { ...s, connectedPlayers: connected };
  return {
    ...s,
    connectedPlayers: connected,
    ready: replacedPlayer ? [] : s.ready.filter((p) => connected.includes(p)),
    setupVersion: s.setupVersion + (replacedPlayer ? 1 : 0),
  };
}
export function apply(
  s: State,
  player: string,
  input: unknown,
  random: () => number,
): State {
  if (
    !s.players.includes(player) ||
    !s.connectedPlayers.includes(player) ||
    s.phase === 'finished' ||
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  )
    fail();
  const a = input as Record<string, unknown>;
  const n = structuredClone(s);
  n.actionSequence++;
  n.events = [];
  const emit = (e: Event) => {
    const event = {
      ...e,
      sequence: n.actionSequence,
      index: n.events.length,
    } as PublicEvent;
    n.events.push(event);
  };
  const next = () => {
    n.activeTeam = other(n.activeTeam);
    n.turn++;
    n.clue = null;
    n.used = 0;
    n.budget = { kind: 'unlimited' };
    n.phase = 'clue';
    emit({ type: 'turnEnded', team: n.activeTeam });
  };
  const requireActor = (role: Assignment['role']) => {
    const actor = s.assignments[player];
    if (actor?.team !== s.activeTeam || actor.role !== role) fail();
  };
  const reveal = (index: number) => {
    const c = n.board[index]!;
    c.revealed = true;
    n.used++;
    n.clueHistory
      .at(-1)!
      .guesses.push({ card: index, word: c.word, identity: c.identity });
    emit({
      type: 'cardRevealed',
      card: index,
      word: c.word,
      identity: c.identity,
    });
    const won =
      c.identity === 'assassin'
        ? other(s.activeTeam)
        : (['red', 'blue'] as Team[]).find(
            (t) => !n.board.some((c) => c.identity === t && !c.revealed),
          );
    if (won) {
      n.result = {
        team: won,
        reason: c.identity === 'assassin' ? 'assassin' : 'agents',
      };
      n.phase = 'finished';
      emit({ type: 'gameFinished', result: n.result });
      return true;
    }
    return false;
  };
  const cell = () => {
    if (
      typeof a.card !== 'number' ||
      !Number.isInteger(a.card) ||
      a.card < 0 ||
      a.card >= 25 ||
      !n.board[a.card] ||
      n.board[a.card]!.revealed
    )
      fail();
    return a.card as number;
  };
  const actor = s.assignments[player];
  if (a.type === 'chooseRole') {
    if (
      s.phase !== 'setup' ||
      a.version !== s.setupVersion ||
      !['red', 'blue'].includes(a.team as string) ||
      !['spymaster', 'operative'].includes(a.role as string)
    )
      fail();
    if (
      (actor?.team === a.team && actor.role === a.role) ||
      (a.role === 'spymaster' &&
        s.players.some(
          (p) =>
            p !== player &&
            s.assignments[p]?.team === a.team &&
            s.assignments[p]?.role === 'spymaster',
        ))
    )
      fail();
    n.assignments[player] = {
      team: a.team as Team,
      role: a.role as Assignment['role'],
    };
    n.ready = [];
    n.setupVersion++;
  } else if (a.type === 'ready') {
    if (
      s.phase !== 'setup' ||
      a.version !== s.setupVersion ||
      !validRoster(s) ||
      s.players.some((p) => !s.connectedPlayers.includes(p))
    )
      fail();
    if (n.ready.includes(player)) fail();
    n.ready.push(player);
    if (n.ready.length === n.players.length) {
      const pool = shuffle(words[n.options.boardLanguage], random);
      n.startingTeam = random() < 0.5 ? 'red' : 'blue';
      const identities: Identity[] = [
        ...Array<Identity>(9).fill(n.startingTeam),
        ...Array<Identity>(8).fill(other(n.startingTeam)),
        ...Array<Identity>(7).fill('civilian'),
        'assassin',
      ];
      n.board = shuffle(identities, random).map((identity, i): Cell => ({
        word: pool[i]!,
        identity,
        revealed: false,
      }));
      n.activeTeam = n.startingTeam;
      n.turn = 1;
      n.phase = 'clue';
      emit({ type: 'boardDealt', team: n.startingTeam });
    }
  } else if (a.type === 'submitClue') {
    if (s.phase !== 'clue') fail();
    requireActor('spymaster');
    if (typeof a.word !== 'string' || /[\p{Cc}\p{Cf}]/u.test(a.word)) fail();
    const word = (a.word as string).normalize('NFC').trim();
    const length = [
      ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
        word,
      ),
    ].length;
    if (
      length < 1 ||
      length > 80 ||
      !(
        a.count === 'unlimited' ||
        (typeof a.count === 'number' &&
          Number.isInteger(a.count) &&
          a.count >= 0 &&
          a.count <= 9)
      )
    )
      fail();
    const count = a.count as number | 'unlimited';
    n.clue = { word, count, team: n.activeTeam };
    n.budget =
      count === 0 || count === 'unlimited'
        ? { kind: 'unlimited' }
        : { kind: 'finite', cap: count + 1 };
    n.used = 0;
    n.clueHistory.push({ ...n.clue, turn: n.turn, guesses: [] });
    n.phase = 'guessing';
    emit({ type: 'clueSubmitted', clue: { ...n.clue } });
  } else if (a.type === 'guess') {
    if (s.phase !== 'guessing') fail();
    requireActor('operative');
    const index = cell();
    if (
      !reveal(index) &&
      (n.board[index]!.identity !== n.activeTeam ||
        (n.budget.kind === 'finite' && n.used >= n.budget.cap))
    )
      next();
  } else if (a.type === 'endTurn') {
    if (s.phase !== 'guessing' || s.used < 1) fail();
    requireActor('operative');
    next();
  } else fail();
  return n;
}
function publicEvent(e: PublicEvent): PublicEvent {
  const id = { sequence: e.sequence, index: e.index };
  switch (e.type) {
    case 'clueSubmitted':
      return {
        ...id,
        type: e.type,
        clue: { word: e.clue.word, count: e.clue.count, team: e.clue.team },
      };
    case 'turnEnded':
    case 'boardDealt':
      return { ...id, type: e.type, team: e.team };
    case 'cardRevealed':
      return {
        ...id,
        type: e.type,
        card: e.card,
        word: e.word,
        identity: e.identity,
      };
    case 'gameFinished':
      return {
        ...id,
        type: e.type,
        result: { team: e.result.team, reason: e.result.reason },
      };
  }
}
export function view(s: State, player: string): View {
  if (!s.players.includes(player)) fail();
  const assignment = s.assignments[player]
    ? { team: s.assignments[player]!.team, role: s.assignments[player]!.role }
    : null;
  return {
    public: {
      players: [...s.players],
      assignments: Object.fromEntries(
        Object.entries(s.assignments).map(([p, a]) => [
          p,
          { team: a.team, role: a.role },
        ]),
      ),
      options: {
        boardLanguage: s.options.boardLanguage,
      },
      setupVersion: s.setupVersion,
      ready: [...s.ready],
      connectedPlayers: [...s.connectedPlayers],
      phase: s.phase,
      board: s.board.map((c, index) => ({
        index,
        word: c.word,
        revealed: c.revealed,
        ...(c.revealed || s.phase === 'finished'
          ? { identity: c.identity }
          : {}),
      })),
      startingTeam: s.startingTeam,
      activeTeam: s.activeTeam,
      turn: s.turn,
      clue: s.clue
        ? { word: s.clue.word, count: s.clue.count, team: s.clue.team }
        : null,
      budget:
        s.budget.kind === 'finite'
          ? { kind: 'finite', cap: s.budget.cap }
          : { kind: 'unlimited' },
      used: s.used,
      clueHistory: s.clueHistory.map((record) => ({
        turn: record.turn,
        team: record.team,
        word: record.word,
        count: record.count,
        guesses: record.guesses
          .filter((g) => s.board[g.card]?.revealed)
          .map((g) => ({ card: g.card, word: g.word, identity: g.identity })),
      })),
      result: s.result
        ? { team: s.result.team, reason: s.result.reason }
        : null,
      remaining: {
        red: s.board.filter((c) => c.identity === 'red' && !c.revealed).length,
        blue: s.board.filter((c) => c.identity === 'blue' && !c.revealed)
          .length,
      },
      actionSequence: s.actionSequence,
      events: s.events.map(publicEvent),
    },
    private: {
      assignment,
      ...(assignment?.role === 'spymaster' && s.phase !== 'setup'
        ? { key: s.board.map((c) => c.identity) }
        : {}),
    },
  };
}
export const codenames: GameDefinition<State> = {
  id: 'codenames',
  minPlayers: 4,
  maxPlayers: 12,
  create,
  apply,
  view,
  presence,
  isFinished: (s) => s.phase === 'finished',
};
