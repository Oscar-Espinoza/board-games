<script lang="ts">
  import Tile from './Tile.svelte';
  import { tileUrl } from './pixel/sprites.js';

  /** Loading cover: tiles stand up one by one as the table's art arrives. */
  let {
    progress = 0,
    label,
    leaving = false,
    pixel = false,
  }: {
    progress?: number;
    label: string;
    leaving?: boolean;
    pixel?: boolean;
  } = $props();
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

<div class="loading" class:leaving class:pixel role="status" aria-live="polite">
  <div class="row" aria-hidden="true">
    {#each tiles as [a, b], i}
      <span
        class="slot"
        class:in={i < shown}
        class:next={i === shown && progress < 1}
        style:--i={i}
        >{#if pixel}<img src={tileUrl(a, b)} alt="" />{:else}<Tile
            near={a}
            far={b}
            vertical
          />{/if}</span
      >
    {/each}
  </div>
  <p>{label}</p>
  <div class="bar" aria-hidden="true">
    <span style:--p={Math.max(0.04, progress)}></span>
  </div>
</div>

<style>
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
  /* 8-bit: the pixel patio, hard shadows and stepped motion. */
  .pixel {
    background:
      linear-gradient(rgb(14 10 18 / 0.72), rgb(14 10 18 / 0.72)),
      url('/games/domino/pixel/patio.webp') center / cover,
      #0e0a12;
    image-rendering: pixelated;
    font-family: 'Pixelify Sans', monospace;
    transition-timing-function: steps(4, jump-end);
  }
  .pixel::before {
    display: none;
  }
  .pixel .slot {
    border-radius: 0;
    box-shadow: 4px 4px 0 rgb(0 0 0 / 0.5);
    transform: translateY(-26px);
    transition:
      opacity 0.3s steps(3, jump-end),
      transform 0.4s steps(4, jump-end);
  }
  .pixel .slot.in {
    transform: none;
  }
  .pixel .slot.next {
    animation: waiting-8 0.8s steps(2, jump-none) infinite;
  }
  @keyframes waiting-8 {
    50% {
      opacity: 0.3;
      transform: translateY(-12px);
    }
  }
  .pixel img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
  .pixel p {
    text-transform: uppercase;
    text-shadow: 2px 2px 0 #000;
  }
  .pixel .bar {
    height: 12px;
    border: 2px solid #1e110a;
    border-radius: 0;
    background: #2a1a10;
  }
  .pixel .bar span {
    background: repeating-linear-gradient(
      90deg,
      #f2c14e 0 10px,
      #2a1a10 10px 12px
    );
    transition: transform 0.35s steps(5, jump-end);
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
