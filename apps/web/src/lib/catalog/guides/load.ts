import type { GameId } from '../types';
export const guideLoaders = {
  'little-secret': () => import('./little-secret'),
  azul: () => import('./azul'),
  codenames: () => import('./codenames'),
  'sushi-go-party': () => import('./sushi-go-party'),
  uno: () => import('./uno'),
  catan: () => import('./catan'),
  carcassonne: () => import('./carcassonne'),
} satisfies Record<GameId, () => Promise<unknown>>;
