<svelte:options namespace="svg" />

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
