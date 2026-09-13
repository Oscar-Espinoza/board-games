export type Team = 'red' | 'blue';
export type Identity = Team | 'civilian' | 'assassin';
export type Assignment = { team: Team; role: 'spymaster' | 'operative' };
export type Options = {
  boardLanguage: 'en' | 'es';
};
export type Result = { team: Team; reason: 'agents' | 'assassin' };
export type Event =
  | { type: 'boardDealt'; team: Team }
  | { type: 'clueSubmitted'; clue: Clue }
  | { type: 'turnEnded'; team: Team }
  | { type: 'cardRevealed'; card: number; word: string; identity: Identity }
  | { type: 'gameFinished'; result: Result };
export type PublicEvent = Event & { sequence: number; index: number };
export type Phase = 'setup' | 'clue' | 'guessing' | 'finished';
export type Clue = { word: string; count: number | 'unlimited'; team: Team };
export type Budget = { kind: 'finite'; cap: number } | { kind: 'unlimited' };
export type ClueRecord = Clue & {
  turn: number;
  guesses: { card: number; word: string; identity: Identity }[];
};
export type Cell = { word: string; identity: Identity; revealed: boolean };
export type State = {
  players: string[];
  assignments: Record<string, Assignment>;
  options: Options;
  packVersion: string;
  setupVersion: number;
  ready: string[];
  connectedPlayers: string[];
  phase: Phase;
  board: Cell[];
  startingTeam: Team;
  activeTeam: Team;
  turn: number;
  clue: Clue | null;
  budget: Budget;
  used: number;
  clueHistory: ClueRecord[];
  result: Result | null;
  actionSequence: number;
  events: PublicEvent[];
};
export type Public = {
  players: string[];
  assignments: Record<string, Assignment>;
  options: Options;
  setupVersion: number;
  ready: string[];
  connectedPlayers: string[];
  phase: Phase;
  board: {
    index: number;
    word: string;
    revealed: boolean;
    identity?: Identity;
  }[];
  startingTeam: Team;
  activeTeam: Team;
  turn: number;
  clue: Clue | null;
  budget: Budget;
  used: number;
  clueHistory: ClueRecord[];
  result: Result | null;
  remaining: Record<Team, number>;
  actionSequence: number;
  events: PublicEvent[];
};
export type Private = { assignment: Assignment | null; key?: Identity[] };
export type View = { public: Public; private: Private };
