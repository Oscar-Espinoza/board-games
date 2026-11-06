/**
 * Every game's identity and seat limits. Rules, the room server and the catalog all read
 * these, so this module stays free of messages and presentation.
 */
export const games = {
  uno: { name: 'UNO', minPlayers: 2, maxPlayers: 8, practice: 'room' },
  catan: { name: 'Catan', minPlayers: 3, maxPlayers: 6, practice: 'local' },
  carcassonne: {
    name: 'Carcassonne',
    minPlayers: 2,
    maxPlayers: 6,
    practice: 'local',
  },
  azul: { name: 'Azul', minPlayers: 2, maxPlayers: 4, practice: 'local' },
  codenames: {
    name: 'Codenames',
    minPlayers: 4,
    maxPlayers: 12,
    practice: 'local',
  },
  'sushi-go-party': {
    name: 'Sushi Go Party!',
    minPlayers: 2,
    maxPlayers: 8,
    practice: 'local',
  },
  'little-secret': {
    name: 'Little Secret',
    minPlayers: 3,
    maxPlayers: 9,
    practice: 'local',
  },
  domino: { name: 'Dominó', minPlayers: 4, maxPlayers: 4, practice: 'local' },
} as const satisfies Record<
  string,
  {
    name: string;
    minPlayers: number;
    maxPlayers: number;
    /** `room`: bot seats in a private server room; `local`: the `/practice/<id>` route. */
    practice: 'room' | 'local';
  }
>;
export type GameId = keyof typeof games;
export const gameIds = Object.keys(games) as GameId[];

/** The identity part of a game's `GameDefinition`. */
export function seats(id: GameId) {
  const { minPlayers, maxPlayers } = games[id];
  return { id, minPlayers, maxPlayers };
}
