<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

<circle
  cx="60"
  cy="39"
  r="35"
  fill="#eee4c8"
  stroke="#a67b35"
  stroke-width="2"
/>
{#each [0, 1, 2, 3] as i}<rect
    x={35 + (i % 2) * 26}
    y={15 + Math.floor(i / 2) * 26}
    width="23"
    height="23"
    rx="3"
    fill={['#246c99', '#e7b03f', '#b8493d', '#263b47'][step === 0 ? i : 0]}
  /><path
    d="m{46 + (i % 2) * 26} {18 + Math.floor(i / 2) * 26} 8 8-8 8-8-8Z"
    fill="none"
    stroke="#f5e2b6"
  />{/each}
{#if step === 2}<text x="94" y="62" fill="#194766">+7</text>{/if}
