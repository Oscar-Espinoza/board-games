/** Game artwork only; the catalog cover intentionally has its own palette. */
export const palette = {
  blue: { glaze: '#1766a0', motif: '#c9e5f4' },
  yellow: { glaze: '#edb737', motif: '#7d5015' },
  red: { glaze: '#ae4235', motif: '#ffddbb' },
  black: { glaze: '#24313b', motif: '#d6b893' },
  white: { glaze: '#faf2da', motif: '#368c9e' },
  marker: { glaze: '#f5e8c9', motif: '#15364c' },
} as const;

/** Optimized browser artwork for the approved Rich & Dramatic table. */
export const richTileArtwork = {
  blue: '/games/azul/rich/tile-blue.webp',
  yellow: '/games/azul/rich/tile-yellow.webp',
  red: '/games/azul/rich/tile-red.webp',
  black: '/games/azul/rich/tile-black.webp',
  white: '/games/azul/rich/tile-white.webp',
} as const;
