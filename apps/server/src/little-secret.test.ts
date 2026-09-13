import { test, expect } from 'bun:test';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
import { littleSecret } from '@board-games/little-secret/server';
import { seeded } from '@board-games/little-secret/practice';
import type { Credentials, RoomView } from '@board-games/shared';
import type { View, State } from '../../../games/little-secret/src/types.js';
for (const count of [3, 9])
  test(`${count} independent sockets complete a match: private payloads, races, deduplication, reconnect, host transfer and rematch`, async () => {
    const http = createServer(),
      rooms = new Rooms(
        new Map([['little-secret', littleSecret]]),
        60000,
        Date.now,
        seeded(count),
      ),
      server = attachSockets(http, rooms);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const port = (http.address() as { port: number }).port;
    const all: Socket[] = [],
      sockets: Socket[] = [],
      credentials: Credentials[] = [],
      received: RoomView[][] = Array.from({ length: count }, () => []);
    const last = new Map<Socket, number>();
    const raw = async (s: Socket, event: string, data: unknown) => {
      const wait = 42 - (Date.now() - (last.get(s) ?? 0));
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      last.set(s, Date.now());
      return s.timeout(5000).emitWithAck(event, data);
    };
    async function req(s: Socket, event: string, data: unknown) {
      const reply = await raw(s, event, data);
      if (!reply.ok) throw Error(reply.error);
      return reply.data;
    }
    async function client(i: number) {
      const s = connect(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      all.push(s);
      s.on('snapshot', (v: RoomView) => received[i]!.push(v));
      await new Promise<void>((resolve) => s.once('connect', () => resolve()));
      return s;
    }
    try {
      for (let i = 0; i < count; i++) {
        sockets[i] = await client(i);
        credentials[i] = await req(
          sockets[i]!,
          i ? 'join' : 'create',
          i
            ? { roomId: credentials[0]!.roomId, name: `Seat ${i}` }
            : {
                gameId: 'little-secret',
                name: 'Host',
                options: { powers: count === 9, wordLanguage: 'es' },
              },
        );
      }
      const roomId = credentials[0]!.roomId,
        snapshot = (i = 0) => rooms.view(roomId, sockets[i]!.id!),
        state = () => rooms.rooms.get(roomId)!.state as State,
        game = (i = 0) => snapshot(i).game as View;
      let sequence = 0;
      const act = async (i: number, action: unknown) => {
        const v = snapshot(i);
        return req(sockets[i]!, 'action', {
          id: `action-${sequence++}`,
          round: v.round,
          revision: v.revision,
          action,
        });
      };
      const index = (p: string) =>
        credentials.findIndex((c) => c.playerId === p);
      const host = () => index(snapshot().hostId);
      await req(sockets[0]!, 'start', {});
      const before = snapshot();
      expect(
        (
          await raw(sockets[1]!, 'action', {
            id: 'forge',
            round: before.round,
            revision: before.revision,
            playerId: credentials[0]!.playerId,
            action: {
              type: 'configure',
              version: 0,
              options: { wordLanguage: 'en' },
            },
          })
        ).ok,
      ).toBe(false);
      expect(snapshot().revision).toBe(before.revision);
      const same = snapshot(),
        requests = [0, 1].map((i) => ({
          id: `race-${i}`,
          round: same.round,
          revision: same.revision,
          action: { type: 'ready', version: 0 },
        }));
      const replies = await Promise.all([
        raw(sockets[0]!, 'action', requests[0]),
        raw(sockets[1]!, 'action', requests[1]),
      ]);
      expect(replies.filter((r) => r.ok)).toHaveLength(1);
      expect(replies.find((r) => !r.ok).code).toBe('STALE_REVISION');
      const accepted = replies[0].ok ? 0 : 1,
        rejected = 1 - accepted,
        rev = snapshot().revision;
      expect(
        (await raw(sockets[accepted]!, 'action', requests[accepted])).ok,
      ).toBe(true);
      expect(snapshot().revision).toBe(rev);
      const sync = await req(sockets[accepted]!, 'sync', {
        id: requests[accepted]!.id,
        round: same.round,
      });
      expect(sync.accepted).toBe(true);
      await act(rejected, { type: 'ready', version: 0 });
      for (let i = 2; i < count; i++)
        await act(i, { type: 'ready', version: 0 });
      for (let i = 0; i < count; i++) {
        const v = await req(sockets[i]!, 'sync', {});
        const own = (v.room as RoomView).game as View;
        expect(own.private.solution).toBeNull();
        expect(own.private.role).toBe(
          state().roles[credentials[i]!.playerId] === 'journalist'
            ? 'journalist'
            : null,
        );
        expect(JSON.stringify(own.public)).not.toContain(
          JSON.stringify(state().password),
        );
        expect(JSON.stringify(own)).not.toContain(state().used[0]!);
      }
      const reconnected = new Set<string>();
      async function reconnect(i: number) {
        const oldId = sockets[i]!.id!;
        const disconnected = new Promise<void>((resolve) =>
          server.sockets.sockets
            .get(oldId)!
            .once('disconnect', () => resolve()),
        );
        sockets[i]!.disconnect();
        await disconnected;
        const replacement = await client(i);
        await req(replacement, 'join', {
          ...credentials[i],
          name: 'returning',
        });
        sockets[i] = replacement;
      }
      let steps = 0;
      while (game().public.phase !== 'finished' && steps++ < 1800) {
        const s = game().public;
        if (
          ['vote', 'tie', 'reactions'].includes(s.phase) &&
          !reconnected.has(s.phase)
        ) {
          const who = s.prompt ? index(s.prompt.actor) : 0;
          const prior = game(who).private;
          await reconnect(who);
          expect(game(who).private).toEqual(prior);
          reconnected.add(s.phase);
        }
        if (s.phase === 'volunteer')
          await act(0, { type: 'volunteer', mission: s.mission });
        else if (s.phase === 'clues')
          await act(index(s.speaker!), {
            type: 'clue',
            mission: s.mission,
            cycle: s.cycle,
          });
        else if (s.phase === 'debate')
          await act(host(), {
            type: 'openVote',
            mission: s.mission,
            cycle: s.cycle,
          });
        else if (s.phase === 'vote') {
          const alive = s.players.filter((p) => !s.eliminated.includes(p)),
            actor = alive.find((p) => !s.committed.includes(p))!,
            target =
              s.mission === 1 && s.cycle === 1
                ? count === 3
                  ? alive[(alive.indexOf(actor) + 1) % alive.length]!
                  : (alive.find(
                      (p) => p !== actor && state().roles[p] === 'journalist',
                    ) ?? alive.find((p) => p !== actor)!)
                : alive.find((p) => p !== actor)!;
          await act(index(actor), {
            type: 'vote',
            ballotId: s.ballotId,
            target,
          });
          const current = game(index(alive.find((p) => p !== actor)!));
          if (current.public.phase === 'vote') {
            expect(current.private.ballot).toBe(
              state().ballots[alive.find((p) => p !== actor)!] ?? null,
            );
            expect(current.public.events).toEqual([]);
          }
        } else if (s.prompt) {
          const action =
            s.prompt.kind === 'journalist'
              ? { type: 'guess', answer: 'intento incorrecto' }
              : s.prompt.kind === 'sage'
                ? { type: 'resolveTie', target: s.candidates[0] }
                : { type: 'revenant', target: null };
          await act(index(s.prompt.actor), {
            ...action,
            promptId: s.prompt.id,
          });
        } else if (s.phase === 'tie') {
          const actor = s.candidates.find((p) => !s.rpsCommitted.includes(p))!;
          await act(index(actor), {
            type: 'rps',
            rpsId: s.rpsId,
            symbol: actor === s.candidates[0] ? 'scissors' : 'rock',
          });
        } else if (s.phase === 'missionResult') {
          const actor = s.players.find((p) => !s.continued.includes(p))!;
          await act(index(actor), { type: 'continue', mission: s.mission });
        } else throw Error(s.phase);
      }
      expect(game().public.phase).toBe('finished');
      expect(game().public.result!.winners.length).toBeGreaterThan(0);
      expect(reconnected.has('vote')).toBe(true);
      expect(reconnected.has(count === 3 ? 'tie' : 'reactions')).toBe(true);
      for (const messages of received)
        for (const v of messages) {
          const own = v.game as View | null;
          if (!own) continue;
          expect(own.public).not.toHaveProperty('roles');
          expect(own.public).not.toHaveProperty('password');
          expect(own.public).not.toHaveProperty('ballots');
          expect(own.public).not.toHaveProperty('rps');
          expect(own.public).not.toHaveProperty('used');
          if (!own.public.result && !own.public.eliminated.includes(v.playerId))
            expect(own.private.solution).toBeNull();
          if (
            own.public.prompt?.actor === v.playerId &&
            own.public.phase === 'reactions'
          )
            expect(own.private.solution).toBeNull();
        }
      const oldRound = snapshot().round;
      await req(sockets[host()]!, 'start', {});
      expect(snapshot().round).toBe(oldRound + 1);
      expect(game().public.phase).toBe('setup');
      expect(Object.values(game().public.scores).every((n) => n === 0)).toBe(
        true,
      );
      expect(
        (
          await raw(sockets[0]!, 'action', {
            ...requests[0],
            revision: snapshot().revision,
          })
        ).code,
      ).toBe('MATCH_CHANGED');
    } finally {
      for (const s of all) s.disconnect();
      await new Promise<void>((resolve) =>
        server.close(() => http.close(() => resolve())),
      );
    }
  }, 30000);
test('expired replacement keeps actor-owned reaction and rotates credentials', () => {
  let now = 0;
  const rooms = new Rooms(
    new Map([['little-secret', littleSecret]]),
    5,
    () => now,
    seeded(5),
  );
  const a = rooms.create('a', { gameId: 'little-secret', name: 'A' });
  rooms.join('b', { roomId: a.roomId, name: 'B' });
  rooms.join('c', { roomId: a.roomId, name: 'C' });
  rooms.start(a.roomId, 'a');
  const room = rooms.rooms.get(a.roomId)!;
  const s = room.state as State;
  s.phase = 'reactions';
  s.prompt = { kind: 'revenant', actor: a.playerId, id: 'pending' };
  s.eliminated = [a.playerId];
  rooms.disconnect('a');
  now = 6;
  rooms.sweep();
  const replacement = rooms.join('d', { roomId: a.roomId, name: 'D' });
  expect(replacement.credentials.playerId).toBe(a.playerId);
  expect(replacement.credentials.token).not.toBe(a.token);
  expect((rooms.view(a.roomId, 'd').game as View).public.prompt?.id).toBe(
    'pending',
  );
  expect(() => rooms.join('e', { ...a, name: 'Old' })).toThrow();
});
