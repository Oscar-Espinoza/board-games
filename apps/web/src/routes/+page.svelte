<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { catalog } from '@board-games/shared';
  import { m } from '@board-games/shared/messages';
  import { connect, create, leave, session } from '$lib/session.svelte';
  let name = $state('');
  let code = $state('');
  let setup = $state('variable');
  let busy = $state(false);
  onMount(() => {
    leave();
    connect();
    try {
      name = localStorage.getItem('board-games:name') ?? '';
    } catch {}
  });
  async function createRoom(gameId: string, practice = false) {
    busy = true;
    session.error = '';
    try {
      try {
        localStorage.setItem('board-games:name', name);
      } catch {}
      const credentials = await create(
        gameId,
        practice ? name.trim() || 'Player' : name,
        { setup, practice },
      );
      await goto(`/room/${credentials.roomId}`);
    } catch (error) {
      session.error = (error as Error).message;
    } finally {
      busy = false;
    }
  }
  function joinRoom() {
    const id = code.trim().split('/').filter(Boolean).at(-1)?.split(/[?#]/)[0];
    if (id) void goto(`/room/${encodeURIComponent(id)}`);
  }
</script>

<svelte:head><title>{m.catalog()}</title></svelte:head>
<main class="catalog">
  <div class="intro">
    <p class="eyebrow">{catalog.map((game) => game.name).join(' · ')}</p>
    <h1>{m.title()}</h1>
    <p>{m.subtitle()}</p>
  </div>
  <label class="name-field"
    >{m.name()}<input
      aria-label={m.name()}
      bind:value={name}
      maxlength="32"
      autocomplete="nickname"
      placeholder="Alex"
    /></label
  >
  {#if session.error}<p class="error" role="alert">{session.error}</p>{/if}
  <div class="game-grid">
    {#each catalog as game}<article
        class="game-card"
        class:uno={game.preview === 'cards'}
      >
        <div class="game-art" aria-hidden="true">
          {#if game.preview === 'cards'}<span class="mini-card red">7</span
            ><span class="mini-card blue">↺</span><span class="mini-card yellow"
              >+2</span
            >{:else}<span class="island">⬢</span><span class="island small"
              >⬢</span
            >{/if}
        </div>
        <div class="game-details">
          <p class="eyebrow">
            {m.players({ min: game.minPlayers, max: game.maxPlayers })}
          </p>
          <h2>{game.name}</h2>
          <p>
            {game.description()}
          </p>
          {#if 'setupModes' in game}<label class="setup"
              >{m.setup()}<select bind:value={setup}
                >{#each game.setupModes as mode}<option value={mode}
                    >{mode === 'beginner' ? m.beginner() : m.variable()}</option
                  >{/each}</select
              ></label
            >{/if}
          <button
            disabled={!name.trim() || !session.connected || busy}
            onclick={() => createRoom(game.id)}
            >{m.create()} <span aria-hidden="true">→</span></button
          >
          {#if game.id === 'catan'}<a
              class="practice-button"
              href="/practice/catan">{m.catan_try()}</a
            >{/if}
          {#if 'practice' in game && game.practice}<button
              class="secondary practice-button"
              disabled={!session.connected || busy}
              onclick={() => createRoom(game.id, true)}
              >{m.uno_practice()} <small>{m.uno_practice_hint()}</small></button
            >{/if}
        </div>
      </article>{/each}
  </div>
  <form
    class="join-form"
    onsubmit={(event) => {
      event.preventDefault();
      joinRoom();
    }}
  >
    <label>{m.room_code()}<input bind:value={code} required /></label><button
      class="secondary"
      type="submit">{m.join()}</button
    >
  </form>
</main>
