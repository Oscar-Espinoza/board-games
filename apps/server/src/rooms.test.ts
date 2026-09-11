import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uno, type State } from '@board-games/uno/server';
import { Rooms } from './rooms.ts';

function fixture(grace = 1000) {
  let time = 10_000;
  const rooms = new Rooms(
    new Map([['uno', uno]]),
    grace,
    () => time,
    () => 0.37,
  );
  const host = rooms.create('host', { gameId: 'uno', name: 'Host' });
  const guest = rooms.join('guest', {
    roomId: host.roomId,
    name: 'Guest',
  }).credentials;
  return {
    rooms,
    host,
    guest,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
function action(
  rooms: Rooms,
  room: string,
  socket: string,
  id: string,
  intention: unknown = { type: 'DRAW' },
) {
  const view = rooms.view(room, socket);
  return { id, round: view.round, revision: view.revision, action: intention };
}

test('rooms enforce game registry, seat limits, one room per socket and host-only start', () => {
  const { rooms, host } = fixture();
  assert.throws(
    () => rooms.create('bad', { gameId: 'missing', name: 'A' }),
    /Unknown game/,
  );
  assert.throws(
    () => rooms.create('bad', { gameId: 'uno', name: ' ' }),
    /Invalid request/,
  );
  assert.throws(
    () => rooms.create('host', { gameId: 'uno', name: 'Other' }),
    /Already/,
  );
  assert.throws(() => rooms.start(host.roomId, 'guest'), /Only the room host/);
  for (let i = 2; i < 8; i++)
    rooms.join(`seat${i}`, { roomId: host.roomId, name: `Seat ${i}` });
  assert.throws(
    () => rooms.join('ninth', { roomId: host.roomId, name: 'Ninth' }),
    /full/,
  );
  rooms.start(host.roomId, 'host');
  assert.equal(rooms.view(host.roomId, 'guest').status, 'playing');
  assert.throws(() => rooms.start(host.roomId, 'host'), /already started/);
});

test('start requires minimum players and every reserved seat connected', () => {
  const rooms = new Rooms(new Map([['uno', uno]]));
  const host = rooms.create('host', { gameId: 'uno', name: 'Host' });
  assert.throws(() => rooms.start(host.roomId, 'host'), /Not enough/);
  rooms.join('guest', { roomId: host.roomId, name: 'Guest' });
  rooms.disconnect('guest');
  assert.throws(() => rooms.start(host.roomId, 'host'), /every seat/);
});

test('same display name cannot claim a reserved seat and malformed tokens never reconnect', () => {
  const { rooms, host, guest } = fixture();
  rooms.start(host.roomId, 'host');
  rooms.disconnect('guest');
  assert.throws(
    () => rooms.join('attacker', { roomId: host.roomId, name: 'Guest' }),
    /No available seat/,
  );
  for (const token of [
    '',
    'wrong',
    'é'.repeat(64),
    'a'.repeat(63),
    null,
    123,
  ]) {
    assert.throws(
      () =>
        rooms.join('attacker', { roomId: host.roomId, name: 'Guest', token }),
      /token expired or invalid/,
    );
  }
  const recovered = rooms.join('recovered', {
    roomId: host.roomId,
    token: guest.token,
  }).credentials;
  assert.equal(recovered.playerId, guest.playerId);
  assert.equal(
    rooms
      .view(host.roomId, 'recovered')
      .players.find((p) => p.id === guest.playerId)?.name,
    'Guest',
  );
  assert.throws(() => rooms.view(host.roomId, 'attacker'), /Join the room/);
});

test('expired active seats preserve game identity, rotate credentials and invalidate old tokens', () => {
  const { rooms, host, guest, advance } = fixture();
  rooms.start(host.roomId, 'host');
  const priorHand = rooms.view(host.roomId, 'guest').game?.private;
  rooms.disconnect('guest');
  advance(1000);
  assert.deepEqual(rooms.sweep(), [host.roomId]);
  assert.throws(
    () => rooms.join('old', { roomId: host.roomId, token: guest.token }),
    /token expired or invalid/,
  );
  assert.throws(
    () => rooms.join('empty', { roomId: host.roomId, token: '' }),
    /token expired or invalid/,
  );
  const replacement = rooms.join('replacement', {
    roomId: host.roomId,
    name: 'New friend',
  }).credentials;
  assert.equal(replacement.playerId, guest.playerId);
  assert.notEqual(replacement.token, guest.token);
  assert.deepEqual(
    rooms.view(host.roomId, 'replacement').game?.private,
    priorHand,
  );
  assert.throws(
    () => rooms.join('old', { roomId: host.roomId, token: guest.token }),
    /token expired or invalid/,
  );
});

test('replacement socket generation remains connected after the obsolete socket disconnects', () => {
  const { rooms, host, guest } = fixture();
  const replacement = rooms.join('new-guest', {
    roomId: host.roomId,
    token: guest.token,
  });
  assert.equal(replacement.replacedSocket, 'guest');
  assert.equal(rooms.disconnect('guest'), null);
  assert.deepEqual(rooms.sockets(host.roomId), ['host', 'new-guest']);
  assert.equal(
    rooms.view(host.roomId, 'new-guest').players.every((p) => p.connected),
    true,
  );
  assert.throws(() => rooms.start(host.roomId, 'guest'), /Join/);
});

test('duplicate accepted intentions apply once, stale/invalid intentions cannot alter authority', () => {
  const { rooms, host } = fixture();
  rooms.start(host.roomId, 'host');
  const first = action(rooms, host.roomId, 'host', 'first');
  const stale = action(rooms, host.roomId, 'guest', 'stale');
  rooms.action(host.roomId, 'host', first);
  const after = structuredClone(rooms.view(host.roomId, 'host'));
  rooms.action(host.roomId, 'host', first);
  assert.deepEqual(rooms.view(host.roomId, 'host'), after);
  assert.throws(
    () => rooms.action(host.roomId, 'guest', stale),
    /Table updated/,
  );
  assert.throws(
    () => rooms.action(host.roomId, 'guest', { ...stale, round: 0 }),
    /Round changed/,
  );
  assert.throws(
    () =>
      rooms.action(
        host.roomId,
        'guest',
        action(rooms, host.roomId, 'guest', 'forged', {
          type: 'PLAY_CARD',
          cardId: 999,
        }),
      ),
    /not in your hand/,
  );
  assert.deepEqual(rooms.view(host.roomId, 'host'), after);
  rooms.action(
    host.roomId,
    'guest',
    action(rooms, host.roomId, 'guest', 'valid'),
  );
  assert.equal(rooms.view(host.roomId, 'host').revision, after.revision + 1);
});

test('room snapshots contain no secrets, stock order, opponent hands or other legal actions', () => {
  const { rooms, host, guest } = fixture();
  rooms.start(host.roomId, 'host');
  const hostView = rooms.view(host.roomId, 'host');
  const guestView = rooms.view(host.roomId, 'guest');
  assert.deepEqual(hostView.game?.public, guestView.game?.public);
  const canonical = rooms.rooms.get(host.roomId)!.state as State;
  assert.deepEqual(
    (hostView.game?.private as any).hand.map((c: any) => c.id),
    canonical.hands[0]!.map((c) => c.id).sort((a, b) => a - b),
  );
  assert.deepEqual(
    (guestView.game?.private as any).hand.map((c: any) => c.id),
    canonical.hands[1]!.map((c) => c.id).sort((a, b) => a - b),
  );
  for (const view of [hostView, guestView]) {
    const json = JSON.stringify(view);
    assert.equal(json.includes(host.token), false);
    assert.equal(json.includes(guest.token), false);
    assert.equal(json.includes('"token"'), false);
    assert.equal(json.includes('"stock"'), false);
    assert.equal(json.includes('"hands"'), false);
    assert.equal(json.includes('"accepted"'), false);
  }
});

test('host promotion, lobby expiry and abandoned room collection use the configured clock', () => {
  const { rooms, host, guest, advance } = fixture();
  rooms.disconnect('host');
  assert.equal(rooms.view(host.roomId, 'guest').hostId, guest.playerId);
  advance(1000);
  rooms.sweep();
  assert.equal(rooms.view(host.roomId, 'guest').players.length, 1);
  const newSeat = rooms.join('new-host', {
    roomId: host.roomId,
    name: 'Host',
  }).credentials;
  assert.notEqual(newSeat.playerId, host.playerId);
  rooms.disconnect('guest');
  rooms.disconnect('new-host');
  advance(3_600_001);
  rooms.sweep();
  assert.equal(rooms.rooms.size, 0);
});

test('private practice starts with three bots, progresses, pauses and reconnects without exposing bot hands', () => {
  let time = 0;
  const rooms = new Rooms(
    new Map([['uno', uno]]),
    1000,
    () => time,
    () => 0.37,
  );
  const host = rooms.create('host', {
    gameId: 'uno',
    name: 'Me',
    options: { practice: true },
  });
  const first = rooms.view(host.roomId, 'host');
  assert.equal(first.practice, true);
  assert.equal(first.status, 'playing');
  assert.equal(first.players.filter((p) => p.bot && p.connected).length, 3);
  assert.deepEqual(rooms.sockets(host.roomId), ['host']);
  assert.throws(
    () => rooms.join('stranger', { roomId: host.roomId, name: 'Me' }),
    /private/,
  );
  rooms.action(host.roomId, 'host', action(rooms, host.roomId, 'host', 'draw'));
  const afterDraw = rooms.view(host.roomId, 'host');
  assert.deepEqual(rooms.advanceBots(), []);
  time += 900;
  assert.deepEqual(rooms.advanceBots(), [host.roomId]);
  const afterBot = rooms.view(host.roomId, 'host');
  assert.equal(afterBot.revision, afterDraw.revision + 1);
  const state = rooms.rooms.get(host.roomId)!.state as State;
  assert.deepEqual(
    (afterBot.game?.private as any).hand.map((c: any) => c.id),
    state.hands[0]!.map((c) => c.id).sort((a, b) => a - b),
  );
  const json = JSON.stringify(afterBot);
  for (const secret of ['"hands"', '"stock"', '"token"'])
    assert.equal(json.includes(secret), false);
  rooms.disconnect('host');
  const pausedRevision = state.revision;
  time += 900;
  assert.deepEqual(rooms.advanceBots(), []);
  assert.equal(
    (rooms.rooms.get(host.roomId)!.state as State).revision,
    pausedRevision,
  );
  rooms.join('returned', { roomId: host.roomId, token: host.token });
  assert.equal(rooms.view(host.roomId, 'returned').playerId, host.playerId);
  assert.deepEqual(rooms.advanceBots(), [host.roomId]);
  const finished = rooms.rooms.get(host.roomId)!.state as State;
  finished.phase = 'finished';
  time += 900;
  assert.deepEqual(rooms.advanceBots(), []);
  rooms.start(host.roomId, 'returned');
  assert.equal(rooms.view(host.roomId, 'returned').round, 2);
  rooms.disconnect('returned');
  time += 1001;
  rooms.sweep();
  assert.throws(
    () => rooms.join('expired', { roomId: host.roomId, token: host.token }),
    /expired/,
  );
  assert.throws(
    () => rooms.join('stranger', { roomId: host.roomId, name: 'Me' }),
    /private/,
  );
  time += 3_600_001;
  rooms.sweep();
  assert.equal(rooms.rooms.size, 0);
});

test('practice support belongs to the game contract and leaves normal rooms unchanged', () => {
  const noBots = { ...uno, id: 'no-bots', botAction: undefined };
  const rooms = new Rooms(new Map([['no-bots', noBots]]));
  assert.throws(
    () =>
      rooms.create('host', {
        gameId: 'no-bots',
        name: 'Me',
        options: { practice: true },
      }),
    /not available/,
  );
  assert.equal(rooms.rooms.size, 0);
  const host = rooms.create('host', { gameId: 'no-bots', name: 'Me' });
  assert.equal(rooms.view(host.roomId, 'host').status, 'lobby');
  assert.deepEqual(rooms.advanceBots(), []);
});
