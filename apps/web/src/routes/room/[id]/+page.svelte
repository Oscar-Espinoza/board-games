<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { catalog } from '@board-games/shared';
  import { gameClients } from '$lib/games';
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import {
    session,
    resume,
    join,
    leave,
    request,
    send,
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
  const cornerControls = $derived(
    immersive &&
      [
        'azul',
        'codenames',
        'sushi-go-party',
        'little-secret',
        'catan',
      ].includes(room?.gameId ?? ''),
  );
  const metadata = $derived(catalog.find((game) => game.id === room?.gameId));
  onMount(() => {
    try {
      name = localStorage.getItem('board-games:name') ?? '';
    } catch {}
    if (!room) resume(page.params.id);
  });
  $effect(() => {
    const id = room?.gameId;
    if (id && id in gameClients) {
      gameClients[id as keyof typeof gameClients]()
        .then((module) => {
          Board = module.default;
        })
        .catch((error) => {
          loadingError = error.message;
        });
    }
  });
  function errorText() {
    if (session.errorCode === 'STALE_REVISION') return m.action_stale();
    if (session.errorCode === 'MATCH_CHANGED') return m.action_match_changed();
    if (session.errorCode === 'TIMEOUT') return m.action_timeout();
    const key = session.error.startsWith('AZUL_')
      ? 'azul_error'
      : session.error;
    if (/^(azul_|cn_|sgp_|ls_)/.test(key)) {
      const translated = (
        m as unknown as Record<string, (() => string) | undefined>
      )[key];
      if (translated) return translated();
    }
    return session.error;
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
<main class="room" class:immersive class:corner-controls={cornerControls}>
  {#if !cornerControls}<div class="room-toolbar">
      <a href="/" onclick={() => leave()}>{m.back()}</a><span
        class:online={session.connected}
        class="connection"
        role="status"
        >{session.connected ? m.connected() : m.disconnected()}</span
      >{#if room?.status === 'finished' && room.hostId === room.playerId && immersive}<button
          onclick={start}>{m.rematch()}</button
        >{/if}{#if !room?.practice}<button class="secondary" onclick={invite}
          >{copied ? m.copied() : m.invite()}</button
        >{:else}<span class="practice-label">{m.uno_practice_table()}</span
        >{/if}
      {#if immersive && room?.gameId !== 'catan'}<select
          class="room-language"
          aria-label={m.language()}
          value={getLocale()}
          onchange={(event) => setLocale(event.currentTarget.value as Locale)}
          >{#each locales as locale}<option value={locale}
              >{locale.toUpperCase()}</option
            >{/each}</select
        >{/if}
    </div>{/if}
  {#if cornerControls && !session.connected}<p
      class="connection-failure"
      role="status"
    >
      {m.disconnected()}
    </p>{/if}
  {#if session.error}<p class="error" role="alert">
      {errorText()}<button
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
            roomId={room.id}
            maxPlayers={metadata?.maxPlayers ?? 8}
            onInvite={invite}
            onLeave={leave}
            {copied}
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
                game="catan"
              />{/snippet}{#snippet settingsContent()}{#if room.gameId === 'catan'}
                <p>{room.id}</p>
                {#if room.status === 'finished' && room.hostId === room.playerId}<button
                    onclick={start}>{m.rematch()}</button
                  >{/if}
              {:else if room.gameId === 'carcassonne' || cornerControls}<a
                  href="/"
                  onclick={() => leave()}>{m.back()}</a
                ><button onclick={invite}
                  >{copied ? m.copied() : m.invite()}</button
                ><select
                  aria-label={m.language()}
                  value={getLocale()}
                  onchange={(e) => setLocale(e.currentTarget.value as Locale)}
                  ><option value="en">EN</option><option value="es">ES</option
                  ></select
                >{#if room.status === 'finished' && room.hostId === room.playerId}<button
                    onclick={start}>{m.rematch()}</button
                  >{/if}<span role="status"
                  >{session.connected ? m.connected() : m.disconnected()} · {room.id}</span
                >{/if}{/snippet}</Board
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
  .corner-controls :global(.board-container) {
    width: 100%;
    height: 100%;
  }

  :global(body:has(.room.immersive) .site-header) {
    visibility: hidden;
  }
  .room-language {
    padding: 6px;
    font-size: 11px;
    background: #20332e;
    color: #f1e8d0;
    border-color: #ffffff30;
    max-width: 58px;
  }
  .practice-label {
    font-size: 11px;
    color: #abbba7;
  }
  @media (max-width: 600px) {
    .practice-label {
      display: none;
    }
  }

  .room.immersive {
    position: fixed;
    inset: 0;
    max-width: none;
    padding: 0;
    background: #191e1b;
    overflow: hidden;
  }
  .immersive .room-toolbar {
    position: absolute;
    z-index: 5;
    left: 24px;
    right: 24px;
    top: 12px;
    color: #d7d9c9;
    justify-content: flex-start;
    height: 40px;
    font-size: 12px;
    gap: 18px;
  }
  .immersive .room-toolbar .connection {
    margin-left: auto;
    font-size: 11px;
  }
  .immersive .room-toolbar button {
    font-size: 12px;
    padding: 8px 12px;
    color: #f6eed8;
    border-color: #ffffff30;
    background: #20332e;
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
    .immersive .room-toolbar {
      left: 12px;
      right: 12px;
      gap: 8px;
      top: 6px;
    }
    .immersive .room-toolbar .connection {
      order: 0;
      width: auto;
      max-width: 100px;
      line-height: 1.2;
    }
    .immersive .room-toolbar button {
      font-size: 10px;
      padding: 7px;
    }
    .immersive .error {
      left: 8px;
      right: 8px;
    }
  }
</style>
