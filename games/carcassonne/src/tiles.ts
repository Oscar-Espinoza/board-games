/** Big Box 3.1, English booklet pp. 22–23. Ports run clockwise N,E,S,W.
 * Field half-edges run 0..7; across an edge their order reverses.
 * Decorations never create logical connections. */
export const modules = [
  'river',
  'abbot',
  'inns',
  'traders',
  'flight',
  'messages',
  'ferries',
  'gold',
  'magic',
  'robbers',
  'crops',
] as const;
export type Module = (typeof modules)[number];
export type Kind = 'city' | 'road' | 'field' | 'monastery' | 'garden' | 'river';
export type Region = {
  id: string;
  kind: Kind;
  ports: number[];
  cities: string[];
  anchor: [number, number];
  shields: number;
  goods: number[];
  inn: boolean;
  cathedral: boolean;
};
export type Tile = {
  id: string;
  module: Module | 'base';
  quantity: number;
  edges: string;
  regions: Region[];
  flight?: [number, number];
  gold?: boolean;
  magic?: boolean;
  robber?: boolean;
  crop?: Kind;
  ferry?: boolean;
  source?: boolean;
  lake?: boolean;
};
type Options = {
  shields?: number[];
  goods?: number[][];
  inns?: number[];
  cathedral?: boolean;
  monastery?: boolean;
  garden?: boolean;
  fields?: number[][];
  river?: number[];
  flight?: [number, number];
  gold?: boolean;
  magic?: boolean;
  robber?: boolean;
  crop?: Kind;
  ferry?: boolean;
  source?: boolean;
  lake?: boolean;
};
const anchors: [number, number][] = [
  [28, 12],
  [72, 12],
  [88, 28],
  [88, 72],
  [72, 88],
  [28, 88],
  [12, 72],
  [12, 28],
];
const edgeAnchors: [number, number][] = [
  [50, 18],
  [82, 50],
  [50, 82],
  [18, 50],
];
export const tiles: Record<string, Tile> = {};
function add(
  id: string,
  module: Tile['module'],
  quantity: number,
  cities: number[][],
  roads: number[][],
  o: Options = {},
) {
  const edges = ['F', 'F', 'F', 'F'];
  cities.flat().forEach((e) => (edges[e] = 'C'));
  roads.flat().forEach((e) => (edges[e] = 'R'));
  o.river?.forEach((e) => (edges[e] = 'V'));
  const regions: Region[] = [];
  const region = (
    kind: Kind,
    ports: number[],
    i: number,
    anchor: [number, number],
  ): Region =>
    ({
      id: (kind === 'river' ? 'v' : kind[0]) + i,
      kind,
      ports,
      cities: [],
      anchor,
      shields: 0,
      goods: [0, 0, 0],
      inn: false,
      cathedral: false,
    }) satisfies Region;
  cities.forEach((ports, i) =>
    regions.push({
      ...region(
        'city',
        ports,
        i,
        ports.length === 4
          ? [50, 50]
          : [
              ports.reduce((s, e) => s + edgeAnchors[e][0], 0) / ports.length,
              ports.reduce((s, e) => s + edgeAnchors[e][1], 0) / ports.length,
            ],
      ),
      shields: o.shields?.[i] ?? 0,
      goods: o.goods?.[i] ?? [0, 0, 0],
      cathedral: !!o.cathedral,
    }),
  );
  roads.forEach((ports, i) =>
    regions.push({
      ...region(
        'road',
        ports,
        i,
        ports.length === 1
          ? edgeAnchors[ports[0]]
          : [
              ports.reduce((s, e) => s + edgeAnchors[e][0], 0) / ports.length,
              ports.reduce((s, e) => s + edgeAnchors[e][1], 0) / ports.length,
            ],
      ),
      inn: o.inns?.includes(i) ?? false,
    }),
  );
  if (o.river) regions.push(region('river', o.river, 0, [50, 50]));
  // Perimeter arcs are separated by through roads, river banks and city walls.
  const present = Array.from({ length: 8 }, (_, i) => i).filter(
    (i) => edges[Math.floor(i / 2)] !== 'C',
  );
  const groups: number[][] = [];
  const seen = new Set<number>();
  for (const p of present) {
    if (seen.has(p)) continue;
    const group: number[] = [];
    const queue = [p];
    while (queue.length) {
      const v = queue.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      group.push(v);
      for (const w of [(v + 7) % 8, (v + 1) % 8]) {
        if (!present.includes(w)) continue;
        const sameSide = Math.floor(v / 2) === Math.floor(w / 2);
        if (!sameSide || edges[Math.floor(v / 2)] === 'F') queue.push(w);
      }
    }
    groups.push(group);
  }
  // A single dead-end road/river does not divide the surrounding meadow.
  const barriers = roads.flat().length + (o.river?.length ?? 0);
  // Walk around a city cap: its two flanking meadow portions touch along its wall.
  // A road terminating at that wall interrupts the connection.
  const wallRoad = roads.length === 1 && roads[0].length === 1;
  for (const city of cities) {
    const starts = city.filter((e) => !city.includes((e + 3) % 4));
    if (starts.length !== 1 || wallRoad) continue;
    const first = starts[0];
    let last = first;
    while (city.includes((last + 1) % 4)) last = (last + 1) % 4;
    const a = (first * 2 + 7) % 8,
      b = (last * 2 + 2) % 8;
    const ai = groups.findIndex((g) => g.includes(a)),
      bi = groups.findIndex((g) => g.includes(b));
    if (ai >= 0 && bi >= 0 && ai !== bi) {
      groups[ai].push(...groups[bi]);
      groups.splice(bi, 1);
    }
  }

  const connectedCity = cities.some(
    (c) => c.length > 1 && c.some((e) => c.includes((e + 2) % 4)),
  );
  const fields =
    o.fields ??
    (barriers <= 1 && !connectedCity && !cities.length && present.length
      ? [present]
      : groups);
  fields.forEach((ports, i) => {
    const anchor: [number, number] = ports.length
      ? anchors[ports[0]]
      : [50, 50];
    const r = region('field', ports, i, anchor);
    r.cities = cities
      .map((c, j) =>
        c.some(
          (e) =>
            ports.includes((e * 2 + 7) % 8) || ports.includes((e * 2 + 2) % 8),
        ) || !ports.length
          ? 'c' + j
          : '',
      )
      .filter(Boolean);
    regions.push(r);
  });
  if (o.monastery) regions.push(region('monastery', [], 0, [50, 50]));
  if (o.garden) regions.push(region('garden', [], 0, [64, 67]));
  tiles[id] = {
    id,
    module,
    quantity,
    edges: edges.join(''),
    regions,
    flight: o.flight,
    gold: o.gold,
    magic: o.magic,
    robber: o.robber,
    crop: o.crop,
    ferry: o.ferry,
    source: o.source,
    lake: o.lake,
  };
}
const b = (
  id: string,
  n: number,
  c: number[][] = [],
  r: number[][] = [],
  o: Options = {},
) => add(id, 'base', n, c, r, o);
b('A', 2, [], [[2]], { monastery: true });
b('B', 4, [], [], { monastery: true });
b('C', 1, [[0, 1, 2, 3]], [], { shields: [1] });
b('D', 4, [[0]], [[1, 3]]);
b('E', 5, [[0]]);
b('F', 2, [[1, 3]], [], { shields: [1] });
b('G', 1, [[1, 3]]);
b('H', 3, [[1], [3]]);
b('I', 2, [[0], [3]]);
b('J', 3, [[0]], [[1, 2]]);
b('K', 3, [[0]], [[2, 3]]);
b('L', 3, [[0]], [[1], [2], [3]]);
b('M', 2, [[0, 1]], [], { shields: [1] });
b('N', 3, [[0, 1]]);
b('O', 2, [[0, 3]], [[1, 2]], { shields: [1] });
b('P', 3, [[0, 3]], [[1, 2]]);
b('Q', 1, [[0, 1, 3]], [], { shields: [1] });
b('R', 3, [[0, 1, 3]]);
b('S', 2, [[0, 1, 3]], [[2]], { shields: [1] });
b('T', 1, [[0, 1, 3]], [[2]]);
b('U', 8, [], [[0, 2]]);
b('V', 9, [], [[2, 3]]);
b('W', 4, [], [[1], [2], [3]]);
b('X', 1, [], [[0], [1], [2], [3]]);
// Exactly one garden-bearing copy of each G-marked base variant.
for (const id of ['E', 'H', 'I', 'M', 'N', 'R', 'U', 'V']) {
  tiles[id].quantity--;
  tiles[id + 'g'] = structuredClone(tiles[id]);
  tiles[id + 'g'].id = id + 'g';
  tiles[id + 'g'].quantity = 1;
  tiles[id + 'g'].regions.push({
    id: 'g0',
    kind: 'garden',
    ports: [],
    cities: [],
    anchor: [62, 65],
    shields: 0,
    goods: [0, 0, 0],
    inn: false,
    cathedral: false,
  });
}
const river = (
  id: string,
  c: number[][],
  r: number[][],
  v: number[],
  o: Options = {},
) => add('F' + id, 'river', 1, c, r, { ...o, river: v });
river('1', [], [[0]], [2], {
  source: true,
  fields: [[0, 1, 2, 3, 4, 5, 6, 7]],
});
river('2', [[0]], [[2]], [1, 3]); // bridge road ends at city; only south is an edge
// F2 has a city north, river east/west, and a road south terminating at that city.

river('3', [[0], [2]], [], [1, 3]);
river('4', [], [], [0, 2]);
river('5', [[0, 1]], [], [2, 3]);
river('6', [], [], [0, 2]);
river('7', [], [], [0, 3]);
river('8', [], [[0, 2]], [1, 3], { monastery: true });
river('9', [], [[0, 3]], [1, 2]);
river('10', [], [], [1, 2], { garden: true });
river('11', [], [[1, 3]], [0, 2]);
river('12', [], [], [0], { monastery: true, lake: true });
const e = (
  id: string,
  c: number[][] = [],
  r: number[][] = [],
  o: Options = {},
) => add('E' + id, 'inns', 1, c, r, o);
e('A', [], [[2, 3]], { inns: [0] });
e('B', [], [[1, 3]], { inns: [0], garden: true });
e('C', [], [[3], [1], [2]], { inns: [0, 1] });
e('D', [], [[3], [1]], { monastery: true, fields: [[0, 1, 2, 3, 4, 5, 6, 7]] });
e(
  'E',
  [],
  [
    [0, 3],
    [1, 2],
  ],
);
e('F', [[0, 3]], [[1, 2]]);
e('G', [[0, 3]]);
e('H', [[0], [1], [2], [3]], [], { fields: [[]], garden: true });
e('I', [[0], [2]], [[1], [3]]);
e('J', [[0]], [[2]]);
e('Ka', [[0, 1, 2, 3]], [], { cathedral: true });
e('Kb', [[0, 1, 2, 3]], [], { cathedral: true });
e('L', [[0, 3]], [[1, 2]], { shields: [1], inns: [0] });
e('M', [[0]], [[2, 3]], { inns: [0] });
e('N', [[0, 3]], [[2]], { inns: [0] });
e('O', [[0], [1], [3]]);
e('P', [[0, 1], [3]], [], { shields: [1, 0] });
e('Q', [[1, 2, 3]], [], { shields: [1] });
e('R', [[0], [1]], [[2]], { fields: [[4], [5, 6, 7]] });
e('S', [[0], [3]], [[2]]);
e('T', [], [[0, 2]], { river: [1, 3], inns: [0] });
e('U', [[0], [2]], [[1], [3]], { fields: [[2], [3, 7], [6]] });
e('V', [[0]], [[1], [2]]);
e('W', [], [[0, 1, 2, 3]], { inns: [0] });
const t = (
  id: string,
  c: number[][] = [],
  r: number[][] = [],
  o: Options = {},
) => add('H' + id, 'traders', 1, c, r, o);
t('A', [[0]], [[1]], { fields: [[2, 3, 4, 5, 6, 7]] });
t(
  'B',
  [],
  [
    [0, 2],
    [1, 3],
  ],
);
t('C', [[0]], [[2], [1, 3]], { fields: [[2], [3, 4], [5, 6], [7]] });
t('D', [[0, 1], [3]], [[2]], { goods: [[0, 1, 0]] });
t('E', [[1, 3]], [], { goods: [[0, 1, 0]] });
t('F', [[0, 3]], [[2]], { goods: [[0, 1, 0]] });
t('G', [[0, 3]], [], { goods: [[0, 1, 0]] });
t('H', [[0, 1, 3]], [], { goods: [[0, 1, 0]] });
t('I', [[0, 1, 3]], [[2]], { goods: [[0, 1, 0]] });
t('J', [], [[3], [2]], { monastery: true, fields: [[0, 1, 2, 3, 4, 5, 6, 7]] });
t('K', [[0, 1]], [[2]], { garden: true, goods: [[0, 0, 1]] });
t('L', [[0, 3], [1]], [[2]], { goods: [[0, 0, 1]] });
t(
  'M',
  [
    [0, 3],
    [1, 2],
  ],
  [],
  { goods: [[0, 0, 1]], fields: [[]] },
);
t('N', [[1, 3]], [], { goods: [[0, 0, 1]] });
t('O', [[0, 1, 3]], [[2]], { goods: [[0, 0, 1]] });
t('P', [[1, 3]], [], { goods: [[1, 0, 0]] });
t('Q', [[1, 3]], [], { goods: [[1, 0, 0]] });
t('R', [[1, 3]], [[0]], { goods: [[1, 0, 0]] });
t('S', [[1, 3]], [[2]], { goods: [[1, 0, 0]] });
t('T', [[0, 1]], [], { river: [2, 3], goods: [[1, 0, 0]] });
t('U', [[0, 3]], [[1, 2]], { garden: true, goods: [[1, 0, 0]] });
t('V', [[0, 1, 3]], [[2]], { goods: [[1, 0, 0]] });
t('W', [[0, 1, 3]], [], { goods: [[1, 0, 0]] });
t(
  'X',
  [
    [0, 3],
    [1, 2],
  ],
  [],
  { goods: [[1, 0, 0]], fields: [[]] },
);
const mini = (
  prefix: string,
  module: Module,
  defs: [number[][], number[][], Options?][],
) =>
  defs.forEach(([c, r, o = {}], i) =>
    add(prefix + String.fromCharCode(65 + i), module, 1, c, r, o),
  );
mini('Fly', 'flight', [
  [[], [[2, 3]], { flight: [-1, 0] }],
  [[], [[1, 3]], { flight: [-1, 0] }],
  [[], [[0, 2]], { flight: [-1, 0] }],
  [[], [[1, 3]], { flight: [-1, -1] }],
  [[], [[1, 2]], { flight: [-1, -1] }],
  [[], [[0, 3]], { flight: [-1, 0] }],
  [[], [], { flight: [-1, 0] }],
  [[], [], { flight: [-1, -1], garden: true }],
]);
mini('Ferry', 'ferries', [
  [[[0]], [[1], [2], [3]]],
  [[[0]], [[1], [2], [3]]],
  [[[0]], [[2], [3]]],
  [[], [[1], [2], [3]]],
  [[], [[0], [1], [2], [3]]],
  [[], [[1], [2], [3]]],
  [[], [[1], [2], [3]]],
  [[], [[0], [1], [2], [3]]],
]);
mini('Gold', 'gold', [
  [
    [],
    [
      [0, 3],
      [1, 2],
    ],
  ],
  [[[0, 3]], [[1, 2]]],
  [[[0, 3]], [[1, 2]], { monastery: true }],
  [[[1], [3]], [[0, 2]]],
  [
    [],
    [
      [0, 1],
      [2, 3],
    ],
    { monastery: true },
  ],
  [
    [],
    [
      [0, 2],
      [1, 3],
    ],
  ],
  [[[0, 3]], [], { monastery: true }],
  [[], [[1, 2]], { monastery: true }],
]);
mini('Magic', 'magic', [
  [[[0]], [[1], [2], [3]]],
  [[[0], [1], [3]], [[2]]],
  [[[0, 1, 3]], [[2]]],
  [[[1], [3]], []],
  [[[0, 3]], [[1, 2]], { garden: true }],
  [[[0, 3]], [[1, 2]]],
  [[[1, 3]], [[0], [2]]],
  [[[0]], [[1], [2, 3]]],
]);

mini('Robber', 'robbers', [
  [[], [[2, 3]]],
  [[], [[2, 3]]],
  [[], [[0], [1], [2]]],
  [[[0]], [], { garden: true }],
  [[[0]], [[1, 2]]],
  [[], [[0, 2]]],
  [[], [[0, 2]]],
  [[[1, 2, 3]], []],
]);
mini('Crop', 'crops', [
  [[], [[3, 2], [1]], { crop: 'road' }],
  [[], [[3, 2], [1]], { crop: 'road' }],
  [[[0]], [[2]], { crop: 'field' }],
  [[[0]], [[1, 3]], { crop: 'field' }],
  [
    [[0], [2]],
    [],
    {
      crop: 'city',
      fields: [
        [2, 3],
        [6, 7],
      ],
    },
  ],
  [
    [
      [0, 3],
      [1, 2],
    ],
    [],
    { crop: 'city', fields: [[], []] },
  ],
]);
for (const tile of Object.values(tiles)) {
  if (tile.module === 'ferries') tile.ferry = true;
  if (tile.module === 'gold') tile.gold = true;
  if (tile.module === 'magic') tile.magic = true;
  if (tile.module === 'robbers') tile.robber = true;
}
export const presets: Record<string, { farmers: boolean; modules: Module[] }> =
  {
    learn: { farmers: false, modules: [] },
    base: { farmers: true, modules: [] },
    classic: { farmers: true, modules: ['river', 'abbot', 'inns', 'traders'] },
    full: { farmers: true, modules: [...modules] },
  };
export function inventory(enabled: Module[]) {
  return Object.values(tiles)
    .filter(
      (t) =>
        (t.module === 'base' || enabled.includes(t.module)) &&
        (!t.edges.includes('V') || enabled.includes('river')),
    )
    .flatMap((t) => Array<string>(t.quantity).fill(t.id));
}
export function rotatePoint(
  [x, y]: [number, number],
  rotation: number,
): [number, number] {
  for (let i = 0; i < rotation; i++) [x, y] = [100 - y, x];
  return [x, y];
}
export const edge = (tile: Tile, rotation: number, side: number) =>
  tile.edges[(side - rotation + 4) % 4];

// Inns V has two additional short roads ending at the city (p. 11).
for (let i = 2; i < 4; i++)
  tiles.EV.regions.push({
    id: 'r' + i,
    kind: 'road',
    ports: [],
    cities: [],
    anchor: i === 2 ? [43, 35] : [35, 43],
    shields: 0,
    goods: [0, 0, 0],
    inn: false,
    cathedral: false,
  });

tiles.CropF.regions.find((r) => r.id === 'f0')!.anchor = [35, 65];
tiles.CropF.regions.find((r) => r.id === 'f1')!.anchor = [65, 35];
