import { tiles } from './tiles.js';
import type { Region } from './tiles.js';
const endpoints = [
  [50, 0],
  [100, 50],
  [50, 100],
  [0, 50],
];
export function roadPath(r: Region) {
  if (!r.ports.length)
    return `M${r.anchor[0] - 4},${r.anchor[1] - 3}L${r.anchor[0] + 4},${r.anchor[1] + 3}`;
  const a = endpoints[r.ports[0]];
  if (r.ports.length === 1) return `M${a} Q50,50 50,50`;
  if (r.ports.length === 2 && Math.abs(r.ports[0] - r.ports[1]) === 2)
    return r.ports.includes(0)
      ? 'M50 0C50 20 60 30 54 50S44 80 50 100'
      : 'M0 50C20 50 30 60 50 54S80 44 100 50';
  if (r.ports.length === 2) return `M${a} Q50,50 ${endpoints[r.ports[1]]}`;
  return r.ports.map((p) => `M${endpoints[p]} L50,50`).join(' ');
}
export function cityPath(r: Region) {
  const p = r.ports;
  if (p.length === 4) return 'M0,0H100V100H0Z';
  if (p.length === 1)
    return [
      'M0,0H100Q95,35 50,29Q5,35 0,0Z',
      'M100,0V100Q65,95 71,50Q65,5 100,0Z',
      'M100,100H0Q5,65 50,71Q95,65 100,100Z',
      'M0,100V0Q35,5 29,50Q35,95 0,100Z',
    ][p[0]];
  if (p.length === 2 && p.includes((p[0] + 2) % 4))
    return p.includes(0)
      ? 'M0,0H100Q61,50 100,100H0Q39,50 0,0Z'
      : 'M0,0Q50,39 100,0V100Q50,61 0,100Z';
  if (p.length === 3) {
    const missing = [0, 1, 2, 3].find((i) => !p.includes(i))!;
    return [
      'M0,0Q50,55 100,0V100H0Z',
      'M100,0Q45,50 100,100H0V0Z',
      'M100,100Q50,45 0,100V0H100Z',
      'M0,100Q55,50 0,0H100V100Z',
    ][missing];
  }
  const start = p.find((e) => p.includes((e + 1) % 4))!;
  return [
    'M0,0H100V100Q58,42 0,0Z',
    'M100,0V100H0Q58,58 100,0Z',
    'M100,100H0V0Q42,58 100,100Z',
    'M0,100V0H100Q42,42 0,100Z',
  ][start];
}
export const meeplePath =
  'M-4,-6A5,5 0 1 1 4,-6L11,1Q12,4 8,5L5,3L7,13H1L0,7L-1,13H-7L-5,3L-8,5Q-12,4 -11,1Z';
export const colors = [
  '#a93625',
  '#22559b',
  '#487934',
  '#d5a725',
  '#e9e0c9',
  '#353d42',
];
/** Highlight the meadow's actual edge portions; roads and city walls remain readable. */
export function fieldPath(r: Region) {
  const sectors = [
    'M0 0H50L50 50Z',
    'M50 0H100L50 50Z',
    'M100 0V50L50 50Z',
    'M100 50V100L50 50Z',
    'M100 100H50L50 50Z',
    'M50 100H0L50 50Z',
    'M0 100V50L50 50Z',
    'M0 50V0L50 50Z',
  ];
  return r.ports.length
    ? r.ports.map((p) => sectors[p]).join(' ')
    : 'M35 35H65V65H35Z';
}
export function ferryPath(id: string, pair: [string, string]) {
  const positions = [
    [50, 28],
    [72, 50],
    [50, 72],
    [28, 50],
  ];
  const ends = pair.map(
    (ref) => positions[tiles[id].regions.find((r) => r.id === ref)!.ports[0]],
  );
  return `M${ends[0]}Q50,50 ${ends[1]}`;
}
