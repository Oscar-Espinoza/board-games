import { m } from './paraglide/messages.js';
import type { GameView, Player } from '@board-games/game-core';
/** Metadata only: importing the catalog cannot import game rules or presentation. */
export const catalog = [
  {
    id: 'uno',
    name: 'UNO',
    minPlayers: 2,
    maxPlayers: 8,
    mark: '↺',
    description: m.uno_description,
    preview: 'cards',
    practice: true,
  },
  {
    id: 'catan',
    name: 'Catan',
    minPlayers: 3,
    maxPlayers: 6,
    mark: '⬡',
    description: m.catan_description,
    preview: 'hexes',
    setupModes: ['variable', 'beginner'],
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
export type Reply<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };
export type ActionRequest = {
  id: string;
  round: number;
  revision: number;
  action: unknown;
};
