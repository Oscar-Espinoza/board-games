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
