import { rolls, appetizers, specials, desserts, type Kind } from './cards.js';
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
export function validMenu(value: unknown, count: number): value is Menu {
  if (!Number.isInteger(count) || count < 2 || count > 8) return false;
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
    m.appetizers.length !== 3 ||
    !m.appetizers.every((k) => (appetizers as readonly unknown[]).includes(k))
  )
    return false;
  if (
    !Array.isArray(m.specials) ||
    m.specials.length !== 2 ||
    !m.specials.every((k) => (specials as readonly unknown[]).includes(k))
  )
    return false;
  const types = menuKinds(m);
  return (
    new Set(types).size === 8 &&
    !(count === 2 && types.some((k) => k === 'spoon' || k === 'edamame')) &&
    !(count >= 7 && types.some((k) => k === 'menu' || k === 'special_order'))
  );
}
