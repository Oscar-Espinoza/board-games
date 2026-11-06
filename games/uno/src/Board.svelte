<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import {
    modal,
    ViewerSkin,
    viewerPreferences,
    type BoardProps,
  } from '@board-games/shared/ui';
  import type { Skin } from '@board-games/shared/ui/pixel';
  import { games } from '@board-games/shared/games';
  import { m } from '@board-games/shared/messages';
  import type { Action } from './index.js';
  import { cardSymbols, colors, type Card } from './cards.js';
  import {
    bigDraws,
    consecutive,
    gained,
    unoCalls,
    type UnoView,
  } from './presentation.js';
  import { cardMotion } from './motion.js';
  import { cardAudio } from './sound.js';
  import type { Cue } from './pixel/sound.js';

  let {
    view,
    playerId,
    players,
    send,
    locale,
    round = 0,
    connected = true,
    pending = false,
    canRematch = false,
    rematch,
    settingsContent,
  }: BoardProps<UnoView, Action> = $props();

  /** Opponent cards drawn as a fan beside each seat. */
  const MINI_FAN = 7;
  /** Takes the card cue and table effect when a card lands on the discard pile. */
  const landing: Partial<Record<string, { cue: Cue; kind: string }>> = {
    skip: { cue: 'skip', kind: 'skip' },
    reverse: { cue: 'reverse', kind: 'reverse' },
    '+2': { cue: 'hit2', kind: 'hit' },
    '+4': { cue: 'hit4', kind: 'hit' },
  };
  let root: HTMLElement;
  const preferences = viewerPreferences('uno', {
    sound: true as boolean,
    motion: null as boolean | null,
  });
  let declared = $state(false),
    settingsOpen = $state(false),
    called = $state<Record<string, boolean>>({}),
    pops = $state<{ key: number; id: string; count: number }[]>([]),
    burst = $state<{ key: number; id: string } | null>(null),
    chiptune = $state<(cue: Cue) => void>(),
    fx = $state<{ key: number; kind: string } | null>(null),
    dismissed = $state(-1);
  const audio = cardAudio(() => preferences.sound);
  // The 8-bit skin is per viewer; its CSS and chiptune pack load only when chosen.
  const skin = new ViewerSkin('uno', () =>
    Promise.all([import('./pixel.css'), import('./pixel/sound.js')]).then(
      ([, sound]) => (chiptune = sound.chiptune(audio.audio)),
    ),
  );
  const pixel = $derived(skin.pixel);
  const motionEnabled = $derived(
    preferences.motion ?? !prefersReducedMotion.current,
  );
  let motion = $state<ReturnType<typeof cardMotion>>();
  const palette = {
    red: '#e2332d',
    yellow: '#f5bd1d',
    green: '#2fa04c',
    blue: '#1f6fcf',
  };
  let pub = $derived(view.public),
    hand = $derived(view.private.hand),
    legal = $derived(view.private.legalActions);
  let ownIndex = $derived(pub.players.findIndex((p) => p.id === playerId));
  let opponents = $derived([
    ...pub.players.slice(ownIndex + 1),
    ...pub.players.slice(0, ownIndex),
  ]);
  let myTurn = $derived(pub.turn === playerId && pub.phase === 'turn');
  let step = $derived(
    hand.length > 1 ? Math.min(5, 36 / (hand.length - 1)) : 0,
  );
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
  /** Opponent seat centre in % of the table: an arc across the top rim, wrapping down the sides on big tables. */
  function seatPosition(index: number, count: number): [number, number] {
    if (count < 3) return [50, 11];
    const spread = count >= 5 ? Math.PI * 0.14 : 0;
    const angle =
      Math.PI - spread + ((index - 1) / (count - 2)) * (Math.PI + spread * 2);
    return [50 + 41 * Math.cos(angle), 52 + 41 * Math.sin(angle)];
  }
  /** The 8-bit sheet has one portrait per possible seat. */
  const avatar = (id: string) =>
    Math.max(
      0,
      pub.players.findIndex((p) => p.id === id),
    ) % games.uno.maxPlayers;
  const glyph = (card: Card) => cardSymbols.indexOf(card.symbol);
  const tint = (card: Card) =>
    card.color ? colors.indexOf(card.color) : colors.length;
  function cue(sound: Cue) {
    if (pixel && preferences.sound && !document.hidden) chiptune?.(sound);
  }
  /** 8-bit juice for one accepted revision: a chiptune cue and a table effect. */
  function react(before: UnoView, next: UnoView) {
    const b = before.public,
      n = next.public;
    if (!consecutive(before, next)) return;
    let kind = '';
    if (n.top.id !== b.top.id) {
      const hit = landing[n.top.symbol];
      kind = hit?.kind ?? '';
      cue(hit?.cue ?? 'play');
    } else if (b.phase === 'color' && n.phase !== 'color') {
      kind = 'wild';
      cue('wild');
    } else if (n.players.some((seat) => gained(before, seat) > 0)) cue('draw');
    if (n.phase === 'finished' && b.phase !== 'finished')
      later(() => cue(n.winner === playerId ? 'win' : 'lose'), 350);
    else if (n.turn === playerId && n.phase === 'turn' && b.turn !== playerId)
      later(() => cue('turn'), 260);
    if (kind && motionEnabled) {
      const key = Math.random();
      fx = { key, kind };
      later(() => {
        if (fx?.key === key) fx = null;
      }, 1000);
    }
  }
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
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }
  function act(action: Action) {
    audio.unlock();
    send(action);
  }
  function play(cardId: number) {
    act({ type: 'PLAY_CARD', cardId, uno: declared && hand.length === 2 });
    declared = false;
  }
  function toggleSound() {
    preferences.sound = !preferences.sound;
    if (preferences.sound) audio.unlock();
    else audio.audio.stop();
  }
  function toggleMotion() {
    preferences.motion = !motionEnabled;
    if (!preferences.motion) motion?.clear();
  }
  let previousRound = -1,
    lastView: UnoView | undefined;
  $effect.pre(() => {
    const next = view,
      enabled = motionEnabled,
      online = connected,
      controller = motion,
      currentRound = round;
    if (currentRound !== previousRound) {
      previousRound = currentRound;
      called = {};
      lastView = undefined;
      controller?.reset();
    }
    if (!controller) return;
    const animate = untrack(() => controller.prepare(next, enabled, online));
    void tick().then(animate);
  });
  // UNO calls and penalty draws, read from consecutive public revisions only.
  $effect(() => {
    const next = view;
    untrack(() => {
      const before = lastView;
      lastView = next;
      for (const seat of next.public.players)
        if (seat.count !== 1 && called[seat.id]) delete called[seat.id];
      if (!before) return;
      const fresh = !document.hidden;
      if (pixel && fresh) react(before, next);
      for (const id of unoCalls(before, next)) {
        called[id] = true;
        if (fresh) {
          if (pixel) cue('uno');
          else audio.call();
        }
        if (fresh && motionEnabled) {
          const key = Date.now();
          burst = { key, id };
          later(() => {
            if (burst?.key === key) burst = null;
          }, 1400);
        }
      }
      for (const draw of bigDraws(before, next)) {
        const key = Math.random();
        pops.push({ key, ...draw });
        later(() => (pops = pops.filter((p) => p.key !== key)), 1700);
      }
    });
  });
  $effect(() => {
    if (hand.length !== 2 || !myTurn) declared = false;
  });
  onMount(() => {
    motion = cardMotion(
      root,
      playerId,
      () => {
        if (!pixel) audio.play();
      },
      () => pixel,
    );
    return () => {
      motion?.reset();
      audio.dispose();
      for (const id of timers) clearTimeout(id);
    };
  });
</script>

<svelte:window
  onpointerdowncapture={() => audio.unlock()}
  onkeydowncapture={() => audio.unlock()}
  onresize={() => motion?.clear()}
/>
<svelte:document onvisibilitychange={() => motion?.reset()} />

{#snippet cardFace(card: Card)}
  {#if pixel}{@render pixelFace(card)}{:else}{@render classicFace(card)}{/if}
{/snippet}

{#snippet pixelFace(card: Card)}
  <span class="px-art" style:--face={tint(card)}></span>
  {#if card.symbol !== 'wild'}<span
      class="px-glyph"
      style:--gx={glyph(card)}
      style:--gy={tint(card)}
    ></span>{/if}
  <span class="px-corner" style:--gx={glyph(card)}></span>
  <span class="px-corner bottom" style:--gx={glyph(card)}></span>
{/snippet}

{#snippet classicFace(card: Card)}
  <span class="corner">{symbol(card)}</span>
  {#if !card.color}
    <svg class="wild-art" viewBox="0 0 80 100" aria-hidden="true">
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
          stroke="#fff"
          stroke-width="3"
        />
      </g>
    </svg>
    {#if card.symbol === '+4'}<strong class="wild-plus">+4</strong>{/if}
  {:else}<strong>{symbol(card)}</strong>{/if}
  <span class="corner bottom">{symbol(card)}</span>
{/snippet}

{#snippet rematchButton()}
  {#if canRematch}<button class="rematch" onclick={() => rematch?.()}
      >{m.rematch({}, { locale })}</button
    >{/if}
{/snippet}

{#snippet bubbles(id: string)}
  {#if called[id]}<span class="bubble uno">UNO!</span>{/if}
  {#each pops.filter((p) => p.id === id) as pop (pop.key)}<span
      class="bubble draw">+{pop.count}</span
    >{/each}
{/snippet}

<section
  bind:this={root}
  class="uno-table"
  class:px-tokens={pixel}
  class:uno-pixel={pixel}
  aria-label="UNO"
  data-round={round}
  data-revision={pub.revision}
  data-sound={preferences.sound}
  data-motion={motionEnabled}
>
  <nav class="tools" aria-label={m.uno_settings({}, { locale })}>
    <button
      aria-pressed={preferences.sound}
      aria-label={m.uno_sound({}, { locale })}
      title={m.uno_sound({}, { locale })}
      onclick={toggleSound}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path
          d="M4 9h4l5-4v14l-5-4H4z"
          class="fill"
        />{#if preferences.sound}<path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          />{:else}<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />{/if}</svg
      ></button
    ><button
      aria-pressed={motionEnabled}
      aria-label={m.uno_motion({}, { locale })}
      title={m.uno_motion({}, { locale })}
      onclick={toggleMotion}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><rect
          x="10"
          y="4"
          width="10"
          height="15"
          rx="2"
          transform="rotate(14 15 11.5)"
        /><path d="M2.5 9h4.5M1.5 13h5M3.5 17h3" />{#if !motionEnabled}<path
            d="M3 3l18 18"
          />{/if}</svg
      ></button
    ><button
      aria-label={m.uno_settings({}, { locale })}
      title={m.uno_settings({}, { locale })}
      onclick={() => (settingsOpen = true)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><circle cx="12" cy="12" r="3" /><path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        /></svg
      ></button
    >
  </nav>
  <div class="seating">
    {#each opponents as seat, index (seat.id)}
      {@const position = seatPosition(index + 1, pub.players.length)}
      {@const member = players.find((p) => p.id === seat.id)}
      <div
        class="seat"
        class:active={pub.turn === seat.id && pub.phase !== 'finished'}
        class:offline={member?.connected === false}
        style={`--seat-x:${position[0]}%;--seat-y:${position[1]}%`}
        data-seat={seat.id}
      >
        <div class="plate">
          <div class="portrait" aria-hidden="true">
            {#if pixel}<span class="px-avatar" style:--av={avatar(seat.id)}
              ></span>{:else}{name(seat.id).slice(0, 1).toUpperCase()}{/if}
          </div>
          <b>{name(seat.id)}</b>
          {#if member?.bot || member?.connected === false}<span
              >{member?.connected === false
                ? m.reserved({}, { locale })
                : m.uno_bot({}, { locale })}</span
            >{/if}
        </div>
        <div class="seat-cards" aria-hidden="true">
          {#each Array(Math.min(seat.count, MINI_FAN)) as _, i}<span
              class="mini-back"
              style={`--fan:${i - (Math.min(seat.count, MINI_FAN) - 1) / 2}`}
            ></span>{/each}
          {#if pixel}<span class="px-count">{seat.count}</span>{/if}
        </div>
        {@render bubbles(seat.id)}
      </div>
    {/each}
  </div>
  <div class="center-table" class:px-shake={fx?.kind === 'hit'}>
    <svg
      class="flow"
      class:counter={pub.direction === -1}
      viewBox="0 0 400 300"
      aria-hidden="true"
    >
      <defs
        ><marker
          id="uno-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="3"
          markerHeight="3"
          orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" /></marker
        ></defs
      >
      <path d="M96 30Q150 2 214 8" marker-end="url(#uno-arrow)" />
      <path d="M150 300Q100 296 76 262" marker-end="url(#uno-arrow)" />
      <path d="M252 300Q300 296 326 262" marker-end="url(#uno-arrow)" />
    </svg>
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
          <span class="card card-back"><span class="back-oval"></span></span>
          {#if pub.penalty}<span class="penalty">+{pub.penalty.amount}</span
            >{/if}
        </button>
        <small>{m.uno_draw({}, { locale })}</small>
      </div>
      <div class="pile-group">
        <div class="discard-stack">
          {#key pub.top.id}<div
              class="card discard"
              class:wild-card={!pub.top.color}
              style:--card-color={pub.top.color
                ? palette[pub.top.color]
                : '#17171b'}
              aria-label={label(pub.top)}
            >
              {@render cardFace(pub.top)}
            </div>{/key}
        </div>
        <small>{m.uno_discard_pile({}, { locale })}</small>
        <span class="color-pill" style:--active-color={palette[pub.activeColor]}
          >{#if pixel}<span
              class="px-gem"
              style:--gem={colors.indexOf(pub.activeColor)}
            ></span>{/if}{t[pub.activeColor]}</span
        >
      </div>
    </div>
    <p class="flow-label">
      {m.uno_play_continues({}, { locale })}<br />{pub.direction === 1
        ? m.uno_clockwise({}, { locale })
        : m.uno_counter({}, { locale })}
    </p>
    {#if pub.phase === 'color' && pub.turn === playerId}<div
        class="color-choice"
      >
        <p>{m.uno_choose({}, { locale })}</p>
        <div>
          {#each colors as color, i}<button
              style:--swatch={palette[color]}
              aria-label={t[color]}
              title={t[color]}
              disabled={pending || !connected}
              onclick={() => act({ type: 'CHOOSE_COLOR', color })}
              >{#if pixel}<span class="px-gem" style:--gem={i}
                ></span>{/if}</button
            >{/each}
        </div>
      </div>{/if}
    {#each legal as action}{#if action.type === 'CATCH_UNO'}<button
          class="catch"
          disabled={pending || !connected}
          onclick={() => act(action)}
          >{m.uno_catch({}, { locale })}: {name(action.player)}</button
        >{/if}{/each}
    {#if fx}{#key fx.key}<div
          class="px-fx {fx.kind}"
          style:--gx={glyph(pub.top)}
          style:--ring={palette[pub.activeColor]}
          aria-hidden="true"
        >
          <span class="px-fx-ring"></span>{#if fx.kind !== 'wild'}<span
              class="px-fx-glyph"
            ></span>{/if}
        </div>{/key}{/if}
  </div>
  {#if burst}{#key burst.key}<div class="burst" aria-hidden="true">
        {#if pixel}<span class="px-burst-art"
          ></span>{#each Array(8) as _, i}<span class="px-spark" style:--i={i}
            ></span>{/each}{/if}<span class="burst-word">UNO!</span><small
          >{name(burst.id)}</small
        >
      </div>{/key}{/if}
  {#if pixel && pub.phase === 'finished' && dismissed !== round}
    {@const won = pub.winner === playerId}
    <div class="px-result" class:won aria-live="polite">
      {#if won && motionEnabled}{#each Array(24) as _, i}<span
            class="px-confetti"
            style:--i={i}
          ></span>{/each}{/if}
      <div class="px-result-card">
        <div class="px-result-art" aria-hidden="true">
          <span class="px-fx-sprite" style:--fx={won ? 1 : 2}></span>
          {#if pub.winner}<span class="px-result-winner"
              ><span class="px-fx-sprite crown" style:--fx={7}></span><span
                class="px-avatar"
                style:--av={avatar(pub.winner)}
              ></span></span
            >{/if}
        </div>
        <h2>
          {won
            ? m.uno_you_win({}, { locale })
            : pub.winner
              ? m.uno_game_over({}, { locale })
              : m.uno_tie({}, { locale })}
        </h2>
        {#if pub.winner && !won}<p>
            {name(pub.winner)}
            {m.uno_won({}, { locale })}
          </p>{/if}
        <div class="px-result-actions">
          {@render rematchButton()}<button onclick={() => (dismissed = round)}
            >{m.uno_view_table({}, { locale })}</button
          >
        </div>
      </div>
    </div>
  {/if}
  <div class="hand-area" class:mine={myTurn}>
    <div class="turn-row" aria-live="polite">
      {#if pub.phase === 'finished'}<p class="turn-pill done">
          {pub.winner
            ? `${name(pub.winner)} ${m.uno_won({}, { locale })}`
            : m.uno_tie({}, { locale })}
        </p>
        {@render rematchButton()}
      {:else}<p class="turn-pill" class:mine={pub.turn === playerId}>
          {pub.turn === playerId
            ? m.uno_turn({}, { locale })
            : m.uno_turn_of({ name: name(pub.turn) }, { locale })}
        </p>{/if}
      <span class="self-bubbles">{@render bubbles(playerId)}</span>
    </div>
    <div class="hand" style={`--count:${hand.length}`}>
      {#each hand as card, i (card.id)}
        {@const angle = (i - (hand.length - 1) / 2) * step}
        <button
          class="card"
          class:wild-card={!card.color}
          class:playable={playable(card.id)}
          class:dim={myTurn && !playable(card.id)}
          data-card={card.id}
          style:--card-color={card.color ? palette[card.color] : '#17171b'}
          style:--rot={`${angle}deg`}
          style:--a2={((angle * Math.PI) / 180) ** 2}
          disabled={!playable(card.id) || pending || !connected}
          onclick={() => play(card.id)}
          aria-label={label(card)}
          title={label(card)}>{@render cardFace(card)}</button
        >
      {/each}
    </div>
  </div>
  <button
    class="declare"
    class:armed={declared}
    aria-pressed={declared}
    aria-label={declared
      ? m.uno_armed({}, { locale })
      : m.uno_declare({}, { locale })}
    title={m.uno_declared_hint({}, { locale })}
    disabled={hand.length !== 2 || !myTurn || pending || !connected}
    onclick={() => {
      audio.unlock();
      declared = !declared;
    }}>UNO!</button
  >
  <dialog
    class="settings"
    class:px-tokens={pixel}
    class:uno-pixel={pixel}
    aria-label={m.uno_settings({}, { locale })}
    {@attach modal(() => settingsOpen)}
    onclose={() => (settingsOpen = false)}
    onclick={(e) => {
      if (e.target === e.currentTarget) settingsOpen = false;
    }}
  >
    <header>
      <h2>{m.uno_settings({}, { locale })}</h2>
      <button
        class="close"
        aria-label={m.uno_close({}, { locale })}
        onclick={() => (settingsOpen = false)}>×</button
      >
    </header>
    <div class="settings-body">
      <fieldset class="skin-choice">
        <legend>{m.skin({}, { locale })}</legend>
        {#each [['classic', m.skin_classic({}, { locale })], ['pixel', m.skin_pixel({}, { locale })]] as [value, text]}<label
            ><input
              type="radio"
              name="uno-skin"
              {value}
              checked={skin.choice === value}
              onchange={() => {
                skin.choose(value as Skin);
                motion?.clear();
              }}
            />{text}</label
          >{/each}
      </fieldset>
      {@render settingsContent?.()}
    </div>
  </dialog>
</section>

<style>
  @font-face {
    font-family: 'Nunito';
    font-style: normal;
    font-weight: 700 900;
    font-display: swap;
    src: url('/fonts/nunito/nunito-latin.woff2') format('woff2');
  }
  .uno-table {
    --card-h: min(19vh, 12.5vw);
    --card-w: calc(var(--card-h) * 0.69);
    --hand-h: min(27vh, 17vw);
    --hand-w: calc(var(--hand-h) * 0.69);
    --portrait: clamp(52px, 9.4vh, 92px);
    --ink: #1b1512;
    position: absolute;
    inset: 0;
    isolation: isolate;
    overflow: hidden;
    color: #fff;
    background: #1d120a url('/games/uno/table-wide.webp') center / cover
      no-repeat;
    font-family: 'Nunito', ui-rounded, system-ui, sans-serif;
    font-weight: 800;
  }
  .uno-table::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 0;
    background: radial-gradient(
      ellipse 75% 70% at 50% 45%,
      #0000 55%,
      #0a050280 100%
    );
    pointer-events: none;
  }
  .tools {
    position: absolute;
    z-index: 6;
    top: max(20px, env(safe-area-inset-top));
    right: 24px;
    display: flex;
    gap: 14px;
  }
  .tools button {
    width: 56px;
    height: 56px;
    padding: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid #ffffff26;
    background: #161009d0;
    backdrop-filter: blur(6px);
    color: #fff;
    box-shadow: 0 6px 16px #0008;
  }
  .tools button:hover {
    background: #2b1f15;
    transform: none;
  }
  .tools button[aria-pressed='false'] {
    color: #a39585;
  }
  .tools svg {
    width: 26px;
    height: 26px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tools svg .fill {
    fill: currentColor;
  }
  .seating {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .seat {
    position: absolute;
    left: clamp(80px, var(--seat-x), calc(100% - 80px));
    top: var(--seat-y);
    /* Anchor on the portrait centre so seats sit on the painted rim. */
    transform: translate(-50%, calc(var(--portrait) * -0.5));
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 170px;
    z-index: 1;
    text-align: center;
  }
  .plate {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: calc(var(--portrait) * 0.55);
    padding: 0 22px 10px;
    min-width: 128px;
    max-width: 168px;
    border-radius: 18px;
    background: #1a120cc4;
    backdrop-filter: blur(6px);
    border: 1px solid #ffffff1a;
    box-shadow: 0 10px 22px #0007;
  }
  .portrait {
    width: var(--portrait);
    height: var(--portrait);
    margin-top: calc(var(--portrait) * -0.55);
    margin-bottom: 4px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: Georgia, serif;
    font-size: calc(var(--portrait) * 0.42);
    font-weight: 600;
    background: radial-gradient(circle at 40% 35%, #fbf1dc, #dcc79f);
    color: #3f2f22;
    border: 5px solid #2f9b86;
    box-shadow:
      0 0 0 3px #1a120c,
      0 6px 16px #0009;
  }
  .seat.active .portrait {
    border-color: #5fe483;
    animation: turn-glow 1.6s ease-in-out infinite;
  }
  .seat.offline {
    opacity: 0.5;
  }
  .plate b {
    display: block;
    max-width: 140px;
    font-size: 19px;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px #000;
  }
  .plate span {
    font-size: 14px;
    font-weight: 700;
    color: #e3d6c4;
  }
  .seat-cards {
    position: relative;
    width: 120px;
    height: 58px;
    margin-top: 6px;
  }
  .mini-back {
    position: absolute;
    width: 32px;
    height: 47px;
    left: calc(44px + var(--fan) * 11px);
    top: calc(var(--fan) * var(--fan) * 1px);
    transform: rotate(calc(var(--fan) * 9deg));
    border: 2px solid #fff;
    border-radius: 5px;
    background: #121214;
    box-shadow:
      0 3px 6px #0008,
      inset 0 0 0 1px #0006;
  }
  .mini-back::after,
  .back-oval {
    content: '';
    position: absolute;
    inset: 22% 12%;
    border-radius: 50%;
    background: conic-gradient(
      from 25deg,
      #e2332d 0 25%,
      #1f6fcf 0 50%,
      #f5bd1d 0 75%,
      #2fa04c 0
    );
    transform: rotate(25deg);
  }
  .bubble {
    position: absolute;
    z-index: 3;
    top: -4px;
    left: calc(50% + var(--portrait) * 0.45);
    padding: 5px 14px;
    border-radius: 18px 18px 18px 5px;
    font-weight: 900;
    font-size: 22px;
    white-space: nowrap;
    box-shadow: 0 5px 12px #0007;
    animation: pop 0.55s cubic-bezier(0.3, 1.6, 0.5, 1) both;
  }
  .bubble.uno {
    background: #1d7a44;
    border: 3px solid #8ff0a6;
    color: #fff;
    transform: rotate(-6deg);
  }
  .bubble.draw {
    top: -24px;
    background: #e02f3c;
    border: 3px solid #fff;
    color: #fff;
    font-size: 30px;
    animation:
      pop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both,
      fade 0.4s 1.3s both;
  }
  .bubble.uno + .bubble.draw {
    left: calc(50% + var(--portrait) * 0.45 + 90px);
  }
  .center-table {
    position: absolute;
    left: 50%;
    top: 44.5%;
    transform: translate(-50%, -50%);
    width: calc(var(--card-w) * 4.6);
    text-align: center;
    z-index: 2;
  }
  .flow {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 96%;
    overflow: visible;
    transform: translate(-50%, -50%);
    fill: none;
    stroke: #f6e8d38c;
    stroke-width: 9;
    stroke-linecap: round;
    pointer-events: none;
  }
  .flow marker path {
    fill: #f6e8d38c;
    stroke: none;
  }
  .flow.counter {
    transform: translate(-50%, -50%) scaleX(-1);
  }
  .piles {
    position: relative;
    display: flex;
    justify-content: center;
    gap: calc(var(--card-w) * 0.75);
    align-items: flex-start;
  }
  .pile-group {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 6px;
  }
  .pile-group > small {
    margin-top: 16px;
    font-size: 20px;
    font-weight: 900;
    color: #fff;
    text-shadow: 0 2px 4px #000a;
  }
  .color-pill {
    padding: 1px 18px;
    border-radius: 20px;
    border: 3px solid #fff;
    background: var(--active-color);
    font-size: 17px;
    font-weight: 900;
    text-shadow: 0 1px 2px #0008;
    box-shadow: 0 4px 12px #0007;
  }
  .flow-label {
    margin: 18px 0 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.3;
    color: #f6e8d3d9;
    text-shadow: 0 1px 3px #0009;
  }
  .card {
    position: relative;
    isolation: isolate;
    width: var(--card-w);
    height: var(--card-h);
    flex-shrink: 0;
    padding: 0;
    border: calc(var(--card-w) * 0.065) solid #fff;
    border-radius: calc(var(--card-w) * 0.11);
    color: #fff;
    background: var(--card-color);
    box-shadow:
      inset 0 0 0 1px #0003,
      0 6px 14px #0007;
    overflow: hidden;
    font-family: inherit;
    transition:
      transform 0.16s ease,
      filter 0.16s,
      box-shadow 0.16s;
    cursor: default;
  }
  .card::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 15% 3%;
    border-radius: 50%;
    background: #fff;
    transform: rotate(28deg);
  }
  .card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      #ffffff59 0%,
      #ffffff14 30%,
      #0000 50%,
      #0000001f 100%
    );
    pointer-events: none;
  }
  .wild-card::before {
    display: none;
  }
  .card > strong {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: calc(var(--card-w) * 0.56);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: var(--card-color);
    -webkit-text-stroke: calc(var(--card-w) * 0.03) var(--ink);
    paint-order: stroke fill;
    text-shadow:
      1px 1px 0 var(--ink),
      2px 2px 0 var(--ink),
      3px 3px 0 var(--ink),
      4px 4px 0 var(--ink);
  }
  .card > strong.wild-plus {
    color: #fff;
    font-size: calc(var(--card-w) * 0.32);
  }
  .wild-art {
    position: absolute;
    inset: 8% 6%;
    width: 88%;
    height: 84%;
  }
  .corner {
    position: absolute;
    top: 3%;
    left: 7%;
    font-size: calc(var(--card-w) * 0.22);
    font-weight: 900;
    line-height: 1;
    -webkit-text-stroke: 1px var(--ink);
    paint-order: stroke fill;
    text-shadow: 1px 2px 0 var(--ink);
  }
  .bottom {
    top: auto;
    left: auto;
    right: 7%;
    bottom: 3%;
    transform: rotate(180deg);
  }
  .card-back {
    display: block;
    background: #121214;
  }
  .card-back::before {
    display: none;
  }
  .back-oval {
    inset: 14% 3%;
    border: calc(var(--card-w) * 0.035) solid #fff;
  }
  .stock {
    display: block;
    position: relative;
    border: 0;
    padding: 0;
    background: transparent;
    border-radius: calc(var(--card-w) * 0.11);
    box-shadow:
      2px 3px 0 #e9e6df,
      3px 5px 0 #26262a,
      4px 7px 0 #e9e6df,
      5px 9px 0 #26262a,
      6px 11px 0 #e9e6df,
      7px 13px 0 #26262a,
      8px 15px 0 #e9e6df,
      9px 17px 0 #1c1c20,
      10px 30px 30px #000a;
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
  .stock:enabled .card {
    box-shadow:
      0 0 0 4px #6bf08daa,
      0 0 22px #6bf08d88;
  }
  .penalty {
    position: absolute;
    right: -18px;
    top: -16px;
    padding: 3px 12px;
    border-radius: 16px;
    border: 3px solid #fff;
    background: #e02f3c;
    color: #fff;
    font-size: 22px;
    font-weight: 900;
    box-shadow: 0 4px 10px #0007;
  }
  .discard-stack {
    position: relative;
    border-radius: calc(var(--card-w) * 0.11);
    box-shadow:
      -2px 3px 0 #e9e6df,
      -3px 6px 0 #d8d4cc,
      -4px 9px 0 #e9e6df,
      -5px 12px 0 #cfcac1,
      -4px 26px 30px #000a;
  }
  .discard-stack::before,
  .discard-stack::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: #f4f1ea;
    box-shadow: 0 3px 8px #0005;
    transform: rotate(-7deg) translate(-5px, 4px);
  }
  .discard-stack::after {
    background: #e2332d;
    border: calc(var(--card-w) * 0.065) solid #fff;
    transform: rotate(3deg) translate(4px, 6px);
  }
  .discard {
    z-index: 1;
    transform: rotate(5deg);
  }
  .color-choice {
    position: absolute;
    z-index: 4;
    top: calc(100% - 50px);
    left: 50%;
    transform: translateX(-50%);
    padding: 14px 18px;
    border-radius: 20px;
    background: #1a120cf2;
    border: 1px solid #ffffff26;
    box-shadow: 0 14px 34px #0009;
  }
  .color-choice p {
    margin: 0 0 12px;
    font-size: 16px;
    white-space: nowrap;
  }
  .color-choice > div {
    display: flex;
    justify-content: center;
    gap: 14px;
  }
  .color-choice button {
    width: 56px;
    height: 56px;
    padding: 0;
    border-radius: 50%;
    border: 4px solid #fff;
    background: var(--swatch);
    box-shadow: 0 5px 12px #0008;
  }
  .color-choice button:hover:enabled {
    background: var(--swatch);
    transform: scale(1.1);
  }
  .catch {
    position: absolute;
    z-index: 4;
    top: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    white-space: nowrap;
    border-radius: 24px;
    border: 3px solid #fff;
    background: #e07b24;
    color: #fff;
    font-weight: 900;
    font-size: 17px;
    box-shadow: 0 5px 14px #0008;
  }
  .burst {
    position: absolute;
    z-index: 20;
    left: 50%;
    top: 42%;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: clamp(72px, 13vw, 170px);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #f5bd1d;
    -webkit-text-stroke: 6px #b3171d;
    paint-order: stroke fill;
    text-shadow:
      0 7px 0 #6d0d10,
      0 18px 44px #000b;
    pointer-events: none;
    animation: burst 1.4s cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  .burst small {
    font-size: 24px;
    letter-spacing: 0;
    color: #fff;
    -webkit-text-stroke: 0;
    text-shadow: 0 2px 6px #000;
  }
  .hand-area {
    position: absolute;
    left: 50%;
    bottom: calc(var(--hand-h) * -0.05);
    transform: translateX(-50%);
    width: min(1000px, calc(100vw - 360px));
    container-type: inline-size;
    z-index: 3;
  }
  .turn-row {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .turn-pill {
    margin: 0;
    padding: 6px 30px 8px;
    border-radius: 28px;
    font-size: 24px;
    font-weight: 900;
    background: #1a120cd9;
    border: 3px solid #ffffff2e;
    color: #fff;
    box-shadow: 0 6px 16px #0007;
  }
  .turn-pill.mine {
    position: relative;
    background: linear-gradient(#7af59c, #2fc15f 60%, #26a650);
    border-color: #d8ffe2;
    color: #0c3a1b;
    box-shadow:
      inset 0 2px 0 #ffffff80,
      0 0 26px #4fe07a99,
      0 6px 16px #0007;
  }
  .turn-pill.mine::before,
  .turn-pill.mine::after {
    content: '';
    position: absolute;
    top: 50%;
    width: 26px;
    height: 44px;
    translate: 0 -60%;
    background:
      linear-gradient(#f7d43c, #f7d43c) 100% 0 / 4px 12px no-repeat,
      linear-gradient(#f7d43c, #f7d43c) 0 60% / 14px 4px no-repeat;
    rotate: -20deg;
  }
  .turn-pill.mine::before {
    right: calc(100% + 10px);
  }
  .turn-pill.mine::after {
    left: calc(100% + 10px);
    transform: scaleX(-1);
    rotate: 20deg;
  }
  .turn-pill.done {
    background: #f5bd1d;
    color: #3a2505;
    border-color: #fff3c4;
  }
  .rematch {
    border-radius: 24px;
    padding: 10px 22px;
    border: 3px solid #fff;
    font-weight: 900;
    font-size: 18px;
    background: #2fa04c;
    color: #fff;
  }
  .self-bubbles {
    position: absolute;
    left: calc(50% + 130px);
    top: -10px;
  }
  .self-bubbles .bubble {
    left: 0;
  }
  .self-bubbles .bubble.uno + .bubble.draw {
    left: 90px;
  }
  .hand {
    display: flex;
    justify-content: center;
    padding: 22px 0 0;
  }
  .hand .card {
    --step: min(
      calc(var(--hand-w) * 0.5),
      calc((100cqw - var(--hand-w)) / max(var(--count) - 1, 1))
    );
    --lift: calc(var(--a2) * var(--hand-h) * 1.8);
    width: var(--hand-w);
    height: var(--hand-h);
    margin-right: calc(var(--step) - var(--hand-w));
    transform-origin: 50% 120%;
    transform: translateY(var(--lift)) rotate(var(--rot));
    box-shadow:
      inset 0 0 0 1px #0003,
      -6px 4px 14px #0008;
  }
  .hand .card > strong {
    font-size: calc(var(--hand-w) * 0.56);
    -webkit-text-stroke: calc(var(--hand-w) * 0.03) var(--ink);
  }
  .hand .card .corner {
    font-size: calc(var(--hand-w) * 0.22);
  }
  .hand .card {
    border-width: calc(var(--hand-w) * 0.06);
    border-radius: calc(var(--hand-w) * 0.1);
  }
  .hand .card:last-child {
    margin-right: 0;
  }
  .hand .card:disabled {
    opacity: 1;
    cursor: default;
  }
  .hand .card.dim {
    filter: brightness(0.78) saturate(0.8);
  }
  .hand .card.playable {
    cursor: pointer;
    box-shadow:
      0 0 0 4px #86ffa6,
      0 0 26px #4fe07acc,
      -6px 4px 14px #0008;
  }
  .hand .card:hover:enabled,
  .hand .card:focus-visible {
    background: var(--card-color);
    transform: translateY(calc(var(--lift) - 30px)) rotate(var(--rot));
    z-index: 2;
  }
  .declare {
    position: absolute;
    z-index: 4;
    right: 34px;
    bottom: 30px;
    width: 116px;
    height: 116px;
    padding: 0;
    border-radius: 50%;
    border: 5px solid #fff;
    background: radial-gradient(
      circle at 35% 28%,
      #ff6a5c,
      #d4221f 55%,
      #9c1414
    );
    color: #f7c928;
    font-size: 31px;
    font-weight: 900;
    letter-spacing: -0.03em;
    -webkit-text-stroke: 2px #5a0c0c;
    paint-order: stroke fill;
    text-shadow: 0 3px 0 #5a0c0c;
    box-shadow:
      inset 0 3px 0 #ffffff66,
      0 7px 0 #6d0d10,
      0 14px 28px #0009;
  }
  .declare:hover:enabled {
    transform: translateY(-2px);
  }
  .declare:disabled {
    opacity: 1;
    filter: saturate(0.45) brightness(0.62);
  }
  .declare.armed {
    animation: armed 0.9s ease-in-out infinite;
  }
  .settings {
    width: min(380px, calc(100vw - 32px));
    padding: 20px 22px 24px;
    border: 1px solid #ffffff26;
    border-radius: 22px;
    background: #22180f;
    color: #fff;
    font-family: 'Nunito', ui-rounded, system-ui, sans-serif;
    box-shadow: 0 20px 50px #000a;
  }
  .settings::backdrop {
    background: #0009;
  }
  .settings header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .settings h2 {
    margin: 0;
    font-size: 21px;
    font-weight: 900;
  }
  .settings .close {
    background: transparent;
    color: inherit;
    font-size: 26px;
    padding: 2px 8px;
  }
  .settings-body {
    display: grid;
    gap: 10px;
  }
  .settings-body :global(a),
  .settings-body :global(button),
  .settings-body :global(select) {
    display: block;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid #ffffff2e;
    background: #33251a;
    color: #fff;
    font: inherit;
    font-weight: 800;
    text-align: center;
    text-decoration: none;
  }
  .settings-body :global([role='status']) {
    font-size: 13px;
    color: #d8c9b5;
    text-align: center;
  }
  .skin-choice {
    display: flex;
    gap: 8px;
    margin: 0 0 4px;
    padding: 6px 10px 10px;
    border: 1px solid #ffffff26;
    border-radius: 14px;
  }
  .skin-choice legend {
    padding: 0 6px;
    font-size: 13px;
    color: #d8c9b5;
  }
  .skin-choice label {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border-radius: 10px;
    background: #33251a;
    cursor: pointer;
  }
  .skin-choice label:has(:checked) {
    background: #4a3524;
  }
  .skin-choice input {
    margin: 0;
    accent-color: #f7d43c;
  }
  :focus-visible {
    outline: 3px solid #f7d43c;
    outline-offset: 3px;
  }
  [data-motion='false'] .bubble,
  [data-motion='false'] .seat.active .portrait,
  [data-motion='false'] .declare.armed {
    animation: none;
  }
  @keyframes pop {
    from {
      scale: 0.2;
      rotate: -18deg;
      opacity: 0;
    }
    60% {
      scale: 1.2;
      rotate: 5deg;
      opacity: 1;
    }
  }
  @keyframes fade {
    to {
      opacity: 0;
      translate: 0 -10px;
    }
  }
  @keyframes burst {
    0% {
      transform: translate(-50%, -50%) scale(0.2) rotate(-14deg);
      opacity: 0;
    }
    25% {
      transform: translate(-50%, -50%) scale(1.15) rotate(-6deg);
      opacity: 1;
    }
    75% {
      transform: translate(-50%, -50%) scale(1) rotate(-6deg);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -60%) scale(1.05) rotate(-6deg);
      opacity: 0;
    }
  }
  @keyframes turn-glow {
    50% {
      box-shadow:
        0 0 0 3px #1a120c,
        0 0 26px 6px #6bf08daa;
    }
  }
  @keyframes armed {
    50% {
      transform: scale(1.08);
      box-shadow:
        inset 0 3px 0 #ffffff66,
        0 7px 0 #6d0d10,
        0 0 34px #ffcf3a;
    }
  }
  @media (max-aspect-ratio: 3/4) {
    .uno-table {
      background-image: url('/games/uno/table-tall.webp');
      --card-h: min(17vh, 30vw);
      --hand-h: min(22vh, 40vw);
      --portrait: 50px;
    }
  }
  @media (max-width: 700px) {
    .tools {
      gap: 8px;
      right: 12px;
      top: 12px;
    }
    .tools button {
      width: 42px;
      height: 42px;
    }
    .tools svg {
      width: 21px;
      height: 21px;
    }
    .seat {
      width: 100px;
      left: clamp(52px, var(--seat-x), calc(100% - 52px));
      top: calc(var(--seat-y) * 0.62);
    }
    .plate {
      min-width: 78px;
      max-width: 96px;
      padding: 0 10px 6px;
      border-radius: 14px;
    }
    .portrait {
      border-width: 3px;
    }
    .plate b {
      max-width: 80px;
      font-size: 13px;
    }
    .plate span {
      font-size: 10px;
    }
    .seat-cards {
      transform: scale(0.65);
      margin-top: -8px;
    }
    .bubble {
      font-size: 15px;
      padding: 3px 9px;
      top: calc(var(--portrait) * -0.6);
      left: 50%;
      translate: -50% 0;
    }
    .bubble.uno + .bubble.draw {
      left: 50%;
      top: calc(var(--portrait) * -1.3);
    }
    .bubble.draw {
      font-size: 19px;
    }
    .center-table {
      top: 51%;
    }
    .flow {
      display: none;
    }
    .pile-group > small {
      font-size: 14px;
      margin-top: 10px;
    }
    .color-pill {
      font-size: 13px;
    }
    .flow-label {
      font-size: 12px;
    }
    .hand-area {
      width: calc(100vw - 20px);
      bottom: 118px;
    }
    .turn-pill {
      font-size: 17px;
      padding: 5px 20px;
    }
    .self-bubbles {
      left: calc(50% + 80px);
    }
    .declare {
      right: 50%;
      translate: 50% 0;
      bottom: 16px;
      width: 84px;
      height: 84px;
      font-size: 22px;
    }
  }
  @media (max-height: 620px) {
    .seat-cards {
      display: none;
    }
    .flow,
    .flow-label {
      display: none;
    }
    .pile-group > small {
      margin-top: 14px;
      font-size: 14px;
    }
    .turn-pill {
      font-size: 16px;
      padding: 3px 18px;
    }
    .declare {
      width: 84px;
      height: 84px;
      font-size: 22px;
      bottom: 18px;
    }
    .color-choice {
      top: 0;
      left: calc(100% + 12px);
      transform: none;
    }
  }
</style>
