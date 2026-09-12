<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { Locale } from '@board-games/shared/runtime';
  import {
    tiles,
    modules,
    presets,
    rotatePoint,
    type Module,
  } from './tiles.js';
  import { node, split, points, type Feature } from './features.js';
  import type { View, Option } from './index.js';
  import TileArt from './TileArt.svelte';
  import {
    colors,
    meeplePath,
    cityPath,
    roadPath,
    fieldPath,
    ferryPath,
  } from './art.js';
  import { label } from './labels.js';
  import { tableAudio, EventGate } from './effects.js';
  import {
    featureOwners,
    playerOverviews,
    scoreSources,
    watchedFeatures,
    type FeatureScope,
    type ScoreSource,
  } from './overview.js';
  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    settingsContent,
    canConfigure = true,
    practice = false,
  }: {
    view: View;
    playerId: string;
    players: { id: string; name: string; connected?: boolean }[];
    send: (a: unknown) => void;
    locale?: Locale;
    round?: number;
    connected?: boolean;
    settingsContent?: Snippet;
    canConfigure?: boolean;
    practice?: boolean;
  } = $props();
  const p = $derived(view.public);
  const t = (k: string) => label(k, locale);
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const who = $derived(p.pending?.actor ?? p.active);
  const mine = $derived(
    who === playerId &&
      connected &&
      players.find((v) => v.id === who)?.connected !== false,
  );
  let visualRotation = $state(0);
  let rotation = $state(0),
    preview = $state<{ x: number; y: number } | null>(null),
    selected = $state(''),
    journal = $state(false),
    guide = $state(false),
    overview = $state(false),
    overviewScope = $state<FeatureScope>('mine'),
    sound = $state(true);
  let cx = $state(50),
    cy = $state(50),
    scale = $state(0.9),
    width = $state(800),
    height = $state(600);
  let map: SVGSVGElement;
  let settingsDialog: HTMLDialogElement;
  let guideDialog: HTMLDialogElement;
  let overviewDialog: HTMLDialogElement;
  let settings = $state(false);
  const audio = tableAudio(),
    gate = new EventGate();
  let ferryPreview = $state<{ tile: string; pair: [string, string] } | null>(
    null,
  );
  let recent = $state<string[]>([]);
  let receipts = $state<{ id: number; player: string; points: number }[]>([]);
  let recentTimer: ReturnType<typeof setTimeout>;
  const locations = $derived([
    ...new Map(
      view.private.placements.map((v) => [`${v.x},${v.y}`, { x: v.x, y: v.y }]),
    ).values(),
  ]);
  const valid = $derived(
    !!preview &&
      view.private.placements.some(
        (v) =>
          v.x === preview!.x && v.y === preview!.y && v.rotation === rotation,
      ),
  );
  const feature = $derived(
    p.features.find((f) => f.nodes.includes(selected) || f.id === selected),
  );
  const overviewPlayers = $derived(
    playerOverviews(
      p,
      players.map((player) => player.id),
    ),
  );
  const overviewFeatures = $derived(
    watchedFeatures(p.features, playerId, overviewScope),
  );
  const options = $derived(
    p.pending?.options.filter(
      (o) =>
        !selected ||
        !o.target ||
        o.target === selected ||
        feature?.nodes.includes(o.target) ||
        o.target === split(selected).tile,
    ) || [],
  );
  function unlock() {
    if (sound) audio.unlock();
  }
  function rotate(n: number) {
    unlock();
    rotation = (rotation + n + 4) % 4;
    visualRotation += n;
    if (sound) audio.play('rotate');
  }
  function selectLocation(x: number, y: number) {
    unlock();
    if (
      !mine ||
      tool !== 'tile' ||
      !locations.some((v) => v.x === x && v.y === y)
    )
      return;
    preview = { x, y };
    if (
      !view.private.placements.some(
        (v) => v.x === x && v.y === y && v.rotation === rotation,
      )
    )
      rotation = view.private.placements.find(
        (v) => v.x === x && v.y === y,
      )!.rotation;
    visualRotation = rotation;
    selected = '';
  }
  function place() {
    if (valid && mine)
      send({ type: 'place', turn: p.turn, ...preview, rotation });
  }
  function choose(o: Option) {
    unlock();
    send({ type: 'choose', prompt: p.pending!.id, choice: o.id });
  }
  function next(n = 1) {
    if (!mine || p.phase !== 'place' || !locations.length) return;
    tool = 'tile';
    const i = locations.findIndex(
      (v) => v.x === preview?.x && v.y === preview?.y,
    );
    const v = locations[(i + n + locations.length) % locations.length];
    selectLocation(v.x, v.y);
    cx = v.x * 100 + 50;
    cy = v.y * 100 + 50;
  }
  function zoom(factor: number, x = width / 2, y = height / 2) {
    const old = scale;
    scale = Math.max(0.22, Math.min(2.5, scale * factor));
    cx += (x - width / 2) * (1 / old - 1 / scale);
    cy += (y - height / 2) * (1 / old - 1 / scale);
  }
  function focus(k: string | null) {
    if (!k) return;
    const [x, y] = k.split(',').map(Number);
    cx = x * 100 + 50;
    cy = y * 100 + 50;
    scale = Math.max(scale, 0.7);
  }
  function fit() {
    const list = Object.values(p.board);
    if (!list.length) return;
    const minX = Math.min(...list.map((v) => v.x)) * 100,
      minY = Math.min(...list.map((v) => v.y)) * 100,
      maxX = (Math.max(...list.map((v) => v.x)) + 1) * 100,
      maxY = (Math.max(...list.map((v) => v.y)) + 1) * 100;
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
    scale = Math.max(
      0.22,
      Math.min(
        1.2,
        (width - 120) / (maxX - minX),
        (height - 120) / (maxY - minY),
      ),
    );
  }
  const pointers = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0 },
    dragged = false,
    previousDistance = 0;
  function down(e: PointerEvent) {
    if ((e.target as Element).closest('[data-preview]') && mine) {
      beginDrag('tile', e);
      return;
    }
    if (drag) return;
    unlock();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY };
    dragged = false;
    previousDistance = 0;
    map.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (drag) return;
    const old = pointers.get(e.pointerId);
    if (!old) return;
    const dx = e.clientX - old.x,
      dy = e.clientY - old.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
      dragged = true;
    const list = [...pointers.values()];
    if (list.length === 2) {
      dragged = true;
      const distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const r = map.getBoundingClientRect();
      if (previousDistance)
        zoom(
          distance / previousDistance,
          (list[0].x + list[1].x) / 2 - r.left,
          (list[0].y + list[1].y) / 2 - r.top,
        );
      previousDistance = distance;
    } else {
      cx -= dx / scale;
      cy -= dy / scale;
    }
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    previousDistance = 0;
    if (dragged || drag) return;
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('[data-location],[data-region]');
    const loc = el?.getAttribute('data-location'),
      ref = el?.getAttribute('data-region');
    if (loc) {
      const [x, y] = loc.split(',').map(Number);
      selectLocation(x, y);
    } else if (ref) {
      const choice = pieceOptions.find((o) => o.target === ref);
      if (choice) choose(choice);
      else selected = selected === ref ? '' : ref;
    }
  }
  function keyboard(e: KeyboardEvent) {
    if ((e.target as Element)?.matches('input,select,button')) return;
    if (
      e.key.toLowerCase() === 'r' &&
      mine &&
      p.phase === 'place' &&
      tool === 'tile'
    ) {
      e.preventDefault();
      rotate(e.shiftKey ? -1 : 1);
    } else if (
      ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)
    ) {
      e.preventDefault();
      next(e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      place();
    } else if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1 / 1.2);
  }
  function config(config: typeof p.config) {
    if (!canConfigure) return;
    send({ type: 'config', version: p.setupVersion, config });
  }
  const setupIcons: Record<string, string> = {
    farmers: '❧',
    river: '≋',
    abbot: '✣',
    inns: '⌂',
    traders: '⚒',
    flight: '↗',
    messages: '✉',
    ferries: '⌁',
    gold: '◆',
    magic: '✦',
    robbers: '♟',
    crops: '◎',
    meeple: '♟',
    farmer: '♟',
    large: '♛',
    builder: '⌂',
    pig: '♞',
  };
  const setupOptions = ['farmers', ...modules] as const;
  const figureGuide = ['meeple', 'farmer', 'large', 'abbot', 'builder', 'pig'];
  const moduleActive = (id: string) =>
    id === 'farmers'
      ? p.config.farmers
      : p.config.modules.includes(id as Module);
  const guideModules = $derived(
    [...setupOptions].sort(
      (a, b) => Number(moduleActive(b)) - Number(moduleActive(a)),
    ),
  );
  const figureActive = (id: string) =>
    id === 'meeple' ||
    (id === 'farmer' && p.config.farmers) ||
    (id === 'large' && p.config.modules.includes('inns')) ||
    (id === 'abbot' && p.config.modules.includes('abbot')) ||
    ((id === 'builder' || id === 'pig') &&
      p.config.modules.includes('traders'));
  const overviewScopes: FeatureScope[] = ['mine', 'rivals', 'unclaimed'];
  const goodsIcons = ['♧', '♨', '▧'];
  const goodsLabels = ['wine', 'grain', 'cloth'];
  const featureIcons: Record<Feature['kind'], string> = {
    city: '♜',
    road: '⌁',
    field: '❧',
    monastery: '⌂',
    garden: '✿',
    river: '≋',
  };
  function scoreSourceLabel(source: ScoreSource) {
    return t(
      source === 'sanctuary'
        ? 'sanctuary'
        : source === 'bonus'
          ? 'bonus_points'
          : source,
    );
  }
  function focusFeature(value: Feature) {
    selected = value.id;
    focus(split(value.id).tile);
    overview = false;
    requestAnimationFrame(() => map?.focus({ preventScroll: true }));
  }
  function toggleModule(id: (typeof setupOptions)[number]) {
    if (!canConfigure) return;
    if (id === 'farmers') config({ ...p.config, farmers: !p.config.farmers });
    else
      config({
        ...p.config,
        modules: p.config.modules.includes(id)
          ? p.config.modules.filter((v) => v !== id)
          : [...p.config.modules, id],
      });
  }
  function optionLabel(o: Option) {
    const ref =
      o.target &&
      p.features.find((f) => f.nodes.includes(o.target!) || f.id === o.target);
    let text = t(
      o.kind === 'skip' && p.pending?.kind !== 'deploy'
        ? 'continue'
        : o.kind === 'deploy'
          ? o.figure!
          : o.kind,
    );
    if (o.kind === 'marker') text = t(o.value === 1 ? 'courier' : 'marker');
    if (o.attachment) text += ' + ' + t(o.attachment);
    if (ref) text += ' · ' + t(ref.kind);
    if (o.target && o.target.includes(','))
      text += ' (' + split(o.target).tile + ')';
    if (o.kind === 'ferry')
      text +=
        ' ' +
        String(o.value)
          .split(':')
          .map((v) => Number(v.slice(1)) + 1)
          .join(' ↔ ');
    if (o.kind === 'robber') text += ' · ' + o.value;
    if (o.points !== undefined) text += ' · ' + o.points + ' ' + t('points');
    return text;
  }
  const choiceIdentity = $derived(
    `${round}:${p.turn}:${p.phase}:${p.pending?.id ?? ''}`,
  );
  $effect(() => {
    choiceIdentity;
    preview = null;
    rotation = 0;
    visualRotation = 0;
    selected = '';
    ferryPreview = null;
    tool = null;
    attachment = undefined;
    drag = null;
    clearTimeout(returnTimer);
  });
  $effect(() => {
    const events = gate.take(round, p.events, connected);
    audio.mute(!sound);
    if (events.length) {
      audio.events(events);
      receipts = events
        .filter((e) => e.points && e.player)
        .map((e) => ({ id: e.id, player: e.player!, points: e.points! }));
      recent = events.filter((e) => e.target).map((e) => split(e.target!).tile);
      clearTimeout(recentTimer);
      recentTimer = setTimeout(() => {
        recent = [];
        receipts = [];
      }, 2400);
    }
  });
  $effect(() => {
    if (settings) settingsDialog?.showModal();
    else settingsDialog?.close();
  });
  $effect(() => {
    if (guide) guideDialog?.showModal();
    else guideDialog?.close();
  });
  $effect(() => {
    if (overview) overviewDialog?.showModal();
    else overviewDialog?.close();
  });
  $effect(() => {
    round;
    overview = false;
    overviewScope = 'mine';
    cx = 50;
    cy = 50;
    scale = 0.9;
  });
  onMount(() => {
    try {
      sound = localStorage.getItem('carcassonne:sound') !== 'off';
    } catch {}
    const observer = new ResizeObserver((entries) => {
      width = entries[0].contentRect.width;
      height = entries[0].contentRect.height;
    });
    observer.observe(map);
    return () => {
      observer.disconnect();
      audio.close();
      clearTimeout(recentTimer);
      clearTimeout(returnTimer);
    };
  });
  function toggleSound() {
    sound = !sound;
    audio.mute(!sound);
    if (sound) audio.unlock();
    try {
      localStorage.setItem('carcassonne:sound', sound ? 'on' : 'off');
    } catch {}
  }

  type Piece = 'meeple' | 'large' | 'abbot';
  let tool = $state<'tile' | Piece | null>(null);
  let attachment = $state<'builder' | 'pig' | undefined>(undefined);
  let drag = $state<{
    kind: 'tile' | Piece;
    x: number;
    y: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointer: number;
    moved: boolean;
    returning: boolean;
    identity: string;
  } | null>(null);
  let returnTimer: ReturnType<typeof setTimeout>;
  let suppressClick = false;
  const pieceOptions = $derived(
    mine && tool && tool !== 'tile'
      ? (p.pending?.options.filter(
          (o) =>
            o.kind === 'deploy' &&
            o.figure === tool &&
            o.attachment === attachment,
        ) ?? [])
      : [],
  );
  const legalRefs = $derived(new Set(pieceOptions.map((o) => o.target)));
  const normalChoice = $derived(
    p.pending?.kind === 'deploy' ||
      p.pending?.kind === 'landing' ||
      (p.pending?.kind === 'crop' &&
        p.pending.options.some((o) => o.kind === 'deploy')),
  );
  const ownIndex = $derived(Math.max(0, p.players.indexOf(playerId)));
  const ownColor = $derived(colors[ownIndex]);
  const figureTypes = $derived([
    'meeple',
    ...(p.config.modules.includes('inns') ? ['large'] : []),
    ...(p.config.modules.includes('abbot') ? ['abbot'] : []),
  ] as Piece[]);
  const previewPosition = $derived(
    preview
      ? {
          x: (preview.x * 100 + 50 - cx) * scale + width / 2,
          y: (preview.y * 100 + 100 - cy) * scale + height / 2,
        }
      : null,
  );
  function available(type: Piece) {
    return (
      (type === 'meeple' ? 7 : 1) -
      p.figures.filter((f) => f.owner === playerId && f.type === type).length
    );
  }
  function usable(type: Piece) {
    return (
      mine &&
      normalChoice &&
      !!p.pending?.options.some((o) => o.kind === 'deploy' && o.figure === type)
    );
  }
  function seatPosition(i: number) {
    const n = players.length,
      relative = (i - ownIndex + n) % n;
    const positions: Record<number, number[][]> = {
      2: [
        [50, 96],
        [50, 8],
      ],
      3: [
        [50, 96],
        [19, 14],
        [81, 14],
      ],
      4: [
        [50, 96],
        [9, 50],
        [50, 8],
        [91, 50],
      ],
      5: [
        [50, 96],
        [9, 63],
        [25, 11],
        [75, 11],
        [91, 63],
      ],
      6: [
        [50, 96],
        [9, 65],
        [13, 25],
        [50, 8],
        [87, 25],
        [91, 65],
      ],
    };
    const [x, y] = positions[n][relative];
    return `left:${x}%;top:${y}%;--seat:${colors[i]}`;
  }
  function pick(kind: 'tile' | Piece) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (kind === 'tile' ? p.phase !== 'place' || !mine : !usable(kind)) return;
    unlock();
    tool = kind;
    selected = '';
    if (kind === 'tile') attachment = undefined;
    map?.focus({ preventScroll: true });
  }
  function beginDrag(kind: 'tile' | Piece, e: PointerEvent) {
    if (
      e.button !== 0 ||
      drag ||
      (kind === 'tile' ? p.phase !== 'place' || !mine : !usable(kind))
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    unlock();
    tool = kind;
    selected = '';
    if (kind === 'tile') attachment = undefined;
    const source =
      (e.currentTarget as Element).closest('button') ??
      document.querySelector(
        kind === 'tile' ? '.own-tile' : `[data-piece-type="${kind}"]`,
      );
    const r = source?.getBoundingClientRect();
    drag = {
      kind,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      originX: r ? r.x + r.width / 2 : e.clientX,
      originY: r ? r.y + r.height / 2 : e.clientY,
      pointer: e.pointerId,
      moved: false,
      returning: false,
      identity: choiceIdentity,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function dragMove(e: PointerEvent) {
    if (!drag || drag.pointer !== e.pointerId || drag.returning) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5)
      drag.moved = true;
  }
  function world(clientX: number, clientY: number) {
    const r = map.getBoundingClientRect();
    return {
      x: cx + (clientX - r.left - width / 2) / scale,
      y: cy + (clientY - r.top - height / 2) / scale,
    };
  }
  function dropRef(x: number, y: number) {
    let closest: string | undefined;
    let distance = Math.max(25, 26 * scale);
    for (const o of pieceOptions) {
      const { tile, region } = split(o.target!);
      const cell = p.board[tile];
      const r = tiles[cell.id].regions.find((v) => v.id === region)!;
      const a = rotatePoint(r.anchor, cell.rotation);
      const d =
        Math.hypot(cell.x * 100 + a[0] - x, cell.y * 100 + a[1] - y) * scale;
      if (d < distance) {
        closest = o.id;
        distance = d;
      }
    }
    return closest;
  }
  function returnPiece() {
    if (!drag) return;
    drag.returning = true;
    drag.x = drag.originX;
    drag.y = drag.originY;
    clearTimeout(returnTimer);
    returnTimer = setTimeout(() => (drag = null), 220);
  }
  function dragEnd(e: PointerEvent) {
    if (!drag || drag.pointer !== e.pointerId || drag.returning) return;
    const current = drag;
    if (current.identity !== choiceIdentity) {
      drag = null;
      return;
    }
    if (!current.moved) {
      drag = null;
      return;
    }
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const r = map.getBoundingClientRect();
    const onMap =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom &&
      e.clientY < r.bottom - 95;
    const pos = world(e.clientX, e.clientY);
    if (onMap && current.kind === 'tile') {
      const x = Math.floor(pos.x / 100),
        y = Math.floor(pos.y / 100);
      if (locations.some((v) => v.x === x && v.y === y)) {
        selectLocation(x, y);
        drag = null;
        audio.play('preview');
        return;
      }
    } else if (onMap) {
      const id = dropRef(pos.x, pos.y);
      if (id !== undefined) {
        const o = pieceOptions.find((o) => o.id === id)!;
        drag = null;
        choose(o);
        return;
      }
    }
    returnPiece();
  }
  function cancelDrag(e?: PointerEvent) {
    if (e && drag?.pointer !== e.pointerId) return;
    returnPiece();
  }
  function dismissPreview() {
    preview = null;
    tool = null;
    attachment = undefined;
    selected = '';
  }
  function attachmentPick(kind: 'builder' | 'pig') {
    attachment = attachment === kind ? undefined : kind;
    if (tool !== 'meeple' && tool !== 'large') tool = 'meeple';
  }
</script>

<svelte:window
  onpointermove={dragMove}
  onpointerup={dragEnd}
  onpointercancel={cancelDrag}
  onblur={() => {
    cancelDrag();
    pointers.clear();
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape' && !settings) {
      cancelDrag();
      dismissPreview();
    }
  }}
/>
<div class="carc-table" class:carrying={!!drag?.moved}>
  <div class="landscape">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The map is a keyboard-operated application; native controls provide equivalent actions.) -->
    <svg
      bind:this={map}
      class="map"
      viewBox={`${cx - width / scale / 2} ${cy - height / scale / 2} ${width / scale} ${height / scale}`}
      role="application"
      aria-label={t('controls')}
      tabindex="0"
      onkeydown={keyboard}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={(e) => {
        pointers.delete(e.pointerId);
        cancelDrag(e);
      }}
      onwheel={(e) => {
        e.preventDefault();
        const r = map.getBoundingClientRect();
        zoom(
          Math.exp(-e.deltaY * 0.0015),
          e.clientX - r.left,
          e.clientY - r.top,
        );
      }}
    >
      <defs
        ><pattern
          id="carc-grid"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
          ><path
            d="M100 0H0V100"
            fill="none"
            stroke="#efdfb7"
            stroke-opacity=".035"
          /></pattern
        ></defs
      >
      <rect
        x={cx - width / scale}
        y={cy - height / scale}
        width={(width * 2) / scale}
        height={(height * 2) / scale}
        fill="url(#carc-grid)"
      />
      {#each Object.entries(p.board) as [k, tile] (k)}<g
          transform={`translate(${tile.x * 100} ${tile.y * 100})`}
          class:landed={recent.includes(k)}
        >
          <rect
            x="2"
            y="5"
            width="97"
            height="98"
            rx="2"
            fill="#080d08"
            opacity=".35"
          />
          <g class="tile-surface"
            ><TileArt id={tile.id} rotation={tile.rotation} /></g
          >
          {#if feature?.tiles.includes(k)}<g
              transform={`rotate(${tile.rotation * 90} 50 50)`}
              pointer-events="none"
              >{#each tiles[tile.id].regions.filter( (r) => feature!.nodes.includes(node(k, r.id)) ) as r}{#if r.kind === 'city'}<path
                    d={cityPath(r)}
                    fill="#ffebaa"
                    fill-opacity=".35"
                    stroke="#ffe8a0"
                    stroke-width="3"
                  />{:else if r.kind === 'road'}<path
                    d={roadPath(r)}
                    fill="none"
                    stroke="#ffe8a0"
                    stroke-width="12"
                    stroke-opacity=".6"
                  />{:else if r.kind === 'field'}<path
                    d={fieldPath(r)}
                    fill="#ecf8a2"
                    fill-opacity=".2"
                    stroke="#e5efa3"
                    stroke-width="1"
                  />{:else}<circle
                    cx={r.anchor[0]}
                    cy={r.anchor[1]}
                    r="21"
                    fill="#ffe8a0"
                    fill-opacity=".3"
                    stroke="#ffe8a0"
                  />{/if}{/each}</g
            >{/if}
          {#if p.goldMap[k]}<g transform="translate(81 82)"
              ><path
                d="M-9 0L0-5L9 0L0 5Z"
                fill="#ffe27b"
                stroke="#8c692b"
              /><text
                text-anchor="middle"
                y="3"
                font-size="9"
                font-weight="bold">{p.goldMap[k]}</text
              ></g
            >{/if}
          {#if tiles[tile.id].ferry}{@const pair =
              ferryPreview?.tile === k ? ferryPreview.pair : tile.ferry}<g
              transform={`rotate(${tile.rotation * 90} 50 50)`}
              pointer-events="none"
            >
              {#if pair}<path
                  class="ferry-connection"
                  d={ferryPath(tile.id, pair)}
                  fill="none"
                  stroke="#f1d5a0"
                  stroke-width="8"
                /><path
                  d={ferryPath(tile.id, pair)}
                  fill="none"
                  stroke="#93663e"
                  stroke-width="5"
                  stroke-dasharray="2 2"
                />{/if}
              {#each tiles[tile.id].regions.filter((r) => r.kind === 'road') as r, i}<text
                  x={r.anchor[0]}
                  y={r.anchor[1] + 3}
                  text-anchor="middle"
                  font-size="9"
                  fill="#26382b"
                  stroke="#f5e0b0"
                  stroke-width="2"
                  paint-order="stroke">{i + 1}</text
                >{/each}
            </g>{/if}
          {#each tiles[tile.id].regions.filter((r) => r.kind !== 'river') as r}
            {@const a = rotatePoint(r.anchor, tile.rotation)}{@const ref = node(
              k,
              r.id,
            )}
            <circle
              data-region={ref}
              data-legal={legalRefs.has(ref) ? 'true' : undefined}
              role={legalRefs.has(ref) ? 'button' : undefined}
              tabindex={legalRefs.has(ref) ? 0 : undefined}
              aria-label={legalRefs.has(ref)
                ? `${t('meeple')} · ${t(r.kind)} (${tile.x}, ${tile.y})`
                : undefined}
              onkeydown={(e) => {
                if (
                  legalRefs.has(ref) &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  const o = pieceOptions.find((o) => o.target === ref);
                  if (o) choose(o);
                }
              }}
              cx={a[0]}
              cy={a[1]}
              r="13"
              fill={selected === ref ? '#ffeab3' : 'transparent'}
              fill-opacity=".65"
              stroke={legalRefs.has(ref) ? '#ffebaf' : 'transparent'}
              stroke-width="1.7"
              stroke-dasharray="2 2"
              class="region"
              ><title>{t(r.kind)} ({tile.x}, {tile.y})</title></circle
            >
          {/each}
          {#each p.figures.filter((f) => f.tile === k) as f, i}
            {@const r = tiles[tile.id].regions.find(
              (r) => r.id === f.region,
            )!}{@const a = rotatePoint(r.anchor, tile.rotation)}{@const index =
              p.players.indexOf(f.owner)}
            <g
              transform={`translate(${a[0] + (i % 2) * 4} ${a[1]}) rotate(${r.kind === 'field' ? 90 : 0}) scale(${f.type === 'large' ? 1.3 : 0.85})`}
              class="figure"
              data-region={node(k, f.region)}
              ><path
                d={meeplePath}
                fill={colors[index]}
                stroke="#f9e5b5"
                stroke-width="1.4"
              /><text
                y="5"
                text-anchor="middle"
                font-size="8"
                fill={index === 4 ? '#29382f' : 'white'}
                >{f.type === 'abbot' ? '✝' : index + 1}</text
              >{#if f.attachment}<path d="M8 5L17 9" stroke="#e7d5a4" /><circle
                  cx="20"
                  cy="10"
                  r="7"
                  fill={colors[index]}
                  stroke="#f9e5b5"
                /><text
                  x="20"
                  y="13"
                  text-anchor="middle"
                  font-size="8"
                  fill="white">{f.attachment === 'pig' ? 'P' : 'B'}</text
                >{/if}</g
            >
          {/each}
          {#each ['mage', 'witch'] as magic}{#if p.magic[magic as 'mage' | 'witch']?.startsWith(k + '/')}<path
                d="M69 33L77 11L85 33Z"
                fill={magic === 'mage' ? '#bd965a' : '#80629d'}
                stroke="#f3dfaa"
              />{/if}{/each}
        </g>{/each}
      {#if p.phase === 'place' && mine && tool === 'tile'}{#each locations as loc}<g
            transform={`translate(${loc.x * 100} ${loc.y * 100})`}
            data-location={`${loc.x},${loc.y}`}
            ><rect
              x="5"
              y="5"
              width="90"
              height="90"
              rx="4"
              fill="#b2c68e"
              fill-opacity=".07"
              stroke="#d7d6a5"
              stroke-opacity=".6"
              stroke-dasharray="3 7"
            /><path
              d="M44 50H56M50 44V56"
              stroke="#d7d6a5"
              stroke-width="2"
            /></g
          >{/each}{/if}
      {#if preview && p.current}<g
          class="ghost"
          transform={`translate(${preview.x * 100} ${preview.y * 100})`}
          data-preview="true"
          ><g
            class="rotating"
            style={`transform:rotate(${visualRotation * 90}deg);transform-origin:50px 50px`}
            ><TileArt id={p.current} /></g
          ><rect
            x="2"
            y="2"
            width="96"
            height="96"
            fill="none"
            stroke={valid ? '#ffe6a0' : '#ee795e'}
            stroke-width="4"
          /></g
        >{/if}
    </svg>

    <div class="receipts" aria-live="polite">
      {#each receipts as receipt (receipt.id)}<div>
          {name(receipt.player)} <strong>+{receipt.points}</strong>
        </div>{/each}
    </div>
    {#if feature}<aside class="inspection">
        <button
          class="close"
          onclick={() => (selected = '')}
          aria-label={t('close')}>×</button
        >
        <p class="eyebrow">{t('inspect')}</p>
        <h3>{t(feature.kind)}</h3>
        <p>
          {feature.tiles.length}
          {t('tiles')} · {feature.complete
            ? t('complete')
            : feature.open + ' ' + t('open')}
        </p>
        {#if feature.kind === 'field'}<p>
            {feature.cities.length}
            {t('cities')}
          </p>{/if}
        <p>
          {feature.figures.length
            ? Object.entries(feature.strength)
                .map(([id, n]) => name(id) + ': ' + n)
                .join(' · ')
            : t('unoccupied')}
        </p>
        <strong
          >{t('provisional')}: {points(feature, !feature.complete)}
          {t('points')}</strong
        >
      </aside>{/if}
  </div>
  <div class="players" aria-label="Carcassonne">
    {#each players as player, i}<div
        class="player"
        class:active={who === player.id}
        class:self={player.id === playerId}
        style={seatPosition(i)}
      >
        <svg viewBox="-16 -16 32 34" aria-hidden="true"
          ><path
            d={meeplePath}
            fill={colors[i]}
            stroke="#e7d9b3"
            stroke-width=".8"
          /><text
            y="5"
            text-anchor="middle"
            font-size="9"
            fill={i === 4 ? '#293a32' : 'white'}>{i + 1}</text
          ></svg
        ><strong>{player.name}</strong><span
          >{p.scores[player.id][0] + p.scores[player.id][1]}</span
        >{#if p.phase === 'setup' && p.ready.includes(player.id)}<small>✓</small
          >{/if}
      </div>{/each}
  </div>
  <button
    class="guide-toggle corner-control"
    onclick={() => (guide = true)}
    aria-label={t('guide')}
    title={t('guide')}
    ><svg viewBox="0 0 28 28" aria-hidden="true"
      ><path
        d="M4 6.5Q9 4 14 7v15q-5-3-10-.5Zm20 0q-5-2.5-10 .5v15q5-3 10-.5Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      /><path
        d="M7 10q2.5-.7 4.5.5M17 10q2.5-.7 4.5.5M7 14q2.5-.7 4.5.5M17 14q2.5-.7 4.5.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        opacity=".7"
      /></svg
    ></button
  >
  {#if p.phase !== 'setup'}<button
      class="overview-toggle corner-control"
      onclick={() => (overview = true)}
      aria-label={t('board_overview')}
      title={t('board_overview')}
      ><svg viewBox="0 0 28 28" aria-hidden="true"
        ><path
          d="M5 22.5h18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        /><path
          d="M7.5 20V14h3v6Zm5 0V8h3v12Zm5 0V11h3v9Z"
          fill="#e9c879"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linejoin="round"
        /><path
          d="m7 10 5-4 4 2 5-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg
      ></button
    >{/if}
  <button
    class="settings-toggle corner-control"
    onclick={() => (settings = true)}
    aria-label={t('settings')}
    title={t('settings')}
    ><svg viewBox="0 0 28 28" aria-hidden="true"
      ><path
        d="M6 8h16M6 14h16M6 20h16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      /><circle
        cx="11"
        cy="8"
        r="2.2"
        fill="#e9c879"
        stroke="currentColor"
      /><circle
        cx="18"
        cy="14"
        r="2.2"
        fill="#e9c879"
        stroke="currentColor"
      /><circle
        cx="13"
        cy="20"
        r="2.2"
        fill="#e9c879"
        stroke="currentColor"
      /></svg
    ></button
  >
  {#if p.phase === 'setup'}<section class="setup-panel">
      <svg
        class="setup-road"
        viewBox="0 0 760 180"
        preserveAspectRatio="none"
        aria-hidden="true"
        ><path d="M-20 135C130 25 205 175 350 91S580 22 790 113" /><path
          class="road-center"
          d="M-20 135C130 25 205 175 350 91S580 22 790 113"
        /></svg
      >
      <div class="setup">
        <p class="eyebrow">{t('edition')}</p>
        <h1>{t('setup')}</h1>
        <p>{t(canConfigure ? 'setup_hint_host' : 'setup_hint_guest')}</p>
        <div class="presets">
          {#each Object.entries(presets) as [id, cfg]}<button
              class:chosen={JSON.stringify(cfg.modules) ===
                JSON.stringify(p.config.modules) &&
                cfg.farmers === p.config.farmers}
              onclick={() => config({ ...cfg, first: p.config.first })}
              disabled={!connected || !canConfigure}
              aria-pressed={JSON.stringify(cfg.modules) ===
                JSON.stringify(p.config.modules) &&
                cfg.farmers === p.config.farmers}><span>{t(id)}</span></button
            >{/each}
        </div>
        <div class="modules" aria-label={t('expansions')}>
          {#each setupOptions as mod}<button
              class="module-card"
              class:chosen={moduleActive(mod)}
              onclick={() => toggleModule(mod)}
              disabled={!connected || !canConfigure}
              aria-pressed={moduleActive(mod)}
              ><span class="module-icon" aria-hidden="true"
                >{setupIcons[mod]}</span
              ><span class="module-copy"
                ><strong>{t(mod)}</strong><small>{t(mod + '_info')}</small
                ></span
              ><span class="module-check" aria-hidden="true">✓</span></button
            >{/each}
        </div>
        {#if p.config.modules.length > 7}<p class="note">
            {t('long')}
          </p>{/if}
        <fieldset
          class="starting-player"
          disabled={!connected || !canConfigure}
        >
          <legend>{t('first')}</legend>
          <div class="player-chips">
            {#each players as v, i}<button
                class:chosen={p.config.first === i}
                aria-pressed={p.config.first === i}
                onclick={() => config({ ...p.config, first: i })}
                style={`--chip:${colors[i]}`}
                ><span class="chip-meeple" aria-hidden="true">♟</span><strong
                  >{v.name}</strong
                >{#if p.config.first === i}<span
                    class="starts"
                    aria-hidden="true">✦</span
                  >{/if}</button
              >{/each}
          </div>
        </fieldset>
        <small class="first-hint">{t('first_hint')}</small><button
          class="primary"
          disabled={p.ready.includes(playerId) || !connected}
          onclick={() => send({ type: 'ready', version: p.setupVersion })}
          >{p.ready.includes(playerId)
            ? t('waiting')
            : t(practice ? 'start_practice' : 'ready')}</button
        >
      </div>
    </section>
  {:else if p.phase === 'finished'}<section class="finished">
      <p class="eyebrow">{t('finished')}</p>
      <h1>{t(p.winners.length > 1 ? 'winners' : 'winner')}</h1>
      <h2>{p.winners.map(name).join(' & ')}</h2>
      {#each [...players].sort((a, b) => p.scores[b.id][0] - p.scores[a.id][0]) as v}<p
          class="result"
        >
          <strong>{v.name}</strong><span>{p.scores[v.id][0]} {t('points')}</span
          >
        </p>{/each}<button
        onclick={() => {
          journal = true;
          settings = true;
        }}>{t('history')}</button
      >
    </section>
  {:else}
    <div class="turn-hint" aria-live="polite">
      <span class="turn-line">{name(who)} · {t('turn')} {p.turn}</span>
      <p>
        {!mine
          ? t('waiting')
          : p.phase === 'place'
            ? preview
              ? t('rotate_here')
              : t('pick_tile')
            : normalChoice
              ? t('pick_meeple')
              : t(p.pending?.kind + '_title')}
      </p>
      {#if players.find((v) => v.id === who)?.connected === false}<small
          >{t('disconnected')}</small
        >{/if}
    </div>
    {#if previewPosition && p.current && p.phase === 'place'}<div
        class="placement-controls"
        style={`left:${Math.max(95, Math.min(width - 95, previewPosition.x))}px;top:${Math.max(90, Math.min(height - 205, previewPosition.y + 12))}px`}
      >
        <button onclick={() => rotate(-1)} aria-label={t('rotate_left')}
          >↶</button
        ><button
          class="confirm"
          onclick={place}
          disabled={!valid || !mine}
          aria-label={t('confirm')}>✓</button
        ><button onclick={() => rotate(1)} aria-label={t('rotate_right')}
          >↷</button
        ><button
          class="cancel"
          onclick={dismissPreview}
          aria-label={t('cancel')}>×</button
        >{#if !valid}<small>{t('mismatch')}</small>{/if}
      </div>{/if}
    <div class="hand" aria-label={t('your_pieces')}>
      {#if p.current}<div class="tile-stack">
          <span class="deck-count">{p.remaining}</span><button
            class="own-tile"
            class:picked={tool === 'tile'}
            class:in-map={!!preview}
            class:lifted={drag?.kind === 'tile' && drag.moved}
            disabled={!mine || p.phase !== 'place'}
            data-piece-type="tile"
            aria-label={t('current')}
            aria-pressed={tool === 'tile'}
            onpointerdown={(e) => beginDrag('tile', e)}
            onclick={() => pick('tile')}
            ><svg viewBox="0 0 100 100" aria-hidden="true"
              ><g
                class="rotating"
                style={`transform:rotate(${visualRotation * 90}deg);transform-origin:50px 50px`}
                ><TileArt id={p.current} /></g
              ></svg
            ></button
          >
        </div>{/if}
      <div class="meeple-supply">
        {#each figureTypes as type}<div class="piece-group">
            {#each Array(type === 'meeple' ? 7 : 1) as _, i}
              {@const unavailable = i >= available(type) || !usable(type)}
              <span
                class="piece-wrap"
                aria-describedby={`carc-tip-${type}-${i}`}
                ><button
                  class="loose-meeple"
                  class:large={type === 'large'}
                  class:used={i >= available(type)}
                  class:picked={tool === type && i === 0}
                  aria-disabled={unavailable}
                  data-piece-type={type}
                  aria-label={`${t(type)} ${i + 1}`}
                  aria-describedby={`carc-tip-${type}-${i}`}
                  aria-pressed={tool === type && i === 0}
                  style={`--lean:${[0, -7, 5, -4, 7, -2, 3][i]}deg`}
                  onpointerdown={(e) => {
                    if (!unavailable) beginDrag(type, e);
                  }}
                  onclick={() => {
                    if (!unavailable) pick(type);
                  }}
                  ><svg viewBox="-16 -18 32 36" aria-hidden="true"
                    ><path
                      d={meeplePath}
                      fill={ownColor}
                      stroke="#f3dfb4"
                      stroke-width=".8"
                    /><path
                      d="M-3-11Q0-14 3-11M-8 1-5-1"
                      fill="none"
                      stroke="#fff6ce"
                      stroke-opacity=".5"
                    />{#if type === 'abbot'}<path
                        d="M0-5V5M-4-1H4"
                        stroke="#f9edcc"
                        stroke-width="2"
                      />{/if}</svg
                  ></button
                ><span
                  class="piece-tooltip"
                  role="tooltip"
                  id={`carc-tip-${type}-${i}`}
                  ><strong>{t(type)}</strong><span>{t(type + '_info')}</span
                  ></span
                ></span
              >
            {/each}
          </div>{/each}
        {#if p.config.modules.includes('traders')}{#each ['builder', 'pig'] as kind}
            {@const unavailable =
              !mine ||
              !normalChoice ||
              !p.pending?.options.some((o) => o.attachment === kind)}
            <span
              class="piece-wrap attachment-wrap"
              aria-describedby={`carc-tip-${kind}`}
              ><button
                class="attachment"
                class:picked={attachment === kind}
                aria-disabled={unavailable}
                aria-label={t(kind)}
                aria-describedby={`carc-tip-${kind}`}
                aria-pressed={attachment === kind}
                onclick={() => {
                  if (!unavailable) attachmentPick(kind as 'builder' | 'pig');
                }}
                ><svg viewBox="0 0 40 40" aria-hidden="true"
                  >{#if kind === 'pig'}<path
                      d="M7 16Q3 14 3 20M9 13Q20 7 29 14L35 13V22L29 25V32H24V27H15V32H10V25Q5 20 9 13Z"
                      fill={ownColor}
                      stroke="#f3dfb4"
                    />{:else}<path
                      d="M10 32V19L6 16L12 11V5H27V11L33 16L27 19V32Z"
                      fill={ownColor}
                      stroke="#f3dfb4"
                    />{/if}</svg
                ></button
              ><span
                class="piece-tooltip"
                role="tooltip"
                id={`carc-tip-${kind}`}
                ><strong>{t(kind)}</strong><span>{t(kind + '_info')}</span
                ></span
              ></span
            >
          {/each}{/if}
      </div>
      {#if mine && normalChoice}<div class="hand-actions">
          {#each p.pending?.options.filter((o) => o.kind === 'skip' || o.kind === 'retrieve' || (o.kind === 'fly' && o.figure === tool)) ?? [] as o}<button
              onclick={() => choose(o)}>{t(o.kind)}</button
            >{/each}
        </div>{/if}
    </div>
    {#if p.pending && !normalChoice}<section
        class="decision"
        aria-label={t(p.pending.kind + '_title')}
      >
        <h2>{t(p.pending.kind + '_title')}</h2>
        {#if p.pending.kind === 'message'}<p>
            {t('message_' + p.message)}
          </p>{/if}{#if p.flight}<p>
            {p.flight.roll} → ({p.flight.tile})
          </p>{/if}{#if mine}<div class="choices">
            {#each options as option}<button
                onmouseenter={() =>
                  (ferryPreview =
                    option.kind === 'ferry'
                      ? {
                          tile: option.target!,
                          pair: String(option.value).split(':') as [
                            string,
                            string,
                          ],
                        }
                      : null)}
                onfocus={() =>
                  (ferryPreview =
                    option.kind === 'ferry'
                      ? {
                          tile: option.target!,
                          pair: String(option.value).split(':') as [
                            string,
                            string,
                          ],
                        }
                      : null)}
                onclick={() => choose(option)}>{optionLabel(option)}</button
              >{/each}
          </div>{:else}<p>{t('waiting')}</p>{/if}
      </section>{/if}
  {/if}
  {#if drag?.moved}<div
      class="drag-piece"
      class:returning={drag.returning}
      class:drag-tile={drag.kind === 'tile'}
      style={`left:${drag.x}px;top:${drag.y}px`}
      aria-hidden="true"
    >
      {#if drag.kind === 'tile' && p.current}<svg viewBox="0 0 100 100"
          ><TileArt id={p.current} {rotation} /></svg
        >{:else}<svg viewBox="-16 -18 32 36"
          ><path
            d={meeplePath}
            fill={ownColor}
            stroke="#f3dfb4"
            stroke-width="1"
          /></svg
        >{/if}
    </div>{/if}

  <dialog
    bind:this={overviewDialog}
    onclose={() => (overview = false)}
    class="overview-dialog"
    aria-labelledby="carc-overview-title"
  >
    <button
      class="close"
      aria-label={t('close')}
      onclick={() => (overview = false)}>×</button
    >
    <p class="eyebrow">{t('overview_eyebrow')}</p>
    <h2 id="carc-overview-title">{t('board_overview')}</h2>
    <p class="overview-intro">{t('overview_intro')}</p>

    <section class="overview-section landscape-status">
      <h3>{t('landscape_status')}</h3>
      <div class="status-strip">
        <span><strong>{p.turn}</strong>{t('turn')}</span>
        <span><strong>{p.remaining}</strong>{t('remaining')}</span>
        <span><strong>{Object.keys(p.board).length}</strong>{t('tiles')}</span>
        <span><strong>{p.discarded}</strong>{t('discarded_tiles')}</span>
      </div>
    </section>

    <section class="overview-section">
      <h3>{t('player_overview')}</h3>
      <div class="overview-players">
        {#each overviewPlayers as summary, i}<article
            class="overview-player"
            class:self={summary.id === playerId}
            style={`--player-color:${colors[i]}`}
          >
            <header>
              <span class="overview-meeple" aria-hidden="true">♟</span>
              <strong>{name(summary.id)}</strong>
              <span class="overview-score">{summary.score}</span>
            </header>
            <p class="standing">
              {summary.behind === 0
                ? t('leader')
                : `${summary.behind} ${t('points_behind')}`}
              · {summary.placedTiles}
              {t('placed_tiles')}
            </p>
            <div class="figure-summary">
              <p>
                <strong>{t('meeple')}</strong><span
                  >{summary.standardAvailable}
                  {t('available')} · {summary.standardDeployed}
                  {t('deployed')}</span
                >
              </p>
              {#if p.config.farmers}<p>
                  <strong>{t('farmer')}</strong><span
                    >{summary.farmers} {t('on_fields')}</span
                  >
                </p>{/if}
              {#if p.config.modules.includes('inns')}<p>
                  <strong>{t('large')}</strong><span
                    >{summary.largeAvailable}
                    {t('available')} · {summary.largeDeployed}
                    {t('deployed')}</span
                  >
                </p>{/if}
              {#if p.config.modules.includes('abbot')}<p>
                  <strong>{t('abbot')}</strong><span
                    >{summary.abbotAvailable}
                    {t('available')} · {summary.abbotDeployed}
                    {t('deployed')}</span
                  >
                </p>{/if}
            </div>
            {#if p.config.modules.includes('traders') || p.config.modules.includes('gold') || p.config.modules.includes('messages') || p.config.modules.includes('robbers') || summary.extraTurns}<div
                class="resource-summary"
              >
                {#if p.config.modules.includes('traders')}{#each summary.goods as amount, good}<span
                      title={t(goodsLabels[good])}
                      ><b aria-hidden="true">{goodsIcons[good]}</b
                      >{amount}<small>{t(goodsLabels[good])}</small></span
                    >{/each}{/if}
                {#if p.config.modules.includes('gold')}<span
                    ><b aria-hidden="true">◆</b>{summary.gold}<small
                      >{t('gold_ingots')}</small
                    ></span
                  >{/if}
                {#if p.config.modules.includes('messages')}<span
                    ><b aria-hidden="true">✉</b>{summary.messages}<small
                      >{t('messages_drawn')}</small
                    ></span
                  >{/if}
                {#if p.config.modules.includes('robbers') && summary.robberActive}<span
                    ><b aria-hidden="true">♟</b><small
                      >{t('robber_ready')}</small
                    ></span
                  >{/if}
                {#if summary.extraTurns}<span
                    ><b aria-hidden="true">↻</b>{summary.extraTurns}<small
                      >{t('extra_turns')}</small
                    ></span
                  >{/if}
                {#if summary.builderActive}<span
                    ><b aria-hidden="true">⌂</b><small
                      >{t('builder')} · {t('active_piece')}</small
                    ></span
                  >{/if}
                {#if summary.pigActive}<span
                    ><b aria-hidden="true">♞</b><small
                      >{t('pig')} · {t('active_piece')}</small
                    ></span
                  >{/if}
              </div>{/if}
            {#if Object.values(summary.points).some((value) => value > 0)}<div
                class="score-sources"
                aria-label={t('score_breakdown')}
              >
                <small>{t('score_breakdown')}</small>
                <div>
                  {#each scoreSources as source}{#if summary.points[source]}<span
                        >{scoreSourceLabel(source)}
                        <strong>{summary.points[source]}</strong></span
                      >{/if}{/each}
                </div>
              </div>{/if}
          </article>{/each}
      </div>
    </section>

    <section class="overview-section watchlist">
      <div class="watchlist-heading">
        <div>
          <h3>{t('feature_watchlist')}</h3>
          <p>{t('watchlist_intro')}</p>
        </div>
        <div
          class="watch-filters"
          role="group"
          aria-label={t('feature_watchlist')}
        >
          {#each overviewScopes as scope}<button
              class:chosen={overviewScope === scope}
              aria-pressed={overviewScope === scope}
              onclick={() => (overviewScope = scope)}>{t(scope)}</button
            >{/each}
        </div>
      </div>
      {#if overviewFeatures.length}<div class="watched-features">
          {#each overviewFeatures as watched}<button
              class="watched-feature"
              onclick={() => focusFeature(watched)}
              aria-label={`${t('focus_feature')}: ${t(watched.kind)}, ${points(watched, true)} ${t('points')}`}
            >
              <span class="feature-symbol" aria-hidden="true"
                >{featureIcons[watched.kind]}</span
              >
              <span class="feature-copy">
                <span class="feature-title"
                  ><strong>{t(watched.kind)}</strong><b
                    >{points(watched, true)} {t('points')}</b
                  ></span
                >
                <small>
                  {watched.tiles.length}
                  {t('tiles')} · {watched.kind === 'field'
                    ? `${watched.cities.length} ${t('cities')}`
                    : `${watched.open} ${t('open')}`}
                </small>
                <span class="feature-owners">
                  {#if featureOwners(watched).length}{t('owners')}:
                    {featureOwners(watched)
                      .map(
                        ([owner, strength]) => `${name(owner)} (${strength})`,
                      )
                      .join(' · ')}{:else}{t('unoccupied')}{/if}
                </span>
                {#if watched.inn || watched.cathedral || watched.mage || watched.witch || watched.figures.some((figure) => figure.attachment)}<span
                    class="feature-modifiers"
                  >
                    {#if watched.inn}<i>{t('inn')}</i>{/if}
                    {#if watched.cathedral}<i>{t('cathedral')}</i>{/if}
                    {#if watched.mage}<i>{t('mage')}</i>{/if}
                    {#if watched.witch}<i>{t('witch')}</i>{/if}
                    {#if watched.figures.some((figure) => figure.attachment === 'builder')}<i
                        >{t('builder')}</i
                      >{/if}
                    {#if watched.figures.some((figure) => figure.attachment === 'pig')}<i
                        >{t('pig')}</i
                      >{/if}
                  </span>{/if}
              </span>
              <span class="feature-arrow" aria-hidden="true">→</span>
            </button>{/each}
        </div>{:else}<p class="empty-watchlist">
          {t('no_watched_features')}
        </p>{/if}
    </section>
  </dialog>

  <dialog
    bind:this={guideDialog}
    onclose={() => (guide = false)}
    class="guide-dialog"
    aria-labelledby="carc-guide-title"
  >
    <button
      class="close"
      aria-label={t('close')}
      onclick={() => (guide = false)}>×</button
    >
    <p class="eyebrow">{t('field_guide')}</p>
    <h2 id="carc-guide-title">{t('guide_title')}</h2>
    <p class="guide-intro">{t('guide_intro')}</p>
    <section class="guide-section">
      <h3>{t('turn_guide')}</h3>
      <ol class="turn-steps">
        {#each ['tile_step', 'figure_step', 'score_step'] as step, i}<li>
            <span>{i + 1}</span><strong>{t(step)}</strong>
            <p>{t(step + '_info')}</p>
          </li>{/each}
      </ol>
    </section>
    <section class="guide-section">
      <h3>{t('figure_dictionary')}</h3>
      <div class="guide-cards figure-cards">
        {#each figureGuide as figure}<article
            class:active={figureActive(figure)}
          >
            <span
              class="guide-symbol"
              class:farmer={figure === 'farmer'}
              aria-hidden="true">{setupIcons[figure]}</span
            >
            <div>
              <strong>{t(figure)}</strong>
              <p>{t(figure + '_info')}</p>
            </div>
            {#if figureActive(figure)}<small>{t('in_this_game')}</small>{/if}
          </article>{/each}
      </div>
    </section>
    <section class="guide-section">
      <h3>{t('expansion_dictionary')}</h3>
      <div class="guide-cards module-guide">
        {#each guideModules as mod}<article class:active={moduleActive(mod)}>
            <span class="guide-symbol" aria-hidden="true"
              >{setupIcons[mod]}</span
            >
            <div>
              <strong>{t(mod)}</strong>
              <p>{t(mod + '_info')}</p>
            </div>
            {#if moduleActive(mod)}<small>{t('enabled')}</small>{/if}
          </article>{/each}
      </div>
    </section>
    <section class="guide-section scoring-guide">
      <h3>{t('scoring_guide')}</h3>
      <p>{t('scoring_guide_info')}</p>
      <p>{t('final_scoring_info')}</p>
    </section>
  </dialog>

  <dialog
    bind:this={settingsDialog}
    onclose={() => (settings = false)}
    class="settings-dialog"
  >
    <button
      class="close"
      aria-label={t('close')}
      onclick={() => (settings = false)}>×</button
    >
    <p class="eyebrow">CARCASSONNE · 3.1</p>
    <h2>{t('settings')}</h2>
    <div class="settings-grid">
      <button onclick={toggleSound} aria-pressed={sound}
        >{t('sound')} · {sound ? t('on') : t('off')}</button
      ><button
        onclick={() => {
          fit();
          settings = false;
        }}>{t('fit')}</button
      ><button
        onclick={() => {
          focus(p.last);
          settings = false;
        }}>{t('last')}</button
      ><button
        onclick={() => {
          zoom(1.2);
        }}>{t('zoom_in')}</button
      ><button onclick={() => zoom(1 / 1.2)}>{t('zoom_out')}</button><button
        onclick={() => {
          settings = false;
          guide = true;
        }}>{t('help')}</button
      ><button onclick={() => (journal = !journal)} aria-expanded={journal}
        >{t('history')}</button
      >
    </div>
    {#if settingsContent}{@render settingsContent()}{/if}
    {#if journal}<section class="journal">
        <h3>{t('history')}</h3>
        {#each [...p.events].reverse() as e}<button
            class="journal-entry"
            onclick={() => {
              if (e.target) {
                selected = e.target;
                focus(split(e.target).tile);
              }
              settings = false;
            }}
            ><small>{t('turn')} {e.turn}</small><span
              >{e.player ? name(e.player) + ' · ' : ''}{t(e.kind)}{e.feature
                ? ' · ' + t(e.feature)
                : ''}</span
            >{#if e.points}<strong>+{e.points}</strong>{/if}</button
          >{/each}
      </section>{/if}
    <small class="control-hint">{t('controls')}</small>
  </dialog>
</div>

<style>
  :global(body:has(.carc-table) .site-header),
  :global(body:has(.carc-table) .room-toolbar) {
    display: none;
  }
  .carc-table {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 18% 18%, #d3c97a20 0 12%, transparent 36%),
      radial-gradient(ellipse at 82% 76%, #b48a4f20 0 10%, transparent 32%),
      repeating-linear-gradient(17deg, transparent 0 34px, #f1d88708 35px 36px),
      radial-gradient(ellipse at 50% 45%, #71875b, #435f49 62%, #304a3a 100%);
    color: #fff0c9;
    font-family: inherit;
    isolation: isolate;
  }
  .landscape {
    position: absolute;
    inset: 0;
  }
  .map {
    width: 100%;
    height: 100%;
    touch-action: none;
    outline: none;
    display: block;
    cursor: grab;
  }
  .map:active {
    cursor: grabbing;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    border: 1px solid #e8d6af30;
    background: #344a3e;
    border-radius: 8px;
    padding: 10px 14px;
  }
  button:disabled {
    cursor: default;
  }
  button[aria-disabled='true'] {
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid #f2d18a;
    outline-offset: 4px;
  }
  button:hover:not(:disabled) {
    background: #47604e;
  }
  svg {
    display: block;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: 27px;
  }
  h2 {
    font-size: 19px;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 12px;
  }
  .players {
    pointer-events: none;
  }
  .player {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0.65;
    transition:
      left 0.5s,
      top 0.5s,
      opacity 0.3s;
  }
  .player svg {
    width: 26px;
    height: 30px;
    filter: drop-shadow(0 3px 2px #0005);
  }
  .player span {
    font-size: 17px;
    font-variant-numeric: tabular-nums;
    color: #e5c98d;
  }
  .player.active {
    opacity: 1;
  }
  .player.active strong {
    text-decoration: underline;
    text-decoration-color: #e5c98d;
    text-underline-offset: 6px;
  }
  .player.self {
    font-size: 11px;
  }
  .player.self svg {
    width: 20px;
  }
  .corner-control {
    position: absolute;
    top: 20px;
    z-index: 4;
    width: 46px;
    height: 46px;
    border: 0;
    border-radius: 4px;
    padding: 8px;
    background: transparent;
    color: #ffe6ad;
    filter: drop-shadow(0 2px 2px #1c3324aa);
    transition:
      color 0.18s ease,
      transform 0.18s ease,
      filter 0.18s ease;
  }
  .corner-control:hover:not(:disabled) {
    color: #fff5d7;
    background: transparent;
    transform: translateY(-2px);
    filter: drop-shadow(0 5px 3px #1c332477);
  }
  .corner-control svg {
    width: 28px;
    height: 28px;
  }
  .settings-toggle {
    right: 22px;
  }
  .guide-toggle {
    left: 22px;
  }
  .overview-toggle {
    left: 70px;
  }
  .turn-hint {
    position: absolute;
    top: 28px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    pointer-events: none;
    max-width: 50%;
    font-size: 12px;
    color: #e4d8bc;
  }
  .turn-line {
    font-size: 10px;
    letter-spacing: 0.08em;
    opacity: 0.6;
  }
  .turn-hint p {
    margin-top: 7px;
  }
  .hand {
    position: absolute;
    bottom: 58px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 25px;
    max-width: calc(100% - 32px);
    user-select: none;
  }
  .tile-stack {
    position: relative;
    flex-shrink: 0;
  }
  .deck-count {
    position: absolute;
    left: -19px;
    bottom: 4px;
    font-size: 10px;
    opacity: 0.5;
  }
  .own-tile {
    width: 88px;
    height: 88px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: none;
    box-shadow:
      0 4px #ac936a,
      0 7px #746347,
      0 12px 13px #0005;
    transform: rotate(-5deg);
    transition:
      transform 0.2s,
      opacity 0.2s,
      box-shadow 0.2s;
    touch-action: none;
  }
  .own-tile:hover:not(:disabled),
  .own-tile.picked {
    background: none;
    transform: translateY(-8px) rotate(0);
    box-shadow:
      0 4px #ac936a,
      0 15px 20px #0006;
  }
  .own-tile.in-map,
  .own-tile.lifted {
    opacity: 0.25;
  }
  .own-tile:disabled {
    opacity: 0.65;
  }
  .own-tile svg {
    width: 100%;
    height: 100%;
  }
  .rotating {
    transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .meeple-supply,
  .piece-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .meeple-supply {
    gap: 8px;
  }
  .piece-wrap {
    position: relative;
    display: inline-grid;
    place-items: center;
    border-radius: 5px;
  }
  .piece-wrap:focus-visible {
    outline: 2px solid #ffe09a;
    outline-offset: 4px;
  }
  .piece-tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    z-index: 30;
    width: 190px;
    padding: 10px 12px;
    border: 1px solid #d9b96c;
    border-radius: 8px;
    background: #f8e8bd;
    color: #3f3828;
    box-shadow: 0 10px 26px #1e30245c;
    font-size: 11px;
    line-height: 1.4;
    text-align: left;
    pointer-events: none;
    opacity: 0;
    transform: translate(-50%, 7px);
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }
  .piece-tooltip::after {
    content: '';
    position: absolute;
    left: calc(50% - 6px);
    bottom: -7px;
    width: 11px;
    height: 11px;
    background: #f8e8bd;
    border-right: 1px solid #d9b96c;
    border-bottom: 1px solid #d9b96c;
    transform: rotate(45deg);
  }
  .piece-tooltip strong,
  .piece-tooltip span {
    display: block;
  }
  .piece-tooltip strong {
    margin-bottom: 3px;
    color: #765124;
  }
  .piece-wrap:hover .piece-tooltip,
  .piece-wrap:focus .piece-tooltip,
  .piece-wrap:focus-within .piece-tooltip {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  .loose-meeple,
  .attachment {
    border: 0;
    background: none;
    padding: 0;
    width: 30px;
    height: 43px;
    flex-shrink: 0;
    touch-action: none;
    transform: rotate(var(--lean, 0deg));
    transition:
      transform 0.2s,
      opacity 0.2s;
    filter: drop-shadow(1px 4px 1px #0007);
  }
  .loose-meeple svg,
  .attachment svg {
    width: 100%;
    height: 100%;
  }
  .loose-meeple.large {
    width: 37px;
    height: 49px;
  }
  .loose-meeple:hover:not([aria-disabled='true']),
  .loose-meeple.picked,
  .attachment.picked,
  .attachment:hover:not([aria-disabled='true']) {
    background: none;
    transform: translateY(-10px) rotate(0);
    filter: drop-shadow(1px 10px 3px #0005);
  }
  .loose-meeple[aria-disabled='true']:not(.used),
  .attachment[aria-disabled='true'] {
    opacity: 1;
  }
  .loose-meeple.used {
    opacity: 0.13;
    filter: none;
  }
  .hand-actions {
    position: absolute;
    bottom: calc(100% + 20px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    white-space: nowrap;
  }
  .hand-actions button {
    font-size: 11px;
    background: #21382dde;
  }
  .placement-controls {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    animation: appear 0.18s ease-out;
  }
  .placement-controls button {
    width: 37px;
    height: 36px;
    padding: 0;
    font-size: 22px;
    background: #243a30ed;
    box-shadow: 0 3px 7px #0004;
  }
  .placement-controls .confirm {
    background: #e1c38a;
    color: #24392c;
  }
  .placement-controls .confirm:disabled {
    opacity: 0.35;
  }
  .placement-controls .cancel {
    width: 27px;
    font-size: 19px;
  }
  .placement-controls small {
    position: absolute;
    top: 42px;
    width: 200px;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    color: #efc5a3;
    font-size: 10px;
  }
  .drag-piece {
    position: fixed;
    z-index: 20;
    pointer-events: none;
    width: 42px;
    height: 48px;
    transform: translate(-50%, -65%) rotate(-5deg);
    filter: drop-shadow(4px 18px 8px #0006);
  }
  .drag-piece.drag-tile {
    width: 90px;
    height: 90px;
  }
  .drag-piece svg {
    width: 100%;
    height: 100%;
  }
  .drag-piece.returning {
    transition:
      left 0.2s cubic-bezier(0.3, 0.8, 0.3, 1),
      top 0.2s cubic-bezier(0.3, 0.8, 0.3, 1),
      transform 0.2s;
    transform: translate(-50%, -50%);
  }
  .carrying {
    cursor: grabbing;
  }
  .ghost {
    filter: drop-shadow(0 5px 3px #0005);
  }
  .landed .tile-surface {
    animation: land 0.3s ease-out;
    transform-origin: 50px 50px;
  }
  .figure {
    animation: land 0.3s ease-out;
    transform-box: fill-box;
    transform-origin: center;
  }
  .region {
    cursor: pointer;
    transition: stroke 0.2s;
  }
  .ferry-connection {
    transition: opacity 0.2s;
  }
  .decision {
    position: absolute;
    bottom: 185px;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: calc(100% - 40px);
    text-align: center;
    padding: 16px;
    border-radius: 12px;
    background: #21362feb;
    box-shadow: 0 10px 35px #0002;
  }
  .decision h2 {
    font-size: 15px;
    margin-bottom: 10px;
  }
  .choices {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 600px;
    max-height: 180px;
    overflow: auto;
  }
  .choices button {
    font-size: 11px;
  }
  .inspection {
    position: absolute;
    left: 22px;
    bottom: 180px;
    width: 220px;
    background: #23382fee;
    padding: 18px;
    border: 1px solid #f1d5a329;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.7;
  }
  .close {
    position: absolute;
    right: 12px;
    top: 10px;
    border: 0;
    background: none;
    padding: 4px 9px;
    font-size: 23px;
  }
  .inspection h3 {
    margin: 0;
  }
  .inspection p {
    margin: 5px 0;
  }
  .receipts {
    position: absolute;
    top: 24%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    text-align: center;
  }
  .receipts > div {
    animation: receipt 2s both;
    color: #f3d995;
    font-size: 14px;
    padding: 5px;
  }
  .setup-panel,
  .finished {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(760px, calc(100% - 32px));
    max-height: calc(100% - 96px);
    overflow: auto;
    background:
      linear-gradient(110deg, #fff1caee, #ecd49dee),
      repeating-linear-gradient(0deg, transparent 0 5px, #78501d08 6px);
    color: #433923;
    border: 1px solid #f8e7bc;
    border-radius: 18px;
    padding: 30px;
    box-sizing: border-box;
    box-shadow:
      0 22px 70px #172d205c,
      inset 0 0 0 3px #9d743321;
  }
  .setup-panel {
    scrollbar-color: #aa8147 transparent;
  }
  .setup-road {
    position: absolute;
    inset: auto 0 0;
    width: 100%;
    height: 150px;
    opacity: 0.2;
    pointer-events: none;
  }
  .setup-road path {
    fill: none;
    stroke: #b8965c;
    stroke-width: 34;
  }
  .setup-road .road-center {
    stroke: #f8e6b9;
    stroke-width: 24;
    stroke-dasharray: 5 4;
    animation: road-build 0.8s ease-out both;
  }
  .setup {
    position: relative;
    z-index: 1;
    display: block;
  }
  .setup > p {
    font-size: 12px;
    line-height: 1.7;
    margin: 10px 0;
  }
  .presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 18px 0;
  }
  .presets button {
    position: relative;
    overflow: hidden;
    flex: 1 1 120px;
    font-size: 11px;
    padding: 10px 12px;
    color: #5b4828;
    border-color: #8b6d3a55;
    background: #fff5d4a8;
  }
  .presets button::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: #c08c3b;
    transform: scaleX(0);
    transition: transform 0.22s ease;
  }
  .presets button.chosen::after {
    transform: scaleX(1);
  }
  .presets button:hover:not(:disabled),
  .player-chips button:hover:not(:disabled) {
    background: #fff9e4;
  }
  .chosen {
    border-color: #b37b2f;
  }
  .modules {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .module-card {
    position: relative;
    display: grid;
    grid-template-columns: 38px 1fr 20px;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 9px 11px;
    text-align: left;
    color: #4a3b23;
    border: 1px solid #96713942;
    background: #fff7df91;
    box-shadow: 0 3px 0 #8e68261c;
    transition:
      transform 0.18s ease,
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .module-card:hover:not(:disabled) {
    background: #fffbea;
    transform: translateY(-2px) rotate(-0.25deg);
    box-shadow: 0 6px 12px #77551d1c;
  }
  .module-card.chosen {
    background: #e6d28d;
    box-shadow:
      inset 0 0 0 1px #9a722d,
      0 4px 10px #77551d1f;
    animation: option-land 0.24s ease-out;
  }
  .module-card:disabled,
  .presets button:disabled,
  .player-chips button:disabled {
    opacity: 1;
  }
  .module-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #7e985a;
    color: #fff3c9;
    font-size: 20px;
    box-shadow: inset 0 -3px #2f533433;
  }
  .module-copy,
  .module-copy strong,
  .module-copy small {
    display: block;
  }
  .module-copy strong {
    font-size: 11px;
  }
  .module-copy small {
    margin-top: 2px;
    color: #6d624d;
    font-size: 9px;
    line-height: 1.3;
  }
  .module-check {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid #94703a88;
    border-radius: 50%;
    color: transparent;
    font-size: 11px;
  }
  .module-card.chosen .module-check {
    color: white;
    border-color: #607747;
    background: #607747;
  }
  .starting-player {
    margin: 18px 0 4px;
    padding: 0;
    border: 0;
  }
  .starting-player legend {
    margin-bottom: 8px;
    color: #6c542f;
    font-size: 11px;
    font-weight: 700;
  }
  .player-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  .player-chips button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 105px;
    padding: 7px 10px;
    color: #4a3a22;
    border-color: #91703c55;
    background: #fff7dbb0;
  }
  .player-chips button.chosen {
    background: #fff5c5;
    box-shadow: inset 0 0 0 2px var(--chip);
  }
  .chip-meeple {
    color: var(--chip);
    font-size: 19px;
    filter: drop-shadow(0 1px #fff8df);
  }
  .starts {
    margin-left: auto;
    color: #b27825;
    animation: star-pulse 1.8s ease-in-out infinite;
  }
  .first-hint {
    display: block;
    margin: 7px 0 15px;
    color: #786a50;
    font-size: 9px;
  }
  .primary {
    width: 100%;
    background: #c89445;
    color: #fff8de;
    border-color: #9e6d2c;
    box-shadow: 0 4px 0 #76501f;
  }
  .primary:hover:not(:disabled) {
    background: #d5a453;
  }
  .primary:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow: 0 1px 0 #76501f;
  }
  .result {
    display: flex;
    justify-content: space-between;
    margin: 15px 0;
  }
  .finished h2 {
    margin: 12px 0 20px;
  }
  .settings-dialog,
  .guide-dialog,
  .overview-dialog {
    width: min(480px, calc(100vw - 40px));
    max-height: 85dvh;
    box-sizing: border-box;
    background:
      linear-gradient(120deg, #fff2cb, #ead09a),
      repeating-linear-gradient(0deg, transparent 0 5px, #78501d0a 6px);
    color: #433923;
    border: 1px solid #fff1c9;
    border-radius: 18px;
    padding: 28px;
    box-shadow:
      0 25px 90px #15291e99,
      inset 0 0 0 3px #9d743321;
  }
  .guide-dialog,
  .overview-dialog {
    width: min(900px, calc(100vw - 40px));
    padding: 34px;
    scrollbar-color: #aa8147 transparent;
  }
  .overview-dialog {
    width: min(1040px, calc(100vw - 40px));
    overflow: auto;
  }
  .settings-dialog > .close,
  .guide-dialog > .close,
  .overview-dialog > .close {
    position: sticky;
    float: right;
    top: 0;
    margin: -12px -12px 0 0;
    z-index: 2;
    color: #5d4829;
    background: #f2dba9;
  }
  .settings-dialog::backdrop,
  .guide-dialog::backdrop,
  .overview-dialog::backdrop {
    background: #183326b3;
    backdrop-filter: blur(5px);
  }
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin: 22px 0;
  }
  .settings-grid button {
    font-size: 12px;
    color: #4a3a23;
    border-color: #8f6d374f;
    background: #fff6d7a6;
  }
  .settings-grid button:hover:not(:disabled) {
    background: #fffbea;
  }
  .guide-intro {
    max-width: 660px;
    margin-top: 8px;
    color: #66583d;
    font-size: 12px;
    line-height: 1.6;
  }
  .guide-section {
    clear: both;
    padding-top: 24px;
  }
  .guide-section h3 {
    margin: 0 0 11px;
    color: #704d25;
    font-size: 13px;
    letter-spacing: 0.04em;
  }
  .turn-steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .turn-steps li {
    display: grid;
    grid-template-columns: 27px 1fr;
    gap: 3px 8px;
    padding: 12px;
    border: 1px solid #97713a3d;
    border-radius: 10px;
    background: #fff8dda8;
  }
  .turn-steps li > span {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #78945d;
    color: #fff8dc;
    font-size: 11px;
  }
  .turn-steps strong {
    font-size: 11px;
  }
  .turn-steps p,
  .guide-cards p,
  .scoring-guide p {
    color: #6e6149;
    font-size: 10px;
    line-height: 1.5;
  }
  .guide-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .guide-cards article {
    position: relative;
    display: grid;
    grid-template-columns: 42px 1fr;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 10px;
    border: 1px solid #8e6b3435;
    border-radius: 10px;
    background: #f9e8bc87;
  }
  .guide-cards article.active {
    border-color: #78945d8c;
    background: #fff8d9;
  }
  .guide-cards article > small {
    position: absolute;
    right: 8px;
    top: 7px;
    color: #5f7849;
    font-size: 7px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .guide-cards strong {
    display: block;
    margin-bottom: 3px;
    padding-right: 62px;
    color: #493820;
    font-size: 11px;
  }
  .guide-symbol {
    display: grid;
    place-items: center;
    width: 39px;
    height: 39px;
    border-radius: 50%;
    background: #78945d;
    color: #fff1c1;
    font-size: 21px;
    box-shadow: inset 0 -3px #3b5c4033;
  }
  .guide-symbol.farmer {
    transform: rotate(90deg);
  }
  .scoring-guide {
    padding-bottom: 8px;
  }
  .scoring-guide p + p {
    margin-top: 7px;
  }
  .overview-intro {
    max-width: 680px;
    margin-top: 8px;
    color: #66583d;
    font-size: 12px;
    line-height: 1.6;
  }
  .overview-section {
    clear: both;
    padding-top: 24px;
  }
  .overview-section h3 {
    margin: 0 0 11px;
    color: #704d25;
    font-size: 13px;
    letter-spacing: 0.04em;
  }
  .status-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .status-strip span {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid #8e6b3438;
    border-radius: 10px;
    background: #fff8dda8;
    color: #6e6149;
    font-size: 9px;
  }
  .status-strip strong {
    color: #60431f;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .overview-players {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
    gap: 10px;
  }
  .overview-player {
    position: relative;
    padding: 13px;
    border: 1px solid #8e6b3445;
    border-radius: 12px;
    background: #f9e8bc87;
    box-shadow: inset 4px 0 var(--player-color);
  }
  .overview-player.self {
    background: #fff8d9;
    border-color: #78945d8c;
  }
  .overview-player header {
    display: grid;
    grid-template-columns: 23px 1fr auto;
    align-items: center;
    gap: 7px;
    color: #493820;
    font-size: 12px;
  }
  .overview-meeple {
    color: var(--player-color);
    font-size: 22px;
    line-height: 1;
    filter: drop-shadow(0 1px #fff8df);
  }
  .overview-score {
    color: #765124;
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .standing {
    margin: 3px 0 10px 30px;
    color: #766849;
    font-size: 9px;
  }
  .figure-summary {
    padding-top: 8px;
    border-top: 1px solid #8e6b3426;
  }
  .figure-summary p {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 3px 0;
    color: #756547;
    font-size: 9px;
  }
  .figure-summary strong {
    color: #554325;
  }
  .resource-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 9px;
  }
  .resource-summary > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: 1px solid #9a733a3b;
    border-radius: 999px;
    background: #fff7d3a8;
    color: #584628;
    font-size: 9px;
  }
  .resource-summary b {
    color: #8d6127;
    font-size: 12px;
  }
  .resource-summary small {
    font-size: 8px;
  }
  .score-sources {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #8e6b3426;
  }
  .score-sources > small {
    display: block;
    margin-bottom: 5px;
    color: #756547;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .score-sources > div {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .score-sources span {
    padding: 3px 6px;
    border-radius: 5px;
    background: #7c91551a;
    color: #65502d;
    font-size: 8px;
  }
  .score-sources strong {
    color: #456139;
    font-variant-numeric: tabular-nums;
  }
  .watchlist-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 10px;
  }
  .watchlist-heading h3 {
    margin-bottom: 4px;
  }
  .watchlist-heading p {
    max-width: 590px;
    color: #6e6149;
    font-size: 10px;
    line-height: 1.45;
  }
  .watch-filters {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 3px;
    border: 1px solid #8f6d3738;
    border-radius: 9px;
    background: #e4c98e80;
  }
  .watch-filters button {
    padding: 6px 9px;
    border: 0;
    color: #624c2b;
    background: transparent;
    font-size: 9px;
  }
  .watch-filters button:hover:not(:disabled) {
    background: #fff6d79c;
  }
  .watch-filters button.chosen {
    color: #385436;
    background: #fff9df;
    box-shadow: 0 1px 4px #59431d24;
  }
  .watched-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }
  .watched-feature {
    display: grid;
    grid-template-columns: 38px 1fr 17px;
    align-items: center;
    gap: 9px;
    min-width: 0;
    padding: 9px;
    border-color: #8e6b343d;
    background: #fff8dda8;
    color: #493820;
    text-align: left;
  }
  .watched-feature:hover:not(:disabled) {
    background: #fffceb;
    transform: translateY(-1px);
  }
  .feature-symbol {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #78945d;
    color: #fff1c1;
    font-size: 18px;
    box-shadow: inset 0 -3px #3b5c4033;
  }
  .feature-copy {
    min-width: 0;
  }
  .feature-title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
    font-size: 10px;
  }
  .feature-title b {
    flex-shrink: 0;
    color: #456139;
    font-size: 9px;
  }
  .feature-copy > small,
  .feature-owners {
    display: block;
    overflow: hidden;
    color: #756547;
    font-size: 8px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .feature-owners {
    color: #5c4b2e;
  }
  .feature-modifiers {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
  }
  .feature-modifiers i {
    padding: 2px 5px;
    border-radius: 4px;
    background: #c28e3b22;
    color: #765124;
    font-size: 7px;
    font-style: normal;
  }
  .feature-arrow {
    color: #9a733a;
    font-size: 15px;
  }
  .empty-watchlist {
    padding: 20px;
    border: 1px dashed #8e6b3455;
    border-radius: 10px;
    color: #766849;
    font-size: 10px;
    text-align: center;
  }
  .journal {
    border-top: 1px solid #ead7ab25;
    margin-top: 20px;
    padding-top: 12px;
    font-size: 12px;
    line-height: 1.7;
  }
  .journal-entry {
    display: flex;
    gap: 12px;
    width: 100%;
    text-align: left;
    font-size: 11px;
    border: 0;
    border-bottom: 1px solid #fff1;
    border-radius: 0;
  }
  .journal-entry small {
    opacity: 0.5;
  }
  .journal-entry strong {
    margin-left: auto;
  }
  .control-hint {
    display: block;
    margin-top: 20px;
    opacity: 0.5;
    font-size: 10px;
    line-height: 1.6;
  }
  @keyframes land {
    from {
      opacity: 0.5;
      scale: 1.12;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
  @keyframes appear {
    from {
      opacity: 0;
      translate: 0 7px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
  @keyframes receipt {
    0% {
      opacity: 0;
      translate: 0 10px;
    }
    15%,
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      translate: 0 -20px;
    }
  }
  @keyframes option-land {
    0% {
      transform: scale(0.97) rotate(-0.4deg);
    }
    70% {
      transform: scale(1.015) rotate(0.2deg);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes road-build {
    from {
      stroke-dashoffset: 80;
      opacity: 0;
    }
    to {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
  @keyframes star-pulse {
    50% {
      transform: scale(1.25) rotate(12deg);
    }
  }
  @media (max-width: 600px) {
    .hand {
      gap: 17px;
    }
    .hand {
      bottom: 64px;
    }
    .own-tile {
      width: 65px;
      height: 65px;
    }
    .loose-meeple {
      width: 23px;
      height: 34px;
    }
    .loose-meeple.large {
      width: 27px;
      height: 39px;
    }
    .meeple-supply {
      gap: 3px;
      flex-wrap: wrap;
      min-width: 0;
      justify-content: center;
    }
    .piece-group {
      gap: 0;
    }
    .attachment {
      width: 23px;
    }
    .player {
      font-size: 10px;
      gap: 4px;
    }
    .player svg {
      width: 20px;
    }
    .player span {
      font-size: 14px;
    }
    .turn-hint {
      top: 145px;
      max-width: 80%;
      width: 80%;
      font-size: 11px;
    }
    .corner-control {
      top: 14px;
    }
    .settings-toggle {
      right: 12px;
    }
    .guide-toggle {
      left: 12px;
    }
    .overview-toggle {
      left: 58px;
    }
    .inspection {
      left: 12px;
      bottom: 180px;
      width: 180px;
    }
    .setup-panel {
      top: 54%;
      padding: 20px;
      max-height: calc(100% - 126px);
    }
    .modules,
    .guide-cards,
    .turn-steps {
      grid-template-columns: 1fr;
    }
    .module-card {
      min-height: 58px;
    }
    .player-chips button {
      flex: 1 1 42%;
    }
    .decision {
      bottom: 170px;
    }
    .drag-piece.drag-tile {
      width: 72px;
      height: 72px;
    }
    .settings-dialog,
    .guide-dialog,
    .overview-dialog {
      padding: 22px;
    }
    .status-strip {
      grid-template-columns: 1fr 1fr;
    }
    .overview-players,
    .watched-features {
      grid-template-columns: 1fr;
    }
    .watchlist-heading {
      align-items: stretch;
      flex-direction: column;
      gap: 10px;
    }
    .watch-filters {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }
    .piece-tooltip {
      position: fixed;
      left: 50%;
      bottom: 142px;
      width: min(250px, calc(100vw - 40px));
    }
    .piece-tooltip::after {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
