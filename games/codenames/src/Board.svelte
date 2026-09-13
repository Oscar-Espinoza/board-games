<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { View, Team, Identity, PublicEvent } from './types.js';
  import Icon from './Icon.svelte';
  import './tokens.css';
  import wood from './table/wood.webp';
  import foliage from './table/foliage.webp';
  import mug from './table/mug.webp';
  import coaster from './table/coaster.webp';
  import notepad from './table/notepad.webp';
  import books from './table/books.webp';
  import Rulebook from './Rulebook.svelte';
  import { eventGate } from './presentation.js';
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
    canRematch = false,
    rematch = async () => {},
    errorCode = null,
    roomId,
    maxPlayers = 8,
    onInvite,
    copied = false,
    practice = false,
  }: {
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
    systemReduced = $state(false),
    mounted = $state(false),
    showKey = $state(true),
    enlarged = $state(false),
    narrow = $state(false),
    clueWord = $state(''),
    clueCount = $state<string>('2');
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
  const gate = eventGate(stopEffects),
    audio = soundEffects();
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
  ) {
    if (!element || reduced || systemReduced) return;
    const animation = element.animate(frames, {
      duration,
      delay,
      easing: 'ease-out',
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
            card,
            [
              { transform: 'perspective(600px) rotateX(85deg)', opacity: 0.3 },
              { transform: 'perspective(600px) rotateX(0)', opacity: 1 },
            ],
            300,
          );
        }
      }
      const cue = accepted.some((e) => e.type === 'gameFinished')
        ? 'finish'
        : accepted.some((e) => e.type === 'cardRevealed')
          ? 'reveal'
          : null;
      if (sound && cue) audio.play(volume, cue);
    });
  });
  $effect(() => {
    const motion = reduced,
      preference = systemReduced;
    untrack(settleEffects);
  });
  $effect(() => {
    if (mounted) {
      try {
        localStorage.setItem(
          'codenames:preferences',
          JSON.stringify({ sound, volume, reduced, showKey }),
        );
      } catch {}
      if (!sound) audio.cancel();
    }
  });
  onMount(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem('codenames:preferences') ?? '{}',
      );
      sound = p.sound !== false;
      if (typeof p.volume === 'number' && Number.isFinite(p.volume))
        volume = Math.min(1, Math.max(0, p.volume));
      reduced = p.reduced === true;
      showKey = p.showKey !== false;
    } catch {}
    narrow = window.innerWidth < 1024;
    const textObserver = new ResizeObserver(([entry]) => {
      enlarged = (entry?.contentRect.width ?? 16) > 22;
    });
    textObserver.observe(root.querySelector('.text-measure')!);
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    systemReduced = query.matches;
    const media = () => {
      systemReduced = query.matches;
    };
    query.addEventListener('change', media);
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
      query.removeEventListener('change', media);
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

{#snippet roster()}
  <div class="player-list">
    {#each ['red', 'blue', 'unassigned'] as team}
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
    <button
      class="switch"
      role="switch"
      aria-label={m.cn_spymaster_mode()}
      aria-checked={showKey}
      onclick={() => (showKey = !showKey)}><span></span></button
    >
  </div>
  {#if showKey && key}<div class="key-body">
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
{#snippet history()}
  <div class="history-list">
    {#each [...s.clueHistory].reverse() as record (record.turn)}
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
<section
  data-phase={s.phase}
  data-active-team={s.activeTeam}
  class="cn-table cn-table-tokens"
  style:--cn-wood-image={`url("${wood}")`}
  class:reduced={reduced || systemReduced}
  class:enlarged
  class:compact={narrow || enlarged}
  bind:this={root}
  aria-label={m.cn_title()}
>
  <span class="text-measure" aria-hidden="true"></span>
  <div class="props" aria-hidden="true">
    <img class="prop foliage" src={foliage} alt="" /><img
      class="prop coaster"
      src={coaster}
      alt=""
    /><img class="prop mug" src={mug} alt="" /><img
      class="prop notepad"
      src={notepad}
      alt=""
    /><img class="prop books" src={books} alt="" />
  </div>
  <header class="table-header glass">
    <div class="brand">
      <Icon name="logo" />
      <h1>{m.cn_title()}</h1>
    </div>
    <nav class="main-nav" aria-label={m.cn_title()}>
      <span aria-current="page">{m.cn_nav_play()}</span><button
        onclick={(e) => open('rules', e.currentTarget)}>{m.cn_nav_how()}</button
      ><button onclick={(e) => open('about', e.currentTarget)}
        >{m.cn_nav_about()}</button
      >
    </nav>
    <div class="room-meta">
      {#if practice}<span>{m.cn_practice()}</span>{:else if roomId}<button
          class="invite"
          disabled={!onInvite}
          onclick={() => void onInvite?.()}
          aria-label={copied ? m.copied() : m.invite()}
          ><span>{m.cn_room({ room: roomId })}</span><Icon
            name="invite"
          /></button
        >{/if}
    </div>
    <span class="seat-count" aria-label={m.cn_seats()}
      ><Icon name="players" /> {players.length}/{maxPlayers}</span
    >
    <div class="viewer">
      <span class="avatar"
        >{viewer?.name
          .split(/\s+/)
          .slice(0, 2)
          .map((n) => n[0])
          .join('')}</span
      ><span
        ><b>{viewer?.name}</b><small
          >{connected ? m.cn_online() : m.disconnected()}<i
            class:online={connected}
          ></i></small
        ></span
      >
    </div>
    <nav class="tools" aria-label={m.cn_settings()}>
      <button
        class="compact-history"
        aria-label={m.cn_clue_history()}
        title={m.cn_clue_history()}
        onclick={(e) => open('history', e.currentTarget)}
        ><Icon name="history" /></button
      >
      <button
        class="compact-players"
        aria-label={m.cn_players_count({ count: players.length })}
        title={m.cn_players_count({ count: players.length })}
        onclick={(e) => open('players', e.currentTarget)}
        ><Icon name="players" /></button
      >
      {#if key}<button
          class="compact-key"
          aria-label={m.cn_spymaster_mode()}
          title={m.cn_spymaster_mode()}
          onclick={(e) => open('key', e.currentTarget)}
          ><Icon name="key" /></button
        >{/if}
      <button
        aria-label={m.cn_settings()}
        title={m.cn_settings()}
        onclick={(e) => open('settings', e.currentTarget)}
        ><Icon name="settings" /></button
      >
    </nav>
  </header>
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
  {:else}
    <div class="table-layout">
      <div class="team-row">
        <section class="team-status red">
          <h2>{m.cn_red()}</h2>
          <div><Icon name="agents" /><strong>{s.remaining.red}</strong></div>
          <p>{m.cn_agents_remaining()}</p>
        </section>
        <div class="turn-banner glass">
          <div class="turn-meta">
            <span class="round-label">{m.cn_round({ turn: s.turn })}</span
            ><strong
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
                  onclick={() => act({ type: 'endTurn' })}
                  >{m.cn_end_turn()}</button
                >{#if s.used < 1}<small id="cn-first-guess"
                    >{m.cn_end_turn_first()}</small
                  >{/if}{/if}
            {:else if s.result}<button
                onclick={(e) => open('result', e.currentTarget)}
                >{m.cn_finished()}</button
              >{/if}
          </div>
        </div>
        <section class="team-status blue">
          <h2>{m.cn_blue()}</h2>
          <div><strong>{s.remaining.blue}</strong><Icon name="agents" /></div>
          <p>{m.cn_agents_remaining()}</p>
        </section>
      </div>
      <main
        class="word-grid"
        aria-label={m.cn_title()}
        aria-describedby="cn-guess-reason"
      >
        {#each s.board as card}
          {@const identity =
            card.identity ??
            (showKey ? view.private.key?.[card.index] : undefined)}
          <button
            class="dossier {identity ?? 'unknown'}"
            class:revealed={card.revealed}
            class:key={!!identity && !card.revealed}
            class:selected={selected === card.index}
            data-card={card.index}
            data-identity={identity}
            disabled={disabled || !guessing || card.revealed}
            aria-label={`${card.word}${identity ? ` · ${identityLabel(identity)} · ${card.revealed ? m.cn_revealed() : m.cn_unrevealed()}` : ''}`}
            aria-pressed={selected === card.index}
            onclick={(e) => choose(card.index, e.currentTarget)}
          >
            <strong class:long={card.word.length >= 10}>{card.word}</strong>
          </button>
        {/each}
      </main>
      <span id="cn-guess-reason" class="sr-only"
        >{!guessing ? m.cn_wait_guess() : m.cn_confirm_hint()}</span
      >
      <div class="bottom-panels" class:with-key={!!key}>
        <section class="players-panel glass">
          <h2>{m.cn_players_count({ count: players.length })}</h2>
          {@render roster()}
        </section>
        {#if key}<section class="key-panel glass">
            {@render keyPanel()}
          </section>{/if}
      </div>
      <aside class="history-panel glass" aria-label={m.cn_clue_history()}>
        <header>
          <h2>{m.cn_clue_history()}</h2>
          <small>{m.cn_round({ turn: s.turn })}</small>
        </header>
        {@render history()}
      </aside>
    </div>
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
  {:else if panel === 'rules'}<Rulebook />
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
