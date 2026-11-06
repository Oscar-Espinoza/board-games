<script lang="ts">
  import type { Snippet } from 'svelte';
  import { modal } from '@board-games/shared/ui';
  import { m } from '@board-games/shared/messages';
  import { TILES, TARGET } from './index.js';
  import { MAX_TEAM_NAME, SEAT_INDEXES } from './constants.js';
  import type { DominoGame } from './game.svelte.js';
  import Tile from './Tile.svelte';
  import { tileUrl } from './pixel/sprites.js';

  /** Everything around the table both looks share: corners, scores, results, dialogs. */
  let {
    game: g,
    canRematch = false,
    rematch,
    rulesContent,
    settingsContent,
    children,
  }: {
    game: DominoGame;
    canRematch?: boolean;
    rematch?: () => void;
    rulesContent?: Snippet;
    settingsContent?: Snippet;
    children: Snippet;
  } = $props();
  const t = $derived(g.t),
    L = $derived(g.L),
    pub = $derived(g.pub),
    result = $derived(g.result);
  const focus = (el: HTMLInputElement) => {
    el.focus();
    el.select();
  };
</script>

<section
  class="domino"
  class:compact={g.compact}
  class:pixel={g.skin.choice === 'pixel'}
>
  {@render children()}

  {#if g.compact}
    <!-- Seats as they sit around you: who plays before you, your partner, who plays next. -->
    <ul class="seats">
      {#each [3, 2, 1] as r}
        {@const seat = g.seatAt(r)}
        <li
          class:active={pub.phase === 'playing' && pub.turn === seat}
          class:partner={r === 2}
        >
          <small class="role"
            >{r === 3
              ? `← ${t.before}`
              : r === 2
                ? t.partner
                : `${t.after} →`}{g.passed(seat) ? ` · ${t.passed}` : ''}</small
          >
          <span class="line"
            ><i class="dot" aria-hidden="true"></i><span class="who"
              >{g.name(seat)}</span
            ><span class="count">{g.handsLeft(r)}</span></span
          >
        </li>
      {/each}
    </ul>
  {/if}

  <button
    class="corner rules"
    onclick={() => (g.rulesOpen = true)}
    aria-label={t.rules}
    ><svg viewBox="0 0 24 24" aria-hidden="true"
      ><path
        d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 20a4 4 0 0 1 0-8h9"
      /></svg
    ><span>{t.rules}</span></button
  >
  <button
    class="corner settings"
    onclick={() => (g.settingsOpen = true)}
    aria-label={t.settings}
    ><span>{t.settings}</span><svg viewBox="0 0 24 24" aria-hidden="true"
      ><circle cx="12" cy="12" r="3.2" /><path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"
      /></svg
    ></button
  >

  <div class="chalkboard">
    {#each [0, 1] as const as team}
      <div class="team" class:ours={team === g.myTeam}>
        {#if g.editing === team}<input
            {@attach focus}
            maxlength={MAX_TEAM_NAME}
            aria-label={t.rename}
            bind:value={g.draft}
            onblur={g.commitEdit}
            onkeydown={(e) => {
              if (e.key === 'Enter') g.commitEdit();
              if (e.key === 'Escape') g.editing = null;
            }}
          />{:else}<button
            class="team-name"
            title={t.rename}
            onclick={() => g.startEdit(team)}>{pub.teams[team]}</button
          >{/if}
        <strong>{pub.scores[team]}</strong>
      </div>
      {#if team === 0}<span class="rule" aria-hidden="true"></span>{/if}
    {/each}
    <small>{m.domino_hand({ n: pub.handNumber, target: TARGET }, L)}</small>
  </div>

  {#if result}
    <div class="result" role="dialog" aria-labelledby="domino-result">
      <h2 id="domino-result">
        {result.kind === 'domino'
          ? m.domino_domino({}, L)
          : m.domino_tranque({}, L)}
      </h2>
      <p>
        {#if result.winner === null}{m.domino_tie(
            {},
            L,
          )}{:else}{m.domino_points(
            { team: pub.teams[result.winner], points: result.points },
            L,
          )}{/if}
      </p>
      <ul>
        {#each SEAT_INDEXES as seat}
          <li class:winner={result.seat === seat}>
            <span>{g.name(seat)}</span>
            <span class="revealed"
              >{#each g.tiles(seat) as id}<span class="mini"
                  >{#if g.skin.choice === 'pixel'}<img
                      src={tileUrl(TILES[id].a, TILES[id].b, false)}
                      alt=""
                    />{:else}<Tile
                      near={TILES[id].a}
                      far={TILES[id].b}
                    />{/if}</span
                >{/each}</span
            >
            <b>{g.count(seat)}</b>
          </li>
        {/each}
      </ul>
      {#if pub.phase === 'finished'}
        <p class="winner-line">
          {m.domino_match_won({ team: pub.teams[result.winner!] }, L)}
        </p>
        {#if canRematch && rematch}<button class="wood" onclick={rematch}
            >{m.domino_new_match({}, L)}</button
          >{/if}
      {:else}
        <button
          class="wood"
          disabled={g.pending}
          onclick={() => g.act({ type: 'NEXT_HAND' })}>{t.nextHand}</button
        >
      {/if}
    </div>
  {/if}

  <dialog
    class="panel"
    aria-label={t.settings}
    {@attach modal(() => g.settingsOpen)}
    onclose={() => (g.settingsOpen = false)}
    onclick={(e) => {
      if (e.target === e.currentTarget) g.settingsOpen = false;
    }}
  >
    <header>
      <h2>{t.settings}</h2>
      <button
        class="close"
        aria-label={t.close}
        onclick={() => (g.settingsOpen = false)}>×</button
      >
    </header>
    <div class="panel-body">
      <div class="looks" role="group" aria-label={t.look}>
        <span>{t.look}</span>
        {#each ['classic', 'pixel'] as const as look}<button
            aria-pressed={g.skin.choice === look}
            onclick={() => g.skin.choose(look)}
            >{look === 'classic' ? t.look3d : t.lookPixel}</button
          >{/each}
      </div>
      <label class="toggle"
        ><input
          type="checkbox"
          checked={g.preferences.sound}
          onchange={(e) => g.setSound(e.currentTarget.checked)}
        />{t.sound}</label
      >
      <label class="toggle"
        ><input
          type="checkbox"
          checked={g.motion}
          onchange={(e) => (g.preferences.motion = e.currentTarget.checked)}
        />{t.motion}</label
      >
      <label hidden={g.compact || g.skin.choice !== 'classic'}
        >{t.view}<input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={g.preferences.camera}
        /></label
      >
      {@render settingsContent?.()}
    </div>
  </dialog>
  <dialog
    class="panel wide"
    aria-label={t.rules}
    {@attach modal(() => g.rulesOpen)}
    onclose={() => (g.rulesOpen = false)}
    onclick={(e) => {
      if (e.target === e.currentTarget) g.rulesOpen = false;
    }}
  >
    <header>
      <h2>{t.rules}</h2>
      <button
        class="close"
        aria-label={t.close}
        onclick={() => (g.rulesOpen = false)}>×</button
      >
    </header>
    <div class="panel-body">{@render rulesContent?.()}</div>
  </dialog>
</section>

<style>
  @font-face {
    font-family: 'Domino Plaque';
    src: url('/fonts/carcassonne/marcellus.woff2') format('woff2');
    font-display: swap;
  }
  @font-face {
    font-family: 'Domino Chalk';
    src: url('/fonts/little-secret/kalam.woff2') format('woff2');
    font-display: swap;
  }
  .domino {
    --wood-dark: #2a170c;
    --wood: #5a3519;
    --wood-light: #8a5a30;
    --brass: #d6a54f;
    --ink: #f3e6cc;
    --lamp: #ffb347;
    position: absolute;
    inset: 0;
    overflow: clip;
    background: #0d0906;
    color: var(--ink);
    font-family: 'Domino Plaque', Georgia, serif;
    user-select: none;
    -webkit-user-select: none;
  }
  /* Corners */
  .corner {
    position: absolute;
    z-index: 6;
    top: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 14px;
    border: 2px solid #1c0f07;
    border-radius: 6px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 60%);
    box-shadow:
      inset 0 1px 0 rgb(255 220 170 / 0.25),
      0 4px 10px rgb(0 0 0 / 0.5);
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    cursor: pointer;
  }
  .rules {
    left: 14px;
  }
  .settings {
    right: 14px;
  }
  .corner svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Chalkboard scoreboard */
  .chalkboard {
    position: absolute;
    z-index: 5;
    top: 10px;
    left: 50%;
    translate: -50% 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2px 18px;
    padding: 10px 26px 8px;
    border: 7px solid #6b4424;
    border-radius: 4px;
    background:
      radial-gradient(ellipse at 40% 30%, rgb(255 255 255 / 0.08), transparent),
      #1f2421;
    box-shadow:
      inset 0 0 18px rgb(0 0 0 / 0.6),
      0 8px 18px rgb(0 0 0 / 0.55);
    font-family: 'Domino Chalk', cursive;
    color: #eeeadf;
    text-align: center;
  }
  .team {
    display: grid;
    min-width: 96px;
  }
  .team-name,
  .team input {
    font: inherit;
    font-size: 17px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: inherit;
    background: none;
    border: 0;
    padding: 0 4px;
    cursor: text;
  }
  .team input {
    width: 9em;
    border-bottom: 1px dashed rgb(255 255 255 / 0.5);
    text-align: center;
    outline: none;
  }
  .team strong {
    font-size: 34px;
    line-height: 1;
    font-weight: 400;
  }
  .team:not(.ours) strong {
    color: #f19b8c;
  }
  .rule {
    width: 2px;
    height: 44px;
    background: rgb(255 255 255 / 0.5);
    border-radius: 2px;
  }
  .chalkboard small {
    grid-column: 1 / -1;
    font-size: 12px;
    opacity: 0.65;
  }

  .wood {
    min-height: 48px;
    padding: 10px 18px;
    border: 2px solid #1a0d05;
    border-radius: 6px;
    background:
      repeating-linear-gradient(
        88deg,
        rgb(255 255 255 / 0.04) 0 2px,
        transparent 2px 9px
      ),
      linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    box-shadow:
      inset 0 1px 0 rgb(255 220 170 / 0.25),
      0 4px 10px rgb(0 0 0 / 0.5);
    color: var(--ink);
    font: inherit;
    font-size: 17px;
    cursor: pointer;
    touch-action: none;
  }
  .wood:disabled {
    filter: brightness(0.7) saturate(0.6);
    color: rgb(243 230 204 / 0.6);
    cursor: default;
  }
  .wood:not(:disabled):active {
    translate: 0 1px;
  }

  /* Hand result */
  .result {
    position: absolute;
    z-index: 7;
    left: 50%;
    top: 46%;
    translate: -50% -50%;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    padding: 20px 24px;
    border: 3px solid #1a0d05;
    border-radius: 10px;
    background:
      repeating-linear-gradient(
        91deg,
        rgb(255 255 255 / 0.03) 0 3px,
        transparent 3px 12px
      ),
      linear-gradient(170deg, #6b401f, #3d2210);
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.7);
    text-align: center;
  }
  .result h2 {
    margin: 0;
    font-size: 30px;
    font-weight: 400;
    color: var(--brass);
  }
  .result p {
    margin: 6px 0 14px;
  }
  .result ul {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .result li {
    display: grid;
    grid-template-columns: 6.5em 1fr 2.5em;
    align-items: center;
    gap: 10px;
    text-align: left;
  }
  .result li.winner span:first-child {
    color: var(--brass);
  }
  .revealed {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .mini {
    display: block;
    width: 36px;
    height: 18px;
    font-size: 18px;
  }
  .winner-line {
    font-size: 20px;
    color: var(--brass);
  }

  /* Dialogs */
  dialog.panel {
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 3px solid #1a0d05;
    border-radius: 10px;
    background: #f1e4c8;
    color: #2b1a0c;
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.6);
  }
  dialog.wide {
    width: min(760px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: rgb(10 6 3 / 0.6);
  }
  dialog header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood));
    color: var(--ink);
  }
  dialog h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 400;
  }
  .close {
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    color: inherit;
    font-size: 26px;
    cursor: pointer;
  }
  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
  .panel-body label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .panel-body label.toggle {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .panel-body input[type='range'] {
    accent-color: #8a5a30;
  }
  .panel-body :global(:is(a, button, select):not(.close)) {
    min-height: 40px;
  }
  /* Hanging chalkboard: two cords up out of frame. */
  .chalkboard::before,
  .chalkboard::after {
    content: '';
    position: absolute;
    bottom: 100%;
    width: 2px;
    height: 40px;
    background: #8c7a5c;
  }
  .chalkboard::before {
    left: 18%;
  }
  .chalkboard::after {
    right: 18%;
  }
  label[hidden] {
    display: none;
  }
  .compact .corner {
    top: 8px;
    min-height: 0;
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
  }
  .compact .rules {
    left: 8px;
  }
  .compact .settings {
    right: 8px;
  }
  .compact .corner span {
    display: none;
  }
  .compact .chalkboard {
    top: 6px;
    gap: 0 10px;
    padding: 3px 12px 2px;
    border-width: 4px;
  }
  .compact .chalkboard::before,
  .compact .chalkboard::after {
    display: none;
  }
  .compact .team {
    min-width: 64px;
  }
  .compact .team-name,
  .compact .team input {
    font-size: 11px;
  }
  .compact .team strong {
    font-size: 20px;
  }
  .compact .rule {
    height: 28px;
  }
  .compact .chalkboard small {
    font-size: 10px;
  }
  .seats {
    position: absolute;
    z-index: 5;
    top: 76px;
    left: 6px;
    right: 6px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .seats li {
    display: grid;
    min-width: 0;
    padding: 2px 6px 3px;
    border: 1px solid #1a0d05;
    border-radius: 6px;
    background: linear-gradient(170deg, #e8dcc2, #cdbb98);
    color: #2a1a0d;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.5);
  }
  .seats li:nth-child(2) {
    text-align: center;
  }
  .seats li:nth-child(3) {
    text-align: right;
  }
  .seats li.active {
    box-shadow:
      0 0 0 2px var(--lamp),
      0 0 14px rgb(255 179 71 / 0.6);
  }
  .role {
    overflow: hidden;
    font-family: system-ui, sans-serif;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #6b4a2a;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    font-size: 13px;
  }
  .seats li:nth-child(2) .line {
    justify-content: center;
  }
  .seats li:nth-child(3) .line {
    justify-content: flex-end;
  }
  /* Team marks match the chalkboard: your pair chalk-white, the others red. */
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border: 1px solid #2a1a0d;
    border-radius: 50%;
    background: #f19b8c;
  }
  .partner .dot {
    background: #fbf8ee;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
    min-width: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: #3b2413;
    color: var(--ink);
    font-size: 11px;
    text-align: center;
  }
  /* Landscape phones: header and seats in a left column, a lower hand bar. */
  @media (max-height: 520px) and (min-width: 521px) {
    .compact .chalkboard {
      top: 52px;
      left: 6px;
      translate: none;
      width: 144px;
      box-sizing: border-box;
      padding: 3px 6px 2px;
    }
    .compact .team {
      min-width: 0;
    }
    .compact .team-name {
      font-size: 10px;
      letter-spacing: 0;
    }
    .compact .settings {
      left: 52px;
      right: auto;
    }
    .seats {
      top: 128px;
      left: 6px;
      right: auto;
      width: 144px;
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .seats li,
    .seats li:nth-child(n) {
      text-align: left;
    }
    .seats li:nth-child(n) .line {
      justify-content: flex-start;
    }
  }

  @media (max-width: 720px), (max-height: 520px) {
    .corner span {
      display: none;
    }
    .chalkboard {
      padding: 6px 14px 4px;
      gap: 0 10px;
      border-width: 5px;
    }
    .team {
      min-width: 70px;
    }
    .team-name,
    .team input {
      font-size: 13px;
    }
    .team strong {
      font-size: 24px;
    }
  }
  /* Table look toggle in Settings. */
  .looks {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .looks span {
    margin-right: auto;
  }
  .looks button {
    min-width: 64px;
    padding: 8px 12px;
    border: 1px solid #8a5a30;
    border-radius: 4px;
    background: #fff7e5;
    color: #2b1a0c;
    font: inherit;
  }
  .looks button[aria-pressed='true'] {
    background: #6b401f;
    color: #fff7e5;
  }

  /* 8-bit skin: Pixelify Sans, hard ink borders, stepped shadows, store palette. */
  @font-face {
    font-family: 'Pixelify Sans';
    src: url('/fonts/pixel/pixelify-sans-400.woff2') format('woff2');
    font-display: swap;
  }
  @font-face {
    font-family: 'Pixelify Sans';
    font-weight: 700;
    src: url('/fonts/pixel/pixelify-sans-700.woff2') format('woff2');
    font-display: swap;
  }
  .pixel {
    --ink: #f6e7c8;
    --px-ink: #1e110a;
    --px-wood: #5b3620;
    --px-gold: #f2c14e;
    --px-green: #3f9a4a;
    --px-red: #c8483a;
    background: #0e0a12;
    font-family: 'Pixelify Sans', monospace;
  }
  .pixel :is(.corner, .chalkboard, .result, .seats li, .wood) {
    border: 3px solid var(--px-ink);
    border-radius: 0;
    box-shadow:
      inset 0 -4px 0 rgb(0 0 0 / 0.3),
      inset 0 0 0 2px #8a5a32,
      4px 4px 0 rgb(0 0 0 / 0.5);
  }
  .pixel .corner {
    background: var(--px-wood);
    color: var(--px-gold);
    text-transform: uppercase;
    font-size: 15px;
  }
  .pixel .corner:hover {
    background: #6d4327;
  }
  .pixel .corner svg {
    stroke-width: 2.4;
    stroke-linecap: square;
    stroke-linejoin: miter;
  }
  .pixel .chalkboard {
    top: 70px;
    left: 14px;
    translate: none;
    gap: 2px 14px;
    padding: 8px 16px 6px;
    background: #22301f;
    font-family: inherit;
  }
  .pixel .chalkboard::before,
  .pixel .chalkboard::after {
    display: none;
  }
  .pixel .team-name,
  .pixel .team input {
    font-size: 14px;
    letter-spacing: 0.06em;
  }
  .pixel .team strong {
    font-size: 30px;
    font-weight: 700;
    text-shadow: 2px 2px 0 #000;
  }
  .pixel .team.ours strong {
    color: #7fdc8a;
  }
  .pixel .team:not(.ours) strong {
    color: #ff8f7e;
  }
  .pixel .rule {
    border-radius: 0;
    background: repeating-linear-gradient(#fff8 0 4px, transparent 4px 8px);
  }
  .pixel .result {
    background: #3a2213;
    animation: result-in 0.4s steps(4, jump-end) 1.4s both;
  }
  @keyframes result-in {
    from {
      opacity: 0;
      translate: -50% -30%;
    }
  }
  .pixel .mini img {
    display: block;
    width: 36px;
    height: 18px;
    image-rendering: pixelated;
  }
  .pixel :is(h2, .panel-body) {
    font-family: 'Pixelify Sans', monospace;
  }
  .pixel .result h2 {
    color: var(--px-gold);
    font-weight: 700;
    text-transform: uppercase;
    text-shadow: 3px 3px 0 #000;
  }
  .pixel .result li.winner span:first-child,
  .pixel .winner-line {
    color: var(--px-gold);
  }
  .pixel .wood {
    background: var(--px-green);
    color: #fff;
    text-transform: uppercase;
  }
  .pixel .wood:disabled {
    filter: grayscale(0.6) brightness(0.7);
  }
  .pixel dialog.panel {
    border: 4px solid var(--px-ink);
    border-radius: 0;
    background: #f6e7c8;
    box-shadow: 8px 8px 0 rgb(0 0 0 / 0.5);
    font-family: 'Pixelify Sans', monospace;
  }
  .pixel dialog header {
    background: var(--px-wood);
    color: var(--px-gold);
    text-transform: uppercase;
  }
  .pixel .panel-body {
    font-family: inherit;
  }
  .pixel .looks button {
    border: 2px solid var(--px-ink);
    border-radius: 0;
    box-shadow: 2px 2px 0 rgb(0 0 0 / 0.4);
  }
  .pixel .looks button[aria-pressed='true'] {
    background: var(--px-green);
    color: #fff;
  }
  .pixel .seats li {
    background: #f6e7c8;
    color: var(--px-ink);
  }
  .pixel .seats li.active {
    background: var(--px-gold);
    box-shadow:
      inset 0 -4px 0 rgb(0 0 0 / 0.2),
      4px 4px 0 rgb(0 0 0 / 0.5);
  }
  .pixel .role {
    font-family: inherit;
    font-size: 10px;
    color: #6b4a2a;
  }
  .pixel .dot {
    border-radius: 0;
    background: var(--px-red);
  }
  .pixel .partner .dot {
    background: var(--px-green);
  }
  .pixel .count {
    border-radius: 0;
    background: var(--px-ink);
  }
  .compact.pixel .chalkboard {
    top: 6px;
    left: 50%;
    translate: -50% 0;
    padding: 3px 12px 2px;
    border-width: 3px;
  }
  .compact.pixel .team strong {
    font-size: 20px;
  }
  .compact.pixel .team-name,
  .compact.pixel .team input {
    font-size: 11px;
  }
  @media (max-height: 520px) and (min-width: 521px) {
    .compact.pixel .chalkboard {
      top: 52px;
      left: 6px;
      translate: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pixel .result {
      animation: none;
    }
  }
</style>
