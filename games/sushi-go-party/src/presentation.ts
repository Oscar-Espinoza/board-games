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
export type Presentation = {
  sequence: number;
  round: number;
  turn: number;
  events: Event[];
};
/** Each event is constructed from public identities; clone at the recipient boundary. */
export function projectPresentation(p: Presentation): Presentation {
  return {
    sequence: p.sequence,
    round: p.round,
    turn: p.turn,
    events: p.events.map((e) => {
      switch (e.type) {
        case 'deal':
          return { type: e.type, counts: [...e.counts] };
        case 'committed':
          return { type: e.type, seat: e.seat };
        case 'reveal':
          return {
            type: e.type,
            cards: e.cards.map((c) => ({
              seat: c.seat,
              card: structuredClone(c.card),
            })),
          };
        case 'attach':
          return { type: e.type, seat: e.seat, card: e.card, wasabi: e.wasabi };
        case 'copy':
          return { type: e.type, seat: e.seat, card: structuredClone(e.card) };
        case 'miso-discard':
          return { type: e.type, cards: [...e.cards] };
        case 'utensil-exchange':
          return { type: e.type, from: e.from, to: e.to };
        case 'takeout':
          return { type: e.type, seat: e.seat, cards: [...e.cards] };
        case 'pass':
          return {
            type: e.type,
            edges: e.edges.map((x) => ({
              from: x.from,
              to: x.to,
              count: x.count,
            })),
          };
        case 'score':
          return {
            type: e.type,
            seat: e.seat,
            groups: e.groups.map((g) => ({
              kind: g.kind,
              cards: [...g.cards],
              amount: g.amount,
            })),
          };
        case 'round-end':
          return { type: e.type, round: e.round };
        case 'finished':
          return { type: e.type, winners: [...e.winners] };
      }
    }),
  };
}
/** Cosmetic cursors never acknowledge rules actions or replay historical transitions. */
export class EventCursor {
  private scope = '';
  private sequence = -1;
  reset() {
    this.scope = '';
    this.sequence = -1;
  }
  take(scope: string, presentation: Presentation): Event[] {
    if (this.scope === scope && presentation.sequence <= this.sequence)
      return [];
    if (this.scope !== scope || presentation.sequence !== this.sequence + 1) {
      this.scope = scope;
      this.sequence = presentation.sequence;
      return [];
    }
    this.sequence = presentation.sequence;
    return presentation.events;
  }
}
