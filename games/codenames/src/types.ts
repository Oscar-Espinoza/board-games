export type Team = 'red' | 'blue';
export type Identity = Team | 'civilian' | 'assassin';
export type Assignment = { team: Team; role: 'spymaster' | 'operative' };
export type Options = {
  boardLanguage: 'en' | 'es';
  allowAbbreviations: boolean;
  allowMultiwordNames: boolean;
};
export type Clue = { word: string; count: number | 'unlimited'; team: Team };
export type Result = { team: Team; reason: 'agents' | 'assassin' };
export type Event =
  | { type: 'boardDealt'; team: Team }
  | { type: 'clueSubmitted'; clue: Clue }
  | { type: 'clueReviewed'; allow: boolean }
  | { type: 'cardRevealed'; card: number; word: string; identity: Identity }
  | { type: 'turnEnded'; team: Team }
  | { type: 'gameFinished'; result: Result };
export type PublicEvent = Event & { sequence: number; index: number };
export type Phase =
  'setup' | 'clue' | 'clueReview' | 'guessing' | 'penalty' | 'finished';
export type Cell = { word: string; identity: Identity; revealed: boolean };
export type Budget = { kind: 'finite'; cap: number } | { kind: 'unlimited' };
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
  activeTeam: Team;
  turn: number;
  clue: Clue | null;
  budget: Budget;
  used: number;
  result: Result | null;
  actionSequence: number;
  events: PublicEvent[];
  history: PublicEvent[];
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
  activeTeam: Team;
  turn: number;
  clue: Clue | null;
  budget: Budget;
  used: number;
  result: Result | null;
  remaining: Record<Team, number>;
  actionSequence: number;
  events: PublicEvent[];
  history: PublicEvent[];
};
export type Private = { assignment: Assignment | null; key?: Identity[] };
export type View = { public: Public; private: Private };
