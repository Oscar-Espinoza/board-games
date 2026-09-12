<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
  const costs = {
    'road-cost': [
      [m.library_wood, 1, '#6c8854'],
      [m.library_brick, 1, '#b67352'],
    ],
    'settlement-cost': [
      [m.library_wood, 1, '#6c8854'],
      [m.library_brick, 1, '#b67352'],
      [m.library_wool, 1, '#8fa871'],
      [m.library_grain, 1, '#cfa64b'],
    ],
    'city-cost': [
      [m.library_grain, 2, '#cfa64b'],
      [m.library_ore, 3, '#8e9290'],
    ],
    'development-cost': [
      [m.library_wool, 1, '#8fa871'],
      [m.library_grain, 1, '#cfa64b'],
      [m.library_ore, 1, '#8e9290'],
    ],
  } as const;
  const cost = $derived(costs[lesson.id as keyof typeof costs]);
</script>

<svg
  viewBox="0 0 520 260"
  role="img"
  aria-label={`${lesson.title()}: ${lesson.frames[step]()}`}
>
  <rect width="520" height="260" rx="12" fill="#eee2c8" />
  {#if cost}
    <text x="130" y="30">Ada</text>
    {#each cost as resource, i}<rect
        x={30 + (i % 2) * 115}
        y={52 + Math.floor(i / 2) * 88}
        width="102"
        height="76"
        rx="5"
        fill={step === 2 ? '#d2c5a8' : resource[2]}
      /><text
        x={81 + (i % 2) * 115}
        y={83 + Math.floor(i / 2) * 88}
        class="cost-number">{step === 2 ? 0 : resource[1]}</text
      ><text
        x={81 + (i % 2) * 115}
        y={111 + Math.floor(i / 2) * 88}
        class="cost-label">{resource[0]()}</text
      >{/each}
    <path
      d="M273 120h43l-10-10m10 10-10 10"
      stroke="#997546"
      stroke-width="4"
    />
    <g opacity={step === 0 ? 0.3 : 1}>
      {#if lesson.id === 'road-cost'}<path
          d="M348 125l47-29 48 29"
          fill="none"
          stroke="#a34732"
          stroke-width="12"
          stroke-linecap="round"
        />
      {:else if lesson.id === 'development-cost'}<rect
          x="360"
          y="61"
          width="73"
          height="109"
          rx="6"
          fill="#65724f"
          stroke="#fff3d5"
          stroke-width="3"
        /><text x="397" y="130" class="cost-number">♞</text>
      {:else if lesson.id === 'city-cost'}<path
          d="M356 158v-46h26V76h27v-20h29v102Z"
          fill="#a34732"
          stroke="#fff3d5"
          stroke-width="3"
        />
      {:else}<path
          d="M358 157V98l37-31 37 31v59Z"
          fill="#a34732"
          stroke="#fff3d5"
          stroke-width="3"
        />{/if}
    </g><text x="397" y="222" class="value">{lesson.values[step]}</text>
  {:else if ['build', 'distance', 'route', 'production', 'robber'].includes(lesson.scene)}
    {#each [{ x: 180, y: 111, c: '#86a06d' }, { x: 276, y: 111, c: '#cfb565' }, { x: 228, y: 194, c: '#ac8260' }] as h}<path
        d="M{h.x} {h.y - 55}l48 28v55l-48 28-48-28v-55Z"
        fill={h.c}
        stroke="#fff3d5"
        stroke-width="4"
      />{/each}
    <circle cx="180" cy="111" r="20" fill="#fff2cf" /><text x="180" y="118"
      >6</text
    >
    <path
      d="M132 84v55l48 28 48-28v-55"
      fill="none"
      stroke="#a34732"
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray={step === 0 ? '12 6' : '0'}
    />
    <path
      d="M120 82V62l12-11 12 11v20Z"
      fill="#a34732"
      stroke="#fff3d5"
      stroke-width="2"
    />
    <text x="109" y="40" font-size="14">Ada</text>
    {#if lesson.scene === 'robber'}<path
        d="M{step === 0 ? 260 : 165} 129l5-22a12 12 0 1 1 20 0l5 22Z"
        fill="#403a32"
        stroke="#eee2c8"
        stroke-width="3"
      />{:else if lesson.scene === 'distance'}<path
        d="M168 182v-20l12-11 12 11v20Z"
        fill="#497b92"
      /><text x="178" y="212" font-size="13">Bea</text><text
        x="115"
        y="137"
        class="value">{step > 0 ? '✕' : '?'}</text
      >{:else if lesson.scene === 'production'}<path
        d="M216 87V65h12V53h13v34Z"
        fill="#497b92"
        stroke="#fff3d5"
        stroke-width="2"
      /><text x="267" y="43" font-size="14">Bea</text>{/if}
    <rect x="362" y="65" width="132" height="123" rx="8" fill="#fff7e4" /><text
      x="428"
      y="129"
      class="value">{lesson.values[step]}</text
    ><text x="428" y="160" font-size="13"
      >{lesson.scene === 'production'
        ? m.library_wood()
        : lesson.scene === 'robber'
          ? m.library_result()
          : m.library_result()}</text
    >
  {:else if lesson.scene === 'turn'}
    {#each ['Ada', 'Bea', 'Leo', 'Dani', 'Eva', 'Fran'] as name, i}<circle
        cx={65 + i * 78}
        cy="95"
        r="27"
        fill={i === (step === 0 ? 0 : step === 1 ? 3 : 1)
          ? '#a34732'
          : '#c6b28d'}
      /><text x={65 + i * 78} y="101" fill="#fff8e4">{i + 1}</text><text
        x={65 + i * 78}
        y="149"
        font-size="14">{name}</text
      >{/each}
    <text x="260" y="214" class="value">{lesson.values[step]}</text>
  {:else if lesson.scene === 'development'}
    {#each [0, 1, 2] as i}<g
        transform="translate({80 + i * 117} 37) rotate({(i - 1) * 7} 45 65)"
        ><rect
          width="94"
          height="134"
          rx="8"
          fill="#656e50"
          stroke="#fff4d7"
          stroke-width="4"
        /><path
          d="M24 100V73l16-10-5-24 26 11 7 24-14 26Z"
          fill="#eddbab"
        /><text x="47" y="123" font-size="13" fill="#fff4d7">{i + 1}</text></g
      >{/each}
    <text x="260" y="219" class="value">{lesson.values[step]}</text>
  {:else if lesson.scene === 'score'}
    {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as n}<rect
        x={17 + n * 44}
        y="85"
        width="40"
        height="50"
        rx="5"
        fill={n === Number(lesson.values[step]) ? '#a34732' : '#fff2d4'}
      /><text
        x={37 + n * 44}
        y="116"
        style:fill={n === Number(lesson.values[step]) ? '#fff2d4' : '#513c2d'}
        >{n}</text
      >{/each}<text x="260" y="202" class="value"
      >Ada · {lesson.values[step]}</text
    >
  {:else}
    <text x="113" y="39"
      >{lesson.scene === 'trade' ? 'Bea + Leo' : m.library_bank()}</text
    ><text x="409" y="39">Ada</text>
    {#each [0, 1, 2] as i}<rect
        x={64 + i * 32}
        y={73 + i * 13}
        width="50"
        height="65"
        rx="5"
        fill={['#678451', '#be7654', '#d2b04a'][i]}
        stroke="#fff4d7"
        stroke-width="3"
      /><path
        d="M{82 + i * 32} {90 + i * 13}v30m-7-17 7 8 7-8"
        stroke="#f6e2b6"
        stroke-width="3"
      />{/each}
    <path
      d="M222 106h63l-12-10m12 10-12 10"
      stroke="#94744c"
      stroke-width="4"
    />
    <rect x="364" y="70" width="90" height="92" rx="8" fill="#fff5dc" /><text
      x="409"
      y="126"
      class="value">{lesson.values[step]}</text
    >
    <text x="260" y="221" font-size="16">{lesson.values[step]}</text>
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
    font-size: 27px;
    font-weight: 750;
  }
  .cost-number {
    font-size: 29px;
    font-weight: 750;
    fill: #fff6dc;
  }
  .cost-label {
    font-size: 14px;
    fill: #fff6dc;
  }
</style>
