import { clamp01, createAudio } from '@board-games/shared/ui';
import { chipNote, playChiptune } from '@board-games/shared/ui/pixel';

export type PixelCue =
  | 'pick'
  | 'lock'
  | 'reveal'
  | 'pass'
  | 'combo'
  | 'score'
  | 'round'
  | 'dessert'
  | 'win'
  | 'lose';

/** Chiptune pack for the 8-bit sushi bar: square/triangle notes and noise, no files. */
export function pixelSounds() {
  const audio = createAudio();
  let level = 0.35;
  const chip = chipNote(audio);
  /** Cue volumes scale with the viewer's level. */
  const note = (
    from: number,
    delay = 0,
    duration = 0.07,
    volume = 0.06,
    type: OscillatorType = 'square',
    to?: number,
  ) => chip(from, delay, duration, volume * Math.min(1, level * 2.5), type, to);
  const tune = (notes: number[], step: number, last = 0.22) =>
    notes.forEach((f, i) => {
      note(f, i * step, i === notes.length - 1 ? last : step * 0.9);
      note(f / 2, i * step, step * 0.9, 0.035, 'triangle');
    });
  const cues: Record<PixelCue, () => void> = {
    pick: () => note(988, 0, 0.045, 0.05),
    lock() {
      note(660, 0, 0.05, 0.05);
      note(880, 0.06, 0.07, 0.05);
    },
    reveal: () => tune([523, 659, 784, 1047], 0.045, 0.12),
    pass() {
      for (let i = 0; i < 6; i++)
        audio.noise({
          delay: i * 0.08,
          duration: 0.04,
          volume: 0.12 * Math.min(1, level * 2.5),
          frequency: 1800 - i * 120,
          filter: 'bandpass',
          q: 3,
        });
      note(110, 0, 0.5, 0.035, 'triangle', 98);
    },
    combo() {
      playChiptune(audio, 'coin', level);
      note(1319, 0.09, 0.1, 0.04);
    },
    score: () => tune([392, 523, 659], 0.07, 0.16),
    round: () => tune([523, 523, 659, 784, 659, 784, 1047], 0.09, 0.32),
    dessert() {
      note(1568, 0, 0.05, 0.04, 'triangle');
      note(2093, 0.05, 0.05, 0.04, 'triangle');
      note(2637, 0.1, 0.12, 0.04, 'triangle');
    },
    win: () => playChiptune(audio, 'win', level),
    lose: () => playChiptune(audio, 'lose', level),
  };
  return {
    unlock: () => void audio.unlock(),
    play(cue: PixelCue, volume: number) {
      level = clamp01(volume);
      cues[cue]();
    },
    close: audio.close,
  };
}
