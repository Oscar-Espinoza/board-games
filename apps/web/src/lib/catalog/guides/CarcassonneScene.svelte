<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
  const city = $derived(
    ['city', 'ownership', 'pig', 'goods', 'magic'].includes(lesson.scene),
  );
  const field = $derived(['field', 'pig'].includes(lesson.scene));
</script>

<svg
  viewBox="0 0 520 270"
  role="img"
  aria-label={`${lesson.title()}: ${lesson.frames[step]()}`}
>
  <rect width="520" height="270" rx="12" fill="#e8e2c5" />
  {#if lesson.scene === 'markers' || lesson.scene === 'message'}
    {#each [0, 5, 10, 15, 20, 25] as n, i}<rect
        x={35 + i * 77}
        y="53"
        width="66"
        height="57"
        rx="5"
        fill="#fff4d5"
        stroke="#bca679"
      /><text x={68 + i * 77} y="88">{n}</text>{/each}
    <circle cx={step === 0 ? 145 : 222} cy="124" r="16" fill="#ac4833" /><text
      x={step === 0 ? 145 : 222}
      y="131"
      class="piece-letter">A</text
    >
    <circle cx="377" cy="124" r="16" fill="#47788b" /><text
      x="377"
      y="131"
      class="piece-letter">B</text
    >
    <rect
      x="180"
      y="160"
      width="160"
      height="65"
      rx="5"
      fill="#fff4d5"
      stroke="#bd9a5d"
    /><text x="260" y="204" class="value">{lesson.values[step]}</text>
  {:else}
    {#each ['road', 'city', 'ownership', 'builder', 'goods', 'magic', 'gold'].includes(lesson.scene) ? [3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8] as i}
      {@const x = 46 + (i % 3) * 70}{@const y = 22 + Math.floor(i / 3) * 70}
      <g opacity={i === 5 && step === 0 ? 0.3 : 1}>
        <rect
          {x}
          {y}
          width="68"
          height="68"
          rx="2"
          fill={field ? '#9dab6e' : '#9eae79'}
          stroke="#fff1d2"
          stroke-width="2"
        />
        {#if city && [3, 4, 5].includes(i)}<path
            d="M{x + 2} {y + 18}h64v39h-64Z"
            fill="#bda477"
            stroke="#765e49"
            stroke-width="2"
          /><path
            d="M{x + 4} {y + 19}h10v-6h10v6h10v-6h10v6h10v-6h10"
            fill="none"
            stroke="#765e49"
            stroke-width="3"
          />{:else if lesson.scene === 'river'}<path
            d="M{x + 34} {y}v68"
            stroke="#659bb0"
            stroke-width="16"
          />{:else if !field}<path
            d="M{x} {y + 34}h68"
            stroke="#ead5a6"
            stroke-width="12"
          />{/if}
        {#if city && i === 4}<path
            d="M{x + 25} {y + 23}h18v17l-9 8-9-8Z"
            fill="#f1d591"
            stroke="#765e49"
            stroke-width="2"
          />{/if}
        {#if (lesson.scene === 'monastery' && i === 4) || (field && [1, 6].includes(i))}<path
            d="M{x + 19} {y + 49}V30l15-17 15 17v19Z"
            fill="#e5cca0"
            stroke="#87674f"
            stroke-width="2"
          /><path d="M{x + 15} {y + 31}l19-22 19 22" fill="#a0563c" />{/if}
      </g>
    {/each}
    {#if lesson.scene === 'gold'}{#each [0, 1] as i}<path
          d="M{113 + i * 67} 122l6-13h21l6 13Z"
          fill="#eec45b"
          stroke="#916d29"
          stroke-width="2"
        />{/each}{/if}
    {#if lesson.scene === 'magic'}<path
        d="M163 80l-14 38h29Z"
        fill="#815d91"
      /><path d="M98 170l-14 38h29Z" fill="#49434b" />{/if}
    {#if lesson.scene === 'flight' && step > 0}<path
        d="M80 74Q156 0 225 74"
        fill="none"
        stroke="#9c5137"
        stroke-width="3"
        stroke-dasharray="6 4"
      />{/if}
    {#if lesson.scene !== 'river' && lesson.scene !== 'placement'}
      <g
        transform="translate({step === 2 &&
        ['road', 'city', 'monastery', 'abbot', 'builder'].includes(lesson.scene)
          ? 358
          : 154} {step === 2 &&
        ['road', 'city', 'monastery', 'abbot', 'builder'].includes(lesson.scene)
          ? 170
          : 112}) rotate({field ? 90 : 0})"
      >
        <path
          d="M-8-8a11 11 0 1 1 16 0l17 12-7 10-11-6 5 26h-24l5-26-11 6-7-10Z"
          fill="#ac4833"
          stroke="#fff2d3"
          stroke-width="2"
        /><text x="0" y="17" class="piece-letter">A</text>
      </g>
    {/if}
    {#if lesson.scene === 'ownership'}<circle
        cx="88"
        cy="115"
        r="17"
        fill="#47788b"
      /><text x="88" y="122" class="piece-letter">B</text>{/if}
    <rect x="296" y="33" width="202" height="100" rx="7" fill="#fff4d5" /><text
      x="397"
      y="63"
      font-size="14"
      >{[m.library_before, m.library_action, m.library_result][step]()}</text
    ><text x="397" y="104" class="value">{lesson.values[step]}</text>
    <text x="394" y="230" font-size="14">Ada · {m.library_supply()}</text>
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  text {
    text-anchor: middle;
    font-family: system-ui, sans-serif;
    fill: #513c2d;
    font-size: 19px;
  }
  .value {
    font-size: 29px;
    font-weight: 750;
  }
  .piece-letter {
    fill: #fff3d5;
    font-size: 15px;
    font-weight: 700;
  }
</style>
