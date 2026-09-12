<script lang="ts">
  import type { GameId } from './types';
  let { game, step }: { game: GameId; step: number } = $props();
</script>

<svg viewBox="0 0 120 78" aria-hidden="true">
  {#if game === 'uno'}
    {#if step === 2}<circle cx="60" cy="37" r="29" fill="#e6bb62" /><path
        d="M44 36l11 12 23-25"
        stroke="#fff6df"
        stroke-width="7"
        fill="none"
      />
    {:else}<rect
        x="20"
        y="12"
        width="39"
        height="55"
        rx="5"
        fill="#b74935"
        stroke="#fff8df"
        stroke-width="3"
        transform="rotate(-10 40 40)"
      /><rect
        x="59"
        y="8"
        width="39"
        height="55"
        rx="5"
        fill={step === 0 ? '#477b92' : '#71905c'}
        stroke="#fff8df"
        stroke-width="3"
        transform="rotate(10 80 40)"
      /><text x="40" y="49">7</text><text x="79" y="44"
        >{step === 0 ? '7' : '↺'}</text
      >{/if}
  {:else if game === 'catan'}
    {#if step === 0}{#each ['#668652', '#bf7e55', '#d4ad57'] as c, i}<rect
          x={22 + i * 26}
          y={15 + (i % 2) * 6}
          width="32"
          height="46"
          rx="4"
          fill={c}
          stroke="#fff1d5"
          stroke-width="2"
        /><path
          d="M{38 + i * 26} {26 + (i % 2) * 6}v24"
          stroke="#fff1d5"
          stroke-width="3"
        />{/each}
    {:else if step === 1}<path
        d="M18 61l43-25 42 25"
        stroke="#a34732"
        stroke-width="7"
        fill="none"
      /><path
        d="M42 42V22L60 8l18 14v20Z"
        fill="#a34732"
        stroke="#fff1d5"
        stroke-width="3"
      />
    {:else}<path
        d="M60 4l13 19 25 5-15 19 2 25-25-10-25 10 2-25-15-19 25-5Z"
        fill="#d4ad57"
      /><text x="60" y="47">10</text>{/if}
  {:else if game === 'azul'}
    <circle
      cx="60"
      cy="39"
      r="35"
      fill="#eee4c8"
      stroke="#a67b35"
      stroke-width="2"
    />
    {#each [0, 1, 2, 3] as i}<rect
        x={35 + (i % 2) * 26}
        y={15 + Math.floor(i / 2) * 26}
        width="23"
        height="23"
        rx="3"
        fill={['#246c99', '#e7b03f', '#b8493d', '#263b47'][step === 0 ? i : 0]}
      /><path
        d="m{46 + (i % 2) * 26} {18 + Math.floor(i / 2) * 26} 8 8-8 8-8-8Z"
        fill="none"
        stroke="#f5e2b6"
      />{/each}
    {#if step === 2}<text x="94" y="62" fill="#194766">+7</text>{/if}
  {:else}
    <rect
      x="13"
      y="13"
      width="50"
      height="50"
      rx="3"
      fill="#93a773"
      stroke="#f8e5b8"
      stroke-width="3"
    /><path d="M14 40h48" stroke="#e7ce99" stroke-width="9" />
    {#if step === 0}<rect
        x="65"
        y="13"
        width="50"
        height="50"
        rx="3"
        fill="#a3b57d"
        stroke="#f8e5b8"
        stroke-width="3"
      /><path d="M66 40h48" stroke="#e7ce99" stroke-width="9" />
    {:else if step === 1}<path
        d="M72 26a9 9 0 1 1 14 0l17 11-7 9-10-6 5 24H67l5-24-10 6-7-9Z"
        fill="#a34732"
        stroke="#ffedc6"
        stroke-width="2"
      />
    {:else}<circle cx="88" cy="39" r="24" fill="#d4ad57" /><text x="88" y="48"
        >+3</text
      >{/if}
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 110px;
    max-width: 100%;
    height: 78px;
  }
  text {
    font-family: system-ui, sans-serif;
    font-size: 25px;
    font-weight: 800;
    fill: #fff6df;
    text-anchor: middle;
  }
</style>
