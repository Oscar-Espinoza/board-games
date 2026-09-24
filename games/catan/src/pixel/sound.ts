import type { Audio } from '@board-games/shared/ui';
import { playChiptune } from '@board-games/shared/ui/pixel';
import type { PresentationEvent } from '../presentation.js';

/** Chiptune cues for the 8-bit skin: square/triangle tones and noise, no files. */
export function chiptune(audio: Audio) {
  const note = (
    from: number,
    delay = 0,
    duration = 0.08,
    volume = 0.06,
    type: OscillatorType = 'square',
    to?: number,
  ) => audio.tone({ from, to, delay, duration, volume, type, attack: 0.002 });
  const crunch = (delay: number, volume: number, frequency: number) =>
    audio.noise({
      delay,
      duration: 0.07,
      volume,
      frequency,
      filter: 'lowpass',
      q: 0.8,
    });
  const tune = (notes: number[], step: number, delay = 0, volume = 0.055) =>
    notes.forEach((f, i) => {
      note(
        f,
        delay + i * step,
        i === notes.length - 1 ? step * 3 : step,
        volume,
      );
      note(f / 2, delay + i * step, step, volume * 0.7, 'triangle');
    });
  const cues = {
    /** Dice rattle in the cup, then two clacks as they land. */
    roll(strength: number, landing: number) {
      const shakes = 5 + Math.round(strength * 4);
      for (let i = 0; i < shakes; i++) {
        crunch(i * 0.055, 0.09, 2600 + (i % 2) * 900);
        note(700 + (i % 3) * 130, i * 0.055, 0.03, 0.03);
      }
      for (const [i, at] of [landing - 0.09, landing].entries()) {
        crunch(at, 0.16, 1500);
        note(330 - i * 60, at, 0.05, 0.05, 'triangle');
      }
    },
    /** A coin pick-up per delivery, rising with each resource. */
    gain(delay: number, index: number) {
      note(988 + index * 60, delay, 0.05, 0.045);
      note(1319 + index * 80, delay + 0.06, 0.12, 0.045);
    },
    build(piece: 'road' | 'settlement' | 'city') {
      const weight = piece === 'road' ? 0 : piece === 'settlement' ? 1 : 2;
      // Falling whistle, crunchy landing, then a short "built" chime.
      note(1200 - weight * 200, 0, 0.14, 0.03, 'square', 300);
      crunch(0.14, 0.2 + weight * 0.08, 900 - weight * 200);
      note(110 - weight * 20, 0.14, 0.16, 0.08, 'triangle', 45);
      tune(
        [
          [523, 659],
          [523, 659, 784],
          [392, 523, 659, 784, 1047],
        ][weight],
        0.06,
        0.26,
        0.045,
      );
    },
    trade() {
      note(784, 0, 0.06, 0.045);
      note(587, 0.07, 0.06, 0.045);
      note(784, 0.14, 0.06, 0.045);
      note(988, 0.21, 0.14, 0.045);
    },
    robber() {
      // Sneaky descending minor steps and a thud.
      [392, 370, 311, 233].forEach((f, i) =>
        note(f, i * 0.11, 0.1, 0.05, 'square'),
      );
      note(98, 0.46, 0.25, 0.09, 'triangle', 49);
      crunch(0.46, 0.18, 500);
    },
    theft() {
      note(1400, 0, 0.05, 0.035, 'square', 700);
      note(1200, 0.07, 0.05, 0.035, 'square', 500);
    },
    card(kind: string) {
      if (kind === 'purchase') {
        // A card flip: quick noise swish and two blips.
        audio.noise({
          duration: 0.09,
          volume: 0.06,
          frequency: 5000,
          sweep: 1500,
          q: 0.8,
        });
        note(880, 0.05, 0.05, 0.04);
        note(1175, 0.11, 0.09, 0.04);
      } else if (kind === 'KNIGHT') tune([392, 392, 523, 659], 0.08);
      else tune([659, 784, 988, 1175], 0.06);
    },
    award() {
      tune([523, 659, 784, 659, 784, 1047], 0.08);
    },
    win() {
      tune([523, 523, 523, 415, 466, 523, 466, 523], 0.1, 0, 0.06);
      playChiptune(audio, 'win', 0.8);
    },
    turn() {
      note(660, 0, 0.06, 0.035);
      note(990, 0.07, 0.09, 0.035);
    },
    reject() {
      note(196, 0, 0.09, 0.06, 'square', 150);
      note(147, 0.1, 0.14, 0.06, 'square', 110);
    },
  };
  return {
    ...cues,
    /** One cue per accepted event batch; production coins land with the tokens. */
    play(events: PresentationEvent[], player: string, rollDuration: number) {
      const roll = events.find((e) => e.type === 'roll');
      const placement = events.find((e) => e.type === 'placement');
      const card = events.find((e) => e.type === 'card');
      const win = events.some((e) => e.type === 'win');
      if (roll?.type === 'roll')
        cues.roll(roll.strength ?? 0, rollDuration / 1000);
      let delivery = 0;
      for (const event of events)
        if (event.type === 'transfer' && event.reason === 'production') {
          const at = rollDuration / 1000 + 0.3 + delivery++ * 0.7 + 1.4;
          if (event.to === player) cues.gain(at, delivery);
        }
      if (placement?.type === 'placement') cues.build(placement.piece);
      if (events.some((e) => e.type === 'robber')) cues.robber();
      if (
        events.some(
          (e) =>
            e.type === 'transfer' &&
            (e.reason === 'theft' || e.reason === 'monopoly'),
        )
      )
        cues.theft();
      if (
        events.some((e) => e.type === 'transfer' && e.reason === 'trade') &&
        !placement
      )
        cues.trade();
      if (card?.type === 'card') cues.card(card.kind);
      if (win) cues.win();
      else if (events.some((e) => e.type === 'award')) cues.award();
      else if (
        !roll &&
        !placement &&
        !card &&
        events.some((e) => e.type === 'turn')
      )
        cues.turn();
    },
  };
}
