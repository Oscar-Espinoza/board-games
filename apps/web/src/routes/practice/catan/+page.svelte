<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { gameClients } from '$lib/games';
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  let Board = $state<Component<any> | null>(null);
  let loadingError = $state('');
  onMount(() => {
    gameClients
      .catan()
      .then((module) => {
        Board = module.default;
      })
      .catch((error: Error) => {
        loadingError = error.message;
      });
  });
  import {
    practice,
    practiceSeat,
    seats,
    scenarios,
    type Scenario,
  } from '@board-games/catan/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let scenario = $state<Scenario>('setup');
  let game = practice('setup');
  let seat = $state(game.state.phase.player!);
  let view = $state(game.view(game.state.phase.player!));
  let round = $state(0);
  let error = $state('');
  let autoRotate = $state(true);
  function chooseSeat(id: string) {
    seat = id;
    view = game.view(seat);
    error = '';
  }
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
  function reset() {
    game = practice(scenario);
    seat = game.state.phase.player!;
    view = game.view(seat);
    round++;
    error = '';
  }
  function send(action: any) {
    try {
      const previous = practiceSeat(game.state, seat);
      game.send(seat, action);
      const next = practiceSeat(game.state, seat);
      if (
        autoRotate &&
        (next !== previous ||
          game.state.phase.type === 'discard' ||
          action.type === 'DISCARD')
      )
        seat = next;
      view = game.view(seat);
      error = '';
    } catch {
      error = m.catan_practice_error();
    }
  }
</script>

<svelte:head><title>{m.catan_try()}</title></svelte:head>
<main class="practice">
  {#if error}<p class="practice-error" role="alert">
      {error}<button
        type="button"
        aria-label={m.catan_dismiss_error()}
        onclick={() => (error = '')}>×</button
      >
    </p>{/if}
  {#if Board}<Board
      {view}
      playerId={seat}
      players={seats}
      {send}
      {round}
      {chooseSeat}
      locale={getLocale()}
    >
      {#snippet rulesContent()}<Rulebook game="catan" />{/snippet}
      {#snippet settingsContent()}
        <hr />
        <label class="auto-rotate"
          ><input
            type="checkbox"
            bind:checked={autoRotate}
            onchange={() => {
              if (autoRotate) chooseSeat(practiceSeat(game.state, seat));
            }}
          />{m.catan_auto_rotate()}</label
        >
        <label
          >{m.you()}<select
            aria-label={m.you()}
            bind:value={seat}
            onchange={() => {
              view = game.view(seat);
              error = '';
            }}
            >{#each seats as p}<option value={p.id}>{p.name}</option
              >{/each}</select
          ></label
        >
        <label
          >{m.catan_scenario()}<select
            aria-label={m.catan_scenario()}
            bind:value={scenario}
            onchange={reset}
            >{#each scenarios as id}<option value={id}>{labels[id]()}</option
              >{/each}</select
          ></label
        >
        <p>{hints[scenario]()}</p>
        <button onclick={reset}>{m.catan_reset()}</button>
      {/snippet}
    </Board>{:else if loadingError}<p role="alert">{loadingError}</p>
    <button onclick={() => location.reload()}>{m.retry()}</button>{:else}<p
      role="status"
    >
      {m.loading()}
    </p>{/if}
</main>

<style>
  :global(body:has(.practice) .site-header) {
    display: none;
  }
  .practice {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #123f50;
  }
  label {
    margin: 12px 0;
  }
  select {
    color: #163d45;
    padding: 6px;
  }
  p {
    font-size: 12px;
  }
  .practice-error {
    position: absolute;
    z-index: 20;
    top: 60px;
    background: #f6dfd9;
    color: #832d25;
    padding: 8px;
  }
</style>
