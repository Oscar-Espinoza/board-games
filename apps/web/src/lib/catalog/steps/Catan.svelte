<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

{#if step === 0}{#each ['#668652', '#bf7e55', '#d4ad57'] as c, i}<rect
      x={22 + i * 26}
      y={15 + (i % 2) * 6}
      width="32"
      height="46"
      rx="4"
      fill={c}
      stroke="#fff1d5"
      stroke-width="2"
    /><path
      d="M{38 + i * 26} {26 + (i % 2) * 6}v24"
      stroke="#fff1d5"
      stroke-width="3"
    />{/each}
{:else if step === 1}<path
    d="M18 61l43-25 42 25"
    stroke="#a34732"
    stroke-width="7"
    fill="none"
  /><path
    d="M42 42V22L60 8l18 14v20Z"
    fill="#a34732"
    stroke="#fff1d5"
    stroke-width="3"
  />
{:else}<path
    d="M60 4l13 19 25 5-15 19 2 25-25-10-25 10 2-25-15-19 25-5Z"
    fill="#d4ad57"
  /><text x="60" y="47">10</text>{/if}
