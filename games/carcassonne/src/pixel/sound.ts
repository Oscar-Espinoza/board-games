import { createAudio } from '@board-games/shared/ui';
import { buildSamples, chipNote } from '@board-games/shared/ui/pixel';
import type { SoundCue } from '../effects.js';
import type { Event } from '../index.js';

// ZzFX parameter lists (https://killedbyapixel.github.io/ZzFX/), built once and cached.
const zzfx = {
  draw: [0.5, 0.05, 700, 0.01, 0.03, 0.06, 1, 1.7, 9, , , , , 0.4],
  rotate: [0.4, 0.02, 940, , 0.01, 0.03, 1, 1.4, , , , , , , , , , 0.6],
  preview: [0.4, 0.03, 520, , 0.02, 0.05, 1, 1.2, -4],
  place: [0.9, 0.05, 120, 0.005, 0.04, 0.16, 4, 1.6, -4, , , , , 0.9, , 0.2],
  meeple: [0.6, 0.03, 300, 0.005, 0.02, 0.07, 2, 1.8, , , 180, 0.02],
  return: [0.5, 0.05, 620, 0.01, 0.05, 0.12, 1, 1.4, -12],
  build: [0.6, 0.05, 180, 0.02, 0.1, 0.22, 4, 1.4, 3, , 90, 0.06, 0.05, 0.3],
  gold: [0.6, 0.05, 1480, , 0.04, 0.18, 1, 1.9, , , 740, 0.05],
  goods: [0.5, 0.05, 440, , 0.05, 0.12, 2, 1.3, , , 220, 0.05],
  flight: [0.5, 0.05, 260, 0.02, 0.12, 0.2, 1, 1.2, 14],
  ferry: [0.4, 0.05, 220, 0.04, 0.2, 0.25, 0, 1, 1, , , , , , 3],
  magic: [
    0.5,
    0.05,
    900,
    0.02,
    0.18,
    0.2,
    0,
    1.5,
    ,
    ,
    450,
    0.08,
    0.06,
    ,
    ,
    ,
    ,
    0.5,
  ],
  message: [0.4, 0.05, 1200, , 0.06, 0.1, 1, 1.5, , , 300, 0.06],
  robber: [0.6, 0.05, 160, 0.01, 0.06, 0.14, 3, 1.4, -6],
  discard: [0.4, 0.05, 330, 0.01, 0.05, 0.12, 2, 1, -8],
} satisfies Record<string, (number | undefined)[]>;
type Cue = keyof typeof zzfx;

const rate = 44100;
const cache = new Map<Cue, number[]>();

/** Chiptune cues for the 8-bit table: ZzFX samples plus little square-wave jingles. */
export function pixelAudio() {
  const audio = createAudio();
  let muted = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  const sample = (cue: Cue, delay = 0) => {
    let data = cache.get(cue);
    if (!data) cache.set(cue, (data = buildSamples(rate, ...zzfx[cue])));
    const run = () => audio.samples(data!, rate, 0.3);
    if (delay <= 0) return run();
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, delay * 1000);
    timers.add(timer);
  };
  const note = chipNote(audio);
  const tune = (notes: number[], delay: number, step = 0.09, bass = true) => {
    notes.forEach((f, i) =>
      note(
        f,
        delay + i * step,
        i === notes.length - 1 ? step * 3 : step * 0.9,
        0.055,
      ),
    );
    if (bass)
      notes.forEach((f, i) =>
        note(f / 2, delay + i * step, step * 0.9, 0.05, 'triangle'),
      );
  };
  function play(kind: SoundCue, delay = 0) {
    if (muted || !audio.ready) return;
    switch (kind) {
      case 'score':
        tune([784, 988, 1175, 1568], delay, 0.06, false);
        return;
      case 'final':
        tune([523, 659, 784], delay, 0.08, false);
        return;
      case 'extra':
        tune([659, 880], delay, 0.07, false);
        return;
      case 'win':
        tune([523, 523, 523, 698, 880, 784, 1047], delay + 0.15, 0.12);
        return;
      default:
        if (kind in zzfx) sample(kind as Cue, delay);
    }
  }
  return {
    unlock: () => void audio.unlock(),
    play,
    events(events: Event[]) {
      events
        .slice(-10)
        .forEach((e, i) => play(e.kind, Math.min(i * 0.08, 0.5)));
    },
    mute(value: boolean) {
      muted = value;
      if (value) {
        cancel();
        audio.stop();
      }
    },
    close() {
      cancel();
      audio.close();
    },
  };
}
