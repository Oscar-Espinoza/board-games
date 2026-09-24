<script lang="ts">
  import WoodenPiece from './WoodenPiece.svelte';
  import { spriteRoot } from './sprites.js';
  import { figureImage } from '../pixel/atlas.svelte.js';
  // Painted neutral figures tinted per player; same space as WoodenPiece.
  let {
    color,
    type = 'meeple',
    shadow = true,
    pixel = false,
  }: {
    color: string;
    type?: string;
    shadow?: boolean;
    /** 8-bit skin: a recoloured pixel sprite instead of the tinted painting. */
    pixel?: boolean;
  } = $props();
  // Pixel figures: one sprite pixel is 1.15 figure units, feet on y = 14.
  const k = 1.15;
  const fig = $derived(pixel ? figureImage(type, color) : null);
  const uid = $props.id();
  const sprite = $derived(
    type === 'large' ? 'meeple' : type === 'pig' ? 'pig' : type,
  );
  const painted = ['meeple', 'abbot', 'builder', 'pig'];
</script>

{#if pixel}
  {#if shadow}<path
      d="M-7 12h16v1h2v2h-2v1h-16v-1h-2v-2h2z"
      fill="#160a03"
      opacity=".4"
    />{/if}
  {#if fig}<image
      href={fig.url}
      x={-(fig.w * k) / 2}
      y={14 - fig.h * k}
      width={fig.w * k}
      height={fig.h * k}
      style="image-rendering:pixelated"
    />{/if}
{:else if painted.includes(sprite)}
  <defs>
    <filter
      id={`${uid}-tint`}
      x="-5%"
      y="-5%"
      width="110%"
      height="110%"
      color-interpolation-filters="sRGB"
    >
      <feFlood flood-color={color} result="paint" />
      <feComposite
        in="SourceGraphic"
        in2="paint"
        operator="arithmetic"
        k1="1.22"
        k2="0.1"
        result="tinted"
      />
      <feComposite in="tinted" in2="SourceGraphic" operator="in" />
    </filter>
  </defs>
  {#if shadow}<ellipse
      cx="2"
      cy="13.5"
      rx="11"
      ry="3.2"
      fill="#160a03"
      opacity=".38"
    />{/if}
  <image
    href={`${spriteRoot}figure-${sprite}.webp`}
    x={sprite === 'pig' ? -13 : -15}
    y={sprite === 'pig' ? -6 : -17}
    width={sprite === 'pig' ? 26 : 30}
    height={sprite === 'pig' ? 20 : 31}
    preserveAspectRatio="xMidYMax meet"
    filter={`url(#${uid}-tint)`}
  />
{:else}
  <WoodenPiece {color} {type} />
{/if}
