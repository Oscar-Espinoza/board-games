<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

{#if step === 2}<circle cx="60" cy="37" r="29" fill="#e6bb62" /><path
    d="M44 36l11 12 23-25"
    stroke="#fff6df"
    stroke-width="7"
    fill="none"
  />
{:else}<rect
    x="20"
    y="12"
    width="39"
    height="55"
    rx="5"
    fill="#b74935"
    stroke="#fff8df"
    stroke-width="3"
    transform="rotate(-10 40 40)"
  /><rect
    x="59"
    y="8"
    width="39"
    height="55"
    rx="5"
    fill={step === 0 ? '#477b92' : '#71905c'}
    stroke="#fff8df"
    stroke-width="3"
    transform="rotate(10 80 40)"
  /><text x="40" y="49">7</text><text x="79" y="44"
    >{step === 0 ? '7' : '↺'}</text
  >{/if}
