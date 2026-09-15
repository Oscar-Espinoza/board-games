<script lang="ts">
  import Dish from './table/FoodArt.svelte';
  import { menu } from './table/data.js';
  import { t, variation, hues, patterns } from './labels.js';
  import type { Face } from './cards.js';
  import type { Locale } from '@board-games/shared/runtime';
  let {
    card,
    locale = 'en',
    small = false,
  }: {
    card: Face & { boxed?: boolean; copied?: boolean };
    locale?: Locale;
    small?: boolean;
  } = $props();
</script>

<div
  class="food-card"
  class:small
  class:boxed={card.boxed}
  style={`--dish-color:${card.boxed ? '#c4b69a' : (menu.find((tile) => tile.kind === card.kind)?.accent ?? hues[card.color])}`}
>
  <span class="pattern" aria-hidden="true"
    >{card.boxed
      ? '▧'
      : Array(3)
          .fill(patterns[card.color] ?? '✦')
          .join(' · ')}</span
  >
  <strong>{t(card.boxed ? 'boxed' : card.kind, {}, locale)}</strong>
  <div class="illustration"><Dish {card} boxed={card.boxed} /></div>
  {#if !small}<span class="variation"
      >{card.boxed ? '' : variation(card, locale) || '·'}</span
    ><span class="scoring"
      >{card.boxed
        ? '2'
        : card.kind === 'nigiri'
          ? card.icons
          : card.kind === 'maki'
            ? `${card.icons} ◉`
            : card.kind === 'uramaki'
              ? `${card.icons} ◉ → 10`
              : card.kind === 'tempura'
                ? '2 → 5'
                : card.kind === 'sashimi'
                  ? '3 → 10'
                  : card.kind === 'dumpling'
                    ? '1 · 3 · 6 · 10 · 15'
                    : card.kind === 'tofu'
                      ? '2 · 6 · 0'
                      : card.kind === 'eel'
                        ? '−3 / 7'
                        : card.kind === 'miso'
                          ? '3'
                          : card.kind === 'onigiri'
                            ? '1 · 4 · 9 · 16'
                            : card.kind === 'ice_cream'
                              ? '4 → 12'
                              : card.kind === 'wasabi'
                                ? 'Nigiri × 3'
                                : card.kind === 'pudding'
                                  ? '+6 / −6'
                                  : card.kind === 'temaki'
                                    ? '+4 / −4'
                                    : card.priority
                                      ? `↗ ${card.priority}`
                                      : '✦'}</span
    >{/if}
  {#if card.copied}<span class="copy" title={t('copied', {}, locale)}>✦</span
    >{/if}
</div>

<style>
  .food-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: var(--card-width, 112px);
    height: var(--card-height, 166px);
    padding: 8px 7px 6px;
    background: linear-gradient(108deg, #fff7e5, #fbf0d7 57%, #eddfbf);
    color: #294d45;
    border: 1px solid #c3ac8a;
    border-bottom: 6px solid var(--dish-color);
    border-radius: 8px;
    box-shadow:
      inset 0 0 0 3px #fff9e6,
      1px 4px 3px #6b614338,
      1px 7px 10px #5c523121;
    overflow: hidden;
    font-size: 10px;
    text-align: center;
  }
  .food-card strong {
    font-size: 12px;
    line-height: 1.12;
    min-height: 25px;
    display: grid;
    place-items: center;
    z-index: 1;
  }
  .illustration {
    height: 76px;
    width: 100%;
  }
  .pattern {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    color: var(--dish-color);
    opacity: 0.4;
    letter-spacing: 5px;
    font-size: 8px;
  }
  .scoring {
    font-size: 11px;
    font-weight: 800;
    background: color-mix(in srgb, var(--dish-color) 23%, #fff9e9);
    width: 100%;
    border-radius: 5px;
    line-height: 18px;
  }
  .variation {
    font-size: 9px;
    line-height: 1.15;
    min-height: 11px;
  }
  .copy {
    position: absolute;
    right: 4px;
    top: 32px;
    color: #a46c92;
  }
  .small {
    background: linear-gradient(
      120deg,
      #fff3d7,
      color-mix(in srgb, var(--dish-color) 35%, #fff5de)
    );
    width: var(--small-card-width, 58px);
    height: var(--small-card-height, 72px);
    padding: 4px;
    border-bottom-width: 4px;
    border-radius: 8px;
  }
  .small strong {
    font-size: 8px;
    min-height: 17px;
  }
  .small .illustration {
    width: 48px;
    height: 40px;
  }
  .boxed {
    background: #e7d9bc;
  }
</style>
