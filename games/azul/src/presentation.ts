import type { PublicState, Color, Event } from './index.js';
export type Flight = {
  color: Color | 'marker';
  from: string;
  to: string;
  at: number;
  duration: number;
  sound?: 'tile' | 'marker' | 'score';
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
  const wallEnd = Math.max(390, ...walls.map((e) => 380 + e.row * 230 + 240));
  const penaltyAt = wallEnd + 80;
  const cleanupAt = penaltyAt + 100;
  const cleanupEnd = cleanupAt + 150;
  const dealAt = Math.max(walls.length ? 1740 : 430, cleanupEnd + 50);
  let sounded = false;
  for (const e of accepted.events) {
    if (e.type !== 'travel') continue;
    const at = e.reason === 'deal' ? dealAt : e.reason === 'spill' ? 80 : 0;
    let from = e.from,
      to = e.to;
    if (from.startsWith('center/') && e.color !== 'marker') {
      const slot = sourceSlots.get(e.color) ?? 0;
      sourceSlots.set(e.color, slot + 1);
      from += `/${slot}`;
    }
    if (to.startsWith('center/') && e.color !== 'marker') {
      const slot = centerCounts.get(e.color) ?? 0;
      centerCounts.set(e.color, slot + 1);
      to += `/${slot}`;
    }
    flights.push({
      color: e.color,
      from,
      to,
      at,
      duration: 310,
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
        if (e.from.startsWith('factory/'))
          state.factories[Number(e.from.split('/')[1])] = [];
        if (e.from.startsWith('center/') && e.color !== 'marker')
          state.center = state.center.filter((c) => c !== e.color);
        if (e.color === 'marker') state.markerOwner = e.to.split('/')[0];
      },
    });
    jobs.push({
      at: at + 310,
      run: () => {
        const [id, kind, row, slot] = e.to.split('/');
        if (id === 'center' && e.color !== 'marker') state.center.push(e.color);
        else if (id === 'factory' && e.color !== 'marker')
          state.factories[Number(kind)][Number(row)] = e.color;
        else if (id === 'discard') state.discardCount++;
        else if (kind === 'pattern' && e.color !== 'marker')
          board(id).patterns[Number(row)] = {
            color: e.color,
            count: Number(slot) + 1,
          };
        else if (kind === 'floor') board(id).floor[Number(row)] = e.color;
      },
    });
  }
  // Reconstruct slots received by the final draft before deriving cleanup flights.
  const filled = structuredClone(previous.boards);
  for (const e of accepted.events)
    if (e.type === 'travel' && e.reason !== 'deal') {
      const [id, kind, row, slot] = e.to.split('/');
      const b = filled[previous.players.indexOf(id)];
      if (!b) continue;
      if (kind === 'pattern' && e.color !== 'marker')
        b.patterns[Number(row)] = { color: e.color, count: Number(slot) + 1 };
      if (kind === 'floor') b.floor[Number(row)] = e.color;
    }
  for (const e of walls) {
    const at = 380 + e.row * 230;
    flights.push({
      color: e.color,
      from: e.from,
      to: e.to,
      at,
      duration: 240,
      sound: 'score',
    });
    jobs.push({
      at,
      run: () => {
        hidden.push(e.from);
      },
    });
    jobs.push({
      at: at + 240,
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
        from: `${e.player}/pattern/${e.row}/${slot}`,
        to: 'discard',
        at: cleanupAt,
        duration: 150,
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
          from: `${previous.players[i]}/floor/${slot}`,
          to:
            color === 'marker'
              ? accepted.markerOwner
                ? `${accepted.markerOwner}/marker`
                : 'center/marker'
              : 'discard',
          at: cleanupAt,
          duration: 150,
        });
      }),
    );
    const marker =
      previous.markerOwner ??
      accepted.events.flatMap((e) =>
        e.type === 'travel' && e.reason === 'marker'
          ? [e.to.split('/')[0]]
          : [],
      )[0];
    if (
      marker &&
      !filled[previous.players.indexOf(marker)].floor.includes('marker')
    )
      flights.push({
        color: 'marker',
        from: `${marker}/marker`,
        to: accepted.markerOwner
          ? `${accepted.markerOwner}/marker`
          : 'center/marker',
        at: cleanupAt,
        duration: 150,
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
          (f) => f.duration === 150 && f.to === 'discard',
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
