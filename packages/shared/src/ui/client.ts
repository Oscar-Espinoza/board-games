import type { Component, Snippet } from 'svelte';
import type { GameView, Player, ReplyErrorCode } from '@board-games/game-core';
import type { Locale } from '../paraglide/runtime.js';

/**
 * What every host (the room page, a practice route) hands a game's `Board.svelte`.
 * `settingsContent` carries the host's own controls; the Board places it in its settings.
 */
export type BoardProps<View = GameView, Action = unknown> = {
  view: View;
  playerId: string;
  players: Player[];
  send: (action: Action) => unknown;
  locale?: Locale;
  /** The room's match number; a new round restarts presentation. */
  round?: number;
  connected?: boolean;
  pending?: boolean;
  errorCode?: ReplyErrorCode | 'TIMEOUT';
  practice?: boolean;
  /** The viewer hosts the room, so setup and host-only actions are theirs. */
  canConfigure?: boolean;
  canRematch?: boolean;
  rematch?: () => unknown;
  rulesContent?: Snippet;
  settingsContent?: Snippet;
  /** A practice host lets the viewer switch seats from the table itself. */
  chooseSeat?: (seat: string) => void;
};

export type Intention = Record<string, any>;
/**
 * A game's browser entry. The registry imports it eagerly, so it must stay tiny:
 * the table itself loads through `load()`.
 */
export type GameClient = {
  load(): Promise<{ default: Component<any> }>;
  /**
   * Whether an intention that met a stale or lost reply is still the same, uncommitted
   * choice in both views. Absent: the game's actions never retry automatically.
   */
  retryable?(
    intention: Intention,
    before: GameView,
    after: GameView,
    playerId: string,
  ): boolean;
};

/** A `ready` during setup, still for the same configuration and not yet recorded. */
export const retryReadyInSetup: NonNullable<GameClient['retryable']> = (
  action,
  before,
  after,
  playerId,
) => {
  const was = before.public as Record<string, any>;
  const now = after.public as Record<string, any>;
  return (
    action.type === 'ready' &&
    was.phase === 'setup' &&
    now.phase === 'setup' &&
    readinessUnchanged(action, was, now, playerId)
  );
};

/** Setup readiness for the same configuration version, not yet recorded. */
export function readinessUnchanged(
  intention: Intention,
  before: Record<string, any>,
  after: Record<string, any>,
  playerId: string,
) {
  return (
    Number.isInteger(intention.version) &&
    intention.version === before.setupVersion &&
    intention.version === after.setupVersion &&
    Array.isArray(after.ready) &&
    !after.ready.includes(playerId)
  );
}

/**
 * A socket-free table on the game's real rules, for its `/practice/<id>` route.
 * Lives in the game's `./practice` entry, never in room initialisation.
 */
export interface PracticeTable<View = GameView> {
  readonly players: Player[];
  /** The seat that must act next; the route shows it after every move. */
  readonly actor: string;
  readonly finished: boolean;
  view(seat: string): View;
  /** Throws the rules' rejection (a message key) and leaves the table unchanged. */
  send(seat: string, action: unknown): void;
}
