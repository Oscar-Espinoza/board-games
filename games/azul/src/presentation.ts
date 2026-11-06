import type { PublicState, Color, Event } from './index.js';
import {
  centerMarker,
  centerTile,
  discard,
  floorSlot,
  markerSpot,
  parseLocation,
  patternSlot,
} from './locations.js';
export type Flight = {
  color: Color | 'marker';
  from: string;
  to: string;
  at: number;
  duration: number;
  sound?: 'tile' | 'marker' | 'score';
  /** Part of the round-end sweep (pattern lines, floors, marker hand-back). */
  cleanup?: boolean;
};
export type PresentationStep = {
  at: number;
  state: PublicState;
  recent: Event[];
  hidden: string[];
};
export type Presentation = {
  initial: PublicState;
  steps: PresentationStep[];
  flights: Flight[];
  duration: number;
};

// Milliseconds on the presentation timeline.
const TRAVEL = 310;
const SPILL_AT = 80;
const WALL_START = 380;
const WALL_STEP = 230;
const WALL_FLIGHT = 240;
const WALL_END_MIN = 390;
const PENALTY_GAP = 80;
const CLEANUP_GAP = 100;
const CLEANUP = 150;
const DEAL_GAP = 50;
/** The next deal waits for the wall scoring, or starts early when nothing scores. */
const DEAL_AFTER_WALLS = 1740;
const DEAL_WITHOUT_WALLS = 430;

/** Replays only public accepted facts. No rule evaluation, randomness or canonical mutation. */
export function planPresentation(
  previous: PublicState,
  accepted: PublicState,
): Presentation {
  const state = structuredClone(previous);
  state.revision = accepted.revision;
  const initial = structuredClone(state);
  const flights: Flight[] = [];
  const jobs: { at: number; run: () => void }[] = [];
  const recent: Event[] = [];
  const hidden: string[] = [];
  const board = (id: string) => state.boards[state.players.indexOf(id)];
  const sourceSlots = new Map<string, number>();
  const centerCounts = new Map<string, number>();
  previous.center.forEach((c) =>
    centerCounts.set(c, (centerCounts.get(c) ?? 0) + 1),
  );
  const roundEnd =
    accepted.roundNumber !== previous.roundNumber ||
    accepted.phase === 'finished';
  const walls = accepted.events.filter((e) => e.type === 'wall');
  const wallEnd = Math.max(
    WALL_END_MIN,
    ...walls.map((e) => WALL_START + e.row * WALL_STEP + WALL_FLIGHT),
  );
  const penaltyAt = wallEnd + PENALTY_GAP;
  const cleanupAt = penaltyAt + CLEANUP_GAP;
  const cleanupEnd = cleanupAt + CLEANUP;
  const dealAt = Math.max(
    walls.length ? DEAL_AFTER_WALLS : DEAL_WITHOUT_WALLS,
    cleanupEnd + DEAL_GAP,
  );
  let sounded = false;
  for (const e of accepted.events) {
    if (e.type !== 'travel') continue;
    const at =
      e.reason === 'deal' ? dealAt : e.reason === 'spill' ? SPILL_AT : 0;
    const origin = parseLocation(e.from),
      target = parseLocation(e.to);
    let from = e.from,
      to = e.to;
    if (origin.kind === 'center' && e.color !== 'marker') {
      const slot = sourceSlots.get(e.color) ?? 0;
      sourceSlots.set(e.color, slot + 1);
      from = centerTile(e.color, slot);
    }
    if (target.kind === 'center' && e.color !== 'marker') {
      const slot = centerCounts.get(e.color) ?? 0;
      centerCounts.set(e.color, slot + 1);
      to = centerTile(e.color, slot);
    }
    flights.push({
      color: e.color,
      from,
      to,
      at,
      duration: TRAVEL,
      sound:
        e.reason === 'marker'
          ? 'marker'
          : e.reason === 'draft' && !sounded
            ? 'tile'
            : undefined,
    });
    if (e.reason === 'draft') sounded = true;
    jobs.push({
      at,
      run: () => {
        if (origin.kind === 'factory') state.factories[origin.factory] = [];
        if (origin.kind === 'center' && e.color !== 'marker')
          state.center = state.center.filter((c) => c !== e.color);
        if (e.color === 'marker' && 'player' in target)
          state.markerOwner = target.player;
      },
    });
    jobs.push({
      at: at + TRAVEL,
      run: () => {
        if (target.kind === 'discard') state.discardCount++;
        else if (target.kind === 'floor')
          board(target.player).floor[target.slot] = e.color;
        else if (e.color === 'marker') return;
        else if (target.kind === 'center') state.center.push(e.color);
        else if (target.kind === 'factory')
          state.factories[target.factory][target.slot] = e.color;
        else if (target.kind === 'pattern')
          board(target.player).patterns[target.row] = {
            color: e.color,
            count: target.slot + 1,
          };
      },
    });
  }
  // Reconstruct slots received by the final draft before deriving cleanup flights.
  const filled = structuredClone(previous.boards);
  for (const e of accepted.events)
    if (e.type === 'travel' && e.reason !== 'deal') {
      const to = parseLocation(e.to);
      if (to.kind !== 'pattern' && to.kind !== 'floor') continue;
      const b = filled[previous.players.indexOf(to.player)];
      if (!b) continue;
      if (to.kind === 'pattern' && e.color !== 'marker')
        b.patterns[to.row] = { color: e.color, count: to.slot + 1 };
      if (to.kind === 'floor') b.floor[to.slot] = e.color;
    }
  for (const e of walls) {
    const at = WALL_START + e.row * WALL_STEP;
    flights.push({
      color: e.color,
      from: e.from,
      to: e.to,
      at,
      duration: WALL_FLIGHT,
      sound: 'score',
    });
    jobs.push({
      at,
      run: () => {
        hidden.push(e.from);
      },
    });
    jobs.push({
      at: at + WALL_FLIGHT,
      run: () => {
        const b = board(e.player);
        b.wall[e.row][e.column] = true;
        b.score += e.scoring.points;
        b.wallPoints += e.scoring.points;
        recent.push(e);
      },
    });
    for (
      let slot = 1;
      slot < filled[previous.players.indexOf(e.player)].patterns[e.row].count;
      slot++
    )
      flights.push({
        color: e.color,
        from: patternSlot(e.player, e.row, slot),
        to: discard,
        at: cleanupAt,
        duration: CLEANUP,
        cleanup: true,
      });
  }
  for (const e of accepted.events) {
    if (e.type === 'penalty')
      jobs.push({
        at: penaltyAt,
        run: () => {
          board(e.player).score -= e.loss;
          board(e.player).floorLoss += e.loss;
          board(e.player).floorDeductions += e.deduction;
          recent.push(e);
        },
      });
    if (e.type === 'finish')
      jobs.push({
        at: cleanupEnd,
        run: () => {
          board(e.player).score = e.score;
          board(e.player).bonus = structuredClone(e.bonus);
          recent.push(e);
        },
      });
  }
  if (roundEnd) {
    filled.forEach((b, i) =>
      b.floor.forEach((color, slot) => {
        flights.push({
          color,
          from: floorSlot(previous.players[i], slot),
          to:
            color === 'marker'
              ? accepted.markerOwner
                ? markerSpot(accepted.markerOwner)
                : centerMarker
              : discard,
          at: cleanupAt,
          duration: CLEANUP,
          cleanup: true,
        });
      }),
    );
    const marker =
      previous.markerOwner ??
      accepted.events.flatMap((e) => {
        if (e.type !== 'travel' || e.reason !== 'marker') return [];
        const to = parseLocation(e.to);
        return 'player' in to ? [to.player] : [];
      })[0];
    if (
      marker &&
      !filled[previous.players.indexOf(marker)].floor.includes('marker')
    )
      flights.push({
        color: 'marker',
        from: markerSpot(marker),
        to: accepted.markerOwner
          ? markerSpot(accepted.markerOwner)
          : centerMarker,
        at: cleanupAt,
        duration: CLEANUP,
        cleanup: true,
      });
    jobs.push({
      at: cleanupAt,
      run: () => {
        for (const e of walls)
          board(e.player).patterns[e.row] = { color: null, count: 0 };
        state.boards.forEach((b) => (b.floor = []));
      },
    });
    jobs.push({
      at: cleanupEnd,
      run: () => {
        state.markerOwner = accepted.markerOwner;
        state.discardCount += flights.filter(
          (f) => f.cleanup && f.to === discard,
        ).length;
      },
    });
  }
  const duration = Math.max(
    0,
    ...flights.map((f) => f.at + f.duration),
    ...jobs.map((j) => j.at),
  );
  const steps: PresentationStep[] = [];
  jobs.sort((a, b) => a.at - b.at);
  for (let i = 0; i < jobs.length;) {
    const at = jobs[i].at;
    do {
      jobs[i++].run();
    } while (i < jobs.length && jobs[i].at === at);
    steps.push({
      at,
      state: structuredClone(state),
      recent: [...recent],
      hidden: [...hidden],
    });
  }
  steps.push({
    at: duration,
    state: accepted,
    hidden: [],
    recent: accepted.events.filter(
      (e) => e.type === 'wall' || e.type === 'penalty' || e.type === 'finish',
    ),
  });
  return { initial, steps, flights, duration };
}
