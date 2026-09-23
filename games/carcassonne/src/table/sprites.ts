// Codex-generated standing sprites (docs/carcassonne-3d). Width is in tile
// units (a tile is 100); images sit bottom-centred in a square box.
export const spriteRoot = '/games/carcassonne/sprites/';
export const sprites: Record<string, { width: number; sway?: boolean }> = {
  'houses-a': { width: 31 },
  'houses-b': { width: 30 },
  'houses-c': { width: 32 },
  'houses-d': { width: 26 },
  'house-single-a': { width: 18 },
  'house-single-b': { width: 14 },
  'tower-round': { width: 12 },
  'tower-square': { width: 13 },
  gatehouse: { width: 22 },
  keep: { width: 66 },
  cathedral: { width: 48 },
  monastery: { width: 56 },
  'trees-a': { width: 24, sway: true },
  'trees-b': { width: 17, sway: true },
  'trees-c': { width: 20, sway: true },
  bush: { width: 9, sway: true },
  'sheep-a': { width: 7 },
  'sheep-b': { width: 7 },
  windmill: { width: 32 },
  haystack: { width: 9 },
};
/** Props hidden when zoomed far out, to keep large boards cheap to paint. */
export const small = new Set(['bush', 'sheep-a', 'sheep-b', 'haystack']);
