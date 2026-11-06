import type { Result } from './types.js';

/** Honoured in a result: a match winner, or else whoever scored this mission. */
export const awarded = (result: Result, player: string) =>
  result.winners.length
    ? result.winners.includes(player)
    : result.points[player]! > 0;
