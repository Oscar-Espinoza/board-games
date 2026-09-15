import type { Locale } from '@board-games/shared/runtime';
import { t, hues } from '../labels.js';
import type { Menu } from '../menus.js';
import { menu as materials, type MenuTileData } from './data.js';

export const pawnColors = [
  '#4dba90',
  '#35b6e8',
  '#ed8eac',
  '#ef6863',
  '#b98bd2',
  '#e9b640',
  '#e89458',
  '#7389c7',
];

export function tableMenu(
  menu: Menu,
  count: number,
  locale: Locale,
): MenuTileData[] {
  // The approved Original menu keeps its visual order; other menus use the same slots.
  return [
    'nigiri',
    menu.roll,
    ...menu.appetizers,
    ...menu.specials,
    menu.dessert,
  ].map((kind) => {
    const material = materials.find((tile) => tile.kind === kind);
    const suffix =
      kind === 'maki' && count >= 6
        ? '_large'
        : count === 2 && (kind === 'pudding' || kind === 'temaki')
          ? '_two'
          : '';
    return {
      kind,
      title: t(kind, {}, locale),
      rules: t('tile_' + kind + suffix, {}, locale).split('|'),
      color:
        material?.color ?? `color-mix(in srgb, ${hues[kind]} 42%, #fff7df)`,
      accent: material?.accent ?? hues[kind],
    } as MenuTileData;
  });
}

/** Clockwise relative to the local bottom seat. Dimensions are 1440×900 design pixels. */
export function desktopSeats(count: number) {
  const left = { x: 8, y: 213, w: 293, h: 226, top: false };
  const top = { x: 485, y: -26, w: 470, h: 159, top: true };
  const right = { x: 1131, y: 213, w: 293, h: 226, top: false };
  const lowerRight = { x: 1144, y: 547, w: 280, h: 207, top: false };
  const lowerLeft = { x: 8, y: 467, w: 293, h: 183, top: false };
  if (count === 1) return [top];
  if (count === 2) return [left, right];
  if (count <= 4) return [left, top, right, lowerRight].slice(0, count);
  if (count === 5) return [lowerLeft, left, top, right, lowerRight];
  const topCount = count - 4;
  return [
    lowerLeft,
    left,
    ...Array.from({ length: topCount }, (_, i) => ({
      x: 306 + i * (820 / topCount),
      y: -3,
      w: 820 / topCount - 10,
      h: 148,
      top: true,
    })),
    right,
    lowerRight,
  ];
}
