import type { Audio } from '../audio.js';
import { buildSamples } from './zzfx-core.js';

export { buildSamples };

/** ZzFX parameter lists (design new ones at https://killedbyapixel.github.io/ZzFX/). */
export const chiptune = {
  click: [0.6, 0.05, 537, 0.02, 0.02, 0.08, 1, 1.6, -7, 5],
  coin: [0.8, 0.05, 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06],
  stamp: [0.8, 0.05, 110, 0.005, 0.03, 0.14, 4, 1.4, -3, , , , , 0.6, , 0.25],
  win: [0.8, 0, 523, 0.04, 0.22, 0.4, 1, 1.5, , , 261, 0.09, 0.14],
  lose: [0.8, 0.05, 330, 0.04, 0.25, 0.5, 2, 1, -6, , , , , 0.3],
} satisfies Record<string, (number | undefined)[]>;
export type Chiptune = keyof typeof chiptune;

const rate = 44100;
const cache = new Map<Chiptune, number[]>();

/** Plays a chiptune cue through a gesture-unlocked shared audio instance. */
export function playChiptune(audio: Audio, cue: Chiptune, volume: number) {
  if (!audio.ready) return;
  let samples = cache.get(cue);
  if (!samples)
    cache.set(cue, (samples = buildSamples(rate, ...chiptune[cue])));
  audio.samples(samples, rate, Math.min(1, Math.max(0, volume)) * 0.35);
}
