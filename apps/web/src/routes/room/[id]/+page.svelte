<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Component } from 'svelte';
  import { page } from '$app/state';
  import { games, type GameId } from '@board-games/shared';
  import { errorText, read } from '@board-games/shared/ui';
  import { gameClients } from '$lib/games';
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import {
    session,
    resume,
    join,
    leave,
    request,
    send,
    nameKey,
  } from '$lib/session.svelte';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    locales,
    type Locale,
  } from '@board-games/shared/runtime';
  let name = $state('');
  let copied = $state(false);
  let Board = $state<Component<any> | null>(null);
  let loadingError = $state('');
  const room = $derived(
    session.room?.id === page.params.id ? session.room : null,
  );
  const immersive = $derived(room?.game != null);
  const gameId = $derived(room?.gameId as GameId | undefined);
  const metadata = $derived(gameId && games[gameId]);
  onMount(() => {
    name = read(nameKey) ?? '';
  });
  // Runs again when navigating straight from one room link to another.
  $effect(() => {
    const id = page.params.id;
    if (id && untrack(() => session.room?.id) !== id) resume(id);
  });
  $effect(() => {
    const client = gameId && gameClients[gameId];
    if (!client) return;
    let current = true;
    client
      .load()
      .then((module) => {
        if (current) Board = module.default;
      })
      .catch((error) => {
        if (current) loadingError = error.message;
      });
    return () => (current = false);
  });
  function errorMessage() {
    if (session.errorCode === 'STALE_REVISION') return m.action_stale();
    if (session.errorCode === 'MATCH_CHANGED') return m.action_match_changed();
    if (session.errorCode === 'TIMEOUT') return m.action_timeout();
    return errorText(session.error);
  }
  async function joinRoom(useToken = true) {
    session.error = '';
    session.errorCode = undefined;
    try {
      await join(page.params.id, name, useToken);
    } catch (error) {
      session.error = (error as Error).message;
    }
  }
  async function start() {
    session.errorCode = undefined;
    try {
      await request('start', {});
    } catch (error) {
      session.error = (error as Error).message;
    }
  }
  async function invite() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

<svelte:head
  ><title>{metadata?.name ?? m.join()} · {m.catalog()}</title></svelte:head
>
<main class="room" class:immersive>
  {#if immersive}{#if !session.connected}<p
        class="connection-failure"
        role="status"
      >
        {m.disconnected()}
      </p>{/if}{:else}<div class="room-toolbar">
      <a href="/" onclick={() => leave()}>{m.back()}</a><span
        class:online={session.connected}
        class="connection"
        role="status"
        >{session.connected ? m.connected() : m.disconnected()}</span
      >{#if !room?.practice}<button class="secondary" onclick={invite}
          >{copied ? m.copied() : m.invite()}</button
        >{/if}
    </div>{/if}
  {#if session.error}<p class="error" role="alert">
      {errorMessage()}<button
        type="button"
        aria-label={m.catan_dismiss_error()}
        onclick={() => (session.error = '')}>×</button
      >
    </p>{/if}
  {#if session.storageWarning}<p role="alert">{m.storage_error()}</p>{/if}
  {#if room}{#if !immersive}<div class="room-heading">
        <div>
          <p class="eyebrow">{room.id}</p>
          <h1>{metadata?.name}</h1>
        </div>
        {#if room.status !== 'playing' && room.hostId === room.playerId}<button
            onclick={start}
            disabled={!session.connected ||
              room.players.length < (metadata?.minPlayers ?? 2) ||
              room.players.some((p) => !p.connected)}
            >{room.status === 'finished' ? m.rematch() : m.start()}</button
          >{/if}
      </div>
      <ul class="roster">
        {#each room.players as player}<li class:offline={!player.connected}>
            <span class="avatar">{player.name.slice(0, 1).toUpperCase()}</span
            ><span
              >{player.name}{player.id === room.playerId
                ? ` (${m.you()})`
                : ''}<small
                >{player.id === room.hostId ? m.host() : ''}{!player.connected
                  ? player.reservedUntil
                    ? m.reserved()
                    : m.available()
                  : ''}</small
              ></span
            >
          </li>{/each}
      </ul>{/if}
    {#if room.game}{#if Board}<div
          class="board-container"
          class:pending={session.pending}
          aria-busy={session.pending}
        >
          <Board
            view={room.game}
            playerId={room.playerId}
            players={room.players}
            {send}
            locale={getLocale()}
            round={room.round}
            connected={session.connected}
            pending={session.pending}
            errorCode={session.errorCode}
            practice={room.practice}
            canConfigure={room.hostId === room.playerId}
            canRematch={room.status === 'finished' &&
              room.hostId === room.playerId}
            rematch={start}
            >{#snippet rulesContent()}<Rulebook
                game={room.gameId as GameId}
              />{/snippet}{#snippet settingsContent()}<a
                href="/"
                onclick={() => leave()}>{m.back()}</a
              >{#if !room.practice}<button onclick={invite}
                  >{copied ? m.copied() : m.invite()}</button
                >{/if}<select
                aria-label={m.language()}
                value={getLocale()}
                onchange={(e) => setLocale(e.currentTarget.value as Locale)}
                >{#each locales as locale}<option value={locale}
                    >{locale.toUpperCase()}</option
                  >{/each}</select
              ><span role="status"
                >{session.connected ? m.connected() : m.disconnected()} · {room.id}</span
              >{/snippet}</Board
          >
        </div>{:else if loadingError}<p class="error">{loadingError}</p>
        <button onclick={() => location.reload()}>{m.retry()}</button>{:else}<p
          role="status"
        >
          {m.loading()}
        </p>{/if}{:else}<section class="lobby">
        <div class="table-mark" aria-hidden="true">◈</div>
        <h2>{m.lobby()}</h2>
        <p>{m.waiting()}</p>
        <input
          aria-label={m.room_code()}
          readonly
          value={typeof location !== 'undefined' ? location.href : ''}
        />
      </section>{/if}
  {:else}<section class="join-panel">
      <h1>{m.join()}</h1>
      <p>{m.room_missing()}</p>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void joinRoom(false);
        }}
      >
        <label
          >{m.name()}<input bind:value={name} maxlength="32" required /></label
        ><button disabled={!session.connected}>{m.join_seat()}</button>
      </form>
    </section>{/if}
</main>

<style>
  .connection-failure {
    position: absolute;
    z-index: 12;
    top: max(12px, env(safe-area-inset-top));
    left: 70px;
    right: 70px;
    margin: 0 auto;
    width: fit-content;
    max-width: calc(100% - 140px);
    padding: 6px 12px;
    border-radius: 12px;
    background: #692b22;
    color: #fff;
    text-align: center;
  }
  .immersive :global(.board-container) {
    width: 100%;
    height: 100%;
  }

  :global(body:has(.room.immersive) .site-header) {
    visibility: hidden;
  }

  .room.immersive {
    position: fixed;
    inset: 0;
    max-width: none;
    padding: 0;
    background: #191e1b;
    overflow: hidden;
  }
  .immersive .error {
    position: absolute;
    z-index: 10;
    top: 55px;
    left: 20%;
    right: 20%;
    font-size: 13px;
    padding: 8px 12px;
  }
  @media (max-width: 600px) {
    .immersive .error {
      left: 8px;
      right: 8px;
    }
  }
</style>
