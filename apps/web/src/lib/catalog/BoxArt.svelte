<script lang="ts">
  import { covers } from './covers';
  import type { GameId } from './types';
  let { game }: { game: GameId } = $props();
  const Cover = $derived(covers[game]);
</script>

<svg viewBox="0 0 360 400" fill="none" aria-hidden="true">
  <Cover />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    font-family: system-ui, sans-serif;
  }
</style>
