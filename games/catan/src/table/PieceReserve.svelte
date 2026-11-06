<script lang="ts">
  import { useSkin } from './skin.js';
  import { ink } from './shapes.js';
  import { shade } from './artwork.js';
  import { ramp, sprites } from '../pixel/sprites.js';
  let {
    color,
    roads,
    settlements,
    cities,
  }: { color: string; roads: number; settlements: number; cities: number } =
    $props();
  const pixel = useSkin();
  const palette = $derived(ramp(color));
</script>

{#if pixel()}
  <!-- 8-bit: the same hand-pixelled pieces as the island, in art pixels. -->
  <svg
    class="px-reserve"
    viewBox="0 0 92 46"
    aria-hidden="true"
    shape-rendering="crispEdges"
  >
    {#each Array(Math.max(0, settlements)) as _, i}<g
        transform={`translate(${(i % 3) * 16} ${Math.floor(i / 3) * 16})`}
        >{#each sprites.settlement.layers as layer}<path
            d={layer.d}
            fill={palette[layer.key]}
          />{/each}</g
      >{/each}
    {#each Array(Math.max(0, cities)) as _, i}<g
        transform={`translate(${50 + (i % 2) * 21} ${Math.floor(i / 2) * 20})`}
        >{#each sprites.city.layers as layer}<path
            d={layer.d}
            fill={palette[layer.key]}
          />{/each}</g
      >{/each}
    {#each Array(Math.max(0, roads)) as _, i}<g
        transform={`translate(${(i % 5) * 9} ${34 + Math.floor(i / 5) * 4})`}
        ><rect width="8" height="3" fill={ink} /><rect
          x="1"
          y="1"
          width="6"
          height="1"
          fill={color}
        /></g
      >{/each}
  </svg>
{:else}
  <svg viewBox="0 0 180 125" aria-hidden="true" style:color>
    {#each Array(Math.max(0, settlements)) as _, i}<g
        transform={`translate(${20 + (i % 3) * 32} ${24 + Math.floor(i / 3) * 28})`}
        ><path d="M-10 10V-7L0-15 10-7V10Z" fill="currentColor" /><path
          d="m0-15 8-4 10 8-8 4Z"
          fill={shade(color, 1.3)}
        /><path d="m10-7 8-4v21l-8 0Z" fill={shade(color, 0.65)} /></g
      >{/each}
    {#each Array(Math.max(0, cities)) as _, i}<g
        transform={`translate(${118 + (i % 2) * 30} ${23 + Math.floor(i / 2) * 29})`}
        ><path d="M-10 10V-12H0V0H10V10Z" fill="currentColor" /><path
          d="m-10-12 7-4h10v12h10L10 0H0v-12Z"
          fill={shade(color, 1.3)}
        /><path d="m10 0 7-4v10l-7 4Z" fill={shade(color, 0.65)} /></g
      >{/each}
    {#each Array(Math.max(0, roads)) as _, i}<g
        transform={`translate(${16 + (i % 5) * 29} ${83 + Math.floor(i / 5) * 10})`}
        ><path d="m0 0 24-8 4 5L4 5Z" fill="currentColor" /><path
          d="m4 5 24-8v4L4 9Z"
          fill={shade(color, 0.65)}
        /><path d="M0 0 4 5v4L0 4Z" fill={shade(color, 1.2)} /></g
      >{/each}
  </svg>
{/if}

<style>
  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(3px 6px 2px #140b08ab);
  }
  .px-reserve {
    filter: none;
  }
</style>
