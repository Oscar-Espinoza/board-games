<script lang="ts">
  import type { PublicCard } from '../cards.js';
  import type { Locale } from '@board-games/shared/runtime';
  import { t } from '../labels.js';
  import Card from '../Card.svelte';
  import ScorePawn from './ScorePawn.svelte';
  import HiddenHand from './HiddenHand.svelte';
  let {
    name,
    score,
    color,
    count,
    tableau,
    saved,
    status,
    top = false,
    newlyPlayed = [],
    locale,
    onclick,
  }: {
    name: string;
    score: number;
    color: string;
    count: number;
    tableau: PublicCard[];
    saved: number;
    status: 'choosing' | 'ready' | 'passing';
    top?: boolean;
    newlyPlayed?: string[];
    locale: Locale;
    onclick: () => void;
  } = $props();
</script>

<button
  class="friend-plate"
  class:top
  {onclick}
  aria-label={`${name} · ${t('score', { score }, locale)} · ${t('tableau', {}, locale)}`}
>
  <div class="seat-info">
    <ScorePawn {color} />
    <strong class="friend-name" title={name}>{name}</strong>
    <span class="friend-score">{score} <span class="star">✦</span></span>
    <span class="seat-status" class:choosing={status === 'choosing'}
      >{t('table_' + status, {}, locale)}</span
    >
    <span class="count">{t('hand_count', { count }, locale)}</span>
  </div>
  <div class="seat-cards" aria-hidden="true">
    <div class="tableau">
      {#each tableau.slice(-3) as card}<span
          class="dish"
          class:settling={newlyPlayed.includes(card.id)}
          ><Card {card} {locale} small /></span
        >{/each}
      {#if !tableau.length}<span class="empty-dish"></span>{/if}
    </div>
    <HiddenHand {count} label={t('hand_count', { count }, locale)} />
  </div>
  {#if saved}<span class="saved" title={t('saved', { count: saved }, locale)}
      >♡ {saved}</span
    >{/if}
</button>

<style>
  .friend-plate {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    padding: 19px 22px;
    border: 3px solid #ccad7e;
    border-radius: 37% 28% 30% 27% / 21% 24% 28% 25%;
    background: radial-gradient(
      ellipse at 47% 45%,
      #fffae7 8%,
      #f5e8cd 63%,
      #e7c99b 85%,
      #ceab7a 97%
    );
    box-shadow:
      inset 0 0 0 6px #e5c498,
      inset 0 0 0 9px #f7e0b8,
      inset 0 -12px 7px #b5956144,
      0 5px 0 #a98560,
      3px 11px 9px #284b4044;
    color: #203f48;
    text-align: left;
  }
  .friend-plate:hover:enabled {
    transform: none;
    background: radial-gradient(
      ellipse at 47% 45%,
      #fffae7 8%,
      #f5e8cd 63%,
      #e7c99b 85%,
      #ceab7a 97%
    );
    filter: brightness(1.025);
  }
  .friend-plate:focus-visible {
    outline: 4px solid #b8eee4;
    outline-offset: 3px;
  }
  .seat-info {
    display: grid;
    grid-template-columns: 39px minmax(0, 1fr) auto;
    grid-template-rows: 36px 30px;
    column-gap: 9px;
    align-items: center;
  }
  .seat-info :global(.pawn) {
    grid-row: 1/3;
    align-self: start;
  }
  .friend-name {
    font:
      680 24px / 30px 'Party Table',
      sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .friend-score {
    font-size: 23px;
    font-weight: 680;
    white-space: nowrap;
  }
  .star {
    color: #efb462;
  }
  .seat-status {
    justify-self: start;
    grid-column: 2;
    background: linear-gradient(#83b8a9, #5fa49c);
    color: #fffdf1;
    font-size: 13px;
    font-weight: 700;
    padding: 7px 13px;
    border-radius: 20px;
    line-height: 16px;
    white-space: nowrap;
  }
  .choosing {
    background: linear-gradient(#f49b87, #e97c70);
  }
  .count {
    font-size: 16px;
    color: #767462;
    justify-self: end;
    white-space: nowrap;
  }
  .seat-cards {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    margin-top: 11px;
  }
  .tableau {
    display: flex;
    width: 99px;
    height: 86px;
    flex-shrink: 0;
    align-items: center;
    padding-right: 5px;
  }
  .dish {
    display: block;
    margin-right: -42px;
    transform: rotate(-5deg);
    --small-card-width: 60px;
    --small-card-height: 83px;
  }
  .dish:nth-child(2) {
    transform: none;
  }
  .dish:last-child {
    transform: rotate(3deg);
  }
  .dish :global(.food-card strong) {
    display: none;
  }
  .dish :global(.small .illustration) {
    height: 70px;
    width: 100%;
  }
  .empty-dish {
    width: 59px;
    height: 81px;
    border: 2px dashed #c4b39266;
    border-radius: 5px;
  }
  .saved {
    position: absolute;
    right: 30px;
    bottom: 6px;
    font-size: 12px;
    color: #8f7660;
  }
  .top {
    padding: 35px 24px 12px;
  }
  .top .seat-info {
    display: flex;
    gap: 12px;
    height: 31px;
  }
  .top .seat-info :global(.pawn) {
    width: 33px;
    height: 44px;
    margin-top: -7px;
  }
  .top .friend-name {
    font-size: 23px;
  }
  .top .count {
    margin-left: auto;
  }
  .top .seat-cards {
    margin-top: 3px;
    justify-content: center;
    gap: 12px;
  }
  .top .tableau {
    width: 129px;
  }
  .top .dish {
    margin-right: -26px;
  }
  .settling {
    animation: settle-dish 650ms both;
  }
  @keyframes settle-dish {
    from {
      transform: translateY(-18px) rotate(-6deg);
      filter: brightness(1.15);
    }
    to {
      transform: translateY(0) rotate(3deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .settling {
      animation: none;
    }
  }
</style>
