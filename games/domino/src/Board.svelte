<script lang="ts">
  import type { Component } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { BoardProps } from '@board-games/shared/ui';
  import type { Skin } from '@board-games/shared/ui/pixel';
  import type { Action, View } from './index.js';
  import { DominoGame } from './game.svelte.js';
  import Hud from './Hud.svelte';
  import Loading from './Loading.svelte';

  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    pending = false,
    canRematch = false,
    rematch,
    rulesContent,
    settingsContent,
  }: BoardProps<View, Action> = $props();

  const game = new DominoGame(() => ({
    view,
    playerId,
    players,
    send,
    locale,
    round,
    connected,
    pending,
  }));

  // Each look is its own chunk: the 8-bit table never downloads three.js.
  const tables: Record<Skin, () => Promise<{ default: Component<any> }>> = {
    classic: () => import('./three/Table3D.svelte'),
    pixel: () => import('./pixel/PixelTable.svelte'),
  };
  let Table = $state<Component<any> | null>(null),
    failed = $state(false);
  $effect(() => {
    const skin = game.skin.choice;
    let alive = true;
    Table = null;
    tables[skin]()
      .then((v) => alive && (Table = v.default))
      .catch(() => (failed = true));
    return () => (alive = false);
  });
</script>

<Hud {game} {canRematch} {rematch} {rulesContent} {settingsContent}>
  {#if Table}<Table {game} />{:else if failed}<p class="failed" role="alert">
      {m.domino_error({}, game.L)}
    </p>{:else}<Loading
      progress={0.05}
      label={m.domino_loading({}, game.L)}
      pixel={game.skin.choice === 'pixel'}
    />{/if}
</Hud>

<style>
  .failed {
    position: absolute;
    top: 45%;
    width: 100%;
    text-align: center;
  }
</style>
