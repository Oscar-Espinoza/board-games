<script lang="ts">
  import type { GameId } from './types';
  let { game }: { game: GameId } = $props();
  // Pip cells (column, row) on a 3×3 grid for the domino cover.
  const dots: [number, number][][] = [
    [],
    [[1, 1]],
    [
      [0, 0],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
    ],
    [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
  ];
</script>

<svg viewBox="0 0 360 400" fill="none" aria-hidden="true">
  {#if game === 'little-secret'}
    <rect x="26" y="20" width="308" height="360" rx="12" fill="#102b27" /><rect
      x="14"
      y="8"
      width="308"
      height="357"
      rx="12"
      fill="#284c40"
    /><rect
      x="27"
      y="21"
      width="282"
      height="331"
      rx="6"
      stroke="#c4a770"
    /><path
      d="M42 158Q168 42 294 158M42 300Q168 390 294 300"
      stroke="#9b865c"
    /><text
      x="168"
      y="92"
      text-anchor="middle"
      fill="#efdeba"
      font-family="Georgia,serif"
      font-size="43">LITTLE</text
    ><text
      x="168"
      y="140"
      text-anchor="middle"
      fill="#efdeba"
      font-family="Georgia,serif"
      font-size="43">SECRET</text
    ><g transform="rotate(-12 168 242)"
      ><rect
        x="67"
        y="182"
        width="198"
        height="134"
        rx="4"
        fill="#ece0c4"
      /><path
        d="M67 182l99 82 99-82M67 316l69-76m129 76-69-76"
        stroke="#b9a27a"
        stroke-width="2"
      /><circle cx="166" cy="256" r="26" fill="#863e3c" /><circle
        cx="166"
        cy="256"
        r="21"
        stroke="#b86a50"
      /><path
        d="M151 256q15-17 30 0-15 17-30 0z"
        stroke="#e0b772"
        stroke-width="2"
      /><circle cx="166" cy="256" r="5" fill="#e0b772" /></g
    ><path
      d="M35 42h15m-8-7v15m240-8h15m-8-7v15M35 329h15m-8-7v15m240-8h15m-8-7v15"
      stroke="#d2b37b"
    />
  {:else if game === 'sushi-go-party'}
    <rect x="26" y="20" width="308" height="360" rx="16" fill="#31544b" />
    <rect x="14" y="8" width="308" height="357" rx="15" fill="#b9d6c5" />
    <rect
      x="25"
      y="19"
      width="286"
      height="335"
      rx="9"
      stroke="#eaf0d9"
      stroke-width="2"
    />
    <text
      x="169"
      y="81"
      text-anchor="middle"
      fill="#31544b"
      font-size="44"
      font-weight="900">SUSHI GO</text
    >
    <text
      x="169"
      y="121"
      text-anchor="middle"
      fill="#bf6a59"
      font-size="37"
      font-weight="900"
      letter-spacing="6">PARTY!</text
    >
    <ellipse cx="167" cy="255" rx="133" ry="74" fill="#31544b18" />
    <ellipse
      cx="166"
      cy="244"
      rx="133"
      ry="74"
      fill="#fff4dc"
      stroke="#e4dec3"
      stroke-width="5"
    />
    <ellipse
      cx="166"
      cy="244"
      rx="115"
      ry="56"
      stroke="#d9d8bb"
      stroke-width="2"
    />
    <g transform="translate(82 190) rotate(-15)"
      ><rect
        width="91"
        height="54"
        rx="23"
        fill="#fff9e8"
        stroke="#d6d5bc"
        stroke-width="2"
      /><rect
        x="-4"
        y="-9"
        width="99"
        height="36"
        rx="17"
        fill="#e9977e"
      /><path
        d="m12-5 11 27m12-27 11 27m12-27 11 27"
        stroke="#ffe4bd"
        stroke-width="4"
      /><circle cx="32" cy="36" r="3" fill="#31544b" /><circle
        cx="59"
        cy="36"
        r="3"
        fill="#31544b"
      /><path d="m40 42q5 7 10 0" stroke="#31544b" stroke-width="2" /></g
    >
    <g transform="translate(219 229)"
      ><path d="M-28-12v34c0 29 56 29 56 0V-12" fill="#31544b" /><ellipse
        cy="-12"
        rx="28"
        ry="21"
        fill="#fff6de"
        stroke="#31544b"
        stroke-width="4"
      /><ellipse cy="-12" rx="15" ry="10" fill="#e9977e" /><path
        d="m-8-16 16 7"
        stroke="#97b075"
        stroke-width="7"
      /><circle cx="-10" cy="19" r="3" fill="#fff6de" /><circle
        cx="10"
        cy="19"
        r="3"
        fill="#fff6de"
      /></g
    >
    <path
      d="m100 271 23-53 24 53Z"
      fill="#f8f1da"
      stroke="#31544b"
      stroke-width="2"
    /><path d="M113 253h20v20h-20z" fill="#31544b" />
    <path
      d="m49 322 209-18m-201 35 204-23"
      stroke="#c7966d"
      stroke-width="7"
      stroke-linecap="round"
    />
  {:else if game === 'codenames'}
    <rect x="20" y="16" width="310" height="365" rx="8" fill="#0e1b25" /><rect
      x="12"
      y="8"
      width="310"
      height="358"
      rx="7"
      fill="#203847"
    /><rect x="26" y="22" width="282" height="330" rx="3" stroke="#b88b47" />
    <text
      x="166"
      y="86"
      text-anchor="middle"
      font-family="Georgia"
      font-size="34"
      fill="#f5eedc">CODENAMES</text
    ><path d="M90 111h150" stroke="#b88b47" />
    {#each Array.from({ length: 25 }, (_, i) => i) as i}<g
        transform="translate({45 + (i % 5) * 49} {140 +
          Math.floor(i / 5) * 36}) rotate({(i % 3) - 1})"
        ><rect
          width="43"
          height="29"
          rx="3"
          fill={i === 17
            ? '#0c1720'
            : i % 4 === 0
              ? '#a93645'
              : i % 3 === 0
                ? '#245c97'
                : '#f5eedc'}
        /><path
          d="M9 12h25m-20 6h15"
          stroke={i % 3 === 0 || i % 4 === 0 ? '#f5eedc' : '#b88b47'}
          stroke-width="2"
        /></g
      >{/each}
  {:else if game === 'domino'}
    <rect x="23" y="18" width="310" height="359" rx="9" fill="#24130a" />
    <rect x="14" y="8" width="310" height="352" rx="7" fill="#5a3519" />
    <rect
      x="30"
      y="24"
      width="278"
      height="320"
      rx="4"
      fill="#7a5032"
      stroke="#d6a54f"
      stroke-width="2"
    />
    <text
      x="169"
      y="84"
      text-anchor="middle"
      fill="#f3e6cc"
      font-family="Georgia,serif"
      font-size="40">Dominó</text
    >
    {#each [{ x: 64, y: 170, r: 0, a: 6, b: 3 }, { x: 142, y: 170, r: 0, a: 3, b: 5 }, { x: 208, y: 150, r: 90, a: 5, b: 5 }, { x: 244, y: 210, r: 90, a: 5, b: 1 }, { x: 166, y: 250, r: 0, a: 1, b: 4 }] as d}<g
        transform="translate({d.x} {d.y}) rotate({d.r})"
        ><rect
          x="-4"
          y="-18"
          width="76"
          height="38"
          rx="5"
          fill="#f6efdc"
          stroke="#b9a77c"
          stroke-width="2"
        /><path
          d="M34-14v30"
          stroke="#3a2f22"
          stroke-width="2"
        />{#each [d.a, d.b] as v, h}{#each dots[v] as [c, r]}<circle
              cx={h * 38 + 7 + c * 11}
              cy={-10 + r * 11}
              r="3.4"
              fill="#1c1712"
            />{/each}{/each}</g
      >{/each}
  {:else if game === 'uno'}
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
  {:else if game === 'azul'}
    <rect x="22" y="22" width="309" height="355" rx="8" fill="#0c243b" />
    <rect x="12" y="10" width="309" height="355" rx="7" fill="#eee3c5" />
    <rect
      x="24"
      y="22"
      width="285"
      height="331"
      rx="2"
      stroke="#235a7c"
      stroke-width="3"
    />
    <text
      x="167"
      y="98"
      fill="#194766"
      text-anchor="middle"
      font-size="62"
      font-family="Georgia"
      letter-spacing="8">AZUL</text
    >
    <path d="M48 122H284M48 130H284" stroke="#ba8d44" />
    {#each [0, 1, 2, 3, 4] as r}{#each [0, 1, 2, 3, 4] as c}
        {@const color = ['#216e9b', '#e5af3b', '#b94a3c', '#283b46', '#fcf3df'][
          (c - r + 5) % 5
        ]}
        <g transform="translate({48 + c * 48} {154 + r * 35})"
          ><rect
            width="42"
            height="30"
            rx="3"
            fill={color}
            stroke="#173f59"
            stroke-width=".8"
          /><path
            d="m21 4 13 11-13 11L8 15Z"
            fill="none"
            stroke={(c - r + 5) % 5 === 4 ? '#3190a2' : '#f7dfb4'}
            stroke-width="1.5"
          /><path d="M4 3h32" stroke="#fff8" /></g
        >
      {/each}{/each}
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
