<script lang="ts">
  import {
    wallColors,
    penalties,
    rowIssue,
    type Board,
    type Color,
    type Destination,
  } from './index.js';
  import { railPosition } from './geometry.js';
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
    hiddenLocations = [],
    fitted = false,
    density = 'full',
    interactive = true,
    anchors = true,
    displayedScore = board.score,
  }: {
    fitted?: boolean;
    hiddenLocations?: string[];
    density?: 'full' | 'compact';
    interactive?: boolean;
    anchors?: boolean;
    displayedScore?: number;
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
  const location = (suffix: string) =>
    anchors ? `${id}/${suffix}` : undefined;
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

<section
  class="player-board"
  class:active
  class:fitted
  class:compact={density === 'compact'}
  aria-hidden={density === 'compact' ? true : undefined}
  aria-label={m.azul_board({ name })}
>
  {#if density === 'compact'}<span
      class="compact-marker"
      data-azul-location={location('marker')}
    ></span>{/if}
  <header>
    <span class="name"
      >{name}<span
        class="starter"
        class:marker-away={!marker}
        aria-hidden={!marker}
        data-azul-location={density === 'full' ? location('marker') : undefined}
        title={m.azul_next()}>①</span
      ></span
    ><strong
      >{displayedScore}<small> {m.azul_score({ score: '' })}</small></strong
    >
  </header>
  <div class="score-rail" aria-label={m.azul_score({ score: displayedScore })}>
    <div class="rail-ticks" aria-hidden="true">
      {#each Array(21) as _, i}<span>{i % 4 === 0 ? i * 5 : ''}</span>{/each}
    </div>
    <span
      class="score-marker"
      style="left:{railPosition(displayedScore)}%"
      aria-hidden="true"
    ></span>
    {#if displayedScore > 100}<span
        class="score-overflow"
        aria-label={m.azul_score_overflow({ score: displayedScore })}>100+</span
      >{/if}
  </div>
  <div class="board-labels">
    <span>{m.azul_patterns()}</span><span>{m.azul_wall()}</span>
  </div>
  <div class="mosaic">
    <div class="patterns">
      {#each board.patterns as pattern, row}
        {@const issue = color ? rowIssue(board, color, row) : null}
        <svelte:element
          this={interactive ? 'button' : 'div'}
          role={interactive ? 'button' : 'group'}
          class="pattern"
          class:legal={color && !issue && choose}
          class:selected={destination?.kind === 'pattern' &&
            destination.row === row}
          disabled={interactive ? !choose || !color || !!issue : undefined}
          aria-label="{m.azul_line({ row: row + 1 })} · {pattern.count}/{row +
            1} · {pattern.color
            ? colorLabels[pattern.color]()
            : m.azul_empty()} · {issueLabel(issue)}"
          title={issueLabel(issue)}
          onclick={interactive
            ? () => choose?.({ kind: 'pattern', row })
            : undefined}
        >
          <span class="row-number">{row + 1}</span><span
            class="arrow"
            aria-hidden="true">▸</span
          >
          {#if issue}<span class="row-issue">{issueLabel(issue)}</span>{/if}
          {#each Array(row + 1) as _, slot}<span
              class="slot"
              style:visibility={hiddenLocations.includes(
                `${id}/pattern/${row}/${slot}`,
              )
                ? 'hidden'
                : undefined}
              data-azul-location={location(`pattern/${row}/${slot}`)}
              >{#if pattern.color && slot < pattern.count}<Tile
                  color={pattern.color}
                />{:else}<span class="empty-slot"></span>{/if}</span
            >{/each}
        </svelte:element>
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
            data-azul-location={location(`wall/${r}/${c}`)}
            ><Tile color={wallColors[r][c]} ghost={!occupied} /></span
          >{/each}{/each}
    </div>
  </div>
  <span id="{descriptionId}-floor" class="visually-hidden"
    >{board.floor.length
      ? board.floor.map((color) => colorLabels[color]()).join(', ')
      : m.azul_empty()}</span
  >
  <svelte:element
    this={interactive ? 'button' : 'div'}
    role={interactive ? 'button' : 'group'}
    class="floor"
    class:legal={color && choose}
    class:selected={destination?.kind === 'floor'}
    disabled={interactive ? !choose || !color : undefined}
    onclick={interactive ? () => choose?.({ kind: 'floor' }) : undefined}
    aria-label={m.azul_floor()}
    aria-describedby="{descriptionId}-floor"
  >
    <span class="floor-label">{m.azul_floor()}</span><span class="floor-slots"
      >{#each penalties as penalty, slot}<span class="floor-space"
          ><small>−{penalty}</small><span
            class="slot"
            data-azul-location={location(`floor/${slot}`)}
            >{#if board.floor[slot]}<Tile
                color={board.floor[slot]}
              />{:else}<span class="empty-slot"></span>{/if}</span
          ></span
        >{/each}</span
    >
  </svelte:element>
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
    position: relative;
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
  .compact-marker {
    position: absolute;
    width: 8px;
    height: 8px;
    top: 2px;
    right: 2px;
    opacity: 0;
  }
  .marker-away {
    opacity: 0;
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
  .player-board {
    container-type: inline-size;
    --gap: 2px;
    padding: 14px 12px 12px;
    color: var(--azul-ink, #293c40);
    background: var(--azul-board, #f5ead3);
    border: 2px solid var(--azul-board-edge, #c9b28c);
    border-radius: 10px;
    box-shadow: var(--azul-board-shadow);
  }
  .mosaic,
  .floor {
    --tile: min(34px, calc((100cqw - 42px) / 10));
  }
  .mosaic,
  .board-labels {
    gap: 18px;
  }
  .name {
    font-family: var(--azul-title, Georgia, serif);
  }
  .row-number,
  .board-labels,
  .floor-space small {
    color: var(--azul-soft-ink, #514c40);
  }
  .arrow {
    position: absolute;
    right: -14px;
    font-size: 12px;
    color: #6b796f;
  }
  .floor {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 8px;
  }
  .floor-slots {
    gap: var(--gap);
  }
  .floor .slot {
    width: var(--tile);
    height: var(--tile);
  }
  .score-rail {
    position: relative;
    margin: 4px 8px 20px;
    border-bottom: 1px solid #716c59;
    padding-bottom: 6px;
  }
  .rail-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--azul-soft-ink, #514c40);
  }
  .rail-ticks span {
    position: relative;
    width: 0;
    display: flex;
    justify-content: center;
  }
  .rail-ticks span::after {
    content: '';
    position: absolute;
    bottom: -6px;
    height: 3px;
    border-left: 1px solid #716c59;
  }
  .score-marker {
    position: absolute;
    bottom: -5px;
    width: 9px;
    height: 9px;
    transform: translateX(-50%);
    background: #275e71;
    border: 1px solid #fff8e8;
    box-shadow: 0 1px 2px #0006;
  }
  .score-overflow {
    position: absolute;
    right: -8px;
    top: -15px;
    font-size: 11px;
    font-weight: 700;
    background: #f5ead3;
  }
  .compact {
    padding: 6px;
    border-width: 1px;
    border-radius: 5px;
  }
  .compact header,
  .compact .board-labels,
  .compact .floor-label,
  .compact .floor-space small,
  .compact .row-number,
  .compact .arrow,
  .compact .rail-ticks,
  .compact .score-overflow {
    display: none;
  }
  .compact .mosaic,
  .compact .floor {
    --tile: calc((100cqw - 18px) / 10);
    --gap: 1px;
  }
  .compact .mosaic {
    gap: 10px;
  }
  .compact .patterns,
  .compact .wall {
    grid-template-rows: repeat(5, calc(var(--tile) + 2px));
    gap: 1px;
  }
  .compact .pattern {
    min-height: 0;
    padding: 0;
    border: 0;
  }
  .compact .floor {
    min-height: 0;
    margin-top: 4px;
    padding: 0;
    border: 0;
  }
  .compact .score-rail {
    margin: 3px 3px 8px;
    padding: 0;
  }
  .compact .score-marker {
    width: 5px;
    height: 5px;
    bottom: -3px;
  }
  .compact .floor-space {
    gap: 0;
  }
  .fitted:not(.compact) {
    padding: 8px;
  }
  .fitted:not(.compact) header {
    padding-bottom: 3px;
  }
  .fitted:not(.compact) .name {
    font-size: 18px;
  }
  .fitted:not(.compact) header strong {
    font-size: 22px;
  }
  .fitted:not(.compact) .score-rail {
    margin: 3px 8px 12px;
  }
  .fitted:not(.compact) .board-labels {
    margin-bottom: 3px;
  }
  .fitted:not(.compact) .floor {
    min-height: 44px;
    margin-top: 3px;
    padding: 2px;
  }
</style>
