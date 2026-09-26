/** Live Jev operative, the lab's best setup: Noul per card (v2) → group Choice over the top 6,
 * never past the clue's count, plus one leftover guess only when its Noul is at least 0.8.
 * Situations (below) can override that caution when the score makes waiting a likely loss. */
import { ask, usdPerToken } from '../jev.ts';
import { prompts, type View } from './prompts.ts';

/** Public score: agents each team still has to find. */
export interface Score {
  ours: number;
  theirs: number;
}

export interface Plan {
  /** Words to guess in order; the caller stops at the first miss and then ends the turn. */
  guesses: string[];
  /** The situation that changed the normal policy, if any. */
  situation: Situation['id'] | null;
  usd: number;
  ms: number;
}

interface Context {
  score: Score;
  /** The clue's number; 0 for 0 or unlimited. */
  count: number;
  /** Guesses the rules allow this turn (Infinity for 0 / unlimited). */
  budget: number;
}

/** A game state where the normal, careful policy loses more often than a gamble.
 * Add new ones here; the first that applies wins. */
interface Situation {
  id: 'last-chance';
  applies(c: Context): boolean;
  /** Minimum Noul for guesses beyond the clue's own words. */
  extraTau: number;
  /** Use every guess the rules allow instead of stopping at the clue's number. */
  useFullBudget: boolean;
}

const situations: Situation[] = [
  {
    // The opponent needs one agent: after this turn they very likely win.
    // If the careful guesses cannot finish our team, gamble on the best remaining words;
    // hitting the assassin loses, but so does stopping.
    id: 'last-chance',
    applies: (c) => c.score.theirs <= 1 && c.score.ours > (c.count || 1),
    extraTau: 0,
    useFullBudget: true,
  },
];

/** Chosen before a match. The first guess is always the best word; these only change
 * how sure Jev must be to keep going. */
export type Personality = 'conservative' | 'normal' | 'risky';
const personalities: Record<
  Personality,
  {
    /** Minimum Noul for guesses after the first within the clue's number (0 = trust the group). */
    next: number;
    /** Minimum Noul for the one extra guess beyond the clue's number. */
    extra: number;
    /** Where that extra guess may come from. */
    extraFrom: 'leftover' | 'any';
  }
> = {
  conservative: { next: 0.95, extra: 0.95, extraFrom: 'leftover' },
  normal: { next: 0, extra: 0.8, extraFrom: 'leftover' },
  risky: { next: 0, extra: 0.7, extraFrom: 'any' },
};

const prompt = prompts.v2!;

/** Codenames bounds (games/codenames): 25 cards, clues of at most 80 graphemes (≤ 320 UTF-16 units here) counting 0–9,
 * and every turn reveals a card, so board + revealed and board + past clues stay within 25. */
const cards = 25;
const text = (x: unknown) =>
  typeof x === 'string' && x.length > 0 && x.length <= 320;
const words = (x: unknown) =>
  Array.isArray(x) && x.length <= cards && x.every(text);
const number = (x: unknown) =>
  typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 9;

/** Guards the HTTP route: a view a real game can produce, rebuilt so extra fields never reach Jev. */
export function parseView(x: unknown): View | null {
  const v = x as View;
  const valid =
    !!v &&
    (v.lang === 'en' || v.lang === 'es') &&
    text(v.clue?.word) &&
    number(v.clue.count) &&
    words(v.board) &&
    v.board.length > 0 &&
    Array.isArray(v.revealed) &&
    v.board.length + v.revealed.length <= cards &&
    v.revealed.every(
      (r) =>
        text(r?.word) && ['ours', 'theirs', 'civilian'].includes(r.identity),
    ) &&
    Array.isArray(v.history) &&
    v.board.length + v.history.length <= cards &&
    v.history.every(
      (h) =>
        (h?.team === 'ours' || h?.team === 'theirs') &&
        text(h.word) &&
        number(h.count) &&
        words(h.guessed),
    ) &&
    v.history.reduce((n, h) => n + h.guessed.length, 0) <= cards &&
    words(v.guessedThisTurn);
  return valid
    ? {
        lang: v.lang,
        clue: { word: v.clue.word, count: v.clue.count },
        board: v.board,
        revealed: v.revealed.map(({ word, identity }) => ({ word, identity })),
        history: v.history.map(({ team, word, count, guessed }) => ({
          team,
          word,
          count,
          guessed,
        })),
        guessedThisTurn: v.guessedThisTurn,
      }
    : null;
}

/** Board × clues peaks at 13 × 13 for a valid view; anything larger is not a real game. */
const maxQuestions = 169;
/** Server callers waiting for a Jev slot; more are refused instead of queued. */
const queue = 16;

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) =>
    combinations(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]),
  );
}

/** `view.clue.count` 0 or unlimited plays as "the best word, then only words the personality trusts". */
export async function plan(
  view: View,
  unlimited = false,
  score?: Score,
  personality: Personality = 'normal',
  signal?: AbortSignal,
): Promise<Plan> {
  const style = personalities[personality];
  const started = performance.now();
  let tokens = 0;
  const identity = new Map(view.revealed.map((r) => [r.word, r.identity]));
  const leftovers = view.history.flatMap((h, k) =>
    h.team === 'ours' &&
    h.guessed.filter((w) => identity.get(w) === 'ours').length < h.count
      ? [`history[${k}]`]
      : [],
  );
  const refs = ['clue', ...leftovers];
  if (refs.length * view.board.length > maxQuestions)
    throw new Error('Too many questions');
  const first = await ask(
    view,
    Object.fromEntries(
      refs.flatMap((ref, r) =>
        view.board.map((_, i) => [`r${r}w${i}`, prompt.card(ref, i)]),
      ),
    ),
    { queue, signal },
  );
  tokens += first.inputTokens;
  const scores = refs.map((_, r) =>
    view.board
      .map((word, i) => {
        const a = first.answers[`r${r}w${i}`]!;
        if (a.type !== 'noul') throw new Error('Expected a Noul answer');
        return { word, p: a.noul };
      })
      .sort((a, b) => b.p - a.p),
  );
  const ranked = scores[0]!;

  let guesses: string[];
  const count = unlimited ? 0 : view.clue.count;
  if (count === 0)
    guesses = [
      ranked[0]!.word,
      ...ranked
        .slice(1)
        .filter((c) => c.p >= style.extra)
        .map((c) => c.word),
    ];
  else if (count === 1 || count > 4)
    guesses = ranked.slice(0, count).map((c) => c.word);
  else {
    const groups = combinations(
      ranked.slice(0, 6).map((c) => c.word),
      count,
    ).map((g) => g.join(' + '));
    const second = await ask(
      view,
      { group: prompt.group(view, groups) },
      { queue, signal },
    );
    tokens += second.inputTokens;
    const a = second.answers.group!;
    if (a.type !== 'choice') throw new Error('Expected a Choice answer');
    const chosen = a.choice.split(' + ');
    guesses = ranked.filter((c) => chosen.includes(c.word)).map((c) => c.word);
  }

  // Later guesses stop at the first word the personality isn't sure enough about.
  const p = new Map(ranked.map((c) => [c.word, c.p]));
  const cut = guesses.findIndex(
    (w, i) => i > 0 && (p.get(w) ?? 0) < style.next,
  );
  if (cut > 0) guesses = guesses.slice(0, cut);

  // Every remaining word, scored by whichever of our clues (current or leftover) fits it best.
  const best = new Map<string, number>();
  for (const c of scores.flat())
    best.set(c.word, Math.max(best.get(c.word) ?? 0, c.p));
  const extras = [...best]
    .filter(([word]) => !guesses.includes(word))
    .sort((a, b) => b[1] - a[1]);

  const context: Context = {
    score: score ?? { ours: Infinity, theirs: Infinity },
    count,
    budget: count === 0 ? Infinity : count + 1,
  };
  const situation = score
    ? (situations.find((s) => s.applies(context)) ?? null)
    : null;
  if (situation?.useFullBudget) {
    // Never guess more than the agents we still need: the last one wins the game.
    const room = Math.min(context.budget, context.score.ours) - guesses.length;
    guesses.push(
      ...extras
        .filter(([, p]) => p >= situation.extraTau)
        .slice(0, Math.max(0, room))
        .map(([word]) => word),
    );
  } else if (
    count > 0 &&
    guesses.length === Math.min(count, view.board.length)
  ) {
    // One extra guess (the rules allow count + 1) when the personality trusts it.
    const pool = style.extraFrom === 'any' ? scores : scores.slice(1);
    const bonus = pool
      .flat()
      .filter((c) => !guesses.includes(c.word))
      .sort((a, b) => b.p - a.p)[0];
    if (bonus && bonus.p >= style.extra) guesses.push(bonus.word);
  }
  return {
    guesses,
    situation: situation?.id ?? null,
    usd: tokens * usdPerToken,
    ms: performance.now() - started,
  };
}
