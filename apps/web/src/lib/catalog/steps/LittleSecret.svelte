<svelte:options namespace="svg" />

<script lang="ts">
  let { step }: { step: number } = $props();
</script>

<rect
  x="12"
  y="12"
  width="96"
  height="56"
  rx="3"
  fill="#eadbb9"
  stroke="#af9063"
/><path
  d="M12 12l48 35 48-35M12 68l32-28m64 28L76 40"
  fill="none"
  stroke="#af9063"
/><circle cx="60" cy="45" r="13" fill="#823f3b" /><text x="60" y="54"
  >{['?', '♪', '✓'][step]}</text
>
