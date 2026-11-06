<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import {
    ViewerSkin,
    modal,
    viewerPreferences,
    type BoardProps,
  } from '@board-games/shared/ui';
  import { m } from '@board-games/shared/messages';
  import { loadPixelArt } from './pixel/atlas.svelte.js';
  import PixelIcon from './pixel/PixelIcon.svelte';
  import type { pixelAudio } from './pixel/sound.js';
  import FigureSprite from './table/FigureSprite.svelte';
  import {
    ground,
    lift,
    groundMatrix,
    uprightMatrix,
    screen,
    world as boardWorld,
    unproject,
    zoomAt,
    tableSpace,
    fitCamera,
  } from './table/camera.js';
  import {
    tiles,
    modules,
    presets,
    rotatePoint,
    type Module,
  } from './tiles.js';
  import {
    figureSupply,
    figureTypes,
    node,
    split,
    points,
    type Feature,
    type Figure,
  } from './features.js';
  import type { Action, View, Option } from './index.js';
  import TileArt from './TileArt.svelte';
  import Elevation, { type CityState } from './table/Elevation.svelte';
  import { risingFeatures } from './table/scenery.js';
  import { colors, cityPath, roadPath, fieldPath, ferryPath } from './art.js';
  import { label } from './labels.js';
  import { tableAudio, EventGate, type SoundCue } from './effects.js';
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
    errorCode,
    settingsContent,
    canConfigure = true,
    canRematch = false,
    rematch,
    practice = false,
  }: BoardProps<View, Action> = $props();
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
    overviewScope = $state<FeatureScope>('mine');
  const prefs = viewerPreferences('carcassonne', {
    sound: true as boolean,
    motion: null as boolean | null,
  });
  const motion = $derived(prefs.motion ?? !prefersReducedMotion.current);
  let cx = $state(50),
    cy = $state(50),
    scale = $state(1.5),
    width = $state(800),
    height = $state(600);
  let map: SVGSVGElement;
  let spacePan = $state(false),
    supplyOpen = $state(false);
  const camera = $derived({ x: cx, y: cy, scale });
  const space = $derived(tableSpace(width, height));
  const cameraTransform = $derived(
    `translate(${space.anchor.x} ${space.anchor.y}) scale(${scale}) ${groundMatrix} translate(${-cx} ${-cy})`,
  );
  function pan(dx: number, dy: number) {
    const delta = unproject({ x: dx / scale, y: dy / scale });
    cx -= delta.x;
    cy -= delta.y;
  }
  let settings = $state(false);
  const classicAudio = tableAudio(),
    gate = new EventGate();
  let chiptune: ReturnType<typeof pixelAudio> | undefined;
  // The 8-bit stylesheet, art and chiptune pack load only when chosen, so classic
  // players never download them.
  const skin = new ViewerSkin('carcassonne', async () => {
    const [, pack] = await Promise.all([
      import('./pixel.css'),
      import('./pixel/sound.js'),
      loadPixelArt(),
    ]);
    chiptune ??= pack.pixelAudio();
    chiptune.mute(!prefs.sound);
  });
  const pixel = $derived(skin.pixel);
  // One facade over both sound packs; the chosen skin decides which one plays.
  const audio = {
    get pack() {
      return pixel && chiptune ? chiptune : classicAudio;
    },
    unlock() {
      this.pack.unlock();
    },
    play(kind: SoundCue, delay = 0) {
      this.pack.play(kind, delay);
    },
    events(events: Parameters<typeof classicAudio.events>[0]) {
      this.pack.events(events);
    },
    mute(value: boolean) {
      classicAudio.mute(value);
      chiptune?.mute(value);
    },
    close() {
      classicAudio.close();
      chiptune?.close();
    },
  };
  let ferryPreview = $state<{ tile: string; pair: [string, string] } | null>(
    null,
  );
  let recent = $state<string[]>([]);
  // Cardboard thickness: stacked copies just below each tile on screen.
  const tileEdge = [
    { k: 3.2, fill: '#2b1f12' },
    { k: 2.2, fill: '#6b5436' },
    { k: 1.1, fill: '#9b8158' },
  ].map(({ k, fill }) => ({ ...lift(-k), fill }));
  let rising = $state<string[]>([]);
  let risingTimer: ReturnType<typeof setTimeout>;
  // Clickable regions per tile design never change, so filter them once.
  const regionCache = new Map<string, (typeof tiles)[string]['regions']>();
  const hitRegions = (id: string) => {
    let list = regionCache.get(id);
    if (!list)
      regionCache.set(
        id,
        (list = tiles[id].regions.filter((r) => r.kind !== 'river')),
      );
    return list;
  };
  const rowOrder = $derived(
    Object.entries(p.board).sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x),
  );
  const depthOrder = $derived(
    Object.entries(p.board).sort(
      (a, b) =>
        ground.b * a[1].x +
        ground.d * a[1].y -
        (ground.b * b[1].x + ground.d * b[1].y),
    ),
  );
  const byNode = $derived(
    new Map(p.features.flatMap((f) => f.nodes.map((n) => [n, f] as const))),
  );
  const keeps = $derived(
    new Set(
      p.features
        .filter((f) => f.kind === 'city' && f.complete && f.tiles.length >= 3)
        .map(
          (f) =>
            [...f.nodes].sort((a, b) => {
              const ports = (n: string) => {
                const { tile, region } = split(n);
                return tiles[p.board[tile].id].regions.find(
                  (r) => r.id === region,
                )!.ports.length;
              };
              return ports(b) - ports(a) || a.localeCompare(b);
            })[0],
        ),
    ),
  );
  function cityStates(k: string, id: string): CityState[] {
    return tiles[id].regions
      .filter((r) => r.kind === 'city')
      .map((r) => {
        const f = byNode.get(node(k, r.id));
        return {
          region: r.id,
          complete: !!f?.complete,
          keep: keeps.has(node(k, r.id)),
          rising: !!f && rising.includes(f.id),
        };
      });
  }
  function monasteryState(k: string, id: string) {
    const r = tiles[id].regions.find((r) => r.kind === 'monastery');
    if (!r) return null;
    const f = byNode.get(node(k, r.id));
    return { complete: !!f?.complete, rising: !!f && rising.includes(f.id) };
  }
  let receipts = $state<
    {
      id: number;
      player: string;
      points: number;
      /** World point of the scored feature, for the 8-bit score pop. */
      at: { x: number; y: number } | null;
    }[]
  >([]);
  function scoredAt(e: {
    target?: string;
    tiles?: string[];
  }): { x: number; y: number } | null {
    const keys = (
      e.tiles?.length ? e.tiles : e.target ? [split(e.target).tile] : []
    )
      .map((k) => k.split(',').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (!keys.length) return null;
    return {
      x: (keys.reduce((n, [x]) => n + x, 0) / keys.length) * 100 + 50,
      y: (keys.reduce((n, [, y]) => n + y, 0) / keys.length) * 100 + 50,
    };
  }
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
    if (prefs.sound) audio.unlock();
  }
  function rotate(n: number) {
    unlock();
    rotation = (rotation + n + 4) % 4;
    visualRotation += n;
    if (prefs.sound) audio.play('rotate');
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
      send({
        type: 'place',
        turn: p.turn,
        x: preview!.x,
        y: preview!.y,
        rotation,
      });
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
  function zoom(factor: number, x = space.anchor.x, y = space.anchor.y) {
    const next = zoomAt(camera, space.anchor, { x, y }, factor);
    cx = next.x;
    cy = next.y;
    scale = next.scale;
  }
  function focus(k: string | null) {
    if (!k) return;
    const [x, y] = k.split(',').map(Number);
    cx = x * 100 + 50;
    cy = y * 100 + 50;
    scale = Math.max(scale, 1.1);
  }
  function fit() {
    const next = fitCamera(Object.values(p.board), width, height);
    cx = next.x;
    cy = next.y;
    scale = next.scale;
  }
  function resetCamera() {
    fit();
    // Start close enough to read the painted tiles. Fit remains an explicit
    // overview; a developed landscape can extend beneath the floating UI.
    scale = Math.max(scale, width <= 900 || height <= 540 ? 0.85 : 1.4);
  }
  const pointers = new Map<number, { x: number; y: number }>();
  let start = { x: 0, y: 0 },
    dragged = false;
  function down(e: PointerEvent) {
    if (!spacePan && (e.target as Element).closest('[data-preview]') && mine) {
      beginDrag('tile', e);
      return;
    }
    if (drag || e.button !== 0) return;
    unlock();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY };
    dragged = spacePan || pointers.size > 1;
    map.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (drag) return;
    const old = pointers.get(e.pointerId);
    if (!old) return;
    const dx = e.clientX - old.x,
      dy = e.clientY - old.y;
    const previous = [...pointers.values()];
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
      dragged = true;
    const list = [...pointers.values()];
    if (list.length === 2) {
      dragged = true;
      const distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const previousDistance = Math.hypot(
        previous[0].x - previous[1].x,
        previous[0].y - previous[1].y,
      );
      const r = map.getBoundingClientRect();
      pan(dx / 2, dy / 2);
      if (previousDistance)
        zoom(
          distance / previousDistance,
          (list[0].x + list[1].x) / 2 - r.left,
          (list[0].y + list[1].y) / 2 - r.top,
        );
    } else if (dragged) {
      pan(dx, dy);
    }
  }
  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (dragged || drag || spacePan) return;
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
    if (e.key === ' ') {
      e.preventDefault();
      spacePan = true;
      return;
    }
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      pan(
        e.key === 'ArrowLeft' ? 80 : e.key === 'ArrowRight' ? -80 : 0,
        e.key === 'ArrowUp' ? 80 : e.key === 'ArrowDown' ? -80 : 0,
      );
      return;
    }
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
  // The journal lists public outcomes; draws are private bookkeeping.
  const journalEntries = $derived(
    [...p.events].reverse().filter((e) => e.kind !== 'draw'),
  );
  function showEvent(target: string) {
    selected = target;
    focus(split(target).tile);
    // Compact screens have no room beside the panel; reveal the map instead.
    if (width <= 900 || height <= 540) journal = false;
  }
  function focusFeature(value: Feature) {
    selected = value.id;
    focus(split(value.id).tile);
    overview = false;
    requestAnimationFrame(() => map?.focus({ preventScroll: true }));
  }
  function toggleModule(id: (typeof setupOptions)[number]) {
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
  function resetChoice() {
    preview = null;
    rotation = 0;
    visualRotation = 0;
    selected = '';
    ferryPreview = null;
    tool = null;
    attachment = undefined;
    drag = null;
    clearTimeout(returnTimer);
  }
  const outdated = $derived(
    errorCode === 'STALE_REVISION' || errorCode === 'MATCH_CHANGED',
  );
  $effect(() => {
    void choiceIdentity;
    untrack(resetChoice);
  });
  $effect(() => {
    if (outdated) untrack(resetChoice);
  });
  $effect(() => {
    const events = gate.take(round, p.events, connected);
    audio.mute(!prefs.sound);
    if (events.length) {
      audio.events(events);
      receipts = events
        .filter((e) => e.points && e.player)
        .map((e) => ({
          id: e.id,
          player: e.player!,
          points: e.points!,
          at: scoredAt(e),
        }));
      recent = events.filter((e) => e.target).map((e) => split(e.target!).tile);
      const lifted = events
        .filter((e) => e.kind === 'place' && e.target)
        .flatMap((e) => risingFeatures(p.features, e.target!));
      if (lifted.length) {
        rising = lifted;
        audio.play('build', 0.15);
        clearTimeout(risingTimer);
        risingTimer = setTimeout(() => (rising = []), 1800);
      }
      clearTimeout(recentTimer);
      recentTimer = setTimeout(() => {
        recent = [];
        receipts = [];
      }, 2400);
    }
  });
  $effect(() => {
    void round;
    overview = false;
    overviewScope = 'mine';
    spacePan = false;
    supplyOpen = false;
    untrack(resetCamera);
  });
  onMount(() => {
    let firstSize = true;
    const observer = new ResizeObserver((entries) => {
      width = entries[0].contentRect.width;
      height = entries[0].contentRect.height;
      if (firstSize) {
        firstSize = false;
        resetCamera();
      }
    });
    observer.observe(map);
    return () => {
      observer.disconnect();
      audio.close();
      clearTimeout(risingTimer);
      clearTimeout(recentTimer);
      clearTimeout(returnTimer);
    };
  });
  function toggleSound() {
    prefs.sound = !prefs.sound;
    audio.mute(!prefs.sound);
    if (prefs.sound) audio.unlock();
  }

  type Piece = Figure['type'];
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
  const ownedTypes = $derived(figureTypes(p.config.modules));
  function available(type: Piece) {
    return (
      figureSupply(type) -
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
  const canUse = (kind: 'tile' | Piece) =>
    kind === 'tile' ? p.phase === 'place' && mine : usable(kind);
  function takeTool(kind: 'tile' | Piece) {
    unlock();
    tool = kind;
    selected = '';
    if (kind === 'tile') attachment = undefined;
  }
  function pick(kind: 'tile' | Piece) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!canUse(kind)) return;
    takeTool(kind);
    map?.focus({ preventScroll: true });
  }
  function beginDrag(kind: 'tile' | Piece, e: PointerEvent) {
    if (e.button !== 0 || drag || !canUse(kind)) return;
    e.preventDefault();
    e.stopPropagation();
    takeTool(kind);
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
    return boardWorld(
      { x: clientX - r.left, y: clientY - r.top },
      camera,
      space.anchor,
    );
  }
  function dropRef(x: number, y: number) {
    let closest: string | undefined;
    let distance = Math.max(18, 20 * scale);
    const pointer = screen({ x, y }, camera, space.anchor);
    for (const o of pieceOptions) {
      const { tile, region } = split(o.target!);
      const cell = p.board[tile];
      const r = tiles[cell.id].regions.find((v) => v.id === region)!;
      const a = rotatePoint(r.anchor, cell.rotation);
      const target = screen(
        { x: cell.x * 100 + a[0], y: cell.y * 100 + a[1] },
        camera,
        space.anchor,
      );
      const d = Math.hypot(target.x - pointer.x, target.y - pointer.y);
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
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const onMap = !!hit && (hit === map || map.contains(hit));
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
  onkeyup={(e) => {
    if (e.key === ' ') spacePan = false;
  }}
  onpointermove={dragMove}
  onpointerup={dragEnd}
  onpointercancel={cancelDrag}
  onblur={() => {
    spacePan = false;
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
<div
  class="carc-table"
  class:px-tokens={pixel}
  class:cc-pixel={pixel}
  class:carrying={!!drag?.moved}
  class:supply-open={supplyOpen}
  class:motion
>
  <header class="table-header">
    <span class="fleur" aria-hidden="true"
      >{#if pixel}<PixelIcon name="castle" />{:else}⚜{/if}</span
    ><span class="table-title">Carcassonne</span>
    <span class="edition-tag">{t('edition')}</span>
  </header>
  <div class="landscape">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The map is a keyboard-operated application; native controls provide equivalent actions.) -->
    <svg
      bind:this={map}
      class="map"
      viewBox={`0 0 ${width} ${height}`}
      role="application"
      aria-label={t('controls')}
      tabindex="0"
      onkeydown={keyboard}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={(e) => {
        pointers.delete(e.pointerId);
        dragged = true;
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
      <g class="board-plane" transform={cameraTransform}>
        {#each rowOrder as [k, tile] (k)}<g
            transform={`translate(${tile.x * 100} ${tile.y * 100})`}
            class:landed={recent.includes(k)}
          >
            <rect
              x="2"
              y="5"
              width="97"
              height="98"
              rx={pixel ? 0 : 2}
              fill="#080d08"
              opacity=".35"
            />
            {#each tileEdge as e}<rect
                width="100"
                height="100"
                rx={pixel ? 0 : 1.2}
                fill={e.fill}
                transform={`translate(${e.x} ${e.y})`}
              />{/each}
            <g class="tile-surface"
              ><TileArt
                id={tile.id}
                rotation={tile.rotation}
                {pixel}
                x={tile.x}
                y={tile.y}
              /></g
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
          </g>{/each}
        {#each depthOrder as [k, tile] (k)}<g
            transform={`translate(${tile.x * 100} ${tile.y * 100})`}
            class:landed={recent.includes(k)}
            ><Elevation
              id={tile.id}
              rotation={tile.rotation}
              tileKey={k}
              cities={cityStates(k, tile.id)}
              monastery={monasteryState(k, tile.id)}
              detail={scale >= 0.45}
              {pixel}
            />
            {#each p.figures.filter((f) => f.tile === k) as f, i}
              {@const r = tiles[tile.id].regions.find(
                (r) => r.id === f.region,
              )!}{@const a = rotatePoint(
                r.anchor,
                tile.rotation,
              )}{@const index = p.players.indexOf(f.owner)}
              <g
                transform={`translate(${a[0] + (i % 2) * 4} ${a[1]}) ${uprightMatrix} rotate(${r.kind === 'field' ? 75 : 0}) scale(${f.type === 'large' ? 1.75 : 1.3})`}
                class="figure"
                data-region={node(k, f.region)}
                ><FigureSprite color={colors[index]} type={f.type} {pixel} />
                {#if f.attachment}<g transform="translate(17 6) scale(.65)"
                    ><FigureSprite
                      color={colors[index]}
                      type={f.attachment}
                      {pixel}
                    /></g
                  >{/if}</g
              >
            {/each}
            {#each ['mage', 'witch'] as magic}{#if p.magic[magic as 'mage' | 'witch']?.startsWith(k + '/')}<path
                  d="M69 33L77 11L85 33Z"
                  fill={magic === 'mage' ? '#bd965a' : '#80629d'}
                  stroke="#f3dfaa"
                />{/if}{/each}
          </g>{/each}
        {#each Object.entries(p.board) as [k, tile] (k)}<g
            transform={`translate(${tile.x * 100} ${tile.y * 100})`}
          >
            {#each hitRegions(tile.id) as r}
              {@const a = rotatePoint(r.anchor, tile.rotation)}{@const ref =
                node(k, r.id)}{@const legal = legalRefs.has(ref)}
              <circle
                data-region={ref}
                data-legal={legal ? 'true' : undefined}
                role={legal ? 'button' : undefined}
                tabindex={legal ? 0 : undefined}
                aria-label={legal
                  ? `${t('meeple')} · ${t(r.kind)} (${tile.x}, ${tile.y})`
                  : undefined}
                onkeydown={(e) => {
                  if (legal && (e.key === 'Enter' || e.key === ' ')) {
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
                stroke={legal ? '#ffebaf' : 'transparent'}
                stroke-width="1.7"
                stroke-dasharray="2 2"
                class="region"
                ><title>{t(r.kind)} ({tile.x}, {tile.y})</title></circle
              >{#if pixel && legal}<g
                  class="px-target"
                  transform={`translate(${a[0]} ${a[1]}) ${uprightMatrix}`}
                  pointer-events="none"
                  ><path
                    class="px-target-arrow"
                    d="M-4 -24h8v6h4l-8 8l-8 -8h4z"
                    fill="#ffe08a"
                    stroke="#22160e"
                    stroke-width="1.6"
                    shape-rendering="crispEdges"
                  /></g
                >{/if}
            {/each}
          </g>{/each}
        {#if p.phase === 'place' && mine && tool === 'tile'}{#each locations as loc}<g
              transform={`translate(${loc.x * 100} ${loc.y * 100})`}
              data-location={`${loc.x},${loc.y}`}
              class="slot"
              ><rect
                x="4"
                y="4"
                width="92"
                height="92"
                rx="3"
                fill="#8fdc6a"
                fill-opacity=".1"
                stroke="#b9ff8c"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-dasharray=".1 4.2"
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
              style={pixel
                ? ''
                : `transform:rotate(${visualRotation * 90}deg);transform-origin:50px 50px`}
              >{#if pixel}<TileArt
                  id={p.current}
                  {rotation}
                  pixel
                  x={preview.x}
                  y={preview.y}
                />{:else}<TileArt id={p.current} />{/if}</g
            ><rect
              x="2"
              y="2"
              width="96"
              height="96"
              fill="none"
              stroke={valid ? '#eaffb7' : '#ee795e'}
              stroke-width="4"
              class="ghost-frame"
              class:invalid={!valid}
            /></g
          >{/if}
      </g>
    </svg>

    <div class="receipts" aria-live="polite">
      {#each receipts as receipt (receipt.id)}<div
          style={`--seat:${colors[p.players.indexOf(receipt.player)] ?? '#fff'}`}
        >
          {#if pixel}<svg
              class="receipt-meeple"
              viewBox="-16 -18 32 33"
              aria-hidden="true"
              ><FigureSprite
                color={colors[p.players.indexOf(receipt.player)] ?? '#fff'}
                shadow={false}
                pixel
              /></svg
            >{/if}
          {name(receipt.player)} <strong>+{receipt.points}</strong>
        </div>{/each}
    </div>
    {#if pixel}{#each receipts as receipt (receipt.id)}{#if receipt.at}{@const at =
            screen(receipt.at, camera, space.anchor)}
          <div
            class="px-pop"
            style={`left:${at.x}px;top:${at.y}px;--seat:${colors[p.players.indexOf(receipt.player)] ?? '#fff'}`}
            aria-hidden="true"
          >
            <span class="px-burst"></span><b>+{receipt.points}</b>
          </div>{/if}{/each}{/if}
    {#if journal}<aside class="journal" aria-label={t('history')}>
        <header>
          <h2>{t('history')}</h2>
          <button
            class="close"
            aria-label={t('close')}
            onclick={() => (journal = false)}>×</button
          >
        </header>
        {#if journalEntries.length}<ol>
            {#each journalEntries as e (e.id)}
              {@const seat = e.player ? p.players.indexOf(e.player) : -1}
              <li>
                {#snippet entry()}<small>{t('turn')} {e.turn}</small
                  >{#if seat >= 0}<i style={`background:${colors[seat]}`}
                    ></i>{/if}<span
                    >{e.player ? name(e.player) + ' · ' : ''}{t(
                      e.kind,
                    )}{e.feature ? ' · ' + t(e.feature) : ''}</span
                  >{#if e.points}<strong>+{e.points}</strong
                    >{/if}{#if e.target}<svg
                      class="pin"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      ><path
                        d="M8 14.5s4.5-4.3 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.5 4.5 7.8 4.5 7.8Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.3"
                      /><circle
                        cx="8"
                        cy="6.7"
                        r="1.6"
                        fill="currentColor"
                      /></svg
                    >{/if}{/snippet}
                {#if e.target}<button
                    class="journal-entry linked"
                    title={t('show_on_map')}
                    onclick={() => showEvent(e.target!)}
                    >{@render entry()}</button
                  >{:else}<div class="journal-entry">
                    {@render entry()}
                  </div>{/if}
              </li>
            {/each}
          </ol>{:else}<p class="journal-empty">{t('journal_empty')}</p>{/if}
      </aside>{/if}
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
  <div class="players" aria-label={t('players')}>
    {#each players as player, i}
      {@const remaining =
        7 -
        p.figures.filter((f) => f.owner === player.id && f.type === 'meeple')
          .length}
      <div
        class="player"
        class:active={who === player.id}
        class:self={player.id === playerId}
        class:offline={player.connected === false}
        style={`--seat:${colors[i]}`}
      >
        <svg class="portrait-piece" viewBox="-16 -18 32 33" aria-hidden="true"
          ><FigureSprite color={colors[i]} {pixel} /></svg
        >
        <strong title={player.name}>{player.name}</strong>
        <span class="player-score"
          >{p.scores[player.id][0] + p.scores[player.id][1]}</span
        >
        <span
          class="player-supply"
          aria-label={`${t('meeple')} · ${remaining}`}
        >
          {#each Array(remaining) as _}<svg
              viewBox="-15 -17 30 31"
              aria-hidden="true"
              ><FigureSprite color={colors[i]} shadow={false} {pixel} /></svg
            >{/each}
        </span>
        {#if player.connected === false}<small class="connection-status"
            >{t('disconnected')}</small
          >{/if}
        {#if p.phase === 'setup' && p.ready.includes(player.id)}<small
            class="ready-mark">✓</small
          >{/if}
      </div>
    {/each}
  </div>
  <nav class="camera-controls" aria-label={t('camera')}>
    <button
      onclick={() => zoom(1.2)}
      aria-label={t('zoom_in')}
      title={t('zoom_in')}
      >{#if pixel}<PixelIcon name="plus" />{:else}+{/if}</button
    >
    <button
      onclick={() => zoom(1 / 1.2)}
      aria-label={t('zoom_out')}
      title={t('zoom_out')}
      >{#if pixel}<PixelIcon name="minus" />{:else}−{/if}</button
    >
    <button onclick={fit} aria-label={t('fit')} title={t('fit')}
      >{#if pixel}<PixelIcon name="fit" />{:else}⛶{/if}</button
    >
    <button
      onclick={() => focus(p.last)}
      aria-label={t('last')}
      title={t('last')}
      disabled={!p.last}
      >{#if pixel}<PixelIcon name="target" />{:else}⌖{/if}</button
    >
    <details class="pan-menu">
      <summary aria-label={t('pan')} title={t('pan')}
        >{#if pixel}<PixelIcon name="pan" />{:else}✥{/if}</summary
      >
      <div class="pan-buttons">
        <button onclick={() => pan(0, 100)} aria-label={t('pan_up')}>↑</button>
        <button onclick={() => pan(100, 0)} aria-label={t('pan_left')}>←</button
        >
        <button onclick={() => pan(-100, 0)} aria-label={t('pan_right')}
          >→</button
        >
        <button onclick={() => pan(0, -100)} aria-label={t('pan_down')}
          >↓</button
        >
      </div>
    </details>
  </nav>
  <p class="camera-hint">{t('camera_hint')}</p>
  {#if outdated}<p class="notice" role="status">
      {errorCode === 'MATCH_CHANGED'
        ? m.action_match_changed({}, { locale })
        : m.action_stale({}, { locale })}
    </p>{/if}
  <button
    class="guide-toggle corner-control"
    onclick={() => (guide = true)}
    aria-label={t('guide')}
    title={t('guide')}
    >{#if pixel}<PixelIcon name="guide" />{:else}<svg
        viewBox="0 0 28 28"
        aria-hidden="true"
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
      >{/if}</button
  >
  {#if p.phase !== 'setup'}<button
      class="journal-toggle corner-control"
      onclick={() => (journal = !journal)}
      aria-label={t('history')}
      aria-expanded={journal}
      title={t('history')}
      >{#if pixel}<PixelIcon name="journal" />{:else}<svg
          viewBox="0 0 28 28"
          aria-hidden="true"
          ><path
            d="M8 5h13a2 2 0 0 1 2 2v1h-4M8 5a2 2 0 0 0-2 2v14a2.5 2.5 0 0 1-2.5 2.5H18a2.5 2.5 0 0 0 2.5-2.5V8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          /><path
            d="M10 11h7M10 15h7M10 19h4"
            stroke="#e9c879"
            stroke-width="1.3"
            stroke-linecap="round"
          /></svg
        >{/if}</button
    ><button
      class="overview-toggle corner-control"
      onclick={() => (overview = true)}
      aria-label={t('board_overview')}
      title={t('board_overview')}
      >{#if pixel}<PixelIcon name="overview" />{:else}<svg
          viewBox="0 0 28 28"
          aria-hidden="true"
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
        >{/if}</button
    >{/if}
  <button
    class="settings-toggle corner-control"
    onclick={() => (settings = true)}
    aria-label={t('settings')}
    title={t('settings')}
    >{#if pixel}<PixelIcon name="settings" />{:else}<svg
        viewBox="0 0 28 28"
        aria-hidden="true"
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
      >{/if}</button
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
        </p>{/each}<button onclick={() => (journal = true)}
        >{t('history')}</button
      >{#if canRematch}<button class="primary" onclick={rematch}
          >{m.rematch({}, { locale })}</button
        >{/if}
    </section>
  {:else}
    <div class="turn-hint" aria-live="polite">
      <span class="turn-line"
        ><span class="medallion" aria-hidden="true"
          >{#if pixel}<PixelIcon name="meeple" />{:else}⚜{/if}</span
        >{name(who)} · {t('turn')}
        {p.turn}</span
      >
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
    <div class="hand" aria-label={t('your_pieces')}>
      <div class="tray-heading">
        <span>{p.phase === 'place' ? t('current') : t('your_pieces')}</span
        ><small>{name(playerId)}</small>
      </div>
      {#if p.current}<div class="tile-stack">
          <span class="deck-count" title={t('remaining')}>{p.remaining}</span
          ><button
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
              >{#if pixel}{#key rotation}<g class="px-turn"
                    ><TileArt id={p.current} {rotation} pixel /></g
                  >{/key}{:else}<g
                  class="rotating"
                  style={`transform:rotate(${visualRotation * 90}deg);transform-origin:50px 50px`}
                  ><TileArt id={p.current} /></g
                >{/if}</svg
            ></button
          >
        </div>{/if}
      {#if p.phase === 'place'}<div class="placement-controls">
          <button
            class="rotate-main"
            onclick={() => rotate(1)}
            disabled={!mine}
            aria-label={t('rotate_right')}
            title={t('rotate_right')}
            >{#if pixel}<PixelIcon name="rotate" />{:else}⟳{/if}</button
          >
          <span class="rotate-caption">{t('rotate')}</span>
          {#if preview}<div class="confirm-row">
              <button
                onclick={() => rotate(-1)}
                aria-label={t('rotate_left')}
                title={t('rotate_left')}
                >{#if pixel}<PixelIcon
                    name="rotate-left"
                  />{:else}↶{/if}</button
              >
              <button
                class="confirm"
                onclick={place}
                disabled={!valid || !mine}
                aria-label={t('confirm')}
                >{#if pixel}<PixelIcon name="check" />{:else}✓{/if}</button
              >
              <button
                class="cancel"
                onclick={dismissPreview}
                aria-label={t('cancel')}
                >{#if pixel}<PixelIcon name="cross" />{:else}×{/if}</button
              >
            </div>
            {#if !valid}<small>{t('mismatch')}</small>{/if}{/if}
        </div>{/if}
      <button
        class="supply-toggle"
        aria-expanded={supplyOpen}
        onclick={() => (supplyOpen = !supplyOpen)}
        >{t('your_pieces')} {supplyOpen ? '⌄' : '⌃'}</button
      >
      <div class="meeple-supply">
        {#each ownedTypes as type}<div class="piece-group">
            {#each Array(figureSupply(type)) as _, i}
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
                    ><FigureSprite color={ownColor} {type} {pixel} /></svg
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
                ><svg viewBox="-17 -17 36 36" aria-hidden="true"
                  ><FigureSprite color={ownColor} type={kind} {pixel} /></svg
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
          ><TileArt id={p.current} {rotation} {pixel} /></svg
        >{:else}<svg viewBox="-16 -18 32 36"
          ><FigureSprite color={ownColor} type={drag.kind} {pixel} /></svg
        >{/if}
    </div>{/if}

  <dialog
    {@attach modal(() => overview)}
    onclose={() => (overview = false)}
    class="overview-dialog"
    class:px-tokens={pixel}
    class:cc-pixel={pixel}
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
    {@attach modal(() => guide)}
    onclose={() => (guide = false)}
    class="guide-dialog"
    class:px-tokens={pixel}
    class:cc-pixel={pixel}
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
    {@attach modal(() => settings)}
    onclose={() => (settings = false)}
    class="settings-dialog"
    class:px-tokens={pixel}
    class:cc-pixel={pixel}
  >
    <button
      class="close"
      aria-label={t('close')}
      onclick={() => (settings = false)}>×</button
    >
    <p class="eyebrow">CARCASSONNE · 3.1</p>
    <h2>{t('settings')}</h2>
    <div class="settings-grid">
      <button onclick={toggleSound} aria-pressed={prefs.sound}
        >{t('sound')} · {prefs.sound ? t('on') : t('off')}</button
      ><button onclick={() => (prefs.motion = !motion)} aria-pressed={motion}
        >{t('motion')} · {motion ? t('on') : t('off')}</button
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
      >
    </div>
    <fieldset class="skin-choice">
      <legend>{m.skin({}, { locale })}</legend>
      {#each [['classic', m.skin_classic({}, { locale })], ['pixel', m.skin_pixel({}, { locale })]] as [value, text]}<label
          ><input
            type="radio"
            name="carc-skin"
            {value}
            checked={skin.choice === value}
            onchange={() => skin.choose(value as 'classic' | 'pixel')}
          /><span>{text}</span></label
        >{/each}
    </fieldset>
    {#if settingsContent}{@render settingsContent()}{/if}
    <small class="control-hint">{t('controls')}</small>
  </dialog>
</div>

<style>
  @font-face {
    font-family: 'Carcassonne Display';
    src: url('/fonts/carcassonne/marcellus.woff2') format('woff2');
    font-display: swap;
  }
  .carc-table {
    position: fixed;
    inset: 0;
    overflow: hidden;
    isolation: isolate;
    color: #f3e8d2;
    font-family: Georgia, 'Times New Roman', serif;
    background: #302014 url('/games/carcassonne/table.webp') center / cover;
    --brass: #b59a65;
    --ink: #211b15;
    --paper: #e8d6af;
  }
  .landscape {
    position: absolute;
    inset: 0;
  }
  .map {
    width: 100%;
    height: 100%;
    touch-action: none;
    display: block;
    cursor: grab;
    outline: none;
  }
  .map:active {
    cursor: grabbing;
  }
  .map:focus-visible {
    box-shadow: inset 0 0 0 2px #d9bd78aa;
  }
  .table-header {
    position: absolute;
    z-index: 3;
    inset: 0 0 auto;
    height: 62px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 26px;
    background: linear-gradient(100deg, #14120ff5, #292219ed 70%, #191612f5);
    border: 1px solid #b19360;
    border-top: 0;
    border-radius: 0 0 18px 18px;
    box-shadow:
      0 5px 16px #0007,
      inset 0 -3px 0 #09070566;
    pointer-events: none;
  }
  .fleur {
    color: #c0a06b;
    font-size: 36px;
    text-shadow: 0 2px 2px #000;
  }
  .table-title {
    font-family: 'Carcassonne Display', Georgia, serif;
    font-size: 28px;
    letter-spacing: 0.02em;
    color: #f2dfb7;
  }
  .edition-tag {
    display: none;
  }
  button,
  summary {
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button {
    padding: 10px 14px;
    border: 1px solid #b59a6566;
    border-radius: 4px;
    background: linear-gradient(145deg, #342c21, #1e1b17);
    box-shadow: inset 0 1px #ead6ab17;
  }
  button:hover:not(:disabled):not([aria-disabled='true']) {
    background: #4a3b28;
    border-color: #d5ba82;
  }
  button:disabled,
  button[aria-disabled='true'] {
    cursor: default;
  }
  button:disabled {
    opacity: 0.5;
  }
  button:focus-visible,
  summary:focus-visible {
    outline: 2px solid #f8df98;
    outline-offset: 3px;
  }
  svg {
    display: block;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1,
  h2,
  h3 {
    font-family: 'Carcassonne Display', Georgia, serif;
    font-weight: 400;
  }
  h1 {
    font-size: 28px;
  }
  h2 {
    font-size: 21px;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: 12px;
  }
  .players {
    position: absolute;
    top: 84px;
    left: 18px;
    width: 198px;
    display: grid;
    gap: 12px;
    pointer-events: none;
  }
  .player {
    position: relative;
    display: grid;
    grid-template-columns: 44px 1fr;
    grid-template-rows: 22px 28px;
    align-items: center;
    column-gap: 10px;
    min-width: 0;
    padding: 12px;
    background: linear-gradient(130deg, #242018f2, #131311ed);
    border: 1px solid #8e7854;
    border-radius: 7px 13px 7px 7px;
    box-shadow:
      0 4px 10px #0005,
      inset 0 0 0 3px #ead1a007;
  }
  .player.active {
    border-color: #d7b26d;
    box-shadow:
      0 4px 10px #0006,
      inset 3px 0 var(--seat);
  }
  .player.self strong::after {
    content: ' ·';
    color: #d9b66f;
  }
  .player .portrait-piece {
    width: 46px;
    height: 50px;
    grid-row: 1 / 3;
    filter: drop-shadow(0 2px 2px #0008);
  }
  .player strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 400;
  }
  .player-score {
    font-size: 25px;
    font-variant-numeric: tabular-nums;
  }
  .player-supply {
    position: absolute;
    bottom: 15px;
    right: 10px;
    display: flex;
    max-width: 104px;
  }
  .player-supply svg {
    flex: none;
    width: 15px;
    height: 17px;
    filter: drop-shadow(0 1px 1px #000a);
  }
  .player-supply svg + svg {
    margin-left: -2px;
  }
  .connection-status {
    position: absolute;
    top: 2px;
    right: 5px;
    font-size: 8px;
    color: #e5b98d;
  }
  .ready-mark {
    position: absolute;
    right: 9px;
    top: 8px;
    color: #daca96;
  }
  .corner-control {
    position: absolute;
    top: 10px;
    z-index: 4;
    width: 41px;
    height: 41px;
    padding: 9px;
    border: 1px solid #ac926970;
    border-radius: 50%;
    color: #d9c7a6;
    background: linear-gradient(140deg, #342c21, #171613);
    box-shadow: 0 2px 3px #0005;
  }
  .corner-control svg {
    width: 22px;
    height: 22px;
  }
  .guide-toggle {
    right: 120px;
  }
  .overview-toggle {
    right: 70px;
  }
  .settings-toggle {
    right: 20px;
  }
  .turn-hint {
    position: absolute;
    z-index: 3;
    top: 0;
    left: 310px;
    right: 190px;
    height: 62px;
    display: flex;
    align-items: center;
    gap: 22px;
    color: #eadfca;
    pointer-events: none;
  }
  .turn-line {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15px;
    padding-left: 22px;
    border-left: 1px solid #c9b48430;
  }
  .medallion {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid #c9b48470;
    background: radial-gradient(#4a3a26, #231a10);
    color: #dcc38e;
    font-size: 13px;
    box-shadow: inset 0 1px 0 #fff2c833;
  }
  .turn-hint p {
    font-size: 15px;
    line-height: 1.3;
    border-left: 1px solid #c9b48430;
    padding-left: 22px;
  }
  .turn-hint small {
    font-size: 10px;
    color: #e4ac82;
  }
  .camera-controls {
    position: absolute;
    right: 22px;
    bottom: 25px;
    display: flex;
    align-items: center;
    padding: 5px;
    border: 1px solid #b49a685e;
    border-radius: 7px;
    background: #1b1915ee;
    box-shadow: 0 4px 15px #0006;
  }
  .camera-controls button,
  .pan-menu summary {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 35px;
    height: 35px;
    padding: 0;
    border: 0;
    background: transparent;
    font-size: 22px;
  }
  .camera-controls button + button {
    border-left: 1px solid #b49a682b;
    border-radius: 0;
  }
  .pan-menu summary {
    list-style: none;
  }
  .pan-menu summary::-webkit-details-marker {
    display: none;
  }
  .pan-buttons {
    position: absolute;
    bottom: 55px;
    right: 0;
    display: grid;
    grid-template-columns: repeat(2, 44px);
    padding: 6px;
    background: #1b1915f5;
    border: 1px solid #b49a68;
    border-radius: 5px;
  }
  .pan-buttons button {
    width: 44px;
    height: 44px;
  }
  .notice {
    position: absolute;
    z-index: 5;
    top: 72px;
    left: 50%;
    max-width: min(480px, calc(100% - 32px));
    transform: translateX(-50%);
    padding: 8px 14px;
    border-radius: 4px;
    background: #f2d7ba;
    color: #723f33;
    font-size: 13px;
    pointer-events: none;
  }
  .camera-hint {
    position: absolute;
    bottom: 18px;
    left: 24px;
    color: #d2bd91;
    font:
      11px Georgia,
      serif;
    pointer-events: none;
    text-shadow: 0 1px 2px #000;
  }
  .hand {
    position: absolute;
    bottom: 26px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 25px;
    padding: 42px 25px 20px;
    max-width: calc(100% - 460px);
    min-width: 310px;
    box-sizing: border-box;
    user-select: none;
    background: linear-gradient(135deg, #29271def, #181813f5 50%, #252016f5);
    border: 1px solid #b4965f;
    border-radius: 15px 5px 15px 5px;
    box-shadow:
      0 12px 26px #0007,
      inset 0 0 0 4px #c4a46a0b;
  }
  .tray-heading {
    position: absolute;
    top: 12px;
    left: 24px;
    right: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    font-size: 17px;
  }
  .tray-heading small {
    font-size: 11px;
    color: #b8a481;
  }
  .tile-stack {
    position: relative;
    flex-shrink: 0;
  }
  .deck-count {
    position: absolute;
    left: -10px;
    bottom: -7px;
    z-index: 1;
    background: #2c251c;
    color: #e6d3ab;
    border: 1px solid #b59a65;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    font-size: 11px;
  }
  .own-tile {
    width: 106px;
    height: 106px;
    padding: 0;
    border: 0;
    border-radius: 2px;
    background: none;
    box-shadow:
      0 3px #8b7852,
      0 6px #4c3c24,
      0 9px 14px #0008;
    touch-action: none;
    transition:
      transform 0.2s,
      opacity 0.2s;
  }
  .own-tile:hover:not(:disabled),
  .own-tile.picked {
    background: none;
    transform: translateY(-3px);
    outline: 1px solid #e5cf8b;
    outline-offset: 3px;
  }
  .own-tile.in-map,
  .own-tile.lifted {
    opacity: 0.4;
  }
  .own-tile svg {
    width: 100%;
    height: 100%;
  }
  .rotating {
    transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  .placement-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 80px;
  }
  .placement-controls .rotate-main {
    width: 62px;
    height: 62px;
    padding: 0;
    border-radius: 50%;
    font-size: 49px;
    line-height: 1;
    border-color: #b8a078;
    color: #e4d8bd;
  }
  .rotate-caption {
    font-size: 13px;
  }
  .confirm-row {
    display: flex;
    gap: 3px;
    margin-top: 2px;
  }
  .confirm-row button {
    width: 30px;
    height: 29px;
    padding: 0;
    font-size: 20px;
  }
  .confirm-row .confirm {
    background: #d4c08b;
    color: #263221;
  }
  .placement-controls small {
    width: 110px;
    font-size: 10px;
    text-align: center;
    color: #e6b48a;
  }
  .meeple-supply {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 7px;
    max-width: 280px;
    padding-left: 16px;
    border-left: 1px solid #b59a653b;
  }
  .piece-group {
    display: flex;
    align-items: center;
    gap: 1px;
  }
  .piece-wrap {
    position: relative;
    display: inline-grid;
    place-items: center;
  }
  .loose-meeple,
  .attachment {
    width: 29px;
    height: 41px;
    border: 0;
    box-shadow: none;
    background: none;
    padding: 0;
    flex-shrink: 0;
    touch-action: none;
    transform: rotate(var(--lean, 0deg));
    transition:
      transform 0.2s,
      opacity 0.2s;
  }
  .loose-meeple.large {
    width: 34px;
    height: 47px;
  }
  .loose-meeple svg,
  .attachment svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .loose-meeple:hover:not([aria-disabled='true']),
  .loose-meeple.picked,
  .attachment.picked,
  .attachment:hover:not([aria-disabled='true']) {
    background: none;
    transform: translateY(-7px);
  }
  .loose-meeple.used {
    opacity: 0.15;
  }
  .piece-tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    z-index: 30;
    width: 180px;
    padding: 12px;
    background: #e7d5ae;
    border: 1px solid #a7874e;
    color: #40321f;
    box-shadow: 0 6px 20px #0005;
    font-size: 11px;
    line-height: 1.5;
    pointer-events: none;
    opacity: 0;
    transform: translateX(-50%);
  }
  .piece-tooltip strong,
  .piece-tooltip span {
    display: block;
  }
  .piece-wrap:hover .piece-tooltip,
  .piece-wrap:focus-within .piece-tooltip {
    opacity: 1;
  }
  .supply-toggle {
    display: none;
  }
  .hand-actions {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .hand-actions button {
    font-size: 12px;
    min-width: 110px;
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
    width: 106px;
    height: 106px;
  }
  .drag-piece svg {
    width: 100%;
    height: 100%;
  }
  .drag-piece.returning {
    transition:
      left 0.2s cubic-bezier(0.3, 0.8, 0.3, 1),
      top 0.2s cubic-bezier(0.3, 0.8, 0.3, 1);
    transform: translate(-50%, -50%);
  }
  .carrying {
    cursor: grabbing;
  }
  .ghost {
    filter: drop-shadow(0 3px 2px #0006);
  }
  .landed .tile-surface {
    animation: land 0.3s ease-out;
    transform-origin: 50px 50px;
  }
  .region {
    cursor: pointer;
  }
  .decision {
    position: absolute;
    right: 24px;
    bottom: 105px;
    width: 250px;
    max-width: calc(100% - 40px);
    max-height: calc(100% - 190px);
    overflow: auto;
    padding: 20px;
    box-sizing: border-box;
    background: linear-gradient(120deg, #efdfb9, #d4ba88);
    color: #3c301f;
    border: 1px solid #b19762;
    border-radius: 3px 10px 4px 8px;
    box-shadow: 0 8px 30px #0006;
  }
  .decision h2 {
    font-size: 17px;
    margin-bottom: 10px;
  }
  .decision p {
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .choices {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .choices button {
    font-size: 11px;
    background: #efe2c2;
    color: #49361d;
  }
  .choices button:hover:not(:disabled) {
    background: #fff1cd;
  }
  .inspection {
    position: absolute;
    right: 24px;
    top: 94px;
    width: 236px;
    box-sizing: border-box;
    max-height: calc(100% - 320px);
    overflow: auto;
    background: linear-gradient(135deg, #eee0be, #d7bf91);
    color: #443522;
    padding: 22px;
    border: 1px solid #ac8d55;
    border-radius: 3px 9px 3px 8px;
    box-shadow: 0 7px 25px #0005;
    font-size: 12px;
    line-height: 1.7;
  }
  .inspection h3 {
    margin: 0;
  }
  .inspection p {
    margin: 5px 0;
  }
  .close {
    position: absolute;
    right: 9px;
    top: 7px;
    border: 0;
    background: none;
    padding: 4px 9px;
    font-size: 23px;
    color: inherit;
  }
  .receipts {
    position: absolute;
    top: 18%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    text-align: center;
  }
  .receipts > div {
    animation: receipt 2s both;
    background: #252017e8;
    border: 1px solid #b7985e;
    color: #f0dca8;
    padding: 10px 18px;
    font-size: 16px;
    margin: 5px;
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
    border-radius: 5px 14px 5px 10px;
    padding: 30px;
    box-sizing: border-box;
    box-shadow:
      0 22px 70px #20130780,
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
  .finished .primary {
    margin-top: 12px;
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
    border-radius: 5px 14px 5px 10px;
    padding: 28px;
    box-shadow:
      0 25px 90px #100b0799,
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
    background: #100d09b3;
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
  .skin-choice {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin: 0 0 18px;
    padding: 0;
    border: 0;
  }
  .skin-choice legend {
    margin-bottom: 8px;
    color: #6c542f;
    font-size: 11px;
    font-weight: 700;
  }
  .skin-choice label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border: 1px solid #8f6d374f;
    border-radius: 4px;
    background: #fff6d7a6;
    color: #4a3a23;
    font-size: 12px;
    cursor: pointer;
  }
  .skin-choice label:has(:checked) {
    border-color: #b37b2f;
    background: #fffbea;
  }
  .skin-choice input {
    accent-color: #9e6d2c;
    margin: 0;
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
    position: absolute;
    z-index: 5;
    top: 76px;
    right: 18px;
    bottom: 240px;
    width: min(340px, calc(100% - 36px));
    display: flex;
    flex-direction: column;
    padding: 16px 16px 10px;
    color: #3a2c1b;
    background: linear-gradient(#fff6dc80, #0000 30%), #ecdcb4;
    border: 1px solid #b09261;
    border-radius: 6px;
    box-shadow:
      0 12px 28px #0008,
      inset 0 0 30px #b28d5244;
    font-size: 12px;
  }
  .journal header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #a88a5a66;
    padding-bottom: 8px;
  }
  .journal h2 {
    margin: 0;
    font:
      400 19px 'Carcassonne Display',
      Georgia,
      serif;
    color: #3a2c1b;
  }
  .journal .close {
    position: static;
    color: #5b4527;
    background: transparent;
    border: 0;
    font-size: 20px;
  }
  .journal ol {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .journal-entry {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 7px 6px;
    text-align: left;
    font: inherit;
    color: #3a2c1b;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #a88a5a40;
    border-radius: 3px;
  }
  .journal-entry small {
    flex: none;
    width: 50px;
    color: #7a6343;
    font-size: 10px;
  }
  .journal-entry i {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #3a2c1b55;
  }
  .journal-entry span {
    min-width: 0;
  }
  .journal-entry strong {
    margin-left: auto;
    color: #8a5a12;
  }
  .journal-entry .pin {
    flex: none;
    width: 14px;
    height: 14px;
    margin-left: auto;
    color: #8d7550;
    opacity: 0.55;
  }
  .journal-entry strong + .pin {
    margin-left: 0;
  }
  .journal-entry.linked {
    cursor: pointer;
  }
  .journal-entry.linked:hover,
  .journal-entry.linked:focus-visible {
    background: #fff4d6;
  }
  .journal-entry.linked:hover .pin,
  .journal-entry.linked:focus-visible .pin {
    opacity: 1;
    color: #8a5a12;
  }
  .journal-empty {
    color: #7a6343;
  }
  .journal-toggle {
    right: 170px;
  }
  .control-hint {
    display: block;
    margin-top: 20px;
    opacity: 0.5;
    font-size: 10px;
    line-height: 1.6;
  }
  .motion .slot rect {
    animation: slot-glow 2.4s ease-in-out infinite alternate;
  }
  @keyframes slot-glow {
    to {
      fill-opacity: 0.2;
      stroke-dashoffset: -8.6;
    }
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
  @media (max-width: 1100px) {
    .hand {
      max-width: calc(100% - 280px);
      gap: 15px;
      padding-inline: 18px;
    }
    .meeple-supply {
      max-width: 205px;
      padding-left: 10px;
    }
    .turn-hint {
      left: 270px;
      gap: 10px;
    }
    .turn-line,
    .turn-hint p {
      padding-left: 12px;
      font-size: 12px;
    }
    .table-title {
      font-size: 25px;
    }
    .camera-hint {
      max-width: 180px;
      line-height: 1.5;
    }
  }
  @media (max-width: 900px), (max-height: 540px) {
    .table-header {
      height: 52px;
      padding: 0 12px;
      gap: 8px;
      border-radius: 0 0 9px 9px;
    }
    .table-title {
      font-size: 21px;
    }
    .fleur {
      font-size: 27px;
    }
    .corner-control {
      top: 9px;
      width: 34px;
      height: 34px;
      padding: 7px;
    }
    .corner-control svg {
      width: 18px;
      height: 18px;
    }
    .guide-toggle {
      right: 92px;
    }
    .journal-toggle {
      right: 133px;
    }
    .journal {
      top: 64px;
      right: 10px;
      bottom: 10px;
      width: calc(100% - 20px);
    }
    .overview-toggle {
      right: 51px;
    }
    .settings-toggle {
      right: 10px;
    }
    .players {
      top: 64px;
      left: 10px;
      width: calc(100% - 20px);
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: thin;
      pointer-events: auto;
    }
    .player {
      flex: 1 0 88px;
      grid-template-columns: 23px 1fr;
      grid-template-rows: 16px 20px;
      column-gap: 6px;
      padding: 6px 8px;
      box-sizing: border-box;
    }
    .player .portrait-piece {
      width: 25px;
      height: 33px;
    }
    .player strong {
      font-size: 11px;
      max-width: 75px;
    }
    .player-score {
      font-size: 18px;
    }
    .player-supply {
      display: none;
    }
    .turn-hint {
      top: 119px;
      left: 15px;
      right: 15px;
      height: auto;
      justify-content: center;
      gap: 8px;
    }
    .turn-line,
    .turn-hint p {
      border: 0;
      padding: 0;
      font-size: 11px;
    }
    .turn-line {
      max-width: 40%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .camera-hint {
      display: none;
    }
    .camera-controls {
      right: 10px;
      bottom: 10px;
      padding: 2px;
    }
    .camera-controls button,
    .pan-menu summary {
      width: 32px;
      height: 32px;
      font-size: 20px;
    }
    .hand {
      bottom: 54px;
      min-width: 270px;
      max-width: calc(100% - 20px);
      padding: 34px 15px 13px;
      gap: 15px;
    }
    .tray-heading {
      top: 9px;
      left: 15px;
      right: 15px;
      font-size: 14px;
    }
    .tray-heading small {
      font-size: 10px;
    }
    .own-tile {
      width: 71px;
      height: 71px;
    }
    .deck-count {
      width: 21px;
      height: 21px;
      font-size: 10px;
    }
    .placement-controls {
      min-width: 65px;
    }
    .placement-controls .rotate-main {
      width: 43px;
      height: 43px;
      font-size: 34px;
    }
    .rotate-caption {
      font-size: 11px;
    }
    .confirm-row button {
      min-height: 34px;
      width: 34px;
    }
    .supply-toggle {
      display: block;
      align-self: center;
      font-size: 11px;
      max-width: 90px;
      padding: 10px 6px;
    }
    .meeple-supply {
      display: none;
    }
    .supply-open .meeple-supply {
      display: flex;
      position: absolute;
      bottom: calc(100% + 9px);
      left: 50%;
      transform: translateX(-50%);
      padding: 15px;
      width: 265px;
      max-width: calc(100vw - 55px);
      background: #222019f5;
      border: 1px solid #b4965f;
      box-shadow: 0 7px 20px #0006;
    }
    .hand:has(.hand-actions) .meeple-supply {
      display: flex;
      padding: 0;
      border: 0;
      max-width: 195px;
    }
    .hand:has(.hand-actions) .tile-stack,
    .hand:has(.hand-actions) .supply-toggle {
      display: none;
    }
    .hand:has(.hand-actions) .meeple-supply {
      position: static;
      transform: none;
      background: none;
      box-shadow: none;
      width: auto;
    }
    .loose-meeple {
      width: 24px;
      height: 35px;
    }
    .loose-meeple.large {
      width: 29px;
      height: 40px;
    }
    .hand-actions button {
      font-size: 11px;
      min-width: 85px;
      padding: 10px 8px;
    }
    .decision {
      bottom: 188px;
      right: 10px;
      width: min(310px, calc(100% - 20px));
      max-height: calc(100% - 345px);
      padding: 14px;
    }
    .inspection {
      top: 151px;
      right: 10px;
      width: 220px;
      max-height: calc(100% - 340px);
      padding: 17px;
    }
    .setup-panel,
    .finished {
      top: 55%;
      padding: 20px;
      max-height: calc(100% - 155px);
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
      bottom: calc(100% + 8px);
      width: 150px;
    }
  }
  @media (max-height: 540px) and (min-width: 600px) {
    .players {
      width: 300px;
    }
    .turn-hint {
      top: 70px;
      left: 340px;
    }
    .hand {
      left: 12px;
      bottom: 12px;
      transform: none;
    }
    .decision {
      right: 12px;
      bottom: 64px;
      max-height: calc(100% - 155px);
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
