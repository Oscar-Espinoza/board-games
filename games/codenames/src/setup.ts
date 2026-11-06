import type { Assignment, Team } from './types.js';

export const boardSize = 25;
/** Cards dealt per identity; the team that starts has one more agent than the other. */
export const deal = { first: 9, second: 8, civilians: 7, assassin: 1 } as const;
export const clueLength = 80;
export const maxClueCount = 9;

type Roster = {
  players: string[];
  assignments: Record<string, Assignment>;
  connectedPlayers: string[];
};

/** Whether `player` may take this seat: not the one they hold, and one spymaster per team. */
export function canChooseRole(
  assignments: Roster['assignments'],
  player: string,
  team: Team,
  role: Assignment['role'],
) {
  const current = assignments[player];
  if (current?.team === team && current.role === role) return false;
  return (
    role !== 'spymaster' ||
    !Object.entries(assignments).some(
      ([id, a]) => id !== player && a.team === team && a.role === 'spymaster',
    )
  );
}

/** Everyone seated, each team with exactly one spymaster and an operative. */
export function validRoster(s: Pick<Roster, 'players' | 'assignments'>) {
  return (
    s.players.every((p) => s.assignments[p]) &&
    (['red', 'blue'] as Team[]).every((team) => {
      const seated = Object.values(s.assignments).filter(
        (a) => a.team === team,
      );
      return (
        seated.filter((a) => a.role === 'spymaster').length === 1 &&
        seated.some((a) => a.role === 'operative')
      );
    })
  );
}

/** Setup can finish: a valid roster, all of it connected. */
export const canStart = (s: Roster) =>
  validRoster(s) && s.players.every((p) => s.connectedPlayers.includes(p));
