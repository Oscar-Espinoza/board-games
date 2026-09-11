/** Rules receive identity from the server socket binding, never from action payloads. */
export interface GameDefinition<State = any> {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  create(players: string[], random: () => number, options?: unknown): State;
  /** Reject invalid intentions without mutating state. Return the accepted state. */
  apply(
    state: State,
    playerId: string,
    action: unknown,
    random: () => number,
  ): State;
  /** This is the only boundary through which canonical game state reaches a client. */
  view(state: State, playerId: string): { public: unknown; private: unknown };
  isFinished(state: State): boolean;
  /** Optional practice policy receives only the same projection as a player. */
  botAction?(view: GameView): unknown | null;
}
export type PlayerId = string;
export type RoomId = string;
export type Player = {
  id: PlayerId;
  name: string;
  connected: boolean;
  reservedUntil: number | null;
  bot?: boolean;
};
export type GameView = { public: unknown; private: unknown };
