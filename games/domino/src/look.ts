import { read } from '@board-games/shared/ui';

/** The two ways to draw the same table: the three.js patio or the 8-bit one. */
export type Look = '3d' | 'pixel';
/** Phones: portrait up to 720px wide, or landscape up to 520px tall. */
export const COMPACT = '(max-width: 720px), (max-height: 520px)';
/** A player's saved choice, otherwise the home page theme. */
export function lookOf(): Look {
  const saved = read('domino:look');
  if (saved === '3d' || saved === 'pixel') return saved;
  return typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'pixel'
    ? 'pixel'
    : '3d';
}

/** The 8-bit table's characters, one per game seat, and every image it loads. */
export const CAST = ['luis', 'maria', 'carlos', 'roberto'];
export const PIXEL_ART = [
  'patio',
  'cat',
  ...CAST.flatMap((who) => [`${who}-front`, `${who}-side`]),
];
