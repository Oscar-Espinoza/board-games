import type { Audio } from '@board-games/shared/ui';
import { playChiptune, type Chiptune } from '@board-games/shared/ui/pixel';

export type PixelCue =
  'pick' | 'place' | 'floor' | 'marker' | 'penalty' | 'bonus' | 'round';
export type PixelSounds = ReturnType<typeof pixelSounds>;

/** Chiptune pack for the 8-bit table: square/triangle tones and noise, no files. */
export function pixelSounds(audio: Audio) {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let level = 0.25;
  const note = (
    from: number,
    delay = 0,
    duration = 0.07,
    volume = 1,
    type: OscillatorType = 'square',
    to?: number,
  ) =>
    audio.tone({
      from,
      to,
      delay,
      duration,
      volume: volume * level * 0.26,
      type,
      attack: 0.002,
    });
  // ZzFX cues play immediately, so delayed ones wait on a cancellable timer.
  const zzfx = (cue: Chiptune, delay = 0, volume = 1) => {
    if (delay <= 0) return playChiptune(audio, cue, level * volume * 2);
    const timer = setTimeout(() => {
      timers.delete(timer);
      playChiptune(audio, cue, level * volume * 2);
    }, delay * 1000);
    timers.add(timer);
  };
  const cues: Record<PixelCue, (delay?: number) => void> = {
    /** Tiles lifted from a factory or the centre. */
    pick(delay = 0) {
      note(660, delay, 0.045, 0.8);
      note(990, delay + 0.05, 0.06, 0.8);
    },
    /** Tiles click into a pattern line. */
    place(delay = 0) {
      note(1175, delay, 0.03, 0.7, 'triangle');
      note(587, delay + 0.03, 0.07, 0.9, 'square', 440);
      audio.noise({
        delay,
        duration: 0.04,
        volume: level * 0.18,
        frequency: 2600,
        q: 1.4,
      });
    },
    /** Overflow drops onto the floor line: a low bump. */
    floor(delay = 0) {
      note(262, delay, 0.14, 1, 'square', 98);
      audio.noise({
        delay,
        duration: 0.1,
        volume: level * 0.35,
        frequency: 500,
        filter: 'lowpass',
      });
    },
    /** First-player marker claimed: a bright arpeggio. */
    marker(delay = 0) {
      [784, 1047, 1319].forEach((f, i) => note(f, delay + i * 0.05, 0.05, 0.7));
    },
    /** Floor deductions: a falling buzz. */
    penalty(delay = 0) {
      note(392, delay, 0.09, 0.9, 'square');
      note(294, delay + 0.1, 0.09, 0.9, 'square');
      note(196, delay + 0.2, 0.22, 1, 'square', 147);
    },
    /** End-of-game row/column/colour bonus fanfare. */
    bonus(delay = 0) {
      const tune = [523, 659, 784, 1047, 784, 1047];
      tune.forEach((f, i) =>
        note(f, delay + i * 0.08, i === tune.length - 1 ? 0.24 : 0.07, 0.8),
      );
      tune.forEach((f, i) =>
        note(f / 2, delay + i * 0.08, 0.07, 0.6, 'triangle'),
      );
      zzfx('coin', delay + 0.5, 0.7);
    },
    /** A round is scored and the factories are refilled. */
    round(delay = 0) {
      audio.noise({
        delay,
        duration: 0.22,
        volume: level * 0.18,
        frequency: 1800,
        sweep: 600,
        q: 0.8,
      });
      [392, 523, 659].forEach((f, i) =>
        note(f, delay + 0.18 + i * 0.07, 0.06, 0.7, 'triangle'),
      );
    },
  };
  return {
    ...cues,
    setLevel(volume: number) {
      level = volume;
    },
    /** Wall tiling: one rising tick per point, capped, then a coin for big combos. */
    score(points: number, delay = 0) {
      const ticks = Math.min(points, 10);
      for (let i = 0; i < ticks; i++)
        note(660 * 2 ** ((i * 2) / 12), delay + i * 0.055, 0.045, 0.75);
      if (points >= 5) zzfx('coin', delay + ticks * 0.055, 0.6);
    },
    /** Match over: a victory tune or a short sting. */
    end(won: boolean) {
      if (won) {
        zzfx('win');
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          note(f, 0.18 + i * 0.1, i === 4 ? 0.3 : 0.09, 0.7),
        );
      } else zzfx('lose');
    },
    stop() {
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
