<script lang="ts">
  import { tick } from 'svelte';
  import Practice from '$lib/practice/Practice.svelte';
  import {
    practice,
    scenarios,
    SushiPractice,
    type Scenario,
  } from '@board-games/sushi-go-party/practice';
  import { m } from '@board-games/shared/messages';
  import { errorText, type PracticeTable } from '@board-games/shared/ui';
  const labels: Record<Scenario, () => string> = {
    table: m.sgp_table_scene,
    draft: m.sgp_scene_draft,
    wasabi: m.sgp_scene_wasabi,
    uramaki: m.sgp_scene_uramaki,
    miso: m.sgp_scene_miso,
    menu: m.sgp_scene_menu,
    spoon: m.sgp_scene_spoon,
    copy: m.sgp_scene_copy,
    takeout: m.sgp_scene_takeout,
  };
  let shell = $state<{ refresh(): void }>(),
    table = $state.raw<PracticeTable>(),
    scenario = $state<Scenario>('table'),
    guests = $state(5),
    stepping = $state(false),
    failure = $state('');
  const sushi = $derived(table as SushiPractice | undefined);

  function replace(next: SushiPractice) {
    table = next;
    failure = '';
    shell?.refresh();
  }
  async function step(seat: string) {
    if (stepping) return;
    stepping = true;
    try {
      await sushi!.step(seat, async () => {
        shell?.refresh();
        await tick();
      });
    } catch (e) {
      failure = errorText((e as Error).message);
    } finally {
      stepping = false;
    }
  }
</script>

<Practice
  bind:this={shell}
  bind:table
  bind:scenario
  game="sushi-go-party"
  title="Sushi Go Party! · {m.sgp_practice()}"
  start={(name) => practice(name, guests)}
  {scenarios}
  label={(name) => labels[name]()}
  boardProps={{
    practiceStep: {
      label: m.sgp_practice_step(),
      disabled: stepping,
      run: step,
    },
  }}
>
  {#snippet controls()}
    <label
      >{m.sgp_guests()}<select
        bind:value={guests}
        onchange={() => replace(practice(scenario, guests))}
        >{#each [2, 3, 4, 5, 6, 7, 8] as n}<option value={n}>{n}</option
          >{/each}</select
      ></label
    >
    <button onclick={() => replace(sushi!.setup())}
      >{m.sgp_practice_setup()}</button
    >
  {/snippet}
</Practice>
{#if failure}<p class="step-error" role="alert">{failure}</p>{/if}

<style>
  label {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .step-error {
    position: fixed;
    z-index: 30;
    top: 75px;
    left: 15px;
    margin: 0;
    padding: 8px;
    color: #7b372e;
    background: #f3d4c4;
  }
  @media (max-width: 1099px), (max-height: 679px) {
    :global(.practice-route .table-wordmark) {
      display: none;
    }
  }
</style>
