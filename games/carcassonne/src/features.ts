import { tiles, edge, type Kind, type Region } from './tiles.js';
export type Placed = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  turn: number;
  ferry?: [string, string];
};
export type Figure = {
  id: number;
  owner: string;
  tile: string;
  region: string;
  type: 'meeple' | 'large' | 'abbot';
  attachment?: 'builder' | 'pig';
};
export type Landscape = {
  board: Record<string, Placed>;
  figures: Figure[];
  magic: { mage: string | null; witch: string | null };
};
export type Feature = {
  id: string;
  kind: Kind;
  nodes: string[];
  tiles: string[];
  open: number;
  complete: boolean;
  figures: Figure[];
  leaders: string[];
  strength: Record<string, number>;
  shields: number;
  goods: number[];
  inn: boolean;
  cathedral: boolean;
  mage: boolean;
  witch: boolean;
  cities: string[];
};
export const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
export const key = (x: number, y: number) => `${x},${y}`;
/** Whether two tiles are the same or touch, diagonals included (a monastery's reach). */
export const adjacent = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
/** Meeples come in sevens; every other figure is one per player. */
export const figureSupply = (type: Figure['type']) =>
  type === 'meeple' ? 7 : 1;
/** The figures a table offers, with the large meeple and abbot as their modules allow. */
export const figureTypes = (
  modules: readonly string[],
  fly = false,
): Figure['type'][] => [
  'meeple',
  ...(modules.includes('inns') ? (['large'] as const) : []),
  ...(!fly && modules.includes('abbot') ? (['abbot'] as const) : []),
];
export function supply(s: Landscape, who: string, type: Figure['type']) {
  return (
    figureSupply(type) -
    s.figures.filter((f) => f.owner === who && f.type === type).length
  );
}
export const node = (tile: string, region: string) => `${tile}/${region}`;
export function split(ref: string) {
  const [tile, region] = ref.split('/');
  return { tile, region };
}
export function regionAt(s: Landscape, ref: string): Region {
  const { tile, region } = split(ref);
  return tiles[s.board[tile].id].regions.find((r) => r.id === region)!;
}
export function graph(s: Landscape): Feature[] {
  const regions = new Map<string, { r: Region; p: Placed; k: string }>();
  for (const [k, p] of Object.entries(s.board))
    for (const r of tiles[p.id].regions)
      regions.set(node(k, r.id), { r, p, k });
  const links = new Map<string, string[]>();
  const openings = new Map<string, number>();
  for (const [id, { r, p, k }] of regions) {
    const adjacent: string[] = [];
    let open = 0;
    for (const port of r.ports) {
      const side = r.kind === 'field' ? Math.floor(port / 2) : port;
      const world = (side + p.rotation) % 4;
      const [dx, dy] = directions[world];
      const otherKey = key(p.x + dx, p.y + dy);
      const other = s.board[otherKey];
      if (!other) {
        open++;
        continue;
      }
      const local = (((world + 2 - other.rotation) % 4) + 4) % 4;
      const targetPort =
        r.kind === 'field' ? local * 2 + (1 - (port % 2)) : local;
      const target = tiles[other.id].regions.find(
        (v) => v.kind === r.kind && v.ports.includes(targetPort),
      );
      if (target) adjacent.push(node(otherKey, target.id));
      else open++;
    }
    if (r.kind === 'road' && p.ferry?.includes(r.id)) {
      const other = p.ferry.find((v) => v !== r.id)!;
      adjacent.push(node(k, other));
    }
    links.set(id, adjacent);
    openings.set(id, open);
  }
  const seen = new Set<string>();
  const result: Feature[] = [];
  for (const [id, { r, p }] of regions) {
    if (seen.has(id) || r.kind === 'river') continue;
    const nodes: string[] = [];
    const queue = [id];
    while (queue.length) {
      const v = queue.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      nodes.push(v);
      queue.push(...links.get(v)!);
    }
    const tileKeys = [...new Set(nodes.map((v) => split(v).tile))];
    let open = nodes.reduce((n, v) => n + openings.get(v)!, 0);
    const sanctuary = r.kind === 'monastery' || r.kind === 'garden';
    if (sanctuary) {
      open = 9;
      for (const q of Object.values(s.board)) if (adjacent(p, q)) open--;
    }
    const figures = s.figures.filter((f) =>
      nodes.includes(node(f.tile, f.region)),
    );
    const strength: Record<string, number> = {};
    for (const f of figures)
      strength[f.owner] =
        (strength[f.owner] ?? 0) + (f.type === 'large' ? 2 : 1);
    const max = Math.max(0, ...Object.values(strength));
    const rs = nodes.map((v) => regions.get(v)!.r);
    result.push({
      id: [...nodes].sort()[0],
      kind: r.kind,
      nodes,
      tiles: tileKeys,
      open,
      complete: r.kind !== 'field' && open === 0,
      figures,
      leaders: Object.keys(strength).filter((p) => strength[p] === max),
      strength,
      shields: rs.reduce((n, v) => n + v.shields, 0),
      goods: [0, 1, 2].map((i) => rs.reduce((n, v) => n + v.goods[i], 0)),
      inn: rs.some((v) => v.inn),
      cathedral: rs.some((v) => v.cathedral),
      mage: nodes.includes(s.magic.mage ?? ''),
      witch: nodes.includes(s.magic.witch ?? ''),
      cities: [],
    });
  }
  const byNode = new Map(
    result.flatMap((f) => f.nodes.map((n) => [n, f] as const)),
  );
  for (const f of result.filter((f) => f.kind === 'field'))
    f.cities = [
      ...new Set(
        f.nodes.flatMap((n) => {
          const v = regions.get(n)!;
          return v.r.cities
            .map((c) => byNode.get(node(v.k, c)))
            .filter((c) => c?.complete)
            .map((c) => c!.id);
        }),
      ),
    ];
  return result;
}
export function points(f: Feature, final = false) {
  let n =
    f.kind === 'field'
      ? 3 * f.cities.length
      : f.kind === 'city'
        ? (f.tiles.length + f.shields) * (final ? 1 : f.cathedral ? 3 : 2)
        : f.kind === 'road'
          ? f.tiles.length * (!final && f.inn ? 2 : 1)
          : 9 - f.open;
  if (f.mage) n += f.tiles.length;
  if (f.witch) n = Math.ceil(n / 2);
  return n;
}
export function goldTiles(s: Landscape, f: Feature) {
  if (f.kind !== 'monastery' && f.kind !== 'garden') return f.tiles;
  const p = s.board[f.tiles[0]];
  return Object.keys(s.board).filter((k) => adjacent(s.board[k], p));
}
export function frontier(board: Landscape['board']) {
  const out = new Set<string>();
  for (const p of Object.values(board))
    for (const [dx, dy] of directions) {
      const k = key(p.x + dx, p.y + dy);
      if (!board[k]) out.add(k);
    }
  return [...out].map((k) => k.split(',').map(Number) as [number, number]);
}
export function legalPlacement(
  board: Landscape['board'],
  id: string,
  x: number,
  y: number,
  rotation: number,
) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    !Number.isInteger(rotation) ||
    rotation < 0 ||
    rotation > 3 ||
    board[key(x, y)]
  )
    return false;
  let touches = false,
    riverTouches = 0;
  for (let side = 0; side < 4; side++) {
    const [dx, dy] = directions[side];
    const p = board[key(x + dx, y + dy)];
    if (!p) continue;
    touches = true;
    const a = edge(tiles[id], rotation, side);
    if (a !== edge(tiles[p.id], p.rotation, (side + 2) % 4)) return false;
    if (a === 'V') riverTouches++;
  }
  if (tiles[id].edges.includes('V')) {
    if (riverTouches !== 1) return false;
    const ports = tiles[id].regions
      .find((r) => r.kind === 'river')!
      .ports.map((p) => (p + rotation) % 4);
    const connected = ports.find((side) => {
      const [dx, dy] = directions[side];
      return board[key(x + dx, y + dy)];
    });
    if (connected !== undefined && ports.length === 2) {
      const out = ports.find((v) => v !== connected)!;
      const source = Object.values(board).find((p) => tiles[p.id].source);
      if (
        source &&
        out ===
          (tiles[source.id].regions.find((r) => r.kind === 'river')!.ports[0] +
            source.rotation +
            2) %
            4
      )
        return false;
      const [dx, dy] = directions[connected];
      const prev = board[key(x + dx, y + dy)];
      const prevPorts = tiles[prev.id].regions
        .find((r) => r.kind === 'river')!
        .ports.map((v) => (v + prev.rotation) % 4);
      if (prevPorts.length === 2) {
        const back = prevPorts.find((v) => v !== (connected + 2) % 4)!;
        if (back === out) return false;
      }
    }
  }
  return touches;
}
export function placements(board: Landscape['board'], id: string) {
  return frontier(board).flatMap(([x, y]) =>
    [0, 1, 2, 3]
      .filter((r) => legalPlacement(board, id, x, y, r))
      .map((rotation) => ({ x, y, rotation })),
  );
}
