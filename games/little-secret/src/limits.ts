/** The six public powers, plus Adept (no ability), in dealing order. */
export const powers = [
  'mime',
  'novice',
  'elder',
  'sage',
  'revenant',
  'dictator',
  'adept',
] as const;
/** A power deck deals one of each and two more Adepts, so six players get no repeats. */
export const powerDeck = [...powers, 'adept', 'adept'] as const;
/** Fewest players for the optional powers. */
export const powersFrom = 6;
/** Longest clue and journalist guess, in characters. */
export const clueLength = 80;
export const answerLength = 120;
/** A match ends when someone reaches this score. */
export const winningScore = 5;
