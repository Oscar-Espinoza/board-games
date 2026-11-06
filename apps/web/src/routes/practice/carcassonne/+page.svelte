<script lang="ts">
  import Practice from '$lib/practice/Practice.svelte';
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/carcassonne/practice';
  import { m } from '@board-games/shared/messages';
  const labels: Record<Scenario, () => string> = {
    short: m.carc_short,
    match: m.carc_match,
    table: m.carc_table_scenario,
    builder: m.carc_builder,
    pig: m.carc_pig,
    flight: m.carc_flight,
    ferries: m.carc_ferries,
    gold: m.carc_gold,
    magic: m.carc_magic,
    messages: m.carc_messages,
    crops: m.carc_crops,
  };
</script>

<Practice
  game="carcassonne"
  title="Carcassonne · {m.carc_try()}"
  start={practice}
  {scenarios}
  label={(scenario) => labels[scenario]()}
/>
