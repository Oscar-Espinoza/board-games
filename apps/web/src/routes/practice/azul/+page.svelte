<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { gameClients } from '$lib/games';
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/azul/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let Board = $state<Component<any> | null>(null),
    scenario = $state<Scenario>('start2'),
    round = $state(0),
    error = $state(''),
    locale = $state<Locale>(getLocale());
  let game = practice();
  let seat = $state(game.actor),
    view = $state(game.view(game.actor)),
    players = $state(game.players);
  const labels = {
    start2: m.azul_start2,
    start4: m.azul_start4,
    overflow: m.azul_overflow,
    scoring: m.azul_scoring,
    finish: m.azul_finish,
  };
  onMount(() => {
    gameClients
      .azul()
      .then((v) => (Board = v.default))
      .catch(() => (error = m.azul_error()));
  });
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
  function reset() {
    game = practice(scenario);
    seat = game.actor;
    players = game.players;
    view = game.view(seat);
    round++;
    error = '';
  }
  function changeSeat() {
    view = game.view(seat);
  }
  function send(action: unknown) {
    try {
      game.send(seat, action);
      view = game.view(seat);
      error = '';
    } catch {
      error = m.azul_error();
    }
  }
</script>

<svelte:head><title>Azul · {m.azul_practice()}</title></svelte:head>
<main class="azul-practice">
  {#if error}<p role="alert">{error}</p>{/if}{#if Board}{#key locale}<Board
        {view}
        playerId={seat}
        {players}
        {send}
        {round}
        {locale}
        practice={true}
        canConfigure={true}
      >
        {#snippet settingsContent()}<nav>
            <a href="/">{m.azul_back()}</a><label
              >{m.azul_scenario()}<select bind:value={scenario} onchange={reset}
                >{#each scenarios as id}<option value={id}
                    >{labels[id]()}</option
                  >{/each}</select
              ></label
            ><label
              >{m.azul_seat()}<select bind:value={seat} onchange={changeSeat}
                >{#each players as p}<option value={p.id}>{p.name}</option
                  >{/each}</select
              ></label
            ><button onclick={reset}>{m.azul_reset()}</button><label
              >{m.language()}<select
                value={locale}
                onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
                ><option value="en">EN</option><option value="es">ES</option
                ></select
              ></label
            >
          </nav>{/snippet}
      </Board>{/key}{/if}
</main>

<style>
  :global(body:has(.azul-practice) .site-header) {
    display: none;
  }
  .azul-practice {
    position: fixed;
    inset: 0;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  select,
  button {
    min-height: 44px;
    padding: 10px;
    border: 1px solid #9a987e;
    border-radius: 4px;
    background: #fff7e5;
    color: #17364b;
  }
  a {
    color: #245a74;
  }
  .azul-practice > p {
    position: absolute;
    z-index: 10;
    color: #fff;
    background: #743f30;
    padding: 10px;
    top: 45px;
    left: 15px;
  }
</style>
