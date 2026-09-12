<script lang="ts">
  import type { GameId } from './types';
  let { game }: { game: GameId } = $props();
</script>

<svg viewBox="0 0 360 400" fill="none" aria-hidden="true">
  {#if game === 'uno'}
    <rect x="23" y="18" width="310" height="359" rx="9" fill="#7e2625" />
    <path d="M23 359H322V378H34Q23 378 23 366Z" fill="#6a201e" />
    <rect x="14" y="8" width="310" height="352" rx="7" fill="#bd4536" />
    <rect
      x="25"
      y="19"
      width="288"
      height="330"
      rx="3"
      stroke="#efba8b"
      stroke-width="2"
    />
    <path
      d="M33 300L306 102M33 326L306 128M33 274L306 76"
      stroke="#ce5c44"
      stroke-width="20"
    />
    <ellipse
      cx="168"
      cy="118"
      rx="135"
      ry="63"
      transform="rotate(-12 168 118)"
      fill="#f9dfac"
    />
    <text
      x="169"
      y="143"
      text-anchor="middle"
      fill="#8d2927"
      font-size="80"
      font-weight="900"
      font-style="italic">UNO</text
    >
    {#each [{ x: 58, r: -17, c: '#e7b64e', v: '+2' }, { x: 130, r: 4, c: '#46738a', v: '↺' }, { x: 202, r: 19, c: '#487358', v: '7' }] as card}
      <g transform="translate({card.x} 210) rotate({card.r} 38 52)">
        <rect
          width="78"
          height="112"
          rx="9"
          fill="#6d2823"
          transform="translate(4 5)"
        />
        <rect width="78" height="112" rx="9" fill="#fff1cf" />
        <rect x="6" y="6" width="66" height="100" rx="5" fill={card.c} />
        <ellipse
          cx="39"
          cy="56"
          rx="27"
          ry="40"
          transform="rotate(23 39 56)"
          stroke="#fff1cf"
          stroke-width="3"
        />
        <text
          x="39"
          y="69"
          text-anchor="middle"
          fill="#fff1cf"
          font-size="35"
          font-weight="800">{card.v}</text
        >
      </g>
    {/each}
    <path d="M31 25h25M299 330v10h-15" stroke="#ffeac1" stroke-width="3" />
  {:else if game === 'catan'}
    <path d="M8 59L347 51V354L8 365Z" fill="#865332" />
    <rect x="0" y="39" width="337" height="304" rx="5" fill="#d6a347" />
    <rect
      x="11"
      y="50"
      width="315"
      height="282"
      stroke="#f5d68e"
      stroke-width="2"
    />
    <path d="M15 168Q73 121 137 160T323 164V321H15Z" fill="#4d8491" />
    <path
      d="M15 208Q75 181 130 210T323 209M15 288Q92 261 152 286T322 286"
      stroke="#b5d5c5"
      stroke-width="2"
      opacity=".5"
    />
    <text
      x="168"
      y="121"
      text-anchor="middle"
      fill="#6f3828"
      font-size="63"
      font-weight="700"
      letter-spacing="4">CATAN</text
    >
    {#each [{ x: 104, y: 202, c: '#8eaa67' }, { x: 167, y: 202, c: '#d9b350' }, { x: 230, y: 202, c: '#b7754b' }, { x: 72, y: 256, c: '#cead67' }, { x: 135, y: 256, c: '#5f845b' }, { x: 198, y: 256, c: '#aaa394' }, { x: 261, y: 256, c: '#8eaa67' }] as hex}
      <path
        d="M{hex.x} {hex.y - 35}l31 18v35l-31 18-31-18v-35Z"
        fill={hex.c}
        stroke="#f6dba0"
        stroke-width="3"
      />
      <path
        d="M{hex.x - 12} {hex.y + 8}l12-18 12 18"
        stroke="#f5db9e"
        stroke-width="2"
      />
    {/each}
    <path
      d="M104 220l31 18 31-18 32 18"
      stroke="#8c392e"
      stroke-width="7"
      stroke-linecap="round"
    />
    {#each [104, 198] as x}<path
        d="M{x - 11} 213v-17l11-10 11 10v17Z"
        fill="#a84132"
        stroke="#f4d5a0"
        stroke-width="2"
      />{/each}
    <path
      d="M277 143l9-21 9 21M286 122v35h-18"
      stroke="#f8e6b9"
      stroke-width="2"
    />
    <path d="M23 318h45M301 62h13v18" stroke="#f8dfa7" stroke-width="3" />
  {:else}
    <rect x="14" y="31" width="339" height="337" rx="5" fill="#304d58" />
    <rect x="3" y="17" width="337" height="335" rx="5" fill="#50798a" />
    <rect
      x="15"
      y="29"
      width="313"
      height="311"
      stroke="#d9d9ae"
      stroke-width="2"
    />
    <circle cx="266" cy="136" r="28" fill="#f1ce7b" />
    <path d="M17 194Q72 137 138 180T326 164V339H17Z" fill="#a8b47e" />
    <path d="M17 246Q88 170 152 217T326 215V339H17Z" fill="#739164" />
    <text
      x="172"
      y="84"
      text-anchor="middle"
      fill="#fff0c7"
      font-family="Georgia,serif"
      font-size="36"
      font-weight="700">Carcassonne</text
    >
    <path
      d="M99 339Q173 290 121 245T184 185"
      stroke="#dabc83"
      stroke-width="18"
    />
    <path
      d="M102 339Q177 290 125 245T186 185"
      stroke="#f0d8a5"
      stroke-width="3"
      stroke-dasharray="3 7"
    />
    <path
      d="M175 190v-54h17v-12h17v12h18v-12h17v12h17v54Z"
      fill="#d4ba85"
      stroke="#765949"
      stroke-width="2"
    />
    <path d="M167 145l17-30 18 30M225 145l18-30 18 30" fill="#9a4f3b" />
    <path d="M210 189v-22q0-14 13-14t13 14v22" fill="#675d49" />
    {#each [39, 75, 271, 301] as x}<path
        d="M{x} 284v-34m-10 23 10-22 10 22Z"
        fill="#486b51"
        stroke="#486b51"
        stroke-width="3"
      />{/each}
    <path
      d="M218 261c-15-17-3-34 10-29 13-5 25 12 10 29l26 18-10 15-16-9 8 37h-36l8-37-16 9-10-15Z"
      fill="#aa4935"
      stroke="#f5d4a0"
      stroke-width="3"
    />
    <path d="M20 33h21M310 325h13v-13" stroke="#fff0c7" stroke-width="3" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    font-family: system-ui, sans-serif;
  }
</style>
