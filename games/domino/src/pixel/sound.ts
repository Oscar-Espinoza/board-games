import type { Audio } from '@board-games/shared/ui';
import type { Sounds } from '../game.svelte.js';

/** Chiptune sounds for the 8-bit table: square and triangle waves plus noise, no files. */
export function chiptune(audio: Audio): Sounds {
  const note = (
    from: number,
    delay = 0,
    duration = 0.08,
    volume = 0.07,
    type: OscillatorType = 'square',
    to?: number,
  ) => audio.tone({ from, to, delay, duration, volume, type, attack: 0.002 });
  return {
    select: () => note(880, 0, 0.05, 0.05),
    play(force) {
      // A soft tile clicks; a slam crunches and drops.
      note(1320 - force * 700, 0, 0.04, 0.05, 'triangle');
      audio.noise({
        duration: 0.06 + force * 0.16,
        volume: 0.08 + force * 0.4,
        frequency: 1400 - force * 900,
        filter: 'lowpass',
        q: 0.7,
      });
      if (force > 0.55) {
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
      // Two knuckle knocks on the table.
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
    // The tile arcs in from the seat before it lands.
    land: (force) => 320 - force * 140,
  };
}
