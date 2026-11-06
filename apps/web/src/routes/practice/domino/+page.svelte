<script lang="ts">
  import Practice from '$lib/practice/Practice.svelte';
  import { practice } from '@board-games/domino/practice';
  import { m } from '@board-games/shared/messages';
  import type { PracticeTable } from '@board-games/shared/ui';

  let shell = $state<{ refresh(): void }>(),
    table = $state.raw<PracticeTable>();
  const generation = $derived(
    (table as ReturnType<typeof practice> | undefined)?.generation ?? 0,
  );
  function rematch() {
    table = practice();
    shell?.refresh();
  }
</script>

<Practice
  bind:this={shell}
  bind:table
  game="domino"
  title="Dominó · {m.domino_practice()}"
  start={practice}
  boardProps={{ round: generation, canRematch: true, rematch }}
/>
