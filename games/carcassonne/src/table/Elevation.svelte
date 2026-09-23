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
  import { cityLayout, meadowLayout, seeded, type Slot } from './scenery.js';
  import { sprites, spriteRoot, small } from './sprites.js';

  let {
    id,
    rotation,
    tileKey,
    cities,
    monastery = null,
    detail = true,
  }: {
    id: string;
    rotation: number;
    tileKey: string;
    cities: CityState[];
    monastery?: { complete: boolean; rising: boolean } | null;
    detail?: boolean;
  } = $props();
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
  const smoke = $derived(seeded(`${tileKey}/smoke`)() < 0.5);
</script>

<g class="elevation" data-elevation-tile={tileKey}>
  <defs
    ><clipPath id={`${uid}-inside`}
      ><rect x="2.5" y="2.5" width="95" height="95" /></clipPath
    ></defs
  >
  <g transform={`rotate(${rotation * 90} 50 50)`}>
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
  </g>
  {#each standing as s, i (s.key)}
    {@const w = sprites[s.sprite].width * s.scale}
    <g
      transform={`translate(${s.x} ${s.y})`}
      class="standing"
      class:rising={s.rising}
      style={`--d:${(i % 12) * 45}ms`}
      data-sprite={s.sprite}
    >
      <ellipse
        cx={w * 0.08}
        cy="1"
        rx={w * 0.46}
        ry={w * 0.2}
        fill="#1b1409"
        opacity=".3"
      />
      <g transform={uprightMatrix}>
        <g
          class="rise"
          class:sway={sprites[s.sprite].sway}
          style={`--phase:${(i % 3) * -1.3}s`}
        >
          <image
            href={`${spriteRoot}${s.sprite}.webp`}
            x={-w / 2}
            y={-w}
            width={w}
            height={w}
            preserveAspectRatio="xMidYMax meet"
          />
        </g>
        {#if smoke && s.complete && s.sprite.startsWith('houses') && i % 4 === 1}<g
            class="smoke"
            transform={`translate(${w * 0.1} ${-w * 0.85})`}
            ><circle r="1.6" /><circle r="1.3" /><circle r="1" /></g
          >{/if}
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
  @media (prefers-reduced-motion: reduce) {
    .rise,
    .wall-layer,
    .wall-top {
      animation: none !important;
    }
  }
</style>
