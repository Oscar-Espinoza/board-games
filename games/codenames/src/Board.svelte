<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import { games } from '@board-games/shared/games';
  import type { View, Team, Identity, PublicEvent, Action } from './types.js';
  import { canChooseRole, canStart } from './setup.js';
  import Icon from './Icon.svelte';
  import './tokens.css';
  import wood from './table/wood.webp';
  import {
    createAudio,
    message,
    eventGate,
    modal,
    viewerPreferences,
    ViewerSkin,
    type BoardProps,
  } from '@board-games/shared/ui';
  import { prefersReducedMotion } from 'svelte/motion';
  import { playCue } from './effects.js';
  let {
    view,
    playerId,
    players,
    send,
    locale,
    round = 0,
    connected = true,
    pending = false,
    settingsContent,
    rulesContent,
    canRematch = false,
    rematch,
    errorCode,
    note = '',
  }: BoardProps<View, Action> & {
    /** Short status line shown with the turn controls (e.g. a bot's last move). */
    note?: string;
  } = $props();
  const s = $derived(view.public),
    mine = $derived(view.private.assignment);
  const teamLabel = (team: Team) => (team === 'red' ? m.cn_red() : m.cn_blue());
  const roleLabel = (role: string) =>
    role === 'spymaster' ? m.cn_spymaster() : m.cn_operative();
  const identityLabel = (identity: Identity) =>
    ({
      red: m.cn_red,
      blue: m.cn_blue,
      civilian: m.cn_civilian,
      assassin: m.cn_assassin,
    })[identity]();
  const roles = ['spymaster', 'operative'] as const;
  const disabled = $derived(!connected || pending);
  const guessing = $derived(
    s.phase === 'guessing' &&
      mine?.role === 'operative' &&
      mine.team === s.activeTeam,
  );
  let selected = $state<number | null>(null),
    localError = $state('');
  type Panel =
    | 'rules'
    | 'settings'
    | 'confirm'
    | 'result'
    | 'about'
    | 'history'
    | 'players'
    | 'key'
    | 'clue';
  let panel = $state<Panel | null>(null);
  const prefs = viewerPreferences('codenames', {
    sound: true,
    volume: 0.5,
    motion: true,
    layout: 'center' as 'left' | 'center' | 'right',
  });
  const still = $derived(prefersReducedMotion.current || !prefs.motion);
  const dialogOpen = $derived(panel !== null);
  const isNarrow = () => window.innerWidth < 1024;
  let mounted = $state(false),
    enlarged = $state(false),
    narrow = $state(isNarrow()),
    clueWord = $state(''),
    clueCount = $state<string>('2');
  const compact = $derived(narrow || enlarged);
  const canClue = $derived(
    s.phase === 'clue' &&
      mine?.role === 'spymaster' &&
      mine.team === s.activeTeam,
  );
  const key = $derived(
    view.private.key ??
      (s.phase === 'finished' ? s.board.map((c) => c.identity!) : undefined),
  );
  const viewer = $derived(players.find((p) => p.id === playerId));
  const labels = $derived({
    rules: m.cn_rules(),
    settings: m.cn_settings(),
    confirm: m.cn_selected(),
    result: m.cn_finished(),
    about: m.cn_nav_about(),
    history: m.cn_clue_history(),
    players: m.cn_players_count({ count: players.length }),
    key: m.cn_spymaster_mode(),
    clue: m.cn_give_clue(),
  });
  const guessesLeft = $derived(
    s.budget.kind === 'finite'
      ? s.budget.cap - s.used === 1
        ? m.cn_guesses_left_one()
        : m.cn_guesses_left({ count: Math.max(0, s.budget.cap - s.used) })
      : m.cn_guesses_unlimited(),
  );
  let root: HTMLElement;
  const gate = eventGate<PublicEvent>(stopEffects),
    audio = createAudio(),
    skin = new ViewerSkin('codenames', () => import('./pixel.css')),
    pixel = $derived(skin.pixel);
  /** Agent card art that covers a revealed word, like the physical game: two looks
   * per team and for bystanders, stable per card, drawn for the current skin. */
  const cardArt = (identity: Identity, index: number) =>
    `/games/codenames/cards/${pixel ? 'pixel' : 'classic'}/${
      identity === 'assassin'
        ? 'assassin'
        : `${identity === 'civilian' ? 'bystander' : identity}-${index % 2 ? 'b' : 'a'}`
    }.webp`;
  const animations = new Set<Animation>();
  function stopEffects() {
    for (const animation of animations) animation.cancel();
    animations.clear();
    audio.stop();
  }
  function settleEffects() {
    gate.reset();
    gate.consume(
      `${round}:${playerId}:${mine?.role ?? ''}`,
      s.actionSequence,
      [],
      connected,
      s,
    );
  }
  function gesture() {
    if (prefs.sound) void audio.unlock();
  }
  function open(next: Panel, source?: HTMLElement) {
    if (source) gesture();
    panel = next;
  }
  function close() {
    panel = null;
    selected = null;
  }
  async function act(action: Action) {
    if (disabled) return;
    gesture();
    if (panel === 'confirm') close();
    selected = null;
    localError = '';
    try {
      await send(action);
      if (panel === 'clue') {
        close();
        clueWord = '';
      }
    } catch (error) {
      localError =
        message((error as Error).message, {}, locale) ?? m.cn_error();
    } finally {
      selected = null;
    }
  }
  function choose(index: number, source: HTMLElement) {
    gesture();
    if (disabled || !guessing) return;
    selected = index;
    open('confirm', source);
  }
  function eventLabel(event: PublicEvent): string {
    switch (event.type) {
      case 'clueSubmitted':
        return m.cn_event_clue({
          team: teamLabel(event.clue.team),
          word: event.clue.word,
          count: event.clue.count === 'unlimited' ? '∞' : event.clue.count,
        });
      case 'turnEnded':
        return m.cn_event_turn({ team: teamLabel(event.team) });
      case 'boardDealt':
        return m.cn_event_deal();
      case 'cardRevealed':
        return m.cn_event_reveal({
          word: event.word,
          identity: identityLabel(event.identity),
        });
      case 'gameFinished':
        return m.cn_winner({ team: teamLabel(event.result.team) });
    }
  }
  function animate(
    element: Element | null,
    frames: Keyframe[],
    duration: number,
    delay = 0,
    easing = 'ease-out',
  ) {
    if (!element || still) return;
    const animation = element.animate(frames, {
      duration,
      delay,
      easing,
    });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
  }
  $effect(() => {
    void [playerId, round];
    untrack(() => {
      localError = '';
    });
  });
  $effect(() => {
    void [s.actionSequence, playerId, round, s.phase, s.turn];
    const online = connected,
      code = errorCode;
    untrack(() => {
      if (panel === 'confirm' || (panel === 'clue' && (!online || !canClue)))
        close();
      selected = null;
      if (!online || code) settleEffects();
    });
  });
  $effect(() => {
    const identity = `${round}:${playerId}:${mine?.role ?? ''}`,
      sequence = s.actionSequence,
      online = connected,
      events = s.events;
    untrack(() => {
      const accepted = gate.consume(identity, sequence, events, online, s);
      if (!mounted || document.hidden) {
        gate.reset();
        return;
      }
      for (const event of accepted) {
        if (event.type === 'clueSubmitted')
          animate(
            root?.querySelector('.history-entry'),
            [
              { opacity: 0, transform: 'translateY(-6px)' },
              { opacity: 1, transform: 'none' },
            ],
            220,
          );
        if (event.type === 'turnEnded')
          animate(
            root?.querySelector('.turn-pill'),
            [{ opacity: 0.3 }, { opacity: 1 }],
            200,
          );
        if (event.type === 'boardDealt')
          root?.querySelectorAll('.dossier').forEach((el, i) =>
            animate(
              el,
              [
                { opacity: 0.75, transform: 'translateY(12px)' },
                { opacity: 1, transform: 'none' },
              ],
              240,
              i * 12,
            ),
          );
        if (event.type === 'cardRevealed') {
          const card = root?.querySelector(`[data-card="${event.card}"]`);
          animate(
            card?.querySelector('.cover') ?? null,
            [
              {
                transform: 'translate(-6%, -55%) rotate(-9deg) scale(1.18)',
                opacity: 0,
                boxShadow: '0 22px 26px #0006',
              },
              {
                transform: 'translate(0, 3%) rotate(1.5deg) scale(0.98)',
                opacity: 1,
                boxShadow: '0 1px 2px #0006',
                offset: 0.72,
              },
              {
                transform: 'none',
                opacity: 1,
                boxShadow: '0 2px 5px #0005',
              },
            ],
            pixel ? 360 : 460,
            0,
            pixel ? 'steps(4, jump-end)' : 'cubic-bezier(.25,.8,.3,1)',
          );
          animate(
            card,
            [
              { translate: '0 0' },
              { translate: '0 2px', offset: 0.72 },
              { translate: '0 0' },
            ],
            460,
          );
        }
      }
      const cue = accepted.some((e) => e.type === 'gameFinished')
        ? 'finish'
        : accepted.some((e) => e.type === 'cardRevealed')
          ? 'reveal'
          : null;
      if (prefs.sound && cue) playCue(audio, cue, prefs.volume, pixel);
    });
  });
  $effect(() => {
    void still;
    untrack(settleEffects);
  });
  $effect(() => {
    if (!prefs.sound) audio.stop();
  });
  onMount(() => {
    narrow = isNarrow();
    const textObserver = new ResizeObserver(([entry]) => {
      enlarged = (entry?.contentRect.width ?? 16) > 22;
    });
    textObserver.observe(root.querySelector('.text-measure')!);
    const reset = () => {
      narrow = isNarrow();
      settleEffects();
      if (panel === 'confirm') close();
      selected = null;
    };
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', reset);
    mounted = true;
    return () => {
      gate.reset();
      audio.close();
      textObserver.disconnect();
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  });

  let announce = $state(false);
  const matchPhase = $derived(`${round}:${s.phase}`);
  $effect(() => {
    matchPhase;
    if (!mounted) return;
    untrack(() => {
      if (s.phase === 'finished') open('result');
      else if (panel === 'result') close();
      announce = s.phase === 'clue' && s.board.every((c) => !c.revealed);
    });
    const timer = setTimeout(() => {
      announce = false;
    }, 4500);
    return () => clearTimeout(timer);
  });
</script>

{#snippet roster(only: Team | null = null)}
  <div class="player-list">
    {#each only ? [only] : ['red', 'blue', 'unassigned'] as team}
      <ul>
        {#each players.filter((p) => (s.assignments[p.id]?.team ?? 'unassigned') === team) as p}
          <li>
            <span class="team-dot {team}" aria-hidden="true"></span><span
              >{p.name}{#if s.assignments[p.id]?.role === 'spymaster'}
                <small>({m.cn_spymaster()})</small>{/if}{#if p.id === playerId}
                <small>({m.cn_you()})</small>{/if}<span class="sr-only">
                · {s.assignments[p.id]
                  ? teamLabel(s.assignments[p.id]!.team)
                  : m.cn_unassigned()}</span
              >{#if !p.connected}<small class="presence"
                  >{p.reservedUntil ? m.reserved() : m.cn_offline()}</small
                >{/if}</span
            >
          </li>
        {/each}
      </ul>
    {/each}
  </div>
{/snippet}
{#snippet keyPanel()}
  <div class="key-heading">
    <h3><Icon name="key" /> {m.cn_spymaster_mode()}</h3>
  </div>
  {#if key}<div class="key-body">
      <div class="mini-key" aria-label={m.cn_spymaster_mode()}>
        {#each key as identity, index}<span
            class="key-cell {identity}"
            aria-label={`${s.board[index]?.word}: ${identityLabel(identity)}`}
            ><Icon name={identity} /></span
          >{/each}
      </div>
      <p>
        {s.phase === 'finished' ? m.cn_key_public() : m.cn_key_caption_1()}<br
        />{s.phase !== 'finished' ? m.cn_key_caption_2() : ''}
      </p>
    </div>{/if}
{/snippet}
{#snippet history(only: Team | null = null)}
  <div class="history-list">
    {#each [...s.clueHistory]
      .reverse()
      .filter((r) => !only || r.team === only) as record (record.turn)}
      <article class="history-entry">
        <div class="history-title">
          <span class="team-dot {record.team}" aria-hidden="true"></span><b
            class="team-label {record.team}">{teamLabel(record.team)}</b
          ><strong>{record.word}</strong><span class="count-chip"
            >{record.count === 'unlimited' ? '∞' : record.count}</span
          >
        </div>
        {#if record.turn !== s.turn}<small
            >{m.cn_round({ turn: record.turn })}</small
          >{/if}
        <ul>
          {#each record.guesses as guess}<li
              class:correct={guess.identity === record.team}
              class="guess {guess.identity}"
              aria-label={`${guess.word}: ${guess.identity === record.team ? m.cn_correct_guess() : identityLabel(guess.identity)}`}
            >
              <span>{guess.word}</span>{#if guess.identity === record.team}<Icon
                  name="check"
                />{/if}
            </li>{/each}
        </ul>
      </article>
    {:else}<p class="empty">{m.cn_history_empty()}</p>{/each}
  </div>
{/snippet}
{#snippet teamStatus(team: Team)}
  <section class="team-status {team}">
    <h2>{teamLabel(team)}</h2>
    <div>
      {#if team === 'red'}<Icon name="agents" />{/if}<strong
        >{s.remaining[team]}</strong
      >{#if team === 'blue'}<Icon name="agents" />{/if}
    </div>
    <p>{m.cn_agents_remaining()}</p>
  </section>
{/snippet}
{#snippet turnBanner()}
  <div class="turn-banner glass">
    <div class="turn-meta">
      <span class="round-label">{m.cn_round({ turn: s.turn })}</span><strong
        aria-label={s.result
          ? m.cn_winner({ team: teamLabel(s.result.team) })
          : m.cn_team_turn({ team: teamLabel(s.activeTeam) })}
        class="turn-pill {s.result?.team ?? s.activeTeam}"
        >{s.result
          ? m.cn_winner({ team: teamLabel(s.result.team) })
          : compact
            ? teamLabel(s.activeTeam)
            : m.cn_team_turn({ team: teamLabel(s.activeTeam) })}</strong
      >
    </div>
    <div class="action-bar">
      {#if canClue}<button
          class="give-clue"
          {disabled}
          onclick={(e) => open('clue', e.currentTarget)}
          >{m.cn_give_clue()}</button
        >
      {:else if s.phase === 'clue'}<p>
          {m.cn_wait_clue({ team: teamLabel(s.activeTeam) })}
        </p>
      {:else if s.phase === 'guessing' && s.clue}<p class="active-clue">
          <b
            >{s.clue.word} · {s.clue.count === 'unlimited'
              ? '∞'
              : s.clue.count}</b
          ><span>{guessesLeft}</span>
        </p>
        {#if guessing}<button
            disabled={disabled || s.used < 1}
            title={s.used < 1 ? m.cn_end_turn_first() : undefined}
            aria-describedby={s.used < 1 ? 'cn-first-guess' : undefined}
            onclick={() => act({ type: 'endTurn' })}>{m.cn_end_turn()}</button
          >{#if s.used < 1}<small id="cn-first-guess"
              >{m.cn_end_turn_first()}</small
            >{/if}{/if}
      {:else if s.result}<button
          onclick={(e) => open('result', e.currentTarget)}
          >{m.cn_finished()}</button
        >{/if}
      {#if note}<small class="table-note" aria-live="polite">{note}</small>{/if}
    </div>
  </div>
{/snippet}
{#snippet board()}
  <div class="board-area">
    <main
      class="word-grid"
      aria-label={m.cn_title()}
      aria-describedby="cn-guess-reason"
    >
      {#each s.board as card}
        {@const identity = card.identity ?? view.private.key?.[card.index]}
        <button
          class="dossier {identity ?? 'unknown'}"
          class:revealed={card.revealed}
          class:key={!!identity && !card.revealed}
          class:selected={selected === card.index}
          data-card={card.index}
          data-identity={identity}
          title={card.revealed ? card.word : undefined}
          disabled={disabled || !guessing || card.revealed}
          aria-label={`${card.word}${identity ? ` · ${identityLabel(identity)} · ${card.revealed ? m.cn_revealed() : m.cn_unrevealed()}` : ''}`}
          aria-pressed={selected === card.index}
          onclick={(e) => choose(card.index, e.currentTarget)}
        >
          <strong class:long={card.word.length >= 10}>{card.word}</strong>
          {#if card.revealed && card.identity}<span
              class="cover {card.identity}"
              aria-hidden="true"
              ><img
                class="cover-art"
                src={cardArt(card.identity, card.index)}
                alt=""
                decoding="async"
                draggable="false"
              /></span
            >{/if}
        </button>
      {/each}
    </main>
  </div>
{/snippet}
{#snippet historySection(team: Team | null)}
  <section class="history-panel glass" aria-label={m.cn_clue_history()}>
    <header>
      <h2>{m.cn_clue_history()}</h2>
      {#if !team}<small>{m.cn_round({ turn: s.turn })}</small>{/if}
    </header>
    {@render history(team)}
  </section>
{/snippet}
{#snippet playersSection(team: Team | null)}
  <section class="players-panel glass">
    <h2>
      {m.cn_players_count({
        count: team
          ? players.filter((p) => s.assignments[p.id]?.team === team).length
          : players.length,
      })}
    </h2>
    {@render roster(team)}
  </section>
{/snippet}
<section
  data-phase={s.phase}
  data-active-team={s.activeTeam}
  data-layout={prefs.layout}
  class="cn-table cn-table-tokens"
  class:px-tokens={pixel}
  class:cn-pixel={pixel}
  style:--cn-wood-image={pixel
    ? 'url("/games/codenames/pixel/table.webp")'
    : `url("${wood}")`}
  class:reduced={still}
  class:enlarged
  class:compact
  bind:this={root}
  aria-label={m.cn_title()}
>
  <span class="text-measure" aria-hidden="true"></span>
  <button
    class="corner book"
    aria-label={m.cn_rules()}
    title={m.cn_rules()}
    onclick={(e) => open('rules', e.currentTarget)}
    ><svg viewBox="0 0 36 30" aria-hidden="true"
      ><path
        d="M18 7Q10 1 3 5v21q8-4 15 1 7-5 15-1V5q-7-4-15 2Z"
        fill="#efe1bd"
        stroke="#be9557"
        stroke-width="1.5"
      /><path
        d="M18 7v20M7 10l7 2M7 15l7 2M22 12l7-2M22 17l7-2"
        stroke="#7a2f2a"
        stroke-width="1.3"
      /></svg
    ></button
  >
  <button
    class="corner gear"
    aria-label={m.cn_settings()}
    title={m.cn_settings()}
    onclick={(e) => open('settings', e.currentTarget)}
    ><svg viewBox="0 0 32 32" aria-hidden="true"
      ><path
        d="M13.4 2.5h5.2l.9 3.6 2.6 1.1 3.2-1.9 3.7 3.7-1.9 3.2 1.1 2.6 3.6.9v5.2l-3.6.9-1.1 2.6 1.9 3.2-3.7 3.7-3.2-1.9-2.6 1.1-.9 3.6h-5.2l-.9-3.6-2.6-1.1-3.2 1.9-3.7-3.7 1.9-3.2-1.1-2.6-3.6-.9v-5.2l3.6-.9 1.1-2.6-1.9-3.2 3.7-3.7 3.2 1.9 2.6-1.1Z"
        fill="#efe1bd"
        stroke="#be9557"
        stroke-width="1.5"
        stroke-linejoin="round"
      /><circle
        cx="16"
        cy="16"
        r="5"
        fill="#7a2f2a"
        stroke="#be9557"
        stroke-width="1.3"
      /></svg
    ></button
  >
  {#if s.phase !== 'setup' && !compact}<p class="wordmark">
      <Icon name="logo" />{m.cn_title()}
    </p>{/if}
  {#if !connected}<p class="notice" role="status">{m.cn_offline()}</p>{/if}
  {#if localError}<p class="notice" role="alert">{localError}</p>{/if}
  {#if s.phase === 'setup'}
    <div class="setup">
      <h2>{m.cn_setup()}</h2>
      <p class="intro">{m.cn_setup_hint()}</p>
      <div class="teams">
        {#each ['red', 'blue'] as t}{@const team = t as Team}
          <section class="team-panel {team}">
            <h3>{teamLabel(team)}</h3>
            <div class="role-actions">
              {#each roles as role}<button
                  disabled={disabled ||
                    !canChooseRole(s.assignments, playerId, team, role)}
                  aria-pressed={mine?.team === team && mine?.role === role}
                  onclick={() =>
                    act({
                      type: 'chooseRole',
                      team,
                      role,
                      version: s.setupVersion,
                    })}>{m.cn_join_role({ role: roleLabel(role) })}</button
                >{/each}
            </div>
            <ul>
              {#each players.filter((p) => s.assignments[p.id]?.team === team) as p}<li
                >
                  <strong>{p.name}</strong><span
                    >{roleLabel(s.assignments[p.id]!.role)}
                    {s.ready.includes(p.id) ? '✓' : ''}</span
                  >{#if !p.connected}<small>{m.cn_offline()}</small>{/if}
                </li>{/each}
            </ul>
          </section>{/each}
      </div>
      <p class="unassigned">
        {m.cn_unassigned()}: {players
          .filter((p) => !s.assignments[p.id])
          .map((p) => p.name)
          .join(' · ') || '—'}
      </p>
      <div class="agreements">
        <p>
          <strong>{m.cn_language()}</strong> · {s.options.boardLanguage === 'es'
            ? 'Español'
            : 'English'}
        </p>
      </div>
      <button
        class="primary"
        disabled={disabled || !canStart(s) || s.ready.includes(playerId)}
        onclick={() => act({ type: 'ready', version: s.setupVersion })}
        >{s.ready.includes(playerId) ? m.cn_ready_done() : m.cn_ready()} · {s
          .ready.length}/{s.players.length}</button
      >
      <p class="hint">{m.cn_wait_ready()}</p>
    </div>
  {:else if compact}
    <div class="table-layout">
      <div class="team-row">
        {@render teamStatus('red')}{@render turnBanner()}{@render teamStatus(
          'blue',
        )}
      </div>
      {@render board()}
      <nav class="drawer" aria-label={m.cn_settings()}>
        <button
          aria-label={m.cn_clue_history()}
          onclick={(e) => open('history', e.currentTarget)}
          ><Icon name="history" /><span class="label"
            >{s.clueHistory.length}</span
          ></button
        ><button
          aria-label={m.cn_players_count({ count: players.length })}
          onclick={(e) => open('players', e.currentTarget)}
          ><Icon name="players" /><span class="label">{players.length}</span
          ></button
        >{#if key}<button
            aria-label={m.cn_spymaster_mode()}
            onclick={(e) => open('key', e.currentTarget)}
            ><Icon name="key" /></button
          >{/if}
      </nav>
    </div>
  {:else if prefs.layout === 'center'}
    <div class="table-layout">
      {#each ['red', 'blue'] as t}{@const team = t as Team}
        <div class="cell score-{team}">{@render teamStatus(team)}</div>
        <div class="cell stack history-{team}">
          {@render historySection(team)}
          {#if key && (mine?.team ?? 'red') === team}<section
              class="key-panel glass"
            >
              {@render keyPanel()}
            </section>{/if}
        </div>
        <div class="cell players-{team}">{@render playersSection(team)}</div>
      {/each}
      {@render board()}
      {@render turnBanner()}
    </div>
  {:else}
    <div class="table-layout">
      <aside class="rail info">
        <div class="score-row">
          {@render teamStatus('red')}{@render teamStatus('blue')}
        </div>
        {@render turnBanner()}
        {@render historySection(null)}
        {@render playersSection(null)}
        {#if key}<section class="key-panel glass">
            {@render keyPanel()}
          </section>{/if}
      </aside>
      {@render board()}
    </div>
  {/if}
  {#if s.phase !== 'setup'}
    <span id="cn-guess-reason" class="sr-only"
      >{!guessing ? m.cn_wait_guess() : m.cn_confirm_hint()}</span
    >
    {#if announce}<p class="deal-notice" role="status">
        {m.cn_starts({ team: teamLabel(s.startingTeam) })}
      </p>{/if}
  {/if}
  <span class="sr-only" aria-live="polite"
    >{s.events.map(eventLabel).join(' ')}</span
  >
</section>

<dialog
  class="cn-dialog cn-table-tokens"
  class:px-tokens={pixel}
  class:cn-pixel={pixel}
  {@attach modal(() => dialogOpen)}
  class:confirmation={panel === 'confirm'}
  class:result={panel === 'result'}
  onclose={(e) => {
    if (!e.currentTarget.open) close();
  }}
  aria-label={panel ? labels[panel] : m.cn_settings()}
>
  <header>
    <h2>{panel ? labels[panel] : ''}</h2>
    <button class="close" aria-label={m.cn_close()} onclick={close}
      ><Icon name="close" /></button
    >
  </header>
  {#if panel === 'history'}{@render history()}
  {:else if panel === 'players'}{@render roster()}
  {:else if panel === 'key' && key}{@render keyPanel()}
  {:else if panel === 'clue'}
    <p>{m.cn_give_clue_hint()}</p>
    <form
      class="clue-form"
      onsubmit={(event) => {
        event.preventDefault();
        if (canClue)
          void act({
            type: 'submitClue',
            word: clueWord,
            count: clueCount === 'unlimited' ? 'unlimited' : Number(clueCount),
          });
      }}
    >
      <label
        >{m.cn_word()}<input
          name="word"
          bind:value={clueWord}
          required
          autocomplete="off"
        /></label
      >
      <label
        >{m.cn_count()}<select bind:value={clueCount}
          >{#each Array.from( { length: 10 }, (_, i) => String(i) ) as count}<option
              value={count}>{count}</option
            >{/each}<option value="unlimited">∞</option></select
        ></label
      >
      <button
        class="primary"
        disabled={disabled || !canClue || !clueWord.trim()}
        >{m.cn_give_clue()}</button
      >
    </form>
  {:else if panel === 'about'}<p>{m.cn_description()}</p>
    <p>
      {m.cn_sources()}:
      <a
        href="https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf"
        target="_blank"
        rel="noreferrer">English</a
      >
      ·
      <a
        href="https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf"
        target="_blank"
        rel="noreferrer">Español</a
      >
    </p>
  {:else if panel === 'rules'}{@render rulesContent?.()}
  {:else if panel === 'confirm' && selected !== null && s.board[selected]}
    <p class="chosen-word">{s.board[selected]!.word}</p>
    <p>{m.cn_confirm_hint()}</p>
    <div class="action-row">
      <button
        class="primary"
        {disabled}
        onclick={() => act({ type: 'guess', card: selected! })}
        >{m.cn_reveal({ word: s.board[selected]!.word })}</button
      >
      <button onclick={close}>{m.cn_cancel()}</button>
    </div>
  {:else if panel === 'result' && s.result}
    <div class="winner {s.result.team}">
      <h3>{m.cn_winner({ team: teamLabel(s.result.team) })}</h3>
      <p>
        {s.result.reason === 'assassin'
          ? m.cn_win_assassin()
          : m.cn_win_agents()}
      </p>
    </div>
    {#if canRematch}<button
        class="primary"
        {disabled}
        onclick={() => {
          gesture();
          close();
          void rematch?.();
        }}>{m.cn_rematch()}</button
      >{/if}
  {:else if panel === 'settings'}
    <nav class="dialog-nav">
      <button onclick={() => open('rules')}>{m.cn_rules()}</button><button
        onclick={() => open('about')}>{m.cn_nav_about()}</button
      >
    </nav>
    {#if mine}<p class="your-role">
        {teamLabel(mine.team)} · {roleLabel(mine.role)}
      </p>{/if}
    {#if s.phase !== 'setup'}
      <p>{m.cn_starts({ team: teamLabel(s.startingTeam) })}</p>
      <div class="remaining">
        {#each ['red', 'blue'] as t}{@const team = t as Team}
          <p>
            <b>{teamLabel(team)}</b><span
              >{m.cn_remaining({ count: s.remaining[team] })}</span
            >
          </p>{/each}
      </div>
      {#if s.result}<button onclick={() => open('result')}
          >{m.cn_winner({ team: teamLabel(s.result.team) })}</button
        >{/if}
    {/if}
    <fieldset class="layout-choice skin-choice">
      <legend>{m.skin()}</legend>
      {#each [['classic', m.skin_classic()], ['pixel', m.skin_pixel()]] as [value, label]}<label
          ><input
            type="radio"
            name="cn-skin"
            {value}
            checked={skin.choice === value}
            onchange={() => skin.choose(value as 'classic' | 'pixel')}
          />{label}</label
        >{/each}
    </fieldset>
    <fieldset class="layout-choice">
      <legend>{m.cn_layout()}</legend>
      {#each [['left', m.cn_layout_left()], ['center', m.cn_layout_center()], ['right', m.cn_layout_right()]] as [value, label]}<label
          ><input
            type="radio"
            name="cn-layout"
            {value}
            bind:group={prefs.layout}
          />{label}</label
        >{/each}
    </fieldset>
    <p class="room-line">
      <span
        ><Icon name="players" />
        {players.length}/{games.codenames.maxPlayers}</span
      >
      {#if viewer}<span>{viewer.name}</span>{/if}
    </p>
    <div class="preferences">
      <label
        ><input
          type="checkbox"
          bind:checked={prefs.sound}
          onchange={gesture}
        />{m.cn_sound()}</label
      >
      <label
        >{m.cn_volume()}<input
          type="range"
          min="0"
          max="1"
          step=".05"
          bind:value={prefs.volume}
        /></label
      >
      <label
        ><input
          type="checkbox"
          checked={still}
          onchange={(e) => (prefs.motion = !e.currentTarget.checked)}
        />{m.cn_motion()}</label
      >
    </div>
    {@render settingsContent?.()}
    <h3>{m.cn_roster()}</h3>
    <ul class="settings-roster">
      {#each players as p}<li>
          <strong>{p.name}</strong><span
            >{s.assignments[p.id]
              ? `${teamLabel(s.assignments[p.id]!.team)} · ${roleLabel(s.assignments[p.id]!.role)}`
              : m.cn_unassigned()}{#if !p.connected}
              · {m.cn_offline()}{/if}</span
          >
        </li>{/each}
    </ul>
  {/if}
</dialog>
