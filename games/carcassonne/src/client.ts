import { readinessUnchanged, type GameClient } from '@board-games/shared/ui';

export const client: GameClient = {
  load: () => import('./Board.svelte'),
  retryable(action, before, after, playerId) {
    const was = before.public as Record<string, any>;
    const now = after.public as Record<string, any>;
    return (
      action.type === 'ready' &&
      was.phase === 'setup' &&
      now.phase === 'setup' &&
      readinessUnchanged(action, was, now, playerId)
    );
  },
};
