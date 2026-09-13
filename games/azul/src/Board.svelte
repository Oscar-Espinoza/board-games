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
  import './tokens.css';
  import { ringGeometry, scatter } from './geometry.js';
  import { RevisionGate, planPresentation } from './presentation.js';
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
    modal = $state<
      | 'help'
      | 'settings'
      | 'opponent'
      | 'factory'
      | 'draft'
      | 'details'
      | 'results'
    >('help'),
    inspected = $state('');
  let selection = $state<{
      source: Source;
      color: Color;
      revision: number;
      identity: string;
    } | null>(null),
    destination = $state<Destination | null>(null),
    submitting = $state(false),
    notice = $state(''),
    animating = $state(false),
    recent = $state<Event[]>([]),
    hiddenLocations = $state<string[]>([]);
  let sound = $state(true),
    volume = $state(0.25),
    motion = $state<'system' | 'reduced' | 'full'>('system'),
    systemReduced = $state(false),
    mounted = $state(false),
    phone = $state(false),
    picker = $state<number | null>(null),
    awaitingPresentation = $state(false);
  let pickerOpener: HTMLElement | null = null;
  const ring = $derived(ringGeometry(visual.factories.length, phone));
  const gate = new RevisionGate(),
    audio = ceramicAudio(),
    flights = tileFlights();
  let opener: HTMLElement | null = null,
    epoch = 0,
    flightScrollTop = 0;
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
      !animating &&
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
    picker = null;
    selection = null;
    destination = null;
    notice = message;
  }
  function settle() {
    epoch++;
    flights.cancel();
    audio.stop();
    animating = false;
    awaitingPresentation = false;
    hiddenLocations = [];
    visual = view.public;
    recent = view.public.events.filter(
      (e) => e.type === 'wall' || e.type === 'penalty' || e.type === 'finish',
    );
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
  function open(
    kind:
      | 'help'
      | 'settings'
      | 'opponent'
      | 'factory'
      | 'draft'
      | 'details'
      | 'results',
    id = '',
  ) {
    baseline();
    if (!dialog?.open) opener = document.activeElement as HTMLElement;
    modal = kind;
    inspected = id;
    if (!dialog?.open) dialog?.showModal();
  }
  function close() {
    baseline();
    if (modal === 'draft') clear();
    if (modal === 'factory') picker = null;
    dialog?.close();
    opener?.focus({ preventScroll: true });
  }
  async function openFactory(index: number, event: MouseEvent) {
    if (!playable) return;
    clear();
    pickerOpener = event.currentTarget as HTMLElement;
    picker = index;
    open('factory');
    await tick();
    root
      ?.querySelector<HTMLButtonElement>('.factory-picker button[data-color]')
      ?.focus();
  }
  function cancelPicker() {
    picker = null;
    dialog?.close();
    pickerOpener?.focus({ preventScroll: true });
  }
  function choose(source: Source, color: Color) {
    if (!playable) return;
    settle();
    picker = null;
    selection = {
      source,
      color,
      revision: visual.revision,
      identity: `${round}/${playerId}`,
    };
    destination = null;
    notice = '';
    if (phone) open('draft');
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
    if (dialog?.open && modal === 'draft') dialog.close();
    const revision = selection.revision;
    const action = {
      type: 'DRAFT',
      source: selection.source,
      color: selection.color,
      destination,
    };
    submitting = true;
    settle();
    awaitingPresentation = true;
    clear();
    try {
      await send(action);
    } catch {
      awaitingPresentation = false;
      notice = m.azul_error();
    } finally {
      submitting = false;
      if (view.public.revision === revision) awaitingPresentation = false;
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
    const phoneMedia = matchMedia('(max-width: 900px), (max-height: 680px)');
    phone = phoneMedia.matches;
    const phoneChanged = () => {
      phone = phoneMedia.matches;
      clear();
      if (dialog?.open && (modal === 'factory' || modal === 'draft'))
        dialog.close();
      baseline();
    };
    phoneMedia.addEventListener('change', phoneChanged);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    systemReduced = media.matches;
    const changed = () => {
      systemReduced = media.matches;
      baseline();
    };
    const scroll = () => {
      if (
        animating &&
        root?.querySelector('.surface')?.scrollTop !== flightScrollTop
      )
        settle();
    };
    const resize = () => baseline(),
      visibility = () => baseline();
    media.addEventListener('change', changed);
    window.addEventListener('resize', resize);
    root
      ?.querySelector('.surface')
      ?.addEventListener('scroll', scroll, { passive: true });
    document.fonts?.addEventListener('loadingdone', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      settle();
      audio.close();
      media.removeEventListener('change', changed);
      window.removeEventListener('resize', resize);
      phoneMedia.removeEventListener('change', phoneChanged);
      root?.querySelector('.surface')?.removeEventListener('scroll', scroll);
      document.fonts?.removeEventListener('loadingdone', resize);
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
      const interrupted = animating;
      const previous = visual;
      const scrollTop = node?.querySelector('.surface')?.scrollTop ?? 0;
      const before = node ? measure(node) : new Map();
      settle();
      const token = epoch;
      picker = null;
      if (dialog?.open && (modal === 'factory' || modal === 'draft'))
        dialog.close();
      if (
        selection &&
        (selection.revision !== next.revision ||
          !online ||
          selection.identity !== identity)
      )
        clear(m.azul_changed());
      if (!eligible) recent = [];
      if (
        eligible &&
        !interrupted &&
        node &&
        !reduced &&
        !document.hidden &&
        !dialog?.open
      ) {
        const plan = planPresentation(
          $state.snapshot(previous),
          $state.snapshot(next),
        );
        flightScrollTop = scrollTop;
        animating = true;
        recent = [];
        visual = { ...next, phase: previous.phase };
        // Measure the accepted destinations before showing temporary presentation steps.
        void tick().then(() => {
          if (epoch !== token) return;
          const after = measure(node);
          flightScrollTop = node.querySelector('.surface')?.scrollTop ?? 0;
          const dy = scrollTop - flightScrollTop;
          if (dy)
            for (const [key, rect] of before)
              before.set(
                key,
                new DOMRect(rect.x, rect.y + dy, rect.width, rect.height),
              );
          visual = plan.initial;
          recent = [];
          animating = flights.play(
            plan,
            before,
            after,
            (step) => {
              if (epoch === token) {
                visual = step.state;
                recent = step.recent;
                hiddenLocations = step.hidden;
              }
            },
            () => {
              if (epoch === token) settle();
            },
            audio,
          );
        });
      }
    });
  });
  $effect(() => {
    if (errorCode === 'STALE_REVISION' || errorCode === 'MATCH_CHANGED')
      untrack(() => clear(m.azul_changed()));
  });
  let resultShown = '';
  $effect(() => {
    const key = `${round}/${visual.revision}`;
    if (visual.phase !== 'finished') resultShown = '';
    if (visual.phase !== 'finished' && modal === 'results' && dialog?.open)
      untrack(() => close());
    if (visual.phase === 'finished' && !animating && resultShown !== key) {
      resultShown = key;
      untrack(() => open('results'));
    }
  });
  function keyboard(event: KeyboardEvent) {
    if (event.isTrusted) audio.unlock();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (dialog?.open) close();
      else if (picker !== null) cancelPicker();
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
  class:compact-table={phone}
  bind:this={root}
  lang={locale}
  data-game-revision={view.public.revision}
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
    <div class="table-content">
      <header class="table-heading">
        <span class="wordmark">AZUL</span><span class="round"
          >{m.azul_round({ round: visual.roundNumber })}</span
        >
        <h1 aria-live="polite">
          {visual.phase === 'finished'
            ? m.azul_finished()
            : active === playerId
              ? phone
                ? m.azul_your_turn_short()
                : m.azul_your_turn()
              : m.azul_turn({ name: name(active) })}
        </h1>
        {#if practice}<p class="practice-note">{m.azul_practice()}</p>{/if}
      </header>
      {#if !connected}<p class="connection" role="status">
          {m.azul_disconnected()}
        </p>{/if}
      <div class="opponents">
        {#each visual.players.filter((id) => id !== playerId) as id}
          {@const board = visual.boards[visual.players.indexOf(id)]}
          <article
            class="opponent"
            class:turn={active === id}
            data-azul-location="{id}/summary"
          >
            <div class="opponent-heading">
              <span class="opponent-name" title={name(id)}
                >{#if active === id}▸
                {/if}{name(id)}{#if visual.markerOwner === id}
                  ①{/if}</span
              ><strong>{board.score}</strong>
              {#if players.find((p) => p.id === id)?.connected === false}<span
                  class="offline">{m.azul_offline()}</span
                >{/if}
            </div>
            <span class="risk"
              >{m.azul_risk({
                patterns: board.patterns.reduce((n, p) => n + p.count, 0),
                floor: board.floor.length,
              })}</span
            >
            <div class="opponent-preview">
              <PlayerBoard
                {board}
                {id}
                name={name(id)}
                density="compact"
                interactive={false}
                {hiddenLocations}
              />
              <button
                class="inspect"
                aria-label={m.azul_inspect({
                  name: name(id),
                  score: board.score,
                })}
                onclick={() => open('opponent', id)}
              ></button>
            </div>
          </article>
        {/each}
      </div>
      <div class="supply">
        <div
          class="factories"
          style="--ring:{ring.size}px;--disc:{ring.disc}px"
        >
          {#each visual.factories as factory, index}
            {@const position = ring.points[index]}
            <div
              class="factory"
              style="--x:{position.x}px;--y:{position.y}px"
              aria-label={m.azul_factory({ number: index + 1 })}
            >
              <span class="factory-number">{index + 1}</span>
              {#if phone}
                <button
                  class="factory-open"
                  disabled={!playable || !factory.length}
                  aria-label={m.azul_select_factory({ number: index + 1 })}
                  aria-expanded={picker === index}
                  aria-controls="azul-factory-picker"
                  onclick={(e) => openFactory(index, e)}
                >
                  <span class="factory-tiles"
                    >{#each Array(4) as _, slot}<span class="factory-slot"
                        >{#if factory[slot]}<Tile
                            color={factory[slot]}
                            location="factory/{index}/{slot}"
                          />{:else}<span
                            class="factory-empty"
                            data-azul-location="factory/{index}/{slot}"
                          ></span>{/if}</span
                      >{/each}</span
                  >
                </button>
              {:else}
                <div class="factory-tiles">
                  {#each Array(4) as _, slot}{@const color = factory[slot]}
                    {#if color}<button
                        disabled={!playable}
                        class:selected={selection?.source.kind === 'factory' &&
                          selection.source.index === index &&
                          selection.color === color}
                        aria-label={m.azul_source({
                          count: factory.filter((c) => c === color).length,
                          color: labels[color](),
                          source: m.azul_factory({ number: index + 1 }),
                        })}
                        onclick={() =>
                          choose({ kind: 'factory', index }, color)}
                        ><Tile
                          {color}
                          location="factory/{index}/{slot}"
                        /></button
                      >
                    {:else}<span
                        class="factory-empty"
                        data-azul-location="factory/{index}/{slot}"
                      ></span>{/if}
                  {/each}
                </div>
              {/if}
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
                  ><span class="cluster" data-azul-location="center/{color}">
                    {#each Array(Math.max(1, count)) as _, slot}{@const offset =
                        scatter(slot)}<span
                        class="center-tile"
                        style="left:{offset.x}px;top:{offset.y}px;transform:rotate({offset.angle}deg)"
                        ><Tile
                          {color}
                          ghost={!count}
                          location={count
                            ? `center/${color}/${slot}`
                            : undefined}
                        /></span
                      >{/each}
                  </span><b>{count}</b></button
                >
              {/each}
              <span
                class="center-marker"
                class:marker-away={!!visual.markerOwner}
                title={m.azul_marker()}
                ><Tile color="marker" location="center/marker" /></span
              >
            </div>
          </div>
        </div>
      </div>
      <div class="table-bottom">
        <div class="reserves">
          <span data-azul-location="bag"
            ><svg viewBox="0 0 60 64" aria-hidden="true"
              ><path
                d="m20 6 20 0-4 12c22 23 22 41-6 42C2 59 2 42 24 18Z"
                fill="#bc9b6b"
                stroke="#5a3c25"
                stroke-width="2"
              /><path
                d="m20 18 20 0M25 23c-13 21-12 26-6 31m14-29c12 22 10 25 6 30"
                fill="none"
                stroke="#715237"
                stroke-width="2"
              /></svg
            ><span>{m.azul_bag({ count: visual.bagCount })}</span></span
          ><span data-azul-location="discard"
            ><svg viewBox="0 0 72 58" aria-hidden="true"
              ><path
                d="m4 10 48-5 16 15-5 30-48 4L4 40Z"
                fill="#243f4a"
                stroke="#b89962"
                stroke-width="2"
              /><path
                d="m4 10 15 15 49-5M19 25l-4 29m13-39 16-2"
                fill="none"
                stroke="#d8bb85"
                stroke-width="2"
              /></svg
            ><span>{m.azul_discard({ count: visual.discardCount })}</span></span
          >
        </div>
        {#if ownBoard}<div
            class="own-board"
            data-azul-location="{playerId}/summary"
          >
            <PlayerBoard
              density={phone ? 'compact' : 'full'}
              interactive={!phone}
              fitted={true}
              {hiddenLocations}
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
            {#if phone}<button
                class="inspect own-inspect"
                aria-label={m.azul_inspect({
                  name: name(playerId),
                  score: ownBoard.score,
                })}
                onclick={() => open('opponent', playerId)}
              ></button><span class="own-caption"
                >{name(playerId)} · {ownBoard.score}</span
              >{/if}
          </div>{/if}
      </div>
      <footer class="table-footer">
        {#if !phone}{@render confirmationPanel()}{/if}
        <div class="table-status">
          {#if phone && notice}<p role="status">
              {notice}
            </p>{:else if phone && (submitting || pending)}<p role="status">
              {m.azul_sending()}
            </p>{/if}
          {#if phone && animating}<button onclick={settle}
              >{m.azul_skip()}</button
            >{/if}
          {#if recent.length}<button onclick={() => open('details')}
              >{m.azul_round_details()}</button
            >{/if}
          {#if visual.phase === 'finished'}<button
              onclick={() => open('results')}>{m.azul_finished()}</button
            >{/if}
        </div>
      </footer>
    </div>
  </div>
  {#snippet confirmationPanel()}
    <div
      class="confirmation"
      class:hidden={!selection &&
        !notice &&
        !submitting &&
        !pending &&
        !animating &&
        !awaitingPresentation &&
        (visual.phase === 'finished' || active === playerId)}
      aria-live="polite"
    >
      {#if notice}<p role="status">{notice}</p>{/if}
      {#if selection}<div
          class="in-hand"
          aria-label={m.azul_selection_preview()}
        >
          <span><Tile color={selection.color} /></span><b>×{quantity}</b><span
            >{m.azul_selection_preview()}</span
          >
        </div>
        <p>
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
          <button
            onclick={() =>
              modal === 'draft' && dialog?.open ? close() : clear()}
            >{m.azul_cancel()}</button
          ><button
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
  {/snippet}
  <dialog
    class:drafting={modal === 'draft'}
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
          : modal === 'factory'
            ? m.azul_factory({ number: (picker ?? 0) + 1 })
            : modal === 'draft'
              ? m.azul_patterns()
              : modal === 'details'
                ? m.azul_round_details()
                : modal === 'results'
                  ? m.azul_finished()
                  : name(inspected)}
    </h2>
    {#if modal === 'factory'}
      {#if picker !== null}<section
          class="factory-picker"
          id="azul-factory-picker"
          aria-label={m.azul_factory({ number: picker + 1 })}
        >
          <p>{m.azul_choose_factory_color({ number: picker + 1 })}</p>
          <div>
            {#each colors as color}{@const count = visual.factories[
                picker
              ].filter((c) => c === color).length}{#if count}<button
                  data-color={color}
                  onclick={() =>
                    choose({ kind: 'factory', index: picker! }, color)}
                  aria-label={m.azul_source({
                    count,
                    color: labels[color](),
                    source: m.azul_factory({ number: picker + 1 }),
                  })}
                  ><span><Tile {color} /></span>{labels[color]()} ×{count}</button
                >{/if}{/each}<button onclick={cancelPicker}
              >{m.azul_cancel()}</button
            >
          </div>
        </section>{/if}
    {:else if modal === 'draft' && ownBoard}
      <PlayerBoard
        board={ownBoard}
        id={playerId}
        name={name(playerId)}
        anchors={false}
        fitted={true}
        color={selection?.color ?? null}
        {destination}
        choose={playable ? chooseDestination : undefined}
      />
      {@render confirmationPanel()}
    {:else if modal === 'details'}
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
    {:else if modal === 'results'}
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
    {:else if modal === 'help'}<Help />{:else if modal === 'settings'}<div
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
        anchors={false}
        interactive={false}
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
    isolation: isolate;
    background:
      radial-gradient(ellipse at 50% 27%, #ffdca614, transparent 65%),
      repeating-linear-gradient(
        93deg,
        transparent 0 3px,
        #00000012 3px 4px,
        transparent 4px 11px,
        #ffffff05 11px 12px
      ),
      var(--azul-wood);
    color: var(--azul-table-ink);
    font-family: var(--azul-body);
    font-size: 14px;
  }
  .surface {
    overflow-anchor: none;
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
    box-sizing: border-box;
    padding: max(18px, env(safe-area-inset-top))
      max(10px, env(safe-area-inset-right))
      max(24px, env(safe-area-inset-bottom))
      max(10px, env(safe-area-inset-left));
    scrollbar-color: #a18459 #31210f;
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
  .corner {
    position: absolute;
    top: max(14px, env(safe-area-inset-top));
    z-index: 6;
    width: 48px;
    height: 48px;
    padding: 8px;
    background: #2e2318f5;
    color: #f0dfbd;
    border: 1px solid #a88c5788;
    border-radius: 50%;
    box-shadow: 0 2px 6px #0004;
  }
  .corner svg {
    width: 100%;
    height: 100%;
  }
  .book {
    left: max(14px, env(safe-area-inset-left));
  }
  .gear {
    right: max(14px, env(safe-area-inset-right));
  }
  .table-heading {
    text-align: center;
    min-height: 72px;
    padding: 0 54px;
    box-sizing: border-box;
  }
  .wordmark {
    font: 28px var(--azul-title);
    letter-spacing: 0.26em;
    color: var(--azul-table-ink);
  }
  .round {
    font-size: 12px;
    margin-left: 15px;
    border-left: 1px solid #a58d65;
    padding-left: 15px;
    color: var(--azul-table-soft);
  }
  h1 {
    font-size: 16px;
    font-weight: 500;
    margin: 7px 0;
  }
  .practice-note {
    font-size: 12px;
    color: var(--azul-table-soft);
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
    max-width: 820px;
    margin: 18px auto;
  }
  .opponent {
    position: relative;
    min-width: 0;
    max-width: 260px;
    flex: 1;
    padding: 8px;
    border-radius: 7px;
    background: #21170f66;
    border: 1px solid transparent;
  }
  .opponent.turn {
    border-color: #d2ab66;
  }
  .opponent-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .opponent-name {
    font: 18px var(--azul-title);
    overflow-wrap: anywhere;
  }
  .opponent strong {
    font-size: 22px;
  }
  .risk {
    display: block;
    font-size: 12px;
    color: var(--azul-table-soft);
    margin: 3px 0 8px;
  }
  .opponent-preview {
    position: relative;
  }
  .inspect {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
    border-radius: 5px;
  }
  .supply {
    width: fit-content;
    margin: 12px auto;
  }
  .factories {
    width: var(--ring);
    height: var(--ring);
    position: relative;
  }
  .factory {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: var(--disc);
    height: var(--disc);
    border-radius: 50%;
    background: var(--azul-disc);
    box-shadow: var(--azul-disc-shadow);
    display: grid;
    place-items: center;
  }
  .factory::before {
    content: '';
    position: absolute;
    inset: 5px;
    border: 1px solid #2f6a856b;
    outline: 1px dashed #2f6a8544;
    outline-offset: -4px;
    border-radius: 50%;
    pointer-events: none;
  }
  .factory-number {
    position: absolute;
    top: 1px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: #293c40;
  }
  .factory-tiles {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(2, 44px);
    grid-template-rows: repeat(2, 44px);
  }
  .factory-tiles button {
    width: 44px;
    height: 44px;
    padding: 6px;
    border: 0;
    background: transparent;
    border-radius: 6px;
  }
  .factory-tiles button:not(:disabled):hover {
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
    display: block;
    width: 28px;
    height: 28px;
    margin: 8px;
    border: 1px solid #ad9c7688;
    box-sizing: border-box;
    border-radius: 3px;
  }
  .factory-open {
    width: 56px;
    height: 56px;
    border: 0;
    background: transparent;
    border-radius: 50%;
    padding: 10px;
  }
  .factory-open .factory-tiles {
    grid-template-columns: repeat(2, 18px);
    grid-template-rows: repeat(2, 18px);
  }
  .factory-slot {
    padding: 1px;
    display: block;
  }
  .factory-slot .factory-empty {
    width: 16px;
    height: 16px;
    margin: 0;
  }
  .center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 146px;
    height: 160px;
    text-align: center;
  }
  .center h2 {
    font: 14px var(--azul-title);
    color: var(--azul-table-soft);
    margin: 0 0 4px;
    height: 20px;
  }
  .center-colors {
    display: grid;
    grid-template-columns: repeat(3, 46px);
    grid-auto-rows: 64px;
    gap: 4px;
    align-items: center;
  }
  .center-group {
    width: 46px;
    height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid transparent;
    background: transparent;
    color: var(--azul-table-ink);
    padding: 0;
    border-radius: 5px;
  }
  .cluster {
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
  }
  .center-tile {
    position: absolute;
    display: block;
    width: 25px;
    height: 25px;
    pointer-events: none;
  }
  .center-group b {
    position: relative;
    font-size: 12px;
    background: #302115;
    border-radius: 3px;
    padding: 0 4px;
  }
  .center-group.selected {
    border-color: #e8c480;
    background: #d4bd8530;
  }
  .center-group:disabled {
    opacity: 1;
  }
  .center-group.absent .cluster {
    opacity: 0.45;
  }
  .center-marker {
    width: 28px;
    height: 28px;
    display: block;
    margin: auto;
  }
  .marker-away {
    opacity: 0;
  }
  .factory-picker {
    max-width: 530px;
    margin: 12px auto;
    padding: 12px;
    background: #302115;
    border: 1px solid #a18459;
    border-radius: 8px;
  }
  .factory-picker p {
    margin: 0 0 8px;
  }
  .factory-picker > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .factory-picker button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    color: #293c40;
    background: #f5ead3;
    border: 1px solid #c9b28c;
    border-radius: 5px;
  }
  .factory-picker button > span {
    width: 26px;
    height: 26px;
  }
  .table-bottom {
    max-width: 560px;
    margin: 12px auto;
  }
  .own-board {
    max-width: 530px;
    margin: 0 auto;
  }
  .reserves {
    display: flex;
    justify-content: center;
    gap: 26px;
    margin: 8px 0 14px;
    color: var(--azul-table-soft);
  }
  .reserves > span {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .reserves svg {
    width: 42px;
    height: 42px;
  }
  .explanations {
    font-size: 13px;
    line-height: 1.5;
  }
  .explanations:empty {
    display: none;
  }
  .explanations p {
    padding: 7px 10px;
    background: #21170f88;
    border-left: 2px solid #a8874d;
    margin: 6px 0;
  }
  .confirmation {
    max-width: 560px;
    margin: 12px auto 0;
    text-align: center;
    background: #302115;
    border: 1px solid #a18459;
    border-radius: 8px;
    padding: 12px;
    box-sizing: border-box;
  }
  .confirmation.hidden {
    display: none;
  }
  .confirmation p {
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 6px;
  }
  .marker-preview {
    color: var(--azul-table-soft);
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .confirmation button,
  .primary {
    padding: 10px 15px;
    border: 1px solid #aa936e;
    background: #49351f;
    color: #fff4dc;
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
  .skip {
    margin-top: 6px;
  }
  .in-hand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .in-hand > span:first-child {
    width: 28px;
    height: 28px;
  }
  .in-hand > span:last-child {
    font-size: 12px;
  }
  .results {
    max-width: 820px;
    margin: 22px auto;
    text-align: center;
    padding: 20px;
    background: #302115;
    border-top: 1px solid #ab8c53;
  }
  .results h2 {
    font: 28px var(--azul-title);
    color: var(--azul-table-ink);
  }
  .results > p {
    font-size: 14px;
    line-height: 1.5;
    color: var(--azul-table-soft);
  }
  .result-boards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 18px;
    text-align: left;
  }
  .result-boards h3 {
    font: 21px var(--azul-title);
  }
  .result-boards dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 7px;
    font-size: 14px;
  }
  .result-boards dd {
    margin: 0;
    text-align: right;
  }
  .total {
    font-weight: 700;
    font-size: 16px;
    border-top: 1px solid #aa936e;
    padding-top: 7px;
  }
  .results > .primary {
    margin: 15px auto 0;
  }
  @media (max-width: 600px) {
    .corner {
      width: 44px;
      height: 44px;
      top: max(10px, env(safe-area-inset-top));
    }
    .book {
      left: max(10px, env(safe-area-inset-left));
    }
    .gear {
      right: max(10px, env(safe-area-inset-right));
    }
    .wordmark {
      font-size: 23px;
    }
    .round {
      display: inline-block;
      margin: 4px 0;
      padding: 0;
      border: 0;
    }
    .table-heading {
      padding: 0 48px;
    }
    .opponents {
      gap: 5px;
      margin: 12px auto;
    }
    .opponent {
      padding: 3px;
    }
    .opponent-name {
      font-size: 14px;
    }
    .opponent strong {
      font-size: 17px;
    }
    .risk {
      font-size: 12px;
      line-height: 1.3;
    }
    .factory-number {
      top: 0;
      font-size: 9px;
    }
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
      27px var(--azul-title),
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

  @media (max-width: 600px) {
    dialog {
      width: calc(100vw - 20px);
      padding: 14px;
    }
  }
  /* The table itself is a viewport, never a document-sized scroll surface. */
  .surface {
    overflow: hidden;
    padding: max(6px, env(safe-area-inset-top))
      max(10px, env(safe-area-inset-right))
      max(6px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  }
  .table-content {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(460px, 1fr) minmax(0, 1.1fr);
    grid-template-rows: 44px 72px minmax(0, 1fr) 88px;
    gap: 8px 24px;
    max-width: 1440px;
    margin: auto;
  }
  .table-heading {
    grid-column: 1/-1;
    grid-row: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px;
    padding: 0 58px;
  }
  .table-heading h1 {
    margin: 0;
  }
  .practice-note {
    display: none;
  }
  .opponents {
    grid-column: 1/-1;
    grid-row: 2;
    display: flex;
    width: 100%;
    height: 72px;
    max-width: 960px;
    margin: 0 auto;
    gap: 16px;
  }
  .opponent {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 74px;
    grid-template-rows: 26px 1fr;
    gap: 2px 8px;
    margin: 0;
    padding: 4px 8px;
    max-width: 300px;
    height: 72px;
    box-sizing: border-box;
  }
  .opponent-heading {
    grid-column: 1;
  }
  .opponent-name {
    font-size: 16px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .offline {
    font-size: 10px;
  }
  .opponent strong {
    font-size: 18px;
  }
  .risk {
    grid-column: 1;
    margin: 0;
    font-size: 11px;
  }
  .opponent-preview {
    grid-column: 2;
    grid-row: 1 / span 2;
    width: 74px;
    align-self: center;
  }
  .supply {
    grid-column: 1;
    grid-row: 3;
    margin: 0;
    align-self: center;
    justify-self: center;
  }
  .table-bottom {
    grid-column: 2;
    grid-row: 3;
    width: 100%;
    min-width: 0;
    margin: 0;
    align-self: center;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
  }
  .own-board {
    position: relative;
    width: 100%;
    max-width: 530px;
    margin: 0 auto;
  }
  .reserves {
    margin: 0;
    font-size: 11px;
    gap: 18px;
  }
  .reserves svg {
    width: 28px;
    height: 28px;
  }
  .reserves > span {
    font-size: 11px;
  }
  .table-footer {
    grid-column: 1/-1;
    grid-row: 4;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .table-status {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .table-status button {
    background: #302115;
    color: var(--azul-table-ink);
    border: 1px solid #a18459;
    border-radius: 6px;
    padding: 6px 12px;
  }
  .table-status p {
    margin: 0;
    font-size: 12px;
  }
  .confirmation {
    flex: 1;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 8px;
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 4px 10px;
    align-items: center;
  }
  .confirmation.hidden {
    display: none;
  }
  .confirmation .in-hand {
    grid-column: 1;
    grid-row: 1 / span 2;
    margin: 0;
    flex-wrap: wrap;
    gap: 4px;
  }
  .confirmation .in-hand > span:last-child {
    display: none;
  }
  .confirmation p {
    grid-column: 2;
    margin: 0;
    font-size: 13px;
    line-height: 1.25;
  }
  .confirmation .confirm-actions {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
  .confirmation .skip {
    grid-column: 3;
    margin: 0;
  }
  .confirmation:not(.hidden):not(:has(.in-hand)) {
    display: flex;
    justify-content: center;
  }
  .connection {
    position: absolute;
    top: 54px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    margin: 0;
  }
  .factory-picker {
    margin: 0;
    max-width: none;
  }
  .results {
    margin: 0;
    padding: 10px;
    max-width: none;
    color: var(--azul-table-ink);
  }
  .explanations {
    color: var(--azul-ink);
  }
  .explanations p {
    background: #e6d8bc;
  }
  .own-caption {
    display: block;
    text-align: center;
    font-size: 12px;
    margin-top: 3px;
  }
  .compact-table .wordmark {
    display: none;
  }
  .compact-table .table-heading h1 {
    font-size: 14px;
  }
  .compact-table .table-content {
    grid-template-columns: minmax(340px, 1fr) minmax(0, 1fr);
  }
  .compact-table .own-board {
    width: min(230px, 100%);
  }
  .compact-table .table-footer {
    justify-content: center;
  }
  .compact-table .table-status {
    margin: 0;
  }
  dialog.drafting .confirmation {
    color: var(--azul-table-ink);
    margin-top: 8px;
    grid-template-columns: 44px minmax(0, 1fr);
  }
  dialog.drafting .confirm-actions {
    grid-column: 1/-1;
    grid-row: auto;
  }
  dialog.drafting h2 {
    font-size: 20px;
    margin-bottom: 10px;
  }
  @media (max-width: 600px) {
    .table-content,
    .compact-table .table-content {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 44px 72px 340px minmax(0, 1fr) 44px;
      gap: 4px;
    }
    .table-heading {
      display: flex;
      gap: 8px;
      padding: 0 42px;
    }
    .table-heading h1 {
      grid-column: 1/-1;
      font-size: 12px;
      white-space: nowrap;
    }
    .wordmark {
      display: none;
    }
    .round {
      font-size: 11px;
      justify-self: start;
    }
    .opponents {
      height: 72px;
      gap: 4px;
    }
    .opponent {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 28px 1fr;
      justify-items: center;
      padding: 0 3px;
      height: 72px;
      gap: 0;
    }
    .opponent-heading {
      width: 100%;
      gap: 2px;
    }
    .opponent-name {
      font-size: 12px;
    }
    .opponent strong {
      font-size: 14px;
    }
    .opponent-preview {
      grid-column: 1;
      grid-row: 2;
      width: 48px;
      min-height: 44px;
    }
    .risk {
      display: none;
    }
    .supply {
      grid-column: 1;
      grid-row: 3;
    }
    .table-bottom {
      grid-column: 1;
      grid-row: 4;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 10px;
    }
    .compact-table .own-board {
      width: clamp(130px, calc((100dvh - 530px) * 0.9), 230px);
      margin: 0;
    }
    .reserves {
      flex-direction: column;
      gap: 6px;
      max-width: 135px;
    }
    .reserves > span {
      gap: 4px;
      font-size: 10px;
    }
    .reserves svg {
      width: 24px;
      height: 24px;
      flex: none;
    }
    .table-footer {
      grid-row: 5;
    }
    dialog {
      max-height: calc(100dvh - 20px);
    }
  }
  @media (min-width: 601px) and (max-height: 680px) {
    .table-content,
    .compact-table .table-content {
      grid-template-rows: 38px minmax(0, 1fr) 44px;
      gap: 4px 12px;
    }
    .opponents {
      grid-column: 2;
      grid-row: 2;
      align-self: start;
      height: 72px;
      gap: 4px;
    }
    .opponent {
      grid-template-columns: 1fr;
      grid-template-rows: 28px 1fr;
      height: 72px;
      padding: 0 3px;
      justify-items: center;
    }
    .opponent-heading {
      width: 100%;
      gap: 2px;
    }
    .opponent strong {
      font-size: 14px;
    }
    .opponent-name {
      font-size: 12px;
    }
    .opponent-preview {
      grid-column: 1;
      grid-row: 2;
      width: 48px;
      min-height: 44px;
    }
    .risk {
      display: none;
    }
    .supply {
      grid-row: 2 / span 2;
      align-self: start;
    }
    .table-bottom {
      grid-row: 2;
      align-self: end;
    }
    .compact-table .own-board {
      width: 190px;
    }
    .table-footer {
      grid-column: 2;
      grid-row: 3;
    }
    .reserves {
      gap: 8px;
    }
    dialog.drafting[open] {
      width: min(760px, calc(100vw - 20px));
      max-height: calc(100dvh - 20px);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr);
      gap: 6px 12px;
      padding: 10px;
    }
    dialog.drafting h2 {
      grid-column: 1/-1;
      margin: 0 40px 0 0;
    }
    dialog.drafting .close {
      position: absolute;
      top: 12px;
      right: 12px;
    }
    dialog.drafting .confirmation {
      align-self: center;
    }
    dialog.drafting :global(.board-labels) {
      display: none;
    }
    dialog.drafting :global(.player-board header) {
      padding: 0;
    }
    dialog.drafting :global(.player-board.fitted .score-rail) {
      margin-bottom: 8px;
    }
  }
</style>
