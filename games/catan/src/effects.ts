import { createAudio } from '@board-games/shared/ui';
import { diceThrow, pixelThrowDuration } from './dice-throw.js';
import type { PresentationEvent } from './presentation.js';
import { chiptune } from './pixel/sound.js';
import { gold, ink, settlementPath } from './table/shapes.js';
import { deliveryDelay, GLOW_DELAY, rollStrength } from './timing.js';

/** 8-bit motion: every tween moves in hard frames (about 12 per second). */
const stepped = (duration: number) =>
  `steps(${Math.max(2, Math.round(duration / 80))}, end)`;

/** Where the dice may land: the table box and the ellipse over the island. */
type Throw = {
  table: DOMRect;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

/** Browser-only, Catan-only decoration. Canonical pieces always exist underneath. */
export function playEffects(
  root: HTMLElement,
  events: PresentationEvent[],
  pixel: boolean,
  onSettled: () => void,
  onRollSettled: () => void,
) {
  const animations: Animation[] = [],
    decorations: Element[] = [];
  let endsAt = 900;
  const animate = (
    el: Element | null,
    frames: Keyframe[],
    duration = 450,
    delay = 0,
    easing = 'ease-out',
  ) => {
    endsAt = Math.max(endsAt, delay + duration + 50);
    if (el)
      animations.push(
        el.animate(frames, {
          duration,
          delay,
          easing: pixel && easing !== 'linear' ? stepped(duration) : easing,
          fill: 'both',
        }),
      );
  };
  const seat = (id: string) =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-seat]')).find(
      (el) => el.dataset.seat === id,
    ) ??
    root.querySelector('.dice') ??
    root.querySelector('.table');
  const hex = (id: number) => root.querySelector(`[data-hex="${id}"]`);
  const puff = (target: Element) => {
    const r = target.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('i');
      dot.className = 'catan-dust';
      dot.style.cssText = `position:fixed;pointer-events:none;z-index:9;left:${r.x + r.width / 2}px;top:${r.y + r.height * 0.75}px;width:7px;height:7px;background:#f1dca4;border-radius:${pixel ? 0 : '50%'}`;
      if (pixel) dot.style.boxShadow = `3px 3px 0 ${ink}`;
      root.append(dot);
      decorations.push(dot);
      animate(
        dot,
        [
          { opacity: 0, transform: 'scale(.2)' },
          { opacity: 0.7, offset: 0.45 },
          {
            opacity: 0,
            transform: `translate(${(i - 2) * 12}px, -12px) scale(1.6)`,
          },
        ],
        500,
      );
    }
  };
  const flourish = (player: string, glyph: string, duration: number) => {
    const target = seat(player)?.getBoundingClientRect();
    if (!target) return;
    const badge = document.createElement('span');
    badge.className = 'catan-flourish';
    badge.textContent = glyph;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText =
      (pixel
        ? `font-family:var(--px-font);text-shadow:3px 3px 0 ${ink};font-size:40px;`
        : '') +
      'position:fixed;pointer-events:none;z-index:9;color:#ffe6a2;font-size:30px;left:' +
      (target.x + target.width / 2) +
      'px;top:' +
      (target.y + target.height / 2) +
      'px';
    root.append(badge);
    decorations.push(badge);
    animate(
      badge,
      [
        { opacity: 0, transform: 'translateY(12px) scale(.4)' },
        {
          opacity: 1,
          transform: pixel
            ? 'translateY(-12px)'
            : 'translateY(-10px) rotate(-12deg)',
          offset: 0.4,
        },
        {
          opacity: 0,
          transform: pixel
            ? 'translateY(-36px)'
            : 'translateY(-30px) rotate(12deg)',
        },
      ],
      duration,
    );
  };
  const roll = events.find((e) => e.type === 'roll');
  const strength = rollStrength(events);
  const throwPlan = diceThrow(strength, Math.random);
  const rollDuration = pixel
    ? pixelThrowDuration(strength)
    : throwPlan.duration;
  const glowFrames: Keyframe[] = [
    { outline: `0 solid ${gold}00` },
    { outline: `4px solid ${gold}`, offset: 0.2 },
    { outline: `0 solid ${gold}00`, offset: 0.4 },
    { outline: `4px solid ${gold}`, offset: 0.6 },
    { outline: `0 solid ${gold}00` },
  ];
  /** The 8-bit tumble: the physics path sampled at ~12 fps, quarter turns only, random
   * faces flicking by until the die settles on its real face. */
  const pixelDie = (
    die: HTMLElement,
    points: ReturnType<typeof diceThrow>['paths'][number],
    i: number,
    { table, cx, cy, rx, ry }: Throw,
  ) => {
    const origin = die.getBoundingClientRect();
    const centerX = origin.x + origin.width / 2 - table.x;
    const centerY = origin.y + origin.height / 2 - table.y;
    const duration = rollDuration + i * 90;
    const count = Math.max(8, Math.round(duration / 85));
    const settle = Math.round(count * 0.78);
    const sample = Array.from(
      { length: count + 1 },
      (_, k) => points[Math.round((k / count) * (points.length - 1))],
    );
    const snapPx = (v: number) => Math.round(v / 3) * 3;
    animate(
      die,
      sample.map((point, k) => ({
        offset: k / count,
        easing: 'step-end',
        transform: `translate(${snapPx(cx + point.x * rx - centerX)}px,${snapPx(cy + (point.y - point.height) * ry - centerY)}px) rotate(${k >= settle ? 0 : ((k + i) % 4) * 90}deg)`,
      })),
      duration,
      0,
      'linear',
    );
    const shown = Number(die.dataset.value) || 1;
    const faces = sample.map((_, k) =>
      k >= settle ? shown : 1 + Math.floor(Math.random() * 6),
    );
    die.querySelectorAll<HTMLElement>('[data-pips]').forEach((face) => {
      const value = Number(face.dataset.pips);
      animate(
        face,
        faces.map((f, k) => ({
          offset: k / count,
          easing: 'step-end',
          opacity: f === value ? 1 : 0,
        })),
        duration,
        0,
        'linear',
      );
    });
  };
  let delivery = 0;
  for (const event of events) {
    if (event.type === 'placement') {
      const wrapper = root.querySelector(
        `[data-piece="${event.piece === 'road' ? 'road' : 'building'}-${event.location}"]`,
      );
      const piece = wrapper?.querySelector('.built') ?? null;
      if (piece && wrapper) {
        if (event.piece === 'city' && !pixel) {
          const old = piece.cloneNode() as SVGPathElement;
          old.setAttribute('d', settlementPath);
          old.classList.remove('built');
          old.classList.add('previous-settlement');
          wrapper.prepend(old);
          decorations.push(old);
          animate(
            old,
            [
              { opacity: 1 },
              { opacity: 1, offset: 0.55 },
              { opacity: 0, offset: 0.56 },
              { opacity: 0 },
            ],
            500,
          );
        }
        const drop: Keyframe[] = [
          {
            transform:
              event.piece === 'road'
                ? 'translateY(-40px)'
                : 'translateY(-90px)',
            opacity: 0.1,
            easing: 'cubic-bezier(.6,0,1,.8)',
          },
          { transform: 'translateY(0)', opacity: 1, offset: 0.55 },
          { transform: 'translateY(-5px)', offset: 0.72 },
          { transform: 'translateY(0)' },
        ];
        for (const detail of wrapper.querySelectorAll(
          '.piece-finish, .piece-detail',
        ))
          animate(detail, drop, 500);
        animate(
          piece,
          pixel
            ? [
                {
                  transform: `translateY(${event.piece === 'road' ? -30 : -60}px)`,
                  opacity: 0,
                },
                { opacity: 1, offset: 0.1 },
                { transform: 'translateY(0)', offset: 0.6 },
                { transform: 'translateY(-6px)', offset: 0.75 },
                { transform: 'translateY(0)' },
              ]
            : drop,
          event.piece === 'road' ? 350 : 500,
        );
        puff(wrapper);
        const center = wrapper.getBoundingClientRect();
        root.querySelectorAll('[data-hex]').forEach((tile) => {
          const r = tile.getBoundingClientRect();
          if (
            Math.hypot(
              r.x + r.width / 2 - center.x,
              r.y + r.height / 2 - center.y,
            ) < r.width
          )
            animate(
              tile,
              [
                { transform: 'translateY(0)' },
                { transform: 'translateY(2px)', offset: 0.6 },
                { transform: 'translateY(0)' },
              ],
              450,
            );
        });
      }
    }
    if (event.type === 'roll') {
      const tableBox = root.querySelector('.table'),
        shore = root.querySelector('.shore'),
        tray = root.querySelector<HTMLElement>('.board-dice');
      if (!tableBox || !shore || !tray) {
        onRollSettled();
        continue;
      }
      const table = tableBox.getBoundingClientRect();
      const island = shore.getBoundingClientRect();
      const rx = Math.max(30, Math.min(island.width, table.width) / 2 - 26);
      const ry = Math.max(30, Math.min(island.height, table.height) / 2 - 26);
      const cx = table.width / 2,
        cy = table.height / 2;
      const landing = throwPlan.landing;
      tray.style.left = ((cx + landing.x * rx) / table.width) * 100 + '%';
      tray.style.top = ((cy + landing.y * ry) / table.height) * 100 + '%';
      root.querySelectorAll('.die').forEach((die, i) => {
        const points = throwPlan.paths[i];
        if (pixel) {
          pixelDie(die as HTMLElement, points, i, { table, cx, cy, rx, ry });
          return;
        }
        const origin = die.getBoundingClientRect();
        const centerX = origin.x + origin.width / 2 - table.x;
        const centerY = origin.y + origin.height / 2 - table.y;
        const frames: Keyframe[] = points.map((point) => ({
          offset: point.offset,
          transform: `translate3d(${cx + point.x * rx - centerX}px,${cy + (point.y - point.height) * ry - centerY}px,0) rotateX(${point.spinX}deg) rotateY(${point.spinY}deg) rotateZ(${point.yaw}deg)`,
        }));
        animate(die, frames, rollDuration + i * 90, 0, 'linear');
      });
      event.hexes.forEach((id) =>
        pixel
          ? animate(
              hex(id)?.querySelector('.px-glow') ?? null,
              [
                { opacity: 0 },
                { opacity: 1, offset: 0.15 },
                { opacity: 0, offset: 0.3 },
                { opacity: 1, offset: 0.45 },
                { opacity: 0, offset: 0.6 },
                { opacity: 1, offset: 0.75 },
                { opacity: 0 },
              ],
              1200,
              rollDuration + 100,
              'linear',
            )
          : animate(
              hex(id),
              [
                { filter: 'brightness(1)' },
                { filter: 'brightness(1.6)', offset: 0.5 },
                { filter: 'brightness(1)' },
              ],
              1200,
              rollDuration + 100,
            ),
      );
    }
    if (event.type === 'robber') {
      const robber = root.querySelector('[data-robber]');
      const from = hex(event.from)?.getBoundingClientRect(),
        to = hex(event.to)?.getBoundingClientRect();
      if (robber && from && to) {
        const scale = (robber as SVGGraphicsElement).getScreenCTM()?.a || 1;
        animate(
          robber,
          [
            {
              transform: `translate(${(from.x - to.x) / scale}px,${(from.y - to.y) / scale}px)`,
              ...(pixel ? {} : { filter: 'drop-shadow(4px 8px 2px #0019)' }),
            },
            { transform: 'translate(0,-12px)', offset: 0.65 },
            { transform: 'none' },
          ],
          550,
        );
        puff(robber);
      }
    }
    if (event.type === 'transfer') {
      const source =
        event.reason === 'production' && event.hex !== undefined
          ? hex(event.hex)
          : seat(event.from);
      const from = source?.getBoundingClientRect(),
        to = seat(event.to)?.getBoundingClientRect();
      if (from && to) {
        const token = document.createElement('span');
        token.className = `catan-token ${event.reason}`;
        const production = event.reason === 'production';
        token.textContent =
          event.reason === 'theft'
            ? '▧'
            : String(event.count) +
              ['♣', '☁', '♨', '▰', '◆'][event.resource ?? 0];
        token.setAttribute('aria-hidden', 'true');
        token.style.cssText = `position:fixed;pointer-events:none;z-index:9;left:${from.x + from.width / 2}px;top:${from.y + from.height / 2}px;background:#f8e6af;color:#254a44;border-radius:6px;padding:4px 8px;font-size:20px`;
        if (pixel)
          token.style.cssText += `;border-radius:0;font-family:var(--px-font);color:${ink};border:3px solid ${ink};box-shadow:3px 3px 0 ${ink}`;
        if (production) {
          const card = root.querySelectorAll('.hand > .resource-card')[
            event.resource ?? 0
          ];
          const art = card
            ?.querySelector<HTMLElement>('.resource-art')
            ?.cloneNode(true) as HTMLElement | undefined;
          const title = card?.querySelector('.card-title')?.textContent ?? '';
          token.textContent = '';
          if (art) {
            art.style.cssText += ';width:38px;height:38px;flex-shrink:0';
            token.append(art);
          }
          const label = document.createElement('b');
          label.textContent = `+${event.count} ${title}`;
          token.append(label);
          token.style.cssText += pixel
            ? ';display:flex;align-items:center;gap:5px;font-size:20px;white-space:nowrap'
            : ';display:flex;align-items:center;gap:5px;font-size:14px;white-space:nowrap;box-shadow:0 4px 14px #00192380;border:2px solid #fff1ca';
          token.dataset.recipient = event.to;
          token.dataset.resource = String(event.resource);
        }
        root.append(token);
        decorations.push(token);
        const dx = to.x + to.width / 2 - from.x - from.width / 2;
        const dy = to.y + to.height / 2 - from.y - from.height / 2;
        const delay = production ? deliveryDelay(rollDuration, delivery++) : 0;
        animate(
          token,
          production
            ? [
                { opacity: 0, transform: 'translate(-50%,-50%) scale(.8)' },
                {
                  opacity: 1,
                  transform: 'translate(-50%,-50%) scale(1)',
                  offset: 0.12,
                },
                {
                  opacity: 1,
                  transform: 'translate(-50%,-50%) scale(1)',
                  offset: 0.32,
                  easing: 'ease-in-out',
                },
                {
                  opacity: 1,
                  transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`,
                  offset: 0.8,
                },
                {
                  opacity: 1,
                  transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`,
                  offset: 0.93,
                },
                {
                  opacity: 0,
                  transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.9)`,
                },
              ]
            : [
                { opacity: 0, transform: 'scale(.5)' },
                { opacity: 1, offset: 0.15 },
                {
                  opacity: 0,
                  transform: `translate(${dx}px,${dy}px) rotate(${pixel ? 0 : event.reason === 'monopoly' ? 360 : -12}deg) scale(.6)`,
                },
              ],
          production ? 1900 : 650,
          delay,
          production && !pixel ? 'linear' : 'ease-out',
        );
        if (production)
          animate(
            seat(event.to),
            pixel
              ? glowFrames
              : [
                  { boxShadow: '0 0 0 0 #ffe6a200' },
                  { boxShadow: '0 0 20px 4px #ffe6a2', offset: 0.4 },
                  { boxShadow: '0 0 0 0 #ffe6a200' },
                ],
            700,
            delay + GLOW_DELAY,
          );
      }
    }
    if (event.type === 'card') {
      flourish(event.player, event.kind === 'MONOPOLY' ? '✦ ▧' : '▧', 550);
      animate(
        seat(event.player),
        pixel
          ? [
              { transform: 'none' },
              { transform: 'translateY(-6px)', offset: 0.5 },
              { transform: 'none' },
            ]
          : [
              { transform: 'rotate(0)' },
              {
                transform: `rotate(${event.kind === 'MONOPOLY' ? -4 : 2}deg)`,
                filter: 'brightness(1.5)',
                offset: 0.5,
              },
              { transform: 'none' },
            ],
        450,
      );
    }
    if (
      event.type === 'turn' ||
      event.type === 'award' ||
      event.type === 'win'
    ) {
      if (event.type !== 'turn')
        flourish(event.player, event.type === 'win' ? '✦ ★ ✦' : '★', 850);
      animate(
        seat(event.player),
        pixel
          ? glowFrames
          : [
              { boxShadow: '0 0 0 0 #ffe6a2' },
              { boxShadow: '0 0 24px 6px #ffe6a2', offset: 0.4 },
              { boxShadow: '0 0 0 0 #ffe6a200' },
            ],
        event.type === 'turn' ? 400 : 850,
      );
    }
  }
  const rollTimer = roll
    ? setTimeout(onRollSettled, rollDuration + 90)
    : undefined;
  const cleanup = () => {
    clearTimeout(rollTimer);
    onRollSettled();
    animations.forEach((a) => a.cancel());
    decorations.forEach((el) => el.remove());
    onSettled();
  };
  const timer = setTimeout(cleanup, endsAt);
  return () => {
    clearTimeout(timer);
    cleanup();
  };
}

export function softAudio() {
  const audio = createAudio(),
    chip = chiptune(audio);
  let ready: Promise<void> | undefined;
  let generation = 0;
  // Cues run once the context has resumed, unless cancelled or stale by then.
  const later = (fn: () => void, requested = performance.now()) => {
    const current = generation;
    void ready?.then(() => {
      if (current === generation && performance.now() - requested <= 650) fn();
    });
  };
  return {
    unlock() {
      ready = audio.unlock();
    },
    cancel() {
      generation++;
    },
    reject(pixel: boolean) {
      if (pixel) return later(() => chip.reject());
      later(() =>
        audio.tone({
          from: 220,
          to: 110,
          duration: 0.18,
          volume: 0.09,
          attack: 0.015,
        }),
      );
    },
    /** `pixel` swaps in the chiptune pack; `player` hears their own deliveries. */
    play(events: PresentationEvent[], pixel: boolean, player: string) {
      if (pixel) {
        const duration = pixelThrowDuration(rollStrength(events));
        return later(() => chip.play(events, player, duration));
      }
      later(() => {
        const tone = (
          delay: number,
          from: number,
          to: number,
          volume: number,
          duration: number,
        ) => audio.tone({ delay, from, to, volume, duration, attack: 0.006 });
        const noise = (
          delay: number,
          volume: number,
          duration: number,
          frequency: number,
        ) =>
          audio.noise({
            delay,
            volume,
            duration,
            frequency,
            filter: 'lowpass',
            attack: 0.01,
          });
        const placement = events.find((e) => e.type === 'placement');
        if (placement?.type === 'placement') {
          const impact = placement.piece === 'road' ? 0.19 : 0.275,
            weight = placement.piece === 'road' ? 0.45 : 1;
          noise(0, 0.08 * weight, 0.25, 1800);
          tone(impact, 130, 32, 0.55 * weight, 0.55);
          tone(impact, 67, 28, 0.3 * weight, 0.65);
          noise(impact, 0.35 * weight, 0.35, 1300);
          noise(impact + 0.1, 0.12 * weight, 0.45, 420);
        } else if (events.some((e) => e.type === 'roll')) {
          const scale = 0.3 + rollStrength(events) * 0.3;
          for (let i = 0; i < 5; i++) {
            const at = [0.05, 0.91, 1.12, 1.38, 1.52][i] * scale;
            noise(at, 0.1 * (1 - i * 0.16), 0.055, 2800);
            tone(at, 280 + i * 30, 120, 0.055, 0.065);
          }
        } else tone(0, 360, 150, 0.035, 0.16);
      });
    },
    close() {
      generation++;
      audio.close();
    },
  };
}
