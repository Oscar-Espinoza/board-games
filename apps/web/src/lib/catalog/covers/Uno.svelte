<svelte:options namespace="svg" />

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
