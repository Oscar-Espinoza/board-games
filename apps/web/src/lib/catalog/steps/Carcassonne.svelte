<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

<rect
  x="13"
  y="13"
  width="50"
  height="50"
  rx="3"
  fill="#93a773"
  stroke="#f8e5b8"
  stroke-width="3"
/><path d="M14 40h48" stroke="#e7ce99" stroke-width="9" />
{#if step === 0}<rect
    x="65"
    y="13"
    width="50"
    height="50"
    rx="3"
    fill="#a3b57d"
    stroke="#f8e5b8"
    stroke-width="3"
  /><path d="M66 40h48" stroke="#e7ce99" stroke-width="9" />
{:else if step === 1}<path
    d="M72 26a9 9 0 1 1 14 0l17 11-7 9-10-6 5 24H67l5-24-10 6-7-9Z"
    fill="#a34732"
    stroke="#ffedc6"
    stroke-width="2"
  />
{:else}<circle cx="88" cy="39" r="24" fill="#d4ad57" /><text x="88" y="48"
    >+3</text
  >{/if}
