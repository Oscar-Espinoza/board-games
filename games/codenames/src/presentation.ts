import type { PublicEvent } from './types.js';
/** A reconnect notification may still carry the old snapshot. Wait for fresh data. */
export function eventGate() {
  let baseline: { identity: string; sequence: number } | null = null;
  let disconnectedSnapshot: object | null = null;
  return {
    reset() {
      baseline = null;
    },
    consume(
      identity: string,
      sequence: number,
      events: PublicEvent[],
      connected: boolean,
      snapshot: object,
    ): PublicEvent[] {
      if (!connected) {
        baseline = null;
        disconnectedSnapshot = snapshot;
        return [];
      }
      if (disconnectedSnapshot) {
        if (snapshot === disconnectedSnapshot) return [];
        disconnectedSnapshot = null;
        baseline = { identity, sequence };
        return [];
      }
      const previous = baseline;
      if (previous?.identity === identity && sequence < previous.sequence) {
        return [];
      }
      baseline = { identity, sequence };
      if (
        !previous ||
        previous.identity !== identity ||
        sequence !== previous.sequence + 1
      )
        return [];
      return events.filter(
        (event, i) => event.sequence === sequence && event.index === i,
      );
    },
  };
}
