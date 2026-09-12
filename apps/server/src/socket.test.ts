import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { uno } from '@board-games/uno/server';
import type { Credentials, Reply, RoomView } from '@board-games/shared';
import { Rooms } from './rooms.ts';
import { attachSockets } from './socket.ts';

function socketEvent(
  socket: Socket,
  event: 'connect' | 'disconnect',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`${event} timeout`));
    }, 5000);
    socket.once(event, handler);
  });
}
function collector(socket: Socket) {
  const snapshots: RoomView[] = [];
  socket.on('snapshot', (view: RoomView) => snapshots.push(view));
  return {
    snapshots,
    async until(predicate: (view: RoomView) => boolean): Promise<RoomView> {
      const prior = snapshots.findLast(predicate);
      if (prior) return prior;
      return new Promise((resolve, reject) => {
        const handler = (view: RoomView) => {
          if (predicate(view)) {
            clearTimeout(timeout);
            socket.off('snapshot', handler);
            resolve(view);
          }
        };
        const timeout = setTimeout(() => {
          socket.off('snapshot', handler);
          reject(new Error('Snapshot timeout'));
        }, 5000);
        socket.on('snapshot', handler);
      });
    },
  };
}
async function request<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  const reply = (await socket
    .timeout(5000)
    .emitWithAck(event, payload)) as Reply<T>;
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

test(
  'real sockets create/join/start, project private state, reject forgeries and reconnect to the same hand',
  { timeout: 20_000 },
  async (t) => {
    const http = createServer();
    const rooms = new Rooms(
      new Map([['uno', uno]]),
      60_000,
      Date.now,
      () => 0.37,
    );
    const io = attachSockets(http, rooms);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const port = (http.address() as { port: number }).port;
    const clients: Socket[] = [];
    t.after(async () => {
      for (const client of clients) client.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    });
    async function client() {
      const socket = connect(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      clients.push(socket);
      const collected = collector(socket);
      await socketEvent(socket, 'connect');
      return { socket, ...collected };
    }
    const host = await client();
    const guest = await client();
    const spy = await client();
    const hostCredentials = await request<Credentials>(host.socket, 'create', {
      gameId: 'uno',
      name: 'Host',
    });
    const guestCredentials = await request<Credentials>(guest.socket, 'join', {
      roomId: hostCredentials.roomId,
      name: 'Guest',
    });
    await assert.rejects(
      request(guest.socket, 'start', {}),
      /Only the room host/,
    );
    await request(host.socket, 'start', {});
    const h = await host.until((view) => view.status === 'playing');
    const g = await guest.until((view) => view.status === 'playing');
    assert.equal(io.sockets.adapter.rooms.get(hostCredentials.roomId)?.size, 2);
    assert.deepEqual(h.game?.public, g.game?.public);
    assert.notDeepEqual(
      (h.game?.private as any).hand,
      (g.game?.private as any).hand,
    );
    assert.equal(JSON.stringify(h).includes(guestCredentials.token), false);
    assert.equal(JSON.stringify(g).includes(hostCredentials.token), false);
    assert.equal(JSON.stringify(g).includes('"stock"'), false);
    assert.equal(spy.snapshots.length, 0);
    await assert.rejects(
      request(spy.socket, 'action', {
        id: 'forged',
        revision: h.revision,
        round: h.round,
        playerId: hostCredentials.playerId,
        action: { type: 'DRAW' },
      }),
      /Join first/,
    );
    await assert.rejects(
      request(guest.socket, 'action', {
        id: 'forged',
        revision: g.revision,
        round: g.round,
        playerId: hostCredentials.playerId,
        action: { type: 'DRAW' },
      }),
      /Wait for your turn/,
    );
    const draw = {
      id: 'one-draw',
      revision: h.revision,
      round: h.round,
      action: { type: 'DRAW' },
    };
    await request(host.socket, 'action', draw);
    const advanced = await host.until((view) => view.revision > h.revision);
    await request(host.socket, 'action', draw);
    assert.equal(
      rooms.view(hostCredentials.roomId, host.socket.id!).revision,
      advanced.revision,
    );
    assert.equal((advanced.game?.private as any).hand.length, 8);
    const stale = await host.socket
      .timeout(5000)
      .emitWithAck('action', { ...draw, id: 'fresh-id' });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'STALE_REVISION');
    const changed = await host.socket
      .timeout(5000)
      .emitWithAck('action', { ...draw, round: 0 });
    assert.equal(changed.code, 'MATCH_CHANGED');
    const synced = await request<{ room: RoomView; accepted: boolean }>(
      host.socket,
      'sync',
      { id: draw.id, round: draw.round },
    );
    assert.equal(synced.accepted, true);
    assert.deepEqual(
      synced.room,
      rooms.view(hostCredentials.roomId, host.socket.id!),
    );
    const other = await request<{ room: RoomView; accepted: boolean }>(
      guest.socket,
      'sync',
      { id: draw.id, round: draw.round },
    );
    assert.equal(other.accepted, false);
    assert.equal(JSON.stringify(other).includes(hostCredentials.token), false);
    assert.deepEqual(
      other.room.game?.private,
      rooms.view(hostCredentials.roomId, guest.socket.id!).game?.private,
    );
    await assert.rejects(
      request(spy.socket, 'sync', { id: draw.id, round: draw.round }),
      /Join first/,
    );

    const beforeReconnect = (g.game?.private as any).hand;
    guest.socket.disconnect();
    await host.until((view) =>
      view.players.some(
        (player) =>
          player.id === guestCredentials.playerId && !player.connected,
      ),
    );
    await assert.rejects(
      request(spy.socket, 'join', {
        roomId: hostCredentials.roomId,
        name: 'Guest',
      }),
      /No available seat/,
    );
    await assert.rejects(
      request(spy.socket, 'join', {
        roomId: hostCredentials.roomId,
        token: '',
      }),
      /token expired or invalid/,
    );
    const recovered = await client();
    const recoveredCredentials = await request<Credentials>(
      recovered.socket,
      'join',
      { roomId: hostCredentials.roomId, token: guestCredentials.token },
    );
    assert.equal(recoveredCredentials.playerId, guestCredentials.playerId);
    const reconnected = await recovered.until(
      (view) => view.status === 'playing',
    );
    assert.deepEqual((reconnected.game?.private as any).hand, beforeReconnect);
    assert.equal(
      reconnected.players.find(
        (player) => player.id === guestCredentials.playerId,
      )?.connected,
      true,
    );

    const successor = await client();
    const obsoleteDisconnected = socketEvent(recovered.socket, 'disconnect');
    await request(successor.socket, 'join', {
      roomId: hostCredentials.roomId,
      token: guestCredentials.token,
    });
    await obsoleteDisconnected;
    const current = await successor.until((view) => view.status === 'playing');
    assert.equal(
      current.players.find((player) => player.id === guestCredentials.playerId)
        ?.connected,
      true,
    );
    assert.ok(
      rooms.sockets(hostCredentials.roomId).includes(successor.socket.id!),
    );
    assert.equal(io.sockets.adapter.rooms.get(hostCredentials.roomId)?.size, 2);
  },
);

test(
  'solo practice socket publishes timed bot turns and rejects outside joins',
  { timeout: 10_000 },
  async (t) => {
    const http = createServer();
    const rooms = new Rooms(
      new Map([['uno', uno]]),
      60_000,
      Date.now,
      () => 0.37,
    );
    const io = attachSockets(http, rooms);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const port = (http.address() as { port: number }).port;
    const host = connect(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    const outsider = connect(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    const received = collector(host);
    const outside = collector(outsider);
    t.after(async () => {
      host.disconnect();
      outsider.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    });
    await Promise.all([
      socketEvent(host, 'connect'),
      socketEvent(outsider, 'connect'),
    ]);
    const credentials = await request<Credentials>(host, 'create', {
      gameId: 'uno',
      name: 'Me',
      options: { practice: true },
    });
    const initial = await received.until((v) => v.status === 'playing');
    await assert.rejects(
      request(outsider, 'join', { roomId: credentials.roomId, name: 'Me' }),
      /private/,
    );
    await request(host, 'action', {
      id: 'draw',
      round: initial.round,
      revision: initial.revision,
      action: { type: 'DRAW' },
    });
    const advanced = await received.until(
      (v) => v.revision >= initial.revision + 2,
    );
    assert.equal(advanced.players.filter((p) => p.bot).length, 3);
    assert.equal((advanced.game?.private as any).hand.length, 8);
    assert.equal(JSON.stringify(advanced).includes('"hands"'), false);
    assert.equal(outside.snapshots.length, 0);
    assert.equal(io.sockets.adapter.rooms.get(credentials.roomId)?.size, 1);
  },
);
