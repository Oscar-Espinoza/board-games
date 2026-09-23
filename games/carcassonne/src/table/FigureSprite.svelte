<script lang="ts">
  import WoodenPiece from './WoodenPiece.svelte';
  import { spriteRoot } from './sprites.js';
  // Painted neutral figures tinted per player; same space as WoodenPiece.
  let {
    color,
    type = 'meeple',
    shadow = true,
  }: { color: string; type?: string; shadow?: boolean } = $props();
  const uid = $props.id();
  const sprite = $derived(
    type === 'large' ? 'meeple' : type === 'pig' ? 'pig' : type,
  );
  const painted = ['meeple', 'abbot', 'builder', 'pig'];
</script>

{#if painted.includes(sprite)}
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
