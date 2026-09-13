import type { Event } from './types.js';
/** A reconnect notification may still carry the old snapshot. Wait for fresh data. */
export function eventGate(cancelEffects: () => void = () => {}) {
  let baseline: { identity: string; sequence: number } | null = null;
  let disconnectedSnapshot: object | null = null;
  return {
    reset() {
      cancelEffects();
      baseline = null;
    },
    consume(
      identity: string,
      sequence: number,
      events: Event[],
      connected: boolean,
      snapshot: object,
    ): Event[] {
      if (!connected) {
        cancelEffects();
        baseline = null;
        disconnectedSnapshot = snapshot;
        return [];
      }
      if (disconnectedSnapshot) {
        if (snapshot === disconnectedSnapshot) return [];
        cancelEffects();
        disconnectedSnapshot = null;
        baseline = { identity, sequence };
        return [];
      }
      const previous = baseline;
      if (previous?.identity === identity && sequence < previous.sequence) {
        cancelEffects();
        return [];
      }
      baseline = { identity, sequence };
      if (
        !previous ||
        previous.identity !== identity ||
        sequence !== previous.sequence + 1
      ) {
        if (
          !previous ||
          previous.identity !== identity ||
          sequence !== previous.sequence
        )
          cancelEffects();
        return [];
      }
      return events.filter((event) => event.sequence === sequence);
    },
  };
}
