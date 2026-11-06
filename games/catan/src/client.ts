import type { GameClient } from '@board-games/shared/ui';

export const client: GameClient = { load: () => import('./Board.svelte') };
