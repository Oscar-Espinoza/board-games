import type { Audio } from '@board-games/shared/ui';
import { chipNote, playChiptune } from '@board-games/shared/ui/pixel';

export type PixelCue =
  | 'select'
  | 'clue'
  | 'turn'
  | 'vote'
  | 'reveal'
  | 'open'
  | 'caught'
  | 'escaped'
  | 'deal'
  | 'win'
  | 'lose';

/** Chiptune pack for the 8-bit table: square/triangle tones, noise and ZzFX cues, no files. */
export function chiptune(audio: Audio) {
  const note = chipNote(audio);
  const tune = (notes: number[], step: number, last = 0.28, volume = 0.05) =>
    notes.forEach((f, i) => {
      note(f, i * step, i === notes.length - 1 ? last : step, volume);
      note(f / 2, i * step, step, volume * 0.7, 'triangle');
    });
  const cues: Record<PixelCue, () => void> = {
    select: () => note(1046, 0, 0.04, 0.04),
    clue() {
      for (const delay of [0, 0.07, 0.14])
        audio.noise({
          delay,
          duration: 0.03,
          volume: 0.18,
          frequency: 2600,
          filter: 'bandpass',
          q: 2,
        });
      note(1568, 0.24, 0.16, 0.04, 'triangle');
    },
    turn() {
      note(784, 0, 0.07, 0.045);
      note(1175, 0.09, 0.12, 0.045);
    },
    vote: () => playChiptune(audio, 'stamp', 0.9),
    reveal() {
      audio.noise({
        duration: 0.12,
        volume: 0.12,
        frequency: 5000,
        sweep: 1500,
        q: 0.8,
      });
      tune([392, 523, 659, 784], 0.06, 0.16, 0.04);
    },
    open() {
      audio.noise({ duration: 0.09, volume: 0.1, frequency: 4200, q: 0.8 });
      note(880, 0.05, 0.06, 0.035, 'triangle');
    },
    caught() {
      playChiptune(audio, 'stamp', 1);
      tune([659, 622, 587, 554], 0.09, 0.3, 0.045);
    },
    escaped() {
      [220, 262, 311, 370, 440].forEach((f, i) =>
        note(f, i * 0.1, 0.05, 0.05, i % 2 ? 'square' : 'triangle'),
      );
    },
    deal() {
      for (let i = 0; i < 4; i++)
        audio.noise({
          delay: i * 0.05,
          duration: 0.04,
          volume: 0.12,
          frequency: 3200,
          q: 1,
        });
    },
    win() {
      playChiptune(audio, 'win', 0.8);
      tune([523, 659, 784, 1047, 784, 1047], 0.1, 0.36, 0.045);
    },
    lose: () => tune([523, 440, 349, 262], 0.13, 0.4, 0.045),
  };
  return (cue: PixelCue) => {
    if (audio.ready) cues[cue]();
  };
}
