<script lang="ts">
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import Loading from '@board-games/domino/Loading.svelte';
  import { lookOf } from '@board-games/domino/look';
  import { onMount, type Component } from 'svelte';
  import { gameClients } from '$lib/games';
  import { practice, seats } from '@board-games/domino/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let Board = $state<Component<any> | null>(null),
    round = $state(0),
    error = $state(''),
    locale = $state<Locale>(getLocale());
  let game = practice();
  // Pass-and-play: the table always shows whoever is to move.
  let seat = $state(''),
    view = $state(sync());
  function sync() {
    seat = game.turn;
    return game.view(seat);
  }
  onMount(() => {
    gameClients
      .domino()
      .then((v) => (Board = v.default))
      .catch(() => (error = m.domino_error()));
  });
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
  function reset() {
    game = practice();
    view = sync();
    round++;
    error = '';
  }
  function send(action: unknown) {
    try {
      game.send(seat, action);
      view = sync();
      error = '';
    } catch {
      error = m.domino_error();
    }
  }
</script>

<svelte:head><title>Dominó · {m.domino_practice()}</title></svelte:head>
<main class="domino-practice">
  {#if error}<p role="alert">{error}</p>{/if}{#if Board}{#key locale}<Board
        {view}
        playerId={seat}
        players={seats}
        {send}
        {round}
        {locale}
        canRematch={view.public.phase === 'finished'}
        rematch={reset}
      >
        {#snippet rulesContent()}<Rulebook game="domino" />{/snippet}
        {#snippet settingsContent()}<nav>
            <a href="/">{m.domino_back()}</a><button onclick={reset}
              >{m.domino_new_match()}</button
            ><label
              >{m.language()}<select
                value={locale}
                onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
                ><option value="en">EN</option><option value="es">ES</option
                ></select
              ></label
            >
          </nav>{/snippet}
      </Board>{/key}{:else if !error}<Loading
      progress={0.05}
      label={m.domino_loading()}
      pixel={lookOf() === 'pixel'}
    />{/if}
</main>

<style>
  :global(body:has(.domino-practice) .site-header) {
    display: none;
  }
  .domino-practice {
    position: fixed;
    inset: 0;
    background: #0d0906;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  select,
  button {
    min-height: 44px;
    padding: 10px;
    border: 1px solid #8a5a30;
    border-radius: 4px;
    background: #fff7e5;
    color: #2b1a0c;
    font: inherit;
  }
  a {
    color: #6b401f;
  }
  .domino-practice > p {
    position: absolute;
    z-index: 10;
    top: 70px;
    left: 50%;
    translate: -50% 0;
    padding: 10px 14px;
    color: #fff;
    background: #743f30;
  }
</style>
