import { tiles, type Region } from '../tiles.js';
import { cityPath, roadPath } from '../art.js';
import type { Feature } from '../features.js';

// Presentation-only standing scenery. Every layout is a pure function of the
// tile definition and its board key, so reconnects and replays draw the same
// town. Points are in unrotated tile space (0..100).
export type Pt = [number, number];
export type Slot = { x: number; y: number; sprite: string; scale: number };

/** Flatten the M/H/V/L/Q/C/S/Z subset used by art.ts into point lists. */
export function flatten(d: string, steps = 8): Pt[][] {
  const tokens = d.match(/[MHVLQCSZ]|-?\d*\.?\d+/gi) ?? [];
  const lines: Pt[][] = [];
  let line: Pt[] = [];
  let cur: Pt = [0, 0];
  let control: Pt | null = null;
  let i = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);
  const bezier = (pts: Pt[]) => {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      let p = pts;
      while (p.length > 1)
        p = p
          .slice(1)
          .map((q, j) => [
            p[j][0] + (q[0] - p[j][0]) * t,
            p[j][1] + (q[1] - p[j][1]) * t,
          ]);
      line.push(p[0]);
    }
  };
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === 'Z') {
      if (line.length) lines.push(line);
      line = [];
      continue;
    }
    if (cmd === 'M') {
      if (line.length) lines.push(line);
      cur = [num(), num()];
      line = [cur];
      cmd = 'L';
      control = null;
    } else if (cmd === 'H') {
      cur = [num(), cur[1]];
      line.push(cur);
      control = null;
    } else if (cmd === 'V') {
      cur = [cur[0], num()];
      line.push(cur);
      control = null;
    } else if (cmd === 'L') {
      cur = [num(), num()];
      line.push(cur);
      control = null;
    } else if (cmd === 'Q') {
      const c: Pt = [num(), num()];
      const end: Pt = [num(), num()];
      bezier([cur, c, end]);
      cur = end;
      control = null;
    } else if (cmd === 'C' || cmd === 'S') {
      const c1: Pt =
        cmd === 'C'
          ? [num(), num()]
          : control
            ? [2 * cur[0] - control[0], 2 * cur[1] - control[1]]
            : cur;
      const c2: Pt = [num(), num()];
      const end: Pt = [num(), num()];
      bezier([cur, c1, c2, end]);
      cur = end;
      control = c2;
    } else i++;
  }
  if (line.length) lines.push(line);
  return lines;
}

export function inside([x, y]: Pt, poly: Pt[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit;
  }
  return hit;
}

export function distance([x, y]: Pt, line: Pt[]) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1],
      [bx, by] = line[i];
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Deterministic 0..1 hash stream. */
export function seeded(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const onBorder = ([x, y]: Pt) => x < 0.5 || x > 99.5 || y < 0.5 || y > 99.5;

/** The city's wall: polygon segments that do not lie along the tile border. */
export function wallLines(r: Region): Pt[][] {
  const poly = flatten(cityPath(r))[0];
  const lines: Pt[][] = [];
  let line: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const border =
      onBorder(a) &&
      onBorder(b) &&
      (a[0] === b[0] || a[1] === b[1]) &&
      (a[0] < 0.5 || a[0] > 99.5 || a[1] < 0.5 || a[1] > 99.5);
    if (border) {
      if (line.length > 1) lines.push(line);
      line = [];
    } else {
      if (!line.length) line.push(a);
      line.push(b);
    }
  }
  if (line.length > 1) lines.push(line);
  // Merge a wall that wraps past the polygon's start point.
  if (
    lines.length > 1 &&
    lines[0][0] === lines.at(-1)!.at(-1) &&
    !onBorder(lines[0][0])
  )
    lines[0] = [...lines.pop()!, ...lines[0].slice(1)];
  return lines;
}

function length(line: Pt[]) {
  let n = 0;
  for (let i = 1; i < line.length; i++)
    n += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return n;
}
function along(line: Pt[], at: number): Pt {
  for (let i = 1; i < line.length; i++) {
    const s = Math.hypot(
      line[i][0] - line[i - 1][0],
      line[i][1] - line[i - 1][1],
    );
    if (at <= s)
      return [
        line[i - 1][0] + ((line[i][0] - line[i - 1][0]) * at) / (s || 1),
        line[i - 1][1] + ((line[i][1] - line[i - 1][1]) * at) / (s || 1),
      ];
    at -= s;
  }
  return line.at(-1)!;
}

const houses = ['houses-a', 'houses-b', 'houses-c', 'houses-d'];
const singles = ['house-single-a', 'house-single-b'];

/** Houses and towers standing inside one city region. */
export function cityLayout(
  tileId: string,
  regionId: string,
  key: string,
  keep: boolean,
): Slot[] {
  const tile = tiles[tileId];
  const r = tile.regions.find((v) => v.id === regionId)!;
  const poly = flatten(cityPath(r))[0];
  const walls = wallLines(r);
  const rand = seeded(`${tileId}/${regionId}/${key}`);
  const anchors = tile.regions.map((v) => v.anchor);
  const slots: Slot[] = [];
  const clear = (p: Pt, gap: number) =>
    slots.every(
      (s) =>
        Math.hypot(s.x - p[0], s.y - p[1]) >=
        (s.sprite === 'keep' || s.sprite === 'cathedral' ? 30 : gap),
    );
  if (keep || r.cathedral) {
    const [x, y] = r.anchor;
    slots.push({
      x,
      y: y - 6,
      sprite: r.cathedral ? 'cathedral' : 'keep',
      scale: 1,
    });
  }
  for (const line of walls) {
    const n = length(line);
    const count = Math.max(1, Math.round(n / 42));
    for (let i = 0; i < count; i++) {
      const p = along(line, (n * (i + 0.5)) / count);
      if (!clear(p, 16)) continue;
      slots.push({
        x: p[0],
        y: p[1],
        sprite: rand() < 0.5 ? 'tower-round' : 'tower-square',
        scale: 1,
      });
    }
  }
  const candidates: Pt[] = [];
  for (let y = 12; y <= 90; y += 11)
    for (let x = 12; x <= 88; x += 11)
      candidates.push([x + (rand() - 0.5) * 6, y + (rand() - 0.5) * 6]);
  for (const p of candidates) {
    if (!inside(p, poly)) continue;
    if (walls.some((w) => distance(p, w) < 7)) continue;
    if (anchors.some((a) => Math.hypot(a[0] - p[0], a[1] - p[1]) < 12))
      continue;
    if (!clear(p, 18)) continue;
    const cluster = rand() < 0.7;
    slots.push({
      x: p[0],
      y: p[1],
      sprite: cluster
        ? houses[Math.floor(rand() * houses.length)]
        : singles[Math.floor(rand() * singles.length)],
      scale: 0.85 + rand() * 0.3,
    });
  }
  return slots;
}

const props = ['trees-a', 'trees-a', 'trees-b', 'trees-c', 'bush'];

/** Whether a point sits on open meadow, clear of every drawn feature. */
function openMeadow(tileId: string) {
  const tile = tiles[tileId];
  const cities = tile.regions
    .filter((r) => r.kind === 'city')
    .map((r) => flatten(cityPath(r))[0]);
  const roads = tile.regions
    .filter((r) => r.kind === 'road')
    .flatMap((r) => flatten(roadPath(r)));
  const rivers = tile.regions
    .filter((r) => r.kind === 'river')
    .flatMap((r) => flatten(roadPath(r)));
  const blocked = tile.regions
    .filter((r) => r.kind !== 'field' && r.kind !== 'river')
    .map((r) => ({
      at: r.anchor,
      radius: r.kind === 'monastery' || r.kind === 'garden' ? 30 : 12,
    }));
  if (tile.source || tile.lake || tile.ferry)
    blocked.push({ at: [50, 50], radius: tile.lake ? 30 : 22 });
  if (tile.crop) blocked.push({ at: [50, 56], radius: 22 });
  // Corner markers drawn by TileArt (gold, magic, robber, flight).
  if (tile.gold || tile.magic || tile.robber)
    blocked.push({ at: [20, 78], radius: 14 });
  if (tile.flight) blocked.push({ at: [38, 35], radius: 16 });
  const fields = tile.regions.filter((r) => r.kind === 'field');
  for (const f of fields) blocked.push({ at: f.anchor, radius: 10 });
  return (p: Pt, margin = 0) =>
    cities.every((c) => !inside(p, c) && distance(p, c) > 6 + margin) &&
    roads.every((l) => distance(p, l) > 9 + margin) &&
    rivers.every((l) => distance(p, l) > 13 + margin) &&
    blocked.every(
      (b) => Math.hypot(b.at[0] - p[0], b.at[1] - p[1]) > b.radius + margin,
    );
}

/** A flat wheat or vineyard patch on some tiles with room for one. */
export function decal(tileId: string) {
  const open = openMeadow(tileId);
  const rand = seeded(`${tileId}/decal`);
  if (rand() > 0.45) return null;
  const spots: Pt[] = [
    [28, 28],
    [72, 28],
    [72, 72],
    [28, 72],
    [50, 50],
  ];
  const start = Math.floor(rand() * spots.length);
  const kind = rand() < 0.55 ? 'wheat' : 'vineyard';
  for (let i = 0; i < spots.length; i++) {
    const [x, y] = spots[(start + i) % spots.length];
    const corners: Pt[] = [
      [x - 12, y - 10],
      [x + 12, y - 10],
      [x - 12, y + 10],
      [x + 12, y + 10],
    ];
    if (open([x, y], 4) && corners.every((c) => open(c, -3)))
      return { x, y, kind, size: 26 };
  }
  return null;
}

/** Trees, sheep and the occasional windmill on a tile's open meadow. */
export function meadowLayout(tileId: string, key: string): Slot[] {
  const open = openMeadow(tileId);
  const patch = decal(tileId);
  const rand = seeded(`${tileId}/${key}/meadow`);
  const slots: Slot[] = [];
  const candidates: Pt[] = [];
  for (let y = 12; y <= 88; y += 19)
    for (let x = 12; x <= 88; x += 19)
      candidates.push([x + (rand() - 0.5) * 8, y + (rand() - 0.5) * 8]);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const free = candidates.filter(
    (p) =>
      open(p) && (!patch || Math.hypot(patch.x - p[0], patch.y - p[1]) > 15),
  );
  const windmill = free.length >= 12 && rand() < 0.12;
  for (const p of free) {
    if (slots.length >= 5) break;
    if (slots.some((s) => Math.hypot(s.x - p[0], s.y - p[1]) < 17)) continue;
    let sprite = props[Math.floor(rand() * props.length)];
    if (windmill && !slots.some((s) => s.sprite === 'windmill'))
      sprite = 'windmill';
    else if (rand() < 0.22) sprite = rand() < 0.5 ? 'sheep-a' : 'sheep-b';
    else if (rand() < 0.06) sprite = 'haystack';
    slots.push({ x: p[0], y: p[1], sprite, scale: 0.85 + rand() * 0.3 });
  }
  return slots;
}

/** Where roads cross rivers, for bridge decks. Angle is the road direction. */
export function bridges(tileId: string) {
  const tile = tiles[tileId];
  const rivers = tile.regions
    .filter((r) => r.kind === 'river')
    .flatMap((r) => flatten(roadPath(r)));
  const out: { x: number; y: number; angle: number }[] = [];
  if (!rivers.length) return out;
  for (const r of tile.regions.filter((r) => r.kind === 'road'))
    for (const line of flatten(roadPath(r), 24))
      for (let i = 1; i < line.length; i++) {
        const p = line[i];
        if (rivers.some((l) => distance(p, l) < 1.2)) {
          if (out.some((b) => Math.hypot(b.x - p[0], b.y - p[1]) < 20))
            continue;
          const q = line[i - 1];
          out.push({
            x: p[0],
            y: p[1],
            angle: (Math.atan2(p[1] - q[1], p[0] - q[0]) * 180) / Math.PI,
          });
        }
      }
  return out;
}

/** Completed cities and monasteries that the newly placed tile finished. */
export function risingFeatures(features: Feature[], placed: string): string[] {
  const [px, py] = placed.split(',').map(Number);
  return features
    .filter((f) => {
      if (!f.complete) return false;
      if (f.kind === 'city') return f.tiles.includes(placed);
      if (f.kind === 'monastery' || f.kind === 'garden') {
        const [x, y] = f.tiles[0].split(',').map(Number);
        return Math.abs(x - px) <= 1 && Math.abs(y - py) <= 1;
      }
      return false;
    })
    .map((f) => f.id);
}
