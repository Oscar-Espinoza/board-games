<script lang="ts">
  import { SPOTS } from './spots.js';
  /** Aged-ivory tile face: `near` on the left (or top when vertical), `far` on the right. */
  let {
    near = 0,
    far = 0,
    vertical = false,
  }: {
    near?: number;
    far?: number;
    vertical?: boolean;
  } = $props();
  // Each half is a 100×100 cell; pips sit on a 26/50/74 grid like a real set.
  const pips = (value: number, offset: number) =>
    SPOTS[value].map(([c, r]) => {
      const x = offset + 26 + c * 24,
        y = 26 + r * 24;
      return vertical ? { x: y, y: x } : { x, y };
    });
</script>

<span class="tile" class:vertical aria-hidden="true"
  ><svg viewBox={vertical ? '0 0 100 200' : '0 0 200 100'}
    >{#each [...pips(near, 0), ...pips(far, 100)] as p}<circle
        cx={p.x}
        cy={p.y}
        r="9.5"
        class="rim"
      /><circle cx={p.x} cy={p.y} r="8.6" class="pip" /><circle
        cx={p.x + 1.6}
        cy={p.y + 2}
        r="5.2"
        class="depth"
      />{/each}
    {#if vertical}<path d="M16 100H84" class="groove" /><path
        d="M16 101.8H84"
        class="lip"
      />{:else}<path d="M100 16V84" class="groove" /><path
        d="M101.8 16V84"
        class="lip"
      />{/if}</svg
  ></span
>

<style>
  .tile {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 12% / 24%;
    background:
      radial-gradient(
        140% 110% at 28% 18%,
        rgb(255 252 240 / 0.7),
        transparent 52%
      ),
      radial-gradient(
        120% 120% at 50% 50%,
        transparent 55%,
        rgb(150 125 85 / 0.28)
      ),
      linear-gradient(165deg, #f3ead3, #e6d9b8 60%, #d8c8a2);
    box-shadow:
      inset 0.05em 0.05em 0.04em rgb(255 255 255 / 0.65),
      inset -0.05em -0.06em 0.08em rgb(110 88 55 / 0.4);
  }
  .vertical {
    border-radius: 24% / 12%;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .rim {
    fill: rgb(255 250 235 / 0.55);
  }
  .pip {
    fill: #17120d;
  }
  .depth {
    fill: #2c241b;
    opacity: 0.8;
  }
  .groove {
    stroke: #2a2118;
    stroke-width: 2.6;
    stroke-linecap: round;
  }
  .lip {
    stroke: rgb(255 250 235 / 0.6);
    stroke-width: 1.2;
    stroke-linecap: round;
  }
</style>
