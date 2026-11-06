<script lang="ts" module>
  export type CityState = {
    region: string;
    complete: boolean;
    keep: boolean;
    rising: boolean;
  };
</script>

<script lang="ts">
  import { tiles, rotatePoint } from '../tiles.js';
  import { cityPath } from '../art.js';
  import { lift, uprightMatrix } from './camera.js';
  import {
    cityLayout,
    meadowLayout,
    hashStream,
    type Slot,
  } from './scenery.js';
  import { sprites, spriteRoot, small } from './sprites.js';
  import { spriteImage, wallImage } from '../pixel/atlas.svelte.js';

  let {
    id,
    rotation,
    tileKey,
    cities,
    monastery = null,
    detail = true,
    pixel = false,
  }: {
    id: string;
    rotation: number;
    tileKey: string;
    cities: CityState[];
    monastery?: { complete: boolean; rising: boolean } | null;
    detail?: boolean;
    /** 8-bit skin: raster walls and pixel sprites at the sprite grid. */
    pixel?: boolean;
  } = $props();
  const walls = $derived(
    pixel && cities.length
      ? wallImage(
          id,
          rotation,
          cities.map((c) => c.complete),
        )
      : '',
  );
  const uid = $props.id();
  const tile = $derived(tiles[id]);
  // Walls are extruded inside the rotated tile, so undo the rotation on lift.
  const up = $derived.by(() => {
    let { x, y } = lift(1.15);
    for (let i = 0; i < rotation; i++) [x, y] = [y, -x];
    return { x, y };
  });
  type Placed = Slot & { key: string; complete: boolean; rising: boolean };
  const standing = $derived.by(() => {
    const out: Placed[] = [];
    // Unfinished cities keep only their low wall rim; completion raises the town.
    for (const c of cities.filter((c) => c.complete))
      cityLayout(id, c.region, tileKey, c.keep).forEach((s, i) =>
        out.push({
          ...s,
          key: `${c.region}-${i}`,
          complete: true,
          rising: c.rising,
        }),
      );
    if (monastery?.complete)
      out.push({
        x: 50,
        y: 60,
        sprite: 'monastery',
        scale: 1,
        key: 'monastery',
        complete: true,
        rising: monastery.rising,
      });
    for (const [i, s] of meadowLayout(id, tileKey).entries())
      if (detail || !small.has(s.sprite))
        out.push({
          ...s,
          key: `m${i}`,
          complete: true,
          rising: false,
        });
    return out
      .map((s) => {
        const [x, y] = rotatePoint([s.x, s.y], rotation);
        return { ...s, x, y };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);
  });
  const smoke = $derived(hashStream(`${tileKey}/smoke`)() < 0.5);
</script>

<g class="elevation" data-elevation-tile={tileKey}>
  <defs
    ><clipPath id={`${uid}-inside`}
      ><rect x="2.5" y="2.5" width="95" height="95" /></clipPath
    ></defs
  >
  {#if pixel}{#if walls}<image
        href={walls}
        width="100"
        height="100"
        class="px-walls"
        class:rising={cities.some((c) => c.rising)}
        preserveAspectRatio="none"
      />{/if}{:else}<g transform={`rotate(${rotation * 90} 50 50)`}>
      {#each cities as c (c.region)}
        {@const r = tile.regions.find((v) => v.id === c.region)!}
        {@const d = cityPath(r)}
        {@const layers = c.complete ? 6 : 2}
        <g
          class="wall"
          class:rising={c.rising}
          data-elevation="city"
          data-complete={c.complete}
          clip-path={`url(#${uid}-inside)`}
        >
          {#each Array(layers) as _, i}
            <path
              {d}
              class="wall-layer"
              style={`--i:${i}`}
              transform={`translate(${up.x * (i + 1)} ${up.y * (i + 1)})`}
              fill="none"
              stroke={i === layers - 1
                ? '#b8ad8f'
                : i % 2
                  ? '#877c63'
                  : '#7a6f58'}
              stroke-width="4.4"
            />
          {/each}
          <g
            class="wall-top"
            transform={`translate(${up.x * layers} ${up.y * layers})`}
          >
            <path {d} fill="none" stroke="#ddd5b6" stroke-width="2.8" />
            <path
              {d}
              fill="none"
              stroke="#6f654e"
              stroke-width="3.4"
              stroke-dasharray="1.2 1.6"
            />
            <path
              {d}
              fill="none"
              stroke="#f1e4ba"
              stroke-width="1"
              stroke-dasharray="1.5 1"
            />
          </g>
        </g>
      {/each}
    </g>{/if}
  {#each standing as s, i (s.key)}
    {@const px = pixel ? spriteImage(s.sprite) : null}
    {@const w = px ? px.width : sprites[s.sprite].width * s.scale}
    <g
      transform={`translate(${s.x} ${s.y})`}
      class="standing"
      class:rising={s.rising}
      style={`--d:${(i % 12) * 45}ms`}
      data-sprite={s.sprite}
    >
      {#if pixel}<rect
          x={-w * 0.38}
          y="-1.6"
          width={w * 0.84}
          height="3.2"
          fill="#1b1409"
          opacity=".3"
        />{:else}<ellipse
          cx={w * 0.08}
          cy="1"
          rx={w * 0.46}
          ry={w * 0.2}
          fill="#1b1409"
          opacity=".3"
        />{/if}
      <g transform={uprightMatrix}>
        <g
          class="rise"
          class:sway={sprites[s.sprite].sway}
          style={`--phase:${(i % 3) * -1.3}s`}
        >
          {#if px}<image
              href={px.url}
              x={-px.width / 2}
              y={-px.height}
              width={px.width}
              height={px.height}
              class="px-sprite"
            />{:else if !pixel}<image
              href={`${spriteRoot}${s.sprite}.webp`}
              x={-w / 2}
              y={-w}
              width={w}
              height={w}
              preserveAspectRatio="xMidYMax meet"
            />{/if}
        </g>
        {#if smoke && s.complete && s.sprite.startsWith('houses') && i % 4 === 1}{#if pixel}<g
              class="smoke px-smoke"
              transform={`translate(${w * 0.1} ${-(px?.height ?? w) * 0.85})`}
              ><rect x="-1.2" y="-1.2" width="2.4" height="2.4" /><rect
                x="-.8"
                y="-.8"
                width="1.6"
                height="1.6"
              /></g
            >{:else}<g
              class="smoke"
              transform={`translate(${w * 0.1} ${-w * 0.85})`}
              ><circle r="1.6" /><circle r="1.3" /><circle r="1" /></g
            >{/if}{/if}
      </g>
    </g>
  {/each}
</g>

<style>
  .elevation {
    pointer-events: none;
  }
  .rise,
  .smoke circle {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }
  :global(.motion) .rising .rise {
    animation: build-rise 0.9s cubic-bezier(0.3, 1.4, 0.5, 1) var(--d) backwards;
  }
  :global(.motion) .rising .wall-layer {
    animation: wall-rise 0.35s ease-out calc(var(--i) * 90ms) backwards;
  }
  :global(.motion) .rising .wall-top {
    animation: wall-rise 0.4s ease-out 0.5s backwards;
  }
  :global(.motion) .sway {
    animation: sway 4.6s ease-in-out var(--phase) infinite alternate;
  }
  .smoke {
    display: none;
  }
  :global(.motion) .smoke {
    display: inline;
  }
  .smoke circle {
    fill: #eee6d6;
    opacity: 0;
    animation: smoke 4.5s ease-out infinite;
  }
  .smoke circle:nth-child(2) {
    animation-delay: -1.5s;
  }
  .smoke circle:nth-child(3) {
    animation-delay: -3s;
  }
  @keyframes build-rise {
    from {
      transform: scaleY(0);
    }
    70% {
      transform: scaleY(1.07);
    }
  }
  @keyframes wall-rise {
    from {
      opacity: 0;
    }
  }
  @keyframes sway {
    from {
      transform: rotate(-1.6deg);
    }
    to {
      transform: rotate(1.6deg);
    }
  }
  @keyframes smoke {
    0% {
      opacity: 0;
      transform: translate(0, 0) scale(0.6);
    }
    20% {
      opacity: 0.55;
    }
    100% {
      opacity: 0;
      transform: translate(3px, -9px) scale(1.8);
    }
  }
  .px-sprite,
  .px-walls {
    image-rendering: pixelated;
  }
  /* 8-bit motion: stepped rise, one-pixel sway, square smoke puffs. */
  :global(.motion) .rising .rise:has(.px-sprite) {
    animation: build-rise 0.6s steps(4, jump-end) var(--d) backwards;
  }
  :global(.motion) .px-walls.rising {
    animation: wall-rise 0.5s steps(3, jump-end) backwards;
  }
  :global(.motion) .sway:has(.px-sprite) {
    animation: px-sway 1.6s steps(1, jump-end) var(--phase) infinite;
  }
  .px-smoke rect {
    fill: #eee6d6;
    opacity: 0;
    transform-box: fill-box;
    animation: px-smoke 3.2s steps(4, jump-end) infinite;
  }
  .px-smoke rect:nth-child(2) {
    animation-delay: -1.6s;
  }
  @keyframes px-sway {
    50% {
      transform: translateX(0.8px);
    }
  }
  @keyframes px-smoke {
    0% {
      opacity: 0;
      transform: translate(0, 0);
    }
    25% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      transform: translate(2px, -8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rise,
    .px-walls,
    .px-smoke rect,
    .wall-layer,
    .wall-top {
      animation: none !important;
    }
  }
</style>
