import { io, type Socket } from 'socket.io-client';
import type {
  Credentials,
  Reply,
  RoomView,
  Synchronization,
} from '@board-games/game-core';
import { read, write } from '@board-games/shared/ui';
import { deliverIntention, SocketReplyError } from './action-retry';
import { gameClients } from './games';
import type { GameId } from '@board-games/shared';
export const session = $state({
  room: null as RoomView | null,
  connected: false,
  error: '',
  errorCode: undefined as SocketReplyError['code'],
  pending: false,
  storageWarning: false,
});
let socket: Socket | undefined;
let current: Credentials | undefined;
const key = (roomId: string) => `board-games:room:${roomId}`;
function saved(roomId: string): Credentials | undefined {
  try {
    const value = JSON.parse(read(key(roomId)) ?? 'null');
    return value?.roomId === roomId && typeof value.token === 'string'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
function remember(credentials: Credentials) {
  current = credentials;
  if (!write(key(credentials.roomId), credentials))
    session.storageWarning = true;
}
export function request<T>(event: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'));
      return;
    }
    socket
      .timeout(10_000)
      .emit(event, data, (error: Error | null, reply: Reply<T>) => {
        if (error)
          reject(
            new SocketReplyError(
              'Server did not respond. Reconnect to synchronize.',
              'TIMEOUT',
            ),
          );
        else if (!reply.ok)
          reject(new SocketReplyError(reply.error, reply.code));
        else resolve(reply.data);
      });
  });
}
export function connect() {
  if (socket) return;
  socket = io({ autoConnect: false, transports: ['websocket', 'polling'] });
  socket.on('snapshot', (room: RoomView) => {
    session.room = room;
  });
  socket.on('connect', async () => {
    session.connected = true;
    session.error = '';
    if (current) {
      try {
        remember(
          await request<Credentials>('join', {
            roomId: current.roomId,
            token: current.token,
          }),
        );
      } catch (error) {
        session.error = String((error as Error).message);
        session.room = null;
      }
    }
  });
  socket.on('disconnect', () => {
    session.connected = false;
  });
  socket.on('connect_error', () => {
    session.connected = false;
  });
  socket.connect();
}
export async function create(gameId: string, name: string, options: unknown) {
  remember(await request<Credentials>('create', { gameId, name, options }));
  return current!;
}
export async function join(roomId: string, name?: string, useToken = true) {
  const token = useToken ? saved(roomId)?.token : undefined;
  remember(
    await request<Credentials>('join', {
      roomId,
      name,
      ...(token ? { token } : {}),
    }),
  );
}
export function resume(roomId: string) {
  current = saved(roomId);
  if (socket?.connected && current) {
    void request<Credentials>('join', { roomId, token: current.token })
      .then(remember)
      .catch((error) => {
        session.error = error.message;
      });
  }
  connect();
}
export async function send(action: unknown) {
  if (!session.room || session.pending) return;
  session.pending = true;
  session.error = '';
  session.errorCode = undefined;
  const initial = session.room;
  const id = crypto.randomUUID();
  try {
    await deliverIntention(
      initial,
      action,
      id,
      gameClients[initial.gameId as GameId]?.retryable,
      {
        current: () => session.room,
        submit: (payload) => request('action', payload),
        synchronize: async (payload) => {
          const synchronized = await request<Synchronization>('sync', payload);
          // Never overwrite a different room, match, or a newer pushed snapshot.
          const live = session.room;
          if (
            live?.id === synchronized.room.id &&
            live.playerId === synchronized.room.playerId &&
            live.round === synchronized.room.round &&
            live.revision <= synchronized.room.revision
          ) {
            session.room = synchronized.room;
          }
          return synchronized;
        },
      },
    );
  } catch (error) {
    session.error = (error as Error).message;
    session.errorCode =
      error instanceof SocketReplyError ? error.code : undefined;
  } finally {
    session.pending = false;
  }
}
export function leave() {
  socket?.disconnect();
  socket = undefined;
  current = undefined;
  session.room = null;
  session.connected = false;
}
