import { test, expect } from 'bun:test';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { carcassonne, type View } from '@board-games/carcassonne/server';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
import type { Credentials, Reply, RoomView } from '@board-games/shared';
function roomFixture() {
  let now = 0;
  const rooms = new Rooms(
    new Map([['carcassonne', carcassonne]]),
    100,
    () => now,
    () => 0.37,
  );
  const a = rooms.create('a', { gameId: 'carcassonne', name: 'Ada' }),
    b = rooms.join('b', { roomId: a.roomId, name: 'Bea' }).credentials;
  rooms.start(a.roomId, 'a');
  let serial = 0;
  return {
    rooms,
    a,
    b,
    expire() {
      now = 101;
      rooms.sweep();
    },
    act(socket: string, action: unknown) {
      const v = rooms.view(a.roomId, socket);
      rooms.action(a.roomId, socket, {
        id: String(++serial),
        round: v.round,
        revision: v.revision,
        action,
      });
    },
    view(socket = 'a') {
      return rooms.view(a.roomId, socket).game as View;
    },
  };
}
test('only the current room host can change the shared setup', () => {
  const f = roomFixture();
  const base: View['public']['config'] = {
    farmers: false,
    modules: [],
    first: 1,
  };
  expect(() =>
    f.act('b', { type: 'config', version: 0, config: base }),
  ).toThrow();
  f.act('a', { type: 'config', version: 0, config: base });
  expect(f.view('b').public.config).toEqual(base);
  expect(f.view('b').public.ready).toEqual([]);

  f.rooms.disconnect('a');
  const transferred: View['public']['config'] = {
    farmers: true,
    modules: ['abbot'],
    first: 1,
  };
  f.act('b', { type: 'config', version: 1, config: transferred });
  expect(f.view('b').public.config).toEqual(transferred);
});
test('disconnection and replacement invalidate only unconsumed setup readiness', () => {
  const f = roomFixture();
  f.act('a', { type: 'ready', version: 0 });
  f.rooms.disconnect('a');
  expect(f.view('b').public.ready).toEqual([]);
  expect(() => f.act('b', { type: 'ready', version: 0 })).toThrow();
  f.expire();
  f.rooms.join('c', { roomId: f.a.roomId, name: 'Cara' });
  expect(f.view('b').public.setupVersion).toBe(1);
  expect(() => f.act('b', { type: 'ready', version: 0 })).toThrow();
  f.act('c', { type: 'ready', version: 1 });
  f.act('b', { type: 'ready', version: 1 });
  expect(f.view('b').public.phase).toBe('place');
  expect(() =>
    f.rooms.join('old', { roomId: f.a.roomId, token: f.a.token }),
  ).toThrow();
});
test('duplicate placement ID cannot place twice, stale action cannot consume a draw', () => {
  const f = roomFixture();
  f.act('a', { type: 'ready', version: 0 });
  f.act('b', { type: 'ready', version: 0 });
  const room = f.rooms.view(f.a.roomId, 'a');
  const v = room.game as View;
  const action = {
    type: 'place',
    turn: v.public.turn,
    ...v.private.placements[0],
  };
  const request = {
    id: 'place-once',
    round: room.round,
    revision: room.revision,
    action,
  };
  f.rooms.action(f.a.roomId, 'a', request);
  const after = f.view();
  f.rooms.action(f.a.roomId, 'a', request);
  expect(f.view()).toEqual(after);
  expect(() =>
    f.rooms.action(f.a.roomId, 'a', { ...request, id: 'stale' }),
  ).toThrow();
  expect(f.view()).toEqual(after);
});
test('real sockets preserve a pending meeple choice, reject impersonation and project no future order', async () => {
  const http = createServer();
  const rooms = new Rooms(
    new Map([['carcassonne', carcassonne]]),
    60000,
    Date.now,
    () => 0.37,
  );
  const server = attachSockets(http, rooms);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const port = (http.address() as { port: number }).port;
  const sockets: Socket[] = [];
  const snapshots = new Map<Socket, RoomView>();
  const client = async () => {
    const s = connect(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(s);
    s.on('snapshot', (v) => snapshots.set(s, v));
    await new Promise<void>((r) => s.once('connect', r));
    return s;
  };
  let latestRevision = 0;
  const updated = (s: Socket, predicate: (v: RoomView) => boolean) =>
    new Promise<RoomView>((resolve, reject) => {
      const timer = setTimeout(() => {
        s.off('snapshot', handler);
        reject(Error('Snapshot timeout'));
      }, 3000);
      const handler = (v: RoomView) => {
        if (predicate(v)) {
          clearTimeout(timer);
          s.off('snapshot', handler);
          resolve(v);
        }
      };
      s.on('snapshot', handler);
    });
  const request = async <T>(s: Socket, event: string, payload: unknown) => {
    const published = updated(s, () => true);
    const reply = (await s
      .timeout(3000)
      .emitWithAck(event, payload)) as Reply<T>;
    latestRevision = (await published).revision;
    if (!reply.ok) throw Error(reply.error);
    return reply.data;
  };
  let serial = 0;
  const act = async (s: Socket, action: unknown) => {
    if ((snapshots.get(s)?.revision ?? -1) < latestRevision)
      await updated(s, (v) => v.revision >= latestRevision);
    const v = snapshots.get(s)!;
    await request(s, 'action', {
      id: String(++serial),
      round: v.round,
      revision: v.revision,
      action,
    });
  };
  try {
    const a = await client(),
      b = await client();
    const ca = await request<Credentials>(a, 'create', {
      gameId: 'carcassonne',
      name: 'Ada',
    });
    const cb = await request<Credentials>(b, 'join', {
      roomId: ca.roomId,
      name: 'Bea',
    });
    await request(a, 'start', {});
    await act(a, { type: 'ready', version: 0 });
    await act(b, { type: 'ready', version: 0 });
    const v = snapshots.get(a)!.game as View;
    const intention = {
      type: 'place',
      turn: v.public.turn,
      ...v.private.placements[0],
      playerId: ca.playerId,
    };
    await expect(act(b, intention)).rejects.toThrow();
    await act(a, intention);
    const pending = (snapshots.get(a)!.game as View).public.pending;
    expect(pending?.kind).toBe('deploy');
    a.disconnect();
    const restored = await client();
    await request(restored, 'join', { roomId: ca.roomId, token: ca.token });
    expect((snapshots.get(restored)!.game as View).public.pending).toEqual(
      pending,
    );
    for (const s of [restored, b]) {
      const payload = JSON.stringify(snapshots.get(s)!.game);
      expect(payload).not.toContain('"deck":');
      expect(payload).not.toContain('"messages":');
      expect(payload).not.toContain(ca.token);
      expect(payload).not.toContain(cb.token);
    }
    await expect(
      act(b, {
        type: 'choose',
        prompt: pending!.id,
        choice: pending!.options[0].id,
        playerId: ca.playerId,
      }),
    ).rejects.toThrow();
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((r) => server.close(() => r()));
  }
}, 10000);
