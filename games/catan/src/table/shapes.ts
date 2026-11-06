/** Island coordinates and the shapes the classic table and its effects both draw. */
export const ink = '#1a0f08';
export const gold = '#f2c14e';
/** Board units per hex-grid step: vertices and hex centres are `coordinate * tile`. */
export const tileX = 50,
  tileY = 26.75;
export const settlementPath = 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z';
export const cityPath = 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z';
export const buildingPath = (city: boolean) =>
  city ? cityPath : settlementPath;
export const hexCenter = (h: { q: number; r: number }): [number, number] => [
  (2 * h.q + h.r) * tileX,
  3 * h.r * tileY,
];
