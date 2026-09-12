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
    for (let i = 1; i < 6; i++)
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
    for (let i = 0; i < 6; i++)
      await act(i, {
        type: 'chooseRole',
        team: i < 3 ? 'red' : 'blue',
        role: i === 1 || i === 3 ? 'spymaster' : 'operative',
        version: game().public.setupVersion,
      });
    for (let i = 0; i < 6; i++)
      await act(i, { type: 'ready', version: game().public.setupVersion });
    expect(game().private.key).toBeUndefined();
    expect(game(1).private.key).toHaveLength(25);
    expect(game().public.board.every((c) => !('identity' in c))).toBe(true);
    const active = game().public.activeTeam,
      spy = active === 'red' ? 1 : 3,
      operative = active === 'red' ? 0 : 4,
      reviewer = active === 'red' ? 3 : 1,
      teammate = active === 'red' ? 2 : 5;
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
    const competing = {
      ...envelope,
      id: 'competing',
      action: {
        type: 'guess',
        card: key.findIndex((k, i) => k === active && i !== card),
      },
    };
    const results = await Promise.all([
      raw(sockets[operative]!, 'action', envelope),
      raw(sockets[teammate]!, 'action', competing),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok).code).toBe('STALE_REVISION');
    expect(game().public.board.filter((c) => c.revealed)).toHaveLength(1);
    const rev = snapshot().revision;
    const accepted = results[0].ok ? envelope : competing;
    const acceptedSocket = sockets[results[0].ok ? operative : teammate]!;
    expect((await raw(acceptedSocket, 'action', accepted)).ok).toBe(true);
    expect(snapshot().revision).toBe(rev);
    const sync = await req(acceptedSocket, 'sync', {
      id: accepted.id,
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

test('setup replacement renews consent; promoted operative and absent/replaced spymasters retain role privacy', async () => {
  let now = 1000;
  const http = createServer(),
    rooms = new Rooms(
      new Map([['codenames', codenames]]),
      1000,
      () => now,
      seeded(17),
    ),
    server = attachSockets(http, rooms);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port,
    all: Socket[] = [],
    seats: Socket[] = [],
    credentials: Credentials[] = [];
  const raw = (socket: Socket, event: string, data: unknown) =>
    socket.timeout(5000).emitWithAck(event, data);
  async function req(socket: Socket, event: string, data: unknown) {
    const reply = await raw(socket, event, data);
    if (!reply.ok) throw Error(reply.error);
    return reply.data;
  }
  async function client() {
    const socket = connect(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    all.push(socket);
    await new Promise<void>((resolve) => socket.once('connect', resolve));
    return socket;
  }
  const snapshot = (i = 1) => rooms.view(credentials[0]!.roomId, seats[i]!.id!);
  const game = (i = 1) => snapshot(i).game as View;
  let serial = 0;
  const act = (i: number, action: unknown) => {
    const current = snapshot(i);
    return raw(seats[i]!, 'action', {
      id: `replacement-${serial++}`,
      round: current.round,
      revision: current.revision,
      action,
    });
  };
  async function disconnect(i: number) {
    seats[i]!.disconnect();
    for (
      let j = 0;
      j < 100 &&
      snapshot().players.find((p) => p.id === credentials[i]!.playerId)!
        .connected;
      j++
    )
      await Bun.sleep(5);
    expect(
      snapshot().players.find((p) => p.id === credentials[i]!.playerId)!
        .connected,
    ).toBe(false);
  }
  try {
    for (let i = 0; i < 4; i++) {
      seats.push(await client());
      credentials.push(
        await req(
          seats[i]!,
          i === 0 ? 'create' : 'join',
          i === 0
            ? { gameId: 'codenames', name: `Seat ${i}` }
            : { roomId: credentials[0]!.roomId, name: `Seat ${i}` },
        ),
      );
    }
    await req(seats[0]!, 'start', {});
    for (let i = 0; i < 4; i++)
      expect(
        (
          await act(i, {
            type: 'chooseRole',
            team: i < 2 ? 'red' : 'blue',
            role: i % 2 ? 'operative' : 'spymaster',
            version: game().public.setupVersion,
          })
        ).ok,
      ).toBe(true);
    for (let i = 0; i < 3; i++)
      expect(
        (await act(i, { type: 'ready', version: game().public.setupVersion }))
          .ok,
      ).toBe(true);
    await disconnect(0);
    expect(snapshot().hostId).toBe(credentials[1]!.playerId);
    expect(game().private.key).toBeUndefined();
    expect(game().public.ready).not.toContain(credentials[0]!.playerId);
    expect(
      (await act(3, { type: 'ready', version: game().public.setupVersion })).ok,
    ).toBe(false);
    seats[0] = await client();
    await req(seats[0]!, 'join', credentials[0]);
    expect(game().public.board).toHaveLength(0);
    const version = game().public.setupVersion;
    await disconnect(2);
    expect(snapshot().players[2]!.reservedUntil).toBe(2000);
    now = 2100;
    rooms.sweep();
    expect(snapshot().players[2]!.reservedUntil).toBeNull();
    const old = credentials[2]!;
    seats[2] = await client();
    credentials[2] = await req(seats[2]!, 'join', {
      roomId: old.roomId,
      name: 'New blue spymaster',
    });
    expect(credentials[2]!.playerId).toBe(old.playerId);
    expect(game().public.setupVersion).toBe(version + 1);
    expect(game().public.ready).toEqual([]);
    expect(game(2).private.assignment).toEqual({
      team: 'blue',
      role: 'spymaster',
    });
    expect((await raw(await client(), 'join', old)).ok).toBe(false);
    for (let i = 0; i < 4; i++)
      expect(
        (await act(i, { type: 'ready', version: game().public.setupVersion }))
          .ok,
      ).toBe(true);
    const spy = game().public.activeTeam === 'red' ? 0 : 2,
      reviewer = spy === 0 ? 2 : 0;
    const key = game(spy).private.key;
    await disconnect(spy);
    expect(game().public.phase).toBe('clue');
    expect(game().private.key).toBeUndefined();
    expect(
      (await act(1, { type: 'submitClue', word: 'Sea', count: 1 })).ok,
    ).toBe(false);
    now += 1100;
    rooms.sweep();
    const prior = credentials[spy]!;
    seats[spy] = await client();
    credentials[spy] = await req(seats[spy]!, 'join', {
      roomId: prior.roomId,
      name: 'Replacement spymaster',
    });
    expect(credentials[spy]!.playerId).toBe(prior.playerId);
    expect(game(spy).private.key).toEqual(key);
    expect(game().private.key).toBeUndefined();
    expect(
      (
        await act(spy, {
          type: 'chooseRole',
          team: 'red',
          role: 'operative',
          version: game().public.setupVersion,
        })
      ).ok,
    ).toBe(false);
    expect(
      (await act(spy, { type: 'submitClue', word: 'Sea', count: 1 })).ok,
    ).toBe(true);
    await disconnect(reviewer);
    expect(game().public.phase).toBe('clueReview');
    expect((await act(1, { type: 'reviewClue', allow: true })).ok).toBe(false);
    seats[reviewer] = await client();
    await req(seats[reviewer]!, 'join', credentials[reviewer]);
    expect((await act(reviewer, { type: 'reviewClue', allow: true })).ok).toBe(
      true,
    );
    expect(game().public.phase).toBe('guessing');
    expect(game().public.board.every((cell) => !('identity' in cell))).toBe(
      true,
    );
  } finally {
    for (const socket of all) socket.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 20000);
