import { TILES, type End, type Link, type Offset } from './index.js';

/**
 * Pure table geometry shared by every board look. Units: a tile is 1 wide and
 * 2 long; (0, 0) is the table centre, +x right, +y towards the viewer.
 */
export type Placement = {
  id: number;
  seq: number;
  x: number;
  y: number;
  /** Degrees; 0 means the `near` half points left and `far` points right. */
  angle: number;
  near: number;
  far: number;
};
export type Spot = { x: number; y: number; angle: number };
export type Layout = {
  tiles: Placement[];
  /** Where a plain tile would land next on each end. */
  next: Record<End, Spot> | null;
};
type Vec = [number, number];
const GAP = 0.06;
const deg = ([dx, dy]: Vec) => (Math.atan2(dy, dx) * 180) / Math.PI;

/** Walks one arm of the chain outward from the lead tile, turning at the rails. */
function arm(
  links: { id: number; near: number; far: number; seq: number }[],
  start: Vec,
  dir: Vec,
  turn: Vec,
  halfWidth: number,
) {
  let pos: Vec = [...start];
  let d: Vec = [...dir];
  let vertical = 0;
  const out: Placement[] = [];
  const place = (len: number, across: boolean, link?: (typeof links)[0]) => {
    const center: Vec = [pos[0] + d[0] * (len / 2), pos[1] + d[1] * (len / 2)];
    const angle = deg(d) + (across ? 90 : 0);
    pos = [pos[0] + d[0] * (len + GAP), pos[1] + d[1] * (len + GAP)];
    return { x: center[0], y: center[1], angle, link };
  };
  const bend = (to: Vec) => {
    // Corner: the new tile sits beside the last end, forming an L.
    pos = [
      pos[0] - d[0] * GAP + d[0] * 0.5 - to[0] * 0.5,
      pos[1] - d[1] * GAP + d[1] * 0.5 - to[1] * 0.5,
    ];
    d = to;
  };
  const step = (double: boolean) => {
    let bent = false;
    if (d[1] === 0 && Math.abs(pos[0] + d[0] * 2) > halfWidth) {
      bend(turn);
      vertical = 0;
      bent = true;
    } else if (d[1] !== 0 && vertical >= 1) {
      bend([pos[0] > 0 ? -1 : 1, 0]);
      bent = true;
    }
    if (d[1] !== 0) vertical++;
    // Doubles lie across the line, except where the line bends.
    return double && !bent && d[1] === 0 ? place(1, true) : place(2, false);
  };
  for (const link of links) {
    const s = step(TILES[link.id].a === TILES[link.id].b);
    out.push({
      id: link.id,
      seq: link.seq,
      x: s.x,
      y: s.y,
      angle: s.angle,
      near: link.near,
      far: link.far,
    });
  }
  const ghost = step(false);
  return { tiles: out, next: { x: ghost.x, y: ghost.y, angle: ghost.angle } };
}

export function layoutChain(
  chain: Link[],
  offsets: Record<number, Offset> = {},
  halfWidth = 10,
): Layout {
  if (!chain.length) return { tiles: [], next: null };
  const lead = chain.findIndex((l) => l.seq === 0);
  const first = chain[lead];
  const double = TILES[first.id].a === TILES[first.id].b;
  const half = double ? 0.5 : 1;
  const centre: Placement = {
    id: first.id,
    seq: 0,
    x: 0,
    y: 0,
    angle: double ? 90 : 0,
    near: first.left,
    far: first.right,
  };
  const right = arm(
    chain.slice(lead + 1).map((l) => ({ ...l, near: l.left, far: l.right })),
    [half + GAP, 0],
    [1, 0],
    [0, -1],
    halfWidth,
  );
  const left = arm(
    chain
      .slice(0, lead)
      .reverse()
      .map((l) => ({ ...l, near: l.right, far: l.left })),
    [-half - GAP, 0],
    [-1, 0],
    [0, 1],
    halfWidth,
  );
  const tiles = [centre, ...left.tiles, ...right.tiles].map((t) => {
    const o = offsets[t.id];
    return o ? { ...t, x: t.x + o.dx, y: t.y + o.dy, angle: t.angle + o.r } : t;
  });
  return { tiles, next: { left: left.next, right: right.next } };
}
