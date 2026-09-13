export type Role = 'disciple' | 'infiltrator' | 'journalist';
export type Power =
  'mime' | 'novice' | 'elder' | 'sage' | 'revenant' | 'dictator' | 'adept';
export type Symbol = 'rock' | 'paper' | 'scissors';
export type Options = { wordLanguage: 'en' | 'es'; powers: boolean };
export type Pair = {
  id: string;
  words: [string, string];
  aliases: [string[], string[]];
};
export type Packs = Record<'en' | 'es', Pair[]>;
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
  packVersion: string;
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
