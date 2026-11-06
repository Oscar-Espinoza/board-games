<script lang="ts">
  import { steps } from './steps';
  import type { GameId } from './types';
  let { game, step }: { game: GameId; step: number } = $props();
  const Step = $derived(steps[game]);
</script>

<svg viewBox="0 0 120 78" aria-hidden="true">
  <Step {step} />
</svg>

<style>
  svg {
    display: block;
    width: 110px;
    max-width: 100%;
    height: 78px;
  }
  svg :global(text) {
    font-family: system-ui, sans-serif;
    font-size: 25px;
    font-weight: 800;
    fill: #fff6df;
    text-anchor: middle;
  }
</style>
