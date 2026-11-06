// 8-bit tile rasterizer. Every tile is painted at runtime into a true low-resolution
// image: the ground (meadow, rivers, towns, walls, roads) on a 64px grid sampled from
// tileable Codex textures in world space, so meadows and towns flow across tiles,
// and the painted buildings and symbols on a 128px grid. Geometry comes from the same
// `art.ts` paths as the classic SVG, so decoration never changes topology.
import { tiles, rotatePoint, type Region } from '../tiles.js';
import { cityPath, roadPath } from '../art.js';
import { bridges, decal, wallLines } from '../table/scenery.js';
import { lift } from '../table/camera.js';
import { terrainRects, spriteRects } from './sheet.js';
import { stamp, bitmapSize } from './bitmaps.js';

export const pixelRoot = '/games/carcassonne/pixel/';
/** Ground grid (G) and sprite grid (S), in pixels per tile. */
const G = 64,
  S = 128;
/** Tile units per sprite pixel (a tile is 100 units). */
export const spriteUnit = 100 / S;

const art = $state({ ready: false });

let terrain: { data: Uint8ClampedArray; width: number } | undefined;
let sheet: HTMLCanvasElement | undefined;
let loading: Promise<void> | undefined;

function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
function context(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Loads the two sheets once; components re-render when `art.ready` flips. */
export function loadPixelArt() {
  loading ??= Promise.all([
    image(`${pixelRoot}terrain.webp`),
    image(`${pixelRoot}sprites.webp`),
  ])
    .then(([t, s]) => {
      const tc = canvas(t.width, t.height);
      const tx = context(tc);
      tx.drawImage(t, 0, 0);
      terrain = {
        data: tx.getImageData(0, 0, t.width, t.height).data,
        width: t.width,
      };
      sheet = canvas(s.width, s.height);
      context(sheet).drawImage(s, 0, 0);
      art.ready = true;
    })
    .catch(() => {
      loading = undefined;
    });
  return loading;
}

type RGB = [number, number, number];
type Texture = keyof typeof terrainRects;
function texel(name: Texture, x: number, y: number): RGB {
  const [ox, oy, w, h] = terrainRects[name];
  const i =
    ((oy + (((y % h) + h) % h)) * terrain!.width + ox + (((x % w) + w) % w)) *
    4;
  const d = terrain!.data;
  return [d[i], d[i + 1], d[i + 2]];
}
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const ink: RGB = [34, 22, 14];

let scratch: CanvasRenderingContext2D | undefined;
/** Rasterizes a path drawing on the 64px ground grid, rotated like the tile, to a hard mask. */
function mask(
  rotation: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Uint8Array {
  const ctx = (scratch ??= context(canvas(G, G)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, G, G);
  ctx.setTransform(G / 100, 0, 0, G / 100, 0, 0);
  ctx.translate(50, 50);
  ctx.rotate((rotation * Math.PI) / 2);
  ctx.translate(-50, -50);
  ctx.fillStyle = ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  draw(ctx);
  const d = ctx.getImageData(0, 0, G, G).data;
  const out = new Uint8Array(G * G);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return out;
}
const stroke =
  (d: string, width: number, cap: CanvasLineCap = 'butt') =>
  (ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = width;
    ctx.lineCap = cap;
    ctx.stroke(new Path2D(d));
  };
const fill = (d: string) => (ctx: CanvasRenderingContext2D) =>
  ctx.fill(new Path2D(d));
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`;

function ground(id: string, rotation: number, tx: number, ty: number) {
  const tile = tiles[id];
  const px = new Float32Array(G * G * 3);
  const set = (i: number, c: RGB) => {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  };
  const get = (i: number): RGB => [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
  const wx = (i: number) => tx * G + (i % G);
  const wy = (i: number) => ty * G + Math.floor(i / G);
  const paint = (m: Uint8Array, color: (i: number) => RGB) => {
    for (let i = 0; i < m.length; i++) if (m[i]) set(i, color(i));
  };
  for (let i = 0; i < G * G; i++) set(i, texel('meadow', wx(i), wy(i)));

  const water = (i: number) => texel('water', wx(i), wy(i));
  const sand = (i: number) =>
    mix(texel('road', wx(i), wy(i)), [236, 218, 160], 0.55);
  const reed = (i: number) => shade(get(i), 0.62);
  for (const r of tile.regions.filter((r) => r.kind === 'river')) {
    paint(mask(rotation, stroke(roadPath(r), 24, 'round')), reed);
    paint(mask(rotation, stroke(roadPath(r), 20, 'round')), sand);
    paint(mask(rotation, stroke(roadPath(r), 15, 'round')), water);
    if (tile.source || tile.lake) {
      const [rx, ry] = tile.lake ? [23, 18] : [12, 11];
      paint(mask(rotation, fill(ellipse(50, 50, rx + 3, ry + 3))), sand);
      paint(mask(rotation, fill(ellipse(50, 50, rx, ry))), water);
    }
  }
  if (tile.ferry) {
    const lake = 'M30 35Q48 24 66 37Q80 51 65 64Q48 74 31 62Q23 48 30 35Z';
    paint(mask(rotation, stroke(lake, 5)), sand);
    paint(mask(rotation, fill(lake)), water);
  }

  const cities = tile.regions.filter((r) => r.kind === 'city');
  const city = new Uint8Array(G * G);
  cities.forEach((r, n) => {
    const m = mask(rotation, fill(cityPath(r)));
    for (let i = 0; i < m.length; i++) if (m[i]) city[i] = n + 1;
  });
  if (cities.length) {
    const edge = new Uint8Array(G * G);
    for (let i = 0; i < G * G; i++) {
      const x = i % G,
        y = (i - x) / G;
      let best = 9;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
          if (city[ny * G + nx] !== city[i])
            best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      edge[i] = best;
    }
    for (let i = 0; i < G * G; i++) {
      const x = i % G,
        y = (i - x) / G;
      if (!city[i]) {
        // Meadow side of a wall: a hard ink line, then a one-pixel shadow.
        if (edge[i] === 1) set(i, mix(get(i), ink, 0.85));
        else if (edge[i] === 2) set(i, shade(get(i), 0.78));
        continue;
      }
      const stone = texel('stone', wx(i), wy(i));
      if (edge[i] === 1)
        set(i, (x + y) % 2 ? shade(stone, 0.78) : shade(stone, 1.12));
      else if (edge[i] === 2) set(i, shade(stone, 0.96));
      else if (edge[i] === 3)
        set(i, mix(texel('town', wx(i), wy(i)), ink, 0.45));
      else set(i, texel('town', wx(i), wy(i)));
    }
  }

  // Roads: a dark verge, then packed earth; crossings keep a separating edge.
  const roads = tile.regions.filter((r) => r.kind === 'road');
  roads.forEach((r, i) => {
    const d = roadPath(r);
    if (
      i > 0 &&
      r.ports.length === 2 &&
      roads.some((v) => v !== r && v.ports.length === 2)
    )
      paint(mask(rotation, stroke(d, 14)), () => [52, 45, 32]);
    paint(mask(rotation, stroke(d, 13)), (j) => mix(get(j), ink, 0.55));
    paint(mask(rotation, stroke(d, 9.5)), (j) => texel('road', wx(j), wy(j)));
  });

  for (const b of bridges(id)) {
    const [bx, by] = rotatePoint([b.x, b.y], rotation);
    const across =
      Math.abs(Math.cos(((b.angle + rotation * 90) * Math.PI) / 180)) > 0.7;
    const [w, h] = across ? [15, 7] : [7, 15];
    const x0 = Math.round((bx * G) / 100 - w / 2),
      y0 = Math.round((by * G) / 100 - h / 2);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= G || y >= G) continue;
        const i = y * G + x;
        const rim = across
          ? y === y0 || y === y0 + h - 1
          : x === x0 || x === x0 + w - 1;
        const rail = across
          ? y === y0 + 1 || y === y0 + h - 2
          : x === x0 + 1 || x === x0 + w - 2;
        set(
          i,
          rim
            ? ink
            : rail
              ? shade(texel('stone', x, y), (x + y) % 2 ? 0.8 : 1.1)
              : texel('road', wx(i), wy(i)),
        );
      }
  }

  // Gardens: a tilled bed with rows of greens.
  if (tile.regions.some((r) => r.kind === 'garden')) {
    const [gx, gy] = rotatePoint([62, 66], rotation);
    const x0 = Math.round((gx * G) / 100) - 8,
      y0 = Math.round((gy * G) / 100) - 6;
    for (let y = y0; y < y0 + 12; y++)
      for (let x = x0; x < x0 + 16; x++) {
        const i = y * G + x;
        const rim = y === y0 || y === y0 + 11 || x === x0 || x === x0 + 15;
        const row = (x - x0) % 3 === 1;
        set(
          i,
          rim
            ? [120, 84, 44]
            : row
              ? (x + y) % 4
                ? [58, 110, 52]
                : [222, 170, 120]
              : [96, 66, 38],
        );
      }
  }

  // Bevel: a lit top-left rim and a shaded bottom-right rim, like a cardboard tile.
  for (let i = 0; i < G * G; i++) {
    const x = i % G,
      y = (i - x) / G;
    if (x === G - 1 || y === G - 1) set(i, shade(get(i), 0.62));
    else if (x === 0 || y === 0) set(i, mix(get(i), [255, 244, 210], 0.28));
  }
  const img = new ImageData(G, G);
  for (let i = 0; i < G * G; i++) {
    img.data[i * 4] = px[i * 3];
    img.data[i * 4 + 1] = px[i * 3 + 1];
    img.data[i * 4 + 2] = px[i * 3 + 2];
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

type Sprite = keyof typeof spriteRects;
function sprite(
  ctx: CanvasRenderingContext2D,
  name: Sprite,
  [x, y]: [number, number],
  anchor: 'bottom' | 'center' = 'bottom',
) {
  const [sx, sy, w, h] = spriteRects[name];
  const cx = (x * S) / 100,
    cy = (y * S) / 100;
  ctx.drawImage(
    sheet!,
    sx,
    sy,
    w,
    h,
    Math.round(cx - w / 2),
    Math.round(anchor === 'bottom' ? cy - h : cy - h / 2),
    w,
    h,
  );
}
function symbol(
  ctx: CanvasRenderingContext2D,
  name: string,
  [x, y]: [number, number],
  accent?: string,
) {
  // Symbols sit on the chunky ground grid: every bitmap pixel is 2×2.
  const { w, h } = bitmapSize(name);
  stamp(
    ctx,
    name,
    2 * Math.round((x * G) / 100 - w / 2),
    2 * Math.round((y * G) / 100 - h / 2),
    accent,
    2,
  );
}
function pond(ctx: CanvasRenderingContext2D, [x, y]: [number, number]) {
  const cx = (x * S) / 100,
    cy = (y * S) / 100;
  for (let j = -7; j <= 7; j++)
    for (let i = -11; i <= 11; i++) {
      const d = (i / 11) ** 2 + (j / 7) ** 2;
      if (d > 1) continue;
      ctx.fillStyle =
        d > 0.72 ? '#d9c58e' : (i + j) % 5 ? '#3f7fc0' : '#8cc8ec';
      ctx.fillRect(Math.round(cx + i), Math.round(cy + j), 1, 1);
    }
}

const grounds = new Map<string, string>();
let out:
  | { ctx: CanvasRenderingContext2D; small: CanvasRenderingContext2D }
  | undefined;

/**
 * A tile's 8-bit image (128×128, world-oriented) as a data URL. `x`/`y` place the
 * texture window so neighbouring tiles continue each other's meadows and towns.
 */
export function tileImage(id: string, rotation = 0, x = 0, y = 0): string {
  if (!art.ready || !tiles[id]) return '';
  const key = `${id}/${rotation}/${x},${y}`;
  const hit = grounds.get(key);
  if (hit) return hit;
  out ??= {
    ctx: context(canvas(S, S)),
    small: context(canvas(G, G)),
  };
  const { ctx, small } = out;
  const tile = tiles[id];
  small.putImageData(ground(id, rotation, x, y), 0, 0);
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(small.canvas, 0, 0, S, S);
  const at = (p: [number, number]) => rotatePoint(p, rotation);

  const patch = decal(id);
  if (patch)
    sprite(ctx, patch.kind as Sprite, at([patch.x, patch.y]), 'center');
  const roads = tile.regions.filter((r) => r.kind === 'road');
  for (const r of roads)
    if (r.inn) {
      const p = at([r.anchor[0] + 11, r.anchor[1] - 7]);
      pond(ctx, [p[0], p[1] + 3]);
      sprite(ctx, 'house-single-a', [p[0], p[1] + 3]);
    }
  if (roads.some((r) => r.ports.length === 1) && !tile.ferry)
    sprite(ctx, 'shrine', [50, 57]);
  if (tile.regions.some((r) => r.kind === 'monastery'))
    sprite(ctx, 'monastery', [50, 78]);
  const cities = tile.regions.filter((r) => r.kind === 'city');
  for (const r of cities) {
    const [ax, ay] = at(r.anchor);
    if (r.cathedral) sprite(ctx, 'cathedral', [ax, ay + 24]);
    else if (
      r.ports.length >= 3 ||
      (r.ports.length === 2 && Math.abs(r.ports[0] - r.ports[1]) === 2)
    )
      sprite(ctx, 'keep-small', [ax, ay + 12]);
  }
  for (const r of cities) {
    const [ax, ay] = at(r.anchor);
    for (let i = 0; i < r.shields; i++)
      symbol(ctx, 'shield', [ax + i * 16 - (r.shields - 1) * 8, ay + 2]);
    const good = r.goods.findIndex(Boolean);
    if (good >= 0)
      symbol(ctx, ['wine', 'grain', 'cloth'][good], [ax + 12, ay + 12]);
  }
  if (tile.flight) symbol(ctx, 'flight', at([38, 35]));
  if (tile.gold) symbol(ctx, 'gold', at([22, 79]));
  if (tile.magic) symbol(ctx, 'magic', at([20, 76]));
  if (tile.robber) symbol(ctx, 'robber', at([20, 80]));
  if (tile.crop)
    symbol(
      ctx,
      'crop',
      at([50, 56]),
      tile.crop === 'city'
        ? '#b0302a'
        : tile.crop === 'road'
          ? '#c08a50'
          : '#3d7a33',
    );
  const url = ctx.canvas.toDataURL();
  grounds.set(key, url);
  return url;
}

const walls = new Map<string, string>();
/**
 * Raised town walls for the standing pass: stacked stone courses along every inner
 * city edge, 2 high while a city is open and 6 once it is complete.
 */
export function wallImage(
  id: string,
  rotation: number,
  complete: boolean[],
): string {
  if (!art.ready) return '';
  const key = `${id}/${rotation}/${complete.map(Number).join('')}`;
  const hit = walls.get(key);
  if (hit) return hit;
  const cities = tiles[id].regions.filter((r) => r.kind === 'city');
  const img = new ImageData(G, G);
  const solid = new Uint8Array(G * G);
  const put = (x: number, y: number, c: RGB) => {
    if (x < 2 || y < 2 || x > G - 3 || y > G - 3) return;
    const i = y * G + x;
    img.data.set([c[0], c[1], c[2], 255], i * 4);
    solid[i] = 1;
  };
  const up = lift(1.15);
  const step = { x: (up.x * G) / 100, y: (up.y * G) / 100 };
  cities.forEach((r: Region, n) => {
    const lines = wallLines(r);
    const m = mask(rotation, (ctx) => {
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      for (const line of lines) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    });
    const layers = complete[n] ? 6 : 2;
    for (let k = 1; k <= layers; k++) {
      const ox = Math.round(step.x * k),
        oy = Math.round(step.y * k);
      for (let i = 0; i < m.length; i++) {
        if (!m[i]) continue;
        const x = i % G,
          y = (i - x) / G;
        const stone = texel('stone', x, y + k);
        put(
          x + ox,
          y + oy,
          k === layers
            ? (x + y) % 2
              ? shade(stone, 0.82)
              : shade(stone, 1.14)
            : shade(stone, k % 2 ? 0.58 : 0.7),
        );
      }
    }
  });
  // A closed ink outline keeps the raised wall readable against roofs and grass.
  const edge: number[] = [];
  for (let i = 0; i < G * G; i++) {
    if (solid[i]) continue;
    const x = i % G,
      y = (i - x) / G;
    if (
      (x > 0 && solid[i - 1]) ||
      (x < G - 1 && solid[i + 1]) ||
      (y > 0 && solid[i - G]) ||
      (y < G - 1 && solid[i + G])
    )
      edge.push(i);
  }
  for (const i of edge) img.data.set([...ink, 255], i * 4);
  const c = context(canvas(G, G));
  c.putImageData(img, 0, 0);
  const url = c.canvas.toDataURL();
  walls.set(key, url);
  return url;
}

const sprites = new Map<string, string>();
export function spriteImage(name: string) {
  const rect = spriteRects[name as Sprite];
  if (!art.ready || !rect) return null;
  const [, , w, h] = rect;
  let url = sprites.get(name);
  if (!url) {
    const c = context(canvas(w, h));
    c.drawImage(sheet!, rect[0], rect[1], w, h, 0, 0, w, h);
    sprites.set(name, (url = c.canvas.toDataURL()));
  }
  return { url, width: w * spriteUnit, height: h * spriteUnit, w, h };
}

const figures = new Map<string, string>();
/** A player figure recoloured from the neutral grey sprite into a four-step ramp. */
export function figureImage(type: string, color: string) {
  const name = (
    type === 'large' ? 'meeple' : type === 'farmer' ? 'meeple' : type
  ) as Sprite;
  const rect = spriteRects[name];
  if (!art.ready || !rect) return null;
  const [sx, sy, w, h] = rect;
  const key = `${name}/${color}`;
  let url = figures.get(key);
  if (!url) {
    const c = context(canvas(w, h));
    c.drawImage(sheet!, sx, sy, w, h, 0, 0, w, h);
    const img = c.getImageData(0, 0, w, h);
    const base = hex(color);
    const ramp: RGB[] = [
      mix(base, [0, 0, 0], 0.55),
      mix(base, [0, 0, 0], 0.28),
      base,
      mix(base, [255, 255, 240], 0.45),
    ];
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      if (l < 60) continue;
      const c2 = ramp[l > 175 ? 3 : l > 140 ? 2 : l > 100 ? 1 : 0];
      d[i] = c2[0];
      d[i + 1] = c2[1];
      d[i + 2] = c2[2];
    }
    c.putImageData(img, 0, 0);
    figures.set(key, (url = c.canvas.toDataURL()));
  }
  return { url, w, h };
}
