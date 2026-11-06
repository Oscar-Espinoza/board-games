<script lang="ts" generics="Scenario extends string">
  import { onMount, untrack, type Component, type Snippet } from 'svelte';
  import type { GameId } from '@board-games/shared';
  import { errorText, type PracticeTable } from '@board-games/shared/ui';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    locales,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import { gameClients } from '$lib/games';

  /**
   * The shell every `/practice/<id>` route shares: lazy table, seat, scenario, language,
   * reset and rule errors. Pages add their own controls and Board props.
   */
  let {
    game,
    title,
    start,
    scenarios = [],
    label = (scenario) => scenario,
    scenario = $bindable(scenarios[0]!),
    table = $bindable(),
    controls,
    boardProps = {},
  }: {
    game: GameId;
    title: string;
    start: (scenario: Scenario) => PracticeTable;
    scenarios?: readonly Scenario[];
    label?: (scenario: Scenario) => string;
    scenario?: Scenario;
    /** The live table, for pages that act on it themselves (call `refresh()` after). */
    table?: PracticeTable;
    controls?: Snippet;
    boardProps?: Record<string, unknown>;
  } = $props();

  let Board = $state<Component<any> | null>(null),
    loadingError = $state(''),
    error = $state(''),
    round = $state(0),
    version = $state(0),
    locale = $state<Locale>(getLocale());
  // Runs once: a `?scenario=` link opens that scenario directly.
  untrack(() => {
    const requested = new URLSearchParams(location.search).get('scenario');
    if (scenarios.includes(requested as Scenario))
      scenario = requested as Scenario;
    table = start(scenario);
  });
  let seat = $state(table!.actor);
  const view = $derived.by(() => {
    void version;
    return table!.view(seat);
  });
  const finished = $derived.by(() => {
    void version;
    return table!.finished;
  });

  onMount(() => {
    gameClients[game]
      .load()
      .then((module) => (Board = module.default))
      .catch((e: Error) => (loadingError = e.message));
  });
  let shown = table;
  /** Show the seat that must act next; call it after changing the table yourself. */
  export function refresh() {
    // A new table restarts revisions, so presentation starts over with a new round.
    if (table !== shown) {
      shown = table;
      round++;
    }
    seat = table!.actor;
    version++;
  }
  function reset() {
    table = start(scenario);
    error = '';
    refresh();
  }
  function chooseSeat(next: string) {
    seat = next;
    version++;
  }
  function send(action: unknown) {
    try {
      table!.send(seat, action);
      error = '';
      refresh();
    } catch (e) {
      error = errorText((e as Error).message, locale);
    }
  }
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
</script>

<svelte:head><title>{title}</title></svelte:head>
<main class="practice-route">
  {#if error}<p class="practice-error" role="alert">
      {error}<button
        type="button"
        aria-label={m.catan_dismiss_error()}
        onclick={() => (error = '')}>×</button
      >
    </p>{/if}
  {#if Board}{#key locale}<Board
        {view}
        playerId={seat}
        players={table!.players}
        {send}
        {round}
        {locale}
        practice={true}
        canConfigure={true}
        canRematch={finished}
        rematch={reset}
        {chooseSeat}
        {...boardProps}
      >
        {#snippet rulesContent()}<Rulebook {game} />{/snippet}
        {#snippet settingsContent()}<nav class="practice-controls">
            <a href="/">{m.back()}</a>
            {#if scenarios.length > 1}<select
                aria-label={m.practice_scenario()}
                bind:value={scenario}
                onchange={reset}
                >{#each scenarios as id}<option value={id}>{label(id)}</option
                  >{/each}</select
              >{/if}<select
              aria-label={m.practice_seat()}
              value={seat}
              onchange={(e) => chooseSeat(e.currentTarget.value)}
              >{#each table!.players as player}<option value={player.id}
                  >{player.name}</option
                >{/each}</select
            >{@render controls?.()}<button onclick={reset}
              >{m.practice_reset()}</button
            ><select
              aria-label={m.language()}
              value={locale}
              onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
              >{#each locales as code}<option value={code}
                  >{code.toUpperCase()}</option
                >{/each}</select
            >
          </nav>{/snippet}
      </Board>{/key}{:else if loadingError}<p
      class="practice-error"
      role="alert"
    >
      {loadingError}<button onclick={() => location.reload()}
        >{m.retry()}</button
      >
    </p>{:else}<p role="status">{m.loading()}</p>{/if}
</main>

<style>
  :global(body:has(.practice-route) .site-header) {
    display: none;
  }
  .practice-route {
    position: fixed;
    inset: 0;
  }
  .practice-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .practice-controls :is(select, button) {
    min-height: 44px;
    font: inherit;
  }
  .practice-error button {
    margin-left: 8px;
  }
  .practice-error {
    position: absolute;
    z-index: 10;
    top: 45px;
    left: 15px;
    margin: 0;
    padding: 10px;
    color: #fff;
    background: #743f30;
  }
</style>
