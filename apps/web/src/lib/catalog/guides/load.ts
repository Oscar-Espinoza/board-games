import type { GameId } from '../types';
export const guideLoaders = {
  azul: () => import('./azul'),
  codenames: () => import('./codenames'),
  uno: () => import('./uno'),
  catan: () => import('./catan'),
  carcassonne: () => import('./carcassonne'),
} satisfies Record<GameId, () => Promise<unknown>>;
