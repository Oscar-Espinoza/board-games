<script lang="ts">
  import type { Color } from './index.js';
  import { m } from '@board-games/shared/messages';
  let {
    color,
    ghost = false,
    location,
  }: { color: Color | 'marker'; ghost?: boolean; location?: string } = $props();
  const labels = {
    blue: m.azul_blue,
    yellow: m.azul_yellow,
    red: m.azul_red,
    black: m.azul_black,
    white: m.azul_white,
    marker: m.azul_marker,
  };
</script>

<span
  class="tile {color}"
  class:ghost
  data-azul-location={location}
  role="img"
  aria-label={labels[color]()}
>
  <svg viewBox="0 0 40 40" aria-hidden="true">
    {#if color === 'blue'}<path
        d="M20 5 35 20 20 35 5 20Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      /><path d="m20 11 9 9-9 9-9-9Z" fill="currentColor" />
    {:else if color === 'yellow'}<circle
        cx="20"
        cy="20"
        r="7"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />{#each [0, 45, 90, 135] as a}<path
          d="M20 4V10M20 30V36"
          transform="rotate({a} 20 20)"
          stroke="currentColor"
          stroke-width="2"
        />{/each}
    {:else if color === 'red'}<path
        d="m5 14 15 10 15-10M5 23l15 10 15-10M5 5l15 10L35 5"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
      />
    {:else if color === 'black'}<path
        d="m0 10 30 30M0 0l40 40M10 0l30 30M0 30 30 0M0 40 40 0M10 40l30-30"
        stroke="currentColor"
        stroke-width="1.5"
      />
    {:else if color === 'white'}{#each [0, 90, 180, 270] as a}<path
          d="M20 20C3 19 10 0 20 8c10-8 17 11 0 12Z"
          transform="rotate({a} 20 20)"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />{/each}<circle cx="20" cy="20" r="3" fill="currentColor" />
    {:else}<text
        x="20"
        y="29"
        text-anchor="middle"
        fill="currentColor"
        font-size="28"
        font-family="Georgia">1</text
      >{/if}
  </svg>
</span>

<style>
  .tile {
    display: inline-flex;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
    align-items: center;
    justify-content: center;
    border-radius: 14%;
    border: 1px solid #0005;
    box-sizing: border-box;
    box-shadow:
      inset 0 2px 1px #fff9,
      inset 0 -3px 2px #0004,
      1px 3px 3px #0004;
    background:
      linear-gradient(145deg, #ffffff22, transparent 60%), var(--glaze);
    color: var(--motif);
    vertical-align: middle;
  }
  .tile svg {
    width: 90%;
    height: 90%;
  }
  .blue {
    --glaze: #1766a0;
    --motif: #c9e5f4;
  }
  .yellow {
    --glaze: #edb737;
    --motif: #7d5015;
  }
  .red {
    --glaze: #ae4235;
    --motif: #ffddbb;
  }
  .black {
    --glaze: #24313b;
    --motif: #d6b893;
  }
  .white {
    --glaze: #faf2da;
    --motif: #368c9e;
  }
  .marker {
    --glaze: #f5e8c9;
    --motif: #15364c;
    border-radius: 50%;
  }
  .ghost {
    opacity: 1;
    box-shadow: none;
    border: 1px dashed #8a9b9e;
    background: color-mix(in srgb, var(--glaze) 12%, #f6ebd2);
    color: #386174;
  }
</style>
