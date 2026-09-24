import * as THREE from 'three';
import { SPOTS } from '../spots.js';

/** Canvas-drawn textures: tile faces, carved plaques, and the painted art loader. */

const W = 512,
  H = 256;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}
function texture(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function pipCentres(near: number, far: number) {
  return [near, far].flatMap((v, half) =>
    SPOTS[v].map(([l, a]) => [
      half * (W / 2) + (0.22 + l * 0.28) * (W / 2),
      (0.22 + a * 0.28) * H,
    ]),
  );
}

/** Aged ivory with a faint mottle, shared by faces and backs. */
function ivory(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f2eee1');
  g.addColorStop(0.6, '#ebe5d2');
  g.addColorStop(1, '#e0d8c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${120 + Math.random() * 40},${95 + Math.random() * 30},60,${Math.random() * 0.035})`;
    const r = 2 + Math.random() * 14;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const faces = new Map<
  string,
  {
    map: THREE.Texture;
    bump: THREE.Texture;
    rough: THREE.Texture;
    spec: THREE.Texture;
  }
>();
/**
 * Face texture with `near` pips on the left half and `far` on the right: jet-black
 * glossy pips set into the ivory, and a black inlaid divider, like a real set.
 */
export function faceTextures(near: number, far: number) {
  const key = `${near}:${far}`;
  const hit = faces.get(key);
  if (hit) return hit;
  const pips = pipCentres(near, far);
  const R = H * 0.115;
  const [c, ctx] = canvas(W, H);
  ivory(ctx);
  for (const [x, y] of pips) {
    // Soft ivory shadow ring where the pip is set in, then the black lacquer.
    ctx.fillStyle = 'rgba(120,105,80,0.35)';
    ctx.beginPath();
    ctx.arc(x, y + 1, R * 1.08, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, '#0d0d0e');
    g.addColorStop(0.8, '#050505');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }
  // Black inlaid divider across the tile.
  ctx.fillStyle = '#030303';
  ctx.fillRect(W / 2 - 5, H * 0.08, 10, H * 0.84);

  // Bump: pips sit in a shallow bevelled well, slightly domed in the middle.
  const [b, bx] = canvas(W, H);
  bx.fillStyle = '#fff';
  bx.fillRect(0, 0, W, H);
  for (const [x, y] of pips) {
    const g = bx.createRadialGradient(x, y, 0, x, y, R * 1.08);
    g.addColorStop(0, '#6a6a6a');
    g.addColorStop(0.9, '#5a5a5a');
    g.addColorStop(0.97, '#3a3a3a');
    g.addColorStop(1, '#ffffff');
    bx.fillStyle = g;
    bx.beginPath();
    bx.arc(x, y, R * 1.08, 0, Math.PI * 2);
    bx.fill();
  }
  bx.fillStyle = '#404040';
  bx.fillRect(W / 2 - 5, H * 0.08, 10, H * 0.84);

  // Roughness (green channel): matte pips so no light ever greys them.
  const [r, rx] = canvas(W, H);
  rx.fillStyle = 'rgb(0,110,0)';
  rx.fillRect(0, 0, W, H);
  // Specular intensity (alpha): the ivory reflects, the pips and divider never do,
  // so they stay pure black under any lamp or camera angle.
  const [sp, sx] = canvas(W, H);
  sx.fillStyle = '#fff';
  sx.fillRect(0, 0, W, H);
  sx.globalCompositeOperation = 'destination-out';
  for (const ctx2 of [rx, sx]) {
    if (ctx2 === rx) ctx2.fillStyle = 'rgb(0,255,0)';
    for (const [x, y] of pips) {
      ctx2.beginPath();
      ctx2.arc(x, y, R * 1.02, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.fillRect(W / 2 - 5, H * 0.08, 10, H * 0.84);
  }

  const out = {
    map: texture(c),
    bump: texture(b, false),
    rough: texture(r, false),
    spec: texture(sp, false),
  };
  faces.set(key, out);
  return out;
}

let backTexture: THREE.Texture | null = null;
export function backTextures() {
  if (backTexture) return backTexture;
  const [c, ctx] = canvas(W, H);
  ivory(ctx);
  backTexture = texture(c);
  return backTexture;
}

export const PLAQUE_FONT = 'Domino Plaque';
let fontReady: Promise<unknown> | null = null;
/** Waits for the plaque face (declared by the board's @font-face) so canvas text uses it. */
export function loadFont() {
  fontReady ??= document.fonts
    .load(`48px '${PLAQUE_FONT}'`)
    .catch(() => undefined);
  return fontReady;
}

/**
 * A carved plaque face: weathered board, bevel, burned-in text and an
 * optional palm mark, like the name boards in the reference.
 */
export function plaqueCanvas(
  text: string,
  opts: { green?: boolean; palm?: boolean; icon?: 'pass' } = {},
) {
  const [c, ctx] = canvas(512, 160);
  const base = opts.green ? ['#2f4a37', '#1f3527'] : ['#e8dcc2', '#cdbb98'];
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, base[0]);
  g.addColorStop(1, base[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 160);
  // Grain and wear.
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = opts.green
      ? `rgba(0,0,0,${Math.random() * 0.12})`
      : `rgba(90,60,30,${Math.random() * 0.12})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 160;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + Math.random() * 8);
    ctx.stroke();
  }
  // Worn frame.
  ctx.strokeStyle = opts.green ? 'rgba(10,20,12,0.7)' : 'rgba(70,45,22,0.55)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 150);
  ctx.strokeStyle = opts.green
    ? 'rgba(160,190,150,0.25)'
    : 'rgba(255,248,230,0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(13, 13, 486, 134);
  for (const [x, y] of [
    [26, 26],
    [486, 26],
    [26, 134],
    [486, 134],
  ]) {
    ctx.fillStyle = opts.green ? '#0d1a10' : '#4a3018';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  let x = 256;
  const ink = opts.green ? '#e9e4cf' : '#2a1a0d';
  if (opts.palm) {
    palm(ctx, 64, 80, ink);
    x = 280;
  }
  if (opts.icon) {
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(76, 84, 26, Math.PI * 1.1, Math.PI * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.lineTo(52, 90);
    ctx.lineTo(70, 68);
    ctx.fill();
    x = 290;
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 64;
  const room = opts.palm || opts.icon ? 360 : 440;
  do ctx.font = `${size--}px '${PLAQUE_FONT}', Georgia, serif`;
  while (ctx.measureText(text).width > room && size > 20);
  ctx.shadowColor = opts.green ? 'rgba(0,0,0,0.6)' : 'rgba(255,245,220,0.6)';
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, 86);
  return c;
}
function palm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ink: string,
) {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + 42);
  ctx.quadraticCurveTo(x + 6, y + 10, x + 2, y - 18);
  ctx.stroke();
  for (const a of [-2.7, -2.1, -1.2, -0.5, 0.1]) {
    ctx.beginPath();
    ctx.ellipse(
      x + 2 + Math.cos(a) * 20,
      y - 18 + Math.sin(a) * 12,
      22,
      6,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
export function plaqueTexture(...args: Parameters<typeof plaqueCanvas>) {
  return texture(plaqueCanvas(...args));
}

/** Painted art from `static/games/domino`, tiled for surfaces. */
export function art(
  loader: THREE.TextureLoader,
  file: string,
  repeat?: [number, number],
  onLoad?: () => void,
) {
  const t = loader.load(`/games/domino/${file}`, onLoad);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}
