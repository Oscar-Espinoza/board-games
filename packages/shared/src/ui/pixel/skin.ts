import { read, write } from '../storage.js';

/** How a game table looks. `pixel` is the 8-bit skin. */
export type Skin = 'classic' | 'pixel';
const key = (game: string) => `board-games:skin:${game}`;

/** A per-game choice wins; otherwise follow the home theme (`html[data-theme]`). */
export function gameSkin(game: string): Skin {
  const saved = read(key(game));
  if (saved === 'classic' || saved === 'pixel') return saved;
  return document.documentElement.dataset.theme === 'pixel'
    ? 'pixel'
    : 'classic';
}
export function setGameSkin(game: string, skin: Skin) {
  write(key(game), skin);
}
