import { readinessUnchanged, type GameClient } from '@board-games/shared/ui';

/** Readiness, continuation, ballots and RPS retry while still uncommitted. */
export const client: GameClient = {
  load: () => import('./Board.svelte'),
  retryable(action, before, after, playerId) {
    const was = before.public as Record<string, any>;
    const now = after.public as Record<string, any>;
    if (
      was.mission !== now.mission ||
      !Array.isArray(now.players) ||
      !now.players.includes(playerId)
    )
      return false;
    if (action.type === 'ready')
      return (
        was.phase === 'setup' &&
        now.phase === 'setup' &&
        readinessUnchanged(action, was, now, playerId)
      );
    if (action.type === 'continue')
      return (
        was.phase === 'missionResult' &&
        now.phase === 'missionResult' &&
        action.mission === was.mission &&
        Array.isArray(now.continued) &&
        !now.continued.includes(playerId)
      );
    if (!Array.isArray(now.eliminated) || now.eliminated.includes(playerId))
      return false;
    if (action.type === 'vote')
      return (
        was.phase === 'vote' &&
        now.phase === 'vote' &&
        typeof action.ballotId === 'string' &&
        action.ballotId === was.ballotId &&
        action.ballotId === now.ballotId &&
        Array.isArray(now.committed) &&
        !now.committed.includes(playerId) &&
        action.target !== playerId &&
        now.players.includes(action.target) &&
        !now.eliminated.includes(action.target)
      );
    if (action.type === 'rps')
      return (
        was.phase === 'tie' &&
        now.phase === 'tie' &&
        !was.prompt &&
        !now.prompt &&
        typeof action.rpsId === 'string' &&
        action.rpsId === was.rpsId &&
        action.rpsId === now.rpsId &&
        Array.isArray(now.candidates) &&
        now.candidates.includes(playerId) &&
        Array.isArray(now.rpsCommitted) &&
        !now.rpsCommitted.includes(playerId) &&
        ['rock', 'paper', 'scissors'].includes(action.symbol)
      );
    return false;
  },
};
