/** One art pixel of the 8-bit island in board (SVG) units: a hex is 64 px wide. Every shape snaps to it. */
export const P = 100 / 64;

type Rows = Map<number, Set<number>>;

/** Merges pixel cells into one horizontal run per row: `M x y h w v P h -w z`. */
function runs(rows: Rows) {
  let d = '';
  for (const [y, set] of rows) {
    const xs = [...set].sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (xs[j + 1] === xs[j] + 1) j++;
      const w = (j - i + 1) * P;
      d += `M${xs[i] * P} ${y * P}h${w}v${P}h${-w}z`;
      i = j + 1;
    }
  }
  return d;
}

function add(rows: Rows, x: number, y: number) {
  let row = rows.get(y);
  if (!row) rows.set(y, (row = new Set()));
  row.add(x);
}

/** A convex polygon rasterized on the art-pixel grid, grown from its centre by `grow` px. */
export function polygonPixels(corners: number[][], grow = 0) {
  const cx = corners.reduce((s, c) => s + c[0], 0) / corners.length,
    cy = corners.reduce((s, c) => s + c[1], 0) / corners.length;
  const pts = corners.map(([x, y]) => {
    const r = Math.hypot(x - cx, y - cy) || 1,
      k = (r + grow * P) / r;
    return [cx + (x - cx) * k, cy + (y - cy) * k];
  });
  const ys = pts.map((p) => p[1]);
  const rows: Rows = new Map();
  for (
    let row = Math.floor(Math.min(...ys) / P);
    row <= Math.ceil(Math.max(...ys) / P);
    row++
  ) {
    const y = (row + 0.5) * P;
    let left = Infinity,
      right = -Infinity;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    });
    if (left < right)
      for (let x = Math.round(left / P); x < Math.round(right / P); x++)
        add(rows, x, row);
  }
  return runs(rows);
}

export function discPixels(x: number, y: number, r: number) {
  const gx = Math.round(x / P),
    gy = Math.round(y / P);
  const rows: Rows = new Map();
  for (let dy = -r; dy < r; dy++) {
    const half = Math.round(Math.sqrt(r * r - (dy + 0.5) ** 2));
    for (let dx = -half; dx < half; dx++) add(rows, gx + dx, gy + dy);
  }
  return runs(rows);
}

/** A stair-stepped pixel line from a to b drawn with a square brush (radius in px). */
export function linePixels(
  a: number[],
  b: number[],
  brush = 0,
  shiftY = 0,
  trim = 0,
) {
  const [ax, ay] = [a[0] + (b[0] - a[0]) * trim, a[1] + (b[1] - a[1]) * trim];
  const [bx, by] = [b[0] + (a[0] - b[0]) * trim, b[1] + (a[1] - b[1]) * trim];
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (P / 2)));
  const rows: Rows = new Map();
  for (let i = 0; i <= steps; i++) {
    const gx = Math.floor((ax + ((bx - ax) * i) / steps) / P),
      gy = Math.floor((ay + ((by - ay) * i) / steps) / P) + shiftY;
    for (let dy = -brush; dy <= brush; dy++)
      for (let dx = -brush; dx <= brush; dx++) add(rows, gx + dx, gy + dy);
  }
  return runs(rows);
}

export const snap = (v: number) => Math.round(v / P) * P;

export function cell(
  url: string,
  col: number,
  cols: number,
  row = 0,
  rows = 1,
) {
  return (
    `background-image:url("${url}");background-size:${cols * 100}% ${rows * 100}%;` +
    `background-position:${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`
  );
}

const base = '/games/catan/pixel/';
/** Sprite sheets under `apps/web/static/games/catan/pixel/` (see docs/catan-pixel.md). */
export const sheets = {
  table: base + 'table.webp',
  /** forest, pasture, fields, hills, mountains, desert: 64 × 69 each. */
  terrain: { url: base + 'terrain.webp', cols: 6, w: 64, h: 69 },
  /** wood, wool, wheat, brick, ore: 32 px. */
  resources: { url: base + 'resources.webp', cols: 5, size: 32 },
  /** The same five at 16 px, for harbor badges. */
  resourcesSmall: { url: base + 'resources-small.webp', cols: 5, size: 16 },
  /** harbor boat: 24 px. */
  boat: { url: base + 'boat.webp', size: 24 },
  /** KNIGHT, ROAD_BUILDING, INVENTION, MONOPOLY, VICTORY_POINT, back: 64 px. */
  cards: { url: base + 'cards.webp', cols: 6, size: 64 },
  /** six civilization crests, then Longest Route and Largest Army: 32 px. */
  crests: { url: base + 'crests.webp', cols: 8, size: 32 },
};
export const developmentCell = (kind: string) =>
  Math.max(
    0,
    [
      'KNIGHT',
      'ROAD_BUILDING',
      'INVENTION',
      'MONOPOLY',
      'VICTORY_POINT',
    ].indexOf(kind),
  );
