/** What the live operative and the lab's guessers share when they judge a board. */
import type { Question } from '../jev.ts';
import type { ClueRef, PastClue } from './types.ts';

export function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((x, i) =>
    combinations(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]),
  );
}

/** Our earlier clues that found fewer of our words than their count. */
export const unfinishedClues = (
  history: PastClue[],
  isOurs: (word: string) => boolean,
): ClueRef[] =>
  history.flatMap((h, k) =>
    h.team === 'ours' && h.guessed.filter(isOurs).length < h.count
      ? [`history[${k}]`]
      : [],
  );

/** Question id for judging `board[word]` against clue number `clue` of `refs`. */
export const questionKey = (clue: number, word: number) => `r${clue}w${word}`;

/** One question per clue and board word. */
export const cardQuestions = (
  refs: ClueRef[],
  board: string[],
  question: (ref: ClueRef, word: number) => Question,
): Record<string, Question> =>
  Object.fromEntries(
    refs.flatMap((ref, r) =>
      board.map((_, i) => [questionKey(r, i), question(ref, i)]),
    ),
  );
