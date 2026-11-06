<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import { getLocale } from '@board-games/shared/runtime';
  import { practice, scenarios } from '@board-games/little-secret/practice';
  import Practice from '$lib/practice/Practice.svelte';
</script>

<Practice
  boardReports
  game="little-secret"
  title={() => `Little Secret · ${m.ls_practice()}`}
  start={(scenario) => practice(scenario, getLocale() === 'es' ? 'es' : 'en')}
  {scenarios}
  label={(id) => m[`ls_scenario_${id}`]()}
/>
