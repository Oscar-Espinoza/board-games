<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import { TILES } from '../index.js';
  import { placements } from '../layout.js';
  import { media, type DominoGame, type Sounds } from '../game.svelte.js';
  import type { Rect, TableScene, TableState } from './scene.js';
  import Tile from '../Tile.svelte';
  import Loading from '../Loading.svelte';

  /** The three.js patio table: canvas, hit areas, camera and the phone hand bar. */
  let { game: g }: { game: DominoGame } = $props();
  const t = $derived(g.t),
    L = $derived(g.L),
    pub = $derived(g.pub),
    compact = $derived(g.compact);

  function click(volume: number) {
    g.audio.noise({
      duration: 0.05,
      volume: volume * 0.2,
      frequency: 2600,
      q: 1.4,
    });
  }
  function thud(force: number) {
    g.audio.noise({
      duration: 0.08 + force * 0.12,
      volume: 0.12 + force * 0.5,
      frequency: 900 - force * 500,
      sweep: 180,
      filter: 'lowpass',
      q: 0.8,
    });
    g.audio.noise({
      duration: 0.04,
      volume: 0.08 + force * 0.25,
      frequency: 3200,
      q: 1.2,
    });
    if (force > 0.55)
      for (let i = 0; i < 4; i++)
        g.audio.noise({
          delay: 0.06 + i * 0.045 + Math.random() * 0.03,
          duration: 0.035,
          volume: 0.05 + force * 0.08,
          frequency: 2200 + Math.random() * 1400,
          q: 2,
        });
  }
  function knock() {
    for (const delay of [0, 0.16])
      g.audio.noise({
        delay,
        duration: 0.07,
        volume: 0.22,
        frequency: 420,
        filter: 'lowpass',
      });
  }
  const sounds: Sounds = {
    select: () => click(0.25),
    play: thud,
    pass: knock,
    turn() {},
    end() {},
    // The tile lands a moment after it leaves the hand.
    land: (force) => 300 - force * 120,
  };
  onMount(() => {
    g.sounds = sounds;
    // A hard slam shakes the table as the tile lands.
    const off = g.on((e) => {
      if (e.type === 'play' && g.motion && e.force > 0.55)
        setTimeout(() => scene?.shake(e.force), 260);
    });
    return () => {
      off();
      if (g.sounds === sounds) g.sounds = null;
    };
  });

  function wheel(e: WheelEvent) {
    if (g.settingsOpen || g.rulesOpen || compact) return;
    g.camera = Math.max(0, Math.min(1, g.camera + e.deltaY * 0.0012));
  }

  // The three.js table.
  const tableState = $derived<TableState>({
    placements: placements(pub.chain, pub.poses),
    ghosts: g.ghosts,
    rack: g.hand.map((id) => ({
      id,
      near: TILES[id].a,
      far: TILES[id].b,
      lifted: g.selected === id,
    })),
    standing: [g.handsLeft(1), g.handsLeft(2), g.handsLeft(3)],
    names: [
      g.plaqueName(g.own),
      g.plaqueName(g.seatAt(1)),
      g.plaqueName(g.seatAt(2)),
      g.plaqueName(g.seatAt(3)),
    ],
    active: pub.phase === 'playing' ? g.rel(pub.turn) : null,
    status: g.myTurn ? g.status : null,
    labels: { pass: t.pass, arrange: t.arrange },
    enabled: {
      pass: g.mustPass && !g.pending,
      arrange: g.scattered && !g.pending,
    },
    charge: g.charge,
    camera: g.camera,
    motion: g.motion,
    last:
      pub.last?.type === 'play'
        ? { id: pub.last.id, from: g.rel(pub.last.seat), force: pub.last.force }
        : null,
    compact,
  });
  let canvas = $state<HTMLCanvasElement>(),
    scene = $state<TableScene | null>(null),
    rects = $state<Record<string, Rect>>({}),
    failed = $state(false),
    // Loading: the three.js code, then art (textures, font), then shaders.
    loaded = $state<number | null>(null),
    shown = $state(false),
    covered = $state(true);
  onMount(() => {
    let alive = true;
    import('./scene.js')
      .then(({ createTable }) => {
        if (!alive || !canvas) return;
        loaded = 0;
        scene = createTable(canvas, {
          // Touch devices with small screens render the light table.
          lite:
            compact ||
            (media('(pointer: coarse)') &&
              Math.min(screen.width, screen.height) < 820),
          onRects: (r) => (rects = r),
          onProgress: (p) => (loaded = Math.max(loaded ?? 0, p)),
          onReady: () => {
            // Let the last loading tiles land, then lift the cover as the hands deal in.
            setTimeout(() => {
              shown = true;
              scene?.intro();
              setTimeout(() => (covered = false), 600);
            }, 450);
          },
        });
      })
      .catch(() => (failed = true));
    return () => {
      alive = false;
      scene?.dispose();
      scene = null;
    };
  });
  $effect(() => {
    scene?.update(tableState);
  });
  /** Hit area over a 3D object, grown to a comfortable 44px touch target. */
  const place = (r?: Rect, grow = true) => {
    if (!r) return 'display:none';
    const w = grow ? Math.max(44, r.w) : r.w,
      h = Math.max(44, r.h);
    return `left:${r.x - (w - r.w) / 2}px;top:${r.y - (h - r.h) / 2}px;width:${w}px;height:${h}px`;
  };
</script>

<div class="table3d" class:compact>
  <div class="stage" onwheel={wheel}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    <div class="vignette" aria-hidden="true"></div>
    {#if failed}<p class="failed" role="alert">
        {m.domino_error({}, L)}
      </p>{:else if covered}<Loading
        progress={loaded === null ? 0.08 : 0.15 + loaded * 0.85}
        leaving={shown}
        label={loaded === null
          ? m.domino_loading({}, L)
          : loaded < 0.8
            ? m.domino_loading_art({}, L)
            : m.domino_loading_tiles({}, L)}
      />{/if}

    <!-- Invisible hit areas over the 3D objects: real buttons for mouse, touch and keyboard. -->
    <div class="hits">
      <div
        role="group"
        aria-label={m.domino_your_tiles({}, L)}
        hidden={compact}
      >
        {#each g.hand as id (id)}
          <button
            class="hit"
            class:live={g.myTurn && g.playable.has(id)}
            style={place(rects[`rack:${id}`], false)}
            aria-pressed={g.selected === id}
            aria-label={`${TILES[id].a}–${TILES[id].b}`}
            onclick={() => g.pick(id)}
          ></button>
        {/each}
      </div>
      {#each g.ghosts as ghost (ghost.end)}
        <button
          class="hit live"
          style={place(rects[`ghost:${ghost.end}`])}
          aria-label={ghost.end === 'left'
            ? m.domino_left_end({}, L)
            : m.domino_right_end({}, L)}
          title={t.holdHint}
          onpointerdown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            g.startCharge(ghost.end);
          }}
          onpointerup={g.releaseCharge}
          onpointercancel={g.cancelCharge}
          onkeydown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              g.startCharge(ghost.end);
            }
          }}
          onkeyup={(e) => {
            if (e.key === ' ' || e.key === 'Enter') g.releaseCharge();
          }}
        ></button>
      {/each}
      {#if !compact}<button
          class="hit"
          class:live={g.mustPass && !g.pending}
          style={place(rects.pass)}
          disabled={!g.mustPass || g.pending}
          onclick={() => g.act({ type: 'PASS' })}>{t.pass}</button
        >
        <button
          class="hit"
          class:live={g.scattered && !g.pending}
          style={place(rects.arrange)}
          disabled={!g.scattered || g.pending}
          onclick={() => g.act({ type: 'ARRANGE' })}>{t.arrange}</button
        >{/if}
      {#if !compact && rects.gauge && g.charging}<div
          class="gauge-labels"
          style={place(rects.gauge)}
          aria-hidden="true"
        >
          <small>{t.soft}</small><small>{t.hard}</small>
        </div>{/if}
    </div>
    <p class="sr-only" role="status">{g.status}</p>
  </div>

  {#if compact}
    <div class="hand-bar">
      <div class="hand-top">
        <button
          class="pill"
          disabled={!g.mustPass || g.pending}
          onclick={() => g.act({ type: 'PASS' })}>{t.pass}</button
        >
        <p class="hand-status" aria-hidden="true">
          {#if g.charging}<span class="meter"
              ><span style:--charge={g.charge}></span><small>{t.soft}</small
              ><small>{t.hard}</small></span
            >{:else}{g.status}{/if}
        </p>
        <button
          class="pill"
          disabled={!g.scattered || g.pending}
          onclick={() => g.act({ type: 'ARRANGE' })}>{t.arrange}</button
        >
      </div>
      <div
        class="hand"
        role="group"
        aria-label={m.domino_your_tiles({}, L)}
        style:--n={Math.max(g.hand.length, 5)}
      >
        {#each g.hand as id (id)}
          <button
            class="hand-tile"
            class:lifted={g.selected === id}
            class:live={g.myTurn && g.playable.has(id)}
            aria-pressed={g.selected === id}
            aria-label={`${TILES[id].a}–${TILES[id].b}`}
            onclick={() => g.pick(id)}
            ><Tile near={TILES[id].a} far={TILES[id].b} vertical /></button
          >
        {/each}
      </div>
    </div>
  {/if}

  <div class="camera" role="group" aria-label={t.view} hidden={compact}>
    <button
      aria-label={t.seated}
      title={t.seated}
      aria-pressed={g.camera === 0}
      onclick={() => (g.camera = 0)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle
          cx="12"
          cy="12"
          r="2.5"
        /></svg
      ></button
    >
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      aria-label={t.view}
      bind:value={g.camera}
    />
    <button
      aria-label={t.overhead}
      title={t.overhead}
      aria-pressed={g.camera === 1}
      onclick={() => (g.camera = 1)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><rect x="5" y="5" width="14" height="14" rx="2" /><path
          d="M12 1v3M12 20v3"
        /></svg
      ></button
    >
  </div>
</div>

<style>
  .table3d {
    position: absolute;
    inset: 0;
  }
  .camera svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Camera */
  .camera {
    position: absolute;
    z-index: 5;
    right: 14px;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    border-radius: 22px;
    background: rgb(26 14 6 / 0.72);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.5);
  }
  .camera button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }
  .camera button[aria-pressed='true'] {
    color: var(--brass);
  }
  .camera input {
    writing-mode: vertical-lr;
    height: 110px;
    width: 24px;
    accent-color: var(--brass);
  }

  /* The 3D table */
  .stage {
    position: absolute;
    inset: 0;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(
        ellipse 75% 70% at 50% 58%,
        transparent 55%,
        rgb(8 5 3 / 0.55)
      ),
      linear-gradient(to bottom, rgb(8 5 3 / 0.35), transparent 18%);
  }
  .hits {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .hit {
    position: absolute;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    color: transparent;
    font-size: 0;
    pointer-events: auto;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  .hit.live {
    cursor: pointer;
  }
  /* The app's green hover fill must never show over the 3D table. */
  .hit:hover:enabled {
    background: none;
    transform: none;
  }
  .hit:disabled {
    pointer-events: none;
  }
  .hit:focus {
    outline: none;
  }
  .hit:focus-visible {
    outline: 2px solid rgb(255 214 150 / 0.85);
    outline-offset: 3px;
  }
  .gauge-labels {
    position: absolute;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    translate: 0 -100%;
    font-size: 11px;
    color: rgb(243 230 204 / 0.8);
    text-shadow: 0 1px 2px #000;
    pointer-events: none;
  }
  .failed {
    position: absolute;
    top: 45%;
    width: 100%;
    text-align: center;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Phone layout: a slim header, the seats around you, a low hand bar. */
  .compact .stage {
    top: 118px;
    bottom: calc(146px + env(safe-area-inset-bottom));
  }
  .compact .vignette {
    display: none;
  }
  .camera[hidden] {
    display: none;
  }
  .hand-bar {
    position: absolute;
    z-index: 5;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    gap: 4px;
    padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
    background:
      repeating-linear-gradient(
        88deg,
        rgb(255 255 255 / 0.03) 0 2px,
        transparent 2px 9px
      ),
      linear-gradient(180deg, #4a2b14, #2a170c);
    border-top: 2px solid #1a0d05;
    box-shadow: 0 -6px 16px rgb(0 0 0 / 0.5);
  }
  .hand-top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }
  .pill {
    height: 30px;
    padding: 0 12px;
    border: 1px solid #1a0d05;
    border-radius: 15px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    touch-action: manipulation;
  }
  .pill:hover:enabled {
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    transform: none;
  }
  .pill:disabled {
    opacity: 0.4;
  }
  .hand-status {
    display: grid;
    place-items: center;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.2;
    text-align: center;
  }
  .meter {
    position: relative;
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: 200px;
    height: 18px;
    padding: 0 8px;
    box-sizing: border-box;
    border-radius: 9px;
    background: #1a0d05;
    overflow: hidden;
    font-size: 10px;
    line-height: 18px;
  }
  .meter > span {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--charge));
    background: linear-gradient(90deg, #c9a15a, #e2742e 70%, #c63a22);
  }
  .meter small {
    position: relative;
  }
  .hand {
    --w: min(42px, calc((100vw - 16px - (var(--n) - 1) * 6px) / var(--n)));
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 10px;
  }
  .hand-tile {
    width: var(--w);
    height: calc(var(--w) * 2);
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: none;
    box-shadow:
      0 1px 0 #d8cdb1,
      0 2px 0 #c7b994,
      0 6px 10px rgb(0 0 0 / 0.5);
    transition: transform 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .hand-tile:hover:enabled {
    background: none;
    transform: none;
  }
  .hand-tile.lifted,
  .hand-tile.lifted:hover:enabled {
    transform: translateY(-10px);
  }
  .hand-tile:focus {
    outline: none;
  }
  .hand-tile:focus-visible {
    outline: 2px solid rgb(255 214 150 / 0.85);
    outline-offset: 3px;
  }
  /* Landscape phones: header and seats in a left column, a lower hand bar. */
  @media (max-height: 520px) and (min-width: 521px) {
    .compact .stage {
      top: 0;
      left: 156px;
      bottom: calc(118px + env(safe-area-inset-bottom));
    }
    .hand {
      --w: min(34px, calc((100vw - 40px) / var(--n)));
      padding-top: 8px;
    }
  }
  @media (max-width: 720px), (max-height: 520px) {
    .camera {
      right: 6px;
      bottom: 10px;
    }
    .camera input {
      height: 80px;
    }
  }
</style>
