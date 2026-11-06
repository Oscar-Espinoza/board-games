import type { GameClient } from '@board-games/shared/ui';

export const client: GameClient = {
  load() {
    // The 3D table's code and art download alongside the board.
    void import('./preload.js').then((m) => m.preload());
    return import('./Board.svelte');
  },
};
