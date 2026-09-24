import { createAudio } from '@board-games/shared/ui';
import { mount, unmount, flushSync } from 'svelte';
import Tile from './Tile.svelte';
import { skinKey } from './palette.js';
import type { Flight, Presentation, PresentationStep } from './presentation.js';
import type { PixelSounds } from './pixel/sound.js';
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
  const audio = createAudio();
  let enabled = true,
    volume = 0.25,
    chip: PixelSounds | null = null;
  const stop = () => {
    chip?.stop();
    audio.stop();
  };
  return {
    /** The shared Web Audio instance, for building the 8-bit pack. */
    raw: audio,
    unlock: () => void audio.unlock(),
    configure(sound: boolean, level: number) {
      enabled = sound;
      volume = level;
      chip?.setLevel(level);
      if (!sound) stop();
    },
    /** The 8-bit skin's chiptune pack; null restores the ceramic clicks. */
    set pixel(pack: PixelSounds | null) {
      chip?.stop();
      chip = pack;
      chip?.setLevel(volume);
    },
    /** Runs an 8-bit cue; the classic skin keeps its restrained cues only. */
    chip(run: (pack: PixelSounds) => void) {
      if (enabled && !document.hidden && chip) run(chip);
    },
    /** 8-bit cues for a whole presentation; false leaves it to `play`. */
    flights(list: Flight[]) {
      if (!chip) return false;
      if (!enabled || document.hidden) return true;
      const pack = chip,
        at = (f: Flight, end = false) => (f.at + (end ? f.duration : 0)) / 1000,
        draft = list.find((f) => f.sound === 'tile'),
        marker = list.find((f) => f.sound === 'marker'),
        // Overflow and direct floor drafts, not the round-end sweep off the floor.
        floor = list.find(
          (f) =>
            f.color !== 'marker' &&
            f.to.includes('/floor/') &&
            !/\/(pattern|floor)\//.test(f.from),
        ),
        deal = list.find((f) => f.from === 'bag' || f.from === 'discard');
      if (draft) {
        pack.pick(at(draft));
        if (!draft.to.includes('/floor/')) pack.place(at(draft, true));
      }
      if (marker) pack.marker(at(marker, true));
      if (floor) pack.floor(at(floor, true));
      if (deal) pack.round(at(deal));
      return true;
    },
    play(kind: 'tile' | 'marker' | 'score', delay = 0) {
      if (!enabled || document.hidden) return;
      audio.tone({
        delay,
        from: kind === 'score' ? 880 : kind === 'marker' ? 360 : 680,
        to: kind === 'score' ? 1320 : 220,
        duration: 0.11,
        volume: volume * 0.12,
        attack: 0.003,
      });
    },
    stop,
    close() {
      chip?.stop();
      audio.close();
    },
  };
}
/** `pixel` reports the viewer's skin when a flight starts. */
export function tileFlights(pixel: () => boolean = () => false) {
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
    const chiptune = sound.flights(plan.flights),
      eightBit = pixel();
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
      node.className = eightBit ? 'azul-flight az-pixel' : 'azul-flight';
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
        context: new Map([[skinKey, () => eightBit]]),
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
          // 8-bit tiles hop between positions like sprites in a 16-bit game.
          easing: eightBit ? 'steps(6, jump-end)' : 'cubic-bezier(.2,.7,.2,1)',
        },
      );
      const item = { node, animation, tile };
      active.add(item);
      animation.onfinish = () => {
        void unmount(tile);
        node.remove();
        active.delete(item);
      };
      if (flight.sound && !chiptune) sound.play(flight.sound, flight.at / 1000);
    }
    for (const entry of plan.steps) later(() => step(entry), entry.at);
    later(done, plan.duration);
    return plan.duration > 0;
  }
  return { cancel, play };
}
