<script lang="ts">
  import { onMount, tick, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  import {
    colors,
    penalties,
    rowIssue,
    type View,
    type Source,
    type Destination,
    type Color,
    type Event,
  } from './index.js';
  import Tile from './Tile.svelte';
  import PlayerBoard from './PlayerBoard.svelte';
  import Help from './Help.svelte';
  import { RevisionGate } from './presentation.js';
  import { ceramicAudio, tileFlights, measure } from './effects.js';
  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    pending = false,
    settingsContent,
    canConfigure = false,
    practice = false,
    canRematch = false,
    rematch = async () => {},
    errorCode = '',
  }: {
    view: View;
    playerId: string;
    players: { id: string; name: string; connected?: boolean }[];
    send: (action: unknown) => unknown;
    locale?: Locale;
    round?: number;
    connected?: boolean;
    pending?: boolean;
    settingsContent?: Snippet;
    canConfigure?: boolean;
    practice?: boolean;
    canRematch?: boolean;
    rematch?: () => Promise<void>;
    errorCode?: string;
  } = $props();
  let visual = $state(untrack(() => view.public)),
    root = $state<HTMLElement>(),
    dialog = $state<HTMLDialogElement>(),
    modal = $state<'help' | 'settings' | 'opponent'>('help'),
    inspected = $state('');
  let selection = $state<{
      source: Source;
      color: Color;
      revision: number;
    } | null>(null),
    destination = $state<Destination | null>(null),
    submitting = $state(false),
    notice = $state(''),
    animating = $state(false),
    recent = $state<Event[]>([]);
  let sound = $state(true),
    volume = $state(0.25),
    motion = $state<'system' | 'reduced' | 'full'>('system'),
    systemReduced = $state(false),
    mounted = $state(false);
  const gate = new RevisionGate(),
    audio = ceramicAudio(),
    flights = tileFlights();
  let opener: HTMLElement | null = null,
    epoch = 0;
  function platePosition(index: number, count: number) {
    if (count > 5) {
      const top = Math.ceil(count / 2);
      return index < top
        ? [12 + (index / (top - 1)) * 76, 17.5]
        : [22 + ((index - top) / (count - top - 1)) * 56, 82.5];
    }
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return [50 + 40 * Math.cos(angle), 50 + 34 * Math.sin(angle)];
  }
  const labels = {
    blue: m.azul_blue,
    yellow: m.azul_yellow,
    red: m.azul_red,
    black: m.azul_black,
    white: m.azul_white,
  };
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const ownIndex = $derived(visual.players.indexOf(playerId));
  const ownBoard = $derived(visual.boards[ownIndex]);
  const active = $derived(visual.players[visual.turn]);
  const playable = $derived(
    connected &&
      !pending &&
      !submitting &&
      active === playerId &&
      visual.phase === 'drafting',
  );
  const reduced = $derived(
    motion === 'reduced' || (motion === 'system' && systemReduced),
  );
  const sourceTiles = $derived(
    selection
      ? selection.source.kind === 'center'
        ? visual.center
        : visual.factories[selection.source.index]
      : [],
  );
  const quantity = $derived(
    sourceTiles.filter((c) => c === selection?.color).length,
  );
  const claimsMarker = $derived(
    !!selection &&
      selection.source.kind === 'center' &&
      visual.markerOwner === null,
  );
  const markerCost = $derived(
    claimsMarker && ownBoard?.floor.length < 7
      ? penalties[ownBoard.floor.length]
      : 0,
  );
  const incomingOverflow = $derived(
    destination?.kind === 'pattern' && ownBoard
      ? Math.max(
          0,
          quantity -
            (destination.row + 1 - ownBoard.patterns[destination.row].count),
        )
      : quantity,
  );
  const floorRoom = $derived(
    ownBoard
      ? Math.max(0, 7 - ownBoard.floor.length - (claimsMarker ? 1 : 0))
      : 0,
  );
  function clear(message = '') {
    selection = null;
    destination = null;
    notice = message;
  }
  function settle() {
    epoch++;
    flights.cancel();
    audio.stop();
    animating = false;
  }
  function baseline() {
    settle();
    gate.reset();
    if (root)
      gate.accept(
        view.public.revision,
        `${round}/${playerId}`,
        connected,
        view.public,
      );
  }
  function open(kind: 'help' | 'settings' | 'opponent', id = '') {
    opener = document.activeElement as HTMLElement;
    modal = kind;
    inspected = id;
    dialog?.showModal();
  }
  function close() {
    dialog?.close();
    opener?.focus({ preventScroll: true });
  }
  function choose(source: Source, color: Color) {
    if (!playable) return;
    settle();
    selection = { source, color, revision: visual.revision };
    destination = null;
    notice = '';
  }
  function chooseDestination(d: Destination) {
    settle();
    destination = d;
  }
  async function confirm() {
    if (
      !selection ||
      !destination ||
      !playable ||
      selection.revision !== view.public.revision
    ) {
      clear(m.azul_changed());
      return;
    }
    const action = {
      type: 'DRAFT',
      source: selection.source,
      color: selection.color,
      destination,
    };
    submitting = true;
    settle();
    clear();
    try {
      await send(action);
    } catch {
      notice = m.azul_error();
    } finally {
      submitting = false;
    }
  }
  onMount(() => {
    mounted = true;
    try {
      const saved = JSON.parse(
        localStorage.getItem('azul-preferences') ?? '{}',
      );
      if (typeof saved.sound === 'boolean') sound = saved.sound;
      if (
        typeof saved.volume === 'number' &&
        saved.volume >= 0 &&
        saved.volume <= 1
      )
        volume = saved.volume;
      if (['system', 'reduced', 'full'].includes(saved.motion))
        motion = saved.motion;
    } catch {}
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    systemReduced = media.matches;
    const changed = () => {
      systemReduced = media.matches;
      baseline();
    };
    const resize = () => baseline(),
      visibility = () => baseline();
    media.addEventListener('change', changed);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      settle();
      audio.close();
      media.removeEventListener('change', changed);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  });
  $effect(() => {
    const prefs = { sound, volume, motion };
    audio.configure(sound, volume);
    if (mounted) {
      try {
        localStorage.setItem('azul-preferences', JSON.stringify(prefs));
      } catch {}
      untrack(baseline);
    }
  });
  $effect(() => {
    const next = view.public,
      identity = `${round}/${playerId}`,
      online = connected,
      node = root;
    const eligible = gate.accept(next.revision, identity, online, next);
    untrack(() => {
      const before = node ? measure(node) : new Map();
      settle();
      const token = epoch;
      if (selection && (selection.revision !== next.revision || !online))
        clear(m.azul_changed());
      visual = next;
      if (eligible)
        recent = next.events.filter(
          (e) =>
            e.type === 'wall' || e.type === 'penalty' || e.type === 'finish',
        );
      else recent = [];
      if (eligible && node && !reduced && !document.hidden)
        void tick().then(() => {
          if (epoch !== token) return;
          animating = flights.play(
            next.events,
            before,
            measure(node),
            () => (animating = false),
            audio,
          );
        });
    });
  });
  $effect(() => {
    if (errorCode === 'STALE_REVISION' || errorCode === 'MATCH_CHANGED')
      untrack(() => clear(m.azul_changed()));
  });
  function keyboard(event: KeyboardEvent) {
    if (event.isTrusted) audio.unlock();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (dialog?.open) close();
      else clear();
    }
  }
  const highlight = (id: string): [number, number][] =>
    recent.flatMap((e) =>
      e.type === 'wall' && e.player === id ? e.scoring.cells : [],
    );
</script>

<svelte:window
  onkeydown={keyboard}
  onpointerdown={(e) => {
    if (e.isTrusted) audio.unlock();
  }}
/>
<div
  class="azul-table"
  bind:this={root}
  lang={locale}
  data-game-revision={visual.revision}
>
  <button
    class="corner book"
    aria-label={m.azul_help()}
    onclick={() => open('help')}
    ><svg viewBox="0 0 36 30" aria-hidden="true"
      ><path
        d="M18 7Q10 1 3 5v21q8-4 15 1 7-5 15-1V5q-7-4-15 2Z"
        fill="#efe1bd"
        stroke="#be9557"
        stroke-width="1.5"
      /><path
        d="M18 7v20M7 10l7 2M7 15l7 2M22 12l7-2M22 17l7-2"
        stroke="#28516b"
        stroke-width="1.3"
      /></svg
    ></button
  >
  <button
    class="corner gear"
    aria-label={m.azul_settings()}
    onclick={() => open('settings')}
    ><svg viewBox="0 0 32 32" aria-hidden="true"
      ><path
        d="m13 3 6 0 1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 3h-6l-1-3-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2Z"
        transform="translate(0 -1) scale(.94)"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      /><circle
        cx="15"
        cy="15"
        r="5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      /></svg
    ></button
  >
  <div class="surface">
    <header class="table-heading">
      <span class="wordmark">AZUL</span><span class="round"
        >{m.azul_round({ round: visual.roundNumber })}</span
      >
      <h1 aria-live="polite">
        {visual.phase === 'finished'
          ? m.azul_finished()
          : active === playerId
            ? m.azul_your_turn()
            : m.azul_turn({ name: name(active) })}
      </h1>
      {#if practice}<p class="practice-note">{m.azul_practice()}</p>{/if}
    </header>
    {#if !connected}<p class="connection" role="status">
        {m.azul_disconnected()}
      </p>{/if}
    <div class="opponents">
      {#each visual.players.filter((id) => id !== playerId) as id}{@const board =
          visual.boards[visual.players.indexOf(id)]}<button
          class="opponent"
          class:turn={active === id}
          data-azul-location="{id}/summary"
          aria-label={m.azul_inspect({ name: name(id), score: board.score })}
          onclick={() => open('opponent', id)}
          ><span class="opponent-name"
            >{#if active === id}▸
            {/if}{name(id)}
            {#if visual.markerOwner === id}①{/if}</span
          ><strong>{board.score}</strong><span class="risk"
            >{m.azul_risk({
              patterns: board.patterns.reduce((n, p) => n + p.count, 0),
              floor: board.floor.length,
            })}{#if players.find((p) => p.id === id)?.connected === false}
              · {m.azul_offline()}{/if}</span
          ><span class="mini-patterns" aria-hidden="true"
            >{#each board.patterns as p, r}<span
                >{'▪'.repeat(p.count)}{'▫'.repeat(r + 1 - p.count)}</span
              >{/each}</span
          ></button
        >{/each}
    </div>
    <div class="supply">
      <div class="factories" class:many={visual.factories.length > 5}>
        {#each visual.factories as factory, index}
          {@const position = platePosition(index, visual.factories.length)}
          <div
            class="factory"
            style="--x:{position[0]}%;--y:{position[1]}%"
            aria-label={m.azul_factory({ number: index + 1 })}
          >
            <span class="factory-number">{index + 1}</span>
            <div class="factory-tiles">
              {#each Array(4) as _, slot}{@const color =
                  factory[slot]}{#if color}<button
                    disabled={!playable}
                    class:selected={selection?.source.kind === 'factory' &&
                      selection.source.index === index &&
                      selection.color === color}
                    aria-label={m.azul_source({
                      count: factory.filter((c) => c === color).length,
                      color: labels[color](),
                      source: m.azul_factory({ number: index + 1 }),
                    })}
                    onclick={() => choose({ kind: 'factory', index }, color)}
                    ><Tile {color} location="factory/{index}/{slot}" /></button
                  >{:else}<span
                    class="factory-empty"
                    data-azul-location="factory/{index}/{slot}"
                  ></span>{/if}{/each}
            </div>
          </div>
        {/each}
        <div class="center">
          <h2>{m.azul_center()}</h2>
          <div class="center-colors">
            {#each colors as color}{@const count = visual.center.filter(
                (c) => c === color,
              ).length}<button
                class="center-group"
                class:absent={!count}
                class:selected={selection?.source.kind === 'center' &&
                  selection.color === color}
                disabled={!playable || !count}
                aria-label={m.azul_source({
                  count,
                  color: labels[color](),
                  source: m.azul_center(),
                })}
                onclick={() => choose({ kind: 'center' }, color)}
                ><span class="center-tile"
                  ><Tile
                    {color}
                    ghost={!count}
                    location="center/{color}"
                  /></span
                ><b>{count}</b></button
              >{/each}{#if !visual.markerOwner}<span
                class="center-marker"
                title={m.azul_marker()}
                ><Tile color="marker" location="center/marker" /></span
              >{/if}
          </div>
        </div>
      </div>
    </div>
    <div class="table-bottom">
      <div class="reserves">
        <span data-azul-location="bag"
          >♧ <span>{m.azul_bag({ count: visual.bagCount })}</span></span
        ><span data-azul-location="discard"
          >◇ <span>{m.azul_discard({ count: visual.discardCount })}</span></span
        >
      </div>
      {#if ownBoard}<div class="own-board">
          <PlayerBoard
            board={ownBoard}
            id={playerId}
            name={name(playerId)}
            active={active === playerId}
            marker={visual.markerOwner === playerId}
            color={selection?.color ?? null}
            {destination}
            choose={playable ? chooseDestination : undefined}
            highlights={highlight(playerId)}
          />
        </div>{/if}
      <div class="explanations" aria-live="polite">
        {#each recent as event}{#if event.type === 'wall'}<p class="gain">
              {event.scoring.points === 1
                ? m.azul_isolated_gain({ name: name(event.player) })
                : m.azul_wall_gain({
                    name: name(event.player),
                    points: event.scoring.points,
                    horizontal:
                      event.scoring.horizontal > 1
                        ? event.scoring.horizontal
                        : 0,
                    vertical:
                      event.scoring.vertical > 1 ? event.scoring.vertical : 0,
                  })}
            </p>{:else if event.type === 'penalty'}<p>
              {m.azul_penalty({
                name: name(event.player),
                deduction: event.deduction,
                loss: event.loss,
              })}
            </p>{/if}{/each}
      </div>
    </div>
    {#if visual.phase === 'finished'}<section
        class="results"
        aria-label={m.azul_finished()}
      >
        <h2>
          {visual.winners.length > 1
            ? m.azul_shared({ names: visual.winners.map(name).join(' · ') })
            : m.azul_winner({ names: visual.winners.map(name).join('') })}
        </h2>
        <p>{m.azul_tiebreak()}</p>
        <div class="result-boards">
          {#each visual.boards as board, i}<article>
              <h3>{name(visual.players[i])}</h3>
              <dl>
                <dt>{m.azul_wall_points()}</dt>
                <dd>{board.wallPoints}</dd>
                <dt>{m.azul_raw_floor()}</dt>
                <dd>−{board.floorDeductions}</dd>
                <dt>{m.azul_loss()}</dt>
                <dd>−{board.floorLoss}</dd>
                <dt>{m.azul_rows_bonus()}</dt>
                <dd>+{board.bonus.rows}</dd>
                <dt>{m.azul_columns_bonus()}</dt>
                <dd>+{board.bonus.columns}</dd>
                <dt>{m.azul_colors_bonus()}</dt>
                <dd>+{board.bonus.colors}</dd>
                <dt class="total">{m.azul_total()}</dt>
                <dd class="total">{board.score}</dd>
              </dl>
            </article>{/each}
        </div>
        {#if canRematch}<button class="primary" onclick={rematch}
            >{m.azul_rematch()}</button
          >{/if}
      </section>{/if}
    <div
      class="confirmation"
      class:hidden={!selection &&
        !notice &&
        !submitting &&
        !pending &&
        !animating &&
        (visual.phase === 'finished' || active === playerId)}
      aria-live="polite"
    >
      {#if notice}<p role="status">{notice}</p>{/if}
      {#if selection}<p>
          {destination
            ? m.azul_preview({
                count: quantity,
                destination:
                  destination.kind === 'floor'
                    ? m.azul_floor()
                    : m.azul_line({ row: destination.row + 1 }),
                overflow: Math.min(incomingOverflow, floorRoom),
                discard: Math.max(0, incomingOverflow - floorRoom),
              })
            : m.azul_choose_destination({
                count: quantity,
                color: labels[selection.color](),
              })}
        </p>
        {#if claimsMarker}<p class="marker-preview">
            {m.azul_marker_cost({ cost: markerCost })}
          </p>{/if}
        <div class="confirm-actions">
          <button onclick={() => clear()}>{m.azul_cancel()}</button><button
            class="primary"
            disabled={!destination || !playable}
            onclick={confirm}>{m.azul_confirm()}</button
          >
        </div>
      {:else if submitting || pending}<p>
          {m.azul_sending()}
        </p>{:else if visual.phase !== 'finished' && active !== playerId}<p>
          {m.azul_wait({ name: name(active) })}
        </p>{/if}
      {#if animating}<button class="skip" onclick={settle}
          >{m.azul_skip()}</button
        >{/if}
    </div>
  </div>
  <dialog
    bind:this={dialog}
    aria-labelledby="azul-dialog-title"
    onclose={() => opener?.focus({ preventScroll: true })}
  >
    <button class="close" aria-label={m.azul_close()} onclick={close}>×</button>
    <h2 id="azul-dialog-title">
      {modal === 'help'
        ? m.azul_help()
        : modal === 'settings'
          ? m.azul_settings()
          : name(inspected)}
    </h2>
    {#if modal === 'help'}<Help />{:else if modal === 'settings'}<div
        class="settings"
      >
        <label class="toggle"
          ><input type="checkbox" bind:checked={sound} />{m.azul_sound()}</label
        ><label
          >{m.azul_volume()}<input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={volume}
          /></label
        ><label
          >{m.azul_motion()}<select
            aria-label={m.azul_motion()}
            bind:value={motion}
            ><option value="system">{m.azul_system()}</option><option
              value="reduced">{m.azul_reduced()}</option
            ><option value="full">{m.azul_full_motion()}</option></select
          ></label
        >{#if settingsContent}<div class="room-settings">
            {@render settingsContent()}
          </div>{/if}{#if canRematch && !settingsContent}<button
            onclick={rematch}>{m.azul_rematch()}</button
          >{/if}
      </div>
    {:else if visual.players.includes(inspected)}<PlayerBoard
        board={visual.boards[visual.players.indexOf(inspected)]}
        id={inspected}
        name={name(inspected)}
        active={active === inspected}
        marker={visual.markerOwner === inspected}
      />{/if}
  </dialog>
</div>

<style>
  .azul-table {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: radial-gradient(
      ellipse at 50% 35%,
      #254b63 0,
      #142c43 60%,
      #102333 100%
    );
    color: #f7eedb;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    isolation: isolate;
  }
  .azul-table::before {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px solid #bd955b2b;
    pointer-events: none;
    border-radius: 10px;
  }
  .surface {
    height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    padding: 17px 20px 0;
    scrollbar-color: #527081 #142c43;
  }
  .corner {
    position: absolute;
    top: max(14px, env(safe-area-inset-top));
    z-index: 6;
    width: 48px;
    height: 48px;
    padding: 8px;
    background: #18384bd9;
    color: #e8d7ac;
    border: 1px solid #a88c5755;
    border-radius: 50%;
    box-shadow: 0 2px 6px #0002;
  }
  .corner svg {
    width: 100%;
    height: 100%;
  }
  .book {
    left: max(16px, env(safe-area-inset-left));
  }
  .gear {
    right: max(16px, env(safe-area-inset-right));
  }
  button {
    font: inherit;
    cursor: pointer;
    min-height: 44px;
  }
  button:disabled {
    cursor: default;
  }
  button:focus-visible {
    outline: 3px solid #f2c96c;
    outline-offset: 3px;
  }
  .table-heading {
    text-align: center;
    min-height: 62px;
    padding: 0 54px;
    box-sizing: border-box;
  }
  .wordmark {
    font:
      22px Georgia,
      serif;
    letter-spacing: 0.26em;
    color: #e3c998;
  }
  .round {
    font-size: 11px;
    margin-left: 15px;
    border-left: 1px solid #a58d6555;
    padding-left: 15px;
    color: #d3dddf;
  }
  h1 {
    font-size: 15px;
    font-weight: 500;
    margin: 7px 0;
  }
  .practice-note {
    font-size: 10px;
    color: #c2d2d9;
    margin: 4px 0;
  }
  .connection {
    max-width: 600px;
    margin: 6px auto;
    text-align: center;
    padding: 10px;
    border: 1px solid #d9aa60;
    background: #442c26;
  }
  .opponents {
    display: flex;
    justify-content: center;
    gap: 16px;
    max-width: 900px;
    margin: 10px auto 0;
  }
  .opponent {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 15px;
    text-align: left;
    border: 1px solid #91a8ae44;
    border-radius: 5px;
    background: #10293966;
    color: #f5ead0;
    padding: 10px 16px;
    min-width: 180px;
    max-width: 300px;
    flex: 1;
  }
  .opponent.turn {
    border-color: #d2ab66;
    box-shadow: inset 3px 0 #d2ab66;
  }
  .opponent-name {
    font:
      18px Georgia,
      serif;
    overflow-wrap: anywhere;
  }
  .opponent strong {
    font-size: 21px;
    color: #efd39c;
  }
  .risk {
    grid-column: 1/-1;
    font-size: 10px;
    color: #c6d7dc;
  }
  .mini-patterns {
    display: flex;
    gap: 8px;
    grid-column: 1/-1;
    color: #dbc795;
    font-size: 10px;
  }
  .supply {
    max-width: 830px;
    margin: 0 auto;
  }
  .factories {
    height: 280px;
    position: relative;
    max-width: 770px;
    margin: auto;
  }
  .factories.many {
    height: 320px;
  }
  .factories.many .center {
    top: 50%;
  }
  .factory {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      #ecdfc2 48%,
      #fcf4df 50%,
      #e5d9b9 58%,
      #2f6a85 59%,
      #f8efdc 61%,
      #f3e8cd 66%,
      #be9b5d 67%,
      #d8caa8 70%
    );
    box-shadow:
      2px 6px 9px #04172466,
      inset 0 2px 2px #fff8;
    display: grid;
    place-items: center;
  }
  .factory-number {
    position: absolute;
    top: 3px;
    left: 51px;
    font-size: 8px;
    color: #21475c;
  }
  .factory-tiles {
    display: grid;
    grid-template-columns: repeat(2, 44px);
    grid-template-rows: repeat(2, 44px);
    gap: 0;
  }
  .factory-tiles button {
    width: 44px;
    height: 44px;
    padding: 6px;
    border: 0;
    background: transparent;
    border-radius: 6px;
    transition:
      background 0.12s,
      transform 0.12s;
  }
  .factory-tiles button:not(:disabled):hover {
    transform: translateY(-3px);
    background: #2b6e7d2b;
  }
  .factory-tiles button:disabled {
    opacity: 1;
  }
  .factory-tiles button.selected {
    background: #3779924d;
    outline: 2px solid #234e6a;
    outline-offset: -3px;
  }
  .factory-empty {
    width: 26px;
    height: 26px;
    margin: 9px;
    border: 1px solid #ad9c7655;
    box-sizing: border-box;
    border-radius: 3px;
  }
  .center {
    pointer-events: none;
    position: absolute;
    left: 50%;
    top: 55%;
    transform: translate(-50%, -50%);
    width: 330px;
    min-height: 95px;
    text-align: center;
    background: radial-gradient(ellipse, #0b26383b, transparent 70%);
    padding: 5px;
  }
  .center h2 {
    font:
      italic 15px Georgia,
      serif;
    color: #d4c5a7;
    margin: 0 0 5px;
  }
  .center-colors {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
  }
  .center-group {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border: 1px solid transparent;
    background: transparent;
    color: #f5ead0;
    padding: 3px;
    min-width: 44px;
    min-height: 53px;
    border-radius: 5px;
  }
  .center-tile {
    display: block;
    width: 28px;
    height: 28px;
  }
  .center-group b {
    font-size: 11px;
  }
  .center-group.selected {
    border-color: #e8c480;
    background: #d4bd8530;
  }
  .center-group:disabled {
    opacity: 1;
  }
  .center-group.absent {
    opacity: 0.4;
  }
  .center-marker {
    display: block;
    width: 29px;
    height: 29px;
    margin: 3px;
  }
  .table-bottom {
    position: relative;
    max-width: 1060px;
    margin: -2px auto 0;
  }
  .own-board {
    max-width: 530px;
    margin: 0 auto;
  }
  .reserves {
    position: absolute;
    left: 0;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    gap: 13px;
    color: #c6d4d7;
    font-size: 26px;
    max-width: 160px;
  }
  .reserves > span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .reserves > span > span {
    font-size: 10px;
    line-height: 1.4;
  }
  .explanations {
    position: absolute;
    right: 0;
    bottom: 5px;
    width: 220px;
    font-size: 11px;
    line-height: 1.5;
  }
  .explanations p {
    padding: 7px 10px;
    background: #071d2b44;
    border-left: 2px solid #a8874d;
    margin: 6px 0;
  }
  .explanations .gain {
    color: #e7d399;
  }
  .confirmation {
    position: sticky;
    bottom: 0;
    z-index: 4;
    max-width: 630px;
    margin: 12px auto 0;
    text-align: center;
    background: #112c3bf5;
    border: 1px solid #748b8e44;
    border-bottom: 0;
    border-radius: 9px 9px 0 0;
    padding: 10px 16px max(10px, env(safe-area-inset-bottom));
    box-sizing: border-box;
    box-shadow: 0 -5px 18px #10243344;
    min-height: 42px;
  }
  .confirmation.hidden {
    display: none;
  }
  .confirmation:empty {
    border: 0;
    padding: 0;
    min-height: 16px;
    background: transparent;
    box-shadow: none;
  }
  .confirmation p {
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 6px;
  }
  .confirmation .marker-preview {
    color: #e4c692;
    font-size: 11px;
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .confirmation button,
  .primary {
    padding: 10px 15px;
    border: 1px solid #9aafad77;
    background: #1f4154;
    color: #f8eed9;
    border-radius: 5px;
  }
  .confirmation .primary,
  .primary {
    background: #e4c186;
    color: #1c3545;
    border-color: #e4c186;
    font-weight: 700;
  }
  .primary:disabled {
    opacity: 0.45;
  }
  .confirmation .skip {
    min-height: 44px;
    font-size: 11px;
    margin-top: 6px;
    padding: 5px 10px;
  }
  .results {
    max-width: 820px;
    margin: 22px auto;
    text-align: center;
    padding: 20px;
    background: #0d2638;
    border-top: 1px solid #ab8c53;
  }
  .results h2 {
    font:
      28px Georgia,
      serif;
    color: #ead09e;
  }
  .results > p {
    font-size: 12px;
    line-height: 1.5;
    color: #c9d6d8;
  }
  .result-boards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 18px;
    text-align: left;
  }
  .result-boards h3 {
    font:
      21px Georgia,
      serif;
  }
  .result-boards dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 7px;
    font-size: 12px;
  }
  .result-boards dd {
    margin: 0;
    text-align: right;
  }
  .total {
    font-weight: 700;
    font-size: 15px;
    border-top: 1px solid #7f8d8255;
    padding-top: 7px;
  }
  .results > .primary {
    margin: 15px auto 0;
  }
  dialog {
    color: #172b3a;
    background: #f5edda;
    border: 1px solid #b79965;
    border-radius: 10px;
    padding: 22px;
    width: min(680px, calc(100vw - 40px));
    max-height: calc(100dvh - 44px);
    box-sizing: border-box;
    box-shadow: 0 20px 80px #06182488;
  }
  dialog::backdrop {
    background: #071521bb;
    backdrop-filter: blur(4px);
  }
  dialog h2 {
    font:
      27px Georgia,
      serif;
    margin: 0 40px 18px 0;
  }
  dialog .close {
    position: sticky;
    float: right;
    top: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid #bcae91;
    background: #f9f1df;
    color: #254459;
    font-size: 26px;
    margin: -8px -8px 0 0;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .settings label {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-height: 44px;
    font-size: 14px;
  }
  .settings .toggle {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .settings input[type='checkbox'] {
    width: 23px;
    height: 23px;
    accent-color: #245d78;
  }
  .settings input[type='range'] {
    height: 44px;
    accent-color: #245d78;
  }
  .settings select {
    background: #fff8e8;
    border: 1px solid #a69a80;
    padding: 12px;
    border-radius: 4px;
    min-height: 44px;
  }
  .room-settings {
    border-top: 1px solid #b9aa8a;
    padding-top: 15px;
  }
  .room-settings :global(button),
  .room-settings :global(select) {
    min-height: 44px;
  }
  .room-settings :global(a) {
    color: #205977;
  }
  @media (min-width: 1100px) and (min-height: 900px) {
    .surface {
      padding-top: 22px;
    }
    .factories {
      height: 290px;
    }
    .opponents {
      margin-top: 15px;
    }
    .table-bottom {
      margin-top: 10px;
    }
  }
  @media (max-width: 1100px) {
    .reserves {
      position: static;
      flex-direction: row;
      justify-content: center;
      max-width: none;
      margin: 0 0 10px;
      font-size: 19px;
    }
    .explanations {
      position: static;
      width: auto;
      max-width: 530px;
      margin: 10px auto;
    }
    .explanations:empty {
      display: none;
    }
    .factories {
      height: 320px;
    }
    .table-bottom {
      margin: 0 auto;
    }
    .opponents {
      gap: 8px;
    }
    .opponent {
      min-width: 0;
      padding: 8px 10px;
    }
    .mini-patterns {
      gap: 4px;
    }
  }
  @media (max-width: 600px) {
    .surface {
      padding: 14px 10px 0;
    }
    .azul-table::before {
      inset: 5px;
    }
    .corner {
      width: 44px;
      height: 44px;
      top: max(10px, env(safe-area-inset-top));
    }
    dialog {
      width: calc(100vw - 20px);
      padding: 14px;
    }
    .book {
      left: max(10px, env(safe-area-inset-left));
    }
    .gear {
      right: max(10px, env(safe-area-inset-right));
    }
    .table-heading {
      padding: 0 44px;
      min-height: 67px;
    }
    .wordmark {
      font-size: 19px;
    }
    .round {
      font-size: 10px;
      padding-left: 8px;
      margin-left: 8px;
    }
    h1 {
      font-size: 12px;
      line-height: 1.35;
      margin: 5px 0;
    }
    .practice-note {
      font-size: 9px;
    }
    .opponents {
      gap: 5px;
      margin: 9px auto 10px;
      align-items: stretch;
    }
    .opponent {
      padding: 7px;
      gap: 3px 5px;
      grid-template-columns: 1fr auto;
    }
    .opponent-name {
      font-size: 13px;
    }
    .opponent strong {
      font-size: 17px;
    }
    .risk {
      font-size: 9px;
      line-height: 1.45;
    }
    .mini-patterns {
      display: none;
    }
    .factories,
    .factories.many {
      height: auto;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 5px;
      justify-items: center;
      margin: 0 auto;
      max-width: 360px;
    }
    .factory {
      position: relative;
      left: auto;
      top: auto;
      transform: none;
      width: 104px;
      height: 104px;
    }
    .factory-number {
      left: 48px;
    }
    .factory-tiles {
      grid-template-columns: repeat(2, 44px);
    }
    .center {
      position: static;
      transform: none;
      grid-column: 1/-1;
      width: 100%;
      padding: 3px 0 5px;
      min-height: 64px;
      box-sizing: border-box;
      border-bottom: 1px solid #8fa7ac33;
    }
    .center h2 {
      font-size: 12px;
      margin: 0 0 3px;
    }
    .center-colors {
      gap: 5px;
    }
    .center-group {
      min-width: 44px;
      min-height: 49px;
      flex-direction: row;
      gap: 4px;
      padding: 2px;
    }
    .center-tile {
      width: 25px;
      height: 25px;
    }
    .center-marker {
      width: 25px;
      height: 25px;
      margin: 0;
    }
    .reserves {
      font-size: 14px;
      gap: 15px;
      margin: 8px 0;
    }
    .reserves > span > span {
      font-size: 9px;
    }
    .table-bottom {
      margin-top: 4px;
    }
    .confirmation {
      margin-top: 10px;
      padding: 9px 9px max(10px, env(safe-area-inset-bottom));
      border-radius: 7px 7px 0 0;
    }
    .confirmation p {
      font-size: 11px;
    }
    .confirmation button {
      font-size: 12px;
      padding: 10px 12px;
      flex: 1;
    }
    .confirmation .skip {
      flex: none;
    }
    .result-boards {
      grid-template-columns: 1fr;
    }
    .results {
      padding: 16px;
    }
    .results h2 {
      font-size: 24px;
    }
    dialog {
      padding: 17px;
      width: calc(100vw - 22px);
      max-height: calc(100dvh - 24px);
    }
    dialog h2 {
      font-size: 23px;
    }
    .settings {
      gap: 16px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .factory-tiles button {
      transition: none;
    }
    .factory-tiles button:not(:disabled):hover {
      transform: none;
    }
  }
</style>
