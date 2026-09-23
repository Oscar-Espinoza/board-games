<script lang="ts">
  import Tile from './Tile.svelte';

  /** Loading cover: tiles stand up one by one as the table's art arrives. */
  let {
    progress = 0,
    label,
    leaving = false,
  }: { progress?: number; label: string; leaving?: boolean } = $props();
  const tiles: [number, number][] = [
    [6, 6],
    [6, 4],
    [4, 1],
    [1, 5],
    [5, 3],
    [3, 2],
    [2, 0],
  ];
  const shown = $derived(
    Math.max(1, Math.min(tiles.length, Math.ceil(progress * tiles.length))),
  );
</script>

<div class="loading" class:leaving role="status" aria-live="polite">
  <div class="row" aria-hidden="true">
    {#each tiles as [a, b], i}
      <span
        class="slot"
        class:in={i < shown}
        class:next={i === shown && progress < 1}
        style:--i={i}><Tile near={a} far={b} vertical /></span
      >
    {/each}
  </div>
  <p>{label}</p>
  <div class="bar" aria-hidden="true">
    <span style:--p={Math.max(0.04, progress)}></span>
  </div>
</div>

<style>
  @font-face {
    font-family: 'Domino Plaque';
    src: url('/fonts/carcassonne/marcellus.woff2') format('woff2');
    font-display: swap;
  }
  .loading {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 22px;
    background:
      radial-gradient(ellipse at 50% 45%, rgb(40 24 12 / 0.55), #0b0705 75%),
      url('/games/domino/patio.webp') center / cover,
      #0b0705;
    color: #f3e6cc;
    font-family: 'Domino Plaque', Georgia, serif;
    transition:
      opacity 0.5s ease,
      visibility 0.5s;
  }
  .loading::before {
    content: '';
    position: absolute;
    inset: 0;
    backdrop-filter: blur(10px) brightness(0.55);
  }
  .leaving {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .row,
  p,
  .bar {
    position: relative;
  }
  .row {
    display: flex;
    gap: 10px;
    height: 92px;
    align-items: flex-end;
  }
  .slot {
    display: block;
    width: 44px;
    height: 88px;
    border-radius: 7px;
    box-shadow:
      0 1px 0 #d8cdb1,
      0 2px 0 #c7b994,
      0 3px 0 #b8a983,
      0 10px 16px rgb(0 0 0 / 0.55);
    opacity: 0.08;
    transform: translateY(-26px) rotate(-8deg);
    transition:
      opacity 0.3s ease,
      transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  /* Tiles that arrive together still land one after another. */
  .slot.in {
    opacity: 1;
    transform: none;
    transition-delay: calc(var(--i) * 70ms);
  }
  .slot.next {
    animation: waiting 1.1s ease-in-out infinite;
  }
  @keyframes waiting {
    50% {
      opacity: 0.3;
      transform: translateY(-14px) rotate(-4deg);
    }
  }
  p {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.04em;
    text-shadow: 0 2px 6px #000;
  }
  .bar {
    width: min(320px, 70vw);
    height: 4px;
    border-radius: 2px;
    background: rgb(255 255 255 / 0.12);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #b9853d, #f0c46e);
    transform-origin: left;
    transform: scaleX(var(--p));
    transition: transform 0.35s ease;
  }
  @media (max-width: 520px) {
    .row {
      gap: 6px;
      height: 70px;
    }
    .slot {
      width: 32px;
      height: 64px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .slot.next {
      animation: none;
    }
    .slot,
    .bar span,
    .loading {
      transition: none;
    }
  }
</style>
