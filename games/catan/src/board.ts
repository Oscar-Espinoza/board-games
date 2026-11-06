import { shuffle } from '@board-games/game-core';
interface Hex {
  q: number;
  r: number;
  resource: number | null;
  number: number;
  vertices: number[];
}
export interface Board {
  hexes: Hex[];
  vertices: number[][];
  edges: number[][];
  ports: { edge: number; resource: number | null }[];
}
const corners = [
  [0, -2],
  [1, -1],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
];
export function edgeId(b: Board, a: number, c: number) {
  return b.edges.findIndex((e) => e.includes(a) && e.includes(c));
}
export function incident(b: Board, v: number) {
  return b.edges.flatMap((e, i) => (e.includes(v) ? [i] : []));
}
export function makeBoard(
  extended: boolean,
  random: () => number,
  variable = true,
): Board {
  const radius = extended ? 3 : 2,
    hexes: Hex[] = [],
    points = new Map<string, number[]>();
  for (let r = -radius; r <= radius; r++)
    for (let q = Math.max(-radius, -r - radius); q <= Math.min(2, 2 - r); q++) {
      hexes.push({ q, r, resource: null, number: 0, vertices: [] });
      corners.forEach(([x, y]) =>
        points.set(`${2 * q + r + x},${3 * r + y}`, [2 * q + r + x, 3 * r + y]),
      );
    }
  const vertices = [...points.values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  const edgesMap = new Map<string, number[]>();
  for (const h of hexes) {
    h.vertices = corners.map(([x, y]) =>
      vertices.findIndex(
        (v) => v[0] === 2 * h.q + h.r + x && v[1] === 3 * h.r + y,
      ),
    );
    for (let c = 0; c < 6; c++) {
      const e = [h.vertices[c], h.vertices[(c + 1) % 6]].sort((a, b) => a - b);
      edgesMap.set(e.join(','), e);
    }
  }
  const board: Board = {
    hexes,
    vertices,
    edges: [...edgesMap.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    ports: [],
  };
  const base = [
    [null, 0],
    [2, 8],
    [1, 11],
    [3, 6],
    [1, 3],
    [0, 4],
    [4, 9],
    [0, 10],
    [2, 5],
    [3, 12],
    [0, 11],
    [1, 5],
    [2, 2],
    [3, 9],
    [4, 4],
    [0, 8],
    [4, 6],
    [2, 3],
    [1, 10],
  ];
  const ext = [
    [3, 10],
    [1, 6],
    [null, 0],
    [3, 6],
    [2, 2],
    [4, 9],
    [3, 11],
    [0, 3],
    [4, 11],
    [0, 5],
    [2, 10],
    [1, 4],
    [null, 0],
    [1, 5],
    [2, 4],
    [4, 6],
    [1, 3],
    [2, 8],
    [0, 12],
    [4, 10],
    [1, 2],
    [3, 4],
    [0, 11],
    [0, 8],
    [2, 3],
    [0, 9],
    [2, 5],
    [3, 9],
    [1, 12],
    [4, 8],
  ];
  (extended ? ext : base).forEach(([resource, number], i) =>
    Object.assign(hexes[i], { resource, number }),
  );
  const fixedPorts = extended
    ? [
        [0, 5, null],
        [1, 0, 0],
        [2, 1, null],
        [11, 1, null],
        [17, 1, 1],
        [22, 2, 3],
        [29, 2, null],
        [28, 3, 2],
        [27, 4, null],
        [18, 4, 1],
        [7, 4, 4],
      ]
    : [
        [0, 5, null],
        [2, 5, 0],
        [2, 1, null],
        [11, 1, null],
        [15, 2, 3],
        [18, 2, 1],
        [16, 3, null],
        [12, 4, 2],
        [3, 4, 4],
      ];
  board.ports = fixedPorts.map(([h, c, resource]) => ({
    edge: edgeId(
      board,
      hexes[h!].vertices[c!],
      hexes[h!].vertices[(c! + 1) % 6],
    ),
    resource,
  }));
  if (variable) {
    const terrain = shuffle(
      hexes.map((h) => h.resource),
      random,
    );
    hexes.forEach((h, i) => {
      h.resource = terrain[i];
      h.number = 0;
    });
    const numbers = extended
      ? [
          2, 5, 4, 6, 3, 9, 8, 11, 11, 10, 6, 3, 8, 4, 8, 10, 11, 12, 10, 5, 4,
          9, 5, 9, 12, 3, 2, 6,
        ]
      : [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
    const remaining = new Set(hexes.map((_, i) => i));
    const order: number[] = [];
    while (remaining.size) {
      let current = [...remaining].sort(
        (a, b) => hexes[a].r - hexes[b].r || hexes[b].q - hexes[a].q,
      )[0];
      order.push(current);
      remaining.delete(current);
      for (const [dq, dr] of [
        [-1, 0],
        [-1, 1],
        [0, 1],
        [1, 0],
        [1, -1],
        [0, -1],
      ])
        while (true) {
          const h = hexes[current];
          const next = [...remaining].find(
            (i) => hexes[i].q === h.q + dq && hexes[i].r === h.r + dr,
          );
          if (next === undefined) break;
          current = next;
          order.push(current);
          remaining.delete(current);
        }
    }
    let ni = 0;
    for (const i of order)
      if (hexes[i].resource !== null) hexes[i].number = numbers[ni++];
    const coastal = board.edges.flatMap((e, i) =>
      hexes.filter((h) => e.every((v) => h.vertices.includes(v))).length === 1
        ? [i]
        : [],
    );
    const start = [...new Set(coastal.flatMap((i) => board.edges[i]))].sort(
      (a, b) =>
        vertices[a][1] - vertices[b][1] || vertices[a][0] - vertices[b][0],
    )[0];
    let current = start;
    const coast: number[] = [];
    do {
      const e = coastal
        .filter((i) => board.edges[i].includes(current) && !coast.includes(i))
        .sort(
          (a, b) =>
            vertices[board.edges[a].find((v) => v !== current)!][0] -
            vertices[board.edges[b].find((v) => v !== current)!][0],
        )[0];
      coast.push(e);
      current = board.edges[e].find((v) => v !== current)!;
    } while (current !== start);
    const sections: { length: number; ports: [number, number | null][] }[] = [
      {
        length: 5,
        ports: [
          [0, null],
          [3, 0],
        ],
      },
      { length: 5, ports: [[1, null]] },
      {
        length: 5,
        ports: [
          [0, null],
          [3, 3],
        ],
      },
      { length: 5, ports: [[1, 1]] },
      {
        length: 5,
        ports: [
          [0, null],
          [3, 2],
        ],
      },
      { length: 5, ports: [[1, 4]] },
      { length: 2, ports: [] },
      { length: 2, ports: [] },
      { length: 2, ports: [[0, null]] },
      { length: 2, ports: [[0, 1]] },
    ];
    let offset = 0;
    board.ports = [];
    for (const section of shuffle(
      sections.slice(0, extended ? 10 : 6),
      random,
    )) {
      for (const [position, resource] of section.ports)
        board.ports.push({ edge: coast[offset + position], resource });
      offset += section.length;
    }
  }
  return board;
}
