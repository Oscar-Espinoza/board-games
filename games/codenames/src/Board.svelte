<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { View, Team, Identity, PublicEvent } from './types.js';
  import Icon from './Icon.svelte';
  import './tokens.css';
  import wood from './table/wood.webp';
  import { eventGate, readJson, write } from '@board-games/shared/ui';
  import {
    gameSkin,
    setGameSkin,
    type Skin,
  } from '@board-games/shared/ui/pixel';
  import { prefersReducedMotion } from 'svelte/motion';
  import { soundEffects } from './effects.js';
  let {
    view,
    playerId,
    players,
    send,
    round = 0,
    connected = true,
    pending = false,
    settingsContent,
    rulesContent,
    canRematch = false,
    rematch = async () => {},
    errorCode = null,
    roomId,
    maxPlayers = 12,
    onInvite,
    copied = false,
    practice = false,
    note = '',
  }: {
    /** Short status line shown with the turn controls (e.g. a bot's last move). */
    note?: string;
    roomId?: string;
    maxPlayers?: number;
    onInvite?: () => Promise<void>;
    copied?: boolean;
    view: View;
    playerId: string;
    players: {
      id: string;
      name: string;
      connected: boolean;
      reservedUntil?: number | null;
    }[];
    send: (action: unknown) => unknown;
    locale?: string;
    round?: number;
    connected?: boolean;
    pending?: boolean;
    practice?: boolean;
    canConfigure?: boolean;
    settingsContent?: Snippet;
    rulesContent?: Snippet;
    canRematch?: boolean;
    rematch?: () => Promise<void>;
    errorCode?: string | null;
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
  const disabled = $derived(!connected || pending);
  const guessing = $derived(
    s.phase === 'guessing' &&
      mine?.role === 'operative' &&
      mine.team === s.activeTeam,
  );
  const rosterReady = $derived(
    s.players.every((p) => s.assignments[p]) &&
      (['red', 'blue'] as Team[]).every(
        (team) =>
          Object.values(s.assignments).some(
            (a) => a.team === team && a.role === 'spymaster',
          ) &&
          Object.values(s.assignments).some(
            (a) => a.team === team && a.role === 'operative',
          ),
      ) &&
      s.players.every((p) => s.connectedPlayers.includes(p)),
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
  let panel = $state<Panel | null>(null),
    dialog: HTMLDialogElement,
    opener: HTMLElement | null = null;
  let sound = $state(true),
    volume = $state(0.5),
    reduced = $state(false),
    mounted = $state(false),
    enlarged = $state(false),
    narrow = $state(window.innerWidth < 1024),
    clueWord = $state(''),
    clueCount = $state<string>('2'),
    layout = $state<'left' | 'center' | 'right'>('center');
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
  const gate = eventGate<PublicEvent>(
      stopEffects,
      (event, i, sequence) => event.sequence === sequence && event.index === i,
    ),
    audio = soundEffects();
  /** Viewer-only look; the 8-bit stylesheet loads the first time it is chosen. */
  let skin = $state<Skin>(gameSkin('codenames')),
    pixelReady = $state(false);
  $effect(() => {
    if (skin === 'pixel' && !pixelReady)
      void import('./pixel.css').then(() => (pixelReady = true));
  });
  const pixel = $derived(skin === 'pixel' && pixelReady);
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
    audio.cancel();
  }
  function cancelEffects() {
    gate.reset();
  }
  function settleEffects() {
    cancelEffects();
    gate.consume(
      `${round}:${playerId}:${mine?.role ?? ''}`,
      s.actionSequence,
      [],
      connected,
      s,
    );
  }
  function gesture() {
    if (sound) void audio.unlock();
  }
  function open(next: Panel, source?: HTMLElement) {
    if (source) gesture();
    opener = source ?? null;
    panel = next;
    if (!dialog.open) dialog.showModal();
  }
  function close() {
    panel = null;
    selected = null;
    dialog.close();
    opener?.focus();
  }
  async function act(action: unknown) {
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
    } catch {
      localError = m.cn_error();
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
    if (!element || reduced || systemReduced) return;
    const animation = element.animate(frames, {
      duration,
      delay,
      easing,
    });
    animations.add(animation);
    animation.onfinish = () => animations.delete(animation);
  }
  $effect(() => {
    const seat = playerId,
      r = round;
    untrack(() => {
      localError = '';
    });
  });
  $effect(() => {
    const seq = s.actionSequence,
      seat = playerId,
      r = round,
      phase = s.phase,
      turn = s.turn,
      online = connected,
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
        cancelEffects();
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
      if (sound && cue) audio.play(volume, cue, pixel);
    });
  });
  $effect(() => {
    const motion = reduced,
      preference = systemReduced;
    untrack(settleEffects);
  });
  const systemReduced = $derived(prefersReducedMotion.current);
  $effect(() => {
    if (mounted) {
      write('codenames:preferences', {
        sound,
        volume,
        reduced,
        layout,
      });
      if (!sound) audio.cancel();
    }
  });
  onMount(() => {
    const p = readJson('codenames:preferences');
    sound = p.sound !== false;
    if (typeof p.volume === 'number' && Number.isFinite(p.volume))
      volume = Math.min(1, Math.max(0, p.volume));
    reduced = p.reduced === true;
    if (p.layout === 'left' || p.layout === 'right') layout = p.layout;
    narrow = window.innerWidth < 1024;
    const textObserver = new ResizeObserver(([entry]) => {
      enlarged = (entry?.contentRect.width ?? 16) > 22;
    });
    textObserver.observe(root.querySelector('.text-measure')!);
    const reset = () => {
      narrow = window.innerWidth < 1024;
      settleEffects();
      if (panel === 'confirm') close();
      selected = null;
    };
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', reset);
    mounted = true;
    return () => {
      cancelEffects();
      audio.dispose();
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
          : narrow || enlarged
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
  data-layout={layout}
  class="cn-table cn-table-tokens"
  class:px-tokens={pixel}
  class:cn-pixel={pixel}
  style:--cn-wood-image={pixel
    ? 'url("/games/codenames/pixel/table.webp")'
    : `url("${wood}")`}
  class:reduced={reduced || systemReduced}
  class:enlarged
  class:compact={narrow || enlarged}
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
  {#if s.phase !== 'setup' && !(narrow || enlarged)}<p class="wordmark">
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
              {#each ['spymaster', 'operative'] as role}<button
                  disabled={disabled ||
                    (mine?.team === team && mine?.role === role) ||
                    (role === 'spymaster' &&
                      Object.entries(s.assignments).some(
                        ([id, a]) =>
                          id !== playerId && a.team === team && a.role === role,
                      ))}
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
        disabled={disabled || !rosterReady || s.ready.includes(playerId)}
        onclick={() => act({ type: 'ready', version: s.setupVersion })}
        >{s.ready.includes(playerId) ? m.cn_ready_done() : m.cn_ready()} · {s
          .ready.length}/{s.players.length}</button
      >
      <p class="hint">{m.cn_wait_ready()}</p>
    </div>
  {:else if narrow || enlarged}
    <!-- Compact: slim status bar, the board, and a drawer for history and players. -->
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
  {:else if layout === 'center'}
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
  bind:this={dialog}
  class:confirmation={panel === 'confirm'}
  class:result={panel === 'result'}
  onclose={() => {
    if (dialog.open) return;
    panel = null;
    selected = null;
    opener?.focus();
  }}
  oncancel={close}
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
        onclick={() => act({ type: 'guess', card: selected })}
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
          void rematch();
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
      <legend>{m.cn_skin()}</legend>
      {#each [['classic', m.cn_skin_classic()], ['pixel', m.cn_skin_pixel()]] as [value, label]}<label
          ><input
            type="radio"
            name="cn-skin"
            {value}
            checked={skin === value}
            onchange={() => {
              skin = value as Skin;
              setGameSkin('codenames', skin);
            }}
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
            bind:group={layout}
          />{label}</label
        >{/each}
    </fieldset>
    {#if practice || roomId}<p class="room-line">
        {#if practice}{m.cn_practice()}{:else if roomId}<button
            class="invite"
            disabled={!onInvite}
            onclick={() => void onInvite?.()}
            ><span>{m.cn_room({ room: roomId })}</span><Icon name="invite" />
            {copied ? m.copied() : m.invite()}</button
          >{/if}
        <span><Icon name="players" /> {players.length}/{maxPlayers}</span>
        {#if viewer}<span
            >{viewer.name} · {connected
              ? m.cn_online()
              : m.disconnected()}</span
          >{/if}
      </p>{/if}
    <div class="preferences">
      <label
        ><input
          type="checkbox"
          bind:checked={sound}
          onchange={gesture}
        />{m.cn_sound()}</label
      >
      <label
        >{m.cn_volume()}<input
          type="range"
          min="0"
          max="1"
          step=".05"
          bind:value={volume}
        /></label
      >
      <label
        ><input type="checkbox" bind:checked={reduced} />{m.cn_motion()}</label
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
