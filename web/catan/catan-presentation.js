// Presentation only. Original procedural motion and synthesized audio; no game decisions.
let wasm,
  frame,
  pending = [],
  rollStart = 0,
  motion = true,
  sound = true,
  audio,
  graphicsReady = false;
const flights = new Set();
try {
  motion =
    localStorage.getItem('catan-motion') !== 'off' &&
    (localStorage.getItem('catan-motion') === 'on' ||
      !matchMedia('(prefers-reduced-motion: reduce)').matches);
  sound = localStorage.getItem('catan-sound') !== 'off';
} catch {
  motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function preferences() {
  for (const [id, on, label] of [
    ['motion-toggle', motion, 'Motion'],
    ['sound-toggle', sound, 'Sound'],
  ]) {
    const b = document.getElementById(id);
    b.setAttribute('aria-checked', String(on));
    b.textContent = `${label} ${on ? 'on' : 'off'}`;
  }
}
export function configure(module) {
  wasm = module;
  preferences();
}
function unlock() {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}
function clickSound(dice = false) {
  if (!sound || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = dice ? 'triangle' : 'sine';
  oscillator.frequency.value = dice ? 150 : 240;
  gain.gain.setValueAtTime(0.025, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.13);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.14);
}
document.addEventListener('pointerdown', unlock);
document.addEventListener('keydown', unlock);
document.addEventListener('click', ({ target }) => {
  const id = target.closest('button')?.id;
  if (id === 'motion-toggle') {
    motion = !motion;
    if (!motion) cancel_motion();
  } else if (id === 'sound-toggle') {
    sound = !sound;
    if (sound) unlock();
    else audio?.suspend().catch(() => {});
  } else return;
  try {
    localStorage.setItem('catan-motion', motion ? 'on' : 'off');
    localStorage.setItem('catan-sound', sound ? 'on' : 'off');
  } catch {}
  preferences();
});
export function graphics_lost() {
  graphicsReady = false;
  cancel_motion();
  document.getElementById('graphics-recovery').hidden = false;
}
export async function restore_graphics() {
  cancel_motion();
  graphicsReady = false;
  const forced = new URLSearchParams(location.search).get('graphics') === 'webgl';
  const canvas = () => document.getElementById('table-canvas');
  function replaceCanvas() {
    const replacement = canvas().cloneNode(false);
    canvas().replaceWith(replacement);
  }
  try {
    replaceCanvas();
    const backend = await wasm.initialize_graphics(forced, atlasPixels);
    document.getElementById('board').dataset.renderer = backend;
  } catch (first) {
    if (forced) throw first;
    replaceCanvas();
    const backend = await wasm.initialize_graphics(true, atlasPixels);
    document.getElementById('board').dataset.renderer = backend;
  }
  graphicsReady = true;
  document.getElementById('graphics-recovery').hidden = true;
  canvas().addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    graphics_lost();
  });
  canvas().addEventListener('webglcontextrestored', () => restore_graphics().catch(() => {}));
  request_frame();
}
document.getElementById('retry-graphics').addEventListener('click', () =>
  restore_graphics().catch(() => {
    document.getElementById('graphics-recovery').hidden = false;
  }),
);
export function request_frame() {
  if (frame || !graphicsReady) return;
  frame = requestAnimationFrame((t) => {
    frame = 0;
    const progress = rollStart ? Math.min(1, (t - rollStart) / 900) : 1;
    try {
      wasm.draw_frame(motion ? progress : 1);
    } catch {
      graphicsReady = false;
      document.getElementById('graphics-recovery').hidden = false;
    }
    if (progress < 1 && motion) request_frame();
    else rollStart = 0;
  });
}
export function cancel_motion() {
  pending = [];
  rollStart = 0;
  for (const f of flights) {
    f.animation.cancel();
    f.el.remove();
  }
  flights.clear();
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  request_frame();
}
export function before_render(events) {
  try {
    pending = JSON.parse(events);
  } catch {
    pending = [];
  }
}
function fly(from, to, color = '#456241') {
  if (!from || !to || !motion) return;
  const a = from.getBoundingClientRect(),
    b = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'flying-resource';
  el.style.background = color;
  el.style.left = `${a.x + a.width / 2 - 15}px`;
  el.style.top = `${a.y + a.height / 2 - 21}px`;
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const animation = el.animate(
    [
      { transform: 'translate(0,0) rotate(-8deg)', opacity: 0.9 },
      {
        transform: `translate(${(b.x + b.width / 2 - a.x - a.width / 2) * 0.5}px,${(b.y + b.height / 2 - a.y - a.height / 2) * 0.5 - 30}px) rotate(5deg)`,
        opacity: 1,
      },
      {
        transform: `translate(${b.x + b.width / 2 - a.x - a.width / 2}px,${b.y + b.height / 2 - a.y - a.height / 2}px) rotate(0)`,
        opacity: 0,
      },
    ],
    { duration: 420, easing: 'ease-in-out' },
  );
  const flight = { el, animation };
  flights.add(flight);
  animation.finished
    .catch(() => {})
    .finally(() => {
      el.remove();
      flights.delete(flight);
    });
}
export function after_render() {
  const events = pending;
  pending = [];
  const seat = (id) => document.querySelector(`[data-seat="${id}"]`),
    bank = document.getElementById('bank');
  for (const event of events) {
    if (event.type === 'rolled') {
      rollStart = motion ? performance.now() : 0;
      if (motion)
        for (const die of document.querySelectorAll('.die')) {
          const animation = die.animate(
            [
              { transform: 'translateY(-8px) rotate(-35deg)' },
              { transform: 'translateY(1px) rotate(95deg)', offset: 0.55 },
              { transform: getComputedStyle(die).transform },
            ],
            { duration: 900, easing: 'cubic-bezier(.2,.6,.3,1)' },
          );
          const flight = { el: document.createElement('span'), animation };
          flights.add(flight);
          animation.finished.catch(() => {}).finally(() => flights.delete(flight));
        }
      const sum = event.dice[0] + event.dice[1];
      if (motion && sum !== 7)
        for (const tile of document.querySelectorAll(
          `#board-labels [data-number="${sum}"][data-producing="true"] .production-outline`,
        )) {
          const animation = tile.animate(
            [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }],
            { duration: 1500 },
          );
          const flight = { el: document.createElement('span'), animation };
          flights.add(flight);
          animation.finished.catch(() => {}).finally(() => flights.delete(flight));
        }
      document.getElementById('dice-values').textContent =
        `Dice: ${event.dice.join(' + ')} = ${event.dice[0] + event.dice[1]}`;
      document.getElementById('board').dataset.dice = event.dice.join(',');
      clickSound(true);
    } else if (event.type === 'produced') {
      for (const [i, n] of event.resources.entries())
        if (n)
          fly(
            document.querySelector(`.bank-stack.resource-${i}`),
            Number(document.getElementById('board').dataset.player) === event.player
              ? document.querySelector(`#hand .resource-${i}`)
              : seat(event.player),
          );
    } else if (event.type === 'built') {
      settle(event);
      fly(
        seat(event.player),
        document.getElementById(`${event.kind === 'road' ? 'edge' : 'vertex'}-${event.location}`),
        seat(event.player)?.style.getPropertyValue('--seat'),
      );
      fly(seat(event.player), bank);
      clickSound();
    } else if (event.type === 'bought_development') {
      fly(bank, seat(event.player), '#715e37');
      clickSound();
    } else if (event.type === 'traded') {
      fly(seat(event.a), event.b === null ? bank : seat(event.b));
      if (event.b !== null) fly(seat(event.b), seat(event.a));
      clickSound();
    } else if (event.type === 'theft') {
      fly(seat(event.victim), seat(event.thief), '#715e37');
    } else if (event.type === 'discarded') {
      fly(seat(event.player), bank);
    } else if (event.type === 'played_development') {
      clickSound();
    }
  }
  if (events.length)
    document.getElementById('announcement').textContent = events
      .map((e) => e.type.replaceAll('_', ' '))
      .join(' · ');
  request_frame();
}
let zoom = 1,
  panX = 0,
  panY = 0;
const pointers = new Map();
let gesture;
const viewport = document.getElementById('board-viewport'),
  stage = document.getElementById('board-stage');
function transform() {
  sync_layout();
}
document.addEventListener('click', ({ target }) => {
  const kind = target.closest('[data-zoom]')?.dataset.zoom;
  if (!kind) return;
  if (kind === 'fit') {
    zoom = 1;
    panX = panY = 0;
  } else zoom = Math.max(1, Math.min(3, zoom + (kind === 'in' ? 0.25 : -0.25)));
  transform();
});
viewport.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  viewport.setPointerCapture(e.pointerId);
  gesture = { points: [...pointers.values()], zoom, x: panX, y: panY };
});
viewport.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  const p = [...pointers.values()];
  if (p.length === 2 && gesture.points.length === 2) {
    const distance = (a) => Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
    zoom = Math.max(
      1,
      Math.min(3, (gesture.zoom * distance(p)) / Math.max(1, distance(gesture.points))),
    );
  } else if (p.length === 1) {
    panX = gesture.x + p[0][0] - gesture.points[0][0];
    panY = gesture.y + p[0][1] - gesture.points[0][1];
  }
  transform();
});
for (const type of ['pointerup', 'pointercancel'])
  viewport.addEventListener(type, (e) => {
    pointers.delete(e.pointerId);
    gesture = { points: [...pointers.values()], zoom, x: panX, y: panY };
  });
window.addEventListener('resize', sync_layout);

// Browser integration only: geometry and all action eligibility come from Rust.
let atlasPixels,
  fullscreenAttempted = false,
  activeSheet = null;
const openers = new Map();
const artBase = new URL('.', import.meta.url);
const avatarNames = ['Fox', 'Owl', 'Bear', 'Rabbit', 'Cat', 'Badger', 'Deer', 'Wolf'];
let avatar = 0;
try {
  avatar = Math.min(7, Math.max(0, Number(localStorage.getItem('catan-avatar')) || 0));
} catch {}
export function selected_avatar() {
  return avatar;
}
const picker = document.getElementById('avatar-picker');
for (const [i, name] of avatarNames.entries()) {
  const label = document.createElement('label'),
    input = document.createElement('input'),
    img = document.createElement('img');
  input.type = 'radio';
  input.name = 'avatar';
  input.value = String(i);
  input.checked = i === avatar;
  input.setAttribute('aria-label', name);
  img.src = new URL(`avatar-${i}.svg`, artBase);
  img.alt = '';
  label.append(input, img);
  picker.append(label);
  input.addEventListener('change', () => {
    avatar = i;
    try {
      localStorage.setItem('catan-avatar', String(i));
    } catch {}
  });
}
export async function prepare_artwork() {
  const files = [
    'terrain-atlas.svg',
    ...Array.from({ length: 5 }, (_, i) => `icon-${i}.svg`),
    ...Array.from({ length: 5 }, (_, i) => `terrain-${i}-0.svg`),
    ...avatarNames.map((_, i) => `avatar-${i}.svg`),
    ...['knight', 'roadbuilding', 'invention', 'monopoly', 'victorypoint'].map(
      (k) => `development-${k}.svg`,
    ),
  ];
  let complete = 0;
  const images = await Promise.all(
    files.map(async (file) => {
      const image = new Image();
      image.src = new URL(file, artBase);
      await image.decode();
      document.getElementById('load-status').textContent =
        `Painting the table… ${++complete} / ${files.length}`;
      return image;
    }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(images[0], 0, 0);
  atlasPixels = ctx.getImageData(0, 0, 1024, 768).data;
}
function enterFullscreen() {
  const request = document.documentElement.requestFullscreen?.();
  request
    ?.then(() => {
      // Fullscreen creates a new top-layer entry. Re-promote an existing modal so
      // WebKit does not leave its hit targets behind the fullscreen document.
      const dialog = document.querySelector('dialog[open]');
      if (dialog) {
        const focus = document.activeElement;
        dialog.close();
        dialog.showModal();
        if (focus?.isConnected) focus.focus({ preventScroll: true });
      }
    })
    .catch(() => {});
}
export function request_fullscreen() {
  if (fullscreenAttempted) return;
  fullscreenAttempted = true;
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) enterFullscreen();
}
document.getElementById('fullscreen-toggle').addEventListener('click', () => {
  fullscreenAttempted = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else enterFullscreen();
});
document.addEventListener('fullscreenchange', () => {
  const b = document.getElementById('fullscreen-toggle');
  b.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  b.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  sync_layout();
});
function remember(id) {
  const active = document.activeElement;
  openers.set(id, {
    node: active,
    seat: active?.dataset?.playerDetails,
    development: active?.dataset?.development,
  });
}
function returnFocus(id) {
  const opener = openers.get(id);
  if (!opener) return;
  const target = opener.node?.isConnected
    ? opener.node
    : opener.seat !== undefined
      ? document.querySelector(`[data-player-details="${opener.seat}"]`)
      : opener.development
        ? document.querySelector(`[data-development="${opener.development}"]`)
        : null;
  (
    target || document.getElementById(opener.development ? 'development-toggle' : 'room-toggle')
  ).focus({ preventScroll: true });
  openers.delete(id);
}
export function show_panel(id) {
  remember(id);
  document.getElementById('table-menu').open = false;
  document.getElementById(id).showModal();
}
for (const dialog of document.querySelectorAll('dialog'))
  dialog.addEventListener('close', () => {
    if (!dialog.open) returnFocus(dialog.id);
  });
export function open_sheet(id) {
  if (activeSheet && activeSheet !== id) document.getElementById(activeSheet).hidden = true;
  if (document.getElementById('discard-form').hidden === false && id !== 'discard-form') return;
  remember(id);
  activeSheet = id;
  document.getElementById(id).hidden = false;
  sync_layout();
}
export function close_sheet(id) {
  document.getElementById(id).hidden = true;
  if (activeSheet === id) activeSheet = null;
  sync_layout();
  returnFocus(id);
}
export function sync_layout() {
  if (!wasm) return;
  const sheet =
    !document.getElementById('placement-panel').hidden ||
    !document.getElementById('trade-panel').hidden ||
    !document.getElementById('discard-form').hidden ||
    !document.getElementById('victim-form').hidden;
  wasm.layout_table(zoom, panX, panY, sheet);
  request_frame();
}
document.addEventListener('click', ({ target }) => {
  const b = target.closest('button');
  if (!b) return;
  if (b.dataset.sheet) {
    open_sheet(b.dataset.sheet);
    document
      .getElementById(b.dataset.sheet)
      .querySelector('select,input,button')
      ?.focus({ preventScroll: true });
  }
  if (b.dataset.dismiss) close_sheet(b.dataset.dismiss);
  if (b.dataset.development) {
    for (const action of document.querySelectorAll('#development-actions button'))
      action.hidden = action.dataset.kind !== b.dataset.development;
    document.getElementById('buy-development').hidden = true;
    show_panel('development-panel');
  }
  if (b.id === 'development-toggle') {
    for (const action of document.querySelectorAll('#development-actions button'))
      action.hidden = false;
    document.getElementById('buy-development').hidden = false;
  }
  if (b.id === 'hand-toggle') {
    const hand = document.querySelector('.hand-area');
    hand.classList.toggle('expanded');
    b.setAttribute('aria-expanded', String(hand.classList.contains('expanded')));
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (activeSheet) {
    close_sheet(activeSheet);
    e.preventDefault();
  } else if (!document.querySelector('dialog[open]') && document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
});
new ResizeObserver(() => {
  cancel_motion();
  sync_layout();
}).observe(document.getElementById('app'));

function settle(event) {
  if (!motion) return;
  const anchor = document.getElementById(
    `${event.kind === 'road' ? 'edge' : 'vertex'}-${event.location}`,
  );
  if (!anchor) return;
  const r = anchor.getBoundingClientRect(),
    el = document.createElement('div');
  el.className = `settling-piece preview-piece ${event.kind}`;
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.background = document
    .querySelector(`[data-seat="${event.player}"]`)
    ?.style.getPropertyValue('--seat');
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  const animation = el.animate(
    [
      { transform: 'translate(-50%,-100%) scale(1.4)', opacity: 0.4 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
    ],
    { duration: 480, easing: 'ease-out' },
  );
  const effect = { el, animation };
  flights.add(effect);
  animation.finished
    .catch(() => {})
    .finally(() => {
      el.remove();
      flights.delete(effect);
    });
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  let saved;
  try {
    saved = localStorage.getItem('catan-motion');
  } catch {}
  if (!saved) {
    motion = !e.matches;
    if (!motion) cancel_motion();
    preferences();
  }
});
