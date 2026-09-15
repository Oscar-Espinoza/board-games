<script lang="ts">
  import Dish from '../Dish.svelte';
  import type { Face } from '../cards.js';
  let {
    card,
    trio = false,
    boxed = false,
  }: {
    card: Pick<Face, 'kind' | 'variant'>;
    trio?: boolean;
    boxed?: boolean;
  } = $props();
  const id = $props.id();
</script>

<div class="food-art" class:trio>
  {#if boxed}<Dish
      {card}
      boxed
    />{:else if ['tempura', 'dumpling', 'pudding', 'wasabi', 'chopsticks', 'maki'].includes(card.kind)}
    <svg
      viewBox={['tempura', 'pudding'].includes(card.kind)
        ? '12 0 136 106'
        : '12 14 136 90'}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-dough`} cx=".38" cy=".25" r=".8"
          ><stop stop-color="#fff4c5" /><stop
            offset=".55"
            stop-color="#f8d58c"
          /><stop offset="1" stop-color="#dfae5e" /></radialGradient
        >
        <radialGradient id={`${id}-gold`} cx=".3" cy=".2" r=".9"
          ><stop stop-color="#ffe8a1" /><stop
            offset=".5"
            stop-color="#ffc864"
          /><stop offset="1" stop-color="#e9a342" /></radialGradient
        >
        <radialGradient id={`${id}-green`} cx=".3" cy=".15" r=".85"
          ><stop stop-color="#bdcc77" /><stop
            offset=".5"
            stop-color="#a5ba63"
          /><stop offset="1" stop-color="#789549" /></radialGradient
        >
        <linearGradient id={`${id}-caramel`} x2=".2" y2="1"
          ><stop stop-color="#b8633c" /><stop
            offset="1"
            stop-color="#793e30"
          /></linearGradient
        >
        <linearGradient id={`${id}-nori`} x2=".7" y2="1"
          ><stop stop-color="#32665b" /><stop
            offset=".6"
            stop-color="#204d45"
          /><stop offset="1" stop-color="#153c36" /></linearGradient
        >
        <linearGradient id={`${id}-wood`} x2="0" y2="1"
          ><stop stop-color="#f4cd7d" /><stop
            offset=".4"
            stop-color="#df9c4f"
          /><stop offset="1" stop-color="#9f5b36" /></linearGradient
        >
      </defs>
      {#if card.kind === 'tempura'}
        {#each [0, 1] as n}
          <g
            transform={`translate(${n * 48 + 6} ${n ? 5 : 0}) rotate(${n ? -7 : 9} 47 60)`}
          >
            <ellipse
              cx="49"
              cy="92"
              rx="27"
              ry="5"
              fill="#80653d"
              opacity=".16"
            />
            <path
              d="M50 38Q37 16 44 9Q50 5 55 24Q56 5 64 9Q73 15 56 39"
              fill="#f07b50"
              stroke="#d77143"
              stroke-width="1.5"
            />
            <path
              d="m49 17 5 12m8-12-7 15"
              stroke="#ffb083"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M49 29Q42 28 40 36Q32 34 32 45Q22 44 25 55Q16 57 20 66Q13 73 21 78Q20 88 32 88Q37 96 47 89Q57 96 64 88Q74 89 75 79Q80 71 71 65Q74 55 65 51Q68 42 57 40Q59 30 49 29Z"
              fill={`url(#${id}-gold)`}
              stroke="#e0a750"
              stroke-width="1.3"
            />
            {#each [[41, 39], [34, 50], [48, 47], [29, 62], [58, 54], [66, 74], [29, 80], [50, 83], [58, 76], [41, 57], [62, 64]] as [x, y]}<path
                d={`m${x} ${y} 2-3 2 3-2 2Z`}
                fill="#fff1be"
                opacity=".85"
              />{/each}
            {@render smile(47, 69, 0.85)}
          </g>
        {/each}
      {:else if card.kind === 'dumpling'}
        <ellipse cx="81" cy="87" rx="56" ry="12" fill="#9b895b" opacity=".16" />
        <ellipse
          cx="80"
          cy="81"
          rx="61"
          ry="17"
          fill="#f0cc87"
          stroke="#d8b97c"
        />
        <ellipse cx="80" cy="77" rx="59" ry="16" fill="#fff6d6" />
        <path
          d="M30 74Q25 63 43 53Q44 40 57 38Q61 27 73 35Q86 24 93 35Q106 29 112 44Q130 50 128 70Q111 90 78 88Q42 90 30 74"
          fill={`url(#${id}-dough)`}
          stroke="#e3bd7e"
          stroke-width="1.3"
        />
        <path
          d="M45 56q10 6 9 12M58 42q10 10 7 18M74 36q7 9 4 19M93 37q-1 8-7 16M111 46q-6 3-12 11"
          stroke="#d4a36a"
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="M45 55q4 2 7 8m6-22q7 8 6 13m10-17 2 14m16-13-5 11"
          stroke="#fff6d6"
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
        />
        <path
          d="m41 83 6-3m67 2 4-2m-23 6 5-2"
          stroke="#8f9e58"
          stroke-width="3"
          stroke-linecap="round"
        />
        {@render smile(80, 69, 1.05)}
      {:else if card.kind === 'wasabi'}
        <ellipse cx="80" cy="91" rx="47" ry="8" fill="#718446" opacity=".28" />
        <path
          d="M35 86Q25 73 44 61Q43 47 57 44Q54 32 69 27Q71 11 84 16Q94 18 89 31Q106 31 101 45Q114 49 111 62Q128 73 125 84Q93 101 35 86Z"
          fill={`url(#${id}-green)`}
          stroke="#8ba054"
          stroke-width="1.3"
        />
        <path
          d="M71 28q-1 8-9 12m27-8q-4 7-12 8m26 7q-3 8-8 9m-50 9q-7 6-6 12"
          fill="none"
          stroke="#d4db92"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path
          d="M37 87q37 12 83-1"
          stroke="#688846"
          stroke-width="2"
          opacity=".5"
          fill="none"
        />
        {@render smile(81, 71, 1.1)}
      {:else if card.kind === 'pudding'}
        <ellipse cx="80" cy="94" rx="51" ry="8" fill="#695644" opacity=".18" />
        <ellipse cx="80" cy="85" rx="53" ry="16" fill="#c17b50" /><ellipse
          cx="80"
          cy="81"
          rx="54"
          ry="16"
          fill="#f5d9a3"
          stroke="#d7a16c"
          stroke-width="2"
        />
        <path
          d="M54 37Q80 27 105 37L117 77Q115 92 81 92Q43 91 42 77Z"
          fill={`url(#${id}-dough)`}
          stroke="#d3a461"
          stroke-width="1.4"
        />
        <path
          d="M53 37Q78 25 105 37L109 51Q99 60 94 54Q89 47 83 52Q73 57 64 49Q56 54 49 50Z"
          fill={`url(#${id}-caramel)`}
        />
        <ellipse cx="79" cy="36" rx="26" ry="10" fill="#9e5637" />
        <path
          d="M58 36q12-7 21-5"
          stroke="#d39161"
          stroke-width="3"
          stroke-linecap="round"
          fill="none"
        />
        <path
          d="M71 27Q64 14 73 11Q79 6 84 12Q98 8 95 20Q87 35 80 35Z"
          fill="#e35e52"
          stroke="#ad493e"
          stroke-width="1.4"
        />
        <path d="m71 12 8 3 0-8 5 6 7-4-3 9-8-3-6 5" fill="#6e914b" />
        <path
          d="m76 21 1 2m9-3 1 2m-6 4 1 2"
          stroke="#ffd69b"
          stroke-width="1.5"
        />
        {@render smile(80, 73, 1)}
      {:else if card.kind === 'chopsticks'}
        <g transform="rotate(-18 80 55)">
          <path
            d="M21 50h119M21 70l119-4"
            stroke="#66523a"
            stroke-width="7"
            stroke-linecap="round"
            opacity=".13"
            transform="translate(0 5)"
          />
          <path
            d="M21 50h119M21 70l119-4"
            stroke={`url(#${id}-wood)`}
            stroke-width="7"
            stroke-linecap="round"
          />
          <path
            d="M24 48h110M23 68l111-4"
            stroke="#ffe0a0"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M35 47v6m10-6v6m-10 14v7m10-7v6"
            stroke="#ed7752"
            stroke-width="5"
          />
        </g>
        {@render smile(113, 83, 0.62)}
      {:else if card.kind === 'maki'}
        {#each trio ? [[53, 42, 0.84], [108, 42, 0.84], [81, 27, 0.85]] : [[49, 34, 1], [108, 34, 1]] as [x, y, s]}
          <g transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse
              cx="0"
              cy="55"
              rx="26"
              ry="5"
              fill="#25473a"
              opacity=".2"
            />
            <path
              d="M-23 8V40Q-24 55 0 56Q25 56 24 40V8"
              fill={`url(#${id}-nori)`}
              stroke="#204f46"
            />
            <path
              d="M-18 20v20"
              stroke="#659783"
              opacity=".35"
              stroke-width="3"
              stroke-linecap="round"
            />
            <ellipse
              cy="9"
              rx="24"
              ry="17"
              fill="#fcf5de"
              stroke="#356352"
              stroke-width="2"
            />
            <ellipse cy="8" rx="14" ry="9" fill="#ed8672" /><path
              d="m-7 4 12 7"
              stroke="#ffc3a0"
              stroke-width="3"
              stroke-linecap="round"
            />
            <path
              d="M-18 4l3-3m27 12 3-3M4-4h4"
              stroke="#dfd9b9"
              stroke-width="2"
              stroke-linecap="round"
            />
            <g fill="#d9e9ce"
              ><circle cx="-7" cy="34" r="1.5" /><circle
                cx="7"
                cy="34"
                r="1.5"
              /></g
            ><path
              d="m-3 39q3 3 6 0"
              fill="none"
              stroke="#d9e9ce"
              stroke-width="1.3"
            />
            <ellipse
              cx="-12"
              cy="38"
              rx="3"
              ry="1.8"
              fill="#da9280"
              opacity=".7"
            /><ellipse
              cx="12"
              cy="38"
              rx="3"
              ry="1.8"
              fill="#da9280"
              opacity=".7"
            />
          </g>
        {/each}
      {/if}
    </svg>
  {:else if trio && card.kind === 'nigiri'}
    {#each ['egg', 'salmon', 'squid'] as variant}<div class="nigiri">
        <Dish card={{ kind: 'nigiri', variant }} />
      </div>{/each}
  {:else}
    <Dish {card} />
  {/if}
</div>

{#snippet smile(x: number, y: number, scale: number)}
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse
      cx="-18"
      cy="5"
      rx="5"
      ry="3"
      fill="#ef9174"
      opacity=".7"
    /><ellipse cx="18" cy="5" rx="5" ry="3" fill="#ef9174" opacity=".7" />
    <ellipse cx="-10" cy="0" rx="2.6" ry="3" fill="#3f4431" /><ellipse
      cx="10"
      cy="0"
      rx="2.6"
      ry="3"
      fill="#3f4431"
    />
    <circle cx="-10.7" cy="-.8" r=".8" fill="#fff9d6" /><circle
      cx="9.3"
      cy="-.8"
      r=".8"
      fill="#fff9d6"
    />
    <path
      d="M-4 5q4 6 8 0"
      fill="none"
      stroke="#695335"
      stroke-width="2"
      stroke-linecap="round"
    />
  </g>
{/snippet}

<style>
  .food-art {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 3px 1px #6e594522);
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .trio {
    display: flex;
    align-items: center;
  }
  .nigiri {
    width: 42%;
    flex-shrink: 0;
    margin-left: -10%;
  }
  .nigiri:first-child {
    margin-left: -1%;
    transform: rotate(-13deg) translateY(-4px);
  }
  .nigiri:last-child {
    transform: rotate(12deg);
  }
</style>
