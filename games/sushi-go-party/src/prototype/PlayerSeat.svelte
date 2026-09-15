<script lang="ts">
  import type { PartyPlayer } from '../table/data.js';
  import ScorePawn from '../table/ScorePawn.svelte';
  import PlayerTableau from './PlayerTableau.svelte';
  import HiddenHand from '../table/HiddenHand.svelte';
  let { player }: { player: PartyPlayer } = $props();
  const statusLabel = {
    choosing: 'Choosing…',
    passing: 'Passing…',
    ready: 'Ready!',
  };
</script>

<section
  class="player-seat tray"
  class:top={player.position === 'top'}
  class:left={player.position === 'left'}
  class:right={player.position === 'right'}
  class:lower-right={player.position === 'lower-right'}
  data-player={player.id}
  aria-label={`${player.name}, ${player.score} points, ${statusLabel[player.status]}`}
>
  <div class="seat-info">
    <ScorePawn color={player.color} />
    <h2>{player.name}</h2>
    <span class="score">{player.score}<span class="star">✦</span></span>
    <span class="status" class:choosing={player.status === 'choosing'}
      >{statusLabel[player.status]}</span
    >
    <span class="count">{player.count} cards</span>
  </div>
  <div class="seat-cards">
    <PlayerTableau
      cards={player.tableau}
      newlyPlayedId={player.newlyPlayedId}
      compact
    /><HiddenHand count={player.count} />
  </div>
</section>

<style>
  .player-seat {
    position: absolute;
    width: 293px;
    height: 226px;
    padding: 19px 22px;
  }
  .top {
    left: 485px;
    top: -26px;
    width: 470px;
    height: 159px;
    padding: 38px 37px 14px;
    border-radius: 70px 60px 85px 75px / 45px 40px 55px 50px;
  }
  .left {
    left: 8px;
    top: 213px;
    transform: rotate(2deg);
  }
  .right {
    right: 10px;
    top: 213px;
    transform: rotate(1deg);
  }
  .lower-right {
    right: 4px;
    top: 547px;
    width: 280px;
    height: 207px;
    transform: rotate(2deg);
  }
  .seat-info {
    display: grid;
    grid-template-columns: 39px 1fr auto;
    grid-template-rows: 36px 30px;
    column-gap: 9px;
    align-items: center;
  }
  .seat-info :global(.pawn) {
    grid-row: 1 / 3;
    align-self: start;
  }
  h2 {
    font:
      680 24px / 30px 'Party Table',
      sans-serif;
    margin: 0;
  }
  .score {
    font-size: 23px;
    font-weight: 680;
    white-space: nowrap;
  }
  .star {
    color: #efb462;
    font-size: 24px;
    padding-left: 4px;
  }
  .status {
    justify-self: start;
    background: linear-gradient(#83b8a9, #5fa49c);
    color: #fffdf1;
    font-size: 13px;
    font-weight: 700;
    padding: 7px 13px;
    border-radius: 20px;
    grid-column: 2;
    line-height: 16px;
    white-space: nowrap;
  }
  .status.choosing {
    background: linear-gradient(#f49b87, #e97c70);
  }
  .count {
    font-size: 16px;
    color: #827f6d;
    justify-self: end;
    white-space: nowrap;
  }
  .seat-cards {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    margin-top: 11px;
  }
  .top .seat-info {
    display: flex;
    gap: 13px;
    height: 31px;
  }
  .top .seat-info :global(.pawn) {
    width: 36px;
    height: 44px;
    margin-top: -7px;
  }
  .top h2 {
    font-size: 23px;
  }
  .top .status {
    padding: 6px 11px;
  }
  .top .count {
    margin-left: auto;
  }
  .top .seat-cards {
    margin-top: 3px;
    justify-content: center;
    gap: 12px;
  }
  .top .seat-cards :global(.tableau) {
    width: 131px;
  }
  .top .seat-cards :global(.compact .dish) {
    margin-right: -24px;
  }
  .lower-right .seat-cards {
    margin-top: 8px;
  }
</style>
