import { retryReadyInSetup, type GameClient } from '@board-games/shared/ui';

/** Clues, guesses and end-turn always need a fresh confirmation. */
export const client: GameClient = {
  load: () => import('./Board.svelte'),
  retryable: retryReadyInSetup,
};
