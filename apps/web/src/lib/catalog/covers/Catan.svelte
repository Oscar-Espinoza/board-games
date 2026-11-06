<svelte:options namespace="svg" />

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
<path d="M277 143l9-21 9 21M286 122v35h-18" stroke="#f8e6b9" stroke-width="2" />
<path d="M23 318h45M301 62h13v18" stroke="#f8dfa7" stroke-width="3" />
