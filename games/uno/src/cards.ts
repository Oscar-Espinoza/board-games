export const colors = ['red', 'yellow', 'green', 'blue'] as const;
export type Color = (typeof colors)[number];
/** In 8-bit glyph-sheet column order: digits first, then the icons. */
export const cardSymbols = [
  ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  ...['skip', 'reverse', '+2', '+4', 'wild'],
] as const;
export type CardSymbol = (typeof cardSymbols)[number];
export type Card = { id: number; color: Color | null; symbol: CardSymbol };

/** Per colour: one 0, two of every other digit, two each of skip, reverse and +2. */
const colorCards: CardSymbol[] = [
  '0',
  ...(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).flatMap((s) => [
    s,
    s,
  ]),
  ...(['skip', 'reverse', '+2'] as const).flatMap((s) => [s, s]),
];

/** 108 cards: ids run colour by colour, then four wilds, then four +4. */
export function deck(): Card[] {
  const cards: Card[] = colors.flatMap((color, c) =>
    colorCards.map((symbol, i) => ({
      id: c * colorCards.length + i,
      color,
      symbol,
    })),
  );
  for (const symbol of ['wild', '+4'] as const)
    for (let i = 0; i < 4; i++)
      cards.push({ id: cards.length, color: null, symbol });
  return cards;
}
