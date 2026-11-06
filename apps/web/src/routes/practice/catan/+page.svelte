<script lang="ts">
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/catan/practice';
  import { m } from '@board-games/shared/messages';
  import Practice from '$lib/practice/Practice.svelte';

  const labels = {
    setup: m.catan_sandbox_setup,
    building: m.catan_sandbox_building,
    production: m.catan_sandbox_production,
    robber: m.catan_sandbox_robber,
    monopoly: m.catan_sandbox_monopoly,
    trading: m.catan_sandbox_trading,
    awards: m.catan_sandbox_awards,
    victory: m.catan_sandbox_victory,
  };
  const hints = {
    setup: m.catan_hint_setup,
    building: m.catan_hint_building,
    production: m.catan_hint_production,
    robber: m.catan_hint_robber,
    monopoly: m.catan_hint_monopoly,
    trading: m.catan_hint_trading,
    awards: m.catan_hint_awards,
    victory: m.catan_hint_victory,
  };
  let scenario = $state<Scenario>('setup');
</script>

<Practice
  game="catan"
  title={m.catan_try()}
  start={practice}
  {scenarios}
  label={(id) => labels[id]()}
  bind:scenario
>
  {#snippet controls()}<p class="hint">{hints[scenario]()}</p>{/snippet}
</Practice>

<style>
  .hint {
    margin: 0;
    font-size: 12px;
  }
</style>
