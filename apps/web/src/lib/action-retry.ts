import type {
  ActionRequest,
  ReplyErrorCode,
  RoomView,
  Synchronization,
} from '@board-games/shared';

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

function record(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

/** Only still-uncommitted simultaneous intentions are safe to retry. */
export function canRetryIntention(
  initial: RoomView,
  current: RoomView,
  intention: unknown,
) {
  if (
    current.id !== initial.id ||
    current.playerId !== initial.playerId ||
    current.gameId !== initial.gameId ||
    current.round !== initial.round ||
    current.status !== 'playing' ||
    current.players.some((player) => !player.connected)
  )
    return false;
  const action = record(intention);
  const before = record(initial.game?.public);
  const after = record(current.game?.public);
  if (!action || !before || !after) return false;
  if (['carcassonne', 'codenames'].includes(initial.gameId)) {
    return (
      action.type === 'ready' &&
      before.phase === 'setup' &&
      after.phase === 'setup' &&
      Number.isInteger(action.version) &&
      action.version === before.setupVersion &&
      action.version === after.setupVersion &&
      Array.isArray(after.ready) &&
      !after.ready.includes(current.playerId)
    );
  }
  if (initial.gameId !== 'sushi-go-party') return false;
  if (action.round !== before.round || action.round !== after.round)
    return false;
  if (action.type === 'READY') {
    return (
      ['setup', 'round-end'].includes(before.phase) &&
      before.phase === after.phase &&
      Number.isInteger(action.version) &&
      action.version === before.setupVersion &&
      action.version === after.setupVersion &&
      Array.isArray(after.ready) &&
      !after.ready.includes(current.playerId)
    );
  }
  const own = record(current.game?.private);
  const prior = record(initial.game?.private);
  if (!own || !prior || action.type !== 'PICK') return false;
  return (
    before.phase === 'draft' &&
    after.phase === 'draft' &&
    action.turn === before.turn &&
    action.turn === after.turn &&
    typeof action.promptId === 'string' &&
    action.promptId === prior.pickPromptId &&
    action.promptId === own.pickPromptId &&
    prior.committed === null &&
    own.committed === null &&
    Array.isArray(after.committed) &&
    !after.committed.includes(current.playerId) &&
    Array.isArray(own.hand) &&
    own.hand.some((card: any) => card.handle === action.card) &&
    Array.isArray(action.utensils) &&
    Array.isArray(own.legalUtensils) &&
    action.utensils.every((id: unknown) => own.legalUtensils.includes(id)) &&
    (action.copyTarget === undefined ||
      (Array.isArray(own.copyTargets) &&
        own.copyTargets.some((target: any) => target.id === action.copyTarget)))
  );
}

/** Acknowledgement loss needs an authoritative acceptance check before retrying. */
export async function deliverIntention(
  initial: RoomView,
  action: unknown,
  id: string,
  transport: {
    current(): RoomView | null;
    submit(request: ActionRequest): Promise<unknown>;
    synchronize(request: {
      id: string;
      round: number;
    }): Promise<Synchronization>;
  },
) {
  let revision = initial.revision;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await transport.submit({ id, round: initial.round, revision, action });
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
        !canRetryIntention(initial, synchronized.room, action) ||
        !canRetryIntention(initial, live, action)
      )
        throw error;
      revision = live.revision;
    }
  }
}
