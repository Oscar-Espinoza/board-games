export type Role = 'disciple' | 'infiltrator' | 'journalist';
import type { powers } from './limits.js';
export type Power = (typeof powers)[number];
export type Symbol = 'rock' | 'paper' | 'scissors';
export type Options = { wordLanguage: 'en' | 'es'; powers: boolean };
export type Phase =
  | 'setup'
  | 'volunteer'
  | 'clues'
  | 'debate'
  | 'vote'
  | 'tie'
  | 'reactions'
  | 'missionResult'
  | 'finished';
export type Prompt = {
  id: string;
  kind: 'sage' | 'journalist' | 'revenant';
  actor: string;
};
export type Solution = {
  password: string;
  alternative: string;
  roles: Record<string, Role>;
};
export type Result = Solution & {
  points: Record<string, number>;
  reason: 'disciples' | 'survivors' | 'guess';
  winners: string[];
};
export type EventData =
  | { type: 'deal' }
  | {
      type: 'ballots';
      ballots: Record<string, string>;
      totals: Record<string, number>;
    }
  | { type: 'rps'; choices: Record<string, Symbol>; losers: string[] }
  | { type: 'elimination'; player: string; role: Role }
  | { type: 'guess'; player: string; correct: boolean }
  | { type: 'score'; points: Record<string, number> };
export type Event = EventData & { sequence: number };
export type Public = {
  players: string[];
  connectedPlayers: string[];
  options: Options;
  setupVersion: number;
  ready: string[];
  phase: Phase;
  scores: Record<string, number>;
  mission: number;
  cycle: number;
  speaker: string | null;
  clues: Record<string, string>;
  powers: Record<string, Power>;
  eliminated: string[];
  revealed: Record<string, Role>;
  prompt: Prompt | null;
  ballotId: string;
  rpsId: string;
  candidates: string[];
  committed: string[];
  rpsCommitted: string[];
  continued: string[];
  result: Result | null;
  actionSequence: number;
  events: Event[];
  history: Event[];
};
export type State = Omit<Public, 'committed' | 'rpsCommitted'> & {
  used: string[];
  password: string;
  alternative: string;
  aliases: string[];
  roles: Record<string, Role>;
  ballots: Record<string, string>;
  rps: Record<string, Symbol>;
  clueOrder: string[];
  origin: string | null;
  reactions: { kind: 'journalist' | 'revenant'; actor: string }[];
};
export type View = {
  public: Public;
  private: {
    password: string | null;
    role: 'journalist' | null;
    ballot: string | null;
    rps: Symbol | null;
    solution: Solution | null;
  };
};
export type Action =
  | { type: 'configure'; version: number; options: Options }
  | { type: 'ready'; version: number }
  | { type: 'volunteer'; mission: number }
  | { type: 'clue'; text: string; mission: number; cycle: number }
  | { type: 'openVote'; mission: number; cycle: number }
  | { type: 'vote'; ballotId: string; target: string }
  | { type: 'resolveTie'; promptId: string; target: string }
  | { type: 'rps'; rpsId: string; symbol: Symbol }
  | { type: 'guess'; promptId: string; answer: string }
  | { type: 'revenant'; promptId: string; target: string | null }
  | { type: 'continue'; mission: number };
