<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { gameClients } from '$lib/games';
  import {
    practice,
    seats,
    tableSeats,
    scenarios,
    type Scenario,
  } from '@board-games/carcassonne/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let Board = $state<Component<any> | null>(null),
    error = $state(''),
    scenario = $state<Scenario>('short'),
    round = $state(0);
  let game = practice();
  const visibleSeats = $derived(scenario === 'table' ? tableSeats : seats);
  let seat = $state(game.actor),
    view = $state(game.view(game.actor));
  onMount(() => {
    const requested = new URLSearchParams(location.search).get('scenario');
    if (scenarios.includes(requested as Scenario)) {
      scenario = requested as Scenario;
      reset();
    }
    gameClients
      .carcassonne()
      .then((v) => (Board = v.default))
      .catch((e) => (error = e.message));
  });
  const scenarioLabel = (id: Scenario) =>
    ({
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
    })[id]();
  function reset() {
    game = practice(scenario);
    seat = game.actor;
    view = game.view(seat);
    error = '';
    round++;
  }
  function send(action: unknown) {
    try {
      if (
        view.public.phase === 'setup' &&
        action &&
        typeof action === 'object' &&
        'type' in action &&
        action.type === 'ready'
      ) {
        const version = view.public.setupVersion;
        for (const player of visibleSeats)
          game.send(player.id, { type: 'ready', version });
      } else game.send(seat, action);
      seat = game.actor;
      view = game.view(seat);
      error = '';
    } catch {
      error = m.carc_error();
    }
  }
</script>

<svelte:head><title>Carcassonne · {m.carc_try()}</title></svelte:head>
<main class="practice">
  {#if error}<p role="alert">{error}</p>{/if}{#if Board}<Board
      {view}
      playerId={seat}
      players={visibleSeats}
      {send}
      {round}
      locale={getLocale()}
      canConfigure={true}
      practice={true}
    >
      {#snippet settingsContent()}
        <nav>
          <a href="/">{m.back()}</a><span>{m.carc_practice()}</span><select
            aria-label={m.carc_match()}
            bind:value={scenario}
            onchange={reset}
            >{#each scenarios as id}<option value={id}
                >{scenarioLabel(id)}</option
              >{/each}</select
          ><button onclick={reset} aria-label={m.carc_reset()}>↻</button><select
            aria-label={m.language()}
            value={getLocale()}
            onchange={(e) => setLocale(e.currentTarget.value as Locale)}
            ><option value="en">EN</option><option value="es">ES</option
            ></select
          >
        </nav>{/snippet}
    </Board>{/if}
</main>

<style>
  :global(body:has(.practice) .site-header) {
    display: none;
  }
  .practice {
    position: fixed;
    inset: 0;
    background: #302014;
    color: #f1e5c9;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    flex-wrap: wrap;
    box-sizing: border-box;
    font-size: 11px;
  }
  nav span {
    opacity: 0.6;
    margin-right: auto;
  }
  select,
  button {
    font: inherit;
    background: #34291e;
    color: #f1e5c9;
    border: 1px solid #e9dcb330;
    padding: 7px;
    max-width: 220px;
  }
  p[role='alert'] {
    position: absolute;
    top: 60px;
    left: 20px;
    z-index: 10;
    background: #f2d7ba;
    color: #723f33;
    padding: 12px;
  }
  @media (max-width: 650px) {
    nav {
      padding: 7px 10px;
      gap: 7px;
    }
    nav span {
      display: none;
    }
    select {
      max-width: 190px;
      font-size: 10px;
    }
  }
</style>
