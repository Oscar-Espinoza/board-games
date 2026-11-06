import type { Audio } from '@board-games/shared/ui';
import { chipNote } from '@board-games/shared/ui/pixel';
import type { Sounds } from '../game.svelte.js';
import { HARD_SLAM, flightMsPixel } from '../constants.js';

/** Chiptune sounds for the 8-bit table: square and triangle waves plus noise, no files. */
export function chiptune(audio: Audio): Sounds {
  const note = chipNote(audio);
  return {
    select: () => note(880, 0, 0.05, 0.05),
    play(force) {
      note(1320 - force * 700, 0, 0.04, 0.05, 'triangle');
      audio.noise({
        duration: 0.06 + force * 0.16,
        volume: 0.08 + force * 0.4,
        frequency: 1400 - force * 900,
        filter: 'lowpass',
        q: 0.7,
      });
      if (force > HARD_SLAM) {
        note(220, 0, 0.22, 0.09, 'square', 55);
        audio.noise({
          delay: 0.05,
          duration: 0.14,
          volume: 0.1,
          frequency: 3000,
          sweep: 600,
          q: 1.2,
        });
      }
    },
    pass() {
      for (const delay of [0, 0.15]) {
        audio.noise({
          delay,
          duration: 0.05,
          volume: 0.26,
          frequency: 380,
          filter: 'lowpass',
        });
        note(140, delay, 0.05, 0.06, 'triangle');
      }
    },
    turn() {
      note(660, 0, 0.07, 0.045);
      note(990, 0.08, 0.1, 0.045);
    },
    end(won) {
      const tune =
        won === false
          ? [523, 440, 349, 262]
          : won === null
            ? [440, 440, 523]
            : [523, 659, 784, 1047, 1319];
      tune.forEach((f, i) =>
        note(f, i * 0.11, i === tune.length - 1 ? 0.3 : 0.1, 0.06),
      );
      tune.forEach((f, i) => note(f / 2, i * 0.11, 0.1, 0.04, 'triangle'));
    },
    land: flightMsPixel,
  };
}
