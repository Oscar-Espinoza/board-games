import type { Audio } from '@board-games/shared/ui';
import { playChiptune } from '@board-games/shared/ui/pixel';

export type Cue =
  | 'play'
  | 'draw'
  | 'skip'
  | 'reverse'
  | 'hit2'
  | 'hit4'
  | 'wild'
  | 'uno'
  | 'turn'
  | 'win'
  | 'lose';

/** Chiptune cues for the 8-bit table: square and triangle voices plus noise, no files. */
export function chiptune(audio: Audio) {
  const note = (
    from: number,
    delay = 0,
    duration = 0.08,
    volume = 0.06,
    type: OscillatorType = 'square',
    to?: number,
  ) => audio.tone({ from, to, delay, duration, volume, type, attack: 0.002 });
  const run = (notes: number[], gap: number, length = gap, volume = 0.05) =>
    notes.forEach((f, i) => note(f, i * gap, length, volume));
  const thud = (delay = 0, volume = 0.2) =>
    audio.noise({
      delay,
      duration: 0.12,
      volume,
      frequency: 700,
      sweep: 160,
      filter: 'lowpass',
    });
  const cues: Record<Cue, () => void> = {
    // A card slaps the pile: a falling blip and a soft tick.
    play() {
      note(784, 0, 0.05, 0.05, 'square', 392);
      audio.noise({ duration: 0.04, volume: 0.07, frequency: 2600, q: 1 });
    },
    // Pulled from the stock: a quick rising blip.
    draw: () => note(330, 0, 0.07, 0.045, 'triangle', 880),
    // Bonk: two descending hits.
    skip() {
      note(523, 0, 0.07, 0.06);
      note(196, 0.08, 0.16, 0.06, 'square', 131);
      thud(0.08, 0.12);
    },
    // Whoosh round the table: up, then back down.
    reverse() {
      note(262, 0, 0.12, 0.05, 'square', 1047);
      note(1047, 0.12, 0.12, 0.05, 'square', 262);
      audio.noise({
        duration: 0.24,
        volume: 0.06,
        frequency: 600,
        sweep: 3200,
        q: 2,
      });
    },
    // +2: a heavy crunch. +4 lands twice as hard.
    hit2() {
      note(220, 0, 0.22, 0.08, 'square', 55);
      thud(0, 0.3);
      run([880, 988], 0.06, 0.05, 0.04);
    },
    hit4() {
      note(165, 0, 0.3, 0.09, 'square', 41);
      thud(0, 0.4);
      thud(0.12, 0.25);
      run([880, 988, 1175, 1319], 0.05, 0.05, 0.04);
    },
    // A new colour: a sparkling rainbow arpeggio.
    wild() {
      run([523, 659, 784, 1047, 1319, 1568], 0.04, 0.06, 0.04);
      playChiptune(audio, 'coin', 0.5);
    },
    // "U-NO!": a two-note fanfare with a bright tail.
    uno() {
      note(659, 0, 0.1, 0.06);
      note(880, 0.11, 0.1, 0.06);
      note(1319, 0.22, 0.28, 0.06, 'square', 1397);
      note(330, 0, 0.36, 0.05, 'triangle');
    },
    turn() {
      note(660, 0, 0.06, 0.04);
      note(990, 0.07, 0.09, 0.04);
    },
    win() {
      const tune = [523, 659, 784, 1047, 784, 1047, 1319];
      tune.forEach((f, i) =>
        note(f, i * 0.1, i === tune.length - 1 ? 0.4 : 0.09, 0.055),
      );
      tune.forEach((f, i) => note(f / 2, i * 0.1, 0.09, 0.04, 'triangle'));
    },
    lose() {
      const tune = [523, 494, 466, 440];
      tune.forEach((f, i) =>
        note(f, i * 0.2, i === tune.length - 1 ? 0.6 : 0.18, 0.05, 'square'),
      );
      note(110, 0.6, 0.6, 0.05, 'triangle', 82);
    },
  };
  return (cue: Cue) => cues[cue]();
}
