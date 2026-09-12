export const rolls = ['maki', 'temaki', 'uramaki'] as const;
export const appetizers = [
  'tempura',
  'sashimi',
  'dumpling',
  'eel',
  'tofu',
  'onigiri',
  'edamame',
  'miso',
] as const;
export const specials = [
  'chopsticks',
  'spoon',
  'menu',
  'special_order',
  'takeout',
  'wasabi',
  'tea',
  'soy',
] as const;
export const desserts = ['pudding', 'ice_cream', 'fruit'] as const;
export const kinds = [
  'nigiri',
  ...rolls,
  ...appetizers,
  ...specials,
  ...desserts,
] as const;
export type Kind = (typeof kinds)[number];
/** Face is an appearance, never an identifier of a physical card. */
export type Face = {
  kind: Kind;
  variant: string;
  icons: number;
  priority: number;
  color: string;
  fruit: number[];
};
export type Card = { physical: string; face: Face };
export type Played = Face & {
  id: string;
  physical: string;
  playedTurn: number;
  collectedRound: number;
  boxed: boolean;
  copied: boolean;
  wasabi: string | null;
  copyCanAttach: boolean;
};
export type PublicCard = Omit<Played, 'physical'>;
export type HandCard = Face & { handle: string };
export function face(
  kind: Kind,
  variant = '',
  icons = 0,
  priority = 0,
  fruit = [0, 0, 0],
): Face {
  return {
    kind,
    variant,
    icons,
    priority,
    fruit,
    color: kind === 'wasabi' ? 'nigiri' : kind,
  };
}
export function manifest(): Card[] {
  const cards: Card[] = [];
  const add = (f: Face, count: number) => {
    for (let n = 0; n < count; n++)
      cards.push({
        physical: `physical-${cards.length}`,
        face: structuredClone(f),
      });
  };
  [
    ['egg', 1, 4],
    ['salmon', 2, 5],
    ['squid', 3, 3],
  ].forEach(([v, i, n]) =>
    add(face('nigiri', String(v), Number(i)), Number(n)),
  );
  [4, 5, 3].forEach((n, i) => add(face('maki', String(i + 1), i + 1), n));
  add(face('temaki'), 12);
  [3, 4, 5].forEach((i) => add(face('uramaki', String(i), i), 4));
  appetizers.filter((k) => k !== 'onigiri').forEach((k) => add(face(k), 8));
  ['circle', 'triangle', 'square', 'rectangle'].forEach((v) =>
    add(face('onigiri', v), 2),
  );
  specials.forEach((k) => {
    const base = { chopsticks: 1, spoon: 4, menu: 7, takeout: 10 }[
      k as 'chopsticks'
    ];
    if (base) [0, 1, 2].forEach((i) => add(face(k, '', 0, base + i), 1));
    else add(face(k), 3);
  });
  add(face('pudding'), 15);
  add(face('ice_cream'), 15);
  [
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
    [2, 0, 0],
    [0, 2, 0],
    [0, 0, 2],
  ].forEach((f, i) => add(face('fruit', f.join(''), 0, 0, f), i < 3 ? 3 : 2));
  return cards;
}
export function publicCard(c: Played): PublicCard {
  return {
    id: c.id,
    kind: c.kind,
    variant: c.variant,
    icons: c.icons,
    priority: c.priority,
    color: c.color,
    fruit: [...c.fruit],
    playedTurn: c.playedTurn,
    collectedRound: c.collectedRound,
    boxed: c.boxed,
    copied: c.copied,
    wasabi: c.wasabi,
    copyCanAttach: c.copyCanAttach,
  };
}
export function identity(c: Face): Face {
  return {
    kind: c.kind,
    variant: c.variant,
    icons: c.icons,
    priority: c.priority,
    color: c.color,
    fruit: [...c.fruit],
  };
}
export const isDessert = (c: Face & { boxed?: boolean }) =>
  !c.boxed && (desserts as readonly string[]).includes(c.kind);
