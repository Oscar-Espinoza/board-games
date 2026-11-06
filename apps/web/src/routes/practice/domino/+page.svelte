<script lang="ts">
  import Practice from '$lib/practice/Practice.svelte';
  import { practice } from '@board-games/domino/practice';
  import { m } from '@board-games/shared/messages';
</script>

<Practice
  game="domino"
  title="Dominó · {m.domino_practice()}"
  start={practice}
/>
