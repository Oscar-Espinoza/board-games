import { type Played, type Kind } from './cards.js';
export type Group = {
  kind: Kind | 'boxed' | 'uramaki_immediate';
  cards: string[];
  amount: number;
};
export type Receipt = {
  playerId: string;
  round: number;
  groups: Group[];
  delta: number;
  immediate: number;
  total: number;
};
/** Uramaki prizes by finishing place; the 10-icon race and round end award the same. */
export const uramakiPrize = (place: number) => [8, 5, 2][place] ?? 0;
const count = (cs: Played[], kind: Kind) =>
  cs.filter((c) => !c.boxed && c.kind === kind).length;
const icons = (cs: Played[], kind: Kind) =>
  cs
    .filter((c) => !c.boxed && c.kind === kind)
    .reduce((n, c) => n + c.icons, 0);
function colorCounts(cs: Played[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cs) if (!c.boxed) out[c.color] = (out[c.color] ?? 0) + 1;
  return out;
}
function onigiriScore(shapes: string[]): number {
  const counts = Object.values(
    shapes.reduce<Record<string, number>>((out, v) => {
      out[v] = (out[v] ?? 0) + 1;
      return out;
    }, {}),
  );
  let score = 0;
  for (let layer = 0; layer < Math.max(0, ...counts); layer++)
    score += counts.filter((n) => n > layer).length ** 2;
  return score;
}
export function roundGroups(
  tableaus: Played[][],
  seat: number,
  roll: Kind,
  uramakiPlace: number,
): Group[] {
  const cs = tableaus[seat];
  const active = cs.filter((c) => !c.boxed);
  const out: Group[] = [];
  const add = (
    kind: Group['kind'],
    amount: number,
    chosen = cs.filter((c) =>
      kind === 'boxed' ? c.boxed : !c.boxed && c.kind === kind,
    ),
  ) => {
    if (chosen.length || amount)
      out.push({ kind, amount, cards: chosen.map((c) => c.id) });
  };
  const n = (k: Kind) => count(cs, k);
  add('boxed', cs.filter((c) => c.boxed).length * 2);
  add(
    'nigiri',
    active
      .filter((c) => c.kind === 'nigiri')
      .reduce(
        (sum, c) =>
          sum +
          c.icons *
            (c.wasabi &&
            active.some((w) => w.id === c.wasabi && w.kind === 'wasabi')
              ? 3
              : 1),
        0,
      ),
  );
  add('tempura', Math.floor(n('tempura') / 2) * 5);
  add('sashimi', Math.floor(n('sashimi') / 3) * 10);
  add('dumpling', [0, 1, 3, 6, 10, 15][Math.min(5, n('dumpling'))]);
  add('eel', n('eel') === 1 ? -3 : n('eel') > 1 ? 7 : 0);
  add('tofu', [0, 2, 6][n('tofu')] ?? 0);
  add(
    'onigiri',
    onigiriScore(
      active.filter((c) => c.kind === 'onigiri').map((c) => c.variant),
    ),
  );
  add(
    'edamame',
    n('edamame') *
      Math.min(
        4,
        tableaus.filter((cards, i) => i !== seat && count(cards, 'edamame') > 0)
          .length,
      ),
  );
  add('miso', n('miso') * 3);
  const colors = tableaus.map((c) => colorCounts(c));
  add('tea', n('tea') * Math.max(0, ...Object.values(colors[seat])));
  add(
    'soy',
    Object.keys(colors[seat]).length ===
      Math.max(...colors.map((c) => Object.keys(c).length))
      ? n('soy') * 4
      : 0,
  );
  if (roll === 'maki') {
    const totals = tableaus.map((c) => icons(c, 'maki'));
    const rank = [...new Set(totals)]
      .filter((n) => n > 0)
      .sort((a, b) => b - a)
      .indexOf(totals[seat]);
    add(
      'maki',
      rank < 0 ? 0 : ((tableaus.length >= 6 ? [6, 4, 2] : [6, 3])[rank] ?? 0),
    );
  } else if (roll === 'temaki') {
    const totals = tableaus.map((c) => count(c, 'temaki'));
    add(
      'temaki',
      (totals[seat] === Math.max(...totals) ? 4 : 0) -
        (tableaus.length > 2 && totals[seat] === Math.min(...totals) ? 4 : 0),
    );
  } else {
    const totals = tableaus.map((c) => icons(c, 'uramaki'));
    add(
      'uramaki',
      totals[seat] > 0 && totals[seat] === Math.max(...totals)
        ? uramakiPrize(uramakiPlace)
        : 0,
    );
  }
  return out;
}
export function dessertGroups(
  collections: Played[][],
  seat: number,
  dessert: Kind,
): Group[] {
  const cs = collections[seat];
  let amount = 0;
  if (dessert === 'pudding') {
    const totals = collections.map((c) => count(c, 'pudding'));
    amount =
      (totals[seat] === Math.max(...totals) ? 6 : 0) -
      (collections.length > 2 && totals[seat] === Math.min(...totals) ? 6 : 0);
  } else if (dessert === 'ice_cream')
    amount = Math.floor(count(cs, 'ice_cream') / 4) * 12;
  else
    for (let i = 0; i < 3; i++)
      amount += [-2, 0, 1, 3, 6, 10][
        Math.min(
          5,
          cs
            .filter((c) => c.kind === 'fruit' && !c.boxed)
            .reduce((n, c) => n + c.fruit[i], 0),
        )
      ];
  return [
    {
      kind: dessert,
      amount,
      cards: cs.filter((c) => c.kind === dessert && !c.boxed).map((c) => c.id),
    },
  ];
}
