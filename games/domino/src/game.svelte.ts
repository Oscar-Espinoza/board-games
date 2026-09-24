import { onMount, untrack } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import {
  RevisionGate,
  createAudio,
  read,
  write,
  type Audio,
} from '@board-games/shared/ui';
import { m } from '@board-games/shared/messages';
import type { Locale } from '@board-games/shared/runtime';
import type { Player } from '@board-games/game-core';
import {
  attach,
  pips,
  teamOf,
  type Action,
  type End,
  type View,
} from './index.js';
import { idealPoses, plug } from './layout.js';
import { COMPACT, lookOf, type Look } from './look.js';

export type GameProps = {
  view: View;
  playerId: string;
  players: Player[];
  send: (action: unknown) => void;
  locale: Locale;
  round: number;
  connected: boolean;
  pending: boolean;
};
/** How a table sounds. Each look brings its own. */
export type Sounds = {
  select(): void;
  /** A tile lands; `force` is 0–1. */
  play(force: number): void;
  pass(): void;
  /** It just became your turn. */
  turn(): void;
  /** A hand ended: your team won (true), lost (false) or tied (null). */
  end(won: boolean | null): void;
  /** Milliseconds between a play being accepted and the tile landing. */
  land(force: number): number;
};
/** An accepted play or pass, seen once, in order. */
export type TableEvent =
  | { type: 'play'; id: number; seat: number; force: number }
  | { type: 'pass'; seat: number };

export const media = (q: string) =>
  typeof window !== 'undefined' && window.matchMedia(q).matches;

/**
 * Everything a Domino table does apart from drawing: seats, selection, ghosts,
 * the strength charge, preferences, sounds and team names. Both looks (the
 * three.js table and the 8-bit one) render the same instance. Create it while a
 * component initialises: it registers effects.
 */
export class DominoGame {
  #props: () => GameProps;
  readonly audio: Audio = createAudio();
  sounds: Sounds | null = null;
  #listeners = new Set<(e: TableEvent) => void>();
  #gate = new RevisionGate();

  constructor(props: () => GameProps) {
    this.#props = props;
    onMount(() => {
      const q = window.matchMedia(COMPACT);
      const change = () => (this.compact = q.matches);
      q.addEventListener('change', change);
      return () => {
        q.removeEventListener('change', change);
        cancelAnimationFrame(this.#frame);
        this.audio.close();
      };
    });
    $effect(() => {
      // Drop a stale selection once the turn or hand moves on.
      if (
        !this.myTurn ||
        (this.selected !== null && !this.playable.has(this.selected))
      ) {
        this.selected = null;
        this.chosenEnd = null;
      }
    });
    $effect(() => write('domino:camera', String(this.camera)));
    // Sounds and table events only across consecutive revisions.
    $effect(() => {
      const revision = this.pub.revision,
        { round, connected } = this.#props();
      const fresh = this.#gate.accept(revision, String(round), connected);
      untrack(() => this.#fresh(fresh));
    });
  }
  /** What the previous snapshot showed, so a tidy-up or rename replays nothing. */
  #seen = { last: '', ended: false };
  #fresh(fresh: boolean) {
    const pub = this.pub,
      last = pub.last,
      key = JSON.stringify(last ?? null),
      moved = key !== this.#seen.last,
      ended = !!pub.result && !this.#seen.ended,
      sound = (fn: (s: Sounds) => void) => {
        if (this.soundOn && this.sounds) fn(this.sounds);
      };
    this.#seen = { last: key, ended: !!pub.result };
    if (!fresh) return;
    if (ended) {
      const won = this.#won(pub.result!.winner);
      sound((s) => s.end(won));
    } else if (this.myTurn && moved) sound((s) => s.turn());
    // Only a new play or pass is an event; other updates keep the last one.
    if (!last || !moved) return;
    if (last.type === 'pass') {
      sound((s) => s.pass());
      return this.#emit({ type: 'pass', seat: last.seat });
    }
    if (pub.chain.some((l) => l.id === last.id)) {
      const force = last.force,
        delay = this.motion ? (this.sounds?.land(force) ?? 0) : 0;
      setTimeout(() => sound((s) => s.play(force)), delay);
      this.#emit({ type: 'play', id: last.id, seat: last.seat, force });
    }
  }
  #won(winner: 0 | 1 | null) {
    return winner === null ? null : winner === this.myTeam;
  }
  #emit(e: TableEvent) {
    for (const fn of this.#listeners) fn(e);
  }
  /** Listen for accepted plays and passes; returns the unsubscribe. */
  on(fn: (e: TableEvent) => void) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  get props() {
    return this.#props();
  }
  readonly L = $derived({ locale: this.props.locale });
  readonly t = $derived.by(() => {
    const o = { locale: this.props.locale };
    return {
      pass: m.domino_pass({}, o),
      arrange: m.domino_arrange({}, o),
      rules: m.domino_rules({}, o),
      settings: m.domino_settings({}, o),
      close: m.domino_close({}, o),
      soft: m.domino_soft({}, o),
      hard: m.domino_hard({}, o),
      view: m.domino_camera({}, o),
      seated: m.domino_seated({}, o),
      overhead: m.domino_overhead({}, o),
      yourTurn: m.domino_your_turn({}, o),
      chooseEnd: m.domino_choose_end({}, o),
      nextHand: m.domino_next_hand({}, o),
      sound: m.domino_sound({}, o),
      motion: m.domino_motion({}, o),
      rename: m.domino_rename({}, o),
      holdHint: m.domino_hold_hint({}, o),
      passed: m.domino_passed({}, o),
      before: m.domino_seat_before({}, o),
      partner: m.domino_seat_partner({}, o),
      after: m.domino_seat_after({}, o),
      look: m.domino_look({}, o),
      look3d: m.domino_look_3d({}, o),
      lookPixel: m.domino_look_pixel({}, o),
    };
  });

  readonly pub = $derived(this.props.view.public);
  readonly own = $derived(
    Math.max(0, this.pub.players.indexOf(this.props.playerId)),
  );
  /** 0 = you (front), 1 = right, 2 = partner (far side), 3 = left. */
  rel = (seat: number) => (seat - this.own + 4) % 4;
  seatAt = (r: number) => (this.own + r) % 4;
  name = (seat: number) =>
    this.props.players.find((p) => p.id === this.pub.players[seat])?.name ??
    `#${seat + 1}`;
  readonly myTeam = $derived(teamOf(this.own));
  readonly myTurn = $derived(
    this.pub.phase === 'playing' &&
      this.pub.turn === this.own &&
      this.props.connected,
  );
  readonly hand = $derived(this.props.view.private.hand);
  readonly legal = $derived(this.props.view.private.legal);
  readonly mustPass = $derived(this.myTurn && this.legal[0]?.type === 'PASS');
  readonly playable = $derived(
    new Set(this.legal.flatMap((l) => (l.type === 'PLAY' ? [l.tileId] : []))),
  );
  readonly scattered = $derived.by(() => {
    const home = idealPoses(this.pub.chain);
    return this.pub.chain.some(({ id }) => {
      const a = this.pub.poses[id],
        b = home[id];
      return (
        !!a &&
        (Math.abs(a.x - b.x) > 0.01 ||
          Math.abs(a.y - b.y) > 0.01 ||
          Math.abs(a.angle - b.angle) > 0.5)
      );
    });
  });
  get pending() {
    return this.props.pending;
  }

  // Selection lifts a tile and shows a ghost on each end it fits; pressing a
  // ghost plays there, harder the longer it is held.
  selected = $state<number | null>(null);
  chosenEnd = $state<End | null>(null);
  readonly options = $derived(
    this.selected === null
      ? []
      : this.legal.flatMap((l) =>
          l.type === 'PLAY' && l.tileId === this.selected ? [l.end] : [],
        ),
  );
  readonly ready = $derived(
    this.myTurn && !this.pending && this.selected !== null,
  );
  pick = (id: number) => {
    this.audio.unlock();
    if (!this.myTurn || !this.playable.has(id)) return;
    this.selected = this.selected === id ? null : id;
    this.chosenEnd = null;
    if (this.soundOn) this.sounds?.select();
  };
  /** Ghosts plug onto each open end exactly where that end tile lies now. */
  readonly ghosts = $derived(
    this.selected === null
      ? []
      : this.options.map((option) => ({
          end: option,
          pose: plug(
            attach(this.pub.chain, this.selected!, option),
            this.pub.poses,
            this.selected!,
          ),
          chosen: this.chosenEnd === option,
        })),
  );

  // Strength: hold to charge, release to strike.
  charge = $state(0);
  charging = $state(false);
  #started = 0;
  #frame = 0;
  startCharge = (at: End) => {
    if (!this.ready || this.charging || !this.options.includes(at)) return;
    this.audio.unlock();
    this.chosenEnd = at;
    this.charging = true;
    this.#started = performance.now();
    const tick = () => {
      this.charge = Math.min(1, (performance.now() - this.#started) / 1100);
      if (this.charging) this.#frame = requestAnimationFrame(tick);
    };
    tick();
  };
  releaseCharge = () => {
    if (!this.charging) return;
    this.charging = false;
    cancelAnimationFrame(this.#frame);
    if (this.ready && this.chosenEnd)
      this.act({
        type: 'PLAY',
        tileId: this.selected!,
        end: this.chosenEnd,
        force: Math.round(this.charge * 100) / 100,
      });
    this.charge = 0;
  };
  cancelCharge = () => {
    this.charging = false;
    this.chosenEnd = null;
    cancelAnimationFrame(this.#frame);
    this.charge = 0;
  };
  act = (action: Action) => {
    this.audio.unlock();
    this.props.send(action);
    if (action.type === 'PLAY') {
      this.selected = null;
      this.chosenEnd = null;
    }
  };

  // Phones get a compact layout.
  compact = $state(media(COMPACT));
  look = $state<Look>(lookOf());
  setLook = (look: Look) => {
    this.look = look;
    write('domino:look', look);
  };

  // Camera (3D): 0 = seated at the table, 1 = straight overhead.
  camera = $state(
    ((stored) =>
      stored !== null && Number.isFinite(Number(stored))
        ? Number(stored)
        : 0.15)(read('domino:camera')),
  );

  // Preferences.
  soundOn = $state(read('domino:sound') !== 'off');
  motionSetting = $state(read('domino:motion'));
  settingsOpen = $state(false);
  rulesOpen = $state(false);
  readonly motion = $derived(
    this.motionSetting
      ? this.motionSetting !== 'off'
      : !prefersReducedMotion.current,
  );
  preference = (kind: 'sound' | 'motion', on: boolean) => {
    write(`domino:${kind}`, on ? 'on' : 'off');
    if (kind === 'sound') {
      this.soundOn = on;
      if (!on) this.audio.stop();
      this.audio.unlock();
    } else this.motionSetting = on ? 'on' : 'off';
  };

  // Team names on the scoreboard.
  editing = $state<0 | 1 | null>(null);
  draft = $state('');
  startEdit = (team: 0 | 1) => {
    this.editing = team;
    this.draft = this.pub.teams[team];
  };
  commitEdit = () => {
    const team = this.editing,
      value = this.draft.trim().slice(0, 16);
    this.editing = null;
    if (team !== null && value && value !== this.pub.teams[team])
      this.act({ type: 'RENAME_TEAM', team, name: value });
  };

  readonly status = $derived(
    this.pub.phase !== 'playing'
      ? ''
      : this.myTurn
        ? this.mustPass
          ? m.domino_blocked({}, this.L)
          : this.selected !== null
            ? this.t.chooseEnd
            : this.t.yourTurn
        : m.domino_turn_of({ name: this.name(this.pub.turn) }, this.L),
  );
  readonly result = $derived(this.pub.result);
  tiles = (seat: number) => this.result?.hands[seat] ?? [];
  count = (seat: number) =>
    this.tiles(seat).reduce((sum, id) => sum + pips(id), 0);
  /** Tiles left in the hand of the seat at relative position `r`. */
  handsLeft = (r: number) =>
    this.result ? 0 : (this.pub.handCounts[this.seatAt(r)] ?? 0);
  passed = (seat: number) =>
    this.pub.phase === 'playing' &&
    this.pub.last?.type === 'pass' &&
    this.pub.last.seat === seat;
  plaqueName = (seat: number) =>
    this.passed(seat)
      ? `${this.name(seat)} · ${this.t.passed}`
      : this.name(seat);
}
