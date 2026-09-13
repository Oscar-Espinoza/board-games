import { mount, unmount, flushSync } from 'svelte';
import Tile from './Tile.svelte';
import type { Presentation, PresentationStep } from './presentation.js';
export type Bounds = Map<string, DOMRect>;
export function measure(root: HTMLElement): Bounds {
  const map: Bounds = new Map();
  root.querySelectorAll<HTMLElement>('[data-azul-location]').forEach((el) => {
    if (el.closest('dialog')) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height && !map.has(el.dataset.azulLocation!))
      map.set(el.dataset.azulLocation!, r);
  });
  return map;
}
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
  const active = new Set<{
    node: HTMLElement;
    animation: Animation;
    tile: ReturnType<typeof mount>;
  }>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(run: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, delay);
    timers.add(timer);
  }
  function cancel() {
    timers.forEach(clearTimeout);
    timers.clear();
    for (const { node, animation, tile } of active) {
      animation.cancel();
      void unmount(tile);
      node.remove();
    }
    active.clear();
  }
  function play(
    plan: Presentation,
    before: Bounds,
    after: Bounds,
    step: (step: PresentationStep) => void,
    done: () => void,
    sound: ReturnType<typeof ceramicAudio>,
  ) {
    cancel();
    const locate = (map: Bounds, id: string) =>
      map.get(id) ??
      (id.startsWith('center/')
        ? map.get(id.split('/').slice(0, 2).join('/'))
        : undefined) ??
      map.get(`${id.split('/')[0]}/summary`);
    for (const flight of plan.flights) {
      const start = locate(before, flight.from) ?? locate(after, flight.from),
        end = locate(after, flight.to) ?? locate(before, flight.to);
      if (!start || !end) continue;
      const startSize = Math.min(34, start.width, start.height),
        endSize = Math.min(34, end.width, end.height);
      const sx = start.x + (start.width - startSize) / 2,
        sy = start.y + (start.height - startSize) / 2,
        ex = end.x + (end.width - endSize) / 2,
        ey = end.y + (end.height - endSize) / 2;
      const node = document.createElement('span');
      node.className = 'azul-flight';
      node.setAttribute('aria-hidden', 'true');
      node.dataset.from = flight.from;
      node.dataset.to = flight.to;
      node.dataset.endpoint = JSON.stringify({ x: ex, y: ey, size: endSize });
      Object.assign(node.style, {
        position: 'fixed',
        left: `${sx}px`,
        top: `${sy}px`,
        width: `${startSize}px`,
        height: `${startSize}px`,
        transformOrigin: 'top left',
        display: 'block',
        zIndex: '80',
        pointerEvents: 'none',
      });
      const tile = mount(Tile, {
        target: node,
        props: { color: flight.color },
      });
      flushSync();
      document.body.append(node);
      const animation = node.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 0 },
          { offset: 0.08, opacity: 1 },
          {
            transform: `translate(${ex - sx}px,${ey - sy}px) scale(${endSize / startSize})`,
            opacity: 1,
          },
        ],
        {
          duration: flight.duration,
          delay: flight.at,
          fill: 'both',
          easing: 'cubic-bezier(.2,.7,.2,1)',
        },
      );
      const item = { node, animation, tile };
      active.add(item);
      animation.onfinish = () => {
        void unmount(tile);
        node.remove();
        active.delete(item);
      };
      if (flight.sound) sound.play(flight.sound, flight.at / 1000);
    }
    for (const entry of plan.steps) later(() => step(entry), entry.at);
    later(done, plan.duration);
    return plan.duration > 0;
  }
  return { cancel, play };
}
