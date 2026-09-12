import { test, expect } from 'bun:test';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { Rooms } from './rooms.js';
import { attachSockets } from './socket.js';
import {
  sushiGoParty,
  view,
  type State,
  type Pick,
} from '@board-games/sushi-go-party/server';
import {
  seeded,
  arrangeHand,
} from '../../../games/sushi-go-party/src/practice.js';
import { presets } from '../../../games/sushi-go-party/src/menus.js';
import type { Credentials, RoomView, Reply } from '@board-games/shared';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fixture(count: number, setup?: (s: State) => State) {
  const server = createServer();
  let time = 10000;
  const rules = setup
    ? {
        ...sushiGoParty,
        create: (players: string[], random: () => number) =>
          setup(sushiGoParty.create(players, random)),
      }
    : sushiGoParty;
  const rooms = new Rooms(
    new Map([['sushi-go-party', rules]]),
    100,
    () => time,
    seeded(52),
  );
  const io = attachSockets(server, rooms);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const sockets: Socket[] = [];
  const payloads: RoomView[][] = [];
  const creds: Credentials[] = [];
  async function client() {
    const socket = connect(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const index = sockets.length;
    sockets.push(socket);
    payloads.push([]);
    socket.on('snapshot', (p: RoomView) => payloads[index].push(p));
    await new Promise<void>((r) => socket.once('connect', r));
    return socket;
  }
  async function raw(
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<Reply<any>> {
    return socket.timeout(3000).emitWithAck(event, payload);
  }
  async function request(socket: Socket, event: string, payload: unknown) {
    const result = await raw(socket, event, payload);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }
  for (let i = 0; i < count; i++) {
    const socket = await client();
    creds.push(
      await request(
        socket,
        i ? 'join' : 'create',
        i
          ? { roomId: creds[0].roomId, name: `Guest ${i}` }
          : { gameId: 'sushi-go-party', name: 'Host' },
      ),
    );
  }
  const current = (i: number) => rooms.view(creds[0].roomId, sockets[i].id!);
  const projected = (i: number) => current(i).game as ReturnType<typeof view>;
  let serial = 0;
  async function action(i: number, intention: unknown) {
    const v = current(i);
    const payload = {
      id: `request-${++serial}`,
      round: v.round,
      revision: v.revision,
      action: intention,
    };
    const result = await raw(sockets[i], 'action', payload);
    if (!result.ok) throw new Error(result.error);
    return payload;
  }
  async function start(menu = presets.first) {
    await request(sockets[0], 'start', {});
    await action(0, { type: 'SET_MENU', version: 0, menu });
    for (let i = 0; i < count; i++)
      await action(i, { type: 'READY', round: 0, version: 1 });
  }
  const pick = (i: number, cardIndex = 0): Pick => {
    const v = projected(i);
    return {
      type: 'PICK',
      round: v.public.round,
      turn: v.public.turn,
      promptId: v.private.pickPromptId!,
      card: v.private.hand[cardIndex].handle,
      utensils: [],
      ...(v.private.hand[cardIndex].kind === 'special_order' &&
      v.private.copyTargets.length
        ? { copyTarget: v.private.copyTargets[0].id }
        : {}),
    };
  };
  return {
    rooms,
    sockets,
    payloads,
    creds,
    client,
    current,
    projected,
    action,
    start,
    pick,
    raw,
    request,
    advance: () => (time += 500),
    close: async () => {
      sockets.forEach((s) => s.disconnect());
      await new Promise<void>((r) => io.close(() => r()));
    },
  };
}
test('real minimum/maximum socket clients concurrently READY and PICK with safe same-id revision retries; recipients never receive other hands', async () => {
  for (const count of [2, 8]) {
    const f = await fixture(count);
    try {
      await f.request(f.sockets[0], 'start', {});
      const initial = f.current(0);
      const ready = Array.from({ length: count }, (_, i) => ({
        id: `ready-${i}`,
        round: initial.round,
        revision: initial.revision,
        action: { type: 'READY', round: 0, version: 0 },
      }));
      const result = await Promise.all(
        f.sockets.map((s, i) => f.raw(s, 'action', ready[i])),
      );
      expect(result.filter((r) => r.ok)).toHaveLength(1);
      for (let i = 0; i < count; i++)
        if (!result[i].ok) {
          expect((result[i] as { code: string }).code).toBe('STALE_REVISION');
          ready[i].revision = f.current(i).revision;
          expect((await f.raw(f.sockets[i], 'action', ready[i])).ok).toBe(true);
        }
      const original = f.projected(0),
        revision = f.current(0).revision;
      const picks = f.sockets.map((_, i) => ({
        id: `pick-${i}`,
        round: initial.round,
        revision,
        action: f.pick(i),
      }));
      const replies = await Promise.all(
        f.sockets.map((s, i) => f.raw(s, 'action', picks[i])),
      );
      expect(replies.filter((r) => r.ok)).toHaveLength(1);
      for (let i = 0; i < count; i++)
        if (!replies[i].ok) {
          picks[i].revision = f.current(i).revision;
          expect((await f.raw(f.sockets[i], 'action', picks[i])).ok).toBe(true);
        }
      expect(f.projected(0).public.turn).toBe(2);
      const after = f.current(0).revision;
      expect((await f.raw(f.sockets[0], 'action', picks[0])).ok).toBe(true);
      expect(f.current(0).revision).toBe(after);
      const sync = await f.request(f.sockets[0], 'sync', {
        id: picks[0].id,
        round: initial.round,
      });
      expect(sync.accepted).toBe(true);
      const stale = await f.raw(f.sockets[0], 'action', {
        ...picks[0],
        id: 'old-hand-new-id',
        revision: after,
      });
      expect(stale.ok).toBe(false);
      await pause(20);
      for (let i = 0; i < count; i++)
        for (const payload of f.payloads[i]) {
          const text = JSON.stringify(payload);
          expect(text).not.toContain('physical-');
          expect(text).not.toContain('"deck"');
          expect(text).not.toContain('"reserve"');
          if (i !== 0)
            for (const card of original.private.hand)
              expect(text).not.toContain(card.handle);
          for (let other = 0; other < count; other++)
            if (other !== i) expect(text).not.toContain(f.creds[other].token);
        }
      const spy = await f.client();
      expect(
        (
          await f.raw(spy, 'action', {
            ...picks[0],
            playerId: f.creds[0].playerId,
          })
        ).ok,
      ).toBe(false);
      const spoof = await f.raw(f.sockets[1], 'action', {
        id: 'spoof',
        round: initial.round,
        revision: f.current(1).revision,
        playerId: f.creds[0].playerId,
        action: { ...f.pick(0) },
      });
      expect(spoof.ok).toBe(false);
    } finally {
      await f.close();
    }
  }
}, 20000);
test('real sockets preserve before/after-commit reconnect; expired replacement inherits hand and host migrates', async () => {
  const f = await fixture(2);
  try {
    await f.start();
    const original = f.projected(0).private.hand;
    const before = f.projected(1).private.hand;
    await f.action(0, f.pick(0));
    f.sockets[0].disconnect();
    await pause(15);
    const paused = await f.raw(f.sockets[1], 'action', {
      id: 'paused',
      round: f.current(1).round,
      revision: f.current(1).revision,
      action: f.pick(1),
    });
    expect(paused.ok).toBe(false);
    const resumed = await f.client();
    await f.request(resumed, 'join', {
      roomId: f.creds[0].roomId,
      token: f.creds[0].token,
    });
    const rv = f.rooms.view(f.creds[0].roomId, resumed.id!);
    expect((rv.game as ReturnType<typeof view>).private.hand).toEqual(original);
    expect(
      (rv.game as ReturnType<typeof view>).private.committed,
    ).not.toBeNull();
    f.sockets[1].disconnect();
    await pause(15);
    f.advance();
    const replacement = await f.client();
    const replacementCredentials = await f.request(replacement, 'join', {
      roomId: f.creds[0].roomId,
      name: 'New guest',
    });
    expect(replacementCredentials.playerId).toBe(f.creds[1].playerId);
    const replaced = f.rooms.view(f.creds[0].roomId, replacement.id!);
    expect((replaced.game as ReturnType<typeof view>).private.hand).toEqual(
      before,
    );
    const attacker = await f.client();
    expect(
      (
        await f.raw(attacker, 'join', {
          roomId: f.creds[0].roomId,
          token: f.creds[1].token,
        })
      ).ok,
    ).toBe(false);
    resumed.disconnect();
    await pause(15);
    f.advance();
    f.rooms.sweep();
    expect(f.rooms.view(f.creds[0].roomId, replacement.id!).hostId).toBe(
      replacementCredentials.playerId,
    );
  } finally {
    await f.close();
  }
}, 15000);

test('real Menu and Spoon supplier prompts reconnect with identical recipient-only choices', async () => {
  const { apply } = await import('@board-games/sushi-go-party/server');
  for (const effect of ['menu', 'supplier'] as const) {
    const random = seeded(735);
    const f = await fixture(effect === 'menu' ? 2 : 3, (s) => {
      const menu = effect === 'menu' ? presets.sampler : presets.master;
      s = apply(
        s,
        s.players[0],
        { type: 'SET_MENU', version: 0, menu },
        random,
      );
      for (const player of s.players)
        s = apply(
          s,
          player,
          { type: 'READY', round: 0, version: s.setupVersion },
          random,
        );
      arrangeHand(s, 0, [effect === 'menu' ? 'menu' : 'spoon']);
      for (let i = 1; i < s.players.length; i++) arrangeHand(s, i, ['tofu']);
      if (effect === 'supplier') {
        for (let i = 0; i < s.players.length; i++) {
          const v = view(s, s.players[i]);
          s = apply(
            s,
            s.players[i],
            {
              type: 'PICK',
              round: s.round,
              turn: s.turn,
              promptId: v.private.pickPromptId!,
              card: v.private.hand[0].handle,
              utensils: [],
            },
            random,
          );
        }
        arrangeHand(s, 0, ['tofu']);
        arrangeHand(s, 1, ['tofu', ['nigiri', 'egg'], ['nigiri', 'squid']]);
        arrangeHand(s, 2, ['tofu']);
      }
      return s;
    });
    try {
      await f.request(f.sockets[0], 'start', {});
      for (let i = 0; i < (effect === 'menu' ? 2 : 3); i++) {
        const p = f.pick(i);
        if (effect === 'supplier' && i === 0)
          p.utensils = f.projected(0).private.legalUtensils;
        await f.action(i, p);
      }
      if (effect === 'supplier') {
        const v = f.projected(0);
        await f.action(0, {
          type: 'RESOLVE',
          round: v.public.round,
          turn: v.public.turn,
          promptId: v.private.prompt!.id,
          choice: { type: 'request', kind: 'nigiri' },
        });
      }
      const actor = effect === 'menu' ? 0 : 1;
      const saved = f.projected(actor).private;
      expect(saved.prompt?.kind).toBe(effect);
      expect(saved.prompt!.cards.length).toBeGreaterThan(1);
      for (let i = 0; i < (effect === 'menu' ? 2 : 3); i++)
        if (i !== actor) {
          expect(f.projected(i).private.prompt).toBeNull();
          for (const c of saved.prompt!.cards)
            expect(JSON.stringify(f.projected(i))).not.toContain(c.handle);
        }
      f.sockets[actor].disconnect();
      await pause(15);
      const newSocket = await f.client();
      await f.request(newSocket, 'join', {
        roomId: f.creds[0].roomId,
        token: f.creds[actor].token,
      });
      const v = f.rooms.view(f.creds[0].roomId, newSocket.id!);
      expect((v.game as ReturnType<typeof view>).private).toEqual(saved);
      const input = {
        id: `resolve-${effect}`,
        round: v.round,
        revision: v.revision,
        action: {
          type: 'RESOLVE',
          round: (v.game as ReturnType<typeof view>).public.round,
          turn: (v.game as ReturnType<typeof view>).public.turn,
          promptId: saved.prompt!.id,
          choice: { type: 'card', card: saved.prompt!.cards[0].handle },
        },
      };
      expect((await f.raw(newSocket, 'action', input)).ok).toBe(true);
      const revision = f.rooms.view(f.creds[0].roomId, newSocket.id!).revision;
      expect((await f.raw(newSocket, 'action', input)).ok).toBe(true);
      expect(f.rooms.view(f.creds[0].roomId, newSocket.id!).revision).toBe(
        revision,
      );
    } finally {
      await f.close();
    }
  }
}, 15000);
