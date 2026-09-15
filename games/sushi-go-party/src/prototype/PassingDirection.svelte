<script lang="ts">
  import HiddenHand from '../table/HiddenHand.svelte';
  let {
    passes,
    names,
  }: {
    passes: { from: string; to: string; count: number }[];
    names: Record<string, string>;
  } = $props();
  const paths = [
    {
      d: 'M220 659 Q172 562 204 453',
      x: 201,
      y: 573,
      angle: -20,
    },
    {
      d: 'M287 200 Q331 129 451 113',
      x: 359,
      y: 105,
      angle: -34,
    },
    {
      d: 'M976 111 Q1121 119 1177 199',
      x: 1068,
      y: 110,
      angle: 18,
    },
    {
      d: 'M1299 452 Q1293 495 1242 530',
      x: 1205,
      y: 459,
      angle: 42,
    },
    {
      d: 'M1311 755 Q1378 828 1263 869',
      x: 1325,
      y: 773,
      angle: 37,
    },
  ];
</script>

<div
  class="passing"
  aria-label="Hands pass clockwise: Marina to Kai to Sakura to Tomás to Emi to Marina"
>
  <svg viewBox="0 0 1440 900" aria-hidden="true">
    <defs
      ><marker
        id="party-arrow"
        markerWidth="12"
        markerHeight="12"
        refX="8"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
        ><path d="m0 0 12 5-12 5 3-5Z" fill="#dfedcd" /></marker
      ></defs
    >
    {#each paths as path}<path
        d={path.d}
        fill="none"
        stroke="#dfedcd"
        stroke-width="4"
        stroke-linecap="round"
        marker-end="url(#party-arrow)"
        opacity=".88"
      />{/each}
  </svg>
  {#each passes as pass, i}
    <div
      class="passing-bundle"
      style:left={`${paths[i].x}px`}
      style:top={`${paths[i].y}px`}
      style:transform={`rotate(${paths[i].angle}deg)`}
      data-pass-from={pass.from}
      data-pass-to={pass.to}
      aria-label={`${pass.count} hidden cards passing from ${names[pass.from]} to ${names[pass.to]}`}
    >
      <HiddenHand count={pass.count} bundle />
    </div>
  {/each}
  <p>Pass<br /><span>clockwise!</span></p>
</div>

<style>
  .passing {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  svg {
    width: 100%;
    height: 100%;
  }
  .passing-bundle {
    position: absolute;
    filter: drop-shadow(0 5px 4px #153e3944);
  }
  p {
    position: absolute;
    left: 193px;
    top: 479px;
    margin: 0;
    color: #f5d588;
    font-size: 25px;
    font-style: italic;
    line-height: 1.35;
    text-align: center;
    transform: rotate(-12deg);
  }
</style>
