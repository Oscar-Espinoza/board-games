/** Effects are eligible only across uninterrupted, consecutive accepted game snapshots. */
export class RevisionGate {
  private last?: {
    revision: number;
    identity: string;
    connected: boolean;
    snapshot?: object;
  };
  private awaitingSnapshot = false;
  reset() {
    this.last = undefined;
    this.awaitingSnapshot = false;
  }
  accept(
    revision: number,
    identity: string,
    connected: boolean,
    snapshot?: object,
  ) {
    const previous = this.last;
    this.last = {
      revision:
        previous?.identity === identity
          ? Math.max(revision, previous.revision)
          : revision,
      identity,
      connected,
      snapshot,
    };
    if (!connected) {
      this.awaitingSnapshot = true;
      return false;
    }
    if (this.awaitingSnapshot) {
      // Socket connection precedes its resumed snapshot. Do not mistake the old
      // view rendered during that interval for a new synchronization baseline.
      if (
        snapshot
          ? snapshot !== previous?.snapshot
          : revision !== previous?.revision
      )
        this.awaitingSnapshot = false;
      return false;
    }
    return (
      !!previous &&
      previous.connected &&
      previous.identity === identity &&
      revision === previous.revision + 1
    );
  }
}

/**
 * Yields a sequence's events only when it directly follows the previous one.
 * A reconnect notification may still carry the old snapshot; wait for fresh data.
 */
export function eventGate<E extends { sequence: number }>(
  cancelEffects: () => void = () => {},
) {
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
      events: E[],
      connected: boolean,
      snapshot: object,
    ): E[] {
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
