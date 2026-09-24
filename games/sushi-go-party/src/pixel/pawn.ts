/** A 10×13 pixel pawn: a little rice-ball buddy tinted in the seat colour. */
const grid = [
  '...####...',
  '..#cccc#..',
  '.#hccccc#.',
  '.#ceccec#.',
  '.#cccccc#.',
  '..#cccc#..',
  '..#cccc#..',
  '.#hcccdc#.',
  '#hccccccd#',
  '#cccccccd#',
  '#dddddddd#',
  '.########.',
  '..ssssss..',
];
function path(chars: string) {
  let d = '';
  grid.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (chars.includes(c)) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return d;
}
export const pawnPaths = {
  body: path('chd'),
  light: path('h'),
  dark: path('d'),
  ink: path('#e'),
  shadow: path('s'),
};
