import type { PublicCard } from './cards.js';
import type { Group } from './scoring.js';
export type Event =
  | { type: 'deal'; counts: number[] }
  | { type: 'committed'; seat: string }
  | { type: 'reveal'; cards: { seat: string; card: PublicCard }[] }
  | { type: 'attach'; seat: string; card: string; wasabi: string }
  | { type: 'copy'; seat: string; card: PublicCard }
  | { type: 'miso-discard'; cards: string[] }
  | { type: 'utensil-exchange'; from: string; to: string }
  | { type: 'takeout'; seat: string; cards: string[] }
  | { type: 'pass'; edges: { from: string; to: string; count: number }[] }
  | { type: 'score'; seat: string; groups: Group[] }
  | { type: 'round-end'; round: number }
  | { type: 'finished'; winners: string[] };
/** The accepted action's public events; `sequence` counts accepted actions. */
export type Presentation = { sequence: number; events: Event[] };
