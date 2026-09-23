import { createAudio } from '@board-games/shared/ui';
import type { Event } from './index.js';
export function tableAudio() {
  const audio = createAudio();
  let muted = false;
  // Broad filtered textures, never pitched oscillators: paper, wood and metal.
  const cues: Record<string, number[][]> = {
    rotate: [[0, 0.12, 0.09, 2100]],
    build: [
      [0, 0.09, 0.14, 240],
      [0.16, 0.08, 0.12, 320],
      [0.34, 0.1, 0.13, 210],
    ],
    preview: [[0, 0.065, 0.08, 850]],
    place: [
      [0, 0.12, 0.24, 190],
      [0.018, 0.07, 0.12, 850],
    ],
    meeple: [
      [0, 0.065, 0.19, 650],
      [0.035, 0.045, 0.08, 1300],
    ],
    return: [
      [0, 0.15, 0.07, 2600],
      [0.13, 0.06, 0.1, 600],
    ],
    score: [
      [0, 0.08, 0.1, 800],
      [0.1, 0.07, 0.09, 1200],
      [0.2, 0.09, 0.07, 1700],
    ],
    final: [
      [0, 0.08, 0.1, 800],
      [0.1, 0.07, 0.09, 1200],
      [0.2, 0.09, 0.07, 1700],
    ],
    gold: [
      [0, 0.035, 0.12, 4300],
      [0.06, 0.05, 0.09, 6100],
      [0.13, 0.04, 0.07, 3700],
    ],
    goods: [
      [0, 0.07, 0.12, 480],
      [0.09, 0.09, 0.1, 950],
    ],
    flight: [
      [0, 0.12, 0.09, 1100],
      [0.09, 0.13, 0.08, 1800],
      [0.19, 0.15, 0.07, 2600],
    ],
    ferry: [
      [0, 0.4, 0.15, 450],
      [0.12, 0.3, 0.08, 1100],
    ],
    magic: [
      [0, 0.28, 0.06, 4500],
      [0.12, 0.3, 0.05, 6200],
    ],
    draw: [
      [0, 0.18, 0.065, 3200],
      [0.12, 0.08, 0.04, 1800],
    ],
    message: [
      [0, 0.24, 0.06, 2400],
      [0.17, 0.12, 0.05, 3900],
    ],
    extra: [
      [0, 0.08, 0.1, 650],
      [0.14, 0.08, 0.1, 950],
    ],
    robber: [
      [0, 0.15, 0.12, 300],
      [0.08, 0.08, 0.05, 1600],
    ],
    win: [
      [0, 0.12, 0.12, 850],
      [0.13, 0.12, 0.1, 1300],
      [0.26, 0.14, 0.08, 2100],
      [0.4, 0.2, 0.06, 3400],
    ],
  };
  function play(kind: string, delay = 0) {
    if (muted) return;
    for (const [offset, duration, volume, frequency] of cues[kind] ?? [])
      audio.noise({
        delay: delay + offset,
        duration,
        volume,
        frequency,
        q: 0.55,
        attack: 0.004,
      });
  }
  return {
    unlock: () => void audio.unlock(),
    play,
    events(events: Event[]) {
      events
        .slice(-10)
        .forEach((e, i) => play(e.kind, Math.min(i * 0.06, 0.4)));
    },
    mute(value: boolean) {
      muted = value;
      if (value) audio.stop();
    },
    close: audio.close,
  };
}
/** Snapshots after a gap establish a baseline rather than replaying old effects. */
export class EventGate {
  private round = -1;
  private last = -1;
  private offline = false;
  take(round: number, events: Event[], connected = true) {
    const newest = events.at(-1)?.id ?? 0;
    if (!connected || this.offline || round !== this.round || this.last < 0) {
      this.offline = !connected;
      this.round = round;
      this.last = newest;
      return [];
    }
    const fresh = events.filter((e) => e.id > this.last);
    const contiguous = !fresh.length || fresh[0].id === this.last + 1;
    this.last = newest;
    return contiguous ? fresh : [];
  }
}
