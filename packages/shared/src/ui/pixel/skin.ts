import { read, write } from '../storage.js';

/** How a game table looks. `pixel` is the 8-bit skin. */
export type Skin = 'classic' | 'pixel';
const key = (game: string) => `board-games:skin:${game}`;

/** A per-game choice wins; otherwise follow the home theme (`html[data-theme]`). */
export function gameSkin(game: string): Skin {
  const saved = read(key(game));
  if (saved === 'classic' || saved === 'pixel') return saved;
  // Dominó saved its look as `domino:look` (`3d` is the classic table) before the shared key.
  const old = game === 'domino' ? read('domino:look') : null;
  if (old === '3d' || old === 'pixel') return old === '3d' ? 'classic' : old;
  return document.documentElement.dataset.theme === 'pixel'
    ? 'pixel'
    : 'classic';
}
export function setGameSkin(game: string, skin: Skin) {
  write(key(game), skin);
}
