import type {
  ActionRequest,
  ReplyErrorCode,
  RoomView,
  Synchronization,
} from '@board-games/game-core';
import type { GameClient, Intention } from '@board-games/shared/ui';

/** Preserve transport meaning without depending on human-readable error wording. */
export class SocketReplyError extends Error {
  constructor(
    message: string,
    readonly code?: ReplyErrorCode | 'TIMEOUT',
  ) {
    super(message);
    this.name = 'SocketReplyError';
  }
}

const isRecord = (value: unknown) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Only still-uncommitted intentions the game itself vouches for are safe to retry. */
function canRetryIntention(
  initial: RoomView,
  current: RoomView,
  intention: unknown,
  retryable: GameClient['retryable'],
) {
  return (
    !!retryable &&
    current.id === initial.id &&
    current.playerId === initial.playerId &&
    current.gameId === initial.gameId &&
    current.round === initial.round &&
    current.status === 'playing' &&
    current.players.every((player) => player.connected) &&
    isRecord(intention) &&
    isRecord(initial.game?.public) &&
    isRecord(current.game?.public) &&
    retryable(
      intention as Intention,
      initial.game!,
      current.game!,
      current.playerId,
    )
  );
}

/** Acknowledgement loss needs an authoritative acceptance check before retrying. */
export async function deliverIntention(
  initial: RoomView,
  action: unknown,
  id: string,
  retryable: GameClient['retryable'],
  transport: {
    current(): RoomView | null;
    submit(request: ActionRequest): Promise<unknown>;
    synchronize(request: {
      id: string;
      round: number;
    }): Promise<Synchronization>;
  },
) {
  // Selection controls may continue to change while synchronization is in flight.
  // Use the wire representation, which also unwraps Svelte reactive proxies.
  const intention: unknown = JSON.parse(JSON.stringify(action));
  let revision = initial.revision;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await transport.submit({
        id,
        round: initial.round,
        revision,
        action: intention,
      });
      return;
    } catch (error) {
      if (
        !(error instanceof SocketReplyError) ||
        !['STALE_REVISION', 'TIMEOUT'].includes(error.code ?? '')
      )
        throw error;
      const synchronized = await transport.synchronize({
        id,
        round: initial.round,
      });
      const live = transport.current();
      if (
        !live ||
        live.id !== initial.id ||
        live.playerId !== initial.playerId ||
        live.round !== initial.round
      )
        throw error;
      if (
        synchronized.accepted &&
        synchronized.room.id === initial.id &&
        synchronized.room.playerId === initial.playerId &&
        synchronized.room.round === initial.round
      )
        return;
      if (
        attempt === 2 ||
        !canRetryIntention(initial, synchronized.room, intention, retryable) ||
        !canRetryIntention(initial, live, intention, retryable)
      )
        throw error;
      revision = live.revision;
    }
  }
}
