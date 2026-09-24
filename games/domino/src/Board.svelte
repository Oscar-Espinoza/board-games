<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  import type { Player } from '@board-games/game-core';
  import type { View } from './index.js';
  import { DominoGame } from './game.svelte.js';
  import type { Look } from './look.js';
  import Hud from './Hud.svelte';
  import Loading from './Loading.svelte';

  let {
    view,
    playerId,
    players,
    send,
    locale,
    round = 0,
    connected = true,
    pending = false,
    canRematch = false,
    rematch,
    rulesContent,
    settingsContent,
  }: {
    view: View;
    playerId: string;
    players: Player[];
    send: (action: unknown) => void;
    locale: Locale;
    round?: number;
    connected?: boolean;
    pending?: boolean;
    canRematch?: boolean;
    rematch?: () => void;
    rulesContent?: Snippet;
    settingsContent?: Snippet;
  } = $props();

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
  const tables: Record<Look, () => Promise<{ default: Component<any> }>> = {
    '3d': () => import('./three/Table3D.svelte'),
    pixel: () => import('./pixel/PixelTable.svelte'),
  };
  let Table = $state<Component<any> | null>(null),
    failed = $state(false);
  $effect(() => {
    const look = game.look;
    let alive = true;
    Table = null;
    tables[look]()
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
      pixel={game.look === 'pixel'}
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
