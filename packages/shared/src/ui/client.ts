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
  /** Room actions for a Board that draws its own room chrome. */
  onLeave?: () => void;
  onInvite?: () => unknown;
  copied?: boolean;
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
