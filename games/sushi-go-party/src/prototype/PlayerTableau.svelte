<script lang="ts">
  import type { PublicCard } from '../cards.js';
  import PlayingCard from './PlayingCard.svelte';
  let {
    cards,
    newlyPlayedId,
    compact = false,
  }: {
    cards: PublicCard[];
    newlyPlayedId?: string;
    compact?: boolean;
  } = $props();
</script>

<div class="tableau" class:compact aria-label="Collected dishes">
  {#each cards as card}<div
      class="dish"
      data-public-card={card.id}
      aria-label={`${card.id === newlyPlayedId ? 'Newly revealed ' : ''}${card.kind}`}
    >
      <PlayingCard {card} compact newlyPlayed={card.id === newlyPlayedId} />
    </div>{/each}
  {#if !compact}<div class="empty-space" aria-hidden="true"></div>{/if}
</div>

<style>
  .tableau {
    display: flex;
    gap: 5px;
    align-items: center;
    height: 90px;
  }
  .dish {
    width: 57px;
    height: 83px;
    flex-shrink: 0;
  }
  .empty-space {
    width: 52px;
    height: 82px;
    border: 2px dashed #ccbd9b88;
    border-radius: 6px;
    margin-left: 7px;
  }
  .compact {
    width: 99px;
    height: 89px;
    padding-right: 5px;
    flex-shrink: 0;
  }
  .compact .dish {
    width: 60px;
    height: 84px;
    margin-right: -45px;
    transform: rotate(-6deg);
  }
  .compact .dish:nth-child(2) {
    transform: rotate(0deg) translateY(-1px);
  }
  .compact .dish:last-child {
    transform: rotate(4deg) translateY(2px);
  }
</style>
