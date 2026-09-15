<script lang="ts">
  import type { HandCard } from '../cards.js';
  import PlayingCard from './PlayingCard.svelte';
  let {
    cards,
    selectedHandle,
    onselect,
  }: {
    cards: HandCard[];
    selectedHandle: string;
    onselect: (handle: string) => void;
  } = $props();
</script>

<div class="local-hand" aria-label="Your private hand">
  {#each cards as card, i}
    <button
      aria-label={`Select ${card.kind}${card.variant ? ` ${card.variant}` : ''}`}
      aria-pressed={card.handle === selectedHandle}
      style:--angle={`${(i - (cards.length - 1) / 2) * 3}deg`}
      style:--rise={`${Math.abs(i - (cards.length - 1) / 2) * 6}px`}
      class:selected={card.handle === selectedHandle}
      onclick={() => onselect(card.handle)}
    >
      <PlayingCard {card} selected={card.handle === selectedHandle} />
    </button>
  {/each}
</div>

<style>
  .local-hand {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 188px;
  }
  button {
    position: relative;
    flex-shrink: 0;
    width: 90px;
    height: 151px;
    border: 0;
    padding: 0;
    border-radius: 8px;
    color: inherit;
    background: transparent;
    transform: translateY(var(--rise)) rotate(var(--angle));
    transform-origin: center 100%;
    text-align: center;
  }
  button.selected {
    transform: translateY(-5px) rotate(0);
    z-index: 2;
  }
  button:hover:enabled {
    background: transparent;
    transform: translateY(-8px) rotate(var(--angle));
    z-index: 3;
  }
  button:focus-visible {
    outline: 3px solid #247c78;
    outline-offset: 5px;
  }
</style>
