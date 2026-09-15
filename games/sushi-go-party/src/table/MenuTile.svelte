<script lang="ts">
  import FoodArt from './FoodArt.svelte';
  import type { MenuTileData } from './data.js';
  let { tile }: { tile: MenuTileData } = $props();
</script>

<article
  class="menu-tile"
  style:--tile-color={tile.color}
  style:--tile-accent={tile.accent}
  data-menu-kind={tile.kind}
>
  <h2>{tile.title}</h2>
  <div class="art">
    <FoodArt card={{ kind: tile.kind, variant: 'salmon' }} trio />
  </div>
  <p>
    {#each tile.rules as line}<span>{line}</span>{/each}
  </p>
</article>

<style>
  .menu-tile {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: 22px minmax(0, 1fr) 31px;
    padding: 5px 7px 6px;
    border-radius: 10px 9px 8px 9px;
    background:
      radial-gradient(ellipse at 35% 20%, #fff6 0, transparent 70%),
      var(--tile-color);
    border: 2px solid var(--tile-accent);
    box-shadow:
      inset 1px 2px 1px #fff9,
      0 3px 0 #283e36,
      0 5px 5px #122c3438;
    text-align: center;
  }
  h2 {
    font:
      700 18px / 22px 'Party Table',
      sans-serif;
    margin: 0;
  }
  .art {
    width: 137px;
    height: 100%;
    min-height: 0;
    max-width: 100%;
    margin: auto;
  }
  p {
    margin: 0;
    align-self: center;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.12;
  }
  p span {
    display: block;
  }
</style>
