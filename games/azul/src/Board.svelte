<script lang="ts">
  import { onMount, setContext, tick, untrack } from 'svelte';
  import { skinKey } from './skin.js';
  import { m } from '@board-games/shared/messages';
  import {
    colors,
    penalties,
    FLOOR_SIZE,
    type Action,
    type View,
    type Source,
    type Destination,
    type Color,
    type Event,
  } from './index.js';
  import Tile from './Tile.svelte';
  import PlayerBoard from './PlayerBoard.svelte';
  import './tokens.css';
  import { colorLabels } from './labels.js';
  import {
    bag,
    centerMarker,
    centerPile,
    centerTile,
    discard,
    factorySlot,
    summary,
  } from './locations.js';
  import { ringGeometry, scatter } from './geometry.js';
  import { planPresentation } from './presentation.js';
  import {
    RevisionGate,
    ViewerSkin,
    clamp01,
    message,
    viewerPreferences,
    type BoardProps,
  } from '@board-games/shared/ui';
  import { prefersReducedMotion } from 'svelte/motion';
  import { ceramicAudio, tileFlights, measure } from './effects.js';
  type ModalKind =
    | 'help'
    | 'settings'
    | 'opponent'
    | 'factory'
    | 'draft'
    | 'details'
    | 'results';
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
    rulesContent,
    practice = false,
    canRematch = false,
    rematch,
    errorCode,
  }: BoardProps<View, Action> = $props();
  let visual = $state(untrack(() => view.public)),
    root = $state<HTMLElement>(),
    dialog = $state<HTMLDialogElement>(),
    modal = $state<ModalKind>('help'),
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
  const prefs = viewerPreferences('azul', {
    sound: true,
    volume: 0.25,
    motion: null,
  });
  let mounted = $state(false),
    phone = $state(false),
    trayExpanded = $state(false),
    picker = $state<number | null>(null),
    awaitingPresentation = $state(false);
  let pickerOpener: HTMLElement | null = null;
  const ring = $derived(
    ringGeometry(visual.factories.length, phone ? 'compact' : 'tabletop'),
  );
  let chiptunes = $state.raw<import('./pixel/sound.js').PixelSounds | null>(
    null,
  );
  const gate = new RevisionGate(),
    audio = ceramicAudio();
  const skin = new ViewerSkin('azul', async () => {
    const [, sounds] = await Promise.all([
      import('./pixel.css'),
      import('./pixel/sound.js'),
    ]);
    chiptunes = sounds.pixelSounds(audio.raw);
  });
  const pixel = $derived(skin.pixel);
  setContext(skinKey, () => pixel);
  const flights = tileFlights(() => pixel);
  let opener: HTMLElement | null = null,
    epoch = 0,
    flightScrollTop = 0;
  /** Who and which match the presented state belongs to; a change restarts it. */
  const identity = $derived(`${round}/${playerId}`);
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
  const systemReduced = $derived(prefersReducedMotion.current);
  const motionChoice = () =>
    prefs.motion === null ? 'system' : prefs.motion ? 'full' : 'reduced';
  const chooseMotion = (choice: string) =>
    (prefs.motion = choice === 'system' ? null : choice === 'full');
  const reduced = $derived(
    prefs.motion === false || (prefs.motion === null && systemReduced),
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
    claimsMarker && ownBoard?.floor.length < FLOOR_SIZE
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
      ? Math.max(0, FLOOR_SIZE - ownBoard.floor.length - (claimsMarker ? 1 : 0))
      : 0,
  );
  function clear(text = '') {
    picker = null;
    selection = null;
    destination = null;
    notice = text;
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
      gate.accept(view.public.revision, identity, connected, view.public);
  }
  function open(kind: ModalKind, id = '') {
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
      identity,
    };
    destination = null;
    notice = '';
    audio.chip((p) => p.pick());
    if (phone) open('draft');
  }
  function chooseDestination(d: Destination) {
    settle();
    destination = d;
    audio.chip((p) => (d.kind === 'floor' ? p.floor() : p.place()));
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
    const action: Action = {
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
    } catch (error) {
      awaitingPresentation = false;
      notice = message((error as Error).message, {}, locale) ?? m.azul_error();
    } finally {
      submitting = false;
      if (view.public.revision === revision) awaitingPresentation = false;
    }
  }
  onMount(() => {
    mounted = true;
    const phoneMedia = matchMedia('(max-width: 900px), (max-height: 800px)');
    phone = phoneMedia.matches;
    const phoneChanged = () => {
      phone = phoneMedia.matches;
      trayExpanded = false;
      clear();
      if (dialog?.open && (modal === 'factory' || modal === 'draft'))
        dialog.close();
      baseline();
    };
    phoneMedia.addEventListener('change', phoneChanged);
    const scroll = () => {
      if (
        animating &&
        root?.querySelector('.surface')?.scrollTop !== flightScrollTop
      )
        settle();
    };
    let frame = 0;
    const resize = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => baseline());
      },
      visibility = () => baseline();
    window.addEventListener('resize', resize);
    root
      ?.querySelector('.surface')
      ?.addEventListener('scroll', scroll, { passive: true });
    document.fonts?.addEventListener('loadingdone', resize);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      settle();
      audio.close();
      window.removeEventListener('resize', resize);
      phoneMedia.removeEventListener('change', phoneChanged);
      root?.querySelector('.surface')?.removeEventListener('scroll', scroll);
      document.fonts?.removeEventListener('loadingdone', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  });
  $effect(() => {
    audio.pixel = pixel ? chiptunes : null;
    // Switching skins moves every anchor, so restart from a silent baseline.
    if (untrack(() => mounted)) untrack(baseline);
  });
  $effect(() => {
    audio.configure(prefs.sound, clamp01(prefs.volume));
    // Motion changes, including the system's, restart presentation from a fresh baseline.
    void prefs.motion;
    void systemReduced;
    if (mounted) untrack(baseline);
  });
  $effect(() => {
    const next = view.public,
      seat = identity,
      online = connected,
      node = root;
    const eligible = gate.accept(next.revision, seat, online, next);
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
          selection.identity !== seat)
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
                const fresh = step.recent.slice(recent.length);
                visual = step.state;
                recent = step.recent;
                hiddenLocations = step.hidden;
                if (fresh.length) audio.chip((p) => cue(p, fresh));
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
  let trayIdentity = '';
  $effect(() => {
    if (identity !== trayIdentity) {
      trayIdentity = identity;
      trayExpanded = false;
    }
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
      audio.chip((p) => p.end(visual.winners.includes(playerId)));
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
  function toggleTray() {
    settle();
    trayExpanded = !trayExpanded;
  }
  function cue(p: import('./pixel/sound.js').PixelSounds, fresh: Event[]) {
    const walls = fresh.flatMap((e) => (e.type === 'wall' ? [e] : []));
    if (walls.length) p.score(Math.max(...walls.map((e) => e.scoring.points)));
    if (fresh.some((e) => e.type === 'penalty' && e.loss)) p.penalty();
    if (
      fresh.some(
        (e) =>
          e.type === 'finish' &&
          e.bonus.rows + e.bonus.columns + e.bonus.colors,
      )
    )
      p.bonus();
  }
  const gains = (id: string) =>
    recent.flatMap((e) =>
      e.type === 'wall' && e.player === id
        ? [{ row: e.row, column: e.column, points: e.scoring.points }]
        : [],
    );
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
  class:px-tokens={pixel}
  class:az-pixel={pixel}
  class:az-reduced={pixel && reduced}
  class:compact-table={phone}
  class:tray-expanded={phone && trayExpanded}
  bind:this={root}
  lang={locale}
  data-game-revision={view.public.revision}
  data-azul-layout={phone ? 'compact' : 'tabletop'}
>
  {#if !pixel}<img
      decoding="async"
      class="table-prop lantern-prop"
      src="/games/azul/rich/lantern-v2.webp"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <img
      decoding="async"
      class="table-prop chest-prop"
      src="/games/azul/rich/tile-chest.webp"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <img
      decoding="async"
      class="table-prop tea-prop"
      src="/games/azul/rich/tea-glass.webp"
      alt=""
      aria-hidden="true"
      draggable="false"
    />{/if}
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
            data-azul-location={summary(id)}
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
          style="--ring-width:{ring.width}px;--ring-height:{ring.height}px;--disc:{ring.disc}px"
        >
          {#each visual.factories as factory, index}
            {@const position = ring.points[index]}
            <div
              class="factory"
              style="--x:{position.x}px;--y:{position.y}px"
              aria-label={m.azul_factory({ number: index + 1 })}
            >
              <img
                decoding="async"
                class="factory-plate"
                src={pixel
                  ? '/games/azul/pixel/factory.webp'
                  : '/games/azul/rich/factory-plate.webp'}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
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
                            location={factorySlot(index, slot)}
                          />{:else}<span
                            class="factory-empty"
                            data-azul-location={factorySlot(index, slot)}
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
                          color: colorLabels[color](),
                          source: m.azul_factory({ number: index + 1 }),
                        })}
                        onclick={() =>
                          choose({ kind: 'factory', index }, color)}
                        ><Tile
                          {color}
                          location={factorySlot(index, slot)}
                        /></button
                      >
                    {:else}<span
                        class="factory-empty"
                        data-azul-location={factorySlot(index, slot)}
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
                    color: colorLabels[color](),
                    source: m.azul_center(),
                  })}
                  onclick={() => choose({ kind: 'center' }, color)}
                  ><span class="cluster" data-azul-location={centerPile(color)}>
                    {#each Array(Math.max(1, count)) as _, slot}{@const offset =
                        scatter(slot)}<span
                        class="center-tile"
                        style="left:{offset.x}px;top:{offset.y}px;transform:rotate({offset.angle}deg)"
                        ><Tile
                          {color}
                          ghost={!count}
                          location={count ? centerTile(color, slot) : undefined}
                        /></span
                      >{/each}
                  </span>{#if count}<b>{count}</b>{/if}</button
                >
              {/each}
              <span
                class="center-marker"
                class:marker-away={!!visual.markerOwner}
                title={m.azul_marker()}
                ><Tile color="marker" location={centerMarker} /></span
              >
            </div>
          </div>
        </div>
      </div>
      <div class="table-bottom">
        <div class="reserves">
          <span data-azul-location={bag}
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
          ><span data-azul-location={discard}
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
            class:open={phone && trayExpanded}
            data-azul-location={summary(playerId)}
          >
            <PlayerBoard
              density={phone && !trayExpanded ? 'compact' : 'full'}
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
              gains={gains(playerId)}
            />
            {#if phone}<button
                class="tray-toggle"
                aria-label={m.azul_board({ name: name(playerId) })}
                aria-expanded={trayExpanded}
                onclick={toggleTray}
                ><span>{name(playerId)} · {ownBoard.score}</span><b
                  aria-hidden="true">{trayExpanded ? '⌄' : '⌃'}</b
                ></button
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
                color: colorLabels[selection.color](),
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
    class:az-help={pixel && modal === 'help'}
    class:px-tokens={pixel}
    class:az-pixel={pixel}
    class:az-reduced={pixel && reduced}
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
                    color: colorLabels[color](),
                    source: m.azul_factory({ number: picker + 1 }),
                  })}
                  ><span><Tile {color} /></span>{colorLabels[color]()} ×{count}</button
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
            {#each visual.boards as board, i}<article
                class:winner={visual.winners.includes(visual.players[i])}
              >
                <h3>{name(visual.players[i])}</h3>
                <dl>
                  {#each [[m.azul_wall_points(), '', board.wallPoints], [m.azul_raw_floor(), '−', board.floorDeductions], [m.azul_loss(), '−', board.floorLoss], [m.azul_rows_bonus(), '+', board.bonus.rows], [m.azul_columns_bonus(), '+', board.bonus.columns], [m.azul_colors_bonus(), '+', board.bonus.colors], [m.azul_total(), '', board.score]] as const as [label, sign, value], line}
                    {@const total = line === 6}
                    <dt class:total>{label}</dt>
                    <!-- The 8-bit skin counts each value up in steps (pixel.css). -->
                    <dd
                      class:total
                      data-sign={sign}
                      style:--az-n={pixel ? value : undefined}
                      style:--az-line={pixel ? line : undefined}
                    >
                      <span class="az-value">{sign}{value}</span>
                    </dd>
                  {/each}
                </dl>
              </article>{/each}
          </div>
          {#if canRematch}<button class="primary" onclick={rematch}
              >{m.azul_rematch()}</button
            >{/if}
        </section>{/if}
    {:else if modal === 'help'}{@render rulesContent?.()}{:else if modal === 'settings'}<div
        class="settings"
      >
        <label class="toggle"
          ><input
            type="checkbox"
            bind:checked={prefs.sound}
          />{m.azul_sound()}</label
        ><label
          >{m.azul_volume()}<input
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={prefs.volume}
          /></label
        >
        <fieldset class="skin-choice">
          <legend>{m.skin()}</legend>
          {#each [['classic', m.skin_classic()], ['pixel', m.skin_pixel()]] as const as [value, label]}<label
              class="toggle"
              ><input
                type="radio"
                name="azul-skin"
                {value}
                checked={skin.choice === value}
                onchange={() => skin.choose(value)}
              />{label}</label
            >{/each}
        </fieldset>
        <label
          >{m.azul_motion()}<select
            aria-label={m.azul_motion()}
            bind:value={motionChoice, chooseMotion}
            ><option value="system">{m.azul_system()}</option><option
              value="reduced">{m.azul_reduced()}</option
            ><option value="full">{m.azul_full_motion()}</option></select
          ></label
        >{#if settingsContent}<div class="room-settings">
            {@render settingsContent()}
          </div>{/if}{#if canRematch}<button onclick={rematch}
            >{m.azul_rematch()}</button
          >{/if}
      </div>
    {:else if visual.players.includes(inspected)}<PlayerBoard
        board={visual.boards[visual.players.indexOf(inspected)]}
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
  .skin-choice {
    display: flex;
    gap: 18px;
    margin: 0;
    padding: 6px 12px 8px;
    border: 1px solid #b9aa8a;
    border-radius: 4px;
  }
  .skin-choice legend {
    padding: 0 4px;
    font-size: 14px;
  }
  .settings .skin-choice label {
    min-height: 32px;
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

  /* Rich & Dramatic production composition. The photographs provide material;
     these rules only compose live Svelte controls and state over them. */
  .azul-table {
    background: var(--azul-deep-navy) url('/games/azul/rich/tabletop-v2.webp')
      center / cover no-repeat;
  }
  .azul-table::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    content: '';
    pointer-events: none;
    background:
      linear-gradient(112deg, rgba(244, 177, 82, 0.07), transparent 29%),
      radial-gradient(
        circle at 50% 38%,
        transparent 34%,
        rgba(0, 3, 8, 0.46) 100%
      );
  }
  .azul-table::after {
    position: absolute;
    z-index: 20;
    inset: 0;
    content: '';
    pointer-events: none;
    box-shadow: inset 0 0 95px 24px rgba(0, 2, 7, 0.38);
  }
  .surface,
  .corner,
  .table-prop {
    z-index: 2;
  }
  .surface {
    position: relative;
  }
  .table-prop {
    position: absolute;
    pointer-events: none;
    user-select: none;
  }
  .lantern-prop {
    top: -42px;
    left: -18px;
    width: 165px;
    opacity: 0.92;
    filter: drop-shadow(12px 18px 15px rgba(0, 0, 0, 0.72));
  }
  .chest-prop {
    top: -135px;
    right: 255px;
    width: 325px;
    transform: rotate(-7deg);
    opacity: 0.76;
    filter: brightness(0.78) drop-shadow(-9px 17px 14px rgba(0, 0, 0, 0.72));
  }
  .tea-prop {
    bottom: -52px;
    left: -58px;
    width: 238px;
    transform: rotate(7deg);
    filter: brightness(0.74) saturate(0.82)
      drop-shadow(10px 16px 13px rgba(0, 0, 0, 0.72));
  }
  .corner {
    z-index: 24;
    width: 44px;
    height: 44px;
    padding: 8px;
    border: 1px solid #a77a36;
    background: rgba(3, 18, 29, 0.86);
    box-shadow:
      inset 0 0 0 2px rgba(188, 139, 63, 0.11),
      0 5px 10px rgba(0, 0, 0, 0.5);
    color: #dfc795;
  }

  .azul-table:not(.compact-table) .surface {
    padding: 0;
  }
  .azul-table:not(.compact-table) .table-content {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    margin: 0;
  }
  .azul-table:not(.compact-table) .table-heading {
    position: absolute;
    z-index: 8;
    top: 2px;
    left: 50%;
    display: block;
    width: 430px;
    height: 76px;
    min-height: 0;
    padding: 0;
    transform: translateX(-50%);
    text-align: center;
    text-shadow: 0 3px 12px #000;
    pointer-events: none;
  }
  .azul-table:not(.compact-table) .wordmark {
    display: block;
    color: #c99a4a;
    font-size: 43px;
    font-weight: 400;
    letter-spacing: 0.11em;
    line-height: 1.05;
  }
  .azul-table:not(.compact-table) .round {
    margin: 0;
    padding: 0;
    border: 0;
    color: #c2ad87;
    font: 12px var(--azul-title);
  }
  .azul-table:not(.compact-table) .table-heading h1 {
    display: inline;
    margin: 0 0 0 12px;
    color: #d7ae66;
    font: 13px var(--azul-title);
  }
  .azul-table:not(.compact-table) .table-heading h1::before {
    margin-right: 12px;
    color: #b98c45;
    content: '·';
  }
  .azul-table:not(.compact-table) .opponents {
    position: absolute;
    z-index: 5;
    inset: 0;
    display: block;
    width: auto;
    height: auto;
    max-width: none;
    margin: 0;
    pointer-events: none;
  }
  .azul-table:not(.compact-table) .opponent {
    position: absolute;
    display: block;
    width: 234px;
    height: 120px;
    max-width: none;
    padding: 0;
    border: 0;
    background: transparent;
    filter: brightness(0.9) saturate(0.92);
    pointer-events: auto;
  }
  .azul-table:not(.compact-table) .opponent:nth-child(1) {
    top: 108px;
    left: 7.4%;
    transform: rotate(-1.5deg);
  }
  .azul-table:not(.compact-table) .opponent:nth-child(2) {
    top: 108px;
    right: 7%;
    transform: rotate(1deg);
  }
  .azul-table:not(.compact-table) .opponent:nth-child(3) {
    top: 254px;
    right: 4.5%;
    transform: rotate(2deg);
  }
  .azul-table:not(.compact-table) .opponent-preview {
    position: absolute;
    inset: 0 0 22px;
    width: 234px;
  }
  .azul-table:not(.compact-table) .opponent-heading {
    position: absolute;
    z-index: 3;
    right: 11px;
    bottom: 0;
    display: flex;
    min-width: 102px;
    height: 31px;
    align-items: center;
    padding: 0 10px;
    border: 1px solid rgba(181, 133, 60, 0.72);
    background: rgba(3, 16, 27, 0.95);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.48);
    color: #f1e7d2;
  }
  .azul-table:not(.compact-table) .opponent-name {
    max-width: 78px;
    color: #f1e7d2;
    font-size: 12px;
  }
  .azul-table:not(.compact-table) .opponent strong {
    color: #d5a65a;
    font-size: 15px;
    font-weight: 500;
  }
  .azul-table:not(.compact-table) .opponent.turn .opponent-heading {
    border-color: #e2b560;
    box-shadow:
      inset 0 0 8px rgba(224, 172, 82, 0.16),
      0 4px 8px rgba(0, 0, 0, 0.48);
  }
  .azul-table:not(.compact-table) .opponent .risk,
  .azul-table:not(.compact-table) .opponent .offline {
    display: none;
  }

  .azul-table:not(.compact-table) .supply {
    position: absolute;
    z-index: 6;
    top: 57px;
    left: 50%;
    width: var(--ring-width);
    height: var(--ring-height);
    margin: 0;
    transform: translateX(-50%);
  }
  .factories {
    position: relative;
    width: var(--ring-width);
    height: var(--ring-height);
  }
  .factory {
    isolation: isolate;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .factory::before {
    display: none;
  }
  .factory-plate {
    position: absolute;
    z-index: -1;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 50%;
    filter: brightness(0.86) saturate(0.92)
      drop-shadow(4px 8px 6px rgba(0, 2, 7, 0.72));
    pointer-events: none;
    user-select: none;
  }
  .factory-number {
    z-index: 4;
    top: -2px;
    display: none;
    width: 17px;
    height: 17px;
    place-items: center;
    border: 1px solid rgba(164, 122, 59, 0.55);
    border-radius: 50%;
    background: rgba(3, 22, 36, 0.9);
    color: #d7be8d;
    font-size: 8px;
  }
  .azul-table:not(.compact-table) .factory-tiles {
    grid-template-columns: repeat(2, 44px);
    grid-template-rows: repeat(2, 44px);
    gap: -1px;
    transform: translateY(1px);
  }
  .azul-table:not(.compact-table) .factory-tiles button {
    padding: 2px;
  }
  .factory-tiles button:not(:disabled):hover,
  .factory-tiles button.selected {
    border-radius: 5px;
    background: rgba(210, 168, 92, 0.14);
    outline-color: #d3a755;
    transform: none;
  }
  .factory-empty {
    border-color: transparent;
    background: transparent;
  }
  .azul-table:not(.compact-table) .center {
    width: 198px;
    height: 160px;
  }
  .center h2 {
    color: #8d9a9c;
    font: 8px var(--azul-body);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-shadow: 0 2px 6px #000;
  }
  .azul-table:not(.compact-table) .center-colors {
    grid-template-columns: repeat(3, 54px);
    grid-auto-rows: 62px;
    justify-content: center;
    gap: 2px 9px;
  }
  .azul-table:not(.compact-table) .center-group {
    width: 54px;
    height: 62px;
  }
  .azul-table:not(.compact-table) .cluster {
    width: 50px;
    height: 45px;
  }
  .azul-table:not(.compact-table) .center-tile {
    width: 31px;
    height: 31px;
  }
  .center-group b {
    border: 1px solid rgba(159, 113, 48, 0.46);
    background: rgba(4, 22, 35, 0.92);
    color: #e5cfaa;
    font-size: 9px;
  }
  .center-group.selected {
    border-color: #c99a4a;
    background: rgba(190, 141, 63, 0.12);
  }
  .center-marker {
    filter: drop-shadow(2px 4px 3px rgba(0, 0, 0, 0.62));
  }

  .azul-table:not(.compact-table) .table-bottom {
    position: absolute;
    z-index: 8;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    margin: 0;
    grid-area: auto;
    align-self: auto;
    pointer-events: none;
  }
  .azul-table:not(.compact-table) .own-board {
    position: absolute;
    right: auto;
    bottom: 0;
    left: 50%;
    width: min(820px, 58vw);
    max-width: 820px;
    margin: 0;
    transform: translateX(-50%);
    pointer-events: auto;
  }
  .azul-table:not(.compact-table) .reserves {
    position: absolute;
    right: 8px;
    bottom: 22px;
    display: grid;
    width: 190px;
    margin: 0;
    place-items: end center;
    gap: 0;
    pointer-events: auto;
  }
  .azul-table:not(.compact-table) .reserves > span:first-child {
    display: flex;
    width: 185px;
    height: 176px;
    box-sizing: border-box;
    align-items: flex-end;
    justify-content: center;
    padding: 0 0 18px;
    background: url('/games/azul/rich/tile-bag.webp') center / contain no-repeat;
    color: #d8c39b;
    text-shadow: 0 2px 5px #000;
    filter: drop-shadow(-8px 13px 10px rgba(0, 0, 0, 0.68));
  }
  .azul-table:not(.compact-table) .reserves > span:last-child {
    min-width: 112px;
    min-height: 29px;
    justify-content: center;
    padding: 0 8px;
    transform: translateY(-11px);
    border: 1px solid rgba(167, 122, 54, 0.62);
    background: rgba(3, 20, 32, 0.9);
    color: #cbb58c;
  }
  .azul-table:not(.compact-table) .reserves svg {
    display: none;
  }
  .azul-table:not(.compact-table) .table-footer {
    position: absolute;
    z-index: 14;
    right: auto;
    bottom: 18px;
    left: 18px;
    display: block;
    width: min(360px, 23vw);
    min-width: 260px;
  }
  .azul-table:not(.compact-table) .confirmation {
    display: grid;
    border-color: rgba(170, 126, 59, 0.72);
    background: rgba(3, 20, 32, 0.95);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
  }
  .azul-table:not(.compact-table) .confirmation.hidden {
    display: none;
  }
  .azul-table:not(.compact-table) .table-status {
    justify-content: flex-start;
    margin: 0;
  }

  .compact-table .table-prop {
    display: none;
  }
  .compact-table .surface {
    padding: max(5px, env(safe-area-inset-top))
      max(6px, env(safe-area-inset-right)) max(5px, env(safe-area-inset-bottom))
      max(6px, env(safe-area-inset-left));
  }
  .compact-table .table-content {
    position: relative;
    display: grid;
    height: 100%;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 44px 66px 340px minmax(54px, 1fr) 44px;
    gap: 3px;
  }
  .compact-table .table-heading {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    gap: 7px;
    padding: 0 42px;
    text-shadow: 0 2px 7px #000;
  }
  .compact-table .round {
    color: #c2ad87;
    font: 11px var(--azul-title);
  }
  .compact-table .table-heading h1 {
    color: #d7ae66;
    font: 12px var(--azul-title);
  }
  .compact-table .opponents {
    grid-column: 1;
    grid-row: 2;
    height: 66px;
    gap: 5px;
  }
  .compact-table .opponent {
    height: 66px;
    padding: 2px 3px;
    border-color: rgba(164, 122, 59, 0.28);
    background: rgba(3, 19, 31, 0.64);
  }
  .compact-table .opponent-preview {
    min-height: 36px;
  }
  .compact-table .supply {
    grid-column: 1;
    grid-row: 3;
    width: 340px;
    height: 340px;
    align-self: center;
    justify-self: center;
    margin: 0;
  }
  .compact-table .factory {
    width: var(--disc);
    height: var(--disc);
  }
  .compact-table .factory-number {
    display: none;
  }
  .compact-table .factory-open {
    position: relative;
    z-index: 2;
  }
  .compact-table .center h2 {
    height: 16px;
    margin-bottom: 0;
  }
  .compact-table .table-bottom {
    position: relative;
    z-index: 12;
    grid-column: 1;
    grid-row: 4;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    margin: 0;
    pointer-events: none;
  }
  .compact-table .own-board,
  .compact-table .reserves {
    pointer-events: auto;
  }
  .compact-table .reserves {
    position: absolute;
    right: 4px;
    top: 4px;
    bottom: auto;
    flex-direction: column;
    gap: 1px;
    margin: 0;
  }
  .compact-table .reserves > span {
    font-size: 9px;
  }
  .compact-table .reserves svg {
    width: 21px;
    height: 21px;
  }
  .compact-table .own-board {
    position: absolute;
    right: auto;
    bottom: 0;
    left: 50%;
    display: block;
    width: min(320px, calc(100vw - 20px));
    height: 60px;
    margin: 0;
    overflow: hidden;
    transform: translateX(-50%);
    border: 1px solid rgba(169, 124, 57, 0.76);
    border-radius: 7px 7px 0 0;
    background: rgba(3, 18, 30, 0.96);
    box-shadow:
      inset 0 0 0 2px rgba(201, 157, 80, 0.08),
      0 -5px 13px rgba(0, 0, 0, 0.42);
  }
  .compact-table .own-board:not(.open) :global(.player-board) {
    position: absolute;
    top: 8px;
    left: 9px;
    width: 116px;
    height: 43px;
  }
  .tray-toggle {
    position: absolute;
    z-index: 8;
    inset: 0;
    display: flex;
    width: 100%;
    height: 100%;
    min-height: 44px;
    align-items: center;
    justify-content: flex-end;
    gap: 18px;
    padding: 0 18px 0 134px;
    border: 0;
    background: transparent;
    color: #e6d4b2;
    text-shadow: 0 2px 5px #000;
  }
  .tray-toggle span {
    overflow: hidden;
    font: 12px var(--azul-title);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tray-toggle b {
    color: #d3a85e;
    font-size: 20px;
  }
  .compact-table .own-board.open {
    position: fixed;
    right: auto;
    bottom: 0;
    left: 50%;
    z-index: 30;
    width: min(820px, calc(100vw - 12px));
    height: min(410px, calc(100dvh - 116px));
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .compact-table .own-board.open :global(.player-board) {
    width: 100%;
    height: 100%;
  }
  .compact-table .own-board.open .tray-toggle {
    top: -44px;
    right: 6px;
    bottom: auto;
    left: auto;
    width: 158px;
    height: 44px;
    padding: 0 12px;
    border: 1px solid rgba(169, 124, 57, 0.76);
    border-radius: 7px 7px 0 0;
    background: rgba(3, 18, 30, 0.96);
  }
  .compact-table .table-footer {
    z-index: 14;
    grid-column: 1;
    grid-row: 5;
    min-width: 0;
  }
  .compact-table .table-status {
    margin: 0 auto;
  }

  @media (min-width: 901px) and (max-width: 1499px) {
    .azul-table:not(.compact-table) .supply {
      top: -5px;
      transform: translateX(-50%);
    }
    .azul-table:not(.compact-table) .own-board {
      width: min(760px, 61vw);
    }
    .azul-table:not(.compact-table) .opponent:nth-child(1) {
      left: 3%;
    }
    .azul-table:not(.compact-table) .opponent:nth-child(2),
    .azul-table:not(.compact-table) .opponent:nth-child(3) {
      right: 2.5%;
    }
    .azul-table:not(.compact-table) .reserves {
      width: 150px;
    }
    .azul-table:not(.compact-table) .reserves > span:first-child {
      width: 145px;
      height: 138px;
    }
  }

  @media (max-width: 600px) {
    .compact-table .table-content {
      grid-template-rows: 44px 62px 340px minmax(54px, 1fr) 44px;
    }
    .compact-table .opponents {
      height: 62px;
    }
    .compact-table .opponent {
      height: 62px;
    }
    .compact-table .opponent-preview {
      min-height: 32px;
    }
  }

  @media (min-width: 601px) and (max-height: 680px) {
    .compact-table .table-content {
      grid-template-columns: minmax(340px, 1fr) minmax(0, 1fr);
      grid-template-rows: 42px minmax(0, 1fr) 44px;
      gap: 3px 8px;
    }
    .compact-table .table-heading {
      grid-column: 1/-1;
      grid-row: 1;
    }
    .compact-table .supply {
      grid-column: 1;
      grid-row: 2 / span 2;
      transform: none;
    }
    .compact-table .opponents {
      grid-column: 2;
      grid-row: 2;
      align-self: start;
    }
    .compact-table .table-bottom {
      grid-column: 2;
      grid-row: 2;
      align-self: end;
      min-width: 0;
    }
    .compact-table .own-board {
      width: min(300px, calc(100% - 8px));
    }
    .compact-table .table-footer {
      grid-column: 2;
      grid-row: 3;
    }
  }
</style>
