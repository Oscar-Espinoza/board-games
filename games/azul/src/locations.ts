import type { Color } from './index.js';

/**
 * Where a tile travels from and to. Rules events carry these ids; the table renders each
 * as a `data-azul-location` anchor and presentation measures them to fly tiles.
 * `/` separates segments, so player ids must not contain it.
 */
export type Location =
  | { kind: 'bag' }
  | { kind: 'discard' }
  | { kind: 'factory'; factory: number; slot: number }
  | { kind: 'center'; color: Color | 'marker'; slot?: number }
  | { kind: 'pattern'; player: string; row: number; slot: number }
  | { kind: 'wall'; player: string; row: number; column: number }
  | { kind: 'floor'; player: string; slot: number }
  | { kind: 'marker'; player: string }
  | { kind: 'summary'; player: string };

export const bag = 'bag';
export const discard = 'discard';
export const centerMarker = 'center/marker';
export const factorySlot = (factory: number, slot: number) =>
  `factory/${factory}/${slot}`;
/** The centre pile of one colour; `centerTile` addresses one tile in it. */
export const centerPile = (color: Color) => `center/${color}`;
export const centerTile = (color: Color, slot: number) =>
  `center/${color}/${slot}`;
export const patternSlot = (player: string, row: number, slot: number) =>
  `${player}/pattern/${row}/${slot}`;
export const wallCell = (player: string, row: number, column: number) =>
  `${player}/wall/${row}/${column}`;
export const floorSlot = (player: string, slot: number) =>
  `${player}/floor/${slot}`;
export const markerSpot = (player: string) => `${player}/marker`;
export const summary = (player: string) => `${player}/summary`;

export function parseLocation(id: string): Location {
  if (id === bag) return { kind: 'bag' };
  if (id === discard) return { kind: 'discard' };
  const [first, second, third, fourth] = id.split('/');
  if (first === 'factory')
    return { kind: 'factory', factory: Number(second), slot: Number(third) };
  if (first === 'center')
    return {
      kind: 'center',
      color: second as Color | 'marker',
      slot: third === undefined ? undefined : Number(third),
    };
  if (second === 'pattern')
    return {
      kind: 'pattern',
      player: first,
      row: Number(third),
      slot: Number(fourth),
    };
  if (second === 'wall')
    return {
      kind: 'wall',
      player: first,
      row: Number(third),
      column: Number(fourth),
    };
  if (second === 'floor')
    return { kind: 'floor', player: first, slot: Number(third) };
  if (second === 'summary') return { kind: 'summary', player: first };
  return { kind: 'marker', player: first };
}
