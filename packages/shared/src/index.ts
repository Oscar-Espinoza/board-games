import { m } from './paraglide/messages.js';
import type { GameView, Player } from '@board-games/game-core';
/** Metadata only: importing the catalog cannot import game rules or presentation. */
export const catalog = [
  {
    id: 'uno',
    name: 'UNO',
    minPlayers: 2,
    maxPlayers: 8,
    description: m.uno_description,
    preview: 'cards',
    practice: true,
  },
  {
    id: 'catan',
    name: 'Catan',
    minPlayers: 3,
    maxPlayers: 6,
    description: m.catan_description,
    preview: 'hexes',
    setupModes: ['variable', 'beginner'],
  },
  {
    id: 'carcassonne',
    name: 'Carcassonne',
    minPlayers: 2,
    maxPlayers: 6,
    description: m.carc_description,
    preview: 'landscape',
  },
  {
    id: 'azul',
    name: 'Azul',
    minPlayers: 2,
    maxPlayers: 4,
    description: m.azul_description,
    preview: 'tiles',
  },
  {
    id: 'codenames',
    name: 'Codenames',
    minPlayers: 4,
    maxPlayers: 12,
    description: m.cn_description,
    preview: 'dossiers',
  },
  {
    id: 'sushi-go-party',
    name: 'Sushi Go Party!',
    minPlayers: 2,
    maxPlayers: 8,
    description: m.sgp_description,
    preview: 'sushi',
  },
  {
    id: 'little-secret',
    name: 'Little Secret',
    minPlayers: 3,
    maxPlayers: 9,
    description: m.ls_description,
    preview: 'envelopes',
  },
  {
    id: 'domino',
    name: 'Dominó',
    minPlayers: 4,
    maxPlayers: 4,
    description: m.domino_description,
    preview: 'dominoes',
  },
] as const;
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
