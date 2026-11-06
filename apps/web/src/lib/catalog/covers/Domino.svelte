<svelte:options namespace="svg" />

<script lang="ts">
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
