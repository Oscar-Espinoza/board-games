/** Versioned Jev request builders. A version changes wording or state layout, never the game rules. */
import type { Question } from '../jev.ts';
import type { ClueRef, View } from './types.ts';

export interface Prompt {
  card(ref: ClueRef, i: number): Question;
  /** On ordered levels, low to high. */
  level(ref: ClueRef, i: number): Question;
  /** A Choice over unrevealed words, plus `stop` when stopping is legal. */
  pick(view: View, ref: ClueRef, canStop: boolean): Question;
  /** A Choice over candidate groups of `clue.count` words, each option like `apple + cherry`. */
  group(view: View, groups: string[]): Question;
}

const options = (view: View, canStop: boolean, stop: string) => {
  const criteria: Record<string, unknown> = Object.fromEntries(
    view.board.map((w) => [w, null]),
  );
  if (canStop) criteria.stop = stop;
  return criteria;
};

const group = (_view: View, groups: string[]): Question => ({
  type: 'choice',
  instructions:
    'Our spymaster chose the clue `clue.word` to lead us to exactly `clue.count` of our words at once. Which group of words did they mean? Prefer the group where the clue is a direct hint for every word in it.',
  criteria: Object.fromEntries(groups.map((g) => [g, null])),
});

/** Levels mirror v2's Noul criteria, split into concrete situations. */
const level = (ref: ClueRef, i: number): Question => ({
  type: 'score',
  instructions: `How directly does the clue \`${ref}.word\` hint at \`board[${i}]\`?`,
  criteria: [
    'No connection: the clue would not bring this word to mind.',
    'Loose link: same general topic or scene, or connected only through another word.',
    'Plausible hint: a reasonable reading of the clue fits this word, but it is not the obvious one.',
    'Direct hint: a kind, part, use or famous pairing of the word, or a common compound or phrase with it (star + fish = starfish).',
  ],
});

const v1: Prompt = {
  group,
  level,
  card: (ref, i) => ({
    type: 'noul',
    instructions: `Does the clue \`${ref}.word\` point to \`board[${i}]\`?`,
    criteria: {
      true: 'The clue is semantically related by meaning, association, or common phrase.',
      false: 'No particular relationship.',
    },
  }),
  pick: (view, ref, canStop) => ({
    type: 'choice',
    instructions: `Our spymaster gave the clue \`${ref}.word\` for \`${ref}.count\` of our words in \`board\`. Which board word does the clue most likely point to?`,
    criteria: options(
      view,
      canStop,
      'No remaining word fits the clue well enough to risk a guess.',
    ),
  }),
};

/** Round 2: ask for the spymaster's intent, not relatedness, and name compound and phrase hints. */
const hint =
  'a kind, part, use or famous pairing of the word, or a common compound or phrase with it (star + fish = starfish)';
const v2: Prompt = {
  group,
  level,
  card: (ref, i) => ({
    type: 'noul',
    instructions: `Is \`board[${i}]\` one of the words our spymaster meant with the clue \`${ref}.word\`?`,
    criteria: {
      true: `The clue is a natural, direct hint for this word: ${hint}.`,
      false:
        'The word is only loosely related, shares a general topic or scene, or connects only through another word.',
    },
  }),
  pick: (view, ref, canStop) => ({
    type: 'choice',
    instructions: `Our spymaster chose the clue \`${ref}.word\` to lead us to \`${ref}.count\` of our words in \`board\`. Which word did they most likely mean? Spymasters hint with ${hint}, not a loose topic.`,
    criteria: options(
      view,
      canStop,
      'No remaining word fits the clue well enough to risk a guess.',
    ),
  }),
};

export const prompts: Record<string, Prompt> = { v1, v2 };
