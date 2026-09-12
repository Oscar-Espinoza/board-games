<script lang="ts">
  import type { Face } from './cards.js';
  let {
    card,
    boxed = false,
  }: { card: Pick<Face, 'kind' | 'variant'>; boxed?: boolean } = $props();
  const green = '#284e45',
    ivory = '#fff9e6',
    coral = '#ed8573';
</script>

<svg viewBox="0 0 120 100" aria-hidden="true" class="dish-art">
  <ellipse cx="61" cy="86" rx="41" ry="7" fill="#284e4515" />
  {#if boxed || card.kind === 'takeout'}
    <path
      d="M27 37 39 25H84L96 39 88 83H34Z"
      fill="#eed9ae"
      stroke={green}
      stroke-width="2"
    /><path
      d="m27 37 34 13 35-11M61 50v33M39 25l22 25 23-25"
      fill="none"
      stroke="#b39b73"
      stroke-width="2"
    /><path d="m47 18 14-8 16 8" fill="none" stroke={green} stroke-width="2" />
  {:else if card.kind === 'nigiri'}
    <rect
      x="24"
      y="43"
      width="73"
      height="36"
      rx="17"
      fill={ivory}
      stroke="#dddbc6"
      stroke-width="2"
    /><path
      d="M23 39q8-23 69-12 13 11 5 25-39 14-76 0Z"
      fill={card.variant === 'egg'
        ? '#f1cb55'
        : card.variant === 'squid'
          ? '#f3eee4'
          : coral}
      stroke={green}
      stroke-width="1.5"
    />{#each [36, 50, 64, 78] as x}<path
        d={`M${x} 29l12 21`}
        stroke={card.variant === 'salmon' ? '#ffe3c1' : '#ffffff70'}
        stroke-width="3"
      />{/each}{#if card.variant === 'egg'}<path
        d="M54 27h16v51H54z"
        fill={green}
      />{/if}
  {:else if ['maki', 'uramaki'].includes(card.kind)}
    {#each [34, 78] as x}<path
        d={`M${x - 19} 38v30c0 19 39 19 39 0V38`}
        fill={card.kind === 'maki' ? green : ivory}
        stroke={green}
        stroke-width="2"
      /><ellipse
        cx={x}
        cy="38"
        rx="20"
        ry="15"
        fill={ivory}
        stroke={green}
        stroke-width="3"
      /><ellipse cx={x} cy="38" rx="11" ry="8" fill={coral} /><path
        d={`m${x - 5} 35 10 6`}
        stroke="#8ead68"
        stroke-width="6"
      />{/each}
  {:else if card.kind === 'temaki'}
    <path d="m28 24 61 17-39 42Z" fill={green} /><ellipse
      cx="60"
      cy="30"
      rx="33"
      ry="17"
      fill={ivory}
      transform="rotate(16 60 30)"
    /><path d="m37 26 16-6 25 14-18 5Z" fill={coral} /><path
      d="m66 20 20 6-4 9-15-5Z"
      fill="#8fab69"
    />
  {:else if card.kind === 'onigiri'}
    {#if card.variant === 'circle'}<circle
        cx="60"
        cy="49"
        r="32"
        fill={ivory}
        stroke={green}
        stroke-width="2"
      />{:else if card.variant === 'triangle'}<path
        d="M52 20q8-13 16 0l29 49q5 13-10 13H32q-12-1-6-13Z"
        fill={ivory}
        stroke={green}
        stroke-width="2"
      />{:else}<rect
        x="25"
        y={card.variant === 'rectangle' ? 35 : 17}
        width="70"
        height={card.variant === 'rectangle' ? 46 : 66}
        rx="12"
        fill={ivory}
        stroke={green}
        stroke-width="2"
      />{/if}<path d="M48 57h24v25H48z" fill={green} />
  {:else if ['dumpling', 'tempura', 'sashimi', 'eel'].includes(card.kind)}
    {#if card.kind === 'dumpling'}<path
        d="M20 66q5-56 40-46 35-10 40 46-35 31-80 0Z"
        fill="#f4ddad"
        stroke={green}
        stroke-width="2"
      />{#each [35, 47, 59, 71, 83] as x}<path
          d={`M${x} 31q-4 16 3 27`}
          fill="none"
          stroke="#c49d69"
          stroke-width="2"
        />{/each}
    {:else}{#each [0, 1] as n}<g
          transform={`translate(${n * 29} ${n * 10}) rotate(-17 46 45)`}
          ><rect
            x="19"
            y="29"
            width="46"
            height="35"
            rx={card.kind === 'tempura' ? 15 : 8}
            fill={card.kind === 'sashimi'
              ? coral
              : card.kind === 'eel'
                ? '#a47960'
                : '#edbe66'}
            stroke={green}
            stroke-width="1.5"
          />{#each [28, 40, 52] as x}<path
              d={`M${x} 33v24`}
              stroke={card.kind === 'eel' ? '#684d41' : '#ffe7bf'}
              stroke-width="3"
            />{/each}{#if card.kind === 'tempura'}<path
              d="m20 38-12-9 3 19Z"
              fill={coral}
            />{/if}</g
        >{/each}{/if}
  {:else if card.kind === 'tofu'}
    <path
      d="m24 36 39-17 33 20v39l-37 9-35-15Z"
      fill={ivory}
      stroke={green}
      stroke-width="2"
    /><path
      d="m24 36 35 14 37-11M59 50v37"
      fill="none"
      stroke="#d5cfb0"
      stroke-width="2"
    /><path d="m45 33 10-5m4 10 12-5" stroke="#8da478" stroke-width="3" />
  {:else if card.kind === 'edamame'}
    <path
      d="M19 61Q43 0 99 29 88 80 34 82 17 81 19 61Z"
      fill="#a2bf73"
      stroke={green}
      stroke-width="2"
    />{#each [[38, 60], [59, 46], [80, 35]] as [x, y]}<ellipse
        cx={x}
        cy={y}
        rx="12"
        ry="15"
        fill="#c4d791"
        stroke="#81995e"
        stroke-width="1.5"
      />{/each}
  {:else if ['miso', 'tea', 'soy', 'wasabi', 'pudding', 'ice_cream'].includes(card.kind)}
    {#if card.kind === 'wasabi'}<path
        d="M27 78q5-20 17-24-4-15 14-20-3-17 14-21-2 14 10 21-5 16 7 26l7 18Z"
        fill="#bdd083"
        stroke={green}
        stroke-width="2"
      /><path d="m44 54 29 5m-15-25 15 8" stroke="#87a464" stroke-width="3" />
    {:else if card.kind === 'soy'}<path
        d="M46 18h31l-4 20 12 12v32H33V50l15-12Z"
        fill="#694f40"
        stroke={green}
        stroke-width="2"
      /><path d="M43 17h36v9H43z" fill={coral} /><rect
        x="36"
        y="51"
        width="47"
        height="25"
        rx="4"
        fill="#edd6a5"
      />
    {:else if card.kind === 'pudding'}<path
        d="M39 27h44l13 52H24Z"
        fill="#efd687"
        stroke={green}
        stroke-width="2"
      /><ellipse cx="61" cy="28" rx="23" ry="9" fill="#be7c4d" />
    {:else}<path
        d="M20 48h80q-3 34-40 36-38-2-40-36Z"
        fill={card.kind === 'miso' ? '#b26f64' : '#faf0d5'}
        stroke={green}
        stroke-width="2"
      /><ellipse
        cx="60"
        cy="47"
        rx="40"
        ry="12"
        fill={card.kind === 'miso' ? '#a77852' : '#a2b98a'}
        stroke={green}
        stroke-width="2"
      />{#if card.kind === 'ice_cream'}<circle
          cx="47"
          cy="36"
          r="19"
          fill="#a7bf8c"
        /><circle cx="76" cy="35" r="17" fill="#bdd29e" /><circle
          cx="59"
          cy="20"
          r="18"
          fill="#9fb67f"
        />{:else if card.kind === 'miso'}<path
          d="m39 42 12-3 3 8-13 2m22-9 13 3-5 7-10-3"
          fill="#f3e4b9"
        />{:else}<path
          d="M50 31q-12-10 1-21m18 21q-11-10 1-21"
          fill="none"
          stroke="#6e8e6e"
          stroke-width="2"
        />{/if}{/if}
  {:else if card.kind === 'fruit'}
    {@const pieces = /^[012]{3}$/.test(card.variant)
      ? card.variant.split('').flatMap((n, i) => Array(Number(n)).fill(i))
      : [0, 1]}
    {#each pieces as fruit, i}
      <g transform={`translate(${pieces.length === 1 ? 60 : 37 + i * 46} 58)`}>
        {#if fruit === 0}
          <path
            d="M-25-19h50Q0 42-25-19Z"
            fill={coral}
            stroke="#789f65"
            stroke-width="5"
          />
          <path
            d="m-12-12 2 5m9-5 1 5m10-5-1 5"
            stroke={green}
            stroke-width="2"
          />
        {:else if fruit === 1}
          <circle r="23" fill="#efbb67" stroke="#bc8751" stroke-width="2" />
          <path
            d="M0-20v40M-20 0h40m-34-14 28 28m-28 0 28-28"
            stroke="#ffe5b6"
            stroke-width="2"
          />
        {:else}
          <path
            d="M-5-20-15-37-2-29 4-44 10-28 22-33 12-17Z"
            fill="#789f65"
            stroke={green}
            stroke-width="1.5"
          />
          <ellipse
            rx="19"
            ry="26"
            fill="#e7bf67"
            stroke="#a7864c"
            stroke-width="2"
          />
          <path
            d="m-15-16 29 31m-32-18 23 25m-10-46 23 25m-5-16-28 30m30-17-20 22m6-47-23 26"
            stroke="#be974f"
            stroke-width="1.5"
          />
        {/if}
      </g>
    {/each}
  {:else if card.kind === 'chopsticks'}
    <path
      d="m35 83 22-65m4 68 15-67"
      stroke="#af7a4e"
      stroke-width="9"
      stroke-linecap="round"
    /><path d="m56 19-5 16m25-15-4 17" stroke={coral} stroke-width="9" />
  {:else if card.kind === 'spoon'}
    <path
      d="m45 81 26-45"
      stroke="#b99a7b"
      stroke-width="10"
      stroke-linecap="round"
    /><ellipse
      cx="78"
      cy="30"
      rx="14"
      ry="21"
      transform="rotate(30 78 30)"
      fill="#e6d2b2"
      stroke={green}
      stroke-width="2"
    />
  {:else}
    <path
      d="M25 19q18-8 35 2 18-10 35-2v62q-17-8-35 0-19-8-35 0Z"
      fill={ivory}
      stroke={green}
      stroke-width="2"
    /><path
      d="M60 21v60M34 35h15m-15 9h15m21-9h15m-15 9h15"
      stroke="#a3baaa"
      stroke-width="3"
    />{#if card.kind === 'special_order'}<path
        d="m60 31 6 11 13 3-10 9 2 14-11-6-12 6 3-14-10-9 13-3Z"
        fill={coral}
      />{/if}
  {/if}
  <g fill={green}
    ><circle cx="51" cy="63" r="2.3" /><circle cx="69" cy="63" r="2.3" /><path
      d="M56 68q4 5 8 0"
      fill="none"
      stroke={green}
      stroke-width="1.8"
      stroke-linecap="round"
    /></g
  ><ellipse cx="45" cy="68" rx="4" ry="2" fill="#ee8e8370" /><ellipse
    cx="75"
    cy="68"
    rx="4"
    ry="2"
    fill="#ee8e8370"
  />
</svg>

<style>
  .dish-art {
    width: 100%;
    height: 100%;
    overflow: visible;
    display: block;
  }
</style>
