/** The 8-bit table's characters, one per game seat. */
export const CAST = ['luis', 'maria', 'carlos', 'roberto'];
/** Every image the 8-bit table loads: the patio and the cat, then each character. */
export const PIXEL_ART = [
  'patio',
  'cat',
  ...CAST.flatMap((who) => [`${who}-front`, `${who}-side`]),
];
