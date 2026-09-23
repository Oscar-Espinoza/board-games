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
  <img
    decoding="async"
    class="board-substrate"
    src="/games/azul/rich/board-blank-v3.webp"
    alt=""
    aria-hidden="true"
    draggable="false"
  />
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
  <aside class="bonus-legend">
    <span>{m.azul_rows_bonus()}</span><span>{m.azul_columns_bonus()}</span><span
      >{m.azul_colors_bonus()}</span
    >
  </aside>
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
  <div class="score-rail" aria-label={m.azul_score({ score: displayedScore })}>
    <img
      decoding="async"
      class="score-substrate"
      src="/games/azul/rich/score-rail.webp"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <div class="rail-ticks" aria-hidden="true">
      {#each Array(11) as _, i}<span>{i === 10 ? '100+' : i * 10}</span>{/each}
    </div>
    <span
      class="score-marker"
      style="left:calc(10.4% + {railPosition(displayedScore) * 0.792}%)"
      aria-hidden="true"
      ><img
        decoding="async"
        src="/games/azul/rich/score-marker.webp"
        alt=""
        aria-hidden="true"
        draggable="false"
      /><b>{displayedScore}</b></span
    >
    {#if displayedScore > 100}<span
        class="score-overflow"
        aria-label={m.azul_score_overflow({ score: displayedScore })}>100+</span
      >{/if}
  </div>
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

  /* Rich & Dramatic keeps every live cell in HTML while the generated artwork
     supplies the photographed board, floor rail, and aged-brass score rail. */
  .player-board:not(.compact) {
    position: relative;
    width: 100%;
    max-width: 820px;
    height: 410px;
    padding: 0;
    overflow: visible;
    border: 0;
    outline: 0;
    border-radius: 8px;
    background: transparent;
    box-shadow: none;
    filter: drop-shadow(6px 12px 9px rgba(0, 2, 6, 0.72));
  }
  .player-board:not(.compact).active {
    filter: drop-shadow(0 0 9px rgba(201, 153, 73, 0.3))
      drop-shadow(6px 12px 9px rgba(0, 2, 6, 0.72));
  }
  .board-substrate {
    position: absolute;
    z-index: 0;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 350px;
    object-fit: fill;
    clip-path: inset(1px 2px 2px 1px round 7px);
    pointer-events: none;
    user-select: none;
  }
  .player-board:not(.compact) header {
    position: absolute;
    z-index: 5;
    top: 3px;
    left: 50%;
    display: grid;
    min-width: 156px;
    height: 45px;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 10px;
    padding: 2px 14px;
    transform: translateX(-50%);
    border: 1px solid #9c7135;
    border-radius: 4px 4px 14px 14px;
    background: rgba(3, 20, 33, 0.94);
    box-shadow:
      inset 0 0 0 1px rgba(230, 187, 105, 0.2),
      0 4px 7px rgba(0, 0, 0, 0.45);
    color: #f5ead2;
  }
  .player-board:not(.compact) .name {
    color: #f5ead2;
    font-size: 16px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .player-board:not(.compact) header strong {
    color: #d5a65a;
    font-size: 18px;
    font-weight: 500;
  }
  .player-board:not(.compact) header small {
    color: #b7aa91;
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .player-board:not(.compact) .starter {
    color: #d6aa62;
    font-size: 18px;
  }
  .player-board:not(.compact) .board-labels {
    position: absolute;
    z-index: 2;
    top: 48px;
    right: 96px;
    left: 96px;
    display: grid;
    margin: 0;
    color: rgba(91, 66, 36, 0.72);
    font-size: 8px;
  }
  .player-board:not(.compact) .mosaic {
    position: absolute;
    z-index: 2;
    top: 58px;
    right: 92px;
    left: 92px;
    display: grid;
    height: 226px;
    grid-template-columns: 1fr 1fr;
    gap: 31px;
    --tile: 34px;
    --gap: 3px;
  }
  .player-board:not(.compact) .patterns,
  .player-board:not(.compact) .wall {
    grid-template-rows: repeat(5, 44px);
    gap: 1px;
  }
  .player-board:not(.compact) .pattern {
    min-height: 44px;
    padding: 3px;
  }
  .player-board:not(.compact) .row-number {
    left: 4px;
    color: rgba(72, 61, 45, 0.7);
  }
  .player-board:not(.compact) .arrow {
    right: -20px;
    color: #9a7139;
  }
  .player-board:not(.compact) .empty-slot {
    border-color: rgba(91, 65, 29, 0.38);
    background: rgba(105, 76, 40, 0.07);
    box-shadow:
      inset 1px 1px 2px rgba(255, 255, 255, 0.46),
      inset -1px -2px 2px rgba(63, 42, 18, 0.15);
  }
  .bonus-legend {
    position: absolute;
    z-index: 5;
    right: 24px;
    bottom: 70px;
    display: grid;
    width: 150px;
    padding: 5px 9px;
    border: 1px solid rgba(151, 105, 48, 0.48);
    border-radius: 3px;
    background: rgba(232, 218, 190, 0.88);
    box-shadow:
      inset 0 0 0 1px rgba(255, 252, 240, 0.42),
      0 3px 6px rgba(0, 0, 0, 0.24);
    color: #654920;
    font-size: 8px;
    line-height: 1.45;
    letter-spacing: 0.02em;
  }
  .bonus-legend span + span {
    border-top: 1px solid rgba(117, 78, 31, 0.16);
  }
  .player-board:not(.compact) .floor {
    position: absolute;
    z-index: 5;
    bottom: 32px;
    left: 50%;
    display: block;
    width: 458px;
    height: 88px;
    min-height: 0;
    margin: 0;
    padding: 0;
    transform: translateX(-50%);
    border: 0;
    border-radius: 0;
    background: url('/games/azul/rich/floor-rail.webp') center / 100% 100%
      no-repeat;
    filter: drop-shadow(3px 7px 5px rgba(0, 2, 7, 0.58));
  }
  .player-board:not(.compact) .floor-label {
    position: absolute;
    top: -15px;
    left: 8px;
    max-width: none;
    color: #806139;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .player-board:not(.compact) .floor-slots {
    position: absolute;
    top: 26%;
    right: 9%;
    bottom: 12%;
    left: 11%;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
  }
  .player-board:not(.compact) .floor-space {
    position: relative;
    display: grid;
    place-items: center;
  }
  .player-board:not(.compact) .floor-space small {
    position: absolute;
    z-index: 2;
    top: -14px;
    display: grid;
    width: 17px;
    height: 17px;
    place-items: center;
    border: 1px solid rgba(138, 94, 37, 0.64);
    border-radius: 50%;
    background: #e9dcc2;
    color: #4f3c22;
    font-size: 8px;
    font-weight: 700;
  }
  .player-board:not(.compact) .floor .slot {
    width: 34px;
    height: 34px;
    transform: translateY(5px);
  }
  .player-board:not(.compact) .score-rail {
    position: absolute;
    z-index: 4;
    right: 0;
    bottom: 0;
    left: 0;
    height: 56px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    filter: drop-shadow(4px 8px 6px rgba(0, 2, 7, 0.65));
  }
  .score-substrate {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
    user-select: none;
  }
  .player-board:not(.compact) .rail-ticks {
    position: absolute;
    inset: 11px 85px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #c7a261;
    font-size: 8px;
  }
  .player-board:not(.compact) .rail-ticks span::after {
    top: 17px;
    bottom: auto;
    height: 4px;
    border: 0;
    background: rgba(198, 153, 76, 0.88);
  }
  .player-board:not(.compact) .score-marker {
    position: absolute;
    z-index: 2;
    top: 18px;
    bottom: auto;
    display: grid;
    width: 25px;
    height: 25px;
    place-items: center;
    transform: translateX(-50%);
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .score-marker img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    filter: drop-shadow(2px 4px 3px rgba(0, 0, 0, 0.62));
  }
  .score-marker b {
    position: absolute;
    top: -15px;
    left: 50%;
    min-width: 20px;
    padding: 1px 4px;
    transform: translateX(-50%);
    border: 1px solid rgba(173, 126, 55, 0.72);
    border-radius: 8px;
    background: #071b2b;
    color: #f4ddb0;
    font-size: 8px;
    text-align: center;
  }
  .player-board:not(.compact) .score-overflow {
    top: 4px;
    right: 48px;
    background: transparent;
    color: #d6a85e;
    font-size: 9px;
  }

  .player-board.compact {
    position: relative;
    width: 100%;
    max-width: none;
    height: auto;
    aspect-ratio: 2.72;
    padding: 0;
    overflow: hidden;
    border: 0;
    outline: 0;
    border-radius: 3px;
    background: transparent;
    box-shadow: none;
    filter: drop-shadow(2px 4px 3px rgba(0, 2, 7, 0.62));
  }
  .player-board.compact .board-substrate {
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .player-board.compact .mosaic {
    position: absolute;
    z-index: 2;
    inset: 20% 9% 18%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8%;
    --tile: calc((100cqw - 18px) / 10);
  }
  .player-board.compact .floor {
    position: absolute;
    z-index: 3;
    bottom: 3%;
    left: 9%;
    display: block;
    width: 46%;
    height: 15%;
    min-height: 0;
    margin: 0;
    padding: 0;
    opacity: 0.82;
  }
  .player-board.compact .floor-slots {
    display: grid;
    height: 100%;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }
  .player-board.compact .floor-space,
  .player-board.compact .floor .slot {
    display: block;
    width: 100%;
    height: 100%;
  }
  .player-board.compact .score-rail,
  .player-board.compact .bonus-legend {
    display: none;
  }

  @media (max-width: 900px) {
    .player-board:not(.compact) .board-labels {
      display: none;
    }
    .player-board:not(.compact) .mosaic {
      right: 28px;
      left: 28px;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      --tile: min(30px, calc((100cqw - 120px) / 10));
    }
    .player-board:not(.compact) .floor {
      width: min(458px, calc(100% - 44px));
    }
    .player-board:not(.compact) .floor .slot {
      width: min(34px, 7cqw);
      height: min(34px, 7cqw);
    }
    .player-board:not(.compact) .bonus-legend {
      top: 8px;
      right: auto;
      bottom: auto;
      left: 9px;
      width: 90px;
      padding: 3px 5px;
      font-size: 6px;
    }
  }
</style>
