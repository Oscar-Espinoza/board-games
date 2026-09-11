import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { GameDefinition } from '@board-games/game-core';
import type { ActionRequest, Credentials, RoomView } from '@board-games/shared';

type Seat = {
  id: string;
  name: string;
  token: string;
  bot?: boolean;
  socketId: string | null;
  reservedUntil: number | null;
  accepted: Map<string, number>;
};
type Room = {
  id: string;
  definition: GameDefinition;
  seats: Seat[];
  hostId: string;
  state: unknown;
  options: unknown;
  practice: boolean;
  botAt: number;
  round: number;
  revision: number;
  touched: number;
};
const fail = (message: string): never => {
  throw new Error(message);
};
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail('Invalid request');
  return (value as string).trim();
}
function matches(a: string, b: unknown) {
  return (
    a.length > 0 &&
    typeof b === 'string' &&
    Buffer.byteLength(b) === Buffer.byteLength(a) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
/** In-memory authority. Tokens and canonical state never appear in a room projection. */
export class Rooms {
  readonly rooms = new Map<string, Room>();
  constructor(
    readonly games: Map<string, GameDefinition>,
    readonly graceMs = 120_000,
    readonly now = Date.now,
    readonly random = Math.random,
  ) {}
  private room(id: unknown) {
    return this.rooms.get(text(id, 64)) ?? fail('Room not found');
  }
  private seat(room: Room, socketId: string) {
    return (
      room.seats.find((s) => s.socketId === socketId) ??
      fail('Join the room first')
    );
  }
  private ensureUnbound(socketId: string) {
    for (const room of this.rooms.values())
      if (room.seats.some((s) => s.socketId === socketId))
        fail('Already in a room');
  }
  private newSeat(name: unknown, socketId: string): Seat {
    return {
      id: randomUUID(),
      name: text(name, 32),
      token: randomBytes(32).toString('hex'),
      socketId,
      reservedUntil: null,
      accepted: new Map(),
    };
  }
  private credentials(room: Room, seat: Seat): Credentials {
    return { roomId: room.id, playerId: seat.id, token: seat.token };
  }
  create(
    socketId: string,
    request: { gameId?: unknown; name?: unknown; options?: unknown },
  ): Credentials {
    this.ensureUnbound(socketId);
    if (this.rooms.size >= 64) fail('Too many rooms');
    const definition =
      this.games.get(text(request.gameId, 32)) ?? fail('Unknown game');
    const practice = !!(
      request.options &&
      typeof request.options === 'object' &&
      'practice' in request.options &&
      request.options.practice === true
    );
    if (practice && !definition.botAction)
      fail('Practice is not available for this game');
    const seat = this.newSeat(request.name, socketId);
    const room: Room = {
      id: randomBytes(9).toString('base64url'),
      definition,
      seats: [seat],
      hostId: seat.id,
      state: null,
      options: request.options,
      practice,
      botAt: this.now() + 900,
      round: 0,
      revision: 0,
      touched: this.now(),
    };
    if (practice) {
      for (const name of ['Luna', 'Mateo', 'Sol'].slice(
        0,
        definition.maxPlayers - 1,
      )) {
        room.seats.push({
          id: randomUUID(),
          name,
          token: '',
          socketId: null,
          reservedUntil: null,
          accepted: new Map(),
          bot: true,
        });
      }
      room.state = definition.create(
        room.seats.map((s) => s.id),
        this.random,
        room.options,
      );
      room.round = 1;
      room.revision = 1;
    }
    this.rooms.set(room.id, room);
    return this.credentials(room, seat);
  }
  join(
    socketId: string,
    request: { roomId?: unknown; name?: unknown; token?: unknown },
  ): { credentials: Credentials; replacedSocket: string | null } {
    this.ensureUnbound(socketId);
    const room = this.room(request.roomId);
    this.expire(room);
    // Invalid/expired credentials are explicit errors: never silently claim another seat.
    if (request.token !== undefined) {
      const seat =
        room.seats.find((s) => matches(s.token, request.token)) ??
        fail('Reconnect token expired or invalid');
      const replacedSocket = seat.socketId;
      seat.socketId = socketId;
      seat.reservedUntil = null;
      room.touched = this.now();
      return { credentials: this.credentials(room, seat), replacedSocket };
    }
    if (room.practice) fail('Practice rooms are private');
    const vacant = room.seats.find(
      (s) => s.socketId === null && s.reservedUntil === null,
    );
    if (!vacant && room.state !== null) fail('No available seat');
    if (!vacant && room.seats.length >= room.definition.maxPlayers)
      fail('Room is full');
    const incoming = this.newSeat(request.name, socketId);
    // Active-game replacement keeps the game seat ID, but rotates the secret and display name.
    const seat = vacant ?? incoming;
    if (vacant)
      Object.assign(vacant, {
        name: incoming.name,
        token: incoming.token,
        socketId,
        reservedUntil: null,
        accepted: new Map(),
      });
    else room.seats.push(seat);
    this.promoteHost(room);
    room.revision++;
    room.touched = this.now();
    return { credentials: this.credentials(room, seat), replacedSocket: null };
  }
  start(roomId: string, socketId: string) {
    const room = this.room(roomId);
    const seat = this.seat(room, socketId);
    if (seat.id !== room.hostId) fail('Only the room host can start');
    if (room.state !== null && !room.definition.isFinished(room.state))
      fail('Game already started');
    if (room.seats.some((s) => !s.socketId && !s.bot))
      fail('Wait for every seat to connect');
    if (room.seats.length < room.definition.minPlayers)
      fail('Not enough players');
    room.state = room.definition.create(
      room.seats.map((s) => s.id),
      this.random,
      room.options,
    );
    room.botAt = this.now() + 900;
    room.round++;
    room.revision++;
    room.touched = this.now();
    for (const s of room.seats) s.accepted.clear();
  }
  action(roomId: string, socketId: string, request: ActionRequest) {
    const room = this.room(roomId);
    const seat = this.seat(room, socketId);
    const id = text(request.id, 64);
    if (request.round !== room.round) fail('Round changed; try again');
    if (seat.accepted.has(id)) return;
    if (request.revision !== room.revision) fail('Table updated; try again');
    if (room.state === null) fail('Game has not started');
    room.state = room.definition.apply(
      room.state,
      seat.id,
      request.action,
      this.random,
    );
    room.revision++;
    room.botAt = this.now() + 900;
    room.touched = this.now();
    seat.accepted.set(id, room.revision);
    if (seat.accepted.size > 256)
      seat.accepted.delete(seat.accepted.keys().next().value!);
  }
  disconnect(socketId: string): string | null {
    for (const room of this.rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socketId);
      if (!seat) continue;
      seat.socketId = null;
      seat.reservedUntil = this.now() + this.graceMs;
      room.revision++;
      room.touched = this.now();
      this.promoteHost(room);
      return room.id;
    }
    return null;
  }
  private promoteHost(room: Room) {
    if (!room.seats.some((s) => s.id === room.hostId && s.socketId))
      room.hostId = room.seats.find((s) => s.socketId)?.id ?? room.hostId;
  }
  private expire(room: Room) {
    let changed = false;
    for (const seat of room.seats) {
      if (
        seat.socketId === null &&
        seat.reservedUntil !== null &&
        seat.reservedUntil <= this.now()
      ) {
        seat.token = '';
        seat.reservedUntil = null;
        seat.accepted.clear();
        changed = true;
      }
    }
    if (room.state === null)
      room.seats = room.seats.filter(
        (s) => s.socketId !== null || s.reservedUntil !== null,
      );
    if (changed) {
      room.revision++;
      this.promoteHost(room);
    }
    return changed;
  }
  /** At most one accepted bot intention per room/tick so plays stay readable. */
  advanceBots(): string[] {
    const changed: string[] = [];
    for (const room of this.rooms.values()) {
      if (
        !room.practice ||
        !room.definition.botAction ||
        room.state === null ||
        room.definition.isFinished(room.state) ||
        this.now() < room.botAt ||
        !room.seats.some((s) => !s.bot && s.socketId)
      )
        continue;
      for (const seat of room.seats.filter((s) => s.bot)) {
        const action = room.definition.botAction(
          room.definition.view(room.state, seat.id),
        );
        if (action === null) continue;
        room.state = room.definition.apply(
          room.state,
          seat.id,
          action,
          this.random,
        );
        room.revision++;
        room.touched = this.now();
        room.botAt = this.now() + 900;
        changed.push(room.id);
        break;
      }
    }
    return changed;
  }
  sweep(): string[] {
    const changed: string[] = [];
    for (const room of this.rooms.values()) {
      if (this.expire(room)) changed.push(room.id);
      // Empty abandoned games are collected, even when browser tabs stay open elsewhere.
      if (
        !room.seats.some((s) => s.socketId) &&
        this.now() - room.touched > Math.max(this.graceMs, 3_600_000)
      )
        this.rooms.delete(room.id);
    }
    return changed;
  }
  sockets(roomId: string) {
    return (
      this.rooms
        .get(roomId)
        ?.seats.flatMap((s) => (s.socketId ? [s.socketId] : [])) ?? []
    );
  }
  view(roomId: string, socketId: string): RoomView {
    const room = this.room(roomId);
    const seat = this.seat(room, socketId);
    return {
      id: room.id,
      gameId: room.definition.id,
      practice: room.practice,
      hostId: room.hostId,
      playerId: seat.id,
      players: room.seats.map((s) => ({
        id: s.id,
        name: s.name,
        connected: !!s.bot || s.socketId !== null,
        ...(s.bot ? { bot: true } : {}),
        reservedUntil: s.reservedUntil,
      })),
      status:
        room.state === null
          ? 'lobby'
          : room.definition.isFinished(room.state)
            ? 'finished'
            : 'playing',
      revision: room.revision,
      round: room.round,
      game:
        room.state === null ? null : room.definition.view(room.state, seat.id),
    };
  }
}
