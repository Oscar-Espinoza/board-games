/** Guesser arms. Code owns the turn rules and stopping policy; Jev only judges words. */
import { ask, type Call, type Question } from '../jev.ts';
import {
  cardQuestions,
  combinations,
  questionKey,
  unfinishedClues,
} from './judging.ts';
import type { Prompt } from './prompts.ts';
import { shuffled, type Identity, type Scenario } from './scenarios.ts';
import type { ClueRef, View } from './types.ts';

export type Arm = 'noul' | 'choice' | 'set';
/** free: engine budget count+1 for the current clue. leftover: count for the clue, +1 only for an unfinished earlier clue. */
export type Bonus = 'free' | 'leftover';

export interface Judgment {
  step: number;
  ref: ClueRef;
  word: string;
  p: number;
  rank: number;
}

export interface Turn {
  guesses: { word: string; identity: Identity }[];
  stopped: 'miss' | 'budget' | 'judged' | 'exhausted';
  judgments: Judgment[];
  calls: Pick<Call, 'ms' | 'inputTokens' | 'model'>[];
}

/** How call 1 judges each card: a yes/no Noul, or a Score on ordered levels normalized to 0..1. */
export type Scorer = 'noul' | 'score';

export interface Options {
  prompt: Prompt;
  scorer: Scorer;
  bonus: Bonus;
  tau: number;
  /** The optional leftover guess needs this Noul: near 0.5 it is a coin flip. */
  bonusTau: number;
  /** Board order seed; change it to measure position bias. */
  order: string;
}

function view(s: Scenario, order: string, guessed: string[]): View {
  const hidden = new Set([...s.revealed, ...guessed]);
  const unrevealed = Object.keys(s.key).filter((w) => !hidden.has(w));
  return {
    lang: s.lang,
    clue: s.clue,
    board: shuffled(unrevealed, `${s.id}:${order}`),
    revealed: [...s.revealed, ...guessed].map((word) => ({
      word,
      identity: s.key[word] as 'ours' | 'theirs' | 'civilian',
    })),
    history: s.history,
    guessedThisTurn: guessed,
  };
}

const ranks = (step: number, ref: ClueRef, entries: [string, number][]) =>
  entries
    .sort((a, b) => b[1] - a[1])
    .map(([word, p], i): Judgment => ({ step, ref, word, p, rank: i + 1 }));

/** Mirrors the engine: first guess mandatory, any non-team card ends the turn. */
export async function play(s: Scenario, arm: Arm, o: Options): Promise<Turn> {
  const turn: Turn = {
    guesses: [],
    stopped: 'budget',
    judgments: [],
    calls: [],
  };
  const count = s.clue.count;
  const reveal = (word: string) => {
    const identity = s.key[word]!;
    turn.guesses.push({ word, identity });
    return identity === 'ours';
  };
  const send = async (state: unknown, questions: Record<string, Question>) => {
    const call = await ask(state, questions);
    turn.calls.push({
      ms: call.ms,
      inputTokens: call.inputTokens,
      model: call.model,
    });
    return call.answers;
  };
  const leftovers =
    o.bonus === 'leftover'
      ? unfinishedClues(s.history, (w) => s.key[w] === 'ours')
      : [];
  /** Set arm: one Choice over every `count`-word group from the Noul shortlist; the chosen group goes first. */
  const group = async (ranked: Judgment[]) => {
    const shortlist = ranked.slice(0, 6);
    const groups = combinations(
      shortlist.map((j) => j.word),
      count,
    );
    const v = view(s, o.order, []);
    const answers = await send(v, {
      group: o.prompt.group(
        v,
        groups.map((g) => g.join(' + ')),
      ),
    });
    const a = answers.group!;
    if (a.type !== 'choice') throw new Error('Expected a Choice answer');
    turn.judgments.push(...ranks(1, 'group', Object.entries(a.probabilities)));
    const chosen = a.choice.split(' + ');
    return [
      ...ranked.filter((j) => chosen.includes(j.word)),
      ...ranked.filter((j) => !chosen.includes(j.word)),
    ].map((j) => ({ ...j, p: chosen.includes(j.word) ? 1 : 0 }));
  };

  if (arm === 'noul' || arm === 'set') {
    const v = view(s, o.order, []);
    const refs = ['clue', ...leftovers];
    const questions = cardQuestions(refs, v.board, (ref, i) =>
      o.scorer === 'score' ? o.prompt.level(ref, i) : o.prompt.card(ref, i),
    );
    const answers = await send(v, questions);
    const judged = refs.map((ref, r) =>
      ranks(
        0,
        ref,
        v.board.map((w, i) => {
          const a = answers[questionKey(r, i)]!;
          if (a.type === 'noul') return [w, a.noul];
          if (a.type === 'score')
            return [w, a.score / (Object.keys(a.probabilities).length - 1)];
          throw new Error(`Unexpected ${a.type} answer`);
        }),
      ),
    );
    turn.judgments.push(...judged.flat());
    const [current, ...old] = judged;
    const budget = o.bonus === 'free' ? count + 1 : count;
    const order = arm === 'set' && count > 1 ? await group(current!) : current!;
    for (const [i, j] of order.entries()) {
      if (i >= budget) break;
      if (i > 0 && j.p < o.tau) return { ...turn, stopped: 'judged' };
      if (!reveal(j.word)) return { ...turn, stopped: 'miss' };
    }
    const guessed = new Set(turn.guesses.map((g) => g.word));
    const best = old
      .flat()
      .filter((j) => !guessed.has(j.word))
      .sort((a, b) => b.p - a.p)[0];
    if (!best) return turn;
    if (best.p < o.bonusTau) return { ...turn, stopped: 'judged' };
    return reveal(best.word) ? turn : { ...turn, stopped: 'miss' };
  }

  const steps: ClueRef[] =
    o.bonus === 'free'
      ? Array(count + 1).fill('clue')
      : [...Array(count).fill('clue'), ...leftovers.slice(0, 1)];
  for (const [step, ref] of steps.entries()) {
    const v = view(
      s,
      o.order,
      turn.guesses.map((g) => g.word),
    );
    if (!v.board.length) return { ...turn, stopped: 'exhausted' };
    const answers = await send(v, {
      guess: o.prompt.pick(v, ref, step > 0),
    });
    const a = answers.guess!;
    if (a.type !== 'choice') throw new Error('Expected a Choice answer');
    turn.judgments.push(...ranks(step, ref, Object.entries(a.probabilities)));
    if (a.choice === 'stop') return { ...turn, stopped: 'judged' };
    if (!v.board.includes(a.choice))
      throw new Error(`Illegal choice ${a.choice}`);
    if (!reveal(a.choice)) return { ...turn, stopped: 'miss' };
  }
  return turn;
}
