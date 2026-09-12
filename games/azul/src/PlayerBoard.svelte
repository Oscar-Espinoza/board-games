<script lang="ts">
  import {
    wallColors,
    penalties,
    rowIssue,
    type Board,
    type Color,
    type Destination,
  } from './index.js';
  import Tile from './Tile.svelte';
  import { m } from '@board-games/shared/messages';
  let {
    board,
    id,
    name,
    active = false,
    marker = false,
    color = null,
    destination = null,
    choose,
    highlights = [],
  }: {
    board: Board;
    id: string;
    name: string;
    active?: boolean;
    marker?: boolean;
    color?: Color | null;
    destination?: Destination | null;
    choose?: (d: Destination) => void;
    highlights?: [number, number][];
  } = $props();
  const descriptionId = $props.id();
  const colorLabels = {
    blue: m.azul_blue,
    yellow: m.azul_yellow,
    red: m.azul_red,
    black: m.azul_black,
    white: m.azul_white,
    marker: m.azul_marker,
  };
  const issueLabel = (issue: string | null) =>
    issue === 'full'
      ? m.azul_full()
      : issue === 'mixed'
        ? m.azul_mixed()
        : issue === 'wall'
          ? m.azul_wall_conflict()
          : m.azul_available();
</script>

<section class="player-board" class:active aria-label={m.azul_board({ name })}>
  <header>
    <span class="name"
      >{name}{#if marker}<span
          class="starter"
          data-azul-location="{id}/marker"
          title={m.azul_next()}>①</span
        >{/if}</span
    ><strong>{board.score}<small> {m.azul_score({ score: '' })}</small></strong>
  </header>
  <div class="board-labels">
    <span>{m.azul_patterns()}</span><span>{m.azul_wall()}</span>
  </div>
  <div class="mosaic">
    <div class="patterns">
      {#each board.patterns as pattern, row}
        {@const issue = color ? rowIssue(board, color, row) : null}
        <button
          class="pattern"
          class:legal={color && !issue && choose}
          class:selected={destination?.kind === 'pattern' &&
            destination.row === row}
          disabled={!choose || !color || !!issue}
          aria-label="{m.azul_line({ row: row + 1 })} · {pattern.count}/{row +
            1} · {pattern.color
            ? colorLabels[pattern.color]()
            : m.azul_empty()} · {issueLabel(issue)}"
          title={issueLabel(issue)}
          onclick={() => choose?.({ kind: 'pattern', row })}
        >
          <span class="row-number">{row + 1}</span>
          {#if issue}<span class="row-issue">{issueLabel(issue)}</span>{/if}
          {#each Array(row + 1) as _, slot}<span
              class="slot"
              data-azul-location="{id}/pattern/{row}/{slot}"
              >{#if pattern.color && slot < pattern.count}<Tile
                  color={pattern.color}
                />{:else}<span class="empty-slot"></span>{/if}</span
            >{/each}
        </button>
      {/each}
    </div>
    <div class="wall" aria-label={m.azul_wall()}>
      {#each board.wall as row, r}{#each row as occupied, c}<span
            class="wall-cell"
            class:scored={highlights.some(
              ([row, col]) => row === r && col === c,
            )}
            role="img"
            aria-label={m.azul_wall_cell({
              row: r + 1,
              column: c + 1,
              color: colorLabels[wallColors[r][c]](),
              status: occupied ? m.azul_occupied() : m.azul_empty(),
            })}
            data-azul-location="{id}/wall/{r}/{c}"
            ><Tile color={wallColors[r][c]} ghost={!occupied} /></span
          >{/each}{/each}
    </div>
  </div>
  <span id="{descriptionId}-floor" class="visually-hidden"
    >{board.floor.length
      ? board.floor.map((color) => colorLabels[color]()).join(', ')
      : m.azul_empty()}</span
  >
  <button
    class="floor"
    class:legal={color && choose}
    class:selected={destination?.kind === 'floor'}
    disabled={!choose || !color}
    onclick={() => choose?.({ kind: 'floor' })}
    aria-label={m.azul_floor()}
    aria-describedby="{descriptionId}-floor"
  >
    <span class="floor-label">{m.azul_floor()}</span><span class="floor-slots"
      >{#each penalties as penalty, slot}<span class="floor-space"
          ><small>−{penalty}</small><span
            class="slot"
            data-azul-location="{id}/floor/{slot}"
            >{#if board.floor[slot]}<Tile
                color={board.floor[slot]}
              />{:else}<span class="empty-slot"></span>{/if}</span
          ></span
        >{/each}</span
    >
  </button>
</section>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .player-board {
    --tile: 33px;
    --gap: 5px;
    width: 100%;
    max-width: 560px;
    box-sizing: border-box;
    color: #172b3a;
    padding: 16px 20px 14px;
    background: linear-gradient(120deg, #fff9e8, #f4e8cf);
    border: 3px solid #d9c89f;
    outline: 1px solid #98743f;
    border-radius: 7px;
    box-shadow:
      0 9px 25px #061c2b66,
      inset 0 0 0 5px #f9f0da,
      inset 0 0 0 7px #37708c55;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 2px 9px;
    gap: 10px;
  }
  .name {
    font-family: Georgia, serif;
    font-size: 20px;
    overflow-wrap: anywhere;
  }
  header strong {
    font-size: 25px;
    white-space: nowrap;
  }
  header small {
    font-size: 11px;
    font-weight: 500;
  }
  .starter {
    display: inline-block;
    color: #805419;
    font-size: 23px;
    margin-left: 8px;
  }
  .active {
    outline: 2px solid #d9ae61;
  }
  .board-labels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin: 0 0 7px;
    text-align: center;
    font-weight: 700;
  }
  .mosaic {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    align-items: stretch;
  }
  .patterns {
    display: grid;
    grid-template-rows: repeat(5, 44px);
    gap: 2px;
  }
  .pattern {
    border: 1px solid transparent;
    background: transparent;
    display: flex;
    flex-direction: row-reverse;
    justify-content: flex-start;
    align-items: center;
    gap: var(--gap);
    padding: 2px;
    position: relative;
    min-width: 0;
    border-radius: 4px;
    min-height: 44px;
    color: inherit;
  }
  .row-issue {
    position: absolute;
    inset: 1px;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 2px 4px;
    border-radius: 3px;
    background: #fff8e8f0;
    color: #5f4630;
    font-size: 11px;
    line-height: 1.2;
    text-align: center;
  }
  .row-number {
    position: absolute;
    left: 0;
    font-size: 10px;
    color: #617482;
  }
  .pattern:last-child .row-number {
    display: none;
  }
  .slot {
    width: var(--tile);
    height: var(--tile);
    display: inline-flex;
    flex: none;
  }
  .empty-slot {
    width: 100%;
    height: 100%;
    border: 1px solid #a9957255;
    background: #e6d8bc66;
    border-radius: 4px;
    box-sizing: border-box;
    box-shadow: inset 0 1px 2px #51432118;
  }
  .wall {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    grid-template-rows: repeat(5, 44px);
    gap: 2px;
    align-items: center;
    justify-items: center;
  }
  .wall-cell {
    width: var(--tile);
    height: var(--tile);
    display: block;
  }
  .scored {
    outline: 3px solid #bc8222;
    outline-offset: 2px;
    border-radius: 4px;
  }
  .floor {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 8px 2px 2px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    min-height: 59px;
    margin-top: 7px;
  }
  .floor-label {
    font-size: 11px;
    max-width: 70px;
    text-align: left;
  }
  .floor-slots {
    display: flex;
    gap: 5px;
  }
  .floor-space {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .floor-space small {
    font-size: 10px;
  }
  .floor .slot {
    width: 27px;
    height: 27px;
  }
  .legal {
    border: 1px dashed #547f81;
    background: #61948b12;
    cursor: pointer;
  }
  .legal:hover,
  .selected {
    border-color: #27667d !important;
    background: #579d962a !important;
    box-shadow: inset 0 0 0 1px #27667d;
  }
  .pattern:disabled,
  .floor:disabled {
    opacity: 1;
    cursor: default;
  }
  button:focus-visible {
    outline: 3px solid #1170a8;
    outline-offset: 2px;
  }
  @media (max-width: 600px) {
    .player-board {
      --tile: 23px;
      --gap: 3px;
      padding: 12px 10px 10px;
    }
    .mosaic,
    .board-labels {
      gap: 11px;
    }
    .floor-slots {
      gap: 4px;
    }
    .floor .slot {
      width: 25px;
      height: 25px;
    }
    .wall {
      column-gap: 3px;
    }
    .pattern {
      gap: 3px;
      padding: 1px;
    }
    .row-number {
      font-size: 9px;
    }
    .name {
      font-size: 19px;
    }
    header strong {
      font-size: 24px;
    }
    .board-labels {
      font-size: 9px;
      letter-spacing: 0.06em;
    }
  }
  @media (min-width: 601px) and (max-width: 1100px) {
    .player-board {
      --tile: 30px;
    }
  }
</style>
