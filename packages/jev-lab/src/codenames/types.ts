export interface PastClue {
  team: 'ours' | 'theirs';
  word: string;
  count: number;
  guessed: string[];
}

/** Public information only: exactly what a human operative could see. */
export interface View {
  lang: 'en' | 'es';
  clue: { word: string; count: number };
  /** Unrevealed words in display order. */
  board: string[];
  revealed: { word: string; identity: 'ours' | 'theirs' | 'civilian' }[];
  history: PastClue[];
  guessedThisTurn: string[];
}

/** State path of the clue being judged: `clue` now, or `history[k]` for an earlier clue of ours. */
export type ClueRef = string;
