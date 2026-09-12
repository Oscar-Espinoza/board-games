import type { ComponentProps } from 'svelte';
import type Dish from '@board-games/sushi-go-party/Dish.svelte';
type Face = ComponentProps<typeof Dish>['card'];
// Authored examples: each illustrated tile represents one card, never one food piece.
type Tile = Pick<Face, 'kind' | 'variant'> & { boxed?: boolean; mark?: string };
type Plate = { cards: Tile[]; result?: string };
export type Frame = { plates: Plate[]; equation: string };
const card = (kind: Face['kind'], variant = '', mark?: string): Tile => ({
  kind,
  variant,
  mark,
});
const copies = (kind: Face['kind'], n: number, variant = '') =>
  Array.from({ length: n }, () => card(kind, variant));
const plate = (cards: Tile[], result?: string): Plate => ({ cards, result });
const frame = (equation: string, ...plates: Plate[]): Frame => ({
  plates,
  equation,
});
const set = (
  kind: Face['kind'],
  quantities: [number, number, number],
  scores: [number, number, number],
): [Frame, Frame, Frame] =>
  quantities.map((n, i) =>
    frame(`${n} → ${scores[i]}`, plate(copies(kind, n), `${scores[i]}`)),
  ) as [Frame, Frame, Frame];
const nigiri = card('nigiri', 'salmon', '2');
const tempura = card('tempura');
const spoon = card('spoon', '', '4');
const chopsticks = card('chopsticks', '', '1');
const order = card('special_order');
const wasabi = card('wasabi', '', '×3');
const box = { ...card('eel'), boxed: true };
export const sushiScenes: Record<string, [Frame, Frame, Frame]> = {
  draft: [
    frame('3 → 1', plate([nigiri, tempura, card('tea')])),
    frame('✓ + ✓ → ↥', plate([nigiri], '✓'), plate([tempura], '✓')),
    frame(
      'A → B → C → A',
      plate([tempura, card('tea')], 'A → B'),
      plate([nigiri], '✓'),
    ),
  ],
  nigiri: [
    frame('1', plate([card('nigiri', 'egg', '1')], '1')),
    frame('1 + 2', plate([card('nigiri', 'egg', '1'), nigiri], '3')),
    frame(
      '1 + 2 + 3 = 6',
      plate(
        [card('nigiri', 'egg', '1'), nigiri, card('nigiri', 'squid', '3')],
        '6',
      ),
    ),
  ],
  maki: [
    frame(
      'A: 3 · B: 2 · C: 1',
      plate([card('maki', '3', '3')], 'A'),
      plate([card('maki', '2', '2')], 'B'),
      plate([card('maki', '1', '1')], 'C'),
    ),
    frame(
      'A: 3 = B: 3 > C: 1',
      plate([card('maki', '3', '3')], 'A'),
      plate([card('maki', '2', '2'), card('maki', '1', '1')], 'B'),
      plate([card('maki', '1', '1')], 'C'),
    ),
    frame(
      'A +6 · B +6 · C +3',
      plate([card('maki', '3', '3')], '+6'),
      plate([card('maki', '2', '2'), card('maki', '1', '1')], '+6'),
      plate([card('maki', '1', '1')], '+3'),
    ),
  ],
  temaki: [
    frame(
      'A: 2 · B: 1 · C: 0',
      plate(copies('temaki', 2), 'A'),
      plate(copies('temaki', 1), 'B'),
      plate([], 'C'),
    ),
    frame(
      '2 > 1 > 0',
      plate(copies('temaki', 2), '+4'),
      plate(copies('temaki', 1), '0'),
      plate([], '−4'),
    ),
    frame(
      'A +4 · B 0 · C −4',
      plate(copies('temaki', 2), '+4'),
      plate(copies('temaki', 1), '0'),
      plate([], '−4'),
    ),
  ],
  uramaki: [
    frame(
      'A: 7 · B: 7',
      plate([card('uramaki', '3', '3'), card('uramaki', '4', '4')], 'A'),
      plate([card('uramaki', '3', '3'), card('uramaki', '4', '4')], 'B'),
    ),
    frame(
      '7 + 3 = 10 · 7 + 3 = 10',
      plate(
        [
          card('uramaki', '3', '3'),
          card('uramaki', '4', '4'),
          card('uramaki', '3', '+3'),
        ],
        'A',
      ),
      plate(
        [
          card('uramaki', '3', '3'),
          card('uramaki', '4', '4'),
          card('uramaki', '3', '+3'),
        ],
        'B',
      ),
    ),
    frame(
      'A +8 · B +8 · ③ +2',
      plate([], 'A +8'),
      plate([], 'B +8'),
      plate([card('uramaki', '5', '5'), card('uramaki', '5', '5')], '+2'),
    ),
  ],
  tempura: set('tempura', [1, 2, 3], [0, 5, 5]),
  sashimi: set('sashimi', [2, 3, 4], [0, 10, 10]),
  dumpling: set('dumpling', [3, 4, 5], [6, 10, 15]),
  eel: set('eel', [1, 2, 3], [-3, 7, 7]),
  tofu: set('tofu', [1, 2, 3], [2, 6, 0]),
  onigiri: [
    frame(
      '2² = 4',
      plate([card('onigiri', 'circle'), card('onigiri', 'triangle')], '4'),
    ),
    frame(
      '4² = 16',
      plate(
        ['circle', 'triangle', 'square', 'rectangle'].map((v) =>
          card('onigiri', v),
        ),
        '16',
      ),
    ),
    frame(
      '4² + 1² = 17',
      plate(
        ['circle', 'triangle', 'square', 'rectangle'].map((v) =>
          card('onigiri', v),
        ),
        '16',
      ),
      plate([card('onigiri', 'circle')], '+1'),
    ),
  ],
  edamame: [
    frame(
      'A: 2 · B: 1 · C: 1',
      plate(copies('edamame', 2), 'A'),
      plate(copies('edamame', 1), 'B'),
      plate(copies('edamame', 1), 'C'),
    ),
    frame(
      '2 × 2 = 4',
      plate(copies('edamame', 2), '4'),
      plate(copies('edamame', 1), 'B ✓'),
      plate(copies('edamame', 1), 'C ✓'),
    ),
    frame(
      '2 × 4 = 8',
      plate(copies('edamame', 2), '8'),
      ...['B', 'C', 'D', 'E', 'F'].map((x) => plate(copies('edamame', 1), x)),
    ),
  ],
  miso: [
    frame('A → +3', plate(copies('miso', 1), 'A +3')),
    frame(
      'A + B → 0',
      plate(copies('miso', 1), 'A ×'),
      plate(copies('miso', 1), 'B ×'),
    ),
    frame(
      'A + B + C → 0',
      plate(copies('miso', 1), 'A ×'),
      plate(copies('miso', 1), 'B ×'),
      plate(copies('miso', 1), 'C ×'),
    ),
  ],
  chopsticks: [
    frame(
      '①',
      plate([chopsticks], '①'),
      plate([nigiri, tempura, card('tea')], '②'),
    ),
    frame(
      '1 + 1',
      plate([chopsticks, nigiri, tempura], '✓'),
      plate([card('tea')]),
    ),
    frame(
      '↔',
      plate([nigiri, tempura], '✓'),
      plate([card('tea'), chopsticks], '→'),
    ),
  ],
  spoon: [
    frame(
      'A → B → C',
      plate([spoon], 'A'),
      plate([tempura], 'B'),
      plate([nigiri, card('nigiri', 'egg', '1')], 'C'),
    ),
    frame(
      'A: Nigiri → C',
      plate([spoon], 'A'),
      plate([tempura], 'B ×'),
      plate([nigiri, card('nigiri', 'egg', '1')], 'C ✓'),
    ),
    frame(
      'A ← 2 · C ← ④',
      plate([nigiri], 'A'),
      plate([tempura], 'B'),
      plate([card('nigiri', 'egg', '1'), spoon], 'C'),
    ),
  ],
  menu: [
    frame(
      '④ → ?',
      plate([card('menu', '', '7')]),
      plate([nigiri, tempura, card('menu', '', '8'), card('tea')]),
    ),
    frame(
      '1 ✓ · Menu ×',
      plate([nigiri], '✓'),
      plate([tempura, card('menu', '', '8'), card('tea')], '↶'),
    ),
    frame(
      '1 + 3 = 4',
      plate([nigiri], '+2'),
      plate([tempura, card('menu', '', '8'), card('tea')], '↻'),
    ),
  ],
  special_order: [
    frame('1 → 0', plate([tempura]), plate([order])),
    frame('1 + 1', plate([tempura, { ...tempura, mark: '✦' }])),
    frame('2 → 5', plate([tempura, { ...tempura, mark: '✦' }], '5')),
  ],
  takeout: [
    frame('1 → −3', plate(copies('eel', 1), '−3'), plate([card('takeout')])),
    frame('↶', plate([box], '+2')),
    frame('−3 → +2', plate([box], '+2')),
  ],
  wasabi: [
    frame('×3 → 0', plate([wasabi], '0')),
    frame('2 × 3', plate([wasabi, nigiri], '↳')),
    frame('2 × 3 = 6', plate([wasabi, nigiri], '6')),
  ],
  tea: [
    frame(
      '3 · 2 · 1',
      plate([wasabi, nigiri, card('nigiri', 'egg')], '3'),
      plate(copies('tempura', 2), '2'),
      plate([card('tea')], '1'),
    ),
    frame(
      'max(3, 2, 1) = 3',
      plate([wasabi, nigiri, card('nigiri', 'egg')], '3'),
      plate([card('tea')], '×1'),
    ),
    frame(
      '1 × 3 = 3',
      plate([card('tea')], '+3'),
      plate([wasabi, nigiri, card('nigiri', 'egg')], '3'),
    ),
  ],
  soy: [
    frame(
      'A: 4 · B: 3',
      plate([card('soy'), nigiri, tempura, card('tea')], 'A'),
      plate([nigiri, tempura, card('tea')], 'B'),
    ),
    frame(
      '4 > 3',
      plate([card('soy'), nigiri, tempura, card('tea')], '4'),
      plate([nigiri, tempura, card('tea')], '3'),
    ),
    frame(
      '2 × 4 = 8',
      plate([card('soy'), card('soy'), nigiri, tempura, card('tea')], '+8'),
      plate([nigiri, tempura, card('tea')], '3'),
    ),
  ],
  pudding: [
    frame(
      '① → ② → ③',
      plate(copies('pudding', 2), 'A'),
      plate(copies('pudding', 1), 'B'),
      plate([], 'C'),
    ),
    frame(
      'A: 2 · B: 1 · C: 0',
      plate(copies('pudding', 2), 'A'),
      plate(copies('pudding', 1), 'B'),
      plate([], 'C'),
    ),
    frame(
      'A +6 · B 0 · C −6',
      plate(copies('pudding', 2), '+6'),
      plate(copies('pudding', 1), '0'),
      plate([], '−6'),
    ),
  ],
  ice_cream: set('ice_cream', [3, 4, 5], [0, 12, 12]),
  fruit: [
    frame('2 · 0 · 0', plate([card('fruit', '200')], '1 − 2 − 2 = −3')),
    frame(
      '2 · 1 · 1',
      plate([card('fruit', '200'), card('fruit', '011')], '1 + 0 + 0 = 1'),
    ),
    frame(
      '4 · 1 · 1',
      plate(
        [card('fruit', '200'), card('fruit', '200'), card('fruit', '011')],
        '6 + 0 + 0 = 6',
      ),
    ),
  ],
  advanced: [
    frame('④ < ⑦', plate([spoon], 'A'), plate([card('menu', '', '7')], 'B')),
    frame('④ → ⑦', plate([nigiri], 'A'), plate([card('menu', '', '7')], 'B')),
    frame('✓ → ✓ → ↻', plate([nigiri], 'A'), plate([tempura], 'B')),
  ],
  conventions: [
    frame(
      'C1 · ✦ → ①',
      plate([chopsticks, { ...chopsticks, mark: '✦' }, nigiri]),
    ),
    frame(
      'C1 · ① → ✦',
      plate([chopsticks, nigiri, tempura], '✓'),
      plate([order], '→'),
    ),
    frame(
      'C3 · 2 × 3 → 2 + 2',
      plate([{ ...wasabi, boxed: true }, nigiri], '4'),
    ),
  ],
};
