<script lang="ts">
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
  type T = {
    x: number;
    y: number;
    a: number;
    b: number;
    r?: number;
    back?: boolean;
    dim?: boolean;
  };
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
  const row = (y: number, list: [number, number][], x0 = 150, dim = false) =>
    list.map(([a, b], i) => ({ x: x0 + i * 62, y, a, b, dim }));
  const backs = (n: number, x0: number, y: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: x0 + i * 34,
      y,
      a: 0,
      b: 0,
      r: 90,
      back: true,
    }));
  const scenes: Record<string, T[][]> = {
    deal: [
      [...backs(7, 150, 60), ...backs(7, 150, 110), ...backs(7, 150, 160)],
      [
        ...backs(7, 40, 70),
        ...backs(7, 290, 70),
        ...backs(7, 40, 170),
        ...backs(7, 290, 170),
      ],
      [...backs(7, 150, 40), ...backs(7, 150, 200)],
    ],
    lead: [
      row(
        190,
        [
          [6, 6],
          [2, 4],
          [1, 3],
        ],
        170,
      ),
      [{ x: 260, y: 110, a: 6, b: 6, r: 90 }],
      [
        { x: 260, y: 110, a: 6, b: 6, r: 90 },
        { x: 330, y: 110, a: 6, b: 2 },
      ],
    ],
    match: [
      [
        { x: 170, y: 100, a: 6, b: 6, r: 90 },
        { x: 240, y: 100, a: 6, b: 3 },
        { x: 300, y: 190, a: 3, b: 5 },
      ],
      [
        { x: 170, y: 100, a: 6, b: 6, r: 90 },
        { x: 240, y: 100, a: 6, b: 3 },
        { x: 318, y: 130, a: 3, b: 5 },
      ],
      [
        { x: 170, y: 100, a: 6, b: 6, r: 90 },
        { x: 240, y: 100, a: 6, b: 3 },
        { x: 306, y: 100, a: 3, b: 5 },
      ],
    ],
    pass: [
      [
        { x: 200, y: 90, a: 2, b: 6 },
        { x: 266, y: 90, a: 6, b: 4 },
      ],
      [
        { x: 200, y: 90, a: 2, b: 6 },
        { x: 266, y: 90, a: 6, b: 4 },
        ...row(
          190,
          [
            [1, 3],
            [5, 5],
            [0, 1],
          ],
          170,
          true,
        ),
      ],
      [
        { x: 200, y: 90, a: 2, b: 6 },
        { x: 266, y: 90, a: 6, b: 4 },
      ],
    ],
    strike: [
      row(190, [[4, 5]], 230),
      [
        { x: 230, y: 110, a: 4, b: 5, r: 8 },
        { x: 170, y: 100, a: 1, b: 4, r: -14 },
        { x: 296, y: 124, a: 5, b: 0, r: 18 },
      ],
      [
        { x: 170, y: 110, a: 1, b: 4 },
        { x: 236, y: 110, a: 4, b: 5 },
        { x: 302, y: 110, a: 5, b: 0 },
      ],
    ],
    out: [
      row(110, [[3, 3]], 230),
      row(
        110,
        [
          [5, 3],
          [3, 3],
        ],
        200,
      ),
      row(
        110,
        [
          [5, 3],
          [3, 3],
        ],
        200,
      ),
    ],
    block: [
      row(
        110,
        [
          [4, 1],
          [1, 1],
          [1, 4],
        ],
        170,
      ),
      row(
        110,
        [
          [4, 1],
          [1, 1],
          [1, 4],
        ],
        170,
      ),
      row(
        110,
        [
          [4, 1],
          [1, 1],
          [1, 4],
        ],
        170,
      ),
    ],
    target: [[], [], []],
  };
  const tiles = $derived(scenes[lesson.scene]?.[step] ?? []);
</script>

<svg
  viewBox="0 0 520 240"
  role="img"
  aria-label={`${lesson.title()}: ${lesson.frames[step]()}`}
>
  <rect width="520" height="240" rx="12" fill="#6b4424" />
  <rect x="12" y="12" width="496" height="216" rx="8" fill="#8a5a36" />
  {#each tiles as t}
    <g
      transform="translate({t.x} {t.y}) rotate({t.r ?? 0})"
      opacity={t.dim ? 0.55 : 1}
      ><rect
        x="-30"
        y="-15"
        width="60"
        height="30"
        rx="4"
        fill={t.back ? '#e3d6b8' : '#f6efdc'}
        stroke="#b9a77c"
        stroke-width="1.5"
      />{#if !t.back}<path
          d="M0-11v22"
          stroke="#3a2f22"
          stroke-width="1.5"
        />{#each [t.a, t.b] as v, h}{#each dots[v] as [c, r]}<circle
              cx={h * 30 - 23 + c * 8}
              cy={-8 + r * 8}
              r="2.6"
              fill="#1c1712"
            />{/each}{/each}{/if}</g
    >
  {/each}
  {#if lesson.values[step]}<text x="260" y="226" class="value"
      >{lesson.values[step]}</text
    >{/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .value {
    fill: #f3e6cc;
    font:
      700 18px Georgia,
      serif;
    text-anchor: middle;
  }
</style>
