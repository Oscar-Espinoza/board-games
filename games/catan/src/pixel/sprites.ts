import { shade } from '../table/artwork.js';
import { gold, ink } from '../table/shapes.js';

/**
 * Hand-pixelled player pieces and the robber. At 10–17 art pixels a generated
 * render turns to mush, so these are drawn cell by cell and recoloured per seat.
 * Keys: k ink, h highlight, b body, s shadow, L wall light, m wall, d door, y lit window/eyes.
 */
const art = {
  settlement: [
    '.......k.......',
    '......khk......',
    '.....khhbk.....',
    '....khhbbbk....',
    '...khhbbbbsk...',
    '..khhbbbbbbsk..',
    '.khhbbbbbbbbsk.',
    'khbbbbbbbbbbbsk',
    'kkkkkkkkkkkkkkk',
    '.kLmmmmmmmmmsk.',
    '.kLkkkmkkkmmsk.',
    '.kLkykmkdkmmsk.',
    '.kLkkkmkdkmmsk.',
    '.kLmmmmkdkmmsk.',
    '.kkkkkkkkkkkkk.',
  ],
  city: [
    '...k................',
    '..khk...............',
    '..khk...............',
    '.khbsk..............',
    '.khbsk......k.......',
    'khbbbsk....khk......',
    'khbbbsk...khhbk.....',
    'kkkkkkk..khhbbbk....',
    'kLmmmsk.khhbbbbsk...',
    'kLkkkskkhhbbbbbbsk..',
    'kLkykskhhbbbbbbbbsk.',
    'kLkkkskbbbbbbbbbbbsk',
    'kLmmmskkkkkkkkkkkkkk',
    'kLmmmskLmmmmmmmmmsk.',
    'kLkkkskLkkkmkkkmmsk.',
    'kLkykskLkykmkdkmmsk.',
    'kLkkkskLkkkmkdkmmsk.',
    'kLmmmskLmmmmkdkmmsk.',
    'kkkkkkkkkkkkkkkkkkk.',
  ],
  robber: [
    '.....kkkkk.....',
    '....khhbbbk....',
    '...khhbbbbsk...',
    '..khhbbbbbbsk..',
    '..khbkkkkkbsk..',
    '..khkkykykksk..',
    '..khbkkkkkbsk..',
    '...kbbbbbbsk...',
    '....kbbbbsk....',
    '...khbbbbbsk...',
    '..khbbbbbbbsk..',
    '..khbbbbbbbsk..',
    '.khbbbbbbbbbsk.',
    '.khbbbbbbbbbsk.',
    '.khbbbbbbbbbsk.',
    'khbbbbbbbbbbbsk',
    'khhbbbbbbbbbssk',
    'kkkkkkkkkkkkkkk',
  ],
};
export type SpriteName = keyof typeof art;

/** One path of merged horizontal runs per colour key, in art pixels (scale when drawing). */
function layers(rows: string[]) {
  const paths: Record<string, string> = {};
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const key = row[x];
      let end = x;
      while (row[end + 1] === key) end++;
      if (key !== '.')
        paths[key] =
          (paths[key] ?? '') + `M${x} ${y}h${end - x + 1}v1h${-(end - x + 1)}z`;
      x = end + 1;
    }
  });
  return Object.entries(paths).map(([key, d]) => ({ key, d }));
}

export const sprites = Object.fromEntries(
  Object.entries(art).map(([name, rows]) => [
    name,
    { w: rows[0].length, h: rows.length, layers: layers(rows) },
  ]),
) as Record<
  SpriteName,
  { w: number; h: number; layers: { key: string; d: string }[] }
>;

export function ramp(color: string): Record<string, string> {
  return {
    k: ink,
    h: shade(color, 1.4),
    b: color,
    s: shade(color, 0.62),
    L: shade(color, 1.15),
    m: shade(color, 0.86),
    d: shade(color, 0.4),
    y: gold,
  };
}
export const robberRamp: Record<string, string> = {
  k: ink,
  h: '#7a766f',
  b: '#4a4744',
  s: '#2c2a28',
  y: '#ffd84a',
};
