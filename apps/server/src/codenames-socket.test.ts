import { test, expect } from 'bun:test';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
import { codenames } from '@board-games/codenames/server';
import { seeded } from '@board-games/codenames/practice';
import type { Credentials, RoomView } from '@board-games/shared';
import type { View } from '../../../games/codenames/src/types.js';
test('real socket authority, operative host privacy, simultaneous guesses, duplicate IDs, reconnect and rematch', async () => {
  const http = createServer(),
    rooms = new Rooms(
      new Map([['codenames', codenames]]),
      60000,
      Date.now,
      seeded(42),
    ),
    server = attachSockets(http, rooms);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port;
  const sockets: Socket[] = [],
    credentials: Credentials[] = [];
  const raw = (socket: Socket, event: string, data: unknown) =>
    socket.timeout(5000).emitWithAck(event, data);
  async function req(socket: Socket, event: string, data: unknown) {
    const r = await raw(socket, event, data);
    if (!r.ok) throw Error(r.error);
    return r.data;
  }
  async function client() {
    const s = connect(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(s);
    await new Promise<void>((resolve) => s.once('connect', () => resolve()));
    return s;
  }
  try {
    const host = await client();
    credentials.push(
      await req(host, 'create', {
        gameId: 'codenames',
        name: 'Operative host',
        options: { boardLanguage: 'es' },
      }),
    );
    for (let i = 1; i < 5; i++)
      credentials.push(
        await req(await client(), 'join', {
          roomId: credentials[0]!.roomId,
          name: `Seat ${i}`,
        }),
      );
    const snapshot = (i = 0) =>
      rooms.view(credentials[0]!.roomId, sockets[i]!.id!);
    const game = (i = 0) => snapshot(i).game as View;
    let serial = 0;
    async function act(i: number, action: unknown) {
      const s = snapshot(i);
      return req(sockets[i]!, 'action', {
        id: `cn-${serial++}`,
        round: s.round,
        revision: s.revision,
        action,
      });
    }
    await req(host, 'start', {});
    for (let i = 0; i < 5; i++)
      await act(i, {
        type: 'chooseRole',
        team: i < 3 ? 'red' : 'blue',
        role: i === 1 || i === 3 ? 'spymaster' : 'operative',
        version: game().public.setupVersion,
      });
    for (let i = 0; i < 5; i++)
      await act(i, { type: 'ready', version: game().public.setupVersion });
    expect(game().private.key).toBeUndefined();
    expect(game(1).private.key).toHaveLength(25);
    expect(game().public.board.every((c) => !('identity' in c))).toBe(true);
    const active = game().public.activeTeam,
      spy = active === 'red' ? 1 : 3,
      operative = active === 'red' ? 0 : 4,
      reviewer = active === 'red' ? 3 : 1;
    const old = snapshot(operative);
    const forged = await raw(sockets[operative]!, 'action', {
      id: 'forged',
      round: old.round,
      revision: old.revision,
      playerId: credentials[spy]!.playerId,
      action: { type: 'submitClue', word: 'mar', count: 1 },
    });
    expect(forged.ok).toBe(false);
    expect(snapshot().revision).toBe(old.revision);
    await act(spy, { type: 'submitClue', word: 'mar', count: 2 });
    await act(reviewer, { type: 'reviewClue', allow: true });
    const before = snapshot(operative),
      key = game(spy).private.key!;
    const card = key.findIndex((k) => k === active);
    const envelope = {
      id: 'one-guess',
      round: before.round,
      revision: before.revision,
      action: { type: 'guess', card },
    };
    const results = await Promise.all([
      raw(sockets[operative]!, 'action', envelope),
      raw(sockets[operative]!, 'action', {
        ...envelope,
        id: 'competing',
        action: {
          type: 'guess',
          card: key.findIndex((k, i) => k === active && i !== card),
        },
      }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok).code).toBe('STALE_REVISION');
    expect(game().public.board.filter((c) => c.revealed)).toHaveLength(1);
    const rev = snapshot().revision;
    expect((await raw(sockets[operative]!, 'action', envelope)).ok).toBe(true);
    expect(snapshot().revision).toBe(rev);
    const sync = await req(sockets[operative]!, 'sync', {
      id: envelope.id,
      round: before.round,
    });
    expect(sync.accepted).toBe(true);
    expect((sync.room.game as View).private.key).toBeUndefined();
    const wrong = await raw(sockets[operative]!, 'action', {
      ...envelope,
      id: 'wrong-round',
      round: before.round + 1,
    });
    expect(wrong.code).toBe('MATCH_CHANGED');
    sockets[operative]!.disconnect();
    const reconnect = await client();
    await req(reconnect, 'join', {
      ...credentials[operative],
      name: 'Reconnected',
    });
    const rejoined = rooms.view(credentials[0]!.roomId, reconnect.id!);
    expect(rejoined.playerId).toBe(credentials[operative]!.playerId);
    expect((rejoined.game as View).private.key).toBeUndefined();
    expect(
      (rejoined.game as View).public.board.filter((c) => c.revealed),
    ).toHaveLength(1);
    const assassin = key.indexOf('assassin');
    const current = rooms.view(credentials[0]!.roomId, reconnect.id!);
    await req(reconnect, 'action', {
      id: 'assassin',
      round: current.round,
      revision: current.revision,
      action: { type: 'guess', card: assassin },
    });
    expect(
      (rooms.view(credentials[0]!.roomId, reconnect.id!).game as View).public
        .phase,
    ).toBe('finished');
    const currentHost = rooms.view(
      credentials[0]!.roomId,
      reconnect.id!,
    ).hostId;
    const hostSocket =
      currentHost === credentials[operative]!.playerId
        ? reconnect
        : sockets[credentials.findIndex((c) => c.playerId === currentHost)]!;
    await req(hostSocket, 'start', {});
    const fresh = rooms.view(credentials[0]!.roomId, reconnect.id!);
    expect(fresh.round).toBe(before.round + 1);
    expect((fresh.game as View).public.phase).toBe('setup');
    expect((fresh.game as View).public.board).toEqual([]);
    expect((fresh.game as View).private.key).toBeUndefined();
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 20000);
