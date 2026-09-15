<script lang="ts">
  import ScoreTrack from './ScoreTrack.svelte';
  import MenuTile from './MenuTile.svelte';
  import type { MenuTileData, PartyPlayer } from './data.js';
  let {
    players,
    menu,
    round,
    pick,
    totalPicks,
    indicator,
    boardLabel = 'Party board and score track',
    onrule,
    scoreLabel,
  }: {
    players: Pick<PartyPlayer, 'id' | 'name' | 'score' | 'color'>[];
    menu: MenuTileData[];
    round: number;
    pick: number;
    totalPicks: number;
    indicator?: string;
    boardLabel?: string;
    onrule?: (kind: MenuTileData['kind']) => void;
    scoreLabel?: (name: string, score: number) => string;
  } = $props();
</script>

<section class="party-board" aria-label={boardLabel}>
  <ScoreTrack {players} {scoreLabel} />
  <div class="round-pick">
    {#if indicator}{indicator}{:else}Round {round}<span>·</span>Pick {pick} / {totalPicks}{/if}
  </div>
  <div class="menu-grid">
    {#each [menu.slice(0, 4), menu.slice(4, 8)] as row}
      <div class="menu-row">
        {#each row as tile, i}<div
            class="tile-position"
            style:--tilt={`${(i - 1.5) * 1.6}deg`}
          >
            {#if onrule}<button
                class="rule-target"
                aria-label={`${tile.title}: ${tile.rules.join(' ')}`}
                onclick={() => onrule?.(tile.kind)}><MenuTile {tile} /></button
              >{:else}<MenuTile {tile} />{/if}
          </div>{/each}
      </div>
    {/each}
  </div>
</section>

<style>
  .party-board {
    position: absolute;
    left: 308px;
    top: 147px;
    width: 840px;
    height: 490px;
    filter: drop-shadow(0 7px 0 #253f3c44) drop-shadow(1px 14px 12px #1b393849);
  }
  .round-pick {
    position: absolute;
    top: 57px;
    left: 267px;
    width: 305px;
    height: 29px;
    border-radius: 20px;
    background: #284f4e;
    box-shadow: inset 0 2px 4px #182f3944;
    color: #f6f4df;
    text-align: center;
    font-size: 19px;
    line-height: 29px;
    font-weight: 750;
    letter-spacing: 0.3px;
  }
  .round-pick span {
    padding: 0 10px;
    opacity: 0.6;
  }
  .menu-grid {
    position: absolute;
    left: 95px;
    right: 95px;
    top: 92px;
    bottom: 98px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .menu-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    flex: 1;
    min-height: 0;
    gap: 5px;
    margin: 0 4px;
  }
  .menu-row:last-child {
    margin: 0 -5px;
  }
  .tile-position {
    min-height: 0;
    transform: skewX(var(--tilt));
  }
  .tile-position :global(.menu-tile) {
    height: 100%;
  }
  .rule-target {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    border-radius: 10px;
  }
  .rule-target:hover:enabled {
    background: transparent;
    transform: none;
    filter: brightness(1.035);
  }
  .rule-target:focus-visible {
    outline: 3px solid #fff4ba;
    outline-offset: 3px;
  }
</style>
