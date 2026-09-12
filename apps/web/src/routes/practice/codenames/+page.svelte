<script lang="ts">
  import Board from '@board-games/codenames/Board.svelte';
  import {
    practice,
    seats,
    scenarios,
    type Scenario,
  } from '@board-games/codenames/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let scenario = $state<Scenario>('match'),
    round = $state(0),
    game = practice(),
    seat = $state(game.actor),
    view = $state(game.view(game.actor));
  const displaySeats = $derived(
    seats.map((p, i) => ({
      ...p,
      name: `${i < 2 ? m.cn_red() : m.cn_blue()} · ${(i % 2) + 1}`,
    })),
  );
  function reset() {
    game = practice(scenario, getLocale() === 'es' ? 'es' : 'en');
    seat = game.actor;
    view = game.view(seat);
    round++;
  }
  function send(action: unknown) {
    game.send(seat, action);
    seat = game.actor;
    view = game.view(seat);
  }
</script>

<svelte:head><title>Codenames · {m.cn_practice()}</title></svelte:head>
<Board
  {view}
  playerId={seat}
  players={displaySeats}
  {send}
  {round}
  practice
  canRematch
  rematch={async () => reset()}
  locale={getLocale()}
>
  {#snippet settingsContent()}<nav>
      <a href="/">{m.back()}</a><label
        >{m.cn_practice()}<select
          aria-label={m.cn_practice()}
          bind:value={scenario}
          onchange={reset}
          >{#each scenarios as id}<option value={id}
              >{{
                setup: m.cn_practice_setup,
                match: m.cn_practice_match,
                final: m.cn_practice_final,
                assassin: m.cn_practice_assassin,
              }[id]()}</option
            >{/each}</select
        ></label
      ><label
        >{m.cn_actor()}<select
          aria-label={m.cn_actor()}
          bind:value={seat}
          onchange={() => (view = game.view(seat))}
          >{#each displaySeats as p}<option value={p.id}>{p.name}</option
            >{/each}</select
        ></label
      ><button onclick={reset}>{m.cn_reset()}</button><label
        >{m.language()}<select
          aria-label={m.language()}
          value={getLocale()}
          onchange={(e) => setLocale(e.currentTarget.value as Locale)}
          ><option value="en">EN</option><option value="es">ES</option></select
        ></label
      >
    </nav>{/snippet}
</Board>

<style>
  nav {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 5px;
  }
  select,
  button {
    font: inherit;
    min-height: 44px;
    padding: 6px;
  }
  a {
    color: #245c97;
  }
</style>
