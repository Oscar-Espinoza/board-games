<script lang="ts">
  import type { Face } from '../cards.js';
  import { menu } from '../table/data.js';
  import FoodArt from '../table/FoodArt.svelte';
  let {
    card,
    compact = false,
    selected = false,
    newlyPlayed = false,
  }: {
    card: Face;
    compact?: boolean;
    selected?: boolean;
    newlyPlayed?: boolean;
  } = $props();
  const tile = $derived(menu.find((tile) => tile.kind === card.kind));
  const scoring = $derived(
    card.kind === 'nigiri'
      ? `${card.icons}`
      : card.kind === 'maki'
        ? `${card.icons} ◉`
        : card.kind === 'sashimi'
          ? '3 = 10'
          : card.kind === 'tempura'
            ? '2 = 5'
            : card.kind === 'dumpling'
              ? '1 · 3 · 6 · 10 · 15'
              : card.kind === 'pudding'
                ? '+6 / −6'
                : '×3',
  );
</script>

<div
  class="playing-card"
  class:compact
  class:selected
  class:newly-played={newlyPlayed}
  style:--card-color={tile?.color ?? '#f4dfb6'}
  style:--card-accent={tile?.accent ?? '#d5b885'}
>
  {#if !compact}<strong>{tile?.title ?? card.kind}</strong>{/if}
  <div class="card-art"><FoodArt {card} /></div>
  {#if !compact}<span class="scoring">{scoring}</span>{/if}
</div>

<style>
  .playing-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 8px 6px 6px;
    border: 1.5px solid #c3ac8a;
    border-bottom: 5px solid var(--card-accent);
    border-radius: 8px;
    background: linear-gradient(108deg, #fff7e5, #fbf0d7 57%, #eddfbf);
    box-shadow:
      inset 0 0 0 3px #fff9e6,
      1px 4px 3px #6b614338,
      1px 7px 10px #5c523121;
  }
  strong {
    font-size: 14px;
    line-height: 20px;
  }
  .card-art {
    width: 100%;
    height: 96px;
  }
  .scoring {
    display: block;
    width: 100%;
    padding: 3px 0;
    border-radius: 4px;
    background: var(--card-color);
    font-size: 13px;
    font-weight: 750;
    line-height: 17px;
    white-space: nowrap;
  }
  .selected {
    border-color: #ee847a;
    background: linear-gradient(115deg, #fffaf0, #ffe9dc);
    box-shadow:
      inset 0 0 0 3px #fffaf0,
      0 0 0 3px #d9ffff,
      0 0 18px 6px #abf1edaa,
      0 8px 7px #47685a44;
  }
  .compact {
    padding: 4px 2px;
    border-radius: 5px;
    border-bottom-width: 3px;
    background: linear-gradient(120deg, #fff3d7, var(--card-color));
  }
  .compact .card-art {
    width: 100%;
    height: 100%;
  }
  .newly-played {
    transform: translateY(-3px) rotate(-3deg);
    box-shadow:
      inset 0 0 0 2px #fff8e8,
      0 0 0 2px #f8f3d2aa,
      2px 7px 6px #6b61433b;
  }
  .newly-played::after {
    content: '';
    position: absolute;
    right: -4px;
    top: -10px;
    width: 8px;
    height: 7px;
    border-left: 2px solid #ebd28d;
    border-right: 2px solid #ebd28d;
    transform: rotate(24deg);
    border-radius: 2px;
  }
</style>
