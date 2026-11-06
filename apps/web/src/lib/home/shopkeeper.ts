/** The 8-bit store's shopkeeper errand: pure timeline, no DOM. Positions are % of scene width. */
export type Pose = 'idle' | 'walk' | 'reach' | 'confused' | 'carry';
export type Say = 'go' | 'lost' | 'search' | 'found';
export type Shelf = { x: number; high: boolean };
export type Beat = {
  x: number;
  pose: Pose;
  ms: number;
  climb?: boolean;
  ladder?: number;
  say?: Say;
  found?: boolean;
};
export const counter = 66;
/** Walk strips: cell width/height, and one 8-frame cycle at ~10 fps. */
export const cells = { walk: 0.589, carry: 0.622 };
export const cycle = 800;
/** Scene-width % covered per cycle (two steps), so feet stay planted. */
const stride = 18;
const walk = (from: number, to: number) =>
  Math.max(cycle / 2, (Math.abs(to - from) / stride) * cycle);

export function errand(from: number, shelf: Shelf): Beat[] {
  const beats: Beat[] = [{ x: from, pose: 'idle', say: 'go', ms: 700 }];
  let at = from;
  const go = (x: number, extra: Partial<Beat> = {}) => {
    beats.push({ x, pose: 'walk', ms: walk(at, x), ...extra });
    at = x;
  };
  // Sometimes he checks the wrong shelf first. He always gets there eventually.
  if (Math.random() < 0.35) {
    const off = 18 + Math.random() * 16;
    const wrong = shelf.x + off < 64 ? shelf.x + off : shelf.x - off;
    go(Math.max(8, wrong));
    beats.push({
      x: at,
      pose: 'confused',
      say: 'lost',
      ms: 1400 + Math.random() * 800,
    });
  }
  go(shelf.x, shelf.high ? { ladder: shelf.x } : {});
  const search = 900 + Math.random() * 1400;
  if (shelf.high) {
    beats.push({ x: at, pose: 'reach', climb: true, ms: 650 });
    beats.push({
      x: at,
      pose: 'reach',
      climb: true,
      say: 'search',
      ms: search,
    });
    beats.push({ x: at, pose: 'reach', ms: 600 });
  } else {
    beats.push({ x: at, pose: 'reach', say: 'search', ms: search });
  }
  beats.push({ x: counter, pose: 'carry', ms: walk(at, counter) });
  beats.push({ x: counter, pose: 'idle', say: 'found', found: true, ms: 0 });
  return beats;
}
