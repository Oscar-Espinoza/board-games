import { games } from '@board-games/shared/games';
import { rolls, appetizers, specials, desserts, type Kind } from './cards.js';
const { minPlayers, maxPlayers } = games['sushi-go-party'];
/** A menu is one roll, one dessert, this many appetizers and this many specials. */
export const APPETIZER_SLOTS = 3;
export const SPECIAL_SLOTS = 2;
export type Menu = {
  roll: Kind;
  appetizers: Kind[];
  specials: Kind[];
  dessert: Kind;
};
const menu = (
  roll: Kind,
  apps: Kind[],
  specs: Kind[],
  dessert: Kind,
): Menu => ({ roll, appetizers: apps, specials: specs, dessert });
export const presets = {
  first: menu(
    'maki',
    ['tempura', 'sashimi', 'miso'],
    ['wasabi', 'tea'],
    'ice_cream',
  ),
  original: menu(
    'maki',
    ['tempura', 'sashimi', 'dumpling'],
    ['chopsticks', 'wasabi'],
    'pudding',
  ),
  sampler: menu(
    'temaki',
    ['tempura', 'dumpling', 'tofu'],
    ['wasabi', 'menu'],
    'ice_cream',
  ),
  master: menu(
    'temaki',
    ['onigiri', 'tofu', 'sashimi'],
    ['spoon', 'takeout'],
    'fruit',
  ),
  points: menu(
    'uramaki',
    ['onigiri', 'dumpling', 'edamame'],
    ['special_order', 'tea'],
    'ice_cream',
  ),
  cutthroat: menu(
    'temaki',
    ['eel', 'tofu', 'miso'],
    ['spoon', 'soy'],
    'pudding',
  ),
  banquet: menu(
    'maki',
    ['tempura', 'dumpling', 'eel'],
    ['spoon', 'chopsticks'],
    'ice_cream',
  ),
  two: menu(
    'uramaki',
    ['onigiri', 'tofu', 'miso'],
    ['menu', 'special_order'],
    'fruit',
  ),
};
export function menuKinds(m: Menu): Kind[] {
  return ['nigiri', m.roll, ...m.appetizers, ...m.specials, m.dessert];
}
/** Kinds the rules leave out of a table of this size. */
export const unavailable = (kind: Kind, players: number) =>
  (players === 2 && (kind === 'spoon' || kind === 'edamame')) ||
  (players >= 7 && (kind === 'menu' || kind === 'special_order'));
export function validMenu(value: unknown, count: number): value is Menu {
  if (!Number.isInteger(count) || count < minPlayers || count > maxPlayers)
    return false;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const m = value as Menu;
  if (Object.keys(m).sort().join() !== 'appetizers,dessert,roll,specials')
    return false;
  if (
    !(rolls as readonly unknown[]).includes(m.roll) ||
    !(desserts as readonly unknown[]).includes(m.dessert)
  )
    return false;
  if (
    !Array.isArray(m.appetizers) ||
    m.appetizers.length !== APPETIZER_SLOTS ||
    !m.appetizers.every((k) => (appetizers as readonly unknown[]).includes(k))
  )
    return false;
  if (
    !Array.isArray(m.specials) ||
    m.specials.length !== SPECIAL_SLOTS ||
    !m.specials.every((k) => (specials as readonly unknown[]).includes(k))
  )
    return false;
  const types = menuKinds(m);
  // Every kind on the menu differs from the others, nigiri included.
  return (
    new Set(types).size === types.length &&
    !types.some((k) => unavailable(k, count))
  );
}
