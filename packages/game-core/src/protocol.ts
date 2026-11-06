import type { GameView, Player } from './index.js';

/** Socket protocol between the Bun room authority and the browser session. */
export type RoomView = {
  id: string;
  gameId: string;
  practice: boolean;
  hostId: string;
  playerId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  revision: number;
  round: number;
  game: GameView | null;
};
export type Credentials = { roomId: string; playerId: string; token: string };
export type ReplyErrorCode = 'STALE_REVISION' | 'MATCH_CHANGED';
export type Reply<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; code?: ReplyErrorCode };
export type Synchronization = { room: RoomView; accepted: boolean };
export type ActionRequest = {
  id: string;
  round: number;
  revision: number;
  action: unknown;
};
