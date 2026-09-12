import { test, expect } from 'bun:test';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import {
  azul,
  type View,
  type Action,
  rowIssue,
} from '@board-games/azul/server';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
import type { Credentials, RoomView, Reply } from '@board-games/shared';
function choice(v: View): Action {
  const p = v.public,
    source: Action['source'] = p.factories.some((f) => f.length)
      ? { kind: 'factory', index: p.factories.findIndex((f) => f.length) }
      : { kind: 'center' },
    supply = source.kind === 'center' ? p.center : p.factories[source.index],
    color = supply[0],
    row = p.boards[p.turn].patterns.findIndex(
      (_, r) => !rowIssue(p.boards[p.turn], color, r),
    );
  return {
    type: 'DRAFT',
    source,
    color,
    destination: row < 0 ? { kind: 'floor' } : { kind: 'pattern', row },
  };
}
function privateSafe(v: View) {
  expect(v.private).toEqual({});
  expect(JSON.stringify(v)).not.toMatch(
    /"(?:bag|discard|token|random|credentials)":/,
  );
}
test('Azul room generations, deduplication, stale revisions, replacement and complete game projections', () => {
  let now = 0;
  const rooms = new Rooms(
      new Map([['azul', azul]]),
      100,
      () => now,
      () => 0.37,
    ),
    a = rooms.create('a', { gameId: 'azul', name: 'Ada' }),
    b = rooms.join('b', { roomId: a.roomId, name: 'Bea' }).credentials;
  rooms.start(a.roomId, 'a');
  let v = rooms.view(a.roomId, 'a'),
    game = v.game as View;
  const socket = game.public.turn === 0 ? 'a' : 'b',
    other = socket === 'a' ? 'b' : 'a',
    request = {
      id: 'one',
      round: v.round,
      revision: v.revision,
      action: choice(game),
    };
  expect(() => rooms.action(a.roomId, other, request)).toThrow();
  rooms.action(a.roomId, socket, request);
  const once = rooms.view(a.roomId, socket);
  rooms.action(a.roomId, socket, request);
  expect(rooms.view(a.roomId, socket)).toEqual(once);
  expect(() =>
    rooms.action(a.roomId, other, { ...request, id: 'stale' }),
  ).toThrow();
  rooms.disconnect('a');
  const before = (rooms.view(a.roomId, 'b').game as View).public;
  const resumed = rooms.join('restored', { roomId: a.roomId, token: a.token });
  expect(resumed.credentials.playerId).toBe(a.playerId);
  expect((rooms.view(a.roomId, 'restored').game as View).public).toEqual(
    before,
  );
  rooms.disconnect('restored');
  now = 101;
  rooms.sweep();
  const replacement = rooms.join('new', {
    roomId: a.roomId,
    name: 'Clara',
  }).credentials;
  expect(replacement.playerId).toBe(a.playerId);
  expect(() =>
    rooms.join('revoked', { roomId: a.roomId, token: a.token }),
  ).toThrow();
  let serial = 0;
  while (serial++ < 1000) {
    v = rooms.view(a.roomId, 'b');
    game = v.game as View;
    privateSafe(game);
    privateSafe(rooms.view(a.roomId, 'new').game as View);
    if (game.public.phase === 'finished') break;
    const actor =
      game.public.players[game.public.turn] === b.playerId ? 'b' : 'new';
    rooms.action(a.roomId, actor, {
      id: `move-${serial}`,
      round: v.round,
      revision: v.revision,
      action: choice(game),
    });
  }
  expect(game.public.phase).toBe('finished');
  expect(serial).toBeLessThan(1000);
  const oldRound = v.round;
  rooms.start(a.roomId, 'b');
  expect(rooms.view(a.roomId, 'b').round).toBe(oldRound + 1);
  expect((rooms.view(a.roomId, 'b').game as View).public.revision).toBe(0);
});
test('real Socket.IO views bind actor, reject concurrent stale moves, reconnect and omit future tile order', async () => {
  let now = 0;
  const rooms = new Rooms(
      new Map([['azul', azul]]),
      1000,
      () => now,
      () => 0.37,
    ),
    http = createServer(),
    server = attachSockets(http, rooms);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(http.address() as { port: number }).port}`,
    sockets: Socket[] = [],
    latest = new Map<Socket, RoomView>();
  const client = async () => {
    const s = connect(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(s);
    s.on('snapshot', (v) => latest.set(s, v));
    await new Promise<void>((r) => s.once('connect', r));
    return s;
  };
  const request = async <T>(s: Socket, event: string, payload: unknown) => {
    const result = (await s
      .timeout(3000)
      .emitWithAck(event, payload)) as Reply<T>;
    return result;
  };
  const flush = () => new Promise((r) => setTimeout(r, 15));
  try {
    const a = await client(),
      b = await client();
    const created = await request<Credentials>(a, 'create', {
      gameId: 'azul',
      name: 'Ada',
    });
    if (!created.ok) throw Error(created.error);
    const ca = created.data;
    const joined = await request<Credentials>(b, 'join', {
      roomId: ca.roomId,
      name: 'Bea',
    });
    if (!joined.ok) throw Error(joined.error);
    await request(a, 'start', {});
    await flush();
    const initial = latest.get(a)!,
      game = initial.game as View;
    privateSafe(game);
    const actor = game.public.turn === 0 ? a : b,
      other = actor === a ? b : a;
    const intention = {
      id: 'draft',
      round: initial.round,
      revision: initial.revision,
      action: choice(game),
    };
    expect(
      (
        await request(other, 'action', {
          ...intention,
          action: { ...intention.action, actor: ca.playerId },
        })
      ).ok,
    ).toBe(false);
    const simultaneous = await Promise.all([
      request(actor, 'action', intention),
      request(actor, 'action', { ...intention, id: 'second' }),
    ]);
    expect(simultaneous.filter((r) => r.ok)).toHaveLength(1);
    await flush();
    expect((latest.get(a)!.game as View).public.revision).toBe(1);
    const duplicate = await request(actor, 'action', intention);
    expect(duplicate.ok).toBe(true);
    await flush();
    expect((latest.get(a)!.game as View).public.revision).toBe(1);
    const board = (latest.get(b)!.game as View).public;
    a.disconnect();
    await flush();
    const restored = await client();
    expect(
      (await request(restored, 'join', { roomId: ca.roomId, token: ca.token }))
        .ok,
    ).toBe(true);
    await flush();
    expect((latest.get(restored)!.game as View).public).toEqual(board);
    for (const s of [restored, b]) privateSafe(latest.get(s)!.game as View);
    restored.disconnect();
    await flush();
    now = 1001;
    rooms.sweep();
    const replacement = await client();
    const replaced = await request<Credentials>(replacement, 'join', {
      roomId: ca.roomId,
      name: 'Clara',
    });
    if (!replaced.ok) throw Error(replaced.error);
    expect(replaced.data.playerId).toBe(ca.playerId);
    expect(replaced.data.token).not.toBe(ca.token);
    await flush();
    expect((latest.get(replacement)!.game as View).public).toEqual(board);
    expect(latest.get(replacement)!.hostId).toBe(joined.data.playerId);
    const revoked = await client();
    expect(
      (await request(revoked, 'join', { roomId: ca.roomId, token: ca.token }))
        .ok,
    ).toBe(false);
    expect((await request(replacement, 'start', {})).ok).toBe(false);
    privateSafe(latest.get(replacement)!.game as View);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await new Promise<void>((r) => server.close(() => http.close(() => r())));
  }
});
