<script lang="ts">
  import { fixture } from './fixture.js';
  import PartyBoard from '../table/PartyBoard.svelte';
  import PlayerSeat from './PlayerSeat.svelte';
  import PlayerTableau from './PlayerTableau.svelte';
  import LocalHand from './LocalHand.svelte';
  import ScorePawn from '../table/ScorePawn.svelte';
  import PrimaryAction from './PrimaryAction.svelte';
  import PassingDirection from './PassingDirection.svelte';
  import TableDecor from '../table/TableDecor.svelte';

  let width = $state(1440),
    height = $state(900);
  const scale = $derived(Math.min(width / 1440, height / 900));
  let selectedHandle = $state(fixture.selectedHandle);
  const local = fixture.players.find((p) => p.id === fixture.localId)!;
  const names = Object.fromEntries(fixture.players.map((p) => [p.id, p.name]));
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<main
  class="sushi-prototype"
  lang="en"
  aria-label="Sushi Go Party! static five-player table"
>
  <div class="scene" style:transform={`translate(-50%, -50%) scale(${scale})`}>
    <TableDecor />
    <PassingDirection passes={fixture.passes} {names} />
    <PartyBoard
      players={fixture.players}
      menu={fixture.menu}
      round={fixture.round}
      pick={fixture.pick}
      totalPicks={fixture.totalPicks}
    />
    {#each fixture.players.filter((p) => p.id !== fixture.localId) as player}<PlayerSeat
        {player}
      />{/each}
    <section
      class="local-seat tray"
      data-player={local.id}
      aria-label={`${local.name}, your seat, ${local.score} points`}
    >
      <div class="local-info">
        <ScorePawn color={local.color} />
        <h2>{local.name}</h2>
        <span class="score">{local.score} <span>✦</span></span><span
          class="count">{local.count} cards</span
        >
      </div>
      <div class="local-tableau">
        <p>My dishes:</p>
        <PlayerTableau
          cards={local.tableau}
          newlyPlayedId={local.newlyPlayedId}
        />
      </div>
      <div class="hand-zone">
        <LocalHand
          cards={fixture.hand}
          {selectedHandle}
          onselect={(handle) => (selectedHandle = handle)}
        />
      </div>
      <div class="keep"><PrimaryAction /></div>
    </section>
    <svg class="paper-grain" aria-hidden="true"
      ><filter id="party-grain"
        ><feTurbulence
          type="fractalNoise"
          baseFrequency=".72"
          numOctaves="3"
          stitchTiles="stitch"
        /><feColorMatrix type="saturate" values="0" /></filter
      ><rect
        width="100%"
        height="100%"
        filter="url(#party-grain)"
        opacity=".16"
      /></svg
    >
  </div>
</main>

<style>
  @font-face {
    font-family: 'Party Table';
    src: url('/fonts/codenames/roboto-condensed-latin.woff2') format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
  :global(body:has(.sushi-prototype)) {
    overflow: hidden;
  }
  :global(body:has(.sushi-prototype) .site-header) {
    display: none;
  }
  .sushi-prototype {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #315c50;
    font-family: 'Party Table', 'Trebuchet MS', sans-serif;
    color: #203f48;
  }
  .scene {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1440px;
    height: 900px;
    overflow: hidden;
    isolation: isolate;
    border: 8px solid #f1eedf;
    border-radius: 14px;
    background:
      radial-gradient(ellipse at 49% 51%, #8fb69b66, transparent 65%),
      radial-gradient(ellipse at 7% 20%, #173f3333, transparent 35%), #578c79;
  }
  .scene::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.16;
    mask-image: repeating-linear-gradient(
      133deg,
      #000 0,
      #000 8%,
      transparent 14%,
      transparent 21%,
      #000 28%
    );
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='74' viewBox='0 0 100 74'%3E%3Cg fill='none' stroke='%23e2cc88' stroke-width='2'%3E%3Cpath d='M-50 37a50 50 0 0 1 100 0 50 50 0 0 1 100 0M-40 37a40 40 0 0 1 80 0m20 0a40 40 0 0 1 80 0M-30 37a30 30 0 0 1 60 0m40 0a30 30 0 0 1 60 0M-20 37a20 20 0 0 1 40 0m60 0a20 20 0 0 1 40 0M0 74a50 50 0 0 1 100 0M10 74a40 40 0 0 1 80 0M20 74a30 30 0 0 1 60 0M30 74a20 20 0 0 1 40 0'/%3E%3C/g%3E%3C/svg%3E");
  }
  .scene :global(.tray) {
    border: 3px solid #ccad7e;
    border-radius: 37% 28% 30% 27% / 21% 24% 28% 25%;
    background: radial-gradient(
      ellipse at 47% 45%,
      #fffae7 8%,
      #f5e8cd 63%,
      #e7c99b 85%,
      #ceab7a 97%
    );
    box-shadow:
      inset 0 0 0 6px #e5c498,
      inset 0 0 0 9px #f7e0b8,
      inset 0 -12px 7px #b5956144,
      0 5px 0 #a98560,
      3px 11px 9px #284b4044;
  }
  .local-seat {
    position: absolute;
    left: 141px;
    top: 657px;
    width: 1113px;
    height: 271px;
    border-radius: 20% 44% 15% 16% / 72% 52% 28% 32% !important;
  }
  .local-info {
    position: absolute;
    top: 17px;
    left: 81px;
    display: flex;
    align-items: center;
    gap: 14px;
    height: 42px;
  }
  h2 {
    font:
      780 25px / 30px 'Party Table',
      sans-serif;
    margin: 0;
  }
  .score {
    font-size: 24px;
    font-weight: 750;
  }
  .score span {
    color: #edb368;
  }
  .count {
    font-size: 16px;
    color: #817d68;
    margin-left: 8px;
  }
  .local-tableau {
    position: absolute;
    left: 34px;
    top: 94px;
  }
  .local-tableau p {
    font-size: 14px;
    color: #7d7a66;
    margin: 0 0 3px;
  }
  .hand-zone {
    position: absolute;
    left: 311px;
    top: 29px;
  }
  .keep {
    position: absolute;
    right: 20px;
    top: 113px;
  }
  .paper-grain {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    mix-blend-mode: multiply;
    opacity: 0.37;
    z-index: 10;
  }
</style>
