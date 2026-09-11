<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  import type { Player } from '@board-games/game-core';
  import type { Action, Card, Color } from './index.js';
  import { seatPosition, type UnoView } from './presentation.js';
  import { cardMotion, cardAudio } from './motion.js';
  let {
    view,
    playerId,
    players,
    send,
    locale,
    round = 0,
    connected = true,
    pending = false,
    practice = false,
  }: {
    view: UnoView;
    playerId: string;
    players: Player[];
    send: (action: unknown) => void;
    locale: Locale;
    round?: number;
    connected?: boolean;
    pending?: boolean;
    practice?: boolean;
  } = $props();
  let root: HTMLElement;
  let declared = $state(false),
    soundEnabled = $state(true),
    motionEnabled = $state(true),
    showRules = $state(false);
  let motion = $state<ReturnType<typeof cardMotion>>();
  const audio = cardAudio();
  const palette = {
    red: '#cd514f',
    yellow: '#d4a63d',
    green: '#36896b',
    blue: '#447ec0',
  };
  const colors: Color[] = ['red', 'yellow', 'green', 'blue'];
  let pub = $derived(view.public),
    hand = $derived(view.private.hand),
    legal = $derived(view.private.legalActions);
  let ownIndex = $derived(pub.players.findIndex((p) => p.id === playerId));
  let seats = $derived([
    ...pub.players.slice(ownIndex),
    ...pub.players.slice(0, ownIndex),
  ]);
  let t = $derived({
    red: m.uno_red({}, { locale }),
    yellow: m.uno_yellow({}, { locale }),
    green: m.uno_green({}, { locale }),
    blue: m.uno_blue({}, { locale }),
    skip: m.uno_skip({}, { locale }),
    reverse: m.uno_reverse({}, { locale }),
    wild: m.uno_wild({}, { locale }),
  });
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const symbol = (card: Card) =>
    card.symbol === 'skip'
      ? '⊘'
      : card.symbol === 'reverse'
        ? '⇄'
        : card.symbol === 'wild'
          ? '✦'
          : card.symbol;
  const label = (card: Card) =>
    `${card.color ? t[card.color] : ''} ${card.symbol === 'wild' || card.symbol === 'skip' || card.symbol === 'reverse' ? t[card.symbol] : card.symbol}`.trim();
  const playable = (id: number) =>
    legal.some((a) => a.type === 'PLAY_CARD' && a.cardId === id);
  function act(action: Action) {
    audio.unlock();
    send(action);
  }
  function play(cardId: number) {
    act({ type: 'PLAY_CARD', cardId, uno: declared && hand.length === 2 });
    declared = false;
  }
  function preference(kind: 'sound' | 'motion', value: boolean) {
    try {
      localStorage.setItem(`uno:${kind}`, value ? 'on' : 'off');
    } catch {}
    if (kind === 'sound') {
      soundEnabled = value;
      audio.setEnabled(value);
      audio.unlock();
    } else {
      motionEnabled = value;
      if (!value) motion?.clear();
    }
  }
  let previousRound = -1;
  $effect.pre(() => {
    const next = view,
      enabled = motionEnabled,
      online = connected,
      controller = motion,
      currentRound = round;
    if (!controller) return;
    if (currentRound !== previousRound) {
      controller.reset();
      previousRound = currentRound;
    }
    const animate = untrack(() => controller.prepare(next, enabled, online));
    void tick().then(animate);
  });
  $effect(() => {
    if (hand.length !== 2 || pub.turn !== playerId || pub.phase !== 'turn')
      declared = false;
  });
  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    motionEnabled = !reduced.matches;
    try {
      soundEnabled = localStorage.getItem('uno:sound') !== 'off';
      const setting = localStorage.getItem('uno:motion');
      if (setting) motionEnabled = setting !== 'off';
    } catch {}
    audio.setEnabled(soundEnabled);
    motion = cardMotion(root, playerId, () => {
      if (!document.hidden) audio.play();
    });
    const unlock = () => audio.unlock();
    const reset = () => motion?.reset();
    const resize = () => motion?.clear();
    const reducedChanged = () => {
      try {
        if (localStorage.getItem('uno:motion') !== null) return;
      } catch {}
      motionEnabled = !reduced.matches;
      if (!motionEnabled) motion?.clear();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', reset);
    window.addEventListener('resize', resize);
    reduced.addEventListener('change', reducedChanged);
    return () => {
      motion?.reset();
      audio.dispose();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', reset);
      window.removeEventListener('resize', resize);
      reduced.removeEventListener('change', reducedChanged);
    };
  });
</script>

{#snippet cardFace(card: Card)}
  <span class="corner">{symbol(card)}</span>
  {#if !card.color}
    <svg class="wild-art" viewBox="0 0 80 100" aria-hidden="true">
      {#if card.symbol === '+4'}
        <g transform="rotate(-18 40 50)" stroke="#fff8e5" stroke-width="2.5">
          <rect x="8" y="20" width="24" height="40" rx="4" fill={palette.red} />
          <rect
            x="22"
            y="28"
            width="24"
            height="40"
            rx="4"
            fill={palette.blue}
          />
          <rect
            x="36"
            y="36"
            width="24"
            height="40"
            rx="4"
            fill={palette.green}
          />
          <rect
            x="50"
            y="44"
            width="24"
            height="40"
            rx="4"
            fill={palette.yellow}
          />
        </g>
      {:else}
        <g transform="rotate(25 40 50)">
          <path d="M40 50V12A30 38 0 0 1 70 50Z" fill={palette.red} />
          <path d="M40 50H70A30 38 0 0 1 40 88Z" fill={palette.blue} />
          <path d="M40 50V88A30 38 0 0 1 10 50Z" fill={palette.yellow} />
          <path d="M40 50H10A30 38 0 0 1 40 12Z" fill={palette.green} />
          <ellipse
            cx="40"
            cy="50"
            rx="30"
            ry="38"
            fill="none"
            stroke="#fff8e5"
            stroke-width="2.5"
          />
        </g>
      {/if}
    </svg>
  {:else}<strong>{symbol(card)}</strong>{/if}
  <span class="corner bottom">{symbol(card)}</span>
{/snippet}

<section
  bind:this={root}
  class="uno-table"
  aria-label="UNO"
  data-round={round}
  data-revision={pub.revision}
  data-sound={soundEnabled}
  data-motion={motionEnabled}
>
  <div class="table-surface" aria-hidden="true">
    <div class="table-stitch"></div>
    <span class="table-brand"
      >UNO<span
        >{practice
          ? m.uno_practice_table({}, { locale })
          : m.uno_table({}, { locale })}</span
      ></span
    >
  </div>
  <div class="seating roster">
    {#each seats as seat, index (seat.id)}
      {@const position = seatPosition(index, seats.length)}
      {@const member = players.find((p) => p.id === seat.id)}
      <div
        class="seat"
        class:local={index === 0}
        class:active={pub.turn === seat.id && pub.phase !== 'finished'}
        class:offline={member?.connected === false}
        style={`--seat-x:${position[0]}%;--seat-y:${position[1]}%`}
        data-seat={seat.id}
        data-position={index === 0
          ? 'south'
          : position[0] === 50
            ? 'north'
            : position[0] < 50
              ? 'west'
              : 'east'}
      >
        <div class="chair" aria-hidden="true"></div>
        <div class="portrait" aria-hidden="true">
          {name(seat.id).slice(0, 1).toUpperCase()}
        </div>
        <div class="seat-label">
          <b>{name(seat.id)}</b><span
            >{index === 0
              ? m.uno_you({}, { locale })
              : member?.bot
                ? m.uno_bot({}, { locale })
                : member?.connected === false
                  ? m.reserved({}, { locale })
                  : `${seat.count} ${m.uno_cards({}, { locale })}`}</span
          >
        </div>
        {#if index !== 0}<div
            class="seat-cards"
            aria-label={`${seat.count} ${m.uno_cards({}, { locale })}`}
          >
            {#each Array(Math.min(seat.count, 7)) as _, i}<span
                class="mini-back"
                style={`--fan:${i - (Math.min(seat.count, 7) - 1) / 2}`}
                aria-hidden="true">◈</span
              >{/each}
            <strong>{seat.count === 1 ? 'UNO!' : seat.count}</strong>
          </div>{:else}<span class="seat-cards local-anchor" aria-hidden="true"
          ></span>{/if}
      </div>
    {/each}
  </div>
  <div class="center-table">
    <div class="status" aria-live="polite">
      {#if pub.phase === 'finished'}<h2>
          {pub.winner
            ? `${name(pub.winner)} ${m.uno_won({}, { locale })}`
            : m.uno_tie({}, { locale })}
        </h2>
      {:else}<p class="turn-label">
          {pub.turn === playerId
            ? m.uno_your_move({}, { locale })
            : `${m.uno_waiting({}, { locale })} · ${name(pub.turn)}`}
        </p>{/if}
      <span
        class="color-indicator"
        style:--active-color={palette[pub.activeColor]}
        ><i></i>{t[pub.activeColor]}
        <span
          aria-label={pub.direction === 1
            ? m.uno_clockwise({}, { locale })
            : m.uno_counter({}, { locale })}
          >{pub.direction === 1 ? '↻' : '↺'}</span
        ></span
      >
    </div>
    <div class="piles">
      <div class="pile-group">
        <button
          class="stock"
          aria-label={`UNO ${pub.penalty ? `${m.uno_penalty({}, { locale })} +${pub.penalty.amount}` : m.uno_draw({}, { locale })}`}
          disabled={pending ||
            !connected ||
            !legal.some((a) => a.type === 'DRAW')}
          onclick={() => act({ type: 'DRAW' })}
        >
          <span class="card card-back"
            ><span class="back-emblem">UNO</span><span class="back-detail"
              >◈</span
            ></span
          >
          <span class="draw-label"
            >{pub.penalty ? `+${pub.penalty.amount}` : `+1`}</span
          >
        </button><small
          >{m.uno_draw_pile({}, { locale })} · {pub.stockCount}</small
        >
      </div>
      <div class="pile-group">
        {#key pub.top.id}<div
            class="card discard"
            class:wild-card={!pub.top.color}
            style:--card-color={pub.top.color
              ? palette[pub.top.color]
              : '#282c3b'}
            aria-label={label(pub.top)}
          >
            {@render cardFace(pub.top)}
          </div>{/key}<small>{m.uno_discard_pile({}, { locale })}</small>
      </div>
    </div>
    {#if pub.phase === 'color' && pub.turn === playerId}<div
        class="color-choice"
      >
        <p>{m.uno_choose({}, { locale })}</p>
        <div>
          {#each colors as color}<button
              style:background={palette[color]}
              disabled={pending || !connected}
              onclick={() => act({ type: 'CHOOSE_COLOR', color })}
              >{t[color]}</button
            >{/each}
        </div>
      </div>{/if}
    {#each legal.filter((a) => a.type === 'CATCH_UNO') as action}<button
        class="catch"
        disabled={pending || !connected}
        onclick={() => act(action)}
        >{m.uno_catch({}, { locale })}: {name(
          (action as Extract<Action, { type: 'CATCH_UNO' }>).player,
        )}</button
      >{/each}
  </div>
  <div class="hand-area">
    <div class="hand-heading">
      <h3>{m.uno_hand({}, { locale })}<span>{hand.length}</span></h3>
      <button
        class="declare"
        class:armed={declared}
        aria-pressed={declared}
        disabled={hand.length !== 2 ||
          pub.phase !== 'turn' ||
          pub.turn !== playerId ||
          pending ||
          !connected}
        onclick={() => {
          audio.unlock();
          declared = !declared;
        }}
        title={m.uno_declared_hint({}, { locale })}
        >{declared
          ? m.uno_armed({}, { locale })
          : m.uno_declare({}, { locale })}<strong>UNO!</strong></button
      >
    </div>
    <div class="hand-scroll">
      <div class="hand" style={`--count:${hand.length}`}>
        {#each hand as card (card.id)}<button
            class="card"
            class:wild-card={!card.color}
            data-card={card.id}
            class:playable={playable(card.id)}
            style:--card-color={card.color ? palette[card.color] : '#282c3b'}
            disabled={!playable(card.id) || pending || !connected}
            onclick={() => play(card.id)}
            aria-label={label(card)}
            title={label(card)}>{@render cardFace(card)}</button
          >{/each}
      </div>
    </div>
  </div>
  <header class="table-tools">
    <button
      aria-pressed={soundEnabled}
      onclick={() => preference('sound', !soundEnabled)}
      ><span aria-hidden="true">{soundEnabled ? '♫' : '♩'}</span>{m.uno_sound(
        {},
        { locale },
      )}<i class:on={soundEnabled}></i></button
    ><button
      aria-pressed={motionEnabled}
      onclick={() => preference('motion', !motionEnabled)}
      >{m.uno_motion({}, { locale })}<i class:on={motionEnabled}></i></button
    ><button aria-expanded={showRules} onclick={() => (showRules = !showRules)}
      >{m.uno_rules({}, { locale })}</button
    >
  </header>
  {#if showRules}<aside class="rules-panel">
      <p>{m.uno_hint({}, { locale })}</p>
      <p>{m.uno_declared_hint({}, { locale })}</p>
      <button onclick={() => (showRules = false)}>×</button>
    </aside>{/if}
</section>

<style>
  .uno-table {
    --card-w: 90px;
    --card-h: 132px;
    position: absolute;
    inset: 0;
    isolation: isolate;
    overflow: hidden;
    color: #f4efda;
    background: radial-gradient(ellipse at 50% 30%, #363e33, #171d19 80%);
    font-family: system-ui, sans-serif;
  }
  .table-surface {
    position: absolute;
    inset: 14% 12% 19%;
    border: 14px solid #67503c;
    border-radius: 48% / 44%;
    background: radial-gradient(
      ellipse at 48% 40%,
      #356858,
      #194e42 68%,
      #133c34
    );
    box-shadow:
      0 0 0 2px #947153,
      0 12px 0 #332a22,
      0 24px 40px #0007,
      inset 0 0 0 2px #b18a5f55,
      inset 0 0 65px #001f1b66;
  }
  .table-surface::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    opacity: 0.16;
    background: repeating-linear-gradient(
      0deg,
      transparent 0 2px,
      #b8d3b733 3px 4px
    );
    pointer-events: none;
  }
  .table-stitch {
    position: absolute;
    inset: 10px;
    border: 1px dashed #c5d4a644;
    border-radius: inherit;
  }
  .table-brand {
    position: absolute;
    left: 50%;
    top: 28%;
    transform: translate(-50%, -50%);
    font-weight: 900;
    font-style: italic;
    letter-spacing: -0.06em;
    font-size: 54px;
    color: #bbd8be16;
    text-align: center;
  }
  .table-brand span {
    display: block;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 500;
    font-style: normal;
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .seating {
    position: absolute;
    inset: 106px 0 20px;
    margin: 0;
    pointer-events: none;
  }
  .seat {
    position: absolute;
    left: clamp(42px, var(--seat-x), calc(100% - 42px));
    top: var(--seat-y);
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    flex-direction: column;
    width: 150px;
    z-index: 1;
    text-align: center;
  }
  .chair {
    position: absolute;
    z-index: -1;
    top: -13px;
    width: 78px;
    height: 86px;
    border: 5px solid #745942;
    border-radius: 30px 30px 19px 19px;
    background: linear-gradient(145deg, #514236, #322c24);
    box-shadow:
      0 6px 0 #111a,
      0 12px 14px #0005,
      inset 0 0 0 1px #b4916344;
  }
  .portrait {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    font-size: 22px;
    font-weight: 600;
    background: #d7ccac;
    color: #39483d;
    border: 3px solid #536657;
    box-shadow: 0 2px 8px #0004;
  }
  .seat.active .portrait {
    border-color: #e9cf7e;
    box-shadow:
      0 0 0 4px #e9cf7e22,
      0 0 20px #e9cf7e25;
  }
  .seat.offline {
    opacity: 0.5;
  }
  .seat-label {
    margin-top: 7px;
    background: #172b24e8;
    box-shadow: 0 4px 9px #0003;
    border: 1px solid #c0c9ae20;
    border-radius: 7px;
    padding: 6px 12px;
    max-width: 140px;
  }
  .seat-label b {
    display: block;
    font-size: 12px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seat-label span {
    display: block;
    font-size: 9px;
    color: #adbaac;
    margin-top: 2px;
  }
  .seat-cards {
    position: relative;
    height: 48px;
    width: 100px;
    margin-top: 5px;
  }
  .mini-back {
    position: absolute;
    width: 27px;
    height: 40px;
    border: 2px solid #d5d1b9;
    border-radius: 4px;
    background: #273c38;
    left: calc(36px + var(--fan) * 10px);
    top: calc(var(--fan) * var(--fan) * 1px);
    transform: rotate(calc(var(--fan) * 9deg));
    color: #d0ae62;
    display: grid;
    place-items: center;
    font-size: 12px;
    box-shadow: 0 2px 3px #0005;
  }
  .seat-cards strong {
    position: absolute;
    bottom: -7px;
    right: 0;
    font-size: 10px;
    border-radius: 20px;
    background: #e0c780;
    color: #24372b;
    padding: 3px 6px;
  }
  .local .chair {
    width: 100px;
  }
  .local .seat-label {
    display: block;
  }
  .local .portrait {
    width: 36px;
    height: 36px;
    font-size: 17px;
  }
  .local-anchor {
    display: none;
  }
  .seat.local {
    top: auto;
    bottom: calc(var(--card-h) + 68px);
    transform: translateX(-50%);
  }
  .center-table {
    position: absolute;
    left: 50%;
    top: 42%;
    transform: translate(-50%, -50%);
    text-align: center;
    width: 330px;
    z-index: 2;
  }
  .status {
    margin-bottom: 18px;
    min-height: 42px;
  }
  .turn-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    margin: 0 0 7px;
    color: #f3e8c4;
  }
  .status h2 {
    font-size: 24px;
    margin: 0 0 8px;
  }
  .color-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #c0cdbd;
  }
  .color-indicator i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--active-color);
    box-shadow: 0 0 0 2px #ffffff22;
  }
  .color-indicator > span {
    font-size: 17px;
    margin-left: 7px;
  }
  .piles {
    display: flex;
    justify-content: center;
    gap: 38px;
    align-items: flex-start;
  }
  .pile-group {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 12px;
  }
  .pile-group > small {
    font-size: 9px;
    color: #b0c2ad;
    letter-spacing: 0.04em;
  }
  .card {
    position: relative;
    isolation: isolate;
    width: var(--card-w);
    height: var(--card-h);
    flex-shrink: 0;
    border: 5px solid #f0ebd6;
    border-radius: 11px;
    padding: 0;
    color: #fff8e5;
    background: var(--card-color);
    box-shadow: 0 4px 7px #0005;
    font-family: system-ui, sans-serif;
    overflow: hidden;
    transition:
      transform 0.15s,
      filter 0.15s;
    cursor: default;
  }
  .card::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 18px 5px;
    border: 3px solid #fff8e5bb;
    border-radius: 50%;
    transform: rotate(27deg);
  }
  .wild-card::before {
    display: none;
  }
  .wild-art {
    position: absolute;
    inset: 10% 8%;
    width: 84%;
    height: 80%;
  }
  .card > strong {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 40px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -3px;
    text-shadow: 1px 2px #0003;
  }
  .corner {
    position: absolute;
    top: 4px;
    left: 6px;
    font-size: 16px;
    font-weight: 800;
    line-height: 1;
  }
  .bottom {
    top: auto;
    left: auto;
    right: 6px;
    bottom: 4px;
    transform: rotate(180deg);
  }
  .card-back {
    display: grid;
    place-items: center;
    background: repeating-linear-gradient(
      45deg,
      #253e37 0 3px,
      #29433b 3px 5px
    );
  }
  .card-back::before {
    inset: 10px;
    border: 1px solid #bca26b88;
    border-radius: 5px;
    transform: none;
  }
  .back-emblem {
    font-size: 25px;
    font-weight: 950;
    font-style: italic;
    letter-spacing: -2px;
    color: #e6ce91;
    background: #a33e39;
    border-radius: 50%;
    padding: 7px 5px;
    transform: rotate(-22deg);
  }
  .back-detail {
    position: absolute;
    bottom: 12px;
    font-size: 11px;
    color: #c1a96e;
  }
  .stock {
    display: block;
    position: relative;
    border: 0;
    padding: 0;
    background: transparent;
    border-radius: 11px;
    box-shadow:
      3px 3px #c3c5af,
      6px 6px #263b32,
      8px 8px #b4b99f;
    cursor: pointer;
    color: inherit;
  }
  .stock .card {
    pointer-events: none;
  }
  .stock:disabled {
    opacity: 1;
    cursor: default;
  }
  .stock:hover:enabled {
    background: transparent;
    transform: translateY(-3px);
  }
  .draw-label {
    position: absolute;
    right: -10px;
    bottom: -6px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #dbca92;
    color: #283c31;
    font-size: 12px;
    font-weight: 750;
    box-shadow: 0 2px 6px #0004;
  }
  .stock:disabled .draw-label {
    background: #7c8f77;
    color: #20392b;
  }
  .discard {
    transform: rotate(5deg);
  }
  .hand-area {
    position: absolute;
    left: 50%;
    bottom: 46px;
    transform: translateX(-50%);
    width: min(720px, 76vw);
    z-index: 3;
  }
  .hand-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px 2px;
    gap: 10px;
  }
  .hand-heading h3 {
    font: 500 10px system-ui;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #bbc7b7;
    margin: 0;
  }
  .hand-heading h3 span {
    margin-left: 8px;
    display: inline-grid;
    place-items: center;
    width: 19px;
    height: 19px;
    background: #b4c0a520;
    color: #e0e4d0;
    border-radius: 50%;
    font-size: 10px;
    letter-spacing: 0;
  }
  .hand-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 20px 10px 12px;
    scrollbar-width: thin;
    scrollbar-color: #7d907666 transparent;
  }
  .hand {
    display: flex;
    justify-content: center;
    gap: 0;
    margin: 0 auto;
    width: max-content;
    min-width: 100%;
    padding-right: 20px;
  }
  .hand .card {
    margin-right: clamp(-38px, calc(22px - var(--count) * 4px), 0px);
    cursor: pointer;
    box-shadow: -3px 2px 9px #0006;
  }
  .hand .card:disabled {
    opacity: 1;
    filter: saturate(0.75) brightness(0.78);
    cursor: default;
  }
  .hand .card.playable {
    box-shadow:
      inset 0 0 0 1px #fff8,
      -3px 2px 9px #0006;
  }
  .hand .card:hover:enabled,
  .hand .card:focus-visible {
    background: var(--card-color);
    transform: translateY(-14px);
    z-index: 2;
    filter: brightness(1.08);
  }
  .declare {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid #dec99166;
    border-radius: 7px;
    background: #263e32;
    color: #d4ddc6;
    padding: 7px 10px;
    font-size: 9px;
    min-height: 34px;
  }
  .declare strong {
    font-style: italic;
    font-size: 16px;
    color: #f0d286;
  }
  .declare:disabled {
    opacity: 0.42;
  }
  .declare.armed {
    background: #ae433b;
    color: white;
    box-shadow: 0 0 16px #d7854933;
  }
  .declare.armed strong {
    color: white;
  }
  .color-choice {
    position: absolute;
    top: calc(100% + 9px);
    left: 50%;
    transform: translateX(-50%);
    width: 310px;
    background: #182e27f5;
    padding: 10px 12px;
    border: 1px solid #a9b49055;
    border-radius: 12px;
    box-shadow: 0 8px 30px #0005;
  }
  .color-choice p {
    font-size: 11px;
    margin: 0 0 7px;
  }
  .color-choice > div {
    display: flex;
    gap: 6px;
  }
  .color-choice button {
    flex: 1;
    padding: 9px 4px;
    font-size: 10px;
    color: white;
    min-height: 36px;
    border: 1px solid #ffffff55;
  }
  .catch {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 8px 12px;
    background: #b0743d;
    font-size: 11px;
    color: white;
  }
  .table-tools {
    position: absolute;
    z-index: 4;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    align-items: center;
    white-space: nowrap;
  }
  .table-tools button {
    border: 1px solid #a9b49066;
    border-radius: 8px;
    background: #20332e;
    color: #f4efda;
    font-size: 13px;
    font-weight: 600;
    min-height: 38px;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 12px;
  }
  .table-tools button:hover {
    background: #345044;
    transform: none;
  }
  .table-tools i {
    width: 14px;
    height: 7px;
    border-radius: 10px;
    background: #4c584b;
    position: relative;
  }
  .table-tools i::after {
    content: '';
    position: absolute;
    width: 5px;
    height: 5px;
    top: 1px;
    left: 1px;
    background: #afbaaa;
    border-radius: 50%;
  }
  .table-tools i.on {
    background: #788e65;
  }
  .table-tools i.on::after {
    left: 8px;
    background: #e8e5c4;
  }
  .rules-panel {
    position: absolute;
    z-index: 6;
    top: 102px;
    left: 50%;
    transform: translateX(-50%);
    width: min(420px, 90vw);
    padding: 18px 30px 18px 20px;
    border: 1px solid #9fad8755;
    border-radius: 12px;
    background: #1b3029;
    box-shadow: 0 12px 40px #0008;
  }
  .rules-panel p {
    font-size: 12px;
    line-height: 1.6;
    margin: 0 0 10px;
  }
  .rules-panel button {
    position: absolute;
    top: 3px;
    right: 3px;
    background: transparent;
    color: #e9dfc0;
    padding: 6px;
    font-size: 18px;
  }
  :focus-visible {
    outline: 3px solid #efcc73;
    outline-offset: 3px;
  }
  @media (min-height: 900px) {
    .uno-table {
      --card-w: 104px;
      --card-h: 152px;
    }
    .hand-area {
      bottom: 64px;
    }
    .center-table {
      top: 43%;
    }
    .hand .card > strong {
      font-size: 46px;
    }
  }
  @media (max-width: 700px) {
    .uno-table {
      --card-w: 70px;
      --card-h: 104px;
    }
    .table-surface {
      inset: 18% 7% 24%;
      border-width: 9px;
      border-radius: 45% / 35%;
    }
    .table-stitch {
      inset: 6px;
    }
    .seat {
      width: 86px;
    }
    .portrait {
      width: 36px;
      height: 36px;
      font-size: 17px;
    }
    .chair {
      width: 60px;
      height: 69px;
      border-width: 4px;
      top: -10px;
    }
    .seat-label {
      padding: 4px 6px;
      max-width: 82px;
    }
    .seat-label b {
      font-size: 10px;
      max-width: 70px;
    }
    .seat-label span {
      font-size: 8px;
    }
    .seat-cards {
      transform: scale(0.75);
      margin-top: -1px;
    }
    .center-table {
      width: 230px;
      top: 41%;
    }
    .piles {
      gap: 23px;
    }
    .status {
      margin-bottom: 12px;
    }
    .turn-label {
      font-size: 10px;
    }
    .card > strong {
      font-size: 32px;
    }
    .corner {
      font-size: 12px;
    }
    .card {
      border-width: 4px;
      border-radius: 8px;
    }
    .card::before {
      inset: 14px 3px;
      border-width: 2px;
    }
    .back-emblem {
      font-size: 20px;
    }
    .pile-group > small {
      font-size: 8px;
    }
    .hand-area {
      width: 94vw;
      bottom: 40px;
    }
    .hand-heading {
      padding: 0 10px;
    }
    .hand .card {
      margin-right: -22px;
    }
    .hand-scroll {
      padding-top: 16px;
    }
    .declare {
      font-size: 8px;
      padding: 6px;
      max-width: 180px;
    }
    .table-brand {
      font-size: 35px;
    }
    .table-brand span {
      font-size: 7px;
    }
    .color-choice {
      width: 245px;
      top: calc(100% + 5px);
    }
    .color-choice button {
      font-size: 9px;
      padding: 7px 3px;
    }
    .table-tools {
      gap: 8px;
      top: 50px;
    }
    .table-tools button {
      font-size: 11px;
      padding: 8px;
    }
  }
  @media (max-height: 620px) {
    .uno-table {
      --card-w: 62px;
      --card-h: 90px;
    }
    .table-surface {
      inset: 17% 15% 17%;
    }
    .seating {
      inset: 46px 0 15px;
    }
    .seat-cards {
      display: none;
    }
    .portrait {
      width: 32px;
      height: 32px;
      font-size: 15px;
    }
    .chair {
      width: 58px;
      height: 62px;
    }
    .seat-label {
      margin-top: 3px;
    }
    .center-table {
      top: 43%;
    }
    .status {
      margin-bottom: 7px;
      min-height: 30px;
    }
    .turn-label {
      font-size: 10px;
    }
    .piles {
      gap: 25px;
    }
    .card > strong {
      font-size: 30px;
    }
    .hand-area {
      bottom: 28px;
      width: 65vw;
    }
    .hand-heading h3 {
      font-size: 9px;
    }
    .hand-scroll {
      padding-top: 12px;
      padding-bottom: 4px;
    }
    .declare {
      padding: 4px 7px;
      min-height: 26px;
    }
    .table-tools {
      bottom: 2px;
    }
    .color-choice {
      left: calc(100% + 15px);
      top: 30%;
      transform: none;
      width: 160px;
    }
    .color-choice > div {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .seat.local {
      display: none;
    }
  }
</style>
