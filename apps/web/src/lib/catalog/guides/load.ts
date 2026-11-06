import type { GameId } from '../types';
import type { Guide } from '../types';
export const guideLoaders = {
  'little-secret': () => import('@board-games/little-secret/guide'),
  azul: () => import('./azul'),
  codenames: () => import('@board-games/codenames/guide'),
  'sushi-go-party': () => import('./sushi-go-party'),
  uno: () => import('./uno'),
  catan: () => import('./catan'),
  carcassonne: () => import('./carcassonne'),
  domino: () => import('./domino'),
} satisfies Record<GameId, () => Promise<{ default: Guide }>>;
