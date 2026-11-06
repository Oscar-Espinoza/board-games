import type { Action, Development, State } from './index.js';

/** Public events contain only facts already visible at the table. */
export type PresentationEvent =
  | {
      type: 'placement';
      player: string;
      piece: 'road' | 'settlement' | 'city';
      location: number;
    }
  | { type: 'roll'; dice: number[]; hexes: number[]; strength?: number }
  | { type: 'robber'; from: number; to: number }
  | {
      type: 'transfer';
      from: string;
      to: string;
      count: number;
      resource?: number;
      hex?: number;
      reason: 'production' | 'theft' | 'monopoly' | 'trade' | 'development';
    }
  | { type: 'card'; player: string; kind: 'purchase' | Development }
  | { type: 'turn'; player: string }
  | { type: 'award'; player: string; award: 'longest' | 'army' }
  | { type: 'win'; player: string };
type PrivateEvent =
  | { type: 'stolen'; resource: number; from: string; to: string }
  | { type: 'drawn'; kind: Development };
export interface Presentation {
  public: PresentationEvent[];
  recipients: Record<string, PrivateEvent[]>;
}
const sum = (hand: number[]) => hand.reduce((a, b) => a + b, 0);

export function present(
  before: State,
  after: State,
  player: string,
  action: Action,
): Presentation {
  const events: PresentationEvent[] = [];
  const recipients: Record<string, PrivateEvent[]> = {};
  const i = after.players.indexOf(player);
  if (action.type === 'BUILD_ROAD')
    events.push({
      type: 'placement',
      player,
      piece: 'road',
      location: action.edge,
    });
  if (action.type === 'BUILD_SETTLEMENT' || action.type === 'BUILD_CITY')
    events.push({
      type: 'placement',
      player,
      piece: action.type === 'BUILD_CITY' ? 'city' : 'settlement',
      location: action.vertex,
    });
  if (action.type === 'ROLL_DICE') {
    const roll = sum(after.dice!);
    events.push({
      type: 'roll',
      strength: action.strength ?? 0,
      dice: after.dice!,
      hexes: after.board.hexes.flatMap((h, hex) =>
        h.number === roll && hex !== after.robber && h.resource !== null
          ? [hex]
          : [],
      ),
    });
    after.hands.forEach((hand, j) =>
      hand.forEach((n, resource) => {
        const count = n - before.hands[j][resource];
        if (count > 0) {
          const hex = after.board.hexes.findIndex(
            (h, hex) =>
              h.number === roll &&
              hex !== after.robber &&
              h.resource === resource &&
              h.vertices.some(
                (v) => after.buildings[v]?.owner === after.players[j],
              ),
          );
          events.push({
            type: 'transfer',
            from: 'bank',
            to: after.players[j],
            count,
            resource,
            hex,
            reason: 'production',
          });
        }
      }),
    );
  }
  if (action.type === 'MOVE_ROBBER')
    events.push({ type: 'robber', from: before.robber, to: after.robber });
  if (action.type === 'STEAL') {
    const resource = after.hands[i].findIndex((n, r) => n > before.hands[i][r]);
    if (resource >= 0) {
      events.push({
        type: 'transfer',
        from: action.victim,
        to: player,
        count: 1,
        reason: 'theft',
      });
      const detail: PrivateEvent = {
        type: 'stolen',
        resource,
        from: action.victim,
        to: player,
      };
      recipients[player] = [detail];
      recipients[action.victim] = [detail];
    }
  }
  if (action.type === 'MONOPOLY')
    after.players.forEach((id, j) => {
      const count =
        before.hands[j][action.resource] - after.hands[j][action.resource];
      if (j !== i && count > 0)
        events.push({
          type: 'transfer',
          from: id,
          to: player,
          count,
          resource: action.resource,
          reason: 'monopoly',
        });
    });
  if (action.type === 'ACCEPT' || action.type === 'CONFIRM_TRADE') {
    const offer = before.offers.find((o) => o.id === action.offer);
    const partner = action.type === 'CONFIRM_TRADE' ? action.partner : player;
    if (
      offer &&
      before.hands.some((hand, j) =>
        hand.some((n, r) => n !== after.hands[j][r]),
      )
    ) {
      for (const [quantities, from, to] of [
        [offer.give, offer.from, partner],
        [offer.take, partner, offer.from],
      ] as const)
        quantities.forEach((count, resource) => {
          if (count)
            events.push({
              type: 'transfer',
              from,
              to,
              count,
              resource,
              reason: 'trade',
            });
        });
    }
  }
  if (action.type === 'BANK_TRADE' || action.type === 'INVENTION') {
    after.hands[i].forEach((n, resource) => {
      const delta = n - before.hands[i][resource];
      if (delta)
        events.push({
          type: 'transfer',
          from: delta > 0 ? 'bank' : player,
          to: delta > 0 ? player : 'bank',
          count: Math.abs(delta),
          resource,
          reason: action.type === 'INVENTION' ? 'development' : 'trade',
        });
    });
  }
  if (action.type === 'BUY_DEVELOPMENT') {
    events.push({ type: 'card', player, kind: 'purchase' });
    recipients[player] = [
      { type: 'drawn', kind: after.development[i].at(-1)!.kind },
    ];
  } else if (
    action.type === 'KNIGHT' ||
    action.type === 'MONOPOLY' ||
    action.type === 'INVENTION' ||
    action.type === 'ROAD_BUILDING'
  ) {
    events.push({ type: 'card', player, kind: action.type });
  }
  if (before.phase.player !== after.phase.player && after.phase.player)
    events.push({ type: 'turn', player: after.phase.player });
  for (const award of ['longest', 'army'] as const)
    if (after[award] && before[award] !== after[award])
      events.push({ type: 'award', player: after[award], award });
  if (after.phase.winner && before.phase.winner !== after.phase.winner)
    events.push({ type: 'win', player: after.phase.winner });
  return { public: events, recipients };
}
