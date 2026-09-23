import type { Link } from './index.js';

/**
 * Pure table geometry shared by every board look. Units: a tile is 1 wide and
 * 2 long; (0, 0) is the table centre, +x right, +y towards the viewer.
 */
export type Pose = {
  x: number;
  y: number;
  /** Degrees clockwise; 0 means the `near` half points left, `far` right. */
  angle: number;
};
export type Placement = Pose & {
  id: number;
  seq: number;
  near: number;
  far: number;
};
type Vec = [number, number];
/** Half-width of the playing surface the snake turns inside. */
export const HALF_WIDTH = 10;
const GAP = 0.06;
const deg = ([dx, dy]: Vec) => (Math.atan2(dy, dx) * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** `a ∘ b`: pose `b` expressed in `a`'s frame, placed on the table. */
export function compose(a: Pose, b: Pose): Pose {
  const c = Math.cos(rad(a.angle)),
    s = Math.sin(rad(a.angle));
  return {
    x: a.x + c * b.x - s * b.y,
    y: a.y + s * b.x + c * b.y,
    angle: a.angle + b.angle,
  };
}
/** Pose `b` seen from pose `a`, so that `compose(a, relative(a, b)) = b`. */
export function relative(a: Pose, b: Pose): Pose {
  const c = Math.cos(rad(a.angle)),
    s = Math.sin(rad(a.angle));
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy, angle: b.angle - a.angle };
}

/** Walks one arm of the chain outward from the lead tile, turning at the rails. */
function arm(
  links: { id: number; near: number; far: number; seq: number }[],
  start: Vec,
  dir: Vec,
  turn: Vec,
) {
  let pos: Vec = [...start];
  let d: Vec = [...dir];
  let vertical = 0;
  const out: Placement[] = [];
  const place = (len: number, across: boolean) => {
    const center: Vec = [pos[0] + d[0] * (len / 2), pos[1] + d[1] * (len / 2)];
    const angle = deg(d) + (across ? 90 : 0);
    pos = [pos[0] + d[0] * (len + GAP), pos[1] + d[1] * (len + GAP)];
    return { x: center[0], y: center[1], angle };
  };
  const bend = (to: Vec) => {
    // Corner: the new tile sits beside the last end, forming an L.
    pos = [
      pos[0] - d[0] * GAP + d[0] * 0.5 - to[0] * 0.5,
      pos[1] - d[1] * GAP + d[1] * 0.5 - to[1] * 0.5,
    ];
    d = to;
  };
  for (const link of links) {
    let bent = false;
    if (d[1] === 0 && Math.abs(pos[0] + d[0] * 2) > HALF_WIDTH) {
      bend(turn);
      vertical = 0;
      bent = true;
    } else if (d[1] !== 0 && vertical >= 1) {
      bend([pos[0] > 0 ? -1 : 1, 0]);
      bent = true;
    }
    if (d[1] !== 0) vertical++;
    // Doubles lie across the line, except where the line bends.
    const s =
      link.near === link.far && !bent && d[1] === 0
        ? place(1, true)
        : place(2, false);
    out.push({ ...link, ...s });
  }
  return out;
}

/**
 * Where every tile would rest on a tidy table. The snake is incremental:
 * adding a tile at either end never moves the tiles already placed.
 */
export function idealLayout(chain: Link[]): Placement[] {
  if (!chain.length) return [];
  const lead = chain.findIndex((l) => l.seq === 0);
  const first = chain[lead];
  const double = first.left === first.right;
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
  );
  const left = arm(
    chain
      .slice(0, lead)
      .reverse()
      .map((l) => ({ ...l, near: l.right, far: l.left })),
    [-half - GAP, 0],
    [-1, 0],
    [0, 1],
  );
  return [centre, ...left, ...right];
}
export function idealPoses(chain: Link[]): Record<number, Pose> {
  return Object.fromEntries(
    idealLayout(chain).map((p) => [p.id, { x: p.x, y: p.y, angle: p.angle }]),
  );
}

/**
 * Where a newly attached tile rests: against its neighbour wherever that
 * neighbour actually lies now, at the offset a tidy table would use.
 * `after` is the chain once the tile is attached.
 */
export function plug(
  after: Link[],
  poses: Record<number, Pose>,
  id: number,
): Pose {
  const ideal = idealPoses(after);
  if (after.length === 1) return ideal[id];
  const neighbour =
    after[0].id === id ? after[1].id : after[after.length - 2].id;
  const actual = poses[neighbour] ?? ideal[neighbour];
  return compose(actual, relative(ideal[neighbour], ideal[id]));
}

/** Every tile at its actual resting pose, with pips oriented along it. */
export function placements(
  chain: Link[],
  poses: Record<number, Pose>,
): Placement[] {
  return idealLayout(chain).map((p) => ({ ...p, ...(poses[p.id] ?? {}) }));
}

function corners(p: Pose): Vec[] {
  const c = Math.cos(rad(p.angle)),
    s = Math.sin(rad(p.angle));
  return (
    [
      [-1, -0.5],
      [1, -0.5],
      [1, 0.5],
      [-1, 0.5],
    ] as Vec[]
  ).map(([x, y]) => [p.x + c * x - s * y, p.y + s * x + c * y]);
}
/** Smallest push (separating axis) that takes `b` off `a`, or null when apart. */
function overlap(a: Pose, b: Pose): Vec | null {
  const ca = corners(a),
    cb = corners(b);
  let best: Vec | null = null,
    depth = Infinity;
  for (const poly of [ca, cb])
    for (let i = 0; i < 2; i++) {
      const [x0, y0] = poly[i],
        [x1, y1] = poly[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const axis: Vec = [-(y1 - y0) / len, (x1 - x0) / len];
      const proj = (pts: Vec[]) =>
        pts.map(([x, y]) => x * axis[0] + y * axis[1]);
      const pa = proj(ca),
        pb = proj(cb);
      const o =
        Math.min(Math.max(...pa), Math.max(...pb)) -
        Math.max(Math.min(...pa), Math.min(...pb));
      if (o <= 0.02) return null;
      if (o < depth) {
        depth = o;
        const toward =
          (b.x - a.x) * axis[0] + (b.y - a.y) * axis[1] >= 0 ? 1 : -1;
        best = [axis[0] * o * toward, axis[1] * o * toward];
      }
    }
  return best;
}
/** Pushes overlapping tiles apart so a scattered table stays physical. */
export function separate(poses: Record<number, Pose>, rounds = 8) {
  const ids = Object.keys(poses).map(Number);
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = poses[ids[i]],
          b = poses[ids[j]];
        const push = overlap(a, b);
        if (!push) continue;
        moved = true;
        a.x -= push[0] / 2;
        a.y -= push[1] / 2;
        b.x += push[0] / 2;
        b.y += push[1] / 2;
      }
    if (!moved) return;
  }
}
