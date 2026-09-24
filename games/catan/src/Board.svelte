<script lang="ts">
  import { onMount, setContext, tick, untrack, type Snippet } from 'svelte';
  import { RevisionGate, read, write } from '@board-games/shared/ui';
  import {
    gameSkin,
    setGameSkin,
    type Skin,
  } from '@board-games/shared/ui/pixel';
  import {
    P,
    cell,
    developmentCell,
    discPixels,
    linePixels,
    polygonPixels,
    sheets,
    snap,
  } from './pixel/geometry.js';
  import {
    ramp,
    robberRamp,
    sprites,
    type SpriteName,
  } from './pixel/sprites.js';
  import { prefersReducedMotion } from 'svelte/motion';
  import { playEffects, softAudio } from './effects.js';
  import type { playerView } from './index.js';
  import Dice from './Dice.svelte';
  import ResourceArt from './ResourceArt.svelte';
  import ocean from '../assets/tabletop-ocean.webp?url';
  import woodGrain from '../assets/table-wood.webp?url';
  import developmentBack from '../assets/development-compass.webp?url';
  import wood from '../assets/painted-wood.webp?url';
  import wool from '../assets/painted-wool.webp?url';
  import wheat from '../assets/painted-wheat.webp?url';
  import brick from '../assets/painted-brick.webp?url';
  import ore from '../assets/painted-ore.webp?url';
  import desert from '../assets/painted-desert.webp?url';
  import BuildingCosts from './table/BuildingCosts.svelte';
  import PieceReserve from './table/PieceReserve.svelte';
  import { resourceArtwork, shade } from './table/artwork.js';
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
    onLeave,
    onInvite,
    copied = false,
    rulesContent,
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
    onLeave?: () => void;
    onInvite?: () => void;
    copied?: boolean;
    rulesContent?: Snippet;
  } = $props();

  let root: HTMLElement;
  let map: SVGSVGElement;
  /** Viewer-only look; the 8-bit stylesheet loads the first time it is chosen. */
  let skin = $state<Skin>(gameSkin('catan')),
    pixelReady = $state(false);
  $effect(() => {
    if (skin === 'pixel' && !pixelReady)
      void import('./pixel.css').then(() => (pixelReady = true));
  });
  const pixel = $derived(skin === 'pixel' && pixelReady);
  setContext('catan:pixel', () => pixel);
  let sound = $state(read('catan:sound') !== 'false'),
    motion = $state(read('catan:motion') !== 'false');
  const reduced = $derived(prefersReducedMotion.current);
  let settings = $state(false);
  let rulesDialog: HTMLDialogElement;
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
  function openTrade(id = '') {
    if (id ? !canTradeWith(id) : !canTrade()) {
      if (sound) {
        audio.unlock();
        audio.reject(pixel);
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
    write('catan:' + key, String(key === 'sound' ? sound : motion));
  }
  onMount(() => {
    const observer = new ResizeObserver(() => {
      stopEffects();
    });
    observer.observe(map);
    return () => {
      cancelCharge();
      observer.disconnect();
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
    const chip = untrack(() => pixel);
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
      if (audible && events.length) audio.play(events, chip, playerId);
      if (enabled)
        void tick().then(() => {
          if (!cancelled)
            stopEffects = playEffects(
              root,
              events,
              () => (diceVisible = false),
              () => (rolling = false),
              chip,
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

  const terrain = [wood, wool, wheat, brick, ore, desert];
  const colors = [
    '#df261b',
    '#008ce1',
    '#f5c735',
    '#f88719',
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
  const tileX = 50,
    tileY = 26.75;
  const point = (v: number) => [
    board.vertices[v][0] * tileX,
    board.vertices[v][1] * tileY,
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
  /** 8-bit island geometry, rasterized once per board on the art-pixel grid. */
  const pixelIsland = $derived.by(() => {
    if (!pixel) return null;
    const corners = board.hexes.map((h: any) => h.vertices.map(point));
    return {
      foam: corners.map((c: number[][]) => polygonPixels(c, 9)).join(''),
      sand: corners.map((c: number[][]) => polygonPixels(c, 6)).join(''),
      sandShade: corners
        .map((c: number[][]) =>
          polygonPixels(
            c.map(([x, y]) => [x, y + 2 * P]),
            5,
          ),
        )
        .join(''),
      ink: corners.map((c: number[][]) => polygonPixels(c, 1)).join(''),
      tiles: corners.map((c: number[][]) => polygonPixels(c, -0.6)),
      rings: corners.map(
        (c: number[][]) => polygonPixels(c, -0.6) + polygonPixels(c, -3.2),
      ),
    };
  });
  /** Road pixels per edge; boards of one size share their geometry. */
  const roadCache = new Map<
    string,
    { ink: string; body: string; light: string }
  >();
  function pixelRoad(edge: number) {
    const key = board.edges.length + ':' + edge;
    let road = roadCache.get(key);
    if (!road) {
      const a = point(board.edges[edge][0]),
        b = point(board.edges[edge][1]);
      road = {
        ink: linePixels(a, b, 2, 0, 0.17) + linePixels(a, b, 2, 1, 0.17),
        body: linePixels(a, b, 1, 0, 0.17),
        light: linePixels(a, b, 0, -1, 0.2),
      };
      roadCache.set(key, road);
    }
    return road;
  }
  const ownColor = $derived(
    pub.players.find((p) => p.id === playerId)?.color ?? 0,
  );
  const colorIndex = (id: string) =>
    pub.players.find((p: any) => p.id === id)?.color ?? 0;
  const center = (h: { q: number; r: number }) => [
    (2 * h.q + h.r) * tileX,
    3 * h.r * tileY,
  ];
  let bounds = $derived.by(() => {
    const xs = board.vertices.map((v: number[]) => v[0] * tileX),
      ys = board.vertices.map((v: number[]) => v[1] * tileY);
    return `${Math.min(...xs) - 58} ${Math.min(...ys) - 48} ${Math.max(...xs) - Math.min(...xs) + 116} ${Math.max(...ys) - Math.min(...ys) + 96}`;
  });
</script>

{#snippet pixelSprite(
  name: SpriteName,
  palette: Record<string, string>,
  x: number,
  y: number,
)}
  {@const sprite = sprites[name]}
  <g
    class="px-art"
    transform={`translate(${snap(x - (sprite.w * P) / 2)} ${snap(y - sprite.h * P)}) scale(${P})`}
    >{#each sprite.layers as layer}<path
        d={layer.d}
        fill={palette[layer.key]}
      />{/each}</g
  >
{/snippet}

{#snippet sheetSprite(
  url: string,
  index: number,
  cols: number,
  size: number,
  x: number,
  y: number,
  scale = size,
  tall = size,
)}
  <svg
    class="px-sheet"
    x={snap(x)}
    y={snap(y)}
    width={scale * P}
    height={(tall * scale * P) / size}
    viewBox={`${index * size} 0 ${size} ${tall}`}
    preserveAspectRatio="none"
    ><image
      class="px-sprite"
      href={url}
      width={cols * size}
      height={tall}
    /></svg
  >
{/snippet}

{#snippet pixelRoadArt(edge: number, fill: string)}
  {@const road = pixelRoad(edge)}
  <path d={road.ink} fill="#1a0f08" /><path d={road.body} {fill} /><path
    d={road.light}
    fill={shade(fill, 1.35)}
  />
{/snippet}

{#snippet pixelToken(x: number, y: number, n: number)}
  {@const hot = n === 6 || n === 8}
  <g class="px-token" aria-hidden="true">
    <path d={discPixels(x, y + P, 11)} fill="#1a0f0899" />
    <path d={discPixels(x, y, 11)} fill="#1a0f08" />
    <path d={discPixels(x, y, 10)} fill="#c9a66b" />
    <path d={discPixels(x - P, y - P, 9)} fill="#f6e7c8" />
    <text
      x={snap(x)}
      y={snap(y + 3.6 * P)}
      text-anchor="middle"
      fill={hot ? '#c8453a' : '#1a0f08'}>{n}</text
    >
    {#each Array(6 - Math.abs(7 - n)) as _, k}<rect
        x={snap(x) + (k * 2 - (6 - Math.abs(7 - n))) * P + P / 2}
        y={snap(y) + 5 * P}
        width={P}
        height={P}
        fill={hot ? '#c8453a' : '#1a0f08'}
      />{/each}
  </g>
{/snippet}

{#snippet ghost(action: any)}
  {#if pixel}
    {#if action.vertex !== undefined}
      {@const p = point(action.vertex)}
      {@render pixelSprite(
        action.type === 'BUILD_CITY' ? 'city' : 'settlement',
        ramp(colors[ownColor]),
        p[0],
        p[1] + 6 * P,
      )}
    {:else if action.edge !== undefined}
      {@render pixelRoadArt(action.edge, colors[ownColor])}
    {:else}
      {@const h = board.hexes[action.hex]}{@const c = center(h)}
      {@render pixelSprite(
        'robber',
        robberRamp,
        c[0] + (h.number ? 24 : 0),
        c[1] + (h.number ? 16 : 14),
      )}
    {/if}
  {:else if action.vertex !== undefined}
    {@const p = point(action.vertex)}
    <path
      transform={'translate(' + p[0] + ' ' + p[1] + ') scale(1.25)'}
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
        ((2 * h.q + h.r) * tileX + 17) +
        ' ' +
        (3 * h.r * tileY - 7) +
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
      rulesDialog?.close();
      root?.querySelectorAll('details[open]').forEach((panel) => {
        (panel as HTMLDetailsElement).open = false;
      });
    }
  }}
/>
<section
  bind:this={root}
  class="catan"
  class:px-tokens={pixel}
  class:ca-pixel={pixel}
  class:still={!motion || reduced}
  aria-label="CATAN"
  style:--ocean={'url("' + ocean + '")'}
  style:--wood-grain={'url("' + woodGrain + '")'}
  style:--px-table={pixel ? `url("${sheets.table}")` : undefined}
>
  <nav class="table-navigation" aria-label={m.catalog({}, { locale })}>
    <a href="/" onclick={() => onLeave?.()}
      ><span aria-hidden="true">←</span> {m.back({}, { locale })}</a
    >
    <button onclick={() => rulesDialog.showModal()}
      ><span aria-hidden="true">▤</span>
      {m.library_rules({}, { locale })}</button
    >
  </nav>
  <div class="table-utilities">
    {#if onInvite}<button onclick={onInvite}
        ><span aria-hidden="true">♟♟</span>
        {copied ? m.copied({}, { locale }) : m.invite({}, { locale })}</button
      >{:else}<span class="practice-label"
        >{m.catan_practice({}, { locale })}</span
      >{/if}
    <label class="table-language"
      ><span aria-hidden="true">◎</span><select
        aria-label={m.language({}, { locale })}
        value={locale}
        onchange={(e) => setLocale(e.currentTarget.value as Locale)}
        ><option value="en">EN</option><option value="es">ES</option></select
      ></label
    >
    <button
      class="settings-trigger"
      aria-label={m.catan_settings({}, { locale })}
      aria-expanded={settings}
      onclick={() => (settings = !settings)}
      ><span aria-hidden="true">⚙</span>
      <span class="settings-label">{m.catan_settings({}, { locale })}</span
      ></button
    >
    <span
      class="table-connection connection"
      class:online={connected}
      role="status"
      ><i></i>{connected
        ? m.connected({}, { locale })
        : m.disconnected({}, { locale })}</span
    >
  </div>
  <dialog
    class="rules-dialog"
    bind:this={rulesDialog}
    aria-label={m.library_rules({}, { locale })}
  >
    <button
      class="close-rules"
      aria-label={m.catan_cancel({}, { locale })}
      onclick={() => rulesDialog.close()}>×</button
    >
    {@render rulesContent?.()}
  </dialog>
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
      </div>
      <fieldset class="skin-choice">
        <legend>{m.skin({}, { locale })}</legend>
        {#each [['classic', m.skin_classic({}, { locale })], ['pixel', m.skin_pixel({}, { locale })]] as [value, text]}<label
            ><input
              type="radio"
              name="catan-skin"
              {value}
              checked={skin === value}
              onchange={() => {
                skin = value as Skin;
                setGameSkin('catan', skin);
              }}
            />{text}</label
          >{/each}
      </fieldset>
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
        {#if pixel}<div
            class="crest px-crest px-sprite"
            aria-hidden="true"
            style={cell(sheets.crests.url, p.color, sheets.crests.cols)}
          ></div>{:else}<div class="crest" aria-hidden="true">
            {crests[p.color]}
          </div>{/if}
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
          ><span class="points"
            ><b>{p.id === playerId ? priv.points : p.points}</b>
            {m.catan_points({}, { locale })}</span
          ><span
            >{p.resources}
            {m.catan_resources({}, { locale })} · {p.development}
            {m.catan_dev({}, { locale })}</span
          ></span
        >{#if p.id === playerId}<button
            class="seat-trade"
            aria-disabled={!canTrade()}
            onclick={() => openTrade()}
            aria-label={m.catan_trade({}, { locale })}
            >{m.catan_trade({}, { locale })}</button
          >{/if}
        {#if pub.longest === p.id || pub.army === p.id}<div class="awards">
            {#if pub.longest === p.id}<small
                >{#if pixel}<span
                    class="px-award px-sprite"
                    aria-hidden="true"
                    style={cell(sheets.crests.url, 6, sheets.crests.cols)}
                  ></span>{:else}<span aria-hidden="true">⚒</span>{/if}
                {m.catan_longest_route({}, { locale })}</small
              >{/if}{#if pub.army === p.id}<small
                >{#if pixel}<span
                    class="px-award px-sprite"
                    aria-hidden="true"
                    style={cell(sheets.crests.url, 7, sheets.crests.cols)}
                  ></span>{:else}<span aria-hidden="true">♟</span>{/if}
                {m.catan_largest_army({}, { locale })}</small
              >{/if}
          </div>{/if}
      </div>{/each}
  </div>
  {#each pub.players.filter( (p) => ['west', 'east'].includes(position(p.id)) ) as p}
    <div
      class="reserve"
      data-reserve-position={position(p.id)}
      aria-hidden="true"
    >
      <PieceReserve
        color={colors[p.color]}
        roads={15 - pub.roads.filter((owner) => owner === p.id).length}
        settlements={5 -
          pub.buildings.filter((b) => b && b.color === p.color && !b.city)
            .length}
        cities={4 -
          pub.buildings.filter((b) => b && b.color === p.color && b.city)
            .length}
      />
    </div>
  {/each}
  <BuildingCosts {locale} />
  <div class="dice-bowl" aria-label={m.catan_roll_dice({}, { locale })}>
    {#if pub.dice && !diceVisible}<Dice values={pub.dice} />{/if}
  </div>
  {#if pixel && pub.phase.type === 'finished'}
    {@const winner = pub.players.find((p) => p.id === pub.phase.winner)}
    <!-- 8-bit result banner; the phase line below still announces it. -->
    <div
      class="px-victory"
      aria-hidden="true"
      style={`--seat:${colors[winner?.color ?? 0]}`}
    >
      <span
        class="px-victory-crest px-sprite"
        style={cell(sheets.crests.url, winner?.color ?? 0, sheets.crests.cols)}
      ></span>
      <strong>{name(pub.phase.winner)} {m.catan_wins({}, { locale })}</strong>
      <small>{civilizations()[winner?.color ?? 0]}</small>
    </div>
  {/if}
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
        ><radialGradient id="robber-lacquer" cx=".3" cy=".2" r=".8"
          ><stop stop-color="#686252" /><stop
            offset=".4"
            stop-color="#262623"
          /><stop offset="1" stop-color="#080b0c" /></radialGradient
        ></defs
      >
      <!-- Pixel terrain is clipped, not patterned: pattern images ignore image-rendering. -->
      {#if pixel && pixelIsland}<defs
          >{#each pixelIsland.tiles as tile, i}<clipPath id={`px-tile-${i}`}
              ><path d={tile} /></clipPath
            >{/each}</defs
        >{:else}
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
      {/if}
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
        {#if pixel && pixelIsland}
          <!-- Keep the island bounds available to accepted dice effects. -->
          <g class="shore px-shore" aria-hidden="true">
            <path d={pixelIsland.foam} fill="#bfe9ef" />
            <path d={pixelIsland.sandShade} fill="#b8894a" />
            <path d={pixelIsland.sand} fill="#ecd08a" />
            <path d={pixelIsland.ink} fill="#1a0f08" />
          </g>
          {#each board.hexes as h, i}
            {@const c = center(h)}
            <g data-hex={i} class="px-hex">
              <g clip-path={`url(#px-tile-${i})`}
                >{@render sheetSprite(
                  sheets.terrain.url,
                  h.resource ?? 5,
                  sheets.terrain.cols,
                  sheets.terrain.w,
                  c[0] - 50,
                  c[1] - (sheets.terrain.h * P) / 2,
                  sheets.terrain.w,
                  sheets.terrain.h,
                )}</g
              >
              <path
                class="px-glow"
                d={pixelIsland.rings[i]}
                fill="#fff3a8"
                fill-rule="evenodd"
                opacity="0"
              />
              {#if h.number}{@render pixelToken(c[0], c[1], h.number)}{/if}
              {#if allowed('MOVE_ROBBER')}<text
                  class="px-hex-id"
                  x={c[0]}
                  y={c[1] + 33}
                  text-anchor="middle">#{i}</text
                >{/if}
              {#if pub.robber === i}<g
                  data-robber
                  aria-label={m.catan_robber({}, { locale })}
                  >{@render pixelSprite(
                    'robber',
                    robberRamp,
                    c[0] + (h.number ? 24 : 0),
                    c[1] + (h.number ? 16 : 14),
                  )}</g
                >{/if}
            </g>
          {/each}
        {:else}
          <!-- Keep the island bounds available to accepted dice effects. -->
          <g
            class="shore"
            fill="#dab57a"
            stroke="#f0d69d"
            stroke-width="9"
            stroke-linejoin="round"
            >{#each board.hexes as h}<polygon
                points={h.vertices
                  .map((v: number) => point(v).join(','))
                  .join(' ')}
              />{/each}</g
          >
          {#each board.hexes as h, i}
            <polygon
              data-hex={i}
              points={h.vertices
                .map((v: number) => point(v).join(','))
                .join(' ')}
              fill={`url(#terrain-${h.resource ?? 5})`}
              stroke="#f4da9c"
              stroke-width="3.5"
            />
            {#if h.number}<circle
                cx={(2 * h.q + h.r) * tileX}
                cy={3 * h.r * tileY}
                r="16"
                class="number-token"
                fill="#fff0cd"
              /><text
                x={(2 * h.q + h.r) * tileX}
                y={3 * h.r * tileY + 6}
                text-anchor="middle"
                fill={h.number === 6 || h.number === 8 ? '#b73428' : '#31291e'}
                font-size="18"
                font-weight="600">{h.number}</text
              >{/if}
            {#if allowed('MOVE_ROBBER')}<text
                x={(2 * h.q + h.r) * tileX}
                y={3 * h.r * tileY + 28}
                text-anchor="middle"
                font-size="10"
                fill="#fff">#{i}</text
              >{/if}{#if pub.robber === i}
              <g
                transform={'translate(' +
                  ((2 * h.q + h.r) * tileX + 17) +
                  ' ' +
                  (3 * h.r * tileY - 7) +
                  ')'}
                ><g data-robber aria-label={m.catan_robber({}, { locale })}>
                  <ellipse
                    cy="10"
                    rx="10"
                    ry="4"
                    fill="#172017"
                    opacity=".45"
                  />
                  <path
                    d="M-7 5Q-6-1-4-8H4Q6-1 7 5Q10 12 0 12Q-10 12-7 5Z"
                    fill="url(#robber-lacquer)"
                    stroke="#1b1d1a"
                    stroke-width=".8"
                  />
                  <ellipse cy="5" rx="7" ry="3" fill="url(#robber-lacquer)" />
                  <circle
                    cy="-12"
                    r="6"
                    fill="url(#robber-lacquer)"
                    stroke="#252822"
                    stroke-width=".7"
                  />
                </g></g
              >{/if}
          {/each}
        {/if}
        {#each board.ports as port}
          {@const ends = board.edges[port.edge]}{@const a = point(
            ends[0],
          )}{@const b = point(ends[1])}
          {@const cx = (a[0] + b[0]) / 2}{@const cy =
            (a[1] + b[1]) / 2}{@const length = Math.hypot(cx, cy) || 1}
          {#if pixel}
            {@const hx = snap(cx + (cx / length) * 36)}{@const hy = snap(
              cy + (cy / length) * 36,
            )}{@const wide = port.resource !== null}
            <g
              class="harbor px-harbor"
              aria-label={(port.resource === null
                ? m.catan_everyone({}, { locale })
                : names()[port.resource]) +
                ' ' +
                (port.resource === null ? '3:1' : '2:1')}
            >
              <path
                d={linePixels(
                  [cx, cy],
                  [cx + (cx / length) * 24, cy + (cy / length) * 24],
                  2,
                )}
                fill="#1a0f08"
              /><path
                d={linePixels(
                  [cx, cy],
                  [cx + (cx / length) * 24, cy + (cy / length) * 24],
                  1,
                )}
                fill="#9c6a3c"
              />
              <g class="px-bob"
                >{@render sheetSprite(
                  sheets.boat.url,
                  0,
                  1,
                  sheets.boat.size,
                  hx - 12 * P,
                  hy - 18 * P,
                )}</g
              >
              <rect
                x={hx - (wide ? 13 : 9) * P}
                y={hy + 5 * P}
                width={(wide ? 26 : 18) * P}
                height={11 * P}
                fill="#1a0f08"
              /><rect
                x={hx - (wide ? 12 : 8) * P}
                y={hy + 6 * P}
                width={(wide ? 24 : 16) * P}
                height={9 * P}
                fill={wide ? '#f2c14e' : '#f6e7c8'}
              />
              {#if port.resource !== null}{@render sheetSprite(
                  sheets.resourcesSmall.url,
                  port.resource,
                  sheets.resourcesSmall.cols,
                  sheets.resourcesSmall.size,
                  hx - 14 * P,
                  hy + 2 * P,
                )}{/if}
              <text
                class="px-rate"
                x={hx + (wide ? 5 : 0) * P}
                y={hy + 13.5 * P}
                text-anchor="middle"
                fill="#1a0f08">{wide ? '2:1' : '3:1'}</text
              >
            </g>
          {:else}
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
                  ') scale(1.2)'}
              >
                <path
                  d="M0-20 17-10 17 11 0 21-17 11-17-10Z"
                  fill="#083348"
                  stroke="#d8a95c"
                  stroke-width="2"
                />
                {#if port.resource === null}<path
                    d="m-12 1 5 4h14l5-4Z"
                    fill="#fff2cd"
                  /><path d="M0 0v-12L9-2H0" fill="#fff1cd" />{/if}
                <text
                  x="0"
                  y="15"
                  text-anchor="middle"
                  font-size="9"
                  font-weight="800"
                  fill="#fff1cd">{port.resource === null ? '3:1' : '2:1'}</text
                >
                {#if port.resource !== null}<image
                    x="-11"
                    y="-17"
                    width="22"
                    height="22"
                    href={resourceArtwork[port.resource]}
                  />{/if}
              </g>
            </g>
          {/if}
        {/each}
        {#each pub.roads as owner, e}{#if owner && pixel}<g
              data-piece={'road-' + e}
              ><g class="built px-built"
                >{@render pixelRoadArt(e, color(owner))}</g
              ></g
            >{:else if owner}{@const a = point(board.edges[e][0])}{@const b =
              point(board.edges[e][1])}<g data-piece={'road-' + e}
              ><line
                x1={a[0] * 0.86 + b[0] * 0.14 + 1}
                y1={a[1] * 0.86 + b[1] * 0.14 + 2}
                x2={b[0] * 0.86 + a[0] * 0.14 + 1}
                y2={b[1] * 0.86 + a[1] * 0.14 + 2}
                stroke={shade(color(owner), 0.55)}
                stroke-width="9"
                class="road-side"
              /><line
                x1={a[0] * 0.86 + b[0] * 0.14}
                y1={a[1] * 0.86 + b[1] * 0.14}
                x2={b[0] * 0.86 + a[0] * 0.14}
                y2={b[1] * 0.86 + a[1] * 0.14}
                class="built"
                stroke={color(owner)}
                stroke-width="8"
              /></g
            >{/if}{/each}
        {#each pub.buildings as building, v}{#if building && pixel}{@const p =
              point(v)}<g data-piece={'building-' + v}
              ><g class="built px-built"
                >{@render pixelSprite(
                  building.city ? 'city' : 'settlement',
                  ramp(colors[building.color]),
                  p[0],
                  p[1] + 6 * P,
                )}</g
              ></g
            >{:else if building}{@const p = point(v)}<g
              data-piece={'building-' + v}
              transform={'translate(' + p[0] + ' ' + p[1] + ') scale(1.25)'}
              ><path
                class="built"
                d={building.city
                  ? 'M -10 9 V -8 H -2 V -1 H 8 V 9 Z'
                  : 'M -8 8 V -2 L 0 -10 L 8 -2 V 8 Z'}
                fill={colors[building.color]}
                stroke={colors[building.color]}
                stroke-width=".5"
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
                d={building.city
                  ? 'M8-1 13-4V6L8 9ZM-10-8-5-11H3L-2-8ZM-2-1 3-4H13L8-1Z'
                  : 'M8-2 13-5V5L8 8ZM-8-2 0-10 5-13 13-5 8-2 0-10Z'}
                fill={shade(colors[building.color], 0.72)}
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
                      tileX,
                    3 * board.hexes[action.hex].r * tileY,
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
        {#each ['BUY_DEVELOPMENT', 'END_TURN'] as type}<button
            class:end-turn={type === 'END_TURN'}
            class:buy-development={type === 'BUY_DEVELOPMENT'}
            disabled={!allowed(type) || (type === 'END_TURN' && diceVisible)}
            onclick={() => {
              const action = legal.find((a) => a.type === type);
              if (action) send(action);
            }}
            >{#if pixel && type === 'BUY_DEVELOPMENT'}<span
                class="px-card-icon px-sprite"
                aria-hidden="true"
                style={cell(sheets.cards.url, 5, sheets.cards.cols)}
              ></span>{:else}<span aria-hidden="true"
                >{type === 'END_TURN' ? '▶' : '▱'}</span
              >{/if}{label({ type })}</button
          >{/each}
        {#each legal.filter( (a) => ['FINISH_ROADS', 'STEAL'].includes(a.type) ) as action}<button
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
            >{#if pixel}{@const icon =
                type === 'BUILD_CITY'
                  ? sprites.city
                  : type === 'BUILD_SETTLEMENT'
                    ? sprites.settlement
                    : null}<svg
                class="build-icon px-build-icon"
                viewBox="0 0 20 19"
                aria-hidden="true"
                shape-rendering="crispEdges"
                >{#if icon}<g
                    transform={`translate(${Math.floor((20 - icon.w) / 2)} ${19 - icon.h})`}
                    >{#each icon.layers as layer}<path
                        d={layer.d}
                        fill={ramp(colors[ownColor])[layer.key]}
                      />{/each}</g
                  >{:else}<path
                    d="M1 14h4v-2h4v-2h4v-2h4v-2h3v5h-4v2h-4v2h-4v2h-7z"
                    fill="#1a0f08"
                  /><path
                    d="M2 15h4v-2h4v-2h4v-2h4v-2h1v3h-4v2h-4v2h-4v2h-5z"
                    fill={colors[ownColor]}
                  />{/if}</svg
              >{:else}<svg
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
              </svg>{/if}{label({ type })}</button
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
          style={pixel
            ? cell(sheets.terrain.url, i, sheets.terrain.cols)
            : 'background-image:url(' + terrain[i] + ')'}
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
        {#if pixel}<span
            class="card-art px-sprite"
            style={cell(
              sheets.cards.url,
              developmentCell(kind),
              sheets.cards.cols,
            )}
          ></span>{:else}<img
            decoding="async"
            class="card-art"
            src={developmentBack}
            alt=""
          />{/if}
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
  .catan {
    --wood:
      linear-gradient(#24110630, #24110670), var(--wood-grain) center / cover;
    --gold: #b8884b;
    --card-width: clamp(66px, 6.55vw, 118px);
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #075e88 var(--ocean) center / cover no-repeat;
    color: #fff2d4;
    font-family: Georgia, 'Times New Roman', serif;
    isolation: isolate;
  }
  .catan::after {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 55px #071b2060;
    pointer-events: none;
    z-index: 1;
  }
  button,
  .table-navigation a,
  .table-language,
  .table-connection {
    background: var(--wood);
    color: #fff1d6;
    border: 1px solid var(--gold);
    border-radius: 5px;
    box-shadow:
      inset 0 0 0 2px #28150b,
      inset 0 0 0 3px #d09e5845,
      inset 0 2px 3px #ffd89c66,
      1px 3px 0 #25150e,
      0 5px 7px #0811168a;
    font:
      15px/1.15 Georgia,
      serif;
    text-shadow: 0 1px 2px #160b04;
    padding: 10px 13px;
    cursor: pointer;
  }
  button:hover:not(:disabled):not([aria-disabled='true']),
  .table-navigation a:hover {
    filter: brightness(1.16);
  }
  button:focus-visible,
  a:focus-visible,
  select:focus-visible {
    outline: 3px solid #ffe29b;
    outline-offset: 3px;
  }
  button:disabled,
  button[aria-disabled='true'] {
    opacity: 0.53;
    cursor: default;
  }
  button.chosen {
    border-color: #ffe6a1;
    box-shadow:
      inset 0 0 0 2px #634222,
      0 0 7px #ffe2a277;
  }
  .table-navigation {
    position: absolute;
    top: 1.1%;
    left: 1.2%;
    display: flex;
    gap: 10px;
    z-index: 7;
  }
  .table-navigation a {
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .table-navigation button {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .table-navigation span {
    font-size: 24px;
    line-height: 0.7;
  }
  .table-utilities {
    position: absolute;
    top: 1.1%;
    right: 1.1%;
    display: flex;
    align-items: stretch;
    gap: 8px;
    z-index: 7;
  }
  .table-utilities button,
  .table-language,
  .table-connection {
    font-size: clamp(11px, 0.95vw, 16px);
    padding: 9px 10px;
  }
  .table-utilities button > span[aria-hidden] {
    font-size: 21px;
    vertical-align: middle;
    color: #f1d594;
  }
  .table-language {
    display: flex;
    align-items: center;
    padding: 0 7px;
    gap: 4px;
  }
  .table-language select {
    appearance: none;
    width: auto;
    border: 0;
    background: transparent;
    color: #fff1d6;
    font: inherit;
    padding: 5px 0;
  }
  .table-language option {
    color: #302111;
  }
  .table-connection {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .table-connection i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ef6b49;
    box-shadow: 0 0 5px #ef6b4955;
  }
  .table-connection.online i {
    background: #46d767;
  }
  .practice-label {
    align-self: center;
    font-size: 11px;
    padding: 5px 8px;
    background: #15281bc9;
    border-radius: 3px;
    max-width: 120px;
  }
  .roster {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
  }
  .roster > div {
    position: absolute;
    width: 24%;
    min-height: 60px;
    padding: 8px 8px 8px 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 2px solid var(--seat);
    border-radius: 9px 6px 8px 5px;
    background: linear-gradient(
      110deg,
      color-mix(in srgb, var(--seat) 30%, #180b06),
      color-mix(in srgb, var(--seat) 12%, #170e0a)
    );
    box-shadow:
      inset 0 0 0 3px #281608,
      inset 0 0 0 4px #e2ab5755,
      inset 0 5px 9px #fff4c422,
      0 5px 0 #1c120dcc,
      0 9px 15px #031b2799;
    pointer-events: auto;
  }
  .roster > div::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 3px;
    bottom: 3px;
    width: 7px;
    border-radius: 4px;
    background: var(--seat);
    box-shadow: inset 1px 0 #fff7;
  }
  .roster .active {
    box-shadow:
      inset 0 0 0 3px #412a0e,
      inset 0 0 0 4px #ffe097b0,
      0 5px 0 #241909,
      0 0 14px #fff3b33b;
  }
  .roster [data-position='north'] {
    top: 0.3%;
    left: 36%;
    width: 28%;
  }
  .roster [data-position='south'] {
    bottom: 18.5%;
    left: 36%;
    width: 28%;
  }
  .roster [data-position='west'] {
    left: 1%;
    top: 39.5%;
  }
  .roster [data-position='east'] {
    right: 1%;
    top: 39.5%;
  }
  .roster [data-position='north-west'] {
    left: 23%;
    top: 7%;
    width: 24%;
  }
  .roster [data-position='north-east'] {
    right: 23%;
    top: 7%;
    width: 24%;
  }
  .extended [data-position='north'] {
    top: 1%;
    left: 38%;
    width: 24%;
  }
  .extended ~ .table {
    top: 15%;
  }
  .crest {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 43px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #120d0880;
    box-shadow:
      inset 0 1px 2px #fff3,
      0 1px 1px #eabe5744;
    color: var(--seat);
    font-size: 33px;
    text-shadow: 0 2px 1px #000;
  }
  .seat-identity {
    min-width: 0;
    flex: 1;
  }
  .civilization-name {
    font-weight: bold;
    font-size: clamp(13px, 1.03vw, 19px);
    line-height: 1.1;
  }
  .seat-name {
    background: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    padding: 2px 0 0;
    font:
      13px Georgia,
      serif;
    text-decoration: underline;
    text-underline-offset: 3px;
    color: #fff0ce;
  }
  .seat-stats {
    max-width: 125px;
    flex: 0 0 27%;
    font-size: clamp(9px, 0.8vw, 14px);
    line-height: 1.25;
  }
  .seat-stats > span {
    display: block;
  }
  .seat-stats > span:last-child {
    font-size: 0.85em;
  }
  .points b {
    font-size: 1.4em;
    font-weight: normal;
  }
  .seat-trade {
    order: 2;
    padding: 9px 11px;
    font-size: 15px;
    position: relative;
  }
  .awards {
    position: absolute;
    top: calc(100% + 4px);
    left: 10px;
    display: flex;
    gap: 6px;
  }
  .awards small {
    white-space: nowrap;
    color: #251b0d;
    padding: 6px 12px;
    background: linear-gradient(100deg, #e7ca8c, #fff2d0, #e3c487);
    border: 1px solid #bb9253;
    border-radius: 2px 5px 3px 2px;
    box-shadow: 2px 4px 5px #15100a70;
    font-size: clamp(10px, 1vw, 17px);
    font-weight: bold;
  }
  .awards small span {
    margin-right: 5px;
  }
  .roster [data-position='south'] .awards {
    left: calc(100% + 10px);
    top: 8px;
    flex-direction: column;
  }
  .phase {
    position: absolute;
    left: 28%;
    width: 44%;
    bottom: 0.6%;
    margin: 0;
    text-align: center;
    font-size: clamp(12px, 1.12vw, 19px);
    line-height: 1.15;
    text-shadow:
      0 2px 3px #000,
      0 0 10px #000;
    z-index: 4;
  }
  .table {
    position: absolute;
    inset: max(6%, 62px) 22% 25.5%;
  }
  .table > svg {
    width: 100%;
    height: 100%;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    filter: drop-shadow(0 7px 4px #042f46a0);
  }
  .table > svg text {
    font-family: Georgia, serif;
    text-shadow: none;
  }
  .number-token {
    stroke: #ba9756;
    stroke-width: 0.55;
    filter: drop-shadow(1px 2px 1px #2c251999);
  }
  .shore {
    filter: drop-shadow(0 2px 0 #80603d);
  }
  .harbor {
    filter: drop-shadow(1px 2px 1px #042737bb);
  }
  .road-side {
    filter: drop-shadow(1px 2px 1px #18241477);
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
    outline: 2px solid #ffe49d;
    outline-offset: 3px;
  }
  .placement-hint {
    opacity: 0;
  }
  .placement-hint.revealed {
    opacity: 0.45;
  }
  .target:hover + .placement-hint,
  .target:focus-visible + .placement-hint {
    opacity: 0.65;
  }
  .target.chosen + .placement-hint {
    opacity: 0;
  }
  .table > svg.zoomed {
    cursor: grab;
  }
  .table > svg.panning,
  .table > svg.panning .target {
    cursor: grabbing;
  }
  .zoom-controls {
    position: fixed;
    right: 2%;
    top: 31.5%;
    display: flex;
    gap: 4px;
    z-index: 3;
  }
  .zoom-controls button {
    font-size: 11px;
    padding: 5px 9px;
  }
  .reserve {
    position: absolute;
    width: 12%;
    height: 18%;
    top: 19%;
    pointer-events: none;
  }
  .reserve[data-reserve-position='west'] {
    left: 4%;
    transform: rotate(-13deg);
  }
  .reserve[data-reserve-position='east'] {
    right: 4%;
    transform: rotate(10deg);
    top: 23%;
  }
  .dice-bowl {
    position: absolute;
    right: 1.6%;
    top: 7.7%;
    width: 10.5%;
    aspect-ratio: 1;
    border: 13px ridge #714423;
    border-radius: 50%;
    background: repeating-radial-gradient(
      ellipse at center,
      #2c170e 0 4px,
      #482a19 6px,
      #311c11 10px
    );
    box-shadow:
      inset 3px 8px 15px #120907,
      inset -4px -3px 6px #a6723c,
      5px 10px 9px #06192399;
    display: grid;
    place-items: center;
    transform: rotate(12deg);
  }
  .dice-bowl :global(.dice) {
    gap: 12px;
    transform: scale(0.9);
  }
  .dice-bowl :global(.die) {
    transform: rotateX(-16deg) rotateY(20deg);
  }
  .board-dice {
    position: absolute;
    left: 55%;
    top: 57%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 5;
  }
  .controls {
    position: fixed;
    left: 1.4%;
    bottom: 5.6%;
    width: 26.5%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 4;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .controls > .actions:first-child {
    order: 2;
  }
  .controls .actions > button {
    min-height: clamp(35px, 5.7vh, 58px);
    font-size: clamp(11px, 1.1vw, 19px);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1;
    padding: 8px;
  }
  .controls .game-actions {
    display: grid;
    grid-template-columns: 1fr 0.95fr 1.25fr;
    gap: 9px;
  }
  .controls .game-actions > button {
    font-size: clamp(10px, 0.95vw, 17px);
    min-height: clamp(34px, 5.1vh, 49px);
    gap: 6px;
  }
  .controls .end-turn {
    order: 4;
    background:
      repeating-linear-gradient(176deg, #ffcf980c 0 1px, transparent 2px 6px),
      linear-gradient(130deg, #b13724, #76170f);
    border-color: #d76742;
  }
  .controls .buy-development {
    order: 3;
    background:
      repeating-linear-gradient(176deg, #ffcf980c 0 1px, transparent 2px 6px),
      linear-gradient(130deg, #235b39, #103724);
    border-color: #9caa69;
  }
  .controls .actions > .roll-button {
    background: linear-gradient(
      90deg,
      #a17c32 var(--charge),
      #694423 var(--charge)
    );
    position: relative;
    touch-action: none;
    user-select: none;
    overflow: hidden;
  }
  .charge-label {
    margin-left: 8px;
  }
  .build-icon,
  .market-icon {
    width: 23px;
    height: 23px;
    flex-shrink: 0;
    display: inline-block;
    vertical-align: middle;
  }
  .confirm {
    order: -1;
    background: #302010;
    border: 1px solid #e2bb79;
    border-radius: 5px;
    box-shadow: 0 5px 10px #08192399;
    padding: 10px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }
  .confirm b {
    flex: 1;
  }
  .hand {
    --card-step: min(
      calc(var(--card-width) + 12px),
      calc((46vw - var(--card-width)) / max(1, var(--stack-count) - 1))
    );
    position: absolute;
    bottom: 3.1%;
    left: 30.3%;
    display: grid;
    grid-template-columns: repeat(var(--stack-count), var(--card-step));
    width: max-content;
    align-items: end;
    gap: 0;
    z-index: 4;
  }
  .resource-card {
    width: var(--card-width);
    height: clamp(105px, 14.5vh, 164px);
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    border: 5px solid #ebdab7;
    border-radius: 8px 6px 7px 9px;
    background: linear-gradient(110deg, #f3e7c8, #fff7df 55%, #dfcca6);
    color: #302719;
    box-shadow:
      inset 0 0 0 1px #ad9a76,
      0 2px 0 #9d8767,
      0 4px 0 #eee0c3,
      0 6px 0 #9d8767,
      0 8px 0 #dacaad,
      2px 11px 5px #19100bb3;
    transform: rotate(var(--tilt, -3deg));
    overflow: visible;
    padding: 2px;
  }
  .resource-card:nth-child(1) {
    --tilt: -5deg;
  }
  .resource-card:nth-child(2) {
    --tilt: -4deg;
  }
  .resource-card:nth-child(3) {
    --tilt: -2deg;
  }
  .resource-card:nth-child(4) {
    --tilt: -3deg;
  }
  .resource-card:nth-child(5) {
    --tilt: -5deg;
  }
  .card-title {
    font-size: clamp(11px, 1vw, 17px);
    font-weight: bold;
    padding: 2px 0 5px;
    line-height: 1.1;
    white-space: nowrap;
  }
  .card-art {
    flex: 1;
    min-height: 0;
    width: 100%;
    background-position: center;
    background-size: cover;
    border: 1px solid #a39365;
    border-radius: 3px;
    position: relative;
    isolation: isolate;
  }
  .card-art::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(#fff6d340, #f4e4bebb);
    z-index: -1;
  }
  .card-art :global(.resource-art) {
    width: 100%;
    height: 100%;
  }
  .card-footer {
    display: none;
  }
  .quantity {
    position: absolute;
    right: -3px;
    bottom: 5px;
    z-index: 2;
    min-width: 27px;
    height: 29px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid #8e7854;
    background: #fff4d6;
    box-shadow:
      inset 0 0 0 2px #f8ebca,
      inset 0 0 0 3px #beac82,
      1px 2px 3px #382915aa;
    font-size: 20px;
    font-weight: normal;
    color: #282617;
  }
  .empty {
    filter: saturate(0.65);
  }
  .empty .quantity {
    color: #706953;
  }
  .development-card {
    flex-shrink: 0;
    background: linear-gradient(125deg, #173c4f, #072c41);
    border-color: #e2d1aa;
    cursor: pointer;
    margin-left: 9px;
  }
  .development-card .card-title {
    color: #fce5a6;
    font-size: clamp(9px, 0.8vw, 14px);
    white-space: normal;
    text-shadow: none;
  }
  .development-card .card-art {
    object-fit: cover;
    border-color: #c5a04e;
  }
  .development-card .quantity {
    bottom: auto;
    top: -9px;
  }
  .resource-card:hover,
  .resource-card:focus-visible {
    z-index: 5;
  }
  .development-card:hover {
    transform: translateY(-12px) rotate(-2deg);
  }
  .panels {
    display: none;
  }
  .panels.panel-open {
    display: block;
    position: absolute;
    right: 20px;
    bottom: 20px;
    width: min(440px, calc(100vw - 24px));
    max-height: 65dvh;
    overflow-y: auto;
    padding: 20px;
    background: linear-gradient(120deg, #183e48f9, #082733fa);
    border: 3px ridge #b99155;
    border-radius: 7px;
    box-shadow: 0 15px 45px #001726aa;
    z-index: 9;
  }
  .panels h3 {
    font:
      bold 22px Georgia,
      serif;
    margin: 0 25px 16px 0;
    color: #f5d99b;
  }
  .panels p,
  .settings-menu p {
    font-size: 13px;
  }
  .close-panel {
    float: right;
    font-size: 20px;
    padding: 5px 10px;
  }
  .quantities {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 5px;
    margin: 10px 0;
  }
  .quantities label,
  .trade-resource {
    min-width: 0;
    text-align: center;
    padding: 5px 2px 10px;
    background: #fff1dc09;
    border-radius: 6px;
    font-size: 12px;
  }
  .quantities span {
    display: grid;
    gap: 3px;
  }
  .quantities input {
    width: 100%;
    max-width: 54px;
    text-align: center;
    margin: 3px 0 8px;
  }
  input,
  select {
    color: #322411;
    padding: 5px;
  }
  form {
    padding: 8px 0;
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
  .resource-icon :global(.resource-art),
  .exchange-icon :global(.resource-art) {
    width: 100%;
    height: 100%;
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
  .offer-resources :global(.resource-art) {
    width: 24px;
    height: 24px;
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
    min-width: 24px;
    height: 30px;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: #ffe0a0;
    font-size: 24px;
    font-weight: bold;
  }
  .stepper output {
    min-width: 17px;
    font-size: 15px;
    color: #ffe2a2;
  }
  .open-offer-button {
    position: relative;
  }
  .trade-tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    width: 210px;
    padding: 9px 12px;
    border: 1px solid #c7ab70;
    border-radius: 5px;
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
  button:focus-visible > .trade-tooltip {
    display: block;
  }
  .settings-menu {
    position: absolute;
    right: 16px;
    top: 62px;
    width: min(370px, calc(100vw - 32px));
    max-height: calc(100dvh - 80px);
    overflow: auto;
    background: #10313efc;
    border: 3px ridge #b99155;
    border-radius: 6px;
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
  .preferences {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 18px 0;
  }
  .preferences button[aria-pressed='true'] {
    border-color: #f3d79b;
  }
  .skin-choice {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin: 0 0 14px;
    padding: 8px 12px 10px;
    border: 1px solid #b9915580;
    border-radius: 5px;
    font-size: 14px;
  }
  .skin-choice legend {
    padding: 0 4px;
    font-size: 13px;
    font-weight: bold;
  }
  .skin-choice label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  summary {
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    padding: 7px 0;
  }
  details {
    padding: 3px 0;
  }
  .rules-dialog {
    width: min(1000px, calc(100vw - 32px));
    max-height: calc(100dvh - 60px);
    padding: 25px;
    border: 5px ridge #ac814b;
    border-radius: 8px;
    background: #f7edd4;
    color: #342814;
  }
  .rules-dialog::backdrop {
    background: #081b23bb;
  }
  .close-rules {
    position: sticky;
    top: 0;
    float: right;
    z-index: 2;
    font-size: 22px;
  }
  .still :global(*) {
    animation: none !important;
    transition: none !important;
  }
  @media (min-width: 701px) {
    .panels[data-trade-anchor='west'] {
      left: 4%;
      right: auto;
      top: 49%;
      bottom: auto;
      max-height: 48dvh;
    }
    .panels[data-trade-anchor='east'] {
      right: 4%;
      top: 49%;
      bottom: auto;
      max-height: 48dvh;
    }
    .panels[data-trade-anchor^='north'] {
      top: 90px;
      bottom: auto;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
    }
    .panels[data-trade-anchor='south'] {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      bottom: 20%;
    }
  }
  @media (min-width: 701px) and (max-width: 1400px) {
    .table-navigation,
    .table-utilities {
      gap: 5px;
    }
    .table-navigation a,
    .table-navigation button {
      font-size: 12px;
      padding: 9px;
    }
    .table-utilities button,
    .table-connection {
      padding: 8px 6px;
      font-size: 11px;
    }
    .table-utilities .practice-label {
      display: none;
    }
    .roster > div {
      padding-left: 46px;
      gap: 6px;
      min-height: 53px;
    }
    .roster [data-position='north'],
    .roster [data-position='south'] {
      width: 30%;
      left: 35%;
    }
    .crest {
      width: 29px;
      height: 34px;
      left: 11px;
      font-size: 25px;
    }
    .civilization-name {
      font-size: 13px;
      white-space: normal;
    }
    .seat-name {
      font-size: 11px;
    }
    .seat-trade {
      padding: 8px 7px;
      font-size: 12px;
    }
    .seat-stats {
      flex-basis: 31%;
      font-size: 10px;
    }
    .table {
      inset: max(9%, 72px) 20% 27%;
    }
    .controls {
      width: 27%;
      gap: 8px;
    }
    .controls .game-actions {
      gap: 5px;
    }
    .build-icon,
    .market-icon {
      width: 17px;
      height: 17px;
    }
    .hand {
      left: 30%;
    }
    .dice-bowl {
      border-width: 9px;
    }
    .dice-bowl :global(.dice) {
      transform: scale(0.6);
    }
  }
  @media (max-width: 700px) {
    .catan {
      --card-width: clamp(43px, 12vw, 65px);
      background-position: center;
    }
    .table-navigation {
      top: 8px;
      left: 8px;
      gap: 5px;
    }
    .table-navigation a,
    .table-navigation button {
      font-size: 10px;
      padding: 8px;
      min-height: 33px;
    }
    .table-navigation span {
      font-size: 16px;
    }
    .table-utilities {
      top: 8px;
      right: 8px;
      gap: 5px;
    }
    .table-utilities button {
      font-size: 10px;
      padding: 6px;
    }
    .table-utilities > button:first-child > span {
      display: none;
    }
    .table-language {
      font-size: 11px;
      padding: 0 4px;
    }
    .table-language > span,
    .settings-label,
    .table-connection,
    .practice-label {
      display: none;
    }
    .table-utilities .settings-trigger > span[aria-hidden] {
      display: inline;
      font-size: 18px;
    }
    .roster > div {
      width: calc(50% - 16px);
      min-height: 51px;
      padding: 6px 6px 6px 34px;
      gap: 4px;
      border-width: 1px;
    }
    .crest {
      width: 23px;
      height: 27px;
      font-size: 21px;
      left: 7px;
    }
    .civilization-name {
      font-size: 11px;
      white-space: normal;
    }
    .seat-name {
      font-size: 10px;
    }
    .seat-stats {
      font-size: 9px;
      flex-basis: 33%;
      line-height: 1.2;
    }
    .seat-trade {
      position: absolute;
      right: 5px;
      bottom: -24px;
      padding: 5px 8px;
      font-size: 10px;
    }
    .roster [data-position='north'] {
      top: 52px;
      left: 22%;
      width: 56%;
    }
    .roster [data-position='west'] {
      top: 125px;
      left: 8px;
    }
    .roster [data-position='east'] {
      top: 125px;
      right: 8px;
    }
    .roster [data-position='south'] {
      left: 8px;
      bottom: 26%;
      width: calc(100% - 16px);
      transform: none;
      min-height: 44px;
    }
    .roster [data-position='south'] .seat-trade {
      position: relative;
      right: auto;
      bottom: auto;
    }
    .roster [data-position='south'] .awards {
      left: auto;
      right: 0;
      top: -23px;
      flex-direction: row;
    }
    .awards {
      gap: 3px;
      top: -22px;
    }
    .awards small {
      padding: 3px 5px;
      font-size: 9px;
    }
    .roster [data-position='north-west'] {
      left: 8px;
      top: 52px;
      width: calc(50% - 16px);
    }
    .roster [data-position='north-east'] {
      right: 8px;
      top: 52px;
      width: calc(50% - 16px);
    }
    .extended [data-position='north'] {
      top: 123px;
      left: 30%;
      width: 40%;
    }
    .extended [data-position='west'],
    .extended [data-position='east'] {
      top: 197px;
    }
    .extended ~ .table {
      top: 33%;
    }
    .table {
      inset: 25% 0 32%;
    }
    .zoom-controls {
      position: absolute;
      top: 5px;
      right: 8px;
      gap: 3px;
    }
    .zoom-controls button {
      font-size: 9px;
      padding: 3px 6px;
    }
    .reserve,
    .dice-bowl {
      display: none;
    }
    .controls {
      left: 8px;
      right: 8px;
      width: auto;
      bottom: 12%;
      gap: 5px;
    }
    .controls .game-actions {
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .controls .game-actions > button,
    .controls .actions > button {
      min-height: 28px;
      padding: 5px;
      font-size: 10px;
      gap: 4px;
    }
    .controls > .actions:first-child {
      gap: 4px;
    }
    .build-icon,
    .market-icon {
      width: 14px;
      height: 14px;
    }
    .controls:has(.confirm) {
      z-index: 7;
    }
    .confirm {
      padding: 6px;
      font-size: 11px;
    }
    .confirm button {
      font-size: 12px;
      padding: 6px;
    }
    .hand {
      --card-step: min(
        calc(var(--card-width) + 9px),
        calc((95vw - var(--card-width)) / max(1, var(--stack-count) - 1))
      );
      left: 4%;
      bottom: 3.3%;
    }
    .resource-card {
      height: 8vh;
      min-height: 62px;
      border-width: 3px;
      padding: 1px;
      border-radius: 4px;
    }
    .card-title {
      font-size: 10px;
      padding-bottom: 2px;
    }
    .quantity {
      min-width: 19px;
      height: 21px;
      font-size: 14px;
      right: -4px;
      bottom: 0;
    }
    .development-card .card-title {
      font-size: 8px;
    }
    .phase {
      font-size: 11px;
      left: 4%;
      width: 92%;
      bottom: 0.6%;
    }
    .panels.panel-open {
      bottom: 8px;
      right: 8px;
      width: calc(100% - 16px);
      max-height: 70dvh;
      padding: 14px;
    }
    .settings-menu {
      top: 50px;
    }
    .rules-dialog {
      padding: 15px;
    }
  }
  @media (min-width: 701px) and (max-width: 1100px) {
    .roster [data-position='west'],
    .roster [data-position='east'] {
      width: 19%;
      flex-wrap: wrap;
      padding-left: 38px;
      min-height: 80px;
    }
    .roster [data-position='west'] .seat-identity,
    .roster [data-position='east'] .seat-identity {
      flex-basis: 100%;
    }
    .roster [data-position='west'] .seat-stats,
    .roster [data-position='east'] .seat-stats {
      flex-basis: 60%;
    }
    .roster [data-position='west'] .seat-trade,
    .roster [data-position='east'] .seat-trade {
      position: absolute;
      right: 6px;
      bottom: 7px;
      padding: 6px;
    }
    .roster [data-position='north'],
    .roster [data-position='south'] {
      width: 34%;
      left: 33%;
    }
    .seat-stats {
      font-size: 9px;
    }
    .table-navigation a,
    .table-navigation button {
      font-size: 10px;
      padding: 7px;
    }
    .table-navigation span {
      font-size: 18px;
    }
    .table-utilities .settings-label {
      display: none;
    }
    .table-utilities > button:first-child {
      font-size: 10px;
    }
    .table-utilities > button:first-child > span {
      display: none;
    }
    .table-connection {
      font-size: 9px;
    }
    .extended [data-position='north'] {
      top: 2%;
    }
    .extended [data-position='north-west'],
    .extended [data-position='north-east'] {
      top: 11%;
    }
    .extended ~ .table {
      top: 20%;
    }
  }
  @media (max-height: 620px) and (min-width: 701px) {
    .roster > div {
      min-height: 43px;
      padding-top: 5px;
      padding-bottom: 5px;
    }
    .table {
      top: 10%;
      bottom: 25%;
    }
    .roster [data-position='south'] {
      bottom: 21%;
    }
    .resource-card {
      height: 15vh;
    }
    .controls {
      bottom: 6%;
      gap: 6px;
    }
    .controls .game-actions > button,
    .controls .actions > button {
      min-height: 30px;
      padding: 6px;
      font-size: 11px;
    }
    .card-title {
      font-size: 11px;
    }
    .hand {
      bottom: 4%;
    }
    .phase {
      font-size: 12px;
    }
  }
</style>
