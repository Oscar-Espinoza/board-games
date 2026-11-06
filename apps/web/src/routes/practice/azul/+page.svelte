<script lang="ts">
  import Practice from '$lib/practice/Practice.svelte';
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/azul/practice';
  import { m } from '@board-games/shared/messages';
  const labels: Record<Scenario, () => string> = {
    start2: m.azul_start2,
    start4: m.azul_start4,
    start3: m.azul_start3,
    crowded: m.azul_crowded,
    cleanup: m.azul_cleanup,
    no_wall: m.azul_no_wall,
    cross100: m.azul_cross100,
    overflow: m.azul_overflow,
    scoring: m.azul_scoring,
    finish: m.azul_finish,
  };
</script>

<Practice
  game="azul"
  title={() => `Azul · ${m.azul_practice()}`}
  start={practice}
  {scenarios}
  label={(scenario) => labels[scenario]()}
/>
