import type { GameId } from '../types';
export const guideLoaders = {
  uno: () => import('./uno'),
  catan: () => import('./catan'),
  carcassonne: () => import('./carcassonne'),
} satisfies Record<GameId, () => Promise<unknown>>;
