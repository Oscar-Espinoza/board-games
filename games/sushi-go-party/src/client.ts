import { readinessUnchanged, type GameClient } from '@board-games/shared/ui';

/** Only guarded READY and PICK retry; other choices are reviewed after a stale reply. */
export const client: GameClient = {
  load: () => import('./Board.svelte'),
  retryable(action, before, after, playerId) {
    const was = before.public as Record<string, any>;
    const now = after.public as Record<string, any>;
    if (action.round !== was.round || action.round !== now.round) return false;
    if (action.type === 'READY')
      return (
        ['setup', 'round-end'].includes(was.phase) &&
        was.phase === now.phase &&
        readinessUnchanged(action, was, now, playerId)
      );
    const prior = before.private as Record<string, any> | null;
    const own = after.private as Record<string, any> | null;
    if (!own || !prior || action.type !== 'PICK') return false;
    return (
      was.phase === 'draft' &&
      now.phase === 'draft' &&
      action.turn === was.turn &&
      action.turn === now.turn &&
      typeof action.promptId === 'string' &&
      action.promptId === prior.pickPromptId &&
      action.promptId === own.pickPromptId &&
      prior.committed === null &&
      own.committed === null &&
      Array.isArray(now.committed) &&
      !now.committed.includes(playerId) &&
      Array.isArray(own.hand) &&
      own.hand.some((card: any) => card.handle === action.card) &&
      Array.isArray(action.utensils) &&
      Array.isArray(own.legalUtensils) &&
      action.utensils.every((id: unknown) => own.legalUtensils.includes(id)) &&
      (action.copyTarget === undefined ||
        (Array.isArray(own.copyTargets) &&
          own.copyTargets.some(
            (target: any) => target.id === action.copyTarget,
          )))
    );
  },
};
