<script lang="ts">
  import { onMount, tick, type Snippet } from 'svelte';
  import { RevisionGate } from './presentation.js';
  import { playEffects, softAudio } from './effects.js';
  import type { playerView } from './index.js';
  import Dice from './Dice.svelte';
  import ResourceArt from './ResourceArt.svelte';
  import ocean from '../assets/ocean.svg?url';
  import { setLocale } from '@board-games/shared/runtime';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    settingsContent,
    chooseSeat,
  }: {
    view: ReturnType<typeof playerView>;
    playerId: string;
    players: { id: string; name: string }[];
    send: (action: any) => void;
    locale: Locale;
    round?: number;
    connected?: boolean;
    settingsContent?: Snippet;
    chooseSeat?: (id: string) => void;
  } = $props();

  let root: HTMLElement;
  let map: SVGSVGElement;
  let sound = $state(true),
    motion = $state(true),
    reduced = $state(false);
  let settings = $state(false);
  let tradeOpen = $state(false),
    developmentOpen = $state('');
  let rolling = $state(false);
  let diceVisible = $state(false);
  let diceTimer: ReturnType<typeof setTimeout>;
  let charge = $state(0),
    charging = $state(false);
  let chargeStart = 0,
    chargeFrame = 0;
  function cancelCharge() {
    cancelAnimationFrame(chargeFrame);
    charging = false;
    charge = 0;
  }
  function beginCharge() {
    if (!allowed('ROLL_DICE') || charging) return;
    charging = true;
    chargeStart = performance.now();
    const update = () => {
      charge = Math.min(1, (performance.now() - chargeStart) / 3000);
      if (charging && charge < 1) chargeFrame = requestAnimationFrame(update);
    };
    update();
  }
  function releaseCharge() {
    if (!charging) return;
    const strength = Math.min(1, (performance.now() - chargeStart) / 3000);
    cancelCharge();
    if (allowed('ROLL_DICE'))
      send({ type: 'ROLL_DICE', strength: strength < 0.08 ? 0 : strength });
  }
  let tradeMode = $state<'compose' | 'bank' | 'offers'>('compose');
  const incomingOffers = () =>
    pub.offers.filter(
      (o) => o.from !== playerId && (!o.to || o.to === playerId),
    );
  function showMarket(mode: 'bank' | 'offers') {
    tradeMode = mode;
    tradeAnchor = 'south';
    tradeOpen = true;
    developmentOpen = '';
  }
  let submittedOfferAfter = $state<number | null>(null);
  let offerSent = $state(false);
  $effect(() => {
    if (
      submittedOfferAfter !== null &&
      pub.offers.some((o) => o.from === playerId && o.id > submittedOfferAfter!)
    ) {
      submittedOfferAfter = null;
      offerSent = true;
      tradeMode = 'offers';
      give = [0, 0, 0, 0, 0];
      take = [0, 0, 0, 0, 0];
    }
  });
  let tradeAnchor = $state('south');
  const canOffer = () =>
    connected &&
    !rolling &&
    pub.phase.type === 'turn' &&
    pub.phase.stage === 'actions' &&
    !pub.paired;
  const canTrade = () => !tradeReason();
  const tradeReason = (id = '') => {
    if (!connected) return m.catan_trade_disconnected({}, { locale });
    if (pub.paired) return m.catan_paired_opportunity({}, { locale });
    if (!canOffer()) return m.catan_trade_wait_reason({}, { locale });
    if (
      id &&
      (id === playerId ||
        (pub.phase.player !== playerId && id !== pub.phase.player))
    )
      return m.catan_trade_turn_reason(
        { player: name(pub.phase.player) },
        { locale },
      );
    if (!priv.hand.some((n) => n > 0))
      return m.catan_trade_no_resources({}, { locale });
    return '';
  };
  const canTradeWith = (id: string) => !tradeReason(id);
  $effect(() => {
    if (!allowed('ROLL_DICE') || !connected) cancelCharge();
    if (!canTrade() && tradeMode === 'compose') tradeOpen = false;
  });
  const developmentArt = import.meta.glob('../assets/development-*.svg', {
    query: '?url',
    import: 'default',
    eager: true,
  });
  const developmentImage = (kind: string) =>
    developmentArt[
      '../assets/development-' + kind.toLowerCase().replaceAll('_', '') + '.svg'
    ] as string;
  function openTrade(id = '') {
    if (id ? !canTradeWith(id) : !canTrade()) {
      if (sound) {
        audio.unlock();
        audio.reject();
      }
      return;
    }
    tradeMode = 'compose';
    offerSent = false;
    submittedOfferAfter = null;
    targetPlayer = id;
    tradeAnchor = id ? position(id) : 'south';
    tradeOpen = true;
    developmentOpen = '';
  }

  const audio = softAudio(),
    gate = new RevisionGate();
  let stopEffects = () => {};
  let zoom = $state(1),
    offsetX = $state(0),
    offsetY = $state(0);
  const pointers = new Map<number, { x: number; y: number }>();
  let panning = $state(false);
  let dragged = false,
    pinchDistance = 0;
  function changeZoom(value: number, cursor?: { x: number; y: number }) {
    stopEffects();
    const next = Math.max(1, Math.min(3, value));
    if (next === 1) {
      zoom = 1;
      offsetX = 0;
      offsetY = 0;
      return;
    }
    const bounds = map.viewBox.baseVal;
    let anchor = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const matrix = map.getScreenCTM();
    if (cursor && matrix) {
      const point = map.createSVGPoint();
      point.x = cursor.x;
      point.y = cursor.y;
      anchor = point.matrixTransform(matrix.inverse());
    }
    offsetX = anchor.x - ((anchor.x - offsetX) * next) / zoom;
    offsetY = anchor.y - ((anchor.y - offsetY) * next) / zoom;
    zoom = next;
  }
  function pan(dx: number, dy: number) {
    if (zoom <= 1) return;
    stopEffects();
    const matrix = map.getScreenCTM()?.inverse();
    if (!matrix) return;
    const v = map.viewBox.baseVal;
    offsetX = Math.max(
      v.x + v.width * 0.25 - (v.x + v.width) * zoom,
      Math.min(
        v.x + v.width * 0.75 - v.x * zoom,
        offsetX + dx * matrix.a + dy * matrix.c,
      ),
    );
    offsetY = Math.max(
      v.y + v.height * 0.25 - (v.y + v.height) * zoom,
      Math.min(
        v.y + v.height * 0.75 - v.y * zoom,
        offsetY + dx * matrix.b + dy * matrix.d,
      ),
    );
  }
  function distance() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    if (!pointers.size) dragged = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      dragged = true;
      pinchDistance = distance();
    }
  }
  function move(e: PointerEvent) {
    const previous = pointers.get(e.pointerId);
    if (!previous) return;
    if (
      Math.hypot(e.clientX - previous.x, e.clientY - previous.y) > 5 ||
      dragged
    ) {
      dragged = true;
      panning = zoom > 1;
      map.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pan(
        (e.clientX - previous.x) / pointers.size,
        (e.clientY - previous.y) / pointers.size,
      );
      if (pointers.size === 2) {
        const next = distance();
        if (pinchDistance) {
          const [a, b] = [...pointers.values()];
          changeZoom((zoom * next) / pinchDistance, {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          });
        }
        pinchDistance = next;
      }
    }
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (!pointers.size) panning = false;
    pinchDistance = 0;
  }
  function preference(key: 'sound' | 'motion') {
    if (key === 'sound') {
      sound = !sound;
      if (sound) audio.unlock();
      else audio.cancel();
    } else motion = !motion;
    try {
      localStorage.setItem(
        'catan:' + key,
        String(key === 'sound' ? sound : motion),
      );
    } catch {}
  }
  onMount(() => {
    try {
      sound = localStorage.getItem('catan:sound') !== 'false';
      motion = localStorage.getItem('catan:motion') !== 'false';
    } catch {}
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced = media.matches;
    };
    update();
    media.addEventListener('change', update);
    const observer = new ResizeObserver(() => {
      stopEffects();
    });
    observer.observe(map);
    return () => {
      cancelCharge();
      observer.disconnect();
      media.removeEventListener('change', update);
      stopEffects();
      audio.close();
    };
  });
  $effect(() => {
    const revision = view.public.revision,
      identity = round + ':' + playerId,
      online = connected;
    const enabled = motion && !reduced,
      audible = sound;
    const events = view.public.events;
    stopEffects();
    clearTimeout(diceTimer);
    diceVisible = false;
    rolling = false;
    const accepted = gate.accept(revision, identity, online, view);
    let cancelled = false;
    if (accepted) {
      const roll = events.find((e) => e.type === 'roll');
      if (roll) {
        diceVisible = true;
        if (!enabled) diceTimer = setTimeout(() => (diceVisible = false), 1400);
      }
      if (enabled && roll?.type === 'roll') {
        rolling = true;
      }
      if (audible && events.length) audio.play(events);
      if (enabled)
        void tick().then(() => {
          if (!cancelled)
            stopEffects = playEffects(
              root,
              events,
              () => (diceVisible = false),
              () => (rolling = false),
            );
        });
    }
    return () => {
      cancelled = true;
      clearTimeout(diceTimer);
      stopEffects();
      audio.cancel();
    };
  });

  const terrain = Object.entries(
    import.meta.glob('../assets/terrain-*-0.svg', {
      query: '?url',
      import: 'default',
      eager: true,
    }),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, url]) => url as string);
  const colors = [
    '#e64f30',
    '#198bd1',
    '#f4cb63',
    '#ed8534',
    '#54b877',
    '#ac79dd',
  ];
  const civilizations = () => [
    m.catan_civ_0({}, { locale }),
    m.catan_civ_1({}, { locale }),
    m.catan_civ_2({}, { locale }),
    m.catan_civ_3({}, { locale }),
    m.catan_civ_4({}, { locale }),
    m.catan_civ_5({}, { locale }),
  ];
  const crests = ['✹', '≋', '◆', '⌂', '❧', '✦'];
  const position = (id: string) => {
    const n = pub.players.length,
      own = pub.players.findIndex((p) => p.id === playerId);
    const relative = (pub.players.findIndex((p) => p.id === id) - own + n) % n;
    return (
      n === 3
        ? ['south', 'west', 'east']
        : n === 4
          ? ['south', 'west', 'north', 'east']
          : n === 5
            ? ['south', 'west', 'north-west', 'north-east', 'east']
            : ['south', 'west', 'north-west', 'north', 'north-east', 'east']
    )[relative];
  };
  let pending = $state<any>(null),
    targetPlayer = $state('');
  $effect(() => {
    playerId;
    round;
    tradeOpen = false;
    developmentOpen = '';
    targetPlayer = '';
  });
  $effect(() => {
    view;
    pending = null;
    showPlacements = false;
  });
  let showPlacements = $state(false);
  let selected = $state('BUILD_SETTLEMENT'),
    give = $state([0, 0, 0, 0, 0]),
    take = $state([0, 0, 0, 0, 0]),
    discard = $state([0, 0, 0, 0, 0]);
  let pub = $derived(view.public),
    priv = $derived(view.private),
    board = $derived(pub.board),
    legal = $derived(priv.legalActions as any[]);
  const validOffer = () =>
    !tradeReason(targetPlayer) &&
    give.some((n) => n > 0) &&
    take.some((n) => n > 0) &&
    give.every(
      (n, i) =>
        Number.isInteger(n) &&
        n >= 0 &&
        n <= priv.hand[i] &&
        n <= 24 &&
        (!n || !take[i]),
    ) &&
    take.every((n) => Number.isInteger(n) && n >= 0 && n <= 24);
  const names = () => [
    m.catan_wood({}, { locale }),
    m.catan_wool({}, { locale }),
    m.catan_wheat({}, { locale }),
    m.catan_brick({}, { locale }),
    m.catan_ore({}, { locale }),
  ];
  const name = (id: string | undefined) =>
    players.find((p) => p.id === id)?.name ?? id ?? '';
  const point = (v: number) => [
    board.vertices[v][0] * 37,
    board.vertices[v][1] * 21.4,
  ];
  const color = (id: string) =>
    colors[pub.players.find((p: any) => p.id === id)?.color ?? 0];
  const allowed = (type: string) => legal.some((a) => a.type === type);
  const label = (a: any): string => {
    const labels: Record<string, string> = {
      VICTORY_POINT: m.catan_victory_point({}, { locale }),
      MONOPOLY: m.catan_monopoly({}, { locale }),
      INVENTION: m.catan_invention({}, { locale }),
      ROLL_DICE: m.catan_roll_dice({}, { locale }),
      END_TURN: m.catan_end_turn({}, { locale }),
      BUY_DEVELOPMENT: m.catan_buy_development({}, { locale }),
      KNIGHT: m.catan_knight({}, { locale }),
      ROAD_BUILDING: m.catan_road_building({}, { locale }),
      FINISH_ROADS: m.catan_finish_roads({}, { locale }),
      WITHDRAW: m.catan_withdraw_offer({}, { locale }),
      BUILD_ROAD: m.catan_road({}, { locale }),
      BUILD_SETTLEMENT: m.catan_settlement({}, { locale }),
      BUILD_CITY: m.catan_city({}, { locale }),
    };
    if (a.type === 'BANK_TRADE')
      return `${m.catan_bank({}, { locale })}: ${names()[a.give]} → ${names()[a.take]}`;
    if (a.type === 'MONOPOLY' && a.resource !== undefined)
      return `${m.catan_monopoly({}, { locale })}: ${names()[a.resource]}`;
    if (a.type === 'INVENTION' && a.resources)
      return `${m.catan_invention({}, { locale })}: ${a.resources
        .map((n: number, i: number) => (n ? `${n} ${names()[i]}` : ''))
        .filter(Boolean)
        .join(', ')}`;
    if (a.type === 'STEAL')
      return `${m.catan_steal_from({}, { locale })} ${name(a.victim)}`;
    if (a.type === 'ACCEPT')
      return `${m.catan_accept_offer({}, { locale })} #${a.offer}`;
    if (a.type === 'DECLINE')
      return `${m.catan_decline_offer({}, { locale })} #${a.offer}`;
    if (a.type === 'CONFIRM_TRADE')
      return `${m.catan_trade_with({}, { locale })} ${name(a.partner)}`;
    return labels[a.type] ?? a.type;
  };
  let phaseText = $derived(
    pub.phase.type === 'finished'
      ? `${name(pub.phase.winner)} ${m.catan_wins({}, { locale })}`
      : pub.phase.type === 'discard'
        ? m.catan_discard_instruction({}, { locale })
        : pub.phase.type === 'setup'
          ? `${name(pub.phase.player)} · ${pub.phase.settlement == null ? m.catan_place_a_settlement({}, { locale }) : m.catan_place_an_adjacent_road({}, { locale })}`
          : `${name(pub.phase.player)} · ${pub.phase.type === 'turn' ? (pub.phase.stage === 'production' ? m.catan_roll_dice({}, { locale }) : m.catan_trade_and_build({}, { locale })) : pub.phase.type === 'robber' ? m.catan_move_the_robber({}, { locale }) : pub.phase.type === 'victim' ? m.catan_choose_a_victim({}, { locale }) : m.catan_place_free_roads({}, { locale })}`,
  );
  let placement = $derived(
    pub.phase.type === 'setup'
      ? pub.phase.settlement == null
        ? 'BUILD_SETTLEMENT'
        : 'BUILD_ROAD'
      : pub.phase.type === 'free_roads'
        ? 'BUILD_ROAD'
        : selected,
  );
  let bounds = $derived.by(() => {
    const xs = board.vertices.map((v: number[]) => v[0] * 37),
      ys = board.vertices.map((v: number[]) => v[1] * 21.4);
    return `${Math.min(...xs) - 55} ${Math.min(...ys) - 55} ${Math.max(...xs) - Math.min(...xs) + 110} ${Math.max(...ys) - Math.min(...ys) + 110}`;
  });
</script>

{#snippet ghost(action: any)}
  {#if action.vertex !== undefined}
    {@const p = point(action.vertex)}
    <path
      transform={'translate(' + p[0] + ' ' + p[1] + ')'}
      d={action.type === 'BUILD_CITY'
        ? 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z'
        : 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z'}
      fill={color(playerId)}
      stroke="#fff3cb"
      stroke-width="1.5"
    />
  {:else if action.edge !== undefined}
    {@const a = point(board.edges[action.edge][0])}{@const b = point(
      board.edges[action.edge][1],
    )}
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={color(playerId)}
      stroke-width="8"
      stroke-linecap="round"
    />
  {:else}
    {@const h = board.hexes[action.hex]}
    <path
      transform={'translate(' +
        ((2 * h.q + h.r) * 37 + 17) +
        ' ' +
        (3 * h.r * 21.4 - 7) +
        ')'}
      d="M-10 5-7-12Q0-26 7-12L11 5Z"
      fill="#3c4550"
      stroke="#fff3cb"
      stroke-width="1.5"
    />
  {/if}
{/snippet}

{#snippet marketIcon()}
  <svg
    class="market-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    aria-hidden="true"
    ><path
      d="M3 10h18l-2-6H5l-2 6ZM5 10v10h14V10M9 20v-6h6v6M8 4l-1 6m5-6v6m4-6 1 6"
    /></svg
  >
{/snippet}

<svelte:window
  onpointerup={up}
  onpointercancel={up}
  onpointerdown={() => {
    if (sound) audio.unlock();
  }}
  onkeydown={(e) => {
    if (sound) audio.unlock();
    if (e.key === 'Escape') {
      cancelCharge();
      tradeOpen = false;
      developmentOpen = '';
      pending = null;
      settings = false;
      root?.querySelectorAll('details[open]').forEach((panel) => {
        (panel as HTMLDetailsElement).open = false;
      });
    }
  }}
/>
<section
  bind:this={root}
  class="catan"
  class:still={!motion || reduced}
  aria-label="CATAN"
  style:--ocean={'url("' + ocean + '")'}
>
  <button
    class="settings-trigger"
    aria-label={m.catan_settings({}, { locale })}
    aria-expanded={settings}
    onclick={() => (settings = !settings)}>⚙</button
  >
  {#if settings}<div
      class="settings-menu"
      role="dialog"
      aria-modal="false"
      aria-label={m.catan_settings({}, { locale })}
    >
      <header>
        <h2>{m.catan_settings({}, { locale })}</h2>
        <button
          aria-label={m.catan_cancel({}, { locale })}
          onclick={() => (settings = false)}>×</button
        >
      </header>
      <div class="preferences">
        <button aria-pressed={sound} onclick={() => preference('sound')}
          >{m.catan_sound({}, { locale })} {sound ? '♪' : '×'}</button
        >
        <button
          aria-pressed={motion && !reduced}
          disabled={reduced}
          onclick={() => preference('motion')}
          >{m.catan_motion({}, { locale })}
          {motion && !reduced ? '✓' : '×'}</button
        >
        <label
          >{m.language({}, { locale })}<select
            value={locale}
            onchange={(e) => setLocale(e.currentTarget.value as Locale)}
            ><option value="en">English</option><option value="es"
              >Español</option
            ></select
          ></label
        >
      </div>
      <details>
        <summary>{m.catan_help({}, { locale })}</summary>
        <p>{m.catan_help_text({}, { locale })}</p>
        <p>{m.catan_building_costs({}, { locale })}</p>
      </details>
      {@render settingsContent?.()}
    </div>{/if}
  <div class="roster" class:extended={pub.players.length > 4}>
    {#each pub.players as p}<div
        data-seat={p.id}
        data-position={position(p.id)}
        class:controlled={p.id === playerId}
        class:active={pub.phase.player === p.id}
        style={`--seat:${colors[p.color]}`}
      >
        <div class="crest" aria-hidden="true">{crests[p.color]}</div>
        <div class="seat-identity">
          <div class="civilization-name">{civilizations()[p.color]}</div>
          {#if chooseSeat}<button
              class="seat-name"
              onclick={() => chooseSeat?.(p.id)}
              >{name(p.id)}{p.id === playerId
                ? ' · ' + m.you({}, { locale })
                : ''}</button
            >{:else}<span class="seat-name"
              >{name(p.id)}{p.id === playerId
                ? ' · ' + m.you({}, { locale })
                : ''}</span
            >{/if}
        </div>
        {#if p.id !== playerId}<button
            class="seat-trade"
            aria-disabled={!canTradeWith(p.id)}
            onclick={() => openTrade(p.id)}
            aria-label={m.catan_trade_with({}, { locale }) + ' ' + name(p.id)}
            >{m.catan_trade({}, { locale })}{#if tradeReason(p.id)}<span
                class="trade-tooltip"
                role="tooltip">{tradeReason(p.id)}</span
              >{/if}</button
          >{/if}
        <span class="seat-stats"
          >{p.id === playerId ? priv.points : p.points}
          {m.catan_points({}, { locale })} · {p.resources}
          {m.catan_resources({}, { locale })} · {p.development}
          {m.catan_dev({}, { locale })}</span
        >{#if pub.longest === p.id}<small
            >{m.catan_longest_route({}, { locale })}</small
          >{/if}{#if pub.army === p.id}<small
            >{m.catan_largest_army({}, { locale })}</small
          >{/if}
      </div>{/each}
  </div>
  <p class="phase" aria-live="polite">
    {phaseText}{#if pub.paired}
      · {m.catan_paired_opportunity({}, { locale })}{/if}
  </p>
  <div class="table">
    <div class="zoom-controls" aria-label={m.catan_reset_view({}, { locale })}>
      <button
        aria-label={m.catan_zoom_out({}, { locale })}
        disabled={zoom <= 1}
        onclick={() => changeZoom(zoom - 0.25)}>−</button
      >
      <button
        aria-label={m.catan_reset_view({}, { locale })}
        onclick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</button
      >
      <button
        aria-label={m.catan_zoom_in({}, { locale })}
        disabled={zoom >= 3}
        onclick={() => changeZoom(zoom + 0.25)}>+</button
      >
    </div>
    <!-- Placement targets and the zoomed camera support pointer and keyboard input. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={map}
      class:zoomed={zoom > 1}
      class:panning
      viewBox={bounds}
      tabindex="0"
      onwheel={(e) => {
        e.preventDefault();
        changeZoom(zoom * Math.exp(-e.deltaY * 0.001), {
          x: e.clientX,
          y: e.clientY,
        });
      }}
      onkeydown={(e) => {
        if (e.target !== map) return;
        if (
          zoom > 1 &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
        ) {
          e.preventDefault();
          pan(
            e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0,
            e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0,
          );
        }
        if (['+', '=', '-', 'Home'].includes(e.key)) {
          e.preventDefault();
          changeZoom(
            e.key === 'Home' ? 1 : zoom + (e.key === '-' ? -0.25 : 0.25),
          );
        }
      }}
      onpointerdown={down}
      onpointermove={move}
      role="application"
      aria-label={m.catan_island_description({}, { locale })}
    >
      <defs
        ><linearGradient id="piece-shine" x2=".7" y2="1"
          ><stop stop-color="#fff4b7" stop-opacity=".65" /><stop
            offset=".45"
            stop-color="white"
            stop-opacity="0"
          /><stop
            offset="1"
            stop-color="#27180f"
            stop-opacity=".55"
          /></linearGradient
        ></defs
      >
      <defs
        >{#each terrain as url, i}<pattern
            id={`terrain-${i}`}
            width="1"
            height="1"
            patternContentUnits="objectBoundingBox"
            ><image
              href={url}
              width="1"
              height="1"
              preserveAspectRatio="xMidYMid slice"
            /></pattern
          >{/each}</defs
      >
      <g
        class="island-map"
        transform={'translate(' +
          offsetX +
          ' ' +
          offsetY +
          ') scale(' +
          zoom +
          ')'}
      >
        <g
          class="shore"
          fill="#63d1c0"
          stroke="#8adfce"
          stroke-width="18"
          stroke-linejoin="round"
          opacity=".55"
          >{#each board.hexes as h}<polygon
              points={h.vertices
                .map((v: number) => point(v).join(','))
                .join(' ')}
            />{/each}</g
        >
        {#each board.hexes as h, i}
          <polygon
            data-hex={i}
            points={h.vertices.map((v: number) => point(v).join(',')).join(' ')}
            fill={`url(#terrain-${h.resource ?? 5})`}
            stroke="#e4ce99"
            stroke-width="3"
          />
          {#if h.number}<circle
              cx={(2 * h.q + h.r) * 37}
              cy={3 * h.r * 21.4}
              r="13"
              fill="#fff0cd"
            /><text
              x={(2 * h.q + h.r) * 37}
              y={3 * h.r * 21.4 + 5}
              text-anchor="middle"
              fill={h.number === 6 || h.number === 8 ? '#b73428' : '#31291e'}
              font-size="14"
              font-weight="800">{h.number}</text
            >{/if}
          {#if allowed('MOVE_ROBBER')}<text
              x={(2 * h.q + h.r) * 37}
              y={3 * h.r * 21.4 + 28}
              text-anchor="middle"
              font-size="10"
              fill="#fff">#{i}</text
            >{/if}{#if pub.robber === i}
            <g
              transform={'translate(' +
                ((2 * h.q + h.r) * 37 + 17) +
                ' ' +
                (3 * h.r * 21.4 - 7) +
                ')'}
              ><g data-robber aria-label={m.catan_robber({}, { locale })}>
                <ellipse cy="7" rx="12" ry="4" fill="#172b2e" opacity=".3" />
                <path
                  d="M-10 5-7-12Q0-26 7-12L11 5Z"
                  fill="#3c4550"
                  stroke="#1a2831"
                  stroke-width="1.5"
                />
                <path d="M-5-10Q0-21 5-10L4-3H-4Z" fill="#18232c" /><path
                  d="m-4-8 3 1m2 0 3-1"
                  stroke="#ffc568"
                  stroke-width="1.8"
                />
                <path d="m-7-2 12 5-3 5-11-5Z" fill="#96502e" /><path
                  d="M7-3q11-5 10 7-5 8-11 2"
                  fill="#bb8b4b"
                  stroke="#5b422a"
                  stroke-width="1.5"
                />
              </g></g
            >{/if}
        {/each}
        {#each board.ports as port}
          {@const ends = board.edges[port.edge]}{@const a = point(
            ends[0],
          )}{@const b = point(ends[1])}
          {@const cx = (a[0] + b[0]) / 2}{@const cy =
            (a[1] + b[1]) / 2}{@const length = Math.hypot(cx, cy) || 1}
          <g
            class="harbor"
            aria-label={(port.resource === null
              ? m.catan_everyone({}, { locale })
              : names()[port.resource]) +
              ' ' +
              (port.resource === null ? '3:1' : '2:1')}
          >
            <line
              x1={cx}
              y1={cy}
              x2={cx + (cx / length) * 25}
              y2={cy + (cy / length) * 25}
              stroke="#ae8654"
              stroke-width="5"
            />
            <g
              transform={'translate(' +
                (cx + (cx / length) * 32) +
                ' ' +
                (cy + (cy / length) * 32) +
                ')'}
            >
              <ellipse
                rx="19"
                ry="13"
                fill="#174e61"
                stroke="#9edcd1"
                stroke-width="1"
              />
              <path d="m-13 1 6 5h14l6-5Z" fill="#d6ac70" /><path
                d="M0 0v-12L9-2H0"
                fill="#fff1cd"
              />
              <text
                x="0"
                y="12"
                text-anchor="middle"
                font-size="7"
                font-weight="800"
                fill="#fff1cd">{port.resource === null ? '3:1' : '2:1'}</text
              >
              {#if port.resource !== null}<foreignObject
                  x="-17"
                  y="-13"
                  width="14"
                  height="14"
                  ><ResourceArt resource={port.resource} /></foreignObject
                >{/if}
            </g>
          </g>
        {/each}
        {#each pub.roads as owner, e}{#if owner}{@const a = point(
              board.edges[e][0],
            )}{@const b = point(board.edges[e][1])}<g data-piece={'road-' + e}
              ><line
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="#26342f"
                stroke-width="9"
                stroke-linecap="round"
              /><line
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                class="built"
                stroke={color(owner)}
                stroke-width="6"
                stroke-linecap="round"
              /></g
            >{/if}{/each}
        {#each pub.buildings as building, v}{#if building}{@const p =
              point(v)}<g
              data-piece={'building-' + v}
              transform={'translate(' + p[0] + ' ' + p[1] + ')'}
              ><path
                class="built"
                d={building.city
                  ? 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z'
                  : 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z'}
                fill={colors[building.color]}
                stroke="#39291f"
                stroke-width="1.5"
                style="filter:drop-shadow(1px 3px 1px #142b36aa)"
              /><path
                pointer-events="none"
                d={building.city
                  ? 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z'
                  : 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z'}
                fill="url(#piece-shine)"
                class="piece-finish"
              /><path
                class="piece-detail"
                pointer-events="none"
                d={building.city ? 'M-6 7V2H-3V7M2 3H5V6H2Z' : 'M-2 8V2H2V8'}
                fill="#3b2f27"
              /></g
            >{/if}{/each}
        {#each legal.filter((a) => a.type === placement || a.type === 'MOVE_ROBBER') as action}
          {@const target =
            action.vertex !== undefined
              ? point(action.vertex)
              : action.edge !== undefined
                ? [
                    (point(board.edges[action.edge][0])[0] +
                      point(board.edges[action.edge][1])[0]) /
                      2,
                    (point(board.edges[action.edge][0])[1] +
                      point(board.edges[action.edge][1])[1]) /
                      2,
                  ]
                : [
                    (2 * board.hexes[action.hex].q +
                      board.hexes[action.hex].r) *
                      37,
                    3 * board.hexes[action.hex].r * 21.4,
                  ]}
          <circle
            class="target"
            cx={target[0]}
            cy={target[1]}
            r="15"
            fill="transparent"
            stroke="transparent"
            role="button"
            tabindex="0"
            aria-label={`${action.type === 'MOVE_ROBBER' ? m.catan_move_robber({}, { locale }) : label(action)} ${action.vertex ?? action.edge ?? action.hex}`}
            onclick={() => {
              if (!dragged) pending = action;
            }}
            ondblclick={(e) => {
              e.preventDefault();
              if (!dragged) {
                send(action);
                pending = null;
              }
            }}
            class:chosen={pending?.type === action.type &&
              (pending.vertex ?? pending.edge ?? pending.hex) ===
                (action.vertex ?? action.edge ?? action.hex)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pending = action;
              }
            }}
          />
          <g
            class="placement-hint"
            class:revealed={showPlacements && action.type === placement}
            pointer-events="none"
            aria-hidden="true"
          >
            {@render ghost(action)}
          </g>
        {/each}

        {#if pending}
          <g class="preview" opacity=".6" pointer-events="none">
            {@render ghost(pending)}
          </g>
        {/if}
      </g>
    </svg>
    {#if diceVisible && pub.dice && pub.phase.type !== 'setup' && pub.phase.type !== 'finished'}
      <div class="board-dice"><Dice values={pub.dice} /></div>
    {/if}
    <div class="controls">
      <div class="actions">
        {#if allowed('ROLL_DICE')}
          <button
            class="roll-button"
            class:charging
            style={'--charge:' + charge * 100 + '%'}
            title={m.catan_charge_hint({}, { locale })}
            onpointerdown={(e) => {
              if (e.button === 0) {
                e.currentTarget.setPointerCapture(e.pointerId);
                beginCharge();
              }
            }}
            onpointerup={releaseCharge}
            onpointercancel={cancelCharge}
            onlostpointercapture={() => {
              if (charging) cancelCharge();
            }}
            onkeydown={(e) => {
              if ([' ', 'Enter'].includes(e.key)) {
                e.preventDefault();
                if (!e.repeat) beginCharge();
              }
            }}
            onkeyup={(e) => {
              if ([' ', 'Enter'].includes(e.key)) {
                e.preventDefault();
                releaseCharge();
              }
            }}
            onblur={cancelCharge}
            onclick={(e) => {
              if (e.detail === 0 && !charging)
                send({ type: 'ROLL_DICE', strength: 0 });
            }}
            >{m.catan_roll_dice({}, { locale })}{#if charging}<span
                class="charge-label">{Math.round(charge * 100)}%</span
              >{/if}</button
          >
        {/if}
        {#each legal.filter( (a) => ['END_TURN', 'BUY_DEVELOPMENT', 'FINISH_ROADS', 'STEAL'].includes(a.type) ) as action}<button
            disabled={action.type === 'END_TURN' && diceVisible}
            onclick={() => send(action)}>{label(action)}</button
          >{/each}
      </div>
      <div class="actions game-actions">
        <button
          aria-disabled={!canTrade()}
          class="open-offer-button"
          onclick={() => openTrade()}
          >{@render marketIcon()}{m.catan_open_offer(
            {},
            { locale },
          )}{#if !canTrade()}<span class="trade-tooltip" role="tooltip"
              >{tradeReason()}</span
            >{/if}</button
        >
        <button onclick={() => showMarket('bank')}
          >🏛 {m.catan_bank({}, { locale })}</button
        >
        <button onclick={() => showMarket('offers')}>
          {@render marketIcon()}{m.catan_player_offers({}, { locale })} · {incomingOffers()
            .length}</button
        >
        {#each ['BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY'] as type}<button
            class="build-choice"
            class:chosen={placement === type}
            aria-pressed={placement === type}
            disabled={!allowed(type)}
            onclick={() => {
              selected = type;
              showPlacements = true;
              pending = null;
            }}
            ><svg
              class="build-icon"
              viewBox="-13 -13 26 26"
              aria-hidden="true"
              fill={color(playerId)}
              stroke="#fff3cb"
              stroke-width="1.5"
            >
              {#if type === 'BUILD_ROAD'}<path
                  d="M-9 6 7-9 11-5-5 10Z"
                />{:else}<path
                  d={type === 'BUILD_CITY'
                    ? 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z'
                    : 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z'}
                />{/if}
            </svg>{label({ type })}</button
          >{/each}
      </div>

      {#if pending}<div class="confirm">
          <b
            >{pending.type === 'MOVE_ROBBER'
              ? m.catan_move_robber({}, { locale })
              : label(pending)}
            {pending.vertex ?? pending.edge ?? pending.hex}</b
          ><button
            onclick={() => {
              send(pending);
              pending = null;
            }}>{m.catan_confirm({}, { locale })}</button
          ><button onclick={() => (pending = null)}
            >{m.catan_cancel({}, { locale })}</button
          >
        </div>{/if}
    </div>
  </div>
  <div
    class="hand"
    style={'--stack-count:' +
      (5 + new Set(priv.development.map((c) => c.kind)).size)}
    aria-label={m.catan_resources({}, { locale })}
  >
    {#each names() as resource, i}<div
        class="resource-card"
        class:empty={priv.hand[i] === 0}
        style={'--card-color:' +
          ['#3f6741', '#78905d', '#b68c35', '#a8593c', '#617e8a'][i]}
        title={m.catan_bank({}, { locale }) + ': ' + pub.bank[i]}
      >
        <b class="quantity">{priv.hand[i]}</b><span class="card-title"
          >{resource}</span
        >
        <div
          class="card-art"
          style={'background-image:url(' + terrain[i] + ')'}
        >
          <ResourceArt resource={i} />
        </div>
        <span class="card-footer">CATAN</span>
      </div>{/each}
    {#each [...new Set(priv.development.map((c) => c.kind))] as kind}
      <button
        class="resource-card development-card"
        title={m.catan_development_instruction({}, { locale })}
        onclick={() => {
          developmentOpen = kind;
          tradeOpen = false;
        }}
      >
        <b class="quantity"
          >{priv.development.filter((c) => c.kind === kind).length}</b
        >
        <span class="card-title">{label({ type: kind })}</span>
        <img class="card-art" src={developmentImage(kind)} alt="" />
        <span class="card-footer">CATAN</span>
      </button>
    {/each}
  </div>
  <div
    data-trade-anchor={tradeOpen ? tradeAnchor : undefined}
    class="panels"
    class:panel-open={tradeOpen || !!developmentOpen || !!priv.discardRequired}
  >
    {#if tradeOpen || developmentOpen}<button
        class="close-panel"
        aria-label={m.catan_cancel({}, { locale })}
        onclick={() => {
          tradeOpen = false;
          developmentOpen = '';
        }}>×</button
      >{/if}
    {#if priv.discardRequired}<form
        onsubmit={(e) => {
          e.preventDefault();
          send({ type: 'DISCARD', resources: discard });
          discard = [0, 0, 0, 0, 0];
        }}
      >
        <h3>{m.catan_discard({}, { locale })} {priv.discardRequired}</h3>
        <div class="quantities">
          {#each names() as resource, i}<label
              ><span class="resource-icon"><ResourceArt resource={i} /></span
              >{resource}<input
                type="number"
                min="0"
                max={priv.hand[i]}
                bind:value={discard[i]}
              /></label
            >{/each}
        </div>
        <button>{m.catan_confirm_discard({}, { locale })}</button>
      </form>{/if}
    {#if developmentOpen}
      <h3>{label({ type: developmentOpen })}</h3>
      <p>{m.catan_development_instruction({}, { locale })}</p>
      <div class="actions">
        {#each legal.filter((a) => a.type === developmentOpen) as action}<button
            onclick={() => {
              send(action);
              developmentOpen = '';
            }}>{label(action)}</button
          >{/each}
      </div>
    {/if}
    {#if tradeOpen && tradeMode === 'compose'}
      <h3>
        {@render marketIcon()}
        {targetPlayer
          ? m.catan_trade_with({}, { locale }) + ' ' + name(targetPlayer)
          : m.catan_open_offer({}, { locale })}
      </h3>
      {#if !targetPlayer}<p>{m.catan_open_offer_help({}, { locale })}</p>{/if}
      {#if pub.phase.type === 'turn' && pub.phase.stage === 'actions' && !pub.paired}<form
          onsubmit={(e) => {
            e.preventDefault();
            if (validOffer()) {
              submittedOfferAfter = Math.max(0, ...pub.offers.map((o) => o.id));
              send({
                type: 'OFFER',
                give: [...give],
                take: [...take],
                to: targetPlayer || null,
              });
            }
          }}
        >
          <div class="quantities">
            {#each names() as resource, i}<div class="trade-resource">
                <span class="resource-icon"><ResourceArt resource={i} /></span
                ><b>{resource}</b>
                {#each ['give', 'take'] as direction}
                  {@const amounts = direction === 'give' ? give : take}
                  {@const maximum = direction === 'give' ? priv.hand[i] : 24}
                  <span class="stepper-label"
                    >{direction === 'give'
                      ? m.catan_give({}, { locale })
                      : m.catan_ask({}, { locale })}</span
                  >
                  <div
                    class="stepper"
                    role="group"
                    aria-label={(direction === 'give'
                      ? m.catan_give({}, { locale })
                      : m.catan_ask({}, { locale })) +
                      ' ' +
                      resource}
                  >
                    <button
                      type="button"
                      aria-label={'− ' + resource}
                      disabled={amounts[i] <= 0}
                      onclick={() => (amounts[i] = Math.max(0, amounts[i] - 1))}
                      >−</button
                    >
                    <output>{amounts[i]}</output>
                    <button
                      type="button"
                      aria-label={'+ ' + resource}
                      disabled={amounts[i] >= maximum ||
                        (direction === 'give' ? take[i] : give[i]) > 0}
                      onclick={() =>
                        (amounts[i] = Math.min(maximum, amounts[i] + 1))}
                      >+</button
                    >
                  </div>
                {/each}
              </div>{/each}
          </div>
          {#if !validOffer()}<p role="status">
              {tradeReason(targetPlayer) ||
                m.catan_offer_resources_reason({}, { locale })}
            </p>{/if}
          <button disabled={!validOffer()}
            >{m.catan_send_offer({}, { locale })}</button
          >
        </form>{/if}
    {/if}
    {#if tradeOpen && tradeMode === 'bank'}
      <h3>🏛 {m.catan_bank({}, { locale })}</h3>
      <p>{m.catan_bank_help({}, { locale })}</p>
      <div class="actions">
        {#each legal.filter((a) => a.type === 'BANK_TRADE') as action}
          <button onclick={() => send(action)}
            ><span class="exchange-icon"
              ><ResourceArt resource={action.give} /></span
            >
            →
            <span class="exchange-icon"
              ><ResourceArt resource={action.take} /></span
            >{label(action)}</button
          >
        {:else}<p>{m.catan_no_bank_trades({}, { locale })}</p>{/each}
      </div>
    {/if}
    {#if tradeOpen && tradeMode === 'offers'}
      {#if offerSent}<p role="status">
          {m.catan_offer_sent({}, { locale })}
        </p>{/if}
      <h3>{@render marketIcon()}{m.catan_player_offers({}, { locale })}</h3>
      {#each [false, true] as own}
        <h4>
          {own
            ? m.catan_your_offers({}, { locale })
            : m.catan_incoming_offers({}, { locale })}
        </h4>
        {#each own ? pub.offers.filter((o) => o.from === playerId) : incomingOffers() as offer}
          <article class="player-offer">
            <strong
              >{name(offer.from)} → {offer.to
                ? name(offer.to)
                : m.catan_open_offer({}, { locale })}</strong
            >
            {#each ['give', 'take'] as side}
              <div class="offer-resources">
                <span
                  >{side === 'give'
                    ? m.catan_offer_gives({}, { locale })
                    : m.catan_offer_wants({}, { locale })}</span
                >
                {#each names() as resource, i}{#if (side === 'give' ? offer.give : offer.take)[i]}<span
                      ><ResourceArt resource={i} />{(side === 'give'
                        ? offer.give
                        : offer.take)[i]}
                      {resource}</span
                    >{/if}{/each}
              </div>
            {/each}
            <div class="actions">
              {#each legal.filter((a) => (a.offer === offer.id && ['ACCEPT', 'DECLINE', 'CONFIRM_TRADE'].includes(a.type)) || (own && a.type === 'WITHDRAW')) as action}
                <button onclick={() => send(action)}>{label(action)}</button>
              {/each}
            </div>
          </article>
        {:else}<p>{m.catan_no_offers({}, { locale })}</p>{/each}
      {/each}
    {/if}
  </div>
</section>

<style>
  .market-icon {
    width: 20px;
    height: 20px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 5px;
  }
  .player-offer {
    padding: 12px 0;
    border-top: 1px solid #c7ab7060;
  }
  .offer-resources {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }
  .offer-resources span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .offer-resources :global(svg) {
    width: 24px;
    height: 24px;
  }

  .catan {
    position: absolute;
    inset: 0;
    overflow: hidden;
    color: #fff0d4;
    background:
      radial-gradient(ellipse at 50% 45%, #45c4ba33, #063147a8), var(--ocean);
    background-size: cover, cover;
    background-repeat: no-repeat;
  }
  .catan::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.3;
    background: repeating-linear-gradient(
      174deg,
      transparent 0 35px,
      #a1f5e30b 37px,
      transparent 40px 100px
    );
    mix-blend-mode: screen;
  }
  button {
    padding: 8px 12px;
    font-size: 12px;
    background: #173c49ed;
    border: 1px solid #adccb33b;
    color: #ffeecb;
  }
  button.chosen {
    background: #496e62;
    border-color: #f4ce80;
  }
  .roster {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }
  .roster > div {
    position: absolute;
    width: 174px;
    min-height: 84px;
    padding: 10px 10px 10px 50px;
    border-radius: 3px 14px 14px 3px;
    background: linear-gradient(110deg, #132d37ed, #174350c9);
    border-left: 3px solid var(--seat);
    box-shadow: 0 5px 16px #002c3c45;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .roster [data-position='north'] {
    top: 40px;
    left: calc(50% - 87px);
  }
  .roster [data-position='south'] {
    bottom: 145px;
    left: calc(50% - 87px);
  }
  .roster [data-position='west'] {
    left: 20px;
    top: 42%;
  }
  .roster [data-position='east'] {
    right: 20px;
    top: 42%;
  }
  .roster [data-position='north-west'] {
    left: 25%;
    top: 40px;
  }
  .roster [data-position='north-east'] {
    right: 25%;
    top: 40px;
  }
  .roster .active {
    box-shadow:
      0 0 0 1px #edd195a0,
      0 4px 24px #f0c25d24;
  }
  .roster .controlled {
    border-left-width: 5px;
  }
  .crest {
    position: absolute;
    left: 7px;
    top: 14px;
    width: 32px;
    height: 41px;
    display: grid;
    place-items: center;
    font-size: 26px;
    color: var(--seat);
    background: #122a33;
    clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
    border-top: 2px solid var(--seat);
  }
  .civilization-name {
    font-family: Georgia, serif;
    font-size: 14px;
    color: var(--seat);
    font-weight: bold;
    line-height: 1.1;
  }
  .roster span,
  .roster small {
    font-size: 9px;
    line-height: 1.4;
    color: #cad9d4;
  }
  .seat-name {
    font-size: 11px;
  }
  .seat-name {
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 3px;
    font-weight: normal;
  }
  .phase {
    position: absolute;
    top: 64px;
    left: 20px;
    width: 210px;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 600;
    margin: 0;
    color: #e9e6ce;
  }
  .table {
    position: absolute;
    inset: 105px 195px 180px;
  }
  .board-dice {
    position: absolute;
    left: 55%;
    top: 57%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
  }
  .table > svg {
    width: 100%;
    height: 100%;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    filter: drop-shadow(0 10px 6px #05323d55);
  }
  .target {
    cursor: pointer;
  }
  .target:focus,
  .target:focus-visible,
  .table > svg:focus,
  .table > svg:focus-visible {
    outline: none;
  }
  .table:has(> svg:focus-visible) .zoom-controls {
    border-radius: 8px;
    box-shadow: 0 0 0 2px #eed09b;
  }
  .placement-hint {
    opacity: 0;
  }
  .placement-hint.revealed {
    opacity: 0.45;
  }
  .build-choice {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .build-icon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
  }
  .target:hover + .placement-hint,
  .target:focus-visible + .placement-hint {
    opacity: 0.65;
  }
  .target.chosen + .placement-hint {
    opacity: 0;
  }
  .zoom-controls {
    position: fixed;
    top: 56px;
    right: 16px;
    display: flex;
    gap: 4px;
    z-index: 3;
  }
  .zoom-controls button {
    padding: 4px 9px;
    font-size: 11px;
    background: #123c49df;
  }
  .controls {
    position: fixed;
    left: 20px;
    bottom: 20px;
    width: 230px;
    max-height: 230px;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    gap: 9px;
    background: #103543c9;
    border: 1px solid #bce4d922;
    border-radius: 14px;
    z-index: 3;
  }
  .actions {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }
  .controls button {
    font-size: 11px;
    padding: 7px 9px;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    background: #365f60;
    padding: 8px;
    border-radius: 8px;
  }
  .confirm b {
    font-size: 11px;
    width: 100%;
  }
  .hand {
    position: absolute;
    bottom: 7px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
    z-index: 3;
    align-items: end;
  }
  .resource-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 83px;
    height: 124px;
    border: 4px solid #e4d1a3;
    border-radius: 8px;
    background: #e8d8ab;
    box-shadow:
      0 3px 0 #806d4f,
      0 6px 15px #001c3580;
    color: #352e20;
    transform: rotate(var(--tilt, 0deg));
    overflow: visible;
  }
  .resource-card:nth-child(1) {
    --tilt: -6deg;
    bottom: -5px;
  }
  .resource-card:nth-child(2) {
    --tilt: -3deg;
  }
  .resource-card:nth-child(4) {
    --tilt: 3deg;
  }
  .resource-card:nth-child(5) {
    --tilt: 6deg;
    bottom: -5px;
  }
  .card-title {
    font-family: Georgia, serif;
    font-size: 12px;
    font-weight: bold;
    padding: 3px;
  }
  .card-art {
    width: 100%;
    height: 78px;
    background-size: cover;
    background-position: center;
    border: 2px solid #9f8450;
    position: relative;
    isolation: isolate;
  }
  .card-art::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(#fff8dd40, #efe0b5c9);
    z-index: -1;
  }
  .card-art :global(svg) {
    width: 100%;
    height: 100%;
  }
  .card-footer {
    font-size: 9px;
    letter-spacing: 3px;
    font-weight: bold;
    color: #8f3026;
    padding-top: 4px;
  }
  .quantity {
    position: absolute;
    top: -12px;
    right: -10px;
    z-index: 2;
    min-width: 25px;
    height: 25px;
    display: grid;
    place-items: center;
    background: #fff1c7;
    color: #2b443c;
    border: 2px solid var(--card-color);
    border-radius: 50%;
    font-size: 14px;
  }
  .empty {
    filter: saturate(0.6);
    opacity: 0.8;
  }
  .panels {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 220px;
    max-height: 65dvh;
    overflow-y: auto;
    padding: 8px 12px;
    background: #103543e8;
    border: 1px solid #bce4d922;
    border-radius: 12px;
    z-index: 4;
  }
  .panels:has(form > h3) {
    width: min(440px, calc(100vw - 32px));
  }
  summary {
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: 7px 0;
  }
  details {
    padding: 3px 0;
  }
  .panels p {
    font-size: 12px;
  }
  .quantities {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0;
  }
  .quantities label {
    font-size: 11px;
  }
  .quantities span {
    display: grid;
    gap: 3px;
  }
  input {
    width: 50px;
    padding: 5px;
    color: #163d45;
  }
  select {
    color: #163d45;
    padding: 5px;
  }
  form {
    padding: 8px 0;
  }
  .settings-trigger {
    position: absolute;
    top: 10px;
    right: 16px;
    z-index: 8;
    font-size: 21px;
    padding: 4px 10px;
    background: #10354388;
    border-radius: 50%;
    width: 38px;
    height: 38px;
  }
  .settings-menu {
    position: absolute;
    right: 16px;
    top: 56px;
    width: min(360px, calc(100vw - 32px));
    max-height: calc(100dvh - 80px);
    overflow: auto;
    background: #10313ef7;
    border: 1px solid #bda77a;
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 20px 80px #001825aa;
    z-index: 10;
  }
  .settings-menu header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .settings-menu h2 {
    font-size: 24px;
    margin: 0;
  }
  .settings-menu p {
    font-size: 12px;
  }
  .preferences {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 18px 0;
  }
  .preferences label {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .preferences button[aria-pressed='true'] {
    border-color: #d6c281;
  }
  .still :global(*) {
    animation: none !important;
    transition: none !important;
  }
  @media (max-width: 1000px) and (min-width: 701px) {
    .table {
      inset: 120px 130px 180px;
    }
    .roster > div {
      width: 140px;
      padding-left: 43px;
    }
    .roster [data-position='west'] {
      left: 10px;
    }
    .roster [data-position='east'] {
      right: 10px;
    }
    .controls {
      width: 180px;
      left: 10px;
    }
    .panels {
      width: 170px;
      right: 10px;
    }
    .resource-card {
      width: 67px;
      height: 112px;
    }
    .card-art {
      height: 65px;
    }
    .civilization-name {
      font-size: 12px;
    }
  }
  @media (max-width: 700px) {
    .zoom-controls {
      position: absolute;
      top: 0;
      right: auto;
      left: 50%;
      transform: translateX(-50%);
    }
    .table {
      inset: 180px 20px 235px;
    }
    .phase {
      top: 48px;
      left: 10px;
      width: 115px;
      font-size: 10px;
    }
    .roster > div {
      width: 108px;
      min-height: 60px;
      padding: 7px 5px 7px 30px;
      gap: 2px;
    }
    .crest {
      left: 3px;
      top: 10px;
      width: 22px;
      height: 31px;
      font-size: 20px;
    }
    .civilization-name {
      font-size: 11px;
    }
    .roster span,
    .roster small {
      font-size: 8px;
    }
    .seat-name {
      font-size: 9px;
    }
    .roster [data-position='north'] {
      top: 47px;
      left: calc(50% - 54px);
    }
    .roster [data-position='south'] {
      bottom: 169px;
      left: calc(50% - 54px);
    }
    .roster [data-position='west'] {
      left: 8px;
      top: 123px;
    }
    .roster [data-position='east'] {
      right: 8px;
      top: 123px;
    }
    .roster [data-position='north-west'] {
      left: 8px;
      top: 52px;
    }
    .roster [data-position='north-east'] {
      right: 8px;
      top: 52px;
    }
    .extended [data-position='north'] {
      top: 52px;
    }
    .extended ~ .phase {
      top: 34px;
      width: calc(100% - 70px);
    }
    .controls {
      left: 8px;
      right: 8px;
      width: auto;
      bottom: 98px;
      max-height: 68px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      padding: 7px;
      gap: 5px;
    }
    .controls button {
      font-size: 10px;
      padding: 5px 7px;
    }
    .controls:has(.confirm) {
      max-height: 180px;
      z-index: 6;
      background: #103543f5;
    }
    .confirm {
      width: 100%;
    }
    .confirm b {
      width: auto;
      align-self: center;
    }
    .hand {
      bottom: 5px;
      gap: 4px;
      left: 8px;
      transform: none;
    }
    .resource-card {
      width: 49px;
      height: 83px;
      border-width: 3px;
    }
    .card-title {
      font-size: 9px;
      padding: 2px;
    }
    .card-art {
      height: 46px;
    }
    .card-footer {
      font-size: 7px;
      letter-spacing: 1px;
      padding: 3px;
    }
    .quantity {
      font-size: 11px;
      min-width: 20px;
      height: 20px;
      right: -6px;
      top: -9px;
    }
    .panels {
      bottom: 8px;
      right: 8px;
      width: 105px;
      padding: 5px 8px;
    }
    .panels:has(form > h3) {
      width: calc(100% - 16px);
      max-height: 65dvh;
      background: #103543fa;
      z-index: 9;
    }
    .settings-trigger {
      top: 7px;
      right: 9px;
      width: 32px;
      height: 32px;
      padding: 2px;
      font-size: 20px;
    }
    .settings-menu {
      right: 8px;
      top: 44px;
    }
  }
  @media (max-height: 650px) and (min-width: 701px) {
    .table {
      inset: 90px 180px 125px;
    }
    .roster [data-position='south'] {
      bottom: 120px;
    }
    .resource-card {
      height: 105px;
      width: 70px;
    }
    .card-art {
      height: 60px;
    }
    .controls {
      max-height: 180px;
    }
  }
  .controls {
    left: max(24px, calc(50% - 490px));
    max-height: none;
    bottom: 32px;
    width: 235px;
    background: none;
    border: 0;
    overflow: visible;
    padding: 0;
  }
  .controls .actions {
    justify-content: center;
  }
  .civilization-name {
    background: none;
    border: 0;
    padding: 0;
    text-align: left;
    color: inherit;
    font:
      bold 15px/1 Georgia,
      serif;
  }
  .panels {
    display: none;
  }
  .panels.panel-open {
    display: block;
    width: min(440px, calc(100vw - 32px));
    padding: 20px;
    background: #123e49f5;
    box-shadow: 0 16px 60px #001a3066;
    border: 1px solid #d9c58c66;
  }
  .panels h3 {
    font:
      bold 22px Georgia,
      serif;
    margin: 0 30px 16px 0;
    color: #f5d99b;
  }
  .close-panel {
    float: right;
    font-size: 20px;
  }
  .resource-icon {
    display: block;
    width: 42px;
    height: 42px;
    margin: auto;
  }
  .exchange-icon {
    display: inline-block;
    width: 22px;
    height: 22px;
    vertical-align: middle;
  }
  .resource-icon :global(svg),
  .exchange-icon :global(svg) {
    width: 100%;
    height: 100%;
  }
  .quantities {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 5px;
  }
  .quantities label {
    min-width: 0;
    text-align: center;
    padding: 5px;
    background: #ffffff08;
    border-radius: 8px;
  }
  .quantities input {
    width: 100%;
    max-width: 54px;
    text-align: center;
    margin: 3px 0 8px;
  }
  .development-card {
    padding: 0;
    flex-shrink: 0;
    border-color: #c4a85a;
    cursor: pointer;
  }
  .development-card:hover {
    transform: translateY(-14px);
  }
  .development-card .card-art {
    object-fit: contain;
  }
  .hand {
    max-width: calc(100vw - 32px);
  }
  @media (max-width: 1100px) and (min-width: 701px) {
    .controls {
      left: 24px;
      width: 170px;
    }
    .hand {
      left: 57%;
    }
  }
  @media (max-width: 700px) {
    .controls {
      left: 8px;
      right: 8px;
      bottom: 105px;
      width: auto;
      justify-content: center;
      gap: 4px;
    }
    .hand {
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      gap: 2px;
      overflow-x: auto;
      padding: 12px 5px 5px;
    }
    .resource-card {
      flex-shrink: 0;
    }
    .panels.panel-open {
      bottom: 8px;
      right: 8px;
      width: calc(100% - 16px);
      max-height: 65dvh;
      z-index: 9;
    }
    .civilization-name {
      font-size: 11px;
    }
  }
  .roll-button {
    position: relative;
    touch-action: none;
    user-select: none;
    overflow: hidden;
    background: linear-gradient(
      90deg,
      #a17c32 var(--charge),
      #123c49 var(--charge)
    );
    min-width: 110px;
  }
  .charge-label {
    margin-left: 8px;
    color: #ffe4a4;
  }
  button[aria-disabled='true'] {
    opacity: 0.55;
  }
  .seat-trade,
  .open-offer-button {
    position: relative;
  }
  .trade-tooltip,
  .roster .trade-tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 210px;
    padding: 9px 12px;
    border: 1px solid #c7ab70;
    border-radius: 8px;
    background: #102f3b;
    color: #fff0cb;
    font-size: 12px;
    line-height: 1.4;
    text-align: left;
    white-space: normal;
    box-shadow: 0 4px 12px #001b2870;
    pointer-events: none;
    z-index: 20;
  }
  .roster > div:has(.seat-trade:hover),
  .roster > div:focus-within {
    z-index: 5;
  }
  .roster [data-position='east'] .trade-tooltip {
    left: auto;
    right: 0;
  }
  .roster [data-position^='north'] .trade-tooltip {
    top: calc(100% + 8px);
    bottom: auto;
  }
  button:hover > .trade-tooltip,
  button:focus > .trade-tooltip,
  .roster button:hover > .trade-tooltip,
  .roster button:focus > .trade-tooltip {
    display: block;
  }
  .seat-trade {
    justify-self: start;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 12px;
  }
  .trade-resource {
    min-width: 0;
    text-align: center;
    background: #ffffff09;
    border-radius: 10px;
    padding: 5px 2px 10px;
    font-size: 11px;
  }
  .stepper-label {
    display: block;
    margin: 10px 0 4px;
    opacity: 0.8;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .stepper button {
    padding: 3px;
    min-width: 21px;
    height: 29px;
    border: 0;
    background: transparent;
    color: #ffe0a0;
    font-size: 24px;
    font-weight: 600;
    text-shadow: 0 1px 2px #001c2b;
  }
  .stepper output {
    min-width: 17px;
    font-size: 15px;
    color: #ffe2a2;
  }
  @media (min-width: 701px) {
    .panels[data-trade-anchor='west'] {
      left: 200px;
      right: auto;
      top: 35%;
      bottom: auto;
      max-height: 60dvh;
    }
    .panels[data-trade-anchor='east'] {
      right: 200px;
      top: 35%;
      bottom: auto;
      max-height: 60dvh;
    }
    .panels[data-trade-anchor='north'],
    .panels[data-trade-anchor='north-west'],
    .panels[data-trade-anchor='north-east'] {
      top: 145px;
      bottom: auto;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
    }
    .panels[data-trade-anchor='north-west'] {
      left: 30%;
    }
    .panels[data-trade-anchor='north-east'] {
      left: 70%;
    }
    .panels[data-trade-anchor='south'] {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      bottom: 145px;
    }
  }
  .table > svg.zoomed {
    cursor: grab;
  }
  .table > svg.panning,
  .table > svg.panning .target {
    cursor: grabbing;
  }
  .catan {
    --controls-left: max(210px, calc(50% - 380px));
    --hand-left: calc(var(--controls-left) + 250px);
    --card-width: 83px;
  }
  .controls {
    left: var(--controls-left);
  }
  .hand {
    left: var(--hand-left);
    transform: none;
    display: grid;
    --card-step: min(
      calc(var(--card-width) + 6px),
      calc(
        (100vw - var(--hand-left) - 24px - var(--card-width)) /
          (var(--stack-count) - 1)
      )
    );
    grid-template-columns: repeat(var(--stack-count), var(--card-step));
    gap: 0;
    width: max-content;
    max-width: none;
    overflow: visible;
    padding: 0;
  }
  .resource-card {
    width: var(--card-width);
  }
  .resource-card:hover,
  .resource-card:focus-visible {
    z-index: 5;
  }
  .roster [data-position='south'] {
    bottom: 22px;
    left: calc(var(--controls-left) - 194px);
  }
  .stepper button:hover:not(:disabled) {
    color: #fff5d5;
    transform: scale(1.12);
  }
  .stepper button:disabled {
    color: #81a29f;
    opacity: 0.5;
  }
  @media (min-width: 701px) and (max-width: 1100px) {
    .catan {
      --hand-left: calc(var(--controls-left) + 190px);
      --card-width: 67px;
    }
    .controls {
      width: 170px;
    }
    .roster [data-position='south'] {
      bottom: 20px;
      width: 174px;
    }
  }
  @media (max-width: 700px) {
    .catan {
      --hand-left: 8px;
      --card-width: 49px;
    }
    .controls {
      left: 124px;
      right: 8px;
      bottom: 108px;
      width: auto;
    }
    .roster [data-position='south'] {
      left: 8px;
      right: auto;
      bottom: 105px;
    }
  }
  .controls .game-actions {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    grid-template-rows: repeat(3, auto);
    grid-auto-flow: column;
    gap: 6px;
  }
  .controls .game-actions > button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 0;
    min-height: 36px;
    padding: 6px 4px;
    line-height: 1.2;
  }
  .game-actions .market-icon,
  .game-actions .build-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin: 0;
  }
  .roster > div {
    width: max-content;
    max-width: 350px;
    min-height: 66px;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px 10px 50px;
  }
  .seat-identity {
    flex-shrink: 0;
  }
  .seat-identity .civilization-name {
    white-space: nowrap;
  }
  .roster .seat-stats {
    max-width: 115px;
  }
  .roster .seat-trade {
    order: 2;
    flex-shrink: 0;
  }
  .roster [data-position='north'] {
    left: 50%;
    transform: translateX(-50%);
  }
  @media (min-width: 701px) {
    .catan {
      --controls-left: max(330px, calc(50% - 300px));
    }
    .roster [data-position='south'] {
      left: auto;
      right: calc(100% - var(--controls-left) + 16px);
      max-width: 310px;
    }
  }
  @media (max-width: 700px) {
    .roster > div {
      max-width: calc(50% - 12px);
      padding: 7px 6px 7px 30px;
      gap: 5px;
      flex-wrap: wrap;
      min-height: 54px;
    }
    .seat-identity .civilization-name {
      white-space: normal;
    }
    .roster [data-position='south'] {
      max-width: 112px;
    }
  }
</style>
