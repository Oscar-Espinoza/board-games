<script lang="ts">
  import Board from '@board-games/little-secret/Board.svelte';
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/little-secret/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let scenario = $state<Scenario>('basic'),
    round = $state(0),
    game = practice(),
    seat = $state(game.actor),
    view = $state(game.view(game.actor)),
    seats = $state(game.seats),
    locale = $state(getLocale());
  function reset() {
    game = practice(scenario, locale === 'es' ? 'es' : 'en');
    seats = game.seats;
    seat = game.actor;
    view = game.view(seat);
    round++;
  }
  function send(action: unknown) {
    game.send(seat, action);
    seat = game.actor;
    view = game.view(seat);
  }
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
</script>

<svelte:head
  ><title>Little Secret · {m.ls_practice({}, { locale })}</title></svelte:head
>
{#key locale}<Board
    {view}
    playerId={seat}
    players={seats}
    {send}
    {round}
    practice
    canConfigure={seat === seats[0]?.id}
    canRematch
    rematch={async () => reset()}
    {locale}
  >
    {#snippet settingsContent()}<nav>
        <a href="/">{m.back()}</a><label
          >{m.ls_scenario()}<select
            aria-label={m.ls_scenario()}
            bind:value={scenario}
            onchange={reset}
            >{#each scenarios as id}<option value={id}
                >{m[`ls_scenario_${id}`]()}</option
              >{/each}</select
          ></label
        ><label
          >{m.ls_actor()}<select
            aria-label={m.ls_actor()}
            bind:value={seat}
            onchange={() => (view = game.view(seat))}
            >{#each seats as p}<option value={p.id}>{p.name}</option
              >{/each}</select
          ></label
        ><button onclick={reset}>{m.ls_reset()}</button><label
          >{m.language()}<select
            aria-label={m.language()}
            value={locale}
            onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
            ><option value="en">EN</option><option value="es">ES</option
            ></select
          ></label
        >
      </nav>{/snippet}
  </Board>{/key}

<style>
  nav {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 6px;
  }
  select,
  button {
    font: inherit;
    min-height: 44px;
    padding: 6px;
    max-width: 100%;
  }
  a {
    color: #245c97;
  }
</style>
