<script lang="ts">
  import { getContext } from 'svelte';
  import { palette, richTileArtwork, skinKey } from './palette.js';
  import type { Color } from './index.js';
  import { m } from '@board-games/shared/messages';
  let {
    color,
    ghost = false,
    location,
  }: { color: Color | 'marker'; ghost?: boolean; location?: string } = $props();
  const pixel = getContext<(() => boolean) | undefined>(skinKey);
  const labels = {
    blue: m.azul_blue,
    yellow: m.azul_yellow,
    red: m.azul_red,
    black: m.azul_black,
    white: m.azul_white,
    marker: m.azul_marker,
  };
</script>

{#if pixel?.()}<span
    class="px-tile px-{color}"
    class:px-ghost={ghost}
    data-azul-location={location}
    role="img"
    aria-label={labels[color]()}
    >{#if color === 'marker'}<b aria-hidden="true">1</b>{/if}</span
  >{:else}<span
    class="tile {color}"
    class:ghost
    style="--glaze:{palette[color].glaze};--motif:{palette[color].motif}"
    data-azul-location={location}
    role="img"
    aria-label={labels[color]()}
  >
    {#if color === 'marker'}<svg viewBox="0 0 40 40" aria-hidden="true"
        ><text
          x="20"
          y="29"
          text-anchor="middle"
          fill="currentColor"
          font-size="28"
          font-family="Georgia">1</text
        ></svg
      >{:else}<img
        src={richTileArtwork[color]}
        alt=""
        aria-hidden="true"
        draggable="false"
      />{/if}
  </span>{/if}

<style>
  .tile {
    display: inline-grid;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    box-sizing: border-box;
    place-items: center;
    color: var(--motif);
    filter: drop-shadow(1.5px 3px 2px rgba(0, 4, 8, 0.72));
    vertical-align: middle;
  }
  .tile img {
    display: block;
    width: 112%;
    height: 112%;
    max-width: none;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
  }
  .tile svg {
    width: 90%;
    height: 90%;
  }
  .marker {
    border: 2px solid #b58b49;
    border-radius: 50%;
    background: #08263d;
    box-shadow:
      inset 2px 2px 3px rgba(255, 228, 177, 0.36),
      2px 4px 4px rgba(0, 0, 0, 0.55);
    filter: none;
  }
  .ghost {
    opacity: 0.18;
    filter: grayscale(0.2) saturate(0.55) contrast(0.85);
  }
</style>
