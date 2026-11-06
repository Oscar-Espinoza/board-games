import type { Kind } from '../cards.js';

export type ScoreSeat = {
  id: string;
  name: string;
  score: number;
  color: string;
};
export type MenuTileData = {
  kind: Kind;
  title: string;
  rules: string[];
  color: string;
  accent: string;
};

/** Paper tint and accent of the original menu's tiles; other kinds derive theirs from `hues`. */
export const tileColors: Partial<
  Record<Kind, { color: string; accent: string }>
> = {
  nigiri: { color: '#f7eab1', accent: '#e5b753' },
  maki: { color: '#efbcb7', accent: '#d97578' },
  tempura: { color: '#d7c4df', accent: '#b992c2' },
  sashimi: { color: '#dce7ad', accent: '#a6bb66' },
  dumpling: { color: '#bee0d6', accent: '#89bbad' },
  chopsticks: { color: '#c5e4e4', accent: '#8bbec5' },
  wasabi: { color: '#f6e6a8', accent: '#d8b95b' },
  pudding: { color: '#f3bcb1', accent: '#d6877b' },
};
