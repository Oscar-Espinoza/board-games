// Color Match presentation only; never imported by another game.
let audioContext,
  noise,
  soundEnabled = true;
const sounds = new Set();
try {
  soundEnabled = localStorage.getItem('cm-sound') !== 'off';
} catch {
  /* Storage is optional. */
}
const soundButton = document.getElementById('sound-toggle');
function updateSoundButton() {
  soundButton.setAttribute('aria-checked', String(soundEnabled));
  soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
}
updateSoundButton();
function stopSounds() {
  for (const source of sounds) {
    try {
      source.stop();
    } catch {
      /* Already ended. */
    }
  }
  sounds.clear();
}
function unlockAudio() {
  if (!soundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    /* Audio never blocks a move. */
  }
}
// Capture runs before Rust's delegated actions, including keyboard-generated clicks.
document.addEventListener(
  'click',
  (event) => {
    if (event.target.closest('#sound-toggle')) {
      soundEnabled = !soundEnabled;
      try {
        localStorage.setItem('cm-sound', soundEnabled ? 'on' : 'off');
      } catch {
        /* Optional. */
      }
      updateSoundButton();
      if (!soundEnabled) stopSounds();
    }
    unlockAudio();
  },
  true,
);
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);
function woosh() {
  if (!soundEnabled || audioContext?.state !== 'running') return;
  try {
    const ctx = audioContext,
      time = ctx.currentTime;
    if (!noise) {
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.22), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(1100, time);
    filter.frequency.exponentialRampToValueAtTime(350, time + 0.22);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.07, time + 0.045);
    gain.gain.linearRampToValueAtTime(0, time + 0.22);
    source.connect(filter).connect(gain).connect(ctx.destination);
    sounds.add(source);
    source.onended = () => {
      sounds.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(time);
    source.stop(time + 0.22);
  } catch {
    /* Unavailable audio silently degrades. */
  }
}

let animationsEnabled = true;
try {
  animationsEnabled = localStorage.getItem('cm-animations') !== 'off';
} catch {
  /* Storage is optional. */
}
const animationsButton = document.getElementById('animations-toggle');
function updateAnimationsButton() {
  animationsButton.setAttribute('aria-checked', String(animationsEnabled));
  animationsButton.textContent = `Card animations ${animationsEnabled ? 'on' : 'off'}`;
}
updateAnimationsButton();
animationsButton.addEventListener('click', () => {
  animationsEnabled = !animationsEnabled;
  try {
    localStorage.setItem('cm-animations', animationsEnabled ? 'on' : 'off');
  } catch {
    /* Optional. */
  }
  updateAnimationsButton();
  if (!animationsEnabled) {
    for (const finish of [...flights]) finish();
  }
});

let pending, announcementTimer;
const flights = new Set();
const destinations = new Map();
// Keep the latest arrived card visible beneath later flights to the same pile.
function revealArrivals(target) {
  const stack = destinations.get(target);
  if (!stack?.length) {
    destinations.delete(target);
    target.classList.remove('in-flight');
    return;
  }
  const latest = stack.at(-1);
  target.classList.toggle('in-flight', !latest.arrived);
  const visible = stack.findLast((flight) => flight.arrived);
  for (const flight of [...stack]) {
    if (flight.arrived && (latest.arrived || flight !== visible)) flight.finish();
  }
}
export function cancel_motion() {
  pending = null;
  clearTimeout(announcementTimer);
  for (const finish of [...flights]) finish();
  stopSounds();
  document.getElementById('announcement').textContent = '';
}
function geometry(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}
function appearance(element) {
  const copy = document.createElement('div');
  copy.className = element.className;
  copy.classList.remove('in-flight');
  copy.innerHTML = element.innerHTML;
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}
export function before_render(json, viewer) {
  const events = JSON.parse(json);
  if (!events.length) cancel_motion();
  pending = {
    viewer,
    ids: new Set([...document.querySelectorAll('#hand .card')].map((e) => e.id)),
    events: events.map((event) => {
      const source =
        event.type === 'played'
          ? document.getElementById(`card-${event.card.id}`) ||
            document.querySelector(`#seat-${event.player} .fan i:last-child`)
          : document.getElementById('draw');
      return {
        event,
        origin: geometry(source),
        card:
          event.type === 'played' && event.player === viewer && source ? appearance(source) : null,
      };
    }),
  };
}
function fly(origin, target, copy, delay, rotation, hide = true, lift = false) {
  const end = geometry(target);
  if (!origin || !end || !origin.width || !end.width) return;
  copy.classList.add('flying-card');
  const width = document.getElementById('discard').offsetWidth,
    height = document.getElementById('discard').offsetHeight;
  copy.style.cssText = `left:${origin.x - width / 2}px;top:${origin.y - height / 2}px;width:${width}px;height:${height}px;transform-origin:center;`;
  document.body.append(copy);
  let animation;
  const flight = { arrived: false, finish: null };
  const finish = () => {
    if (!flights.delete(finish)) return;
    animation?.cancel();
    copy.remove();
    if (hide) {
      const stack = destinations.get(target);
      stack.splice(stack.indexOf(flight), 1);
      revealArrivals(target);
    }
  };
  flight.finish = finish;
  flights.add(finish);
  if (hide) {
    if (!destinations.has(target)) destinations.set(target, []);
    destinations.get(target).push(flight);
    target.classList.add('in-flight');
  }
  const dx = end.x - origin.x,
    dy = end.y - origin.y;
  try {
    const start = `translate(0,0) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})`;
    const easing = 'cubic-bezier(.2,.65,.3,1)';
    animation = copy.animate(
      lift
        ? [
            { transform: start, offset: 0, easing: 'ease-out' },
            {
              transform: `translate(0,-18px) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})`,
              offset: 65 / 320,
              easing,
            },
            {
              transform: `translate(${dx * 0.55}px,${dy * 0.55 - 28}px) rotate(-4deg) scale(${(origin.width + end.width) / (2 * width)},${(origin.height + end.height) / (2 * height)})`,
              offset: 0.6,
              easing: 'ease-out',
            },
            {
              transform: `translate(${dx}px,${dy}px) rotate(7deg) scale(${end.width / width},${end.height / height})`,
              offset: 1,
            },
          ]
        : [
            {
              transform: `translate(0,0) rotate(${rotation}deg) scale(${origin.width / width},${origin.height / height})`,
            },
            {
              transform: `translate(${dx / 2}px,${dy / 2 - 22}px) rotate(-4deg) scale(${(origin.width + end.width) / (2 * width)},${(origin.height + end.height) / (2 * height)})`,
              offset: 0.5,
            },
            {
              transform: `translate(${dx}px,${dy}px) rotate(${target.id === 'discard' ? 7 : 0}deg) scale(${end.width / width},${end.height / height})`,
            },
          ],
      {
        duration: target.id === 'discard' ? 320 : 300,
        delay,
        fill: 'both',
        easing: lift ? 'linear' : easing,
      },
    );
    animation.finished.then(() => {
      if (!flights.has(finish)) return;
      if (hide) {
        flight.arrived = true;
        revealArrivals(target);
      } else finish();
    }, finish);
  } catch {
    finish();
  }
}
export function after_render() {
  if (!pending) return;
  const { viewer, ids, events } = pending;
  pending = null;
  // Rust refreshes the discard class even for color choices and draws.
  for (const target of destinations.keys()) revealArrivals(target);
  const arrivals = [...document.querySelectorAll('#hand .card')].filter((e) => !ids.has(e.id));
  if (
    arrivals.length &&
    events.some(({ event }) => event.type === 'drew' && event.player === viewer && event.count > 0)
  )
    arrivals.at(-1).scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  for (const { event, origin, card } of events) {
    let message;
    if (event.type === 'uno') message = 'UNO!';
    if (event.type === 'caught') message = 'Caught! Draw two.';
    if (event.type === 'played' && ['draw_two', 'wild_four'].includes(event.card.face.kind))
      message = event.card.face.kind === 'draw_two' ? '+2 · draw penalty' : '+4 · draw penalty';
    if (message) {
      document.getElementById('announcement').textContent = message;
      clearTimeout(announcementTimer);
      announcementTimer = setTimeout(() => {
        document.getElementById('announcement').textContent = '';
      }, 1500);
    }
    if (!['played', 'drew'].includes(event.type) || event.count === 0) continue;
    woosh();
    if (!animationsEnabled) continue;
    if (event.type === 'played') {
      const target = document.getElementById('discard');
      fly(
        origin,
        target,
        card || appearance(target),
        0,
        event.player === viewer ? 0 : -10,
        true,
        event.player === viewer,
      );
    } else {
      const targets =
        event.player === viewer
          ? arrivals
          : Array(Math.min(event.count, 4)).fill(
              document.querySelector(`#seat-${event.player} .fan i:last-child`),
            );
      targets.forEach((target, index) => {
        if (target)
          fly(
            origin,
            target,
            appearance(document.getElementById('draw')),
            (index * 60) / Math.max(1, targets.length - 1),
            -6,
            event.player === viewer,
          );
      });
    }
  }
}
