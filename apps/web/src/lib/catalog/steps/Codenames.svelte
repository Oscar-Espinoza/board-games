<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

<rect
  x="6"
  y="5"
  width="108"
  height="68"
  rx="6"
  fill="#203847"
/>{#each Array.from({ length: 6 }, (_, i) => i) as i}<rect
    x={15 + (i % 3) * 31}
    y={14 + Math.floor(i / 3) * 27}
    width="27"
    height="22"
    rx="3"
    fill={step === 2 && i === 4 ? '#a93645' : '#f5eedc'}
  />{/each}{#if step === 1}<path
    d="M49 43h25v22H49z"
    fill="none"
    stroke="#b88b47"
    stroke-width="3"
  />{/if}
