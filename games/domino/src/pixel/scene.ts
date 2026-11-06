import type { End } from '../index.js';
import type { Placement, Pose } from '../layout.js';
import { HARD_SLAM, flightMsPixel } from '../constants.js';
import { CAST, PIXEL_ART } from './art.js';
import {
  APRON,
  FELT,
  INK,
  RAIL,
  U,
  backSprite,
  bottleSprite,
  canvas as makeCanvas,
  edgeSprite,
  recolour,
  tableSprite,
  tileSprite,
} from './sprites.js';

/**
 * The 8-bit table: a Canvas 2D renderer in logical pixels (a tile is 12×24),
 * scaled up with nearest-neighbour sampling. World origin is the leather's
 * centre; layout units map to `U` pixels, +y towards you.
 */
export type Rect = { x: number; y: number; w: number; h: number };
export type PixelState = {
  placements: Placement[];
  ghosts: { end: End; pose: Pose; chosen: boolean }[];
  rack: { id: number; near: number; far: number; lifted: boolean }[];
  /** Tiles left for the seats at relative positions 1 (right), 2 (partner), 3 (left). */
  standing: [number, number, number];
  /** The game seat (0–3) at each relative position: who sits where, so each keeps their character. */
  seats: [number, number, number, number];
  /** Relative seat whose turn it is. */
  active: number | null;
  /** On a finished hand: which relative seats won (they cheer). */
  cheer: boolean[] | null;
  motion: boolean;
  /** Phones: no characters, a camera fitted to the chain and your rack in screen space. */
  compact: boolean;
  /** CSS pixels the compact table must keep clear at the top and left for the HUD. */
  inset: { top: number; left: number };
};
export type Reaction =
  | { type: 'play'; id: number; from: number; force: number }
  | { type: 'pass'; from: number };
export type PixelScene = {
  update(state: PixelState): void;
  react(e: Reaction): void;
  intro(): void;
  dispose(): void;
};

const ART = '/games/domino/pixel/';

/** Shirt hues: your pair keeps the sprite green, the other pair wears red. */
const RIVAL_HUE = 4;
const TABLE_W = FELT.x * U * 2 + RAIL * 2,
  TABLE_H = FELT.y * U * 2 + RAIL * 2;
/** What the desktop view must always show, in world pixels. */
const FRAME = { x: -265, y: -196, w: 530, h: 382 };
/** Where each seat's played tile starts: 1 right, 2 partner, 3 left. */
const HANDS: Record<number, [number, number]> = {
  1: [196, 8],
  2: [0, -122],
  3: [-196, 8],
};
/** Your rack: tiles drawn at twice size, standing on a tray below the table. */
const RACK_Y = 178,
  RACK_PITCH = 28,
  RACK_SCALE = 2;
/** Side seats: the table top's height where forearms rest. */
const SIDE_TABLE_TOP = 16;
/** How far the knees tuck under the rail's edge, in logical pixels. */
const TUCK = 5;
/** A side sheet's left edge: pulled in until the knees tuck under the table. */
const sideX = (fit: { knees: number }) => -TABLE_W / 2 + TUCK - fit.knees;
/** The partner sits behind the far rail, which hides his waist. */
const PARTNER_BOTTOM = -TABLE_H / 2 + 6;
const FRAMES = { idle: 0, think: 1, raise: 2, slam: 3, knock: 4, cheer: 5 };

type Img = HTMLImageElement | HTMLCanvasElement;
type Anim = { start: number; kind: 'play' | 'pass'; force: number };
type Flight = {
  from: Pose;
  start: number;
  duration: number;
  force: number;
  landed: boolean;
};
type Tween = {
  from: Pose;
  start: number;
  duration: number;
  hop: number;
  smooth: boolean;
};
type Dust = { x: number; y: number; vx: number; vy: number; life: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
};
const ease = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const rad = (d: number) => (d * Math.PI) / 180;

export function createPixelTable(
  canvas: HTMLCanvasElement,
  {
    onRects,
    onProgress,
    onReady,
  }: {
    onRects: (rects: Record<string, Rect>) => void;
    onProgress?: (p: number) => void;
    onReady?: () => void;
  },
): PixelScene {
  const ctx = canvas.getContext('2d')!;
  let state: PixelState | null = null;
  let disposed = false,
    ready = false,
    dirty = true,
    frameId = 0,
    lastTick = -1,
    rectsKey = '';

  // ---- Art -------------------------------------------------------------------
  const table = tableSprite(),
    back = backSprite(),
    edge = edgeSprite(),
    bottle = bottleSprite();
  const art: Record<string, Img> = {};
  /** Each character sheet in both shirts: [your pair, the rivals]. */
  const sheets: Record<string, [Img, Img]> = {};
  const load = (name: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => resolve(img.naturalWidth ? img : null);
      img.src = `${ART}${name}.webp`;
    });
  // The patio first; the characters only once the full table is on screen
  // (phones never show them, so never download them).
  const [base, cast] = [PIXEL_ART.slice(0, 2), PIXEL_ART.slice(2)];
  let loaded = 0,
    castRequested = false;
  void Promise.all(
    base.map((name) =>
      load(name).then((img) => {
        if (img) art[name] = img;
        onProgress?.(++loaded / base.length);
      }),
    ),
  ).then(() => {
    if (disposed) return;
    if (art.patio) bulbs = findBulbs(art.patio as HTMLImageElement);
    ready = true;
    dirty = true;
    kick();
    onReady?.();
  });
  function loadCast() {
    if (castRequested) return;
    castRequested = true;
    for (const name of cast)
      void load(name).then((img) => {
        if (!img || disposed) return;
        // Your pair keeps the green shirts; the rivals wear red.
        sheets[name] = [img, recolour(img, RIVAL_HUE)];
        if (name.endsWith('-side')) fits[name] = fitOf(img);
        dirty = true;
        kick();
      });
  }
  let bulbs: [number, number][] = [];
  /**
   * Side sheets are full-body and seated. From the idle frame: how far the
   * hands and the knees reach, and the bottom of the forearms (the table top).
   */
  const fits: Record<string, { reach: number; hand: number; knees: number }> =
    {};
  function fitOf(img: HTMLImageElement) {
    const fw = Math.floor(img.width / 6),
      h = img.height,
      [, g] = makeCanvas(fw, h);
    g.drawImage(img, 0, 0, fw, h, 0, 0, fw, h);
    const d = g.getImageData(0, 0, fw, h).data,
      on = (x: number, y: number) => d[(y * fw + x) * 4 + 3] > 127,
      arms = Math.floor(h * 0.6);
    let reach = 0,
      hand = 0;
    for (let y = 0; y < arms; y++)
      for (let x = fw - 1; x > reach; x--) if (on(x, y)) reach = x;
    for (let y = 0; y < arms; y++)
      for (let x = reach - 5; x <= reach; x++) if (on(x, y)) hand = y;
    let knees = 0;
    for (let y = arms; y < h; y++)
      for (let x = fw - 1; x > knees; x--) if (on(x, y)) knees = x;
    return { reach, hand, knees };
  }
  /** Warm, bright pixels near the top of the patio: the string-light bulbs. */
  function findBulbs(img: HTMLImageElement) {
    const [, g] = makeCanvas(img.width, img.height);
    g.drawImage(img, 0, 0);
    const h = Math.round(img.height * 0.3),
      d = g.getImageData(0, 0, img.width, h).data,
      seen = new Set<string>(),
      out: [number, number][] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (d[i] > 235 && d[i + 1] > 190 && d[i + 2] < 180) {
          const key = `${x >> 3}:${y >> 3}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push([x, y]);
        }
      }
    return out.slice(0, 60);
  }

  // ---- Clock, animation state ----------------------------------------------
  let clock = 0,
    last = performance.now(),
    freezeUntil = 0,
    shakeUntil = 0,
    shakeAmp = 0;
  const shown = new Map<number, Pose>(),
    tweens = new Map<number, Tween>(),
    flights = new Map<number, Flight>(),
    pending = new Map<number, { seat: number; force: number }>(),
    anims = new Map<number, Anim>(),
    rackSpots = new Map<number, Pose>();
  let dust: Dust[] = [];
  let introAt = -1;

  // ---- Camera ----------------------------------------------------------------
  let dpr = 1,
    cssW = 1,
    cssH = 1;
  /** World → CSS: centre, scale (CSS px per logical px), quarter turns. */
  const cam = { x: 0, y: 0, s: 2, turn: 0 };
  const goal = { x: 0, y: 0, s: 2 };
  let camReady = false;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = canvas.clientWidth || 1;
    cssH = canvas.clientHeight || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (state) {
      fitGoal();
      Object.assign(cam, goal);
    }
    dirty = true;
    kick();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  /** The compact view: CSS rect left for the table between the HUD and your rack. */
  function viewport() {
    const s = state!;
    const rack = rackHeight();
    const left = s.inset.left,
      top = s.inset.top;
    return { x: left, y: top, w: cssW - left, h: cssH - top - rack };
  }
  function fitGoal() {
    const s = state!;
    if (!s.compact) {
      cam.turn = 0;
      const k = Math.min(cssW / FRAME.w, cssH / FRAME.h);
      goal.s = Math.max(1, Math.floor(k * 4) / 4);
      goal.x = FRAME.x + FRAME.w / 2;
      goal.y = FRAME.y + FRAME.h / 2;
      return;
    }
    const v = viewport();
    cam.turn = v.h > v.w * 1.1 ? 1 : 0;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    const grow = (p: Pose) => {
      x0 = Math.min(x0, p.x * U - 14);
      x1 = Math.max(x1, p.x * U + 14);
      y0 = Math.min(y0, p.y * U - 14);
      y1 = Math.max(y1, p.y * U + 14);
    };
    s.placements.forEach(grow);
    s.ghosts.forEach((g) => grow(g.pose));
    if (x0 === Infinity) x0 = x1 = y0 = y1 = 0;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    const bw = Math.max(x1 - x0 + 24, 10 * U),
      bh = Math.max(y1 - y0 + 24, 7 * U);
    const [sw, sh] = cam.turn ? [bh, bw] : [bw, bh];
    goal.s = Math.min(v.w / sw, v.h / sh, 4.5);
    goal.x = cx;
    goal.y = cy;
  }
  /** CSS centre of the area the world is framed in. */
  function centre() {
    if (!state?.compact) return { x: cssW / 2, y: cssH / 2 };
    const v = viewport();
    return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
  }
  function toCss(wx: number, wy: number) {
    const c = centre(),
      dx = (wx - cam.x) * cam.s,
      dy = (wy - cam.y) * cam.s;
    return cam.turn
      ? { x: c.x - dy, y: c.y + dx }
      : { x: c.x + dx, y: c.y + dy };
  }
  function toWorld(x: number, y: number) {
    const c = centre(),
      dx = (x - c.x) / cam.s,
      dy = (y - c.y) / cam.s;
    return cam.turn
      ? { x: cam.x + dy, y: cam.y - dx }
      : { x: cam.x + dx, y: cam.y + dy };
  }

  // ---- Your rack ---------------------------------------------------------------
  /** Compact rack: CSS tile width and the strip's height. */
  function rackTile() {
    const n = Math.max(state!.rack.length, 5),
      // Landscape phones: a lower strip so the chain keeps most of the height.
      cap = cssH < 520 ? Math.max(26, Math.min(40, cssH * 0.09)) : 46;
    return Math.min(cap, (cssW - state!.inset.left - 16 - (n - 1) * 6) / n);
  }
  function rackHeight() {
    return state?.compact ? rackTile() * 2 + 26 + 40 : 0;
  }
  /** Each rack tile's centre: world pixels on desktop, CSS pixels on phones. */
  function rackLayout() {
    const s = state!,
      n = s.rack.length;
    if (!s.compact)
      return s.rack.map((t, i) => ({
        ...t,
        x: (i - (n - 1) / 2) * RACK_PITCH,
        y: RACK_Y - 12 * RACK_SCALE - (t.lifted ? 6 : 0),
      }));
    const w = rackTile(),
      gap = 6;
    return s.rack.map((t, i) => ({
      ...t,
      x: (cssW + state!.inset.left) / 2 + (i - (n - 1) / 2) * (w + gap),
      y: cssH - 14 - w - (t.lifted ? 10 : 0),
    }));
  }

  // ---- State -----------------------------------------------------------------
  function update(next: PixelState) {
    const first = !state;
    state = next;
    if (!next.compact) loadCast();
    const now = clock;
    const ids = new Set(next.placements.map((p) => p.id));
    for (const id of [...shown.keys()]) if (!ids.has(id)) shown.delete(id);
    // New tiles fly in when a play was announced; everything else snaps or slides.
    const flying = [...flights.values()].some((f) => !f.landed);
    // No new tile means the poses changed by themselves: a tidy-up.
    const tidy = next.placements.every((p) => shown.has(p.id));
    let order = 0;
    for (const p of next.placements) {
      const was = shown.get(p.id);
      if (!was) {
        const play = pending.get(p.id);
        pending.delete(p.id);
        if (play && next.motion && !first)
          startFlight(p.id, play.seat, play.force);
        shown.set(p.id, { x: p.x, y: p.y, angle: p.angle });
        continue;
      }
      const moved =
        Math.abs(was.x - p.x) > 1e-3 ||
        Math.abs(was.y - p.y) > 1e-3 ||
        Math.abs(was.angle - p.angle) > 1e-2;
      if (!moved) continue;
      if (next.motion)
        tweens.set(
          p.id,
          tidy
            ? // Tiles glide home one after another along the chain.
              {
                from: current(p.id) ?? was,
                start: now + order++ * 22,
                duration: 480,
                hop: 0,
                smooth: true,
              }
            : // Neighbours knocked by a slam hop into place as it lands.
              {
                from: current(p.id) ?? was,
                start: now + (flying ? 200 : 0),
                duration: 220,
                hop: 5,
                smooth: false,
              },
        );
      shown.set(p.id, { x: p.x, y: p.y, angle: p.angle });
    }
    fitGoal();
    if (!camReady || !next.motion) {
      Object.assign(cam, goal);
      camReady = true;
    }
    dirty = true;
    kick();
  }
  /** Where a tile is drawn right now, mid-flight or mid-tween. */
  function current(id: number): Pose | null {
    const target = shown.get(id);
    if (!target) return null;
    const f = flights.get(id);
    if (f && !f.landed) {
      const t = Math.min(1, Math.max(0, (clock - f.start) / f.duration));
      const e = ease(t);
      return {
        x: lerp(f.from.x, target.x, e),
        y: lerp(f.from.y, target.y, e),
        angle: lerpAngle(f.from.angle, target.angle, e),
      };
    }
    const tw = tweens.get(id);
    if (tw) {
      const t = Math.min(1, Math.max(0, (clock - tw.start) / tw.duration));
      const e = tw.smooth ? easeInOut(t) : ease(t);
      return {
        x: lerp(tw.from.x, target.x, e),
        y: lerp(tw.from.y, target.y, e) - (tw.hop * Math.sin(Math.PI * t)) / U,
        angle: lerpAngle(tw.from.angle, target.angle, e),
      };
    }
    return target;
  }
  function startFlight(id: number, seat: number, force: number) {
    let from: Pose;
    if (seat === 0) {
      const spot = rackSpots.get(id);
      from = spot ?? { x: 0, y: RACK_Y / U, angle: -90 };
    } else {
      const [hx, hy] = HANDS[seat];
      from = { x: hx / U, y: hy / U, angle: seat === 2 ? 0 : 90 };
    }
    flights.set(id, {
      from,
      start: clock,
      duration: flightMsPixel(force),
      force,
      landed: false,
    });
  }
  function react(e: Reaction) {
    if (!state?.motion) return;
    if (e.from !== 0)
      anims.set(e.from, {
        start: clock,
        kind: e.type,
        force: e.type === 'play' ? e.force : 0,
      });
    if (e.type === 'play') {
      // The placement may already be on the table (effects run in either order).
      if (shown.has(e.id) && !flights.has(e.id)) {
        startFlight(e.id, e.from, e.force);
        tweens.delete(e.id);
      } else pending.set(e.id, { seat: e.from, force: e.force });
    }
    kick();
  }
  function land(id: number, f: Flight) {
    f.landed = true;
    const p = shown.get(id);
    if (!p) return;
    const n = f.force > HARD_SLAM ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4,
        v = 0.03 + Math.random() * 0.04 * (1 + f.force * 2);
      dust.push({
        x: p.x * U + Math.cos(a) * 8,
        y: p.y * U + Math.sin(a) * 5,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.7,
        life: 380 + Math.random() * 200,
      });
    }
    if (f.force > HARD_SLAM) {
      freezeUntil = performance.now() + 80;
      shakeUntil = clock + 90 + 260 * f.force;
      shakeAmp = 1 + f.force * 3;
    }
  }

  // ---- Drawing -----------------------------------------------------------------
  function drawTile(near: number, far: number, p: Pose, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(p.x * U), Math.round(p.y * U));
    ctx.rotate(rad(p.angle));
    ctx.drawImage(tileSprite(near, far), -12, -6);
    ctx.restore();
  }
  function drawShadow(p: Pose, lift = 0) {
    ctx.save();
    ctx.translate(
      Math.round(p.x * U) + 1 + lift,
      Math.round(p.y * U) + 2 + lift,
    );
    ctx.rotate(rad(p.angle));
    ctx.fillStyle = `rgb(26 10 3 / ${lift ? 0.3 : 0.45})`;
    ctx.fillRect(-12, -6, 24, 12);
    ctx.restore();
  }
  function drawGhost(p: Pose, chosen: boolean, phase: number) {
    ctx.save();
    ctx.translate(Math.round(p.x * U), Math.round(p.y * U));
    ctx.rotate(rad(p.angle));
    ctx.fillStyle = chosen
      ? 'rgb(242 193 78 / 0.45)'
      : 'rgb(255 240 200 / 0.2)';
    ctx.fillRect(-12, -6, 24, 12);
    // Marching ants around the spot.
    ctx.fillStyle = '#f2c14e';
    let i = 0;
    const dot = (x: number, y: number) => {
      if ((i++ + phase) % 4 < 2) ctx.fillRect(x - 12, y - 6, 1, 1);
    };
    for (let x = 0; x < 24; x++) dot(x, 0);
    for (let y = 1; y < 12; y++) dot(23, y);
    for (let x = 22; x >= 0; x--) dot(x, 11);
    for (let y = 10; y > 0; y--) dot(0, y);
    ctx.restore();
  }
  function frameOf(seat: number, tick: number) {
    const s = state!;
    const a = anims.get(seat);
    if (a) {
      const t = clock - a.start;
      if (a.kind === 'play') {
        const dur = flightMsPixel(a.force);
        if (t < dur * 0.45) return FRAMES.raise;
        if (t < dur + 320) return FRAMES.slam;
      } else if (t < 620)
        return Math.floor(t / 155) % 2 ? FRAMES.idle : FRAMES.knock;
      if (t >= (a.kind === 'play' ? 900 : 620)) anims.delete(seat);
    }
    if (s.cheer)
      return s.cheer[seat]
        ? FRAMES.cheer
        : tick % 16 < 8
          ? FRAMES.idle
          : FRAMES.think;
    return s.active === seat ? FRAMES.think : FRAMES.idle;
  }
  function drawSeat(seat: number, tick: number) {
    const who = CAST[state!.seats[seat]],
      img =
        sheets[`${who}-${seat === 2 ? 'front' : 'side'}`]?.[seat === 2 ? 0 : 1];
    if (!img) return;
    const fw = img.width / 6,
      fh = img.height,
      frame = frameOf(seat, tick);
    const slam = frame === FRAMES.slam ? 2 : 0;
    ctx.save();
    if (seat === 2) {
      ctx.drawImage(
        img,
        frame * fw,
        0,
        fw,
        fh,
        Math.round(-fw / 2),
        PARTNER_BOTTOM - fh + slam,
        fw,
        fh,
      );
    } else {
      // Pulled up to the table: forearms on the rail, knees tucked under its
      // edge. Past the edge only what's above the forearms shows (a slamming
      // hand may reach further down, beyond the knees).
      const fit = fits[`${who}-side`];
      if (!fit) return ctx.restore();
      const x = sideX(fit),
        y = SIDE_TABLE_TOP - fit.hand,
        edge = -TABLE_W / 2;
      if (seat === 1) ctx.scale(-1, 1);
      // A soft floor shadow under the chair grounds them.
      ctx.fillStyle = 'rgb(10 5 8 / 0.35)';
      ctx.fillRect(x + 4, y + fh - 4, fit.knees - 2, 5);
      ctx.fillRect(x + 8, y + fh + 1, fit.knees - 10, 2);
      ctx.beginPath();
      ctx.rect(-1000, -1000, 1000 + edge, 2000);
      ctx.rect(edge, -1000, 1000, 1000 + SIDE_TABLE_TOP + 2);
      ctx.rect(edge + TUCK + 1, SIDE_TABLE_TOP + 2, 1000, 18);
      ctx.clip();
      ctx.drawImage(img, frame * fw, 0, fw, fh, x + slam, y, fw, fh);
    }
    ctx.restore();
  }
  /** Across the table only the partner's chair back shows, around the shoulders. */
  function drawChairBack() {
    const box = (color: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    const top = PARTNER_BOTTOM - 48;
    box('#6f411f', -27, top, 54, 4);
    box('#5f3519', -27, top + 4, 4, 40);
    box('#5f3519', 23, top + 4, 4, 40);
  }
  /** Hidden hands: a row in front of the partner, columns on the side rails. */
  function drawStanding(sides: boolean) {
    const [right, partner, left] = state!.standing;
    if (!sides) {
      for (let i = 0; i < partner; i++)
        ctx.drawImage(back, Math.round((i - (partner - 1) / 2) * 7) - 4, -118);
      return;
    }
    for (const [n, x] of [
      [left, -186],
      [right, 174],
    ])
      for (let i = 0; i < n; i++)
        ctx.drawImage(edge, x, Math.round((i - (n - 1) / 2) * 5) - 3);
  }
  function drawRackTray(n: number) {
    const half = (Math.max(n, 1) * RACK_PITCH) / 2 + 6;
    ctx.fillStyle = INK;
    ctx.fillRect(-half - 1, RACK_Y - 1, half * 2 + 2, 7);
    ctx.fillStyle = '#6f411f';
    ctx.fillRect(-half, RACK_Y, half * 2, 3);
    ctx.fillStyle = '#4f2b14';
    ctx.fillRect(-half, RACK_Y + 3, half * 2, 2);
  }

  /** Seats fade in over the intro in three steps. */
  function introAlpha() {
    const t = introAt >= 0 ? Math.min(1, (clock - introAt) / 700) : 1;
    return t < 0.34 ? 0 : t < 0.67 ? 0.5 : 1;
  }
  function busy() {
    return (
      flights.size > 0 ||
      tweens.size > 0 ||
      dust.length > 0 ||
      anims.size > 0 ||
      clock < shakeUntil ||
      introAt >= 0 ||
      Math.abs(cam.s - goal.s) > 1e-3 ||
      Math.abs(cam.x - goal.x) > 0.05 ||
      Math.abs(cam.y - goal.y) > 0.05
    );
  }
  function kick() {
    if (!frameId && !disposed) {
      last = performance.now();
      frameId = requestAnimationFrame(loop);
    }
  }
  function loop(now: number) {
    frameId = 0;
    if (disposed) return;
    const dt = Math.min(64, now - last);
    last = now;
    if (now >= freezeUntil) clock += dt;
    const s = state;
    const tick = Math.floor(clock / 125);
    const ambient = !!s?.motion && ready;
    if (dirty || busy() || (ambient && tick !== lastTick)) render(dt, tick);
    lastTick = tick;
    if (busy() || ambient) frameId = requestAnimationFrame(loop);
  }

  function render(dt: number, tick: number) {
    dirty = false;
    const s = state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0e0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!s || !ready) return;
    // Settle flights and tweens.
    for (const [id, f] of flights)
      if (!f.landed && clock - f.start >= f.duration) land(id, f);
      else if (f.landed) flights.delete(id);
    for (const [id, t] of tweens)
      if (clock - t.start >= t.duration) tweens.delete(id);
    dust = dust.filter((d) => (d.life -= dt) > 0);
    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    if (introAt >= 0 && clock - introAt > 900) introAt = -1;
    // Camera eases toward its goal.
    const k = s.motion ? 1 - Math.pow(0.002, dt / 1000) : 1;
    cam.x = lerp(cam.x, goal.x, k);
    cam.y = lerp(cam.y, goal.y, k);
    cam.s = lerp(cam.s, goal.s, k);
    const shake =
      clock < shakeUntil && s.motion
        ? [
            Math.round((Math.random() - 0.5) * 2 * shakeAmp),
            Math.round((Math.random() - 0.5) * 2 * shakeAmp),
          ]
        : [0, 0];
    const c = centre(),
      scale = cam.s * dpr;
    ctx.setTransform(
      cam.turn ? 0 : scale,
      cam.turn ? scale : 0,
      cam.turn ? -scale : 0,
      cam.turn ? 0 : scale,
      c.x * dpr,
      c.y * dpr,
    );
    ctx.translate(-cam.x + shake[0], -cam.y + shake[1]);

    // Patio, with the string lights twinkling and the cat asleep in the corner.
    const patio = art.patio;
    if (patio) {
      const px = -patio.width / 2,
        py = -patio.height / 2 - 6;
      // Screens wider or taller than the painting: scale it just enough to cover.
      const cover = Math.max(
        1,
        (cssW / cam.s + Math.abs(cam.x) * 2) / patio.width,
        (cssH / cam.s + Math.abs(cam.y + 6) * 2) / patio.height,
      );
      ctx.save();
      ctx.translate(0, -6);
      ctx.scale(cover, cover);
      ctx.translate(0, 6);
      ctx.drawImage(patio, px, py);
      if (s.motion)
        bulbs.forEach(([bx, by], i) => {
          const v = (Math.sin(i * 12.9898 + tick * 0.7) * 43758.5453) % 1;
          if (Math.abs(v) < 0.12) {
            ctx.fillStyle = 'rgb(60 30 10 / 0.55)';
            ctx.fillRect(px + bx - 1, py + by - 1, 3, 3);
          } else if (Math.abs(v) > 0.9) {
            ctx.fillStyle = 'rgb(255 244 190 / 0.35)';
            ctx.fillRect(px + bx - 2, py + by - 2, 5, 5);
          }
        });
      const cat = art.cat;
      if (cat) {
        const cw = cat.width / 2,
          sleepy = s.motion && tick % 24 < 12 ? 1 : 0;
        ctx.drawImage(
          cat,
          0,
          0,
          cw,
          cat.height,
          -330,
          128 + sleepy,
          cw,
          cat.height - sleepy,
        );
      }
      ctx.restore();
    }
    if (!s.compact) {
      // The partner sits behind the table: the far rail hides his waist.
      ctx.globalAlpha = introAlpha();
      drawChairBack();
      drawSeat(2, tick);
      ctx.globalAlpha = 1;
    }
    // Table and its shadow.
    ctx.fillStyle = 'rgb(10 5 8 / 0.45)';
    ctx.fillRect(-TABLE_W / 2 + 6, -TABLE_H / 2 + 10, TABLE_W, TABLE_H + APRON);
    ctx.drawImage(table, -TABLE_W / 2, -TABLE_H / 2);

    const intro = introAt >= 0 ? Math.min(1, (clock - introAt) / 700) : 1;
    if (!s.compact) {
      // Side tiles stand behind a player leaning in; the partner's stand in front.
      drawStanding(true);
      ctx.globalAlpha = introAlpha();
      for (const seat of [3, 1]) drawSeat(seat, tick);
      ctx.globalAlpha = 1;
      drawStanding(false);
      ctx.drawImage(bottle, 150, -128);
    }

    // The chain: shadows, tiles, then ghosts where the selected tile fits.
    const drawn = s.placements.map((p) => ({ p, at: current(p.id)! }));
    for (const { p, at } of drawn)
      if (!flights.get(p.id) || flights.get(p.id)!.landed) drawShadow(at);
    for (const { p, at } of drawn) {
      const f = flights.get(p.id);
      if (f && !f.landed) continue;
      drawTile(p.near, p.far, at);
    }
    for (const g of s.ghosts) drawGhost(g.pose, g.chosen, s.motion ? tick : 0);
    // Flying tiles above everything on the table.
    for (const { p, at } of drawn) {
      const f = flights.get(p.id);
      if (!f || f.landed) continue;
      const t = Math.min(1, (clock - f.start) / f.duration);
      const lift = Math.sin(Math.PI * t) * (10 + f.force * 16);
      drawShadow(at, Math.round(lift / 4));
      drawTile(p.near, p.far, { ...at, y: at.y - lift / U });
    }
    for (const d of dust) {
      ctx.fillStyle = d.life > 240 ? '#e3c595' : '#b8946a';
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
    }

    // Your rack.
    const rack = rackLayout();
    const rects: Record<string, Rect> = {};
    if (!s.compact) {
      drawRackTray(rack.length);
      rack.forEach((t, i) => {
        const drop =
          intro < 1 ? Math.max(0, 1 - intro * 1.6 + i * 0.08) * -40 : 0;
        const y = Math.round(t.y + drop);
        rackSpots.set(t.id, { x: t.x / U, y: y / U, angle: -90 });
        ctx.save();
        ctx.translate(t.x, y);
        ctx.scale(RACK_SCALE, RACK_SCALE);
        ctx.rotate(rad(-90));
        ctx.fillStyle = 'rgb(26 10 3 / 0.45)';
        ctx.fillRect(-11, -5, 24, 12);
        ctx.drawImage(tileSprite(t.near, t.far), -12, -6);
        ctx.restore();
        const a = toCss(t.x - 6 * RACK_SCALE, y - 12 * RACK_SCALE),
          b = toCss(t.x + 6 * RACK_SCALE, y + 12 * RACK_SCALE);
        rects[`rack:${t.id}`] = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      });
      const right = toCss((rack.length * RACK_PITCH) / 2 + 10, RACK_Y - 18);
      rects.arrange = { x: right.x, y: right.y, w: 0, h: 0 };
      const status = toCss(0, TABLE_H / 2);
      rects.status = { x: status.x, y: status.y, w: 0, h: 0 };
      const tag = (seat: number, wx: number, wy: number) => {
        const p = toCss(wx, wy);
        rects[`name:${seat}`] = { x: p.x, y: p.y, w: 0, h: 0 };
      };
      tag(2, 52, PARTNER_BOTTOM - 44);
      for (const seat of [3, 1]) {
        const who = CAST[s.seats[seat]],
          fit = fits[`${who}-side`],
          img = sheets[`${who}-side`]?.[0];
        if (!fit || !img) continue;
        const cx = sideX(fit) + img.width / 12,
          top = SIDE_TABLE_TOP - fit.hand;
        tag(seat, seat === 3 ? cx : -cx, top - 2);
      }
    }
    for (const g of s.ghosts) {
      const a = toCss(g.pose.x * U - 12, g.pose.y * U - 12),
        b = toCss(g.pose.x * U + 12, g.pose.y * U + 12);
      rects[`ghost:${g.end}`] = {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
      };
    }

    // Phones: the rack lives in screen space along the bottom.
    if (s.compact) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = rackHeight(),
        w = rackTile();
      const l = s.inset.left;
      ctx.fillStyle = INK;
      ctx.fillRect(l, cssH - h - 2, cssW - l, h + 2);
      ctx.fillStyle = '#3a2213';
      ctx.fillRect(l, cssH - h, cssW - l, h);
      ctx.fillStyle = '#5b3620';
      ctx.fillRect(l, cssH - h, cssW - l, 3);
      const k2 = w / 12;
      rack.forEach((t, i) => {
        const drop =
          intro < 1 ? Math.max(0, 1 - intro * 1.6 + i * 0.08) * -60 : 0;
        const x = Math.round(t.x),
          y = Math.round(t.y + drop);
        ctx.fillStyle = 'rgb(10 5 2 / 0.55)';
        ctx.fillRect(x - w / 2 + k2, y - w + k2 * 2, w, w * 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k2, k2);
        ctx.rotate(rad(-90));
        ctx.drawImage(tileSprite(t.near, t.far), -12, -6);
        ctx.restore();
        rects[`rack:${t.id}`] = { x: t.x - w / 2, y: t.y - w, w, h: w * 2 };
        const at = toWorld(t.x, t.y);
        rackSpots.set(t.id, {
          x: at.x / U,
          y: at.y / U,
          angle: cam.turn ? -180 : -90,
        });
      });
      rects.rack = { x: s.inset.left, y: cssH - h, w: cssW - s.inset.left, h };
    }

    const key = JSON.stringify(rects);
    if (key !== rectsKey) {
      rectsKey = key;
      onRects(rects);
    }
  }

  return {
    update,
    react,
    intro() {
      if (state?.motion) introAt = clock;
      kick();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
    },
  };
}
