import type { GameClient } from '@board-games/shared/ui';

/** Drafts always need a fresh confirmation, so nothing retries. */
export const client: GameClient = { load: () => import('./Board.svelte') };
