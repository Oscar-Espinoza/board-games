import type { Face } from '../cards.js';

/** Cells of `static/games/sushi-go-party/pixel/dishes.webp`: 64×64 sprites, 8 per row. */
export const dishSheet = {
  url: '/games/sushi-go-party/pixel/dishes.webp',
  cols: 8,
  rows: 5,
};
export const dishCells = [
  'nigiri-egg',
  'nigiri-salmon',
  'nigiri-squid',
  'maki',
  'temaki',
  'uramaki',
  'tempura',
  'sashimi',
  'dumpling',
  'eel',
  'tofu',
  'edamame',
  'miso',
  'onigiri-circle',
  'onigiri-triangle',
  'onigiri-square',
  'onigiri-rectangle',
  'wasabi',
  'chopsticks',
  'spoon',
  'menu',
  'special_order',
  'takeout',
  'soy',
  'tea',
  'boxed',
  'emblem',
  'pudding',
  'ice_cream',
  'watermelon',
  'orange',
  'pineapple',
  'plate',
  'roe',
  'tamago',
  'shrimp',
] as const;
export type DishSprite = (typeof dishCells)[number];

/** Table props in `props.webp`: 64×64 sprites, 3 per row. */
export const propSheet = {
  url: '/games/sushi-go-party/pixel/props.webp',
  cols: 3,
  rows: 3,
};
export const propCells = [
  'bonsai',
  'lucky-cat',
  'teapot',
  'lantern',
  'chopstick-rest',
  'geta',
  'bamboo',
  'mat',
  'soy-dish',
] as const;
export type PropSprite = (typeof propCells)[number];

export function cellStyle(
  sheet: { url: string; cols: number; rows: number },
  index: number,
) {
  const x = index % sheet.cols,
    y = Math.floor(index / sheet.cols);
  return `background-image:url(${sheet.url});background-size:${sheet.cols * 100}% ${sheet.rows * 100}%;background-position:${(x / (sheet.cols - 1)) * 100}% ${(y / (sheet.rows - 1)) * 100}%`;
}

const fruits = ['watermelon', 'orange', 'pineapple'] as const;

/** The pieces drawn for a card face: counts show as more pieces where it helps. */
export function dishPieces(
  card: Pick<Face, 'kind' | 'variant'>,
  trio = false,
  boxed = false,
): DishSprite[] {
  if (boxed) return ['boxed'];
  const { kind, variant } = card;
  if (kind === 'nigiri')
    return trio
      ? ['nigiri-egg', 'nigiri-salmon', 'nigiri-squid']
      : [
          (['egg', 'salmon', 'squid'].includes(variant)
            ? `nigiri-${variant}`
            : 'nigiri-salmon') as DishSprite,
        ];
  if (kind === 'onigiri')
    return trio
      ? ['onigiri-circle', 'onigiri-triangle', 'onigiri-square']
      : [
          (['circle', 'triangle', 'square', 'rectangle'].includes(variant)
            ? `onigiri-${variant}`
            : 'onigiri-triangle') as DishSprite,
        ];
  if (kind === 'maki') {
    const n = Number(variant);
    return Array(n >= 1 && n <= 3 ? n : trio ? 3 : 2).fill('maki');
  }
  if (kind === 'uramaki') return ['uramaki', 'uramaki'];
  if (kind === 'fruit') {
    if (!/^[012]{3}$/.test(variant)) return [...fruits];
    return variant
      .split('')
      .flatMap((n, i) => Array<DishSprite>(Number(n)).fill(fruits[i]));
  }
  return [kind as DishSprite];
}
