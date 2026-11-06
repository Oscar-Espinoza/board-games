<svelte:options namespace="svg" />

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
