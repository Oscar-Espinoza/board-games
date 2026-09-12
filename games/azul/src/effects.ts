import type { Event } from './index.js';
export type Bounds = Map<string, DOMRect>;
export function measure(root: HTMLElement): Bounds {
  const map: Bounds = new Map();
  root.querySelectorAll<HTMLElement>('[data-azul-location]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) map.set(el.dataset.azulLocation!, r);
  });
  return map;
}
const paints = {
  blue: ['#1766a0', '◆'],
  yellow: ['#edb737', '☀'],
  red: ['#ae4235', '❯'],
  black: ['#24313b', '▦'],
  white: ['#faf2da', '✿'],
  marker: ['#f5e8c9', '1'],
};
export function ceramicAudio() {
  let context: AudioContext | undefined;
  const sources = new Set<OscillatorNode>();
  let enabled = true,
    volume = 0.25;
  return {
    unlock() {
      try {
        context ??= new AudioContext();
        if (context.state === 'suspended')
          void context.resume().catch(() => {});
      } catch {
        /* Silent play is complete. */
      }
    },
    configure(sound: boolean, level: number) {
      enabled = sound;
      volume = level;
      if (!sound) this.stop();
    },
    play(kind: 'tile' | 'marker' | 'score', delay = 0) {
      if (
        !enabled ||
        !context ||
        context.state !== 'running' ||
        document.hidden
      )
        return;
      try {
        const oscillator = context.createOscillator(),
          gain = context.createGain(),
          when = context.currentTime + delay;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(
          kind === 'score' ? 880 : kind === 'marker' ? 360 : 680,
          when,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          kind === 'score' ? 1320 : 220,
          when + 0.06,
        );
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(volume * 0.12, when + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);
        oscillator.connect(gain);
        gain.connect(context.destination);
        sources.add(oscillator);
        oscillator.onended = () => {
          sources.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(when);
        oscillator.stop(when + 0.13);
      } catch {
        /* Browser audio denial must not alter play. */
      }
    },
    stop() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {}
      }
      sources.clear();
    },
    close() {
      this.stop();
      void context?.close().catch(() => {});
    },
  };
}
export function tileFlights() {
  const active = new Set<{ node: HTMLElement; animation: Animation }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    clearTimeout(timer);
    for (const { node, animation } of active) {
      animation.cancel();
      node.remove();
    }
    active.clear();
  }
  function play(
    events: Event[],
    before: Bounds,
    after: Bounds,
    done: () => void,
    sound: ReturnType<typeof ceramicAudio>,
  ) {
    cancel();
    let duration = 0;
    const hasWall = events.some((e) => e.type === 'wall');
    const locate = (map: Bounds, id: string) =>
      map.get(id) ?? map.get(`${id.split('/')[0]}/summary`);
    let soundedDraft = false;
    for (const event of events) {
      if (event.type !== 'travel' && event.type !== 'wall') continue;
      const start = locate(before, event.from) ?? locate(after, event.from),
        end = locate(after, event.to) ?? locate(before, event.to);
      if (!start || !end) continue;
      const delay =
        event.type === 'wall'
          ? 380 + event.row * 230
          : event.reason === 'deal'
            ? hasWall
              ? 1740
              : 430
            : event.reason === 'spill'
              ? 80
              : 0;
      const travelTime = event.type === 'wall' ? 240 : 310;
      const node = document.createElement('span');
      node.className = 'azul-flight';
      node.setAttribute('aria-hidden', 'true');
      const [paint, symbol] = paints[event.color];
      node.textContent = symbol;
      Object.assign(node.style, {
        position: 'fixed',
        left: `${start.x}px`,
        top: `${start.y}px`,
        width: `${Math.min(34, start.width)}px`,
        height: `${Math.min(34, start.height)}px`,
        display: 'grid',
        placeItems: 'center',
        borderRadius: event.color === 'marker' ? '50%' : '5px',
        background: paint,
        color:
          event.color === 'white' ||
          event.color === 'yellow' ||
          event.color === 'marker'
            ? '#244658'
            : '#f8eacb',
        fontSize: '23px',
        boxShadow: 'inset 0 2px 1px #ffffff88, 1px 4px 6px #0005',
        zIndex: '80',
        pointerEvents: 'none',
      });
      document.body.append(node);
      const animation = node.animate(
        [
          { transform: 'translate(0,0) rotate(-5deg)', opacity: 0 },
          { offset: 0.08, opacity: 1 },
          {
            transform: `translate(${end.x - start.x}px,${end.y - start.y}px) rotate(0deg)`,
            opacity: 1,
          },
        ],
        {
          duration: travelTime,
          delay,
          fill: 'both',
          easing: 'cubic-bezier(.2,.7,.2,1)',
        },
      );
      const item = { node, animation };
      active.add(item);
      animation.onfinish = () => {
        node.remove();
        active.delete(item);
      };
      duration = Math.max(duration, delay + travelTime);
      if (event.type === 'wall') sound.play('score', delay / 1000);
      else if (event.reason === 'marker') sound.play('marker');
      else if (!soundedDraft && event.reason === 'draft') {
        sound.play('tile');
        soundedDraft = true;
      }
    }
    timer = setTimeout(done, duration + 50);
    return duration > 0;
  }
  return { cancel, play };
}
