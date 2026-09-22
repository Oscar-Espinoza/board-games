<script lang="ts">
  import { meeplePath } from '../art.js';
  let {
    color,
    type = 'meeple',
    mark = '',
  }: { color: string; type?: string; mark?: string | number } = $props();
  const uid = $props.id();
  const shape = $derived(
    type === 'pig'
      ? 'M-10-2Q-3-7 6-3L12-4V3L7 6V11H3V7H-4V11H-8V6Q-14 3-10-2Z'
      : type === 'builder'
        ? 'M-7 13V0L-11-3L-6-7V-13H6V-7L11-3L7 0V13Z'
        : meeplePath,
  );
</script>

<defs>
  <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#fff4ce" stop-opacity=".28" />
    <stop offset=".4" stop-color="white" stop-opacity=".04" />
    <stop offset="1" stop-color="#160a03" stop-opacity=".48" />
  </linearGradient>
</defs>
<ellipse cx="2" cy="14" rx="12" ry="3.5" fill="#160a03" opacity=".32" />
<path
  d={shape}
  transform="translate(1.8 2.5)"
  fill={color}
  stroke="#29180d"
  stroke-width="1.5"
/>
<path
  d={shape}
  fill={color}
  stroke="#180b03"
  stroke-opacity=".5"
  stroke-width=".6"
/>
<path d={shape} fill={`url(#${uid}-wood)`} />
<path
  d="M-3-11Q0-14 3-11M-8 0-5-2"
  fill="none"
  stroke="#fff3d0"
  stroke-opacity=".35"
  stroke-width=".8"
/>
{#if type === 'abbot'}<path
    d="M0-4V5M-3-1H3"
    stroke="#fff0ce"
    stroke-width="1.4"
  />{:else if mark !== ''}<text
    x="0"
    y="5"
    text-anchor="middle"
    font-size="6.5"
    font-family="Georgia, serif"
    fill="#fff4d8"
    stroke="#271507"
    stroke-opacity=".4"
    stroke-width=".3"
    paint-order="stroke">{mark}</text
  >{/if}
