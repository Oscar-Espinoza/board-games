<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import { TILES, teamOf } from '../index.js';
  import { placements } from '../layout.js';
  import type { DominoGame } from '../game.svelte.js';
  import type { PixelScene, PixelState, Rect } from './scene.js';
  import { chiptune } from './sound.js';
  import Loading from '../Loading.svelte';

  /** The 8-bit patio: a pixel canvas with real buttons laid over it. */
  let { game: g }: { game: DominoGame } = $props();
  const t = $derived(g.t),
    L = $derived(g.L),
    pub = $derived(g.pub),
    compact = $derived(g.compact);

  // Landscape phones keep the HUD in a left column; portrait phones along the top.
  let landscape = $state(false);
  onMount(() => {
    const q = window.matchMedia('(max-height: 520px) and (min-width: 521px)');
    const change = () => (landscape = q.matches);
    change();
    q.addEventListener('change', change);
    return () => q.removeEventListener('change', change);
  });

  const cheer = $derived(
    g.result
      ? [0, 1, 2, 3].map(
          (r) =>
            g.result!.winner !== null &&
            teamOf(g.seatAt(r)) === g.result!.winner,
        )
      : null,
  );
  const pixelState = $derived<PixelState>({
    placements: placements(pub.chain, pub.poses),
    ghosts: g.ghosts,
    rack: g.hand.map((id) => ({
      id,
      near: TILES[id].a,
      far: TILES[id].b,
      lifted: g.selected === id,
    })),
    standing: [g.handsLeft(1), g.handsLeft(2), g.handsLeft(3)],
    seats: [g.seatAt(0), g.seatAt(1), g.seatAt(2), g.seatAt(3)],
    active: pub.phase === 'playing' ? g.rel(pub.turn) : null,
    cheer,
    motion: g.motion,
    compact,
    inset: compact
      ? landscape
        ? { top: 0, left: 156 }
        : { top: 118, left: 0 }
      : { top: 0, left: 0 },
  });

  let canvas = $state<HTMLCanvasElement>(),
    scene = $state<PixelScene | null>(null),
    rects = $state<Record<string, Rect>>({}),
    failed = $state(false),
    loaded = $state<number | null>(null),
    shown = $state(false),
    covered = $state(true);
  onMount(() => {
    let alive = true;
    const sounds = chiptune(g.audio);
    g.sounds = sounds;
    const off = g.on((e) =>
      scene?.react(
        e.type === 'play'
          ? { type: 'play', id: e.id, from: g.rel(e.seat), force: e.force }
          : { type: 'pass', from: g.rel(e.seat) },
      ),
    );
    import('./scene.js')
      .then(({ createPixelTable }) => {
        if (!alive || !canvas) return;
        loaded = 0;
        scene = createPixelTable(canvas, {
          onRects: (r) => (rects = r),
          onProgress: (p) => (loaded = Math.max(loaded ?? 0, p)),
          onReady: () =>
            setTimeout(() => {
              shown = true;
              scene?.intro();
              setTimeout(() => (covered = false), 500);
            }, 300),
        });
      })
      .catch(() => (failed = true));
    return () => {
      alive = false;
      off();
      if (g.sounds === sounds) g.sounds = null;
      scene?.dispose();
      scene = null;
    };
  });
  $effect(() => {
    scene?.update(pixelState);
  });

  // End of hand: a banner drops in before the scores.
  let banner = $state<string | null>(null);
  let bannerTimer = 0;
  $effect(() => {
    const kind = g.result?.kind;
    clearTimeout(bannerTimer);
    if (!kind) return void (banner = null);
    banner =
      kind === 'domino' ? m.domino_domino({}, L) : m.domino_tranque({}, L);
    bannerTimer = window.setTimeout(() => (banner = null), 1500);
  });

  /** Hit area over a drawn object, grown to a comfortable 44px touch target. */
  const place = (r?: Rect, grow = true) => {
    if (!r) return 'display:none';
    const w = grow ? Math.max(44, r.w) : r.w,
      h = Math.max(44, r.h);
    return `left:${r.x - (w - r.w) / 2}px;top:${r.y - (h - r.h) / 2}px;width:${w}px;height:${h}px`;
  };
  const at = (r?: Rect) => (r ? `left:${r.x}px;top:${r.y}px` : 'display:none');
</script>

<div class="table8" class:compact>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  {#if failed}<p class="failed" role="alert">
      {m.domino_error({}, L)}
    </p>{:else if covered}<Loading
      pixel
      progress={loaded === null ? 0.08 : 0.15 + loaded * 0.85}
      leaving={shown}
      label={loaded === null
        ? m.domino_loading({}, L)
        : loaded < 0.8
          ? m.domino_loading_art({}, L)
          : m.domino_loading_tiles({}, L)}
    />{/if}

  {#if !compact}
    <!-- Name tags over each seat, in team colours. -->
    {#each [2, 3, 1] as r}
      {@const seat = g.seatAt(r)}
      <span
        class="tag"
        class:ours={r === 2}
        class:beside={r === 2}
        class:active={pub.phase === 'playing' && pub.turn === seat}
        style={at(rects[`name:${r}`])}
        >{g.name(seat)}{#if g.passed(seat)}<small>
            · {t.passed}</small
          >{/if}</span
      >
    {/each}
  {/if}

  <div class="hits">
    <div role="group" aria-label={m.domino_your_tiles({}, L)}>
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
  </div>

  {#snippet meter()}<span class="meter" aria-hidden="true"
      ><span style:--charge={g.charge}></span><small>{t.soft}</small><small
        >{t.hard}</small
      ></span
    >{/snippet}
  <!-- Your turn: the status, and when nothing fits, the Pass button inside it. -->
  {#snippet turn()}<span aria-hidden="true"
      >{#if g.charging}{@render meter()}{:else}{g.status}{/if}</span
    >{#if g.mustPass && !g.charging}<button
        class="pix pass"
        disabled={g.pending}
        onclick={() => g.act({ type: 'PASS' })}>{t.pass}</button
      >{/if}{/snippet}
  {#if compact}
    <div
      class="bar"
      style={rects.rack
        ? `top:${rects.rack.y + 6}px;left:${rects.rack.x + 8}px`
        : 'display:none'}
    >
      <div class="turn">{@render turn()}</div>
      <button
        class="pix"
        disabled={!g.scattered || g.pending}
        onclick={() => g.act({ type: 'ARRANGE' })}>{t.arrange}</button
      >
    </div>
  {:else}
    <button
      class="pix side arrange"
      style={at(rects.arrange)}
      disabled={!g.scattered || g.pending}
      onclick={() => g.act({ type: 'ARRANGE' })}>{t.arrange}</button
    >
    {#if g.myTurn || g.charging}<div
        class="status"
        class:passing={g.mustPass && !g.charging}
        style={at(rects.status)}
      >
        {@render turn()}
      </div>{/if}
  {/if}
  {#if banner}<p class="banner" aria-hidden="true">{banner}</p>{/if}
  <p class="sr-only" role="status">{g.status}</p>
</div>

<style>
  .table8 {
    position: absolute;
    inset: 0;
    font-family: 'Pixelify Sans', monospace;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
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
  .hits {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .hit {
    position: absolute;
    padding: 0;
    border: 0;
    border-radius: 0;
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
  .hit:hover:enabled {
    background: none;
    transform: none;
  }
  .hit:focus {
    outline: none;
  }
  .hit:focus-visible {
    outline: 2px dashed #f2c14e;
    outline-offset: 2px;
  }

  /* Pixel UI pieces: hard 2px ink borders, stepped shadows, no rounding. */
  .tag,
  .pix,
  .status,
  .bar {
    border: 2px solid #1e110a;
    box-shadow:
      inset 0 -3px 0 rgb(0 0 0 / 0.3),
      3px 3px 0 rgb(0 0 0 / 0.45);
  }
  .tag {
    position: absolute;
    z-index: 2;
    translate: -50% -100%;
    padding: 2px 8px 4px;
    background: #7a2a22;
    color: #fbe9d0;
    font-size: 15px;
    white-space: nowrap;
    pointer-events: none;
  }
  .tag.ours {
    background: #2f7a39;
  }
  .tag.beside {
    translate: 0 -50%;
  }
  .tag small {
    font-size: 12px;
    opacity: 0.85;
  }
  .tag.active {
    color: #1e110a;
    background: #f2c14e;
    animation: blink 0.9s steps(2, jump-none) infinite;
  }
  @keyframes blink {
    50% {
      background: #ffe08a;
    }
  }
  .pix {
    min-height: 40px;
    padding: 6px 14px 8px;
    background: #5b3620;
    color: #f6e7c8;
    font: inherit;
    font-size: 17px;
    border-radius: 0;
    cursor: pointer;
    touch-action: manipulation;
  }
  .pix:hover:enabled {
    background: #6d4327;
    transform: none;
  }
  .pix:enabled:active {
    transform: translate(2px, 2px);
    box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.3);
  }
  .pix:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .side {
    position: absolute;
    z-index: 2;
    translate: -100% -50%;
  }
  .side.arrange {
    translate: 0 -50%;
  }
  .pix.pass:enabled {
    background: #3f9a4a;
    animation: blink-green 0.9s steps(2, jump-none) infinite;
  }
  @keyframes blink-green {
    50% {
      background: #4fb35a;
    }
  }
  .status {
    position: absolute;
    z-index: 2;
    translate: -50% -100%;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 4px 12px 6px;
    background: #f6e7c8;
    color: #1e110a;
    font-size: 16px;
    white-space: nowrap;
    pointer-events: none;
  }
  /* Blocked: the bubble grows a Pass button at its end. */
  .status.passing {
    padding: 3px 3px 3px 12px;
  }
  .status .pass,
  .turn .pass {
    min-height: 0;
    padding: 2px 12px 4px;
    font-size: 15px;
    pointer-events: auto;
  }
  .meter {
    position: relative;
    display: flex;
    justify-content: space-between;
    gap: 40px;
    min-width: 160px;
    padding: 0 6px;
    background: #1e110a;
    color: #f6e7c8;
    font-size: 12px;
    line-height: 20px;
  }
  .meter > span {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--charge));
    background: repeating-linear-gradient(
      90deg,
      #f2c14e 0 6px,
      #e0742e 6px 8px
    );
  }
  .meter small {
    position: relative;
  }
  .banner {
    position: absolute;
    z-index: 8;
    top: 38%;
    left: 50%;
    margin: 0;
    padding: 14px 28px 18px;
    translate: -50% -50%;
    border: 4px solid #1e110a;
    background: #f2c14e;
    color: #1e110a;
    box-shadow:
      inset 0 -6px 0 rgb(0 0 0 / 0.2),
      6px 6px 0 rgb(0 0 0 / 0.5);
    font-size: clamp(32px, 8vw, 64px);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    animation: drop 0.5s steps(5, jump-end) both;
    pointer-events: none;
  }
  @keyframes drop {
    from {
      translate: -50% -260%;
    }
  }

  /* Phones: a bar with Pass, the status and Tidy up just above your rack. */
  .bar {
    position: absolute;
    z-index: 3;
    left: 8px;
    right: 8px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    box-shadow: none;
  }
  .bar .pix {
    min-height: 30px;
    padding: 2px 10px 4px;
    font-size: 14px;
  }
  .turn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: #f6e7c8;
    font-size: 13px;
    line-height: 1.15;
    text-align: center;
  }
  .turn > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .turn > span:only-child {
    flex: 1;
    white-space: normal;
  }
  .turn .pass {
    flex: none;
  }
  .bar .meter {
    min-width: 0;
    width: 100%;
    gap: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .tag.active,
    .pix.pass:enabled,
    .banner {
      animation: none;
    }
  }
</style>
