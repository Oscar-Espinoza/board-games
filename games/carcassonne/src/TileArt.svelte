<script lang="ts">
  import { tiles } from './tiles.js';
  import { cityPath, roadPath } from './art.js';
  let { id, rotation = 0 }: { id: string; rotation?: number } = $props();
  const tile = $derived(tiles[id]);
  const cities = $derived(tile.regions.filter((r) => r.kind === 'city'));
</script>

<g transform={`rotate(${rotation * 90} 50 50)`}>
  <rect
    x="1"
    y="1"
    width="98"
    height="98"
    rx="2"
    fill="#7f9c54"
    stroke="#4d653b"
    stroke-width="2"
  />
  <path
    d="M4 22Q22 13 34 20M65 80Q77 73 94 82M8 65L16 61M80 15L91 11M30 88L37 84"
    fill="none"
    stroke="#a9b876"
    stroke-width="1.5"
    opacity=".65"
  />
  {#each tile.regions.filter((r) => r.kind === 'river') as r}
    <path
      d={roadPath(r)}
      stroke="#e2cc93"
      stroke-width="23"
      fill="none"
      stroke-linecap="round"
    />
    <path
      d={roadPath(r)}
      stroke="#559fac"
      stroke-width="17"
      fill="none"
      stroke-linecap="round"
    />
    <path d={roadPath(r)} stroke="#98c9ce" stroke-width="2" fill="none" />
  {/each}
  {#each cities as r}
    <path d={cityPath(r)} fill="#b78861" stroke="#695647" stroke-width="5" />
    <path
      d={cityPath(r)}
      fill="none"
      stroke="#ead4a0"
      stroke-width="3"
      stroke-dasharray="5 3"
    />
    {#each r.ports as side}
      <g transform={`rotate(${side * 90} 50 50)`}>
        <path
          d="M18 3v11h11V3M40 3v15h13V3M67 3v12h12V3"
          fill="#dfc696"
          stroke="#75644e"
          stroke-width="1"
        />
        <path
          d="M16 7l8 9 7-9M38 10l9 10 9-10M65 7l8 10 8-10"
          fill="#aa5140"
          stroke="#7d4334"
          stroke-width="1"
        />
      </g>
    {/each}
    {#if r.shields}<path
        d={`M${r.anchor[0] - 5},${r.anchor[1] - 7}h10v8l-5,5-5,-5Z`}
        fill="#4274a1"
        stroke="#fff0ba"
        stroke-width="2"
      />{/if}
    {#if r.goods.some(Boolean)}<g transform={`translate(${r.anchor})`}
        ><circle r="8" fill="#f3dfb2" stroke="#7d5539" /><text
          y="4"
          text-anchor="middle"
          font-size="11"
          fill="#453b2c">{r.goods[0] ? '♧' : r.goods[1] ? '♨' : '▧'}</text
        ></g
      >{/if}
  {/each}
  {#each tile.regions.filter((r) => r.kind === 'road') as r, i}
    {#if i > 0 && tile.regions
        .filter((r) => r.kind === 'road')
        .some((v) => v.ports.length === 2) && r.ports.length === 2}<path
        d={roadPath(r)}
        stroke="#67563d"
        stroke-width="12"
        fill="none"
      />{/if}
    <path d={roadPath(r)} stroke="#b2a179" stroke-width="8" fill="none" />
    <path d={roadPath(r)} stroke="#eee0b9" stroke-width="5" fill="none" />
    {#if r.inn}<g transform={`translate(${r.anchor[0] + 9} ${r.anchor[1] - 8})`}
        ><ellipse rx="10" ry="6" fill="#78abb1" /><path
          d="M-4,0V-7H4V0Z"
          fill="#e4ce9d"
        /><path d="M-6,-7L0,-12L6,-7Z" fill="#ac4f37" /></g
      >{/if}
  {/each}
  {#if tile.regions.some((r) => r.kind === 'road' && r.ports.length === 1) && !tile.ferry}<circle
      cx="50"
      cy="50"
      r="4"
      fill="#b89970"
      stroke="#826e4d"
    />{/if}
  {#if tile.regions.some((r) => r.kind === 'monastery')}
    <g transform="translate(50 49)"
      ><ellipse cy="12" rx="19" ry="5" fill="#385038" opacity=".25" /><path
        d="M-15,10V-8H10V10Z"
        fill="#efdfb0"
        stroke="#806449"
        stroke-width="1.5"
      /><path d="M-19,-8L-3,-20L15,-8Z" fill="#9e4939" /><path
        d="M7,10V-18H16V10Z"
        fill="#e5d6a9"
        stroke="#806449"
      /><path d="M5,-18L12,-29L19,-18Z" fill="#ad5440" /><path
        d="M-5,10V1Q0,-6 4,1V10"
        fill="#63584c"
      /></g
    >
  {/if}
  {#if tile.regions.some((r) => r.cathedral)}<g transform="translate(50 53)"
      ><path
        d="M-22,19V-10H22V19ZM-24,-8V-28H-14V-8M14,-8V-28H24V-8"
        fill="#ead9b6"
        stroke="#675f53"
        stroke-width="2"
      /><path
        d="M-25,-27L-19,-38L-13,-27M13,-27L19,-38L25,-27M-26,-10L0,-26L26,-10"
        fill="#a24f3d"
      /><circle cy="0" r="6" fill="#6a8b9b" /></g
    >{/if}
  {#if tile.regions.some((r) => r.kind === 'garden')}<g
      transform="translate(64 67)"
      ><path
        d="M-10 0L0-6L10 0L0 6Z"
        fill="#bc9474"
        stroke="#e8d49a"
      />{#each [-5, 0, 5] as x}<circle
          cx={x}
          cy="0"
          r="2"
          fill="#c99ba4"
        />{/each}</g
    >{/if}
  {#if tile.ferry}<path
      d="M30 35Q48 24 66 37Q80 51 65 64Q48 74 31 62Q23 48 30 35Z"
      fill="#649faa"
      stroke="#dccf9b"
      stroke-width="3"
    />{/if}
  {#if tile.flight}<g transform="translate(38 35)"
      ><path d="M-10 0H10M0-9V8" stroke="#dab57c" stroke-width="6" /><path
        d={`M0 0L${tile.flight[0] * 15} ${tile.flight[1] * 15}`}
        stroke="#623f2b"
        stroke-width="2"
      /><circle r="3" fill="#754d32" /></g
    >{/if}
  {#if tile.gold}<path
      d="M12 79L22 74L33 79L23 85Z"
      fill="#f8d261"
      stroke="#b08935"
      stroke-width="2"
    />{/if}
  {#if tile.magic}<path
      d="M13 85L20 64L28 85Z"
      fill="#795c96"
      stroke="#e8d2a0"
      stroke-width="2"
    />{/if}
  {#if tile.robber}<path
      d="M14 72L26 72L23 77Q34 90 20 89Q7 90 17 77Z"
      fill="#b27342"
      stroke="#ecd4a0"
      stroke-width="2"
    />{/if}
  {#if tile.crop}<g transform="translate(50 56)"
      ><rect
        x="-12"
        y="-18"
        width="24"
        height="31"
        rx="3"
        fill="#d7b965"
        stroke="#a28745"
      /><text text-anchor="middle" y="4" font-size="20" fill="#8b763f"
        >{tile.crop === 'field' ? '♧' : tile.crop === 'city' ? '♜' : '⌁'}</text
      ></g
    >{/if}
  <rect
    x="1.5"
    y="1.5"
    width="97"
    height="97"
    rx="2"
    fill="none"
    stroke="#fff6c1"
    stroke-opacity=".2"
  />
</g>
