<script lang="ts">
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import Board from '@board-games/codenames/Board.svelte';
  import {
    practice,
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
    view = $state(game.view(game.actor)),
    locale = $state(getLocale()),
    seatCount = $state(4);
  const seatSizes = [4, 8];
  const displaySeats = $derived.by(() => {
    locale;
    return view.public.players.map((id, i) => ({
      ...game.seats.find((p) => p.id === id)!,
      name: `${i < 2 || (i >= 4 && i % 2 === 0) ? m.cn_red() : m.cn_blue()} · ${i + 1}`,
    }));
  });
  function reset() {
    game = practice(scenario, locale === 'es' ? 'es' : 'en', seatCount);
    seat = game.actor;
    view = game.view(seat);
    round++;
  }
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
  function send(action: unknown) {
    game.send(seat, action);
    seat = game.actor;
    view = game.view(seat);
  }
</script>

<svelte:head
  ><title>Codenames · {m.cn_practice({}, { locale })}</title></svelte:head
>
{#key locale}
  <Board
    {view}
    playerId={seat}
    players={displaySeats}
    {send}
    {round}
    practice
    canRematch
    rematch={async () => reset()}
    {locale}
  >
    {#snippet rulesContent()}<Rulebook game="codenames" />{/snippet}
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
                  midgame: m.cn_practice_midgame,
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
        ><label
          >{m.cn_seats()}<select
            aria-label={m.cn_seats()}
            bind:value={seatCount}
            onchange={reset}
            >{#each seatSizes as size}<option value={size}>{size}</option
              >{/each}</select
          ></label
        ><button onclick={reset}>{m.cn_reset()}</button><label
          >{m.language()}<select
            aria-label={m.language()}
            value={locale}
            onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
            ><option value="en">EN</option><option value="es">ES</option
            ></select
          ></label
        >
      </nav>{/snippet}
  </Board>
{/key}

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
