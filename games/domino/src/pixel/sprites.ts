import { SPOTS } from '../spots.js';

/**
 * Pixel sprites for the 8-bit table, drawn once into small canvases at their
 * true resolution. The scene scales them up with nearest-neighbour sampling.
 */

/** Logical pixels per layout unit: a tile is 12×24. */
export const U = 12;
/** Play area half extents in layout units (the same leather as the 3D table). */
export const FELT = { x: 14, y: 8.5 };
/** Rail width and the visible front apron, in logical pixels. */
export const RAIL = 24;
export const APRON = 12;

export const INK = '#1e110a';
const IVORY = '#f4ecd8',
  IVORY_LIGHT = '#fffaf0',
  IVORY_SHADE = '#cfc3a6',
  PIP = '#050505';

type Canvas = HTMLCanvasElement;
export function canvas(
  w: number,
  h: number,
): [Canvas, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}
const rect = (
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const tiles = new Map<string, Canvas>();
/**
 * A face-up tile lying flat, 24×12, `near` on the left half (layout angle 0).
 * Pips are pure black 2×2 squares on a 3×3 grid in each 10×10 half.
 */
export function tileSprite(near: number, far: number): Canvas {
  const key = `${near}:${far}`;
  const hit = tiles.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(24, 12);
  rect(ctx, INK, 1, 0, 22, 12);
  rect(ctx, INK, 0, 1, 24, 10);
  rect(ctx, IVORY, 1, 1, 22, 10);
  rect(ctx, IVORY_LIGHT, 1, 1, 22, 1);
  rect(ctx, IVORY_LIGHT, 1, 1, 1, 10);
  rect(ctx, IVORY_SHADE, 1, 10, 22, 1);
  rect(ctx, IVORY_SHADE, 22, 1, 1, 10);
  // Divider: a groove with a lit edge.
  rect(ctx, '#8d7e63', 11, 2, 1, 8);
  rect(ctx, IVORY_LIGHT, 12, 2, 1, 8);
  [near, far].forEach((n, half) => {
    const x0 = half ? 13 : 1;
    for (const [along, across] of SPOTS[n])
      rect(ctx, PIP, x0 + 1 + along * 3, 2 + across * 3, 2, 2);
  });
  tiles.set(key, c);
  return c;
}

/** A tile standing on its long edge, back to us: what opponents hold. */
export function backSprite(): Canvas {
  const [c, ctx] = canvas(8, 13);
  rect(ctx, INK, 0, 0, 8, 13);
  rect(ctx, IVORY, 1, 1, 6, 11);
  rect(ctx, IVORY_LIGHT, 1, 1, 6, 2);
  rect(ctx, IVORY_SHADE, 1, 10, 6, 2);
  return c;
}
/** The same standing tile seen side-on from above, for the side seats. */
export function edgeSprite(): Canvas {
  const [c, ctx] = canvas(13, 5);
  rect(ctx, INK, 0, 0, 13, 5);
  rect(ctx, IVORY_LIGHT, 1, 1, 11, 1);
  rect(ctx, IVORY, 1, 2, 11, 1);
  rect(ctx, IVORY_SHADE, 1, 3, 11, 1);
  return c;
}

/** A small deterministic hash so procedural wood and leather look the same every load. */
const noise = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number, t: number) =>
  t * 16 > BAYER[(y % 4) * 4 + (x % 4)];

/**
 * The table seen from above with its front apron: wood rails, corner cup
 * holders and a dithered leather top. Origin is the table's top-left corner;
 * the leather centre is at (width / 2, RAIL + FELT.y * U).
 */
export function tableSprite(): Canvas {
  const fx = FELT.x * U,
    fy = FELT.y * U;
  const w = fx * 2 + RAIL * 2,
    h = fy * 2 + RAIL * 2;
  const [c, ctx] = canvas(w, h + APRON);
  // Leather: three tones, ordered dither, warmer in the lamp light at the centre.
  const leather = ['#7e4a26', '#945a2f', '#a86b3a', '#b87a45'];
  for (let y = 0; y < fy * 2; y++)
    for (let x = 0; x < fx * 2; x++) {
      const dx = (x - fx) / fx,
        dy = (y - fy) / fy;
      const light =
        0.95 -
        (dx * dx + dy * dy) * 0.42 +
        (noise(x >> 2, y >> 2) - 0.5) * 0.18 +
        (noise(x, y) - 0.5) * 0.08;
      const v = Math.max(0, Math.min(2.999, light * 3));
      const tone = Math.floor(v) + (dither(x, y, v % 1) ? 1 : 0);
      rect(ctx, leather[Math.min(3, tone)], RAIL + x, RAIL + y);
    }
  // Worn scuffs.
  for (let i = 0; i < 26; i++) {
    const x = RAIL + 10 + Math.floor(noise(i, 7) * (fx * 2 - 20)),
      y = RAIL + 6 + Math.floor(noise(i, 11) * (fy * 2 - 12));
    rect(ctx, '#c08650', x, y, 2 + Math.floor(noise(i, 3) * 4), 1);
  }
  // Rails: planks with streaked grain, lit outer edge, dark inner lip.
  const wood = ['#4f2b14', '#5f3519', '#6f411f', '#7f4d26'];
  const plank = (
    x0: number,
    y0: number,
    pw: number,
    ph: number,
    along: 'x' | 'y',
  ) => {
    for (let y = 0; y < ph; y++)
      for (let x = 0; x < pw; x++) {
        const a = along === 'x' ? x : y,
          b = along === 'x' ? y : x;
        const grain = noise(b, 91) * 0.6 + noise(a >> 3, b + 17) * 0.25;
        const v = Math.max(
          0,
          Math.min(
            3.999,
            1 + grain * 3 - (noise(a >> 4, b >> 2) > 0.93 ? 1.5 : 0),
          ),
        );
        rect(ctx, wood[Math.floor(v)], x0 + x, y0 + y);
      }
  };
  plank(0, 0, w, RAIL, 'x');
  plank(0, h - RAIL, w, RAIL, 'x');
  plank(0, RAIL, RAIL, h - RAIL * 2, 'y');
  plank(w - RAIL, RAIL, RAIL, h - RAIL * 2, 'y');
  // Mitred corners.
  for (let i = 0; i < RAIL; i++) {
    rect(ctx, '#3b200e', i, i);
    rect(ctx, '#3b200e', w - 1 - i, i);
    rect(ctx, '#3b200e', i, h - 1 - i);
    rect(ctx, '#3b200e', w - 1 - i, h - 1 - i);
  }
  rect(ctx, '#9a6436', 1, 0, w - 2, 1);
  rect(ctx, '#8a5a30', 0, 1, 1, h - 2);
  rect(ctx, '#8a5a30', w - 1, 1, 1, h - 2);
  // Inner lip: a dark edge and a soft shadow on the leather.
  rect(ctx, INK, RAIL - 1, RAIL - 1, fx * 2 + 2, 1);
  rect(ctx, INK, RAIL - 1, RAIL + fy * 2, fx * 2 + 2, 1);
  rect(ctx, INK, RAIL - 1, RAIL - 1, 1, fy * 2 + 2);
  rect(ctx, INK, RAIL + fx * 2, RAIL - 1, 1, fy * 2 + 2);
  ctx.globalAlpha = 0.35;
  rect(ctx, '#1a0c05', RAIL, RAIL, fx * 2, 3);
  rect(ctx, '#1a0c05', RAIL, RAIL, 3, fy * 2);
  ctx.globalAlpha = 1;
  // Cup holders sunk into the four corners.
  for (const [cx, cy] of [
    [RAIL / 2, RAIL / 2],
    [w - RAIL / 2, RAIL / 2],
    [RAIL / 2, h - RAIL / 2],
    [w - RAIL / 2, h - RAIL / 2],
  ])
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const d = x * x + y * y;
        if (d <= 30) rect(ctx, d > 20 ? '#2a170c' : '#140a04', cx + x, cy + y);
        else if (d <= 42)
          rect(ctx, y < 0 ? '#9a6436' : '#3b200e', cx + x, cy + y);
      }
  // Front apron.
  for (let y = 0; y < APRON; y++)
    for (let x = 0; x < w; x++)
      rect(
        ctx,
        y === APRON - 1
          ? INK
          : dither(x, y, 0.3 + noise(x >> 3, 5) * 0.4)
            ? '#3f220f'
            : '#4c2a13',
        x,
        h + y,
      );
  rect(ctx, '#2a170c', 0, h, w, 1);
  return c;
}

/** A Polar-style brown bottle: gold cap, white label with a blue band. */
export function bottleSprite(): Canvas {
  const art = [
    '..YY..',
    '..gg..',
    '..hg..',
    '..hg..',
    '.hggg.',
    'hggggg',
    'hWWWWg',
    'hWBBWg',
    'hWBBWg',
    'hWWRWg',
    'hggggg',
    'hggggg',
    'hggggg',
    '.gggg.',
  ];
  const colors: Record<string, string> = {
    Y: '#e2b64a',
    g: '#4a200a',
    h: '#8a4418',
    W: '#f4f1e8',
    B: '#1f5fae',
    R: '#c8322a',
  };
  const [c, ctx] = canvas(8, art.length + 2);
  // A 1px ink outline around every coloured pixel.
  art.forEach((row, y) =>
    [...row].forEach((k, x) => {
      if (k !== '.') rect(ctx, INK, x, y, 3, 3);
    }),
  );
  art.forEach((row, y) =>
    [...row].forEach((k, x) => {
      if (k !== '.') rect(ctx, colors[k], x + 1, y + 1);
    }),
  );
  return c;
}

/**
 * Recolours a sprite's bright green shirt to `hue` (degrees), keeping its
 * shading. Everything that isn't saturated green stays as drawn.
 */
export function recolour(
  img: CanvasImageSource & { width: number; height: number },
  hue: number | null,
): Canvas {
  const [c, ctx] = canvas(img.width, img.height);
  ctx.drawImage(img, 0, 0);
  if (hue === null) return c;
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255,
      g = d[i + 1] / 255,
      b = d[i + 2] / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      chroma = max - min;
    if (!d[i + 3] || max !== g || chroma < 0.08) continue;
    const h = 60 * ((b - r) / chroma + 2);
    if (h < 85 || h > 165) continue;
    // HSV → RGB at the new hue, same value and saturation.
    const s = chroma / max,
      v = max;
    const f = (n: number) => {
      const k = (n + hue / 60) % 6;
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    d[i] = f(5) * 255;
    d[i + 1] = f(3) * 255;
    d[i + 2] = f(1) * 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

/** A tile as an image URL for HTML: standing (`near` at the bottom) or lying flat. */
export function tileUrl(near: number, far: number, vertical = true): string {
  if (!vertical) return tileSprite(near, far).toDataURL();
  const [c, ctx] = canvas(12, 24);
  ctx.translate(0, 24);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(tileSprite(near, far), 0, 0);
  return c.toDataURL();
}
