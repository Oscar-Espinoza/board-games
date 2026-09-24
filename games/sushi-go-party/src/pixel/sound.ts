import { createAudio } from '@board-games/shared/ui';
import { playChiptune } from '@board-games/shared/ui/pixel';

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
  const note = (
    from: number,
    delay = 0,
    duration = 0.07,
    volume = 0.06,
    type: OscillatorType = 'square',
    to?: number,
  ) =>
    audio.tone({
      from,
      to,
      delay,
      duration,
      volume: volume * Math.min(1, level * 2.5),
      type,
      attack: 0.002,
    });
  const tune = (notes: number[], step: number, last = 0.22) =>
    notes.forEach((f, i) => {
      note(f, i * step, i === notes.length - 1 ? last : step * 0.9);
      note(f / 2, i * step, step * 0.9, 0.035, 'triangle');
    });
  const cues: Record<PixelCue, () => void> = {
    // A chopstick "pip" when a dish is chosen from the hand.
    pick: () => note(988, 0, 0.045, 0.05),
    // Two quick notes as the dish is kept face down.
    lock() {
      note(660, 0, 0.05, 0.05);
      note(880, 0.06, 0.07, 0.05);
    },
    // Everyone flips: a rising sparkle arpeggio.
    reveal: () => tune([523, 659, 784, 1047], 0.045, 0.12),
    // The conveyor belt clatters round: ticking noise over a low hum.
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
    // A set is complete (tempura pair, sashimi trio, wasabi nigiri...).
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
      level = Math.max(0, Math.min(1, volume));
      cues[cue]();
    },
    close: audio.close,
  };
}
