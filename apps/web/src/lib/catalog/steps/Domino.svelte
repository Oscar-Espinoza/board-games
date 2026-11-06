<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

{#each step === 0 ? [[26, 39, 0]] : step === 1 ? [[26, 39, 0], [60, 39, 0]] : [[26, 39, -10], [62, 44, 14], [92, 30, 60]] as [x, y, r]}<g
    transform={`translate(${x} ${y}) rotate(${r})`}
    ><rect
      x="-16"
      y="-8"
      width="32"
      height="16"
      rx="3"
      fill="#f6efdc"
      stroke="#b9a77c"
    /><path d="M0-6v12" stroke="#3a2f22" /><circle
      cx="-8"
      r="2"
      fill="#1c1712"
    /><circle cx="8" r="2" fill="#1c1712" /></g
  >{/each}
