// Tiny hand-set pixel symbols for the 8-bit tiles (drawn 1:1 on the 128px sprite grid).
// '.' is transparent; every other letter is a palette entry.
export const palette: Record<string, string> = {
  k: '#22160e',
  b: '#2c5983',
  B: '#5b8fc8',
  y: '#d9a23a',
  Y: '#ffe08a',
  o: '#7a4a28',
  O: '#c08a50',
  p: '#5c3f78',
  P: '#a77fcf',
  w: '#f6ead0',
  g: '#3d7a33',
  G: '#86c050',
  r: '#a3302a',
  R: '#e0664a',
  s: '#8f866d',
  S: '#e2dabd',
};
export const bitmaps: Record<string, string[]> = {
  shield: [
    'kkkkkkkkk',
    'kbBbYbBbk',
    'kbbbYbbbk',
    'kYYYYYYYk',
    'kbbbYbbbk',
    'kbbbYbbbk',
    '.kbbYbbk.',
    '.kkbYbkk.',
    '..kkYkk..',
    '...kkk...',
  ],
  wine: [
    '..kkk..',
    '..kPk..',
    '.kkPkk.',
    'kPPppPk',
    'kPppppk',
    'kppppPk',
    'kppppPk',
    '.kpppk.',
    '..kkk..',
  ],
  grain: [
    '.k.k.k.',
    'kYkYkYk',
    'kyYyYyk',
    '.kyyyk.',
    '..kyk..',
    '.kokok.',
    'kyyyyyk',
    '.kyYyk.',
    '..kkk..',
  ],
  cloth: [
    '.kkkkkkk.',
    'kBBBBBBBk',
    'kbbbbbbbk',
    'kBBBBBBBk',
    'kbbbbbbbk',
    'kBBBBBBBk',
    '.kkkkkkk.',
  ],
  gold: [
    '...kkkkk...',
    '..kYYYYYk..',
    '.kYYyyyyyk.',
    'kyyyyyyyyyk',
    'koooooooook',
    '.kkkkkkkkk.',
  ],
  magic: [
    '...k...',
    '..kPk..',
    '..kPk..',
    '.kPppk.',
    '.kPppk.',
    'kPpppPk',
    'kPpppPk',
    '.kpppk.',
    '.kpppk.',
    '..kpk..',
    '...k...',
  ],
  robber: [
    '...kkk...',
    '..kOk....',
    '...kOk...',
    '..kOOOk..',
    '.kOOoOOk.',
    'kOOooOOok',
    'kOoooooOk',
    '.kOoooOk.',
    '..kkkkk..',
  ],
  flight: [
    'kk.......kk',
    'kOk.....kOk',
    '.kOk...kOk.',
    '..kOk.kOk..',
    '...kOkOk...',
    '....kyk....',
    '...kOkOk...',
    '..kOk.kOk..',
    '.kOk...kOk.',
    'kOk.....kOk',
    'kk.......kk',
  ],
  crop: [
    '....kkkkk....',
    '..kkYYYYYkk..',
    '.kYYkkkkkYYk.',
    '.kYk.....kYk.',
    'kYk.......kYk',
    'kYk..kkk..kYk',
    'kYk..kxk..kYk',
    'kYk..kkk..kYk',
    'kYk.......kYk',
    '.kYk.....kYk.',
    '.kYYkkkkkYYk.',
    '..kkYYYYYkk..',
    '....kkkkk....',
  ],
};

/** Draws a bitmap with `k`×`k` rects at (x, y), top-left. `x` letters use `accent`. */
export function stamp(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  accent = '#3d7a33',
  k = 1,
) {
  const rows = bitmaps[name];
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const c = rows[j][i];
      if (c === '.') continue;
      ctx.fillStyle = c === 'x' ? accent : palette[c];
      ctx.fillRect(x + i * k, y + j * k, k, k);
    }
}
export const bitmapSize = (name: string) => ({
  w: bitmaps[name][0].length,
  h: bitmaps[name].length,
});
