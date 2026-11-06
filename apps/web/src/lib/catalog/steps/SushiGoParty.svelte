<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

<ellipse
  cx="60"
  cy="44"
  rx="46"
  ry="24"
  fill="#f5ecd2"
  stroke="#a8c3aa"
  stroke-width="3"
/>
{#each [0, 1, 2] as i}<g
    transform={`translate(${26 + i * 25} ${step === 0 && i === 1 ? 15 : 28})`}
    ><rect
      width="22"
      height="30"
      rx="6"
      fill={step === 1 ? '#c68670' : '#31544b'}
    /><ellipse cx="11" cy="3" rx="11" ry="8" fill="#fff5dc" /><circle
      cx="11"
      cy="3"
      r="5"
      fill="#e8957d"
    /></g
  >{/each}
{#if step === 2}<path
    d="m19 63 12 5-1-10m1 10q37 9 67-15"
    fill="none"
    stroke="#bd6a57"
    stroke-width="3"
  />{/if}
