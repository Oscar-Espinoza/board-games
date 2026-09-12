import { m } from '@board-games/shared/messages';
import type { Locale } from '@board-games/shared/runtime';
import type { Face } from './cards.js';
/** All copy is compiled by Paraglide, including the searchable rule guide. */
export function t(
  key: string,
  values: Record<string, string | number> = {},
  locale?: Locale,
): string {
  const fn = (
    m as unknown as Record<
      string,
      (
        values: Record<string, string | number>,
        options: { locale?: Locale },
      ) => string
    >
  )[`sgp_${key}`];
  return fn ? fn(values, { locale }) : key;
}
export function variation(c: Face, locale?: Locale): string {
  if (c.kind === 'fruit')
    return c.fruit
      .flatMap((n, i) =>
        n
          ? [
              `${n} ${t('variant_' + ['watermelon', 'orange', 'pineapple'][i], {}, locale)}`,
            ]
          : [],
      )
      .join(' · ');
  if (c.kind === 'nigiri' || c.kind === 'onigiri')
    return t('variant_' + c.variant, {}, locale);
  return c.variant;
}
export function cardName(c: Face, locale?: Locale): string {
  return [
    t(c.kind, {}, locale),
    variation(c, locale),
    c.priority ? t('priority', { number: c.priority }, locale) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
export const hues: Record<string, string> = {
  nigiri: '#edbe53',
  maki: '#d96976',
  temaki: '#9a628c',
  uramaki: '#b7c44c',
  tempura: '#d8ac72',
  sashimi: '#9dbc7a',
  dumpling: '#df889c',
  eel: '#6775a9',
  tofu: '#77b79d',
  onigiri: '#7cabc7',
  edamame: '#aa86bb',
  miso: '#75aeb2',
  chopsticks: '#bf805e',
  spoon: '#a6998a',
  menu: '#de9390',
  special_order: '#caaacd',
  takeout: '#bfb18e',
  wasabi: '#edbe53',
  tea: '#b78869',
  soy: '#c69757',
  pudding: '#d89a69',
  ice_cream: '#89aa89',
  fruit: '#e8987b',
};

/** Semantic patterns are shared by Nigiri/Wasabi and independent of display hue. */
export const patterns: Record<string, string> = {
  nigiri: '≈',
  maki: '◉',
  temaki: '△',
  uramaki: '⊙',
  tempura: '✳',
  sashimi: '≋',
  dumpling: '⌒',
  eel: '≡',
  tofu: '□',
  onigiri: '◇',
  edamame: '⋮',
  miso: '∿',
  chopsticks: '∥',
  spoon: '○',
  menu: '☷',
  special_order: '✦',
  takeout: '▧',
  tea: '∴',
  soy: '●',
  pudding: '⌂',
  ice_cream: '♧',
  fruit: '❖',
};
