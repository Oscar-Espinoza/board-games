import {
  shuffled,
  type ActionContext,
  type GameDefinition,
} from '@board-games/game-core';
import { games, seats } from '@board-games/shared/games';
import {
  answerLength,
  clueLength,
  powerDeck,
  powersFrom,
  winningScore,
} from './limits.js';
import type {
  State,
  Options,
  Role,
  Power,
  View,
  Event,
  EventData,
  Symbol,
} from './types.js';
/** The rules refuse a random source that returns anything but a number in [0, 1). */
function checked(random: () => number) {
  return () => {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1) fail();
    return n;
  };
}
const distribution: Record<number, [number, number, number]> = {
  3: [2, 1, 0],
  4: [3, 1, 0],
  5: [3, 1, 1],
  6: [4, 1, 1],
  7: [4, 2, 1],
  8: [5, 2, 1],
  9: [5, 3, 1],
};
const normalize = (word: string) =>
  word.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es');
const fail = (): never => {
  throw new Error('ls_error');
};
function options(input: unknown, count: number): Options {
  if (input != null && (typeof input !== 'object' || Array.isArray(input)))
    fail();
  const o = (input ?? {}) as Partial<Options>;
  if (
    (o.wordLanguage !== undefined && !['en', 'es'].includes(o.wordLanguage)) ||
    (o.powers !== undefined && typeof o.powers !== 'boolean') ||
    (o.powers && count < powersFrom)
  )
    fail();
  return { wordLanguage: o.wordLanguage ?? 'en', powers: o.powers ?? false };
}
/** The password pairs a table draws from; the browser never imports them. */
export type Pair = {
  id: string;
  words: [string, string];
  aliases: [string[], string[]];
};
export type Packs = Record<'en' | 'es', Pair[]>;
/** Everything a mission resets: a new table starts from it, and so does every deal. */
const freshMission = (): Pick<
  State,
  | 'cycle'
  | 'speaker'
  | 'eliminated'
  | 'revealed'
  | 'ballots'
  | 'rps'
  | 'candidates'
  | 'prompt'
  | 'reactions'
  | 'result'
  | 'continued'
  | 'clues'
  | 'clueOrder'
  | 'origin'
  | 'ballotId'
  | 'rpsId'
  | 'history'
> => ({
  cycle: 0,
  speaker: null,
  eliminated: [],
  revealed: {},
  ballots: {},
  rps: {},
  candidates: [],
  prompt: null,
  reactions: [],
  result: null,
  continued: [],
  clues: {},
  clueOrder: [],
  origin: null,
  ballotId: '',
  rpsId: '',
  history: [],
});
function create(
  players: string[],
  _random: () => number,
  input?: unknown,
): State {
  if (
    players.length < games['little-secret'].minPlayers ||
    players.length > games['little-secret'].maxPlayers ||
    new Set(players).size !== players.length ||
    players.some(
      (p) =>
        typeof p !== 'string' ||
        !p ||
        ['__proto__', 'constructor', 'prototype'].includes(p),
    )
  )
    fail();
  return {
    ...freshMission(),
    players: [...players],
    connectedPlayers: [...players],
    options: options(input, players.length),
    setupVersion: 0,
    ready: [],
    phase: 'setup',
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    mission: 0,
    powers: {},
    actionSequence: 0,
    events: [],
    used: [],
    password: '',
    alternative: '',
    aliases: [],
    roles: {},
  };
}
function presence(s: State, connected: string[], replaced?: string): State {
  return {
    ...s,
    connectedPlayers: s.players.filter((p) => connected.includes(p)),
    ...(s.phase === 'setup'
      ? {
          ready: replaced ? [] : s.ready.filter((p) => connected.includes(p)),
          setupVersion: s.setupVersion + (replaced ? 1 : 0),
        }
      : {}),
  };
}
/** Who the table waits on, or undefined when anyone (or the host) may move. */
export function nextActor(s: State): string | undefined {
  if (s.prompt) return s.prompt.actor;
  if (s.speaker) return s.speaker;
  switch (s.phase) {
    case 'setup':
      return s.players.find((p) => !s.ready.includes(p));
    case 'vote':
      return s.players.find((p) => !s.eliminated.includes(p) && !s.ballots[p]);
    case 'tie':
      return s.candidates.find((p) => !s.rps[p]);
    case 'missionResult':
      return s.players.find((p) => !s.continued.includes(p));
  }
}
export function rules(packs: Packs) {
  function apply(
    s: State,
    player: string,
    input: unknown,
    random: () => number,
    context?: ActionContext,
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
    const a = input as Record<string, unknown>,
      n = structuredClone(s);
    n.actionSequence++;
    n.events = [];
    const emit = (event: EventData) => {
      const e: Event = { ...event, sequence: n.actionSequence };
      n.events.push(e);
      n.history.push(e);
      // Tied rock-paper-scissors rounds can repeat without end.
      n.history = n.history.slice(-100);
    };
    const alive = () => n.players.filter((p) => !n.eliminated.includes(p));
    const phase = (p: State['phase']) => {
      if (s.phase !== p) fail();
    };
    const prompt = (kind: NonNullable<State['prompt']>['kind']) => {
      if (
        !s.prompt ||
        s.prompt.kind !== kind ||
        s.prompt.actor !== player ||
        a.promptId !== s.prompt.id
      )
        fail();
    };
    const livingTarget = () => {
      if (typeof a.target !== 'string' || !alive().includes(a.target)) fail();
      return a.target as string;
    };
    const solution = () => ({
      password: n.password,
      alternative: n.alternative,
      roles: { ...n.roles },
    });
    const finish = (guesser?: string) => {
      const survivors = alive(),
        clean = !survivors.some((p) => n.roles[p] !== 'disciple');
      const points = Object.fromEntries(
        n.players.map((p) => [
          p,
          guesser
            ? p === guesser
              ? 3
              : 0
            : clean
              ? n.roles[p] === 'disciple'
                ? 1
                : 0
              : n.roles[p] === 'infiltrator' &&
                  survivors.some((p) => n.roles[p] === 'infiltrator')
                ? 2
                : n.roles[p] === 'journalist' && survivors.includes(p)
                  ? 3
                  : 0,
        ]),
      );
      for (const p of n.players) n.scores[p]! += points[p]!;
      const max = Math.max(...Object.values(n.scores));
      const winners =
        max >= winningScore ? n.players.filter((p) => n.scores[p] === max) : [];
      n.result = {
        ...solution(),
        points,
        reason: guesser ? 'guess' : clean ? 'disciples' : 'survivors',
        winners,
      };
      n.phase = winners.length ? 'finished' : 'missionResult';
      n.prompt = null;
      n.reactions = [];
      n.speaker = null;
      n.continued = [];
      emit({ type: 'score', points });
    };
    const cycle = (after: string) => {
      const index = n.players.indexOf(after),
        ordered = [
          ...n.players.slice(index + 1),
          ...n.players.slice(0, index + 1),
        ].filter((p) => !n.eliminated.includes(p));
      n.clues = {};
      n.clueOrder = ordered;
      n.speaker = ordered[0]!;
      n.cycle++;
      n.phase = 'clues';
      n.prompt = null;
    };
    const aftermath = () => {
      const reaction = n.reactions.shift();
      if (reaction) {
        n.phase = 'reactions';
        n.prompt = {
          ...reaction,
          id: `${n.mission}:${n.actionSequence}:${reaction.kind}:${reaction.actor}`,
        };
        return;
      }
      n.prompt = null;
      if (
        alive().length <= 2 ||
        alive().every((p) => n.roles[p] === 'disciple')
      )
        finish();
      else cycle(n.origin!);
    };
    const eliminate = (target: string) => {
      n.eliminated.push(target);
      n.revealed[target] = n.roles[target]!;
      emit({
        type: 'elimination',
        player: target,
        role: n.roles[target]!,
      });
      if (n.roles[target] === 'journalist')
        n.reactions.push({ kind: 'journalist', actor: target });
      if (n.powers[target] === 'revenant')
        n.reactions.push({ kind: 'revenant', actor: target });
      aftermath();
    };
    const deal = () => {
      const draw = checked(random);
      const pool = packs[n.options.wordLanguage].filter(
        (pair) => !n.used.includes(pair.id),
      );
      if (!pool.length) fail();
      const pair = pool[Math.floor(draw() * pool.length)]!,
        orientation = draw() < 0.5 ? 0 : 1;
      n.used.push(pair.id);
      n.password = pair.words[orientation];
      n.alternative = pair.words[1 - orientation]!;
      n.aliases = [n.password, ...pair.aliases[orientation]];
      const [d, i, j] = distribution[n.players.length]!;
      const roles = shuffled<Role>(
        [
          ...Array<Role>(d).fill('disciple'),
          ...Array<Role>(i).fill('infiltrator'),
          ...Array<Role>(j).fill('journalist'),
        ],
        draw,
      );
      n.roles = Object.fromEntries(n.players.map((p, i) => [p, roles[i]!]));
      if (n.mission === 0 && n.options.powers) {
        const deck = shuffled<Power>(powerDeck, draw);
        n.powers = Object.fromEntries(n.players.map((p, i) => [p, deck[i]!]));
      }
      Object.assign(n, freshMission());
      n.mission++;
      n.phase = 'volunteer';
      emit({ type: 'deal' });
    };
    const rpsRound = () => {
      n.phase = 'tie';
      n.rps = {};
      n.rpsId = `${n.mission}:${n.actionSequence}:rps`;
    };
    if (a.type === 'configure') {
      phase('setup');
      if (context?.hostId !== player || a.version !== s.setupVersion) fail();
      n.options = options(a.options, n.players.length);
      n.setupVersion++;
      n.ready = [];
    } else if (a.type === 'ready') {
      phase('setup');
      if (
        a.version !== s.setupVersion ||
        s.ready.includes(player) ||
        s.connectedPlayers.length !== s.players.length
      )
        fail();
      n.ready.push(player);
      if (n.ready.length === n.players.length) deal();
    } else if (a.type === 'volunteer') {
      phase('volunteer');
      if (a.mission !== s.mission) fail();
      cycle(
        n.players[
          (n.players.indexOf(player) + n.players.length - 1) % n.players.length
        ]!,
      );
    } else if (a.type === 'clue') {
      phase('clues');
      if (
        player !== s.speaker ||
        a.mission !== s.mission ||
        a.cycle !== s.cycle
      )
        fail();
      if (s.powers[player] !== 'mime') {
        if (
          typeof a.text !== 'string' ||
          !a.text.trim() ||
          a.text.trim().length > clueLength
        )
          fail();
        n.clues[player] = (a.text as string).trim();
      } else n.clues[player] = '';
      n.clueOrder.shift();
      n.speaker = n.clueOrder[0] ?? null;
      if (!n.speaker) n.phase = 'debate';
    } else if (a.type === 'openVote') {
      phase('debate');
      if (
        context?.hostId !== player ||
        a.mission !== s.mission ||
        a.cycle !== s.cycle
      )
        fail();
      n.phase = 'vote';
      n.ballots = {};
      n.ballotId = `${n.mission}:${n.cycle}:${n.actionSequence}:vote`;
      n.candidates = [];
    } else if (a.type === 'vote') {
      phase('vote');
      if (
        a.ballotId !== s.ballotId ||
        n.eliminated.includes(player) ||
        n.ballots[player]
      )
        fail();
      const target = livingTarget();
      if (target === player) fail();
      n.ballots[player] = target;
      if (Object.keys(n.ballots).length === alive().length) {
        const totals = Object.fromEntries(alive().map((p) => [p, 0]));
        for (const [v, t] of Object.entries(n.ballots))
          totals[t]! += n.powers[v] === 'dictator' ? 2 : 1;
        emit({ type: 'ballots', ballots: { ...n.ballots }, totals });
        const max = Math.max(...Object.values(totals));
        n.candidates = alive().filter((p) => totals[p] === max);
        if (n.candidates.length === 1) {
          n.origin = n.candidates[0]!;
          eliminate(n.origin);
        } else {
          const sage = alive().find((p) => n.powers[p] === 'sage');
          n.phase = 'tie';
          if (sage)
            n.prompt = {
              id: `${n.mission}:${n.actionSequence}:sage`,
              kind: 'sage',
              actor: sage,
            };
          else rpsRound();
        }
      }
    } else if (a.type === 'resolveTie') {
      phase('tie');
      prompt('sage');
      const target = livingTarget();
      if (!s.candidates.includes(target)) fail();
      n.prompt = null;
      n.origin = target;
      eliminate(target);
    } else if (a.type === 'rps') {
      phase('tie');
      if (
        s.prompt ||
        a.rpsId !== s.rpsId ||
        !s.candidates.includes(player) ||
        s.rps[player] ||
        !['rock', 'paper', 'scissors'].includes(a.symbol as string)
      )
        fail();
      n.rps[player] = a.symbol as Symbol;
      if (Object.keys(n.rps).length === n.candidates.length) {
        const symbols = new Set(Object.values(n.rps));
        const loses: Record<Symbol, Symbol> = {
          rock: 'paper',
          paper: 'scissors',
          scissors: 'rock',
        };
        const losers =
          symbols.size === 2
            ? n.candidates.filter((p) => symbols.has(loses[n.rps[p]!]))
            : [...n.candidates];
        emit({ type: 'rps', choices: { ...n.rps }, losers });
        n.candidates = losers;
        if (losers.length === 1) {
          n.origin = losers[0]!;
          eliminate(n.origin);
        } else rpsRound();
      }
    } else if (a.type === 'guess') {
      phase('reactions');
      prompt('journalist');
      if (
        typeof a.answer !== 'string' ||
        !a.answer.trim() ||
        a.answer.length > answerLength ||
        /[\p{Cc}\p{Cf}]/u.test(a.answer)
      )
        fail();
      const correct = n.aliases.some(
        (word) => normalize(word) === normalize(a.answer as string),
      );
      emit({ type: 'guess', player, correct });
      if (correct) finish(player);
      else aftermath();
    } else if (a.type === 'revenant') {
      phase('reactions');
      prompt('revenant');
      if (a.target === null) aftermath();
      else eliminate(livingTarget());
    } else if (a.type === 'continue') {
      phase('missionResult');
      if (a.mission !== s.mission || n.continued.includes(player)) fail();
      n.continued.push(player);
      if (n.continued.length === n.players.length) deal();
    } else fail();
    return n;
  }
  return {
    ...seats('little-secret'),
    create,
    apply,
    view,
    presence,
    isFinished: (s: State) => s.phase === 'finished',
  } satisfies GameDefinition<State, View>;
}
function view(s: State, player: string): View {
  if (!s.players.includes(player)) fail();
  const withheld =
    s.prompt?.actor === player || s.reactions.some((r) => r.actor === player);
  const solution =
    s.result || (s.eliminated.includes(player) && !withheld)
      ? {
          password: s.password,
          alternative: s.alternative,
          roles: { ...s.roles },
        }
      : null;
  // Explicit allowlist: never spread canonical state or include content identifiers.
  return structuredClone({
    public: {
      clues: { ...s.clues },
      players: s.players,
      connectedPlayers: s.connectedPlayers,
      options: s.options,
      setupVersion: s.setupVersion,
      ready: s.ready,
      phase: s.phase,
      scores: s.scores,
      mission: s.mission,
      cycle: s.cycle,
      speaker: s.speaker,
      powers: s.powers,
      eliminated: s.eliminated,
      revealed: s.revealed,
      prompt: s.prompt,
      ballotId: s.ballotId,
      rpsId: s.rpsId,
      candidates: s.candidates,
      committed: Object.keys(s.ballots),
      rpsCommitted: Object.keys(s.rps),
      continued: s.continued,
      result: s.result,
      actionSequence: s.actionSequence,
      events: s.events,
      history: s.history,
    },
    private: {
      password:
        s.phase === 'setup' || s.roles[player] === 'journalist'
          ? null
          : s.roles[player] === 'disciple'
            ? s.password
            : s.alternative,
      role: s.roles[player] === 'journalist' ? 'journalist' : null,
      ballot: s.ballots[player] ?? null,
      rps: s.rps[player] ?? null,
      solution,
    },
  });
}
