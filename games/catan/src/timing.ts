import type { PresentationEvent } from './presentation.js';

/** How hard the roller threw, 0..1; every cue and effect of a roll reads it from here. */
export const rollStrength = (events: PresentationEvent[]) => {
  const roll = events.find((e) => e.type === 'roll');
  return roll?.type === 'roll' ? (roll.strength ?? 0) : 0;
};

/** Milliseconds from the throw until the nth production token starts to fly. */
export const deliveryDelay = (rollDuration: number, index: number) =>
  rollDuration + 300 + index * 700;
/** Milliseconds after a token starts flying until its seat glows. */
export const GLOW_DELAY = 1400;
