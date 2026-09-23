<script lang="ts">
  import { tiles } from './tiles.js';
  import { cityPath, roadPath } from './art.js';
  import { bridges, decal } from './table/scenery.js';
  let { id, rotation = 0 }: { id: string; rotation?: number } = $props();
  const uid = $props.id();
  const tile = $derived(tiles[id]);
  const cities = $derived(tile.regions.filter((r) => r.kind === 'city'));
  const roads = $derived(tile.regions.filter((r) => r.kind === 'road'));
  const variation = $derived([...id].reduce((n, c) => n + c.charCodeAt(0), 0));
  const art = '/games/carcassonne/';
  const patch = $derived(decal(id));
</script>

<g transform={`rotate(${rotation * 90} 50 50)`} data-tile-art={id}>
  <defs>
    <clipPath id={`${uid}-edge`}
      ><rect x=".6" y=".6" width="98.8" height="98.8" rx=".7" /></clipPath
    >
    <clipPath id={`${uid}-inside`}
      ><rect x="2.5" y="2.5" width="95" height="95" /></clipPath
    >
    <pattern
      id={`${uid}-town`}
      width="100"
      height="100"
      patternUnits="userSpaceOnUse"
    >
      <image href={`${art}town.webp`} width="100" height="100" />
    </pattern>
    <pattern
      id={`${uid}-earth`}
      width="32"
      height="32"
      patternUnits="userSpaceOnUse"
      ><image href={`${art}earth.webp`} width="32" height="32" /></pattern
    >
    <linearGradient id={`${uid}-water`} x2="1" y2="1">
      <stop stop-color="#3a78ad" /><stop
        offset=".5"
        stop-color="#6aaedb"
      /><stop offset="1" stop-color="#346c9c" />
    </linearGradient>
    <linearGradient id={`${uid}-edge-light`} x2=".4" y2="1">
      <stop stop-color="#fff4bc" stop-opacity=".5" /><stop
        offset=".6"
        stop-color="#302213"
        stop-opacity="0"
      /><stop offset="1" stop-color="#21170c" stop-opacity=".6" />
    </linearGradient>
  </defs>
  <rect x=".5" y="1.5" width="99" height="100" rx="1" fill="#413321" />
  <g clip-path={`url(#${uid}-edge)`}>
    <image
      href={`${art}meadow.webp`}
      width="100"
      height="100"
      transform={`rotate(${(variation % 4) * 90} 50 50)`}
    />
    {#if patch}<image
        href={`${art}sprites/${patch.kind}.webp`}
        x={patch.x - patch.size / 2}
        y={patch.y - patch.size / 2}
        width={patch.size}
        height={patch.size}
        opacity=".92"
      />{/if}
    {#each tile.regions.filter((r) => r.kind === 'river') as r}
      <path
        d={roadPath(r)}
        stroke="#4b5f2c"
        stroke-width="23"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d={roadPath(r)}
        stroke="#d6c38c"
        stroke-width="20"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d={roadPath(r)}
        stroke={`url(#${uid}-water)`}
        stroke-width="16"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d={roadPath(r)}
        class="flow"
        stroke="#d8ede0"
        stroke-width=".6"
        stroke-dasharray="5 3 2 9"
        fill="none"
        opacity=".75"
      />
      <path
        d={roadPath(r)}
        class="flow slow"
        stroke="#eef8f0"
        stroke-width="1.4"
        stroke-dasharray="1.5 11 4 17"
        stroke-linecap="round"
        fill="none"
        opacity=".45"
        transform="translate(2.2 1.4)"
      />
      {#if tile.source || tile.lake}<ellipse
          cx="50"
          cy="50"
          rx={tile.lake ? 23 : 12}
          ry={tile.lake ? 18 : 11}
          fill={`url(#${uid}-water)`}
          stroke="#c7b47b"
          stroke-width="2"
        />{/if}
    {/each}
    {#each cities as r}
      <path d={cityPath(r)} fill={`url(#${uid}-town)`} />
      <g clip-path={`url(#${uid}-inside)`}>
        <path
          d={cityPath(r)}
          fill="none"
          stroke="#302b1d"
          stroke-width="5.2"
          opacity=".65"
          transform="translate(.5 1.4)"
        />
        <path d={cityPath(r)} fill="none" stroke="#9d9277" stroke-width="4.2" />
        <path d={cityPath(r)} fill="none" stroke="#ddd5b6" stroke-width="2.8" />
        <path
          d={cityPath(r)}
          fill="none"
          stroke="#796f57"
          stroke-width="2.8"
          stroke-dasharray=".5 2"
        />
        <path
          d={cityPath(r)}
          fill="none"
          stroke="#f1e4ba"
          stroke-width="1.2"
          stroke-dasharray="1.5 1"
        />
      </g>
    {/each}
    {#each roads as r, i}
      {#if i > 0 && r.ports.length === 2 && roads.some((v) => v !== r && v.ports.length === 2)}
        <path d={roadPath(r)} stroke="#342d20" stroke-width="14" fill="none" />
      {/if}
      <path
        d={roadPath(r)}
        stroke="#5d5a2c"
        stroke-width="12"
        stroke-opacity=".45"
        fill="none"
      />
      <path d={roadPath(r)} stroke="#b39a62" stroke-width="10.5" fill="none" />
      <path
        d={roadPath(r)}
        stroke={`url(#${uid}-earth)`}
        stroke-width="9"
        fill="none"
      />
      <path
        d={roadPath(r)}
        stroke="#c99e58"
        stroke-width="9"
        stroke-opacity=".5"
        fill="none"
      />
      <path
        d={roadPath(r)}
        stroke="#fff1c7"
        stroke-width=".5"
        stroke-dasharray="2 3 7 4"
        fill="none"
        opacity=".7"
      />
      {#if r.inn}<g
          transform={`translate(${r.anchor[0] + 11} ${r.anchor[1] - 7})`}
        >
          <ellipse
            rx="8"
            ry="5"
            fill="#6098a3"
            stroke="#d1be8c"
            stroke-width="1"
          />
          <image
            href={`${art}abbey.webp`}
            x="-9"
            y="-15"
            width="17"
            height="17"
          />
        </g>{/if}
    {/each}
    {#each bridges(id) as b}<g
        transform={`translate(${b.x} ${b.y}) rotate(${b.angle})`}
        class="bridge"
      >
        <rect
          x="-11"
          y="-5.4"
          width="22"
          height="10.8"
          rx="1.5"
          fill="#1d2a22"
          opacity=".35"
          transform="translate(.8 1.2)"
        />
        <rect
          x="-11"
          y="-4.6"
          width="22"
          height="9.2"
          rx="1.2"
          fill="#b7a98a"
        />
        <rect
          x="-10"
          y="-3.2"
          width="20"
          height="6.4"
          fill={`url(#${uid}-earth)`}
        />
        <path
          d="M-10.5-4.2H10.5M-10.5 4.2H10.5"
          stroke="#e5dcc2"
          stroke-width="1.5"
        />
        <path
          d="M-10.5-4.2H10.5M-10.5 4.2H10.5"
          stroke="#7c705a"
          stroke-width="1.5"
          stroke-dasharray=".6 1.6"
        />
      </g>{/each}
    {#if roads.some((r) => r.ports.length === 1) && !tile.ferry}
      <circle
        cx="50"
        cy="50"
        r="5.5"
        fill={`url(#${uid}-earth)`}
        stroke="#9b8b60"
        stroke-width=".6"
      />
      <path
        d="M47 51v-6h6v6z"
        fill="#d1b88a"
        stroke="#65533d"
        stroke-width=".6"
      />
      <path d="M46 45l4-4 4 4z" fill="#aa5934" />
    {/if}
    {#if tile.regions.some((r) => r.kind === 'monastery')}
      <image href={`${art}abbey.webp`} x="22" y="14" width="59" height="65" />
    {/if}
    {#if tile.regions.some((r) => r.cathedral)}
      <image href={`${art}abbey.webp`} x="17" y="11" width="69" height="76" />
      <path d="M42 68h16v10H42z" fill="#d7cbaa" stroke="#5f5443" /><path
        d="M47 68v-8h6v8"
        fill="#e7dcc2"
      />
    {/if}
    {#if tile.regions.some((r) => r.kind === 'garden')}<g
        transform="translate(62 66)"
      >
        <path
          d="M-13-9h26v19h-26z"
          fill="#b99762"
          stroke="#efe1ac"
          stroke-width="1.1"
        />
        {#each [-8, -3, 2, 7] as x}<path
            d={`M${x} -6v13`}
            stroke="#325936"
            stroke-width="2.5"
          />
          {#each [-4, 1, 5] as y}<circle
              cx={x}
              cy={y}
              r=".9"
              fill={x % 2 ? '#dfa887' : '#c8bf74'}
            />{/each}
        {/each}
      </g>{/if}
    {#if tile.ferry}<path
        d="M30 35Q48 24 66 37Q80 51 65 64Q48 74 31 62Q23 48 30 35Z"
        fill={`url(#${uid}-water)`}
        stroke="#d2bf8e"
        stroke-width="2"
      />{/if}
    {#each cities.filter((r) => r.ports.length >= 3 || (r.ports.length === 2 && Math.abs(r.ports[0] - r.ports[1]) === 2)) as r}
      {#if !r.cathedral}<image
          href={`${art}keep.webp`}
          x={r.anchor[0] - 19}
          y={r.anchor[1] - 30}
          width="38"
          height="41"
        />{/if}
    {/each}
    {#each cities as r}
      {#each Array(r.shields) as _, i}<g
          transform={`translate(${r.anchor[0] + i * 10 - (r.shields - 1) * 5} ${r.anchor[1]})`}
        >
          <path
            d="M-4-7h8v10L0 7-4 3Z"
            fill="#2c5983"
            stroke="#e8cd84"
            stroke-width="1"
          />
          <path d="M0-5v8M-2-1h4" stroke="#e5c56c" stroke-width="1" />
        </g>{/each}
      {#if r.goods.some(Boolean)}<g
          transform={`translate(${r.anchor[0]} ${r.anchor[1] + 9})`}
        >
          <circle r="6" fill="#ead4a0" stroke="#79603e" stroke-width=".7" />
          <text y="3" text-anchor="middle" font-size="8" fill="#574025"
            >{r.goods[0] ? '♧' : r.goods[1] ? '♨' : '▧'}</text
          >
        </g>{/if}
    {/each}
    {#if tile.flight}<g transform="translate(38 35)">
        <path d="M-9-7L9 7M-9 7L9-7" stroke="#765128" stroke-width="3" />
        <path
          d="M-8-6L-2-2M3 2L8 6M-8 6L-2 2M3-2L8-6"
          stroke="#e2c996"
          stroke-width="2"
        />
        <path
          d={`M0 0L${tile.flight[0] * 16} ${tile.flight[1] * 16}`}
          stroke="#392719"
          stroke-width="1.8"
        />
        <circle r="2.5" fill="#d7b876" />
      </g>{/if}
    {#if tile.gold}<path
        d="M12 79L22 74L33 79L23 85Z"
        fill="#e8bd48"
        stroke="#825b24"
      /><path d="M12 79l11 3 10-3" fill="none" stroke="#ffe49a" />{/if}
    {#if tile.magic}<path
        d="M13 85L20 64L28 85Z"
        fill="#6b4e81"
        stroke="#e8d2a0"
        stroke-width="1.2"
      />{/if}
    {#if tile.robber}<path
        d="M14 72L26 72L23 77Q34 90 20 89Q7 90 17 77Z"
        fill="#8b5833"
        stroke="#e1c28e"
        stroke-width="1.1"
      />{/if}
    {#if tile.crop}<g transform="translate(50 56)">
        <rect
          x="-12"
          y="-18"
          width="24"
          height="31"
          rx="2"
          fill="#c6a454"
          stroke="#e1c77c"
        />
        {#each [-9, -5, -1, 3, 7] as x}<path
            d={`M${x} -15v25`}
            stroke="#826c32"
            stroke-width=".5"
          />{/each}
        <text
          text-anchor="middle"
          y="4"
          font-size="20"
          fill="#4e522a"
          stroke="#e6cf88"
          stroke-width=".4"
          >{tile.crop === 'field'
            ? '♧'
            : tile.crop === 'city'
              ? '♜'
              : '⌁'}</text
        >
      </g>{/if}
  </g>
  <rect
    x=".7"
    y=".7"
    width="98.6"
    height="98.6"
    rx="1"
    fill="none"
    stroke={`url(#${uid}-edge-light)`}
    stroke-width="1.4"
  />
</g>

<style>
  :global(.motion) .flow {
    animation: flow 3.2s linear infinite;
  }
  :global(.motion) .flow.slow {
    animation-duration: 5.4s;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -38;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .flow {
      animation: none !important;
    }
  }
</style>
