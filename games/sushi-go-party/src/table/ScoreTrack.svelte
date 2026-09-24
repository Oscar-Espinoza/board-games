<script lang="ts">
  import ScorePawn from './ScorePawn.svelte';
  import type { PartyPlayer } from './data.js';
  import { usePixel } from '../pixel/context.js';
  import { dishSheet, cellStyle, dishCells } from '../pixel/sprites.js';
  const pixel = usePixel();
  let {
    players,
    scoreLabel = (name: string, score: number) => `${name}: ${score} points`,
  }: {
    players: Pick<PartyPlayer, 'id' | 'name' | 'score' | 'color'>[];
    scoreLabel?: (name: string, score: number) => string;
  } = $props();
  // Clockwise stations around a 0–59 loop; exact scores stay on the seats.
  function point(score: number) {
    const n = ((score % 60) + 60) % 60;
    if (n <= 20)
      return { x: 119 + n * 29.3, y: 35 + (n < 2 || n > 18 ? 9 : 0) };
    if (n <= 30) return { x: 745 + (n - 20) * 5.1, y: 44 + (n - 20) * 37.3 };
    if (n <= 50)
      return { x: 795 - (n - 30) * 36.7, y: 417 + (n > 31 && n < 49 ? 29 : 0) };
    return { x: 46 + (n - 50) * 5.3, y: 417 - (n - 50) * 37.3 };
  }
  // The 8-bit board is a square conveyor belt: 20 stations along the long sides, 10 on the short ones.
  function beltPoint(score: number) {
    const n = ((score % 60) + 60) % 60;
    if (n <= 20) return { x: 40 + n * 38, y: 34 };
    if (n <= 30) return { x: 800, y: 34 + (n - 20) * 42.2 };
    if (n <= 50) return { x: 800 - (n - 30) * 38, y: 456 };
    return { x: 40, y: 456 - (n - 50) * 42.2 };
  }
  const at = $derived(pixel() ? beltPoint : point);
  const plate = cellStyle(dishSheet, dishCells.indexOf('plate'));
</script>

{#if pixel()}<div class="belt" aria-hidden="true">
    <i class="run top"></i><i class="run right"></i><i class="run bottom"></i><i
      class="run left"
    ></i>
    {#each Array.from({ length: 60 }, (_, i) => i) as n}
      {@const p = beltPoint(n)}
      {#if n % 5}<b
          class="stop"
          style:left={`${(p.x / 840) * 100}%`}
          style:top={`${(p.y / 490) * 100}%`}
        ></b>{:else}<span
          class="plate"
          style={plate}
          style:left={`${(p.x / 840) * 100}%`}
          style:top={`${(p.y / 490) * 100}%`}><b>{n}</b></span
        >{/if}
    {/each}
  </div>{:else}<svg class="track" viewBox="0 0 840 490" aria-hidden="true">
    <defs>
      <linearGradient id="party-rim" x2="0.3" y2="1"
        ><stop stop-color="#c4a77c" /><stop
          offset=".4"
          stop-color="#f1d2a2"
        /><stop offset="1" stop-color="#977657" /></linearGradient
      >
      <linearGradient id="party-stone" x2=".4" y2="1"
        ><stop stop-color="#b1b29b" /><stop
          offset=".5"
          stop-color="#d5c6a5"
        /><stop offset="1" stop-color="#b2b39c" /></linearGradient
      >
    </defs>
    <path
      d="M145 6H686Q756 6 776 77L830 375Q850 482 735 482H103Q-11 482 12 378L65 83Q80 6 145 6Z"
      fill="#835f4a"
      stroke="#3b574a"
      stroke-width="6"
    />
    <path
      d="M145 6H686Q756 6 776 77L830 375Q850 471 735 471H103Q-11 471 12 378L65 83Q80 6 145 6Z"
      fill="url(#party-rim)"
      stroke="#917359"
      stroke-width="3"
    />
    <path
      d="M145 17H686Q750 17 764 79L818 376Q838 459 733 459H104Q3 459 25 380L78 85Q91 17 145 17Z"
      fill="#456f60"
      stroke="#426153"
      stroke-width="3"
    />
    <path
      d="M139 38H687Q729 38 744 87L796 378Q814 437 730 437H107Q33 437 46 384L99 89Q109 38 139 38Z"
      fill="none"
      stroke="#253f37"
      stroke-width="45"
    />
    <path
      d="M139 38H687Q729 38 744 87L796 378Q814 437 730 437H107Q33 437 46 384L99 89Q109 38 139 38Z"
      fill="none"
      stroke="url(#party-stone)"
      stroke-width="40"
    />
    {#each Array.from({ length: 60 }, (_, i) => i) as n}
      {@const p = point(n + 0.5)}
      <path
        d={n < 20
          ? `M${p.x} 20q-7 17 0 36`
          : n < 30
            ? `M${p.x - 19} ${p.y + 3}q18 -9 37 0`
            : n < 50
              ? `M${p.x} 420q-7 16 0 34`
              : `M${p.x - 18} ${p.y}q17 -8 35 1`}
        fill="none"
        stroke="#696d5b"
        stroke-width="1.4"
        opacity=".85"
      />
    {/each}
    {#each Array.from({ length: 12 }, (_, i) => i * 5) as score}
      {@const p = point(score)}
      <rect
        x={p.x - 19}
        y={p.y - 15}
        width="38"
        height="30"
        rx="8"
        fill="#ecd2a3"
        stroke="#bda581"
        stroke-width="1"
      />
      <text
        x={p.x}
        y={p.y + 8}
        text-anchor="middle"
        fill="#24434a"
        font-size="25"
        font-weight="800">{score}</text
      >
    {/each}
  </svg>{/if}
{#each players as player}
  {@const p = at(player.score)}
  {@const tied = players.filter((other) => other.score === player.score)}
  {@const offset =
    (tied.findIndex((other) => other.id === player.id) -
      (tied.length - 1) / 2) *
    12}
  <div
    class="score-pawn"
    style:left={`${(p.x + offset) / 8.4}%`}
    style:top={`${(p.y - (pixel() ? 16 : 21)) / 4.9}%`}
    data-score-pawn={player.id}
    data-score={player.score}
  >
    <ScorePawn
      color={player.color}
      label={scoreLabel(player.name, player.score)}
      marker
    />
  </div>
{/each}

<style>
  .track {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .score-pawn {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 3;
  }
  /* 8-bit conveyor belt. The runs scroll in steps while hands pass. */
  .belt {
    position: absolute;
    inset: 0;
  }
  .run {
    position: absolute;
    background: url('/games/sushi-go-party/pixel/belt-h.webp') 0 0 / 24px 48px
      repeat-x;
    image-rendering: pixelated;
    box-shadow: 0 0 0 3px #1a0f08;
  }
  .run.top,
  .run.bottom {
    left: 16px;
    right: 16px;
    height: 48px;
  }
  .run.top {
    top: 10px;
  }
  .run.bottom {
    top: 432px;
  }
  .run.left,
  .run.right {
    top: 10px;
    bottom: 10px;
    width: 48px;
    background-image: url('/games/sushi-go-party/pixel/belt-v.webp');
    background-size: 48px 24px;
    background-repeat: repeat-y;
  }
  .run.left {
    left: 16px;
  }
  .run.right {
    left: 776px;
  }
  .stop {
    position: absolute;
    width: 6px;
    height: 6px;
    translate: -50% -50%;
    background: #1a0f08;
    box-shadow: 0 0 0 3px #d9c9a8;
  }
  .plate {
    position: absolute;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    translate: -50% -50%;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  .plate b {
    font:
      400 22px/1 'Jersey 10',
      monospace;
    color: #1a0f08;
    translate: 0 -2px;
  }
  :global(.sushi-table.passing) .run.top {
    animation: belt-right 720ms steps(6) both;
  }
  :global(.sushi-table.passing) .run.right {
    animation: belt-down 720ms steps(6) both;
  }
  :global(.sushi-table.passing) .run.bottom {
    animation: belt-left 720ms steps(6) both;
  }
  :global(.sushi-table.passing) .run.left {
    animation: belt-up 720ms steps(6) both;
  }
  @keyframes belt-right {
    to {
      background-position-x: 72px;
    }
  }
  @keyframes belt-left {
    to {
      background-position-x: -72px;
    }
  }
  @keyframes belt-down {
    to {
      background-position-y: 72px;
    }
  }
  @keyframes belt-up {
    to {
      background-position-y: -72px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .run {
      animation: none !important;
    }
  }
</style>
