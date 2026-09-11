import { io, type Socket } from 'socket.io-client';
import type { Credentials, Reply, RoomView } from '@board-games/shared';
export const session = $state({
  room: null as RoomView | null,
  connected: false,
  error: '',
  pending: false,
  storageWarning: false,
});
let socket: Socket | undefined;
let current: Credentials | undefined;
export function saved(roomId: string): Credentials | undefined {
  try {
    const value = JSON.parse(
      localStorage.getItem(`board-games:room:${roomId}`) ?? 'null',
    );
    return value?.roomId === roomId && typeof value.token === 'string'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
function remember(credentials: Credentials) {
  current = credentials;
  try {
    localStorage.setItem(
      `board-games:room:${credentials.roomId}`,
      JSON.stringify(credentials),
    );
  } catch {
    session.storageWarning = true;
  }
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
            new Error('Server did not respond. Reconnect to synchronize.'),
          );
        else if (!reply.ok) reject(new Error(reply.error));
        else resolve(reply.data);
      });
  });
}
export function connect() {
  if (socket) return;
  socket = io({ autoConnect: false });
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
  try {
    await request('action', {
      id: crypto.randomUUID(),
      round: session.room.round,
      revision: session.room.revision,
      action,
    });
  } catch (error) {
    session.error = (error as Error).message;
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
