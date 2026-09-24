/** Pip spots in one half: [along the tile's length, across it], each 0–2. */
export const SPOTS: [number, number][][] = [
  [],
  [[1, 1]],
  [
    [0, 0],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
];
