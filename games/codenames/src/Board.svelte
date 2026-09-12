<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { View, Team, Identity, PublicEvent } from './types.js';
  import Rulebook from './Rulebook.svelte';
  import { eventGate } from './presentation.js';
  import { soundEffects } from './effects.js';
  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    pending = false,
    practice = false,
    canConfigure = false,
    settingsContent,
    canRematch = false,
    rematch = async () => {},
    errorCode = null,
  }: {
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
  const phaseLabel = $derived(
    {
      setup: m.cn_setup,
      clue: m.cn_clue,
      clueReview: m.cn_clueReview,
      guessing: m.cn_guessing,
      penalty: m.cn_penalty_phase,
      finished: m.cn_finished,
    }[s.phase](),
  );
  const disabled = $derived(!connected || pending);
  const responsibleTeam = $derived(
    s.phase === 'clueReview' || s.phase === 'penalty'
      ? s.activeTeam === 'red'
        ? 'blue'
        : 'red'
      : s.activeTeam,
  );
  const responsibleRole = $derived(
    s.phase === 'guessing' ? 'operative' : 'spymaster',
  );
  const responsiblePlayers = $derived(
    players.filter(
      (p) =>
        s.assignments[p.id]?.team === responsibleTeam &&
        s.assignments[p.id]?.role === responsibleRole,
    ),
  );
  const guessing = $derived(
    s.phase === 'guessing' &&
      mine?.team === s.activeTeam &&
      mine?.role === 'operative',
  );
  const penalizing = $derived(
    s.phase === 'penalty' &&
      mine?.team !== s.activeTeam &&
      mine?.role === 'spymaster',
  );
  const composing = $derived(
    s.phase === 'clue' &&
      mine?.team === s.activeTeam &&
      mine?.role === 'spymaster',
  );
  const reviewing = $derived(
    s.phase === 'clueReview' &&
      mine?.team !== s.activeTeam &&
      mine?.role === 'spymaster',
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
    word = $state(''),
    count = $state('1'),
    localError = $state('');
  let panel = $state<'rules' | 'settings' | null>(null),
    dialog: HTMLDialogElement,
    opener: HTMLElement | null = null;
  let sound = $state(true),
    volume = $state(0.5),
    reduced = $state(false),
    systemReduced = $state(false),
    mounted = $state(false);
  let root: HTMLElement;
  const gate = eventGate(stopEffects),
    audio = soundEffects();
  const animations = new Set<Animation>();
  const warning = $derived(
    word.trim() &&
      (/\s/u.test(word.trim()) ||
        s.board.some(
          (c) =>
            !c.revealed &&
            c.word
              .normalize('NFC')
              .toLocaleLowerCase(s.options.boardLanguage) ===
              word
                .normalize('NFC')
                .trim()
                .toLocaleLowerCase(s.options.boardLanguage),
        )),
  );
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
  function open(next: 'rules' | 'settings', source: HTMLElement) {
    gesture();
    opener = source;
    panel = next;
    dialog.showModal();
  }
  function close() {
    panel = null;
    dialog.close();
    opener?.focus();
  }
  async function act(action: unknown) {
    if (disabled) return;
    gesture();
    selected = null;
    localError = '';
    try {
      await send(action);
    } catch {
      localError = m.cn_error();
    } finally {
      selected = null;
    }
  }
  function choose(index: number) {
    gesture();
    if (disabled || !(guessing || penalizing)) return;
    selected = index;
  }
  function eventLabel(event: PublicEvent): string {
    switch (event.type) {
      case 'boardDealt':
        return m.cn_event_deal();
      case 'clueSubmitted':
        return `${teamLabel(event.clue.team)} · ${event.clue.word} · ${event.clue.count === 'unlimited' ? '∞' : event.clue.count}`;
      case 'clueReviewed':
        return event.allow ? m.cn_event_allow() : m.cn_event_reject();
      case 'cardRevealed':
        return m.cn_event_reveal({
          word: event.word,
          identity: identityLabel(event.identity),
        });
      case 'turnEnded':
        return m.cn_event_turn({ team: teamLabel(event.team) });
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
      word = '';
      count = '1';
      localError = '';
    });
  });
  $effect(() => {
    const seq = s.actionSequence,
      seat = playerId,
      r = round,
      phase = s.phase,
      online = connected,
      code = errorCode;
    untrack(() => {
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
          animate(
            card?.querySelector('.identity') ?? null,
            [
              { transform: 'scale(1.3)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            220,
            120,
          );
          root
            ?.querySelectorAll('.side>strong,.mobile-counters')
            .forEach((el) =>
              animate(
                el,
                [{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
                200,
              ),
            );
        }
        if (event.type === 'clueSubmitted')
          animate(
            root?.querySelector('.clue-strip'),
            [
              { opacity: 0.3, transform: 'translateY(-6px)' },
              { opacity: 1, transform: 'none' },
            ],
            220,
          );
        if (event.type === 'turnEnded')
          animate(
            root?.querySelector('.phase'),
            [{ opacity: 0.4 }, { opacity: 1 }],
            240,
          );
        if (event.type === 'gameFinished')
          animate(
            root?.querySelector('.result'),
            [{ opacity: 0 }, { opacity: 1 }],
            450,
          );
      }
      const cue = accepted.some((e) => e.type === 'gameFinished')
        ? 'finish'
        : accepted.some((e) => e.type === 'cardRevealed')
          ? 'reveal'
          : accepted.some((e) => e.type === 'turnEnded')
            ? 'handoff'
            : accepted.some((e) => e.type === 'clueSubmitted')
              ? 'clue'
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
          JSON.stringify({ sound, volume, reduced }),
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
    } catch {}
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    systemReduced = query.matches;
    const media = () => {
      systemReduced = query.matches;
    };
    query.addEventListener('change', media);
    const reset = () => {
      settleEffects();
      selected = null;
    };
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', reset);
    mounted = true;
    return () => {
      cancelEffects();
      audio.dispose();
      query.removeEventListener('change', media);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') {
      selected = null;
      if (panel) {
        e.preventDefault();
        close();
      }
    }
  }}
/>
<section
  class="cn-table"
  class:reduced={reduced || systemReduced}
  bind:this={root}
  data-phase={s.phase}
  data-testid="codenames-board"
>
  <button
    class="corner manual"
    aria-label={m.cn_rules()}
    onclick={(e) => open('rules', e.currentTarget)}
    ><svg viewBox="0 0 32 32" aria-hidden="true"
      ><path
        d="M3 5q8-3 13 2 5-5 13-2v22q-8-3-13 1-5-4-13-1z"
        fill="#f5eedc"
        stroke="#b88b47"
        stroke-width="2"
      /><path d="M16 7v21M7 11h5m-5 5h5m8-5h5m-5 5h5" stroke="#30251e" /></svg
    ><span>{m.cn_rules()}</span></button
  >
  <button
    class="corner gear"
    aria-label={m.cn_settings()}
    onclick={(e) => open('settings', e.currentTarget)}>⚙</button
  >
  <header class="masthead">
    <p>{practice ? m.cn_practice() : m.cn_briefing()}</p>
    <h1>{m.cn_title()}</h1>
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
        <p>
          {m.cn_abbreviations()}: {s.options.allowAbbreviations
            ? m.cn_yes()
            : m.cn_no()}
        </p>
        <p>
          {m.cn_names()}: {s.options.allowMultiwordNames
            ? m.cn_yes()
            : m.cn_no()}
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
    <div class="operation">
      <aside class="side red">
        <h2>{m.cn_red()}</h2>
        <strong>{s.remaining.red}</strong>
        <p>{m.cn_remaining({ count: s.remaining.red })}</p>
        {#each players.filter((p) => s.assignments[p.id]?.team === 'red') as p}<p
            class:offline={!p.connected}
          >
            {p.name}<small>{roleLabel(s.assignments[p.id]!.role)}</small>
          </p>{/each}
      </aside>
      <main class="table-center">
        <div class="phase" aria-live="polite">
          <span class="team-dot {responsibleTeam}"></span><strong
            >{s.result
              ? m.cn_winner({ team: teamLabel(s.result.team) })
              : teamLabel(responsibleTeam)}</strong
          ><span>{phaseLabel}</span>
        </div>
        <div class="mobile-counters">
          {#each ['red', 'blue'] as t}{@const team = t as Team}
            <details>
              <summary
                >{teamLabel(team)} · {s.remaining[team]}<small
                  >{players
                    .filter((p) => s.assignments[p.id]?.team === team)
                    .map((p) => p.name)
                    .join(' · ')}</small
                ></summary
              >{#each players.filter((p) => s.assignments[p.id]?.team === team) as p}<p
                >
                  {p.name} · {roleLabel(
                    s.assignments[p.id]!.role,
                  )}{#if !p.connected}
                    · {m.cn_offline()}{/if}
                </p>{/each}
            </details>{/each}
        </div>
        <div class="clue-strip">
          <span class="stamp">{m.cn_turn({ turn: s.turn })}</span
          >{#if s.clue}<strong>{s.clue.word}</strong><b
              >{s.clue.count === 'unlimited' ? '∞' : s.clue.count}</b
            >{:else}<span>{phaseLabel}</span>{/if}
        </div>
        {#if mine?.role === 'spymaster' && s.phase !== 'finished'}<p
            class="key-badge"
          >
            ◈ {m.cn_secret()}
          </p>{:else}<p class="key-badge">
            {mine ? `${teamLabel(mine.team)} · ${roleLabel(mine.role)}` : ''}
          </p>{/if}
        <div class="word-grid" aria-label={m.cn_title()}>
          {#each s.board as card}{@const identity =
              card.identity ??
              view.private.key?.[card.index]}{@const available =
              !card.revealed &&
              (guessing || (penalizing && identity === mine?.team))}
            <button
              class="dossier {identity ?? 'unknown'}"
              class:revealed={card.revealed}
              class:selected={selected === card.index}
              class:key={!!identity && !card.revealed}
              data-card={card.index}
              data-identity={identity}
              disabled={disabled || !available}
              aria-label={`${card.word}${identity ? ` · ${identityLabel(identity)} · ${card.revealed ? m.cn_revealed() : m.cn_unrevealed()}` : ''}`}
              aria-pressed={selected === card.index}
              onclick={() => choose(card.index)}
            >
              <span class="file-number" aria-hidden="true"
                >{String(card.index + 1).padStart(2, '0')} / CN</span
              ><strong>{card.word}</strong>
              {#if identity}<span class="identity"
                  ><svg viewBox="0 0 24 24" aria-hidden="true"
                    >{#if identity === 'assassin'}<path
                        d="M5 4h14v11l-7 6-7-6zm3 4 8 7m0-7-8 7"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      />{:else if identity === 'civilian'}<circle
                        cx="12"
                        cy="7"
                        r="4"
                        fill="currentColor"
                      /><path
                        d="M4 21q0-10 8-10t8 10"
                        fill="currentColor"
                      />{:else}<path
                        d="M5 8h14l-3-5H8zm1 2h12v4h-4l-2-2-2 2H6zm-3 12 4-6h10l4 6"
                        fill="currentColor"
                      />{/if}</svg
                  ><span>{identityLabel(identity)}</span
                  >{#if card.revealed}<span aria-hidden="true">✓</span
                    >{/if}</span
                >{:else}<span class="file-line" aria-hidden="true"></span>{/if}
            </button>{/each}
        </div>
        <section class="controls">
          {#if s.result}<div class="result" role="status">
              <h2>{m.cn_winner({ team: teamLabel(s.result.team) })}</h2>
              <p>
                {s.result.reason === 'assassin'
                  ? m.cn_win_assassin()
                  : m.cn_win_agents()}
              </p>
              {#if canRematch}<button
                  class="primary"
                  {disabled}
                  onclick={() => {
                    gesture();
                    void rematch();
                  }}>{m.cn_rematch()}</button
                >{/if}
            </div>
          {:else if composing}<form
              onsubmit={(e) => {
                e.preventDefault();
                void act({
                  type: 'submitClue',
                  word,
                  count: count === 'unlimited' ? 'unlimited' : Number(count),
                });
                word = '';
              }}
            >
              <div class="composer">
                <label
                  >{m.cn_word()}<input
                    bind:value={word}
                    maxlength="160"
                    required
                    {disabled}
                  /></label
                ><label
                  >{m.cn_count()}<select
                    aria-label={m.cn_count()}
                    bind:value={count}
                    {disabled}
                    >{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'unlimited'] as c}<option
                        value={c}>{c === 'unlimited' ? '∞' : c}</option
                      >{/each}</select
                  ></label
                ><button class="primary" disabled={disabled || !word.trim()}
                  >{m.cn_submit()}</button
                >
              </div>
              {#if warning}<p class="warning">{m.cn_warning()}</p>{/if}
              <p class="hint">{m.cn_count_hint()}</p>
            </form>
          {:else if reviewing}<p>{m.cn_review_hint()}</p>
            <div class="action-row">
              <button
                class="primary"
                {disabled}
                onclick={() => act({ type: 'reviewClue', allow: true })}
                >{m.cn_allow()}</button
              ><button
                {disabled}
                onclick={() => act({ type: 'reviewClue', allow: false })}
                >{m.cn_reject()}</button
              >
            </div>
          {:else if guessing}<div class="action-row">
              <p>
                {m.cn_budget({
                  used: s.used,
                  limit: s.budget.kind === 'unlimited' ? '∞' : s.budget.cap,
                })}
              </p>
              <button
                disabled={disabled || s.used < 1}
                onclick={() => act({ type: 'endTurn' })}>{m.cn_end()}</button
              >
            </div>
            <p class="hint">
              {s.used < 1 ? m.cn_first() : m.cn_operative_hint()}
            </p>
          {:else if penalizing}<p>{m.cn_penalty()}</p>
            <button
              {disabled}
              onclick={() => act({ type: 'takePenalty', card: null })}
              >{m.cn_skip()}</button
            >
          {:else}<p class="hint">
              {mine?.role === 'spymaster'
                ? m.cn_spymaster_hint()
                : m.cn_operative_hint()}
            </p>
            <p class="hint waiting" role="status">
              {m.cn_wait({
                players: responsiblePlayers.map((p) => p.name).join(' · '),
                team: teamLabel(responsibleTeam),
                role: roleLabel(responsibleRole),
              })}
            </p>
            {#each responsiblePlayers.filter((p) => !p.connected) as p}<p
                class="hint"
              >
                {p.name} · {p.reservedUntil
                  ? m.cn_reserved({
                      time: new Intl.DateTimeFormat(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(p.reservedUntil),
                    })
                  : m.cn_vacant()}
              </p>{/each}{/if}
          <div class="confirmation" aria-live="polite">
            {#if selected !== null && s.board[selected] && (guessing || penalizing)}<div
              >
                <small>{m.cn_selected()}</small><strong
                  >{s.board[selected]!.word}</strong
                >
              </div>
              <button
                class="primary"
                {disabled}
                onclick={() =>
                  act({
                    type: penalizing ? 'takePenalty' : 'guess',
                    card: selected,
                  })}>{m.cn_reveal({ word: s.board[selected]!.word })}</button
              ><button onclick={() => (selected = null)}>{m.cn_cancel()}</button
              >{/if}
          </div>
        </section>
      </main>
      <aside class="side blue">
        <h2>{m.cn_blue()}</h2>
        <strong>{s.remaining.blue}</strong>
        <p>{m.cn_remaining({ count: s.remaining.blue })}</p>
        {#each players.filter((p) => s.assignments[p.id]?.team === 'blue') as p}<p
            class:offline={!p.connected}
          >
            {p.name}<small>{roleLabel(s.assignments[p.id]!.role)}</small>
          </p>{/each}
      </aside>
    </div>
  {/if}
  <span class="sr-only" aria-live="polite"
    >{s.events.map(eventLabel).join(' ')}</span
  >
</section>
<dialog
  bind:this={dialog}
  onclose={() => {
    panel = null;
    opener?.focus();
  }}
  oncancel={close}
  aria-label={panel === 'rules' ? m.cn_rules() : m.cn_settings()}
>
  <header>
    <h2>{panel === 'rules' ? m.cn_rules() : m.cn_settings()}</h2>
    <button aria-label={m.cn_close()} onclick={close}>×</button>
  </header>
  {#if panel === 'rules'}<Rulebook />{:else if panel === 'settings'}<div
      class="preferences"
    >
      <label
        ><input
          type="checkbox"
          bind:checked={sound}
          onchange={gesture}
        />{m.cn_sound()}</label
      ><label
        >{m.cn_volume()}<input
          type="range"
          min="0"
          max="1"
          step=".05"
          bind:value={volume}
        /></label
      ><label
        ><input type="checkbox" bind:checked={reduced} />{m.cn_motion()}</label
      >
    </div>
    {@render settingsContent?.()}
    <h3>{m.cn_roster()}</h3>
    <ul>
      {#each players as p}<li>
          {p.name} · {s.assignments[p.id]
            ? `${teamLabel(s.assignments[p.id]!.team)} / ${roleLabel(s.assignments[p.id]!.role)}`
            : m.cn_unassigned()}{#if !p.connected}
            · {m.cn_offline()}{/if}
        </li>{/each}
    </ul>
    <h3>{m.cn_history()}</h3>
    {#if !s.history.length}<p>{m.cn_empty_history()}</p>{/if}
    <ol class="history">
      {#each [...s.history].reverse() as event}<li>
          {eventLabel(event)}
        </li>{/each}
    </ol>{/if}
</dialog>

<style>
  :global(body:has(.cn-table) .site-header) {
    display: none;
  }
  :global(body:has(.cn-table)) {
    background: #30251e;
    color: #f5eedc;
    margin: 0;
  }
  .cn-table {
    --paper: #f5eedc;
    --ink: #182631;
    --brass: #b88b47;
    box-sizing: border-box;
    height: 100dvh;
    overflow-y: auto;
    min-height: 100dvh;
    padding: max(18px, env(safe-area-inset-top))
      max(18px, env(safe-area-inset-right))
      max(12px, env(safe-area-inset-bottom))
      max(18px, env(safe-area-inset-left));
    background:
      radial-gradient(ellipse at 50% 25%, #574235, transparent 70%),
      repeating-linear-gradient(0deg, #f5eedc04 0 1px, transparent 1px 4px),
      repeating-linear-gradient(92deg, #08040112 0 1px, transparent 1px 28px),
      #30251e;
    color: var(--paper);
    font-family: var(--font-body, Arial, sans-serif);
  }
  button,
  input,
  select {
    font: inherit;
  }
  button {
    cursor: pointer;
    border: 1px solid #b8a687;
    border-radius: 5px;
    padding: 0.65rem 0.9rem;
    min-height: 44px;
    background: #f5eedc;
    color: #182631;
  }
  button:disabled {
    cursor: default;
  }
  button:not(.dossier):disabled {
    opacity: 0.48;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 3px solid #ffc866;
    outline-offset: 3px;
  }
  .corner {
    position: absolute;
    z-index: 2;
    top: max(16px, env(safe-area-inset-top));
    background: #453429;
    color: #f5eedc;
    border-color: #8c815f;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .manual {
    left: max(18px, env(safe-area-inset-left));
    font-size: 0.8rem;
  }
  .manual svg {
    width: 28px;
    height: 28px;
  }
  .gear {
    right: max(18px, env(safe-area-inset-right));
    font-size: 1.65rem;
    width: 48px;
    justify-content: center;
    padding: 0.25rem;
  }
  .masthead {
    text-align: center;
    margin: 0 130px 20px;
  }
  .masthead p {
    font-size: 0.64rem;
    letter-spacing: 0.22em;
    color: #d5bb90;
    margin: 0 0 0.4rem;
  }
  .masthead h1 {
    overflow-wrap: anywhere;
    font-family: Georgia, serif;
    font-weight: 400;
    font-size: clamp(1.4rem, 2.3vw, 2.1rem);
    letter-spacing: 0.06em;
    margin: 0;
  }
  .setup {
    max-width: 850px;
    margin: 3vh auto;
    text-align: center;
  }
  .setup h2 {
    font:
      2rem Georgia,
      serif;
  }
  .intro {
    max-width: 640px;
    margin: 0 auto 2rem;
    line-height: 1.6;
    color: #ded7c7;
  }
  .teams {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }
  .team-panel {
    padding: 1.2rem;
    background: #f5eedc;
    color: #182631;
    border-radius: 8px;
    border-top: 8px solid #a93645;
    box-shadow: 0 7px 0 #0002;
  }
  .team-panel.blue {
    border-color: #245c97;
  }
  .team-panel h3 {
    font:
      1.5rem Georgia,
      serif;
    margin: 0.1rem 0 1rem;
  }
  .role-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .role-actions button {
    flex: 1;
    font-size: 0.85rem;
    background: #e9dec8;
  }
  .role-actions button[aria-pressed='true'] {
    background: #182631;
    color: #fff;
  }
  .team-panel ul {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    min-height: 90px;
    text-align: left;
  }
  .team-panel li {
    padding: 0.55rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    border-top: 1px solid #c9bda5;
  }
  .team-panel li span,
  .team-panel small {
    font-size: 0.8rem;
  }
  .unassigned,
  .hint {
    font-size: 0.82rem;
    color: #d6cebd;
    line-height: 1.5;
  }
  .agreements {
    font-size: 0.83rem;
    margin: 1.4rem auto;
    line-height: 1.4;
  }
  .agreements p {
    margin: 0.35rem;
  }
  .primary {
    background: #e8c27f;
    border-color: #f1d397;
    color: #182631;
    font-weight: 700;
  }
  .operation {
    display: grid;
    grid-template-columns: minmax(115px, 1fr) minmax(0, 860px) minmax(
        115px,
        1fr
      );
    gap: 26px;
    max-width: 1390px;
    margin: auto;
    align-items: start;
  }
  .side {
    margin-top: 105px;
    border-top: 3px solid #cf6470;
    padding: 1rem 0;
  }
  .side.blue {
    border-color: #78a7da;
  }
  .side h2 {
    font:
      1.15rem Georgia,
      serif;
  }
  .side > strong {
    font:
      3.5rem Georgia,
      serif;
  }
  .side > p {
    font-size: 0.83rem;
    line-height: 1.35;
  }
  .side small {
    display: block;
    font-size: 0.7rem;
    color: #d3c5ad;
    margin-top: 0.2rem;
  }
  .offline {
    opacity: 0.6;
  }
  .phase {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    font-size: 0.85rem;
  }
  .phase > span:last-child {
    color: #cfc9bc;
  }
  .team-dot {
    width: 9px;
    height: 9px;
    background: #e47883;
    border-radius: 50%;
  }
  .team-dot.blue {
    background: #7bacdf;
  }
  .clue-strip {
    margin: 12px 0 0;
    min-height: 55px;
    box-sizing: border-box;
    padding: 0.55rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: #211a14cc;
    border: 1px solid #94846766;
    border-radius: 5px;
    overflow-wrap: anywhere;
  }
  .clue-strip strong {
    font:
      1.5rem Georgia,
      serif;
  }
  .clue-strip b {
    font:
      1.5rem Georgia,
      serif;
    color: #edc88a;
  }
  .stamp {
    font-size: 0.66rem;
    text-transform: uppercase;
    color: #c0b291;
    letter-spacing: 0.08em;
  }
  .key-badge {
    text-align: center;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    margin: 10px 0;
    color: #e1c38f;
    min-height: 14px;
  }
  .word-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 9px;
  }
  .dossier {
    aspect-ratio: 2;
    min-width: 0;
    padding: 7px 9px 5px;
    background: #f5eedc;
    border: 1px solid #d4c6a9;
    box-shadow:
      0 3px 0 #b5a68b,
      0 5px 9px #0003;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    position: relative;
    color: #182631;
    min-height: 65px;
    transition:
      transform 120ms,
      outline-color 120ms;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .dossier:disabled {
    opacity: 1;
  }
  .dossier.unknown:hover:enabled {
    background: #f5eedc;
  }
  .primary:hover:enabled {
    background: #f1d397;
  }
  .corner:hover:enabled {
    background: #604a38;
  }
  .dossier strong {
    font-size: clamp(0.78rem, 1.35vw, 1.2rem);
    font-weight: 700;
    line-height: 1.15;
    max-width: 100%;
  }
  .dossier:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .dossier.selected {
    outline: 3px solid #f1c46f;
    outline-offset: 3px;
    transform: translateY(-2px);
  }
  .file-number {
    align-self: flex-start;
    letter-spacing: 0.1em;
    font-size: 0.45rem;
    color: #746954;
  }
  .file-line {
    width: 40%;
    height: 1px;
    margin: 4px;
    background: #c5b798;
  }
  .identity {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 0.55rem;
    line-height: 1;
    min-height: 16px;
  }
  .identity svg {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
  }
  .dossier.key.red {
    background: linear-gradient(135deg, #fff0e2 70%, #edc2c5 70%);
    border-color: #bc6470;
  }
  .dossier.key.blue {
    background: linear-gradient(135deg, #eff3ed 70%, #c0d5e5 70%);
    border-color: #6d99c2;
  }
  .dossier.key.civilian {
    background: repeating-linear-gradient(
      135deg,
      #f5eedc 0 10px,
      #e9e0cb 10px 11px
    );
  }
  .dossier.key.assassin {
    background: #c9cacc;
    border: 2px solid #202733;
  }
  .dossier.revealed {
    box-shadow: 0 2px 0 #0005;
  }
  .dossier.revealed.red {
    background: #97303d;
    color: #fff4e4;
    border-color: #d38388;
  }
  .dossier.revealed.blue {
    background: #235181;
    color: #fff4e4;
    border-color: #78a5d0;
  }
  .dossier.revealed.civilian {
    background: #cbbfa5;
    color: #182631;
  }
  .dossier.revealed.assassin {
    background: #111820;
    color: #f5eedc;
    border-color: #a9a79f;
  }
  .dossier.revealed .file-number {
    color: inherit;
    opacity: 0.75;
  }
  .controls {
    margin-top: 16px;
    text-align: center;
  }
  .composer {
    display: flex;
    gap: 10px;
    align-items: end;
  }
  .composer label {
    display: grid;
    text-align: left;
    font-size: 0.75rem;
    gap: 4px;
  }
  .composer label:first-child {
    flex: 1;
    min-width: 0;
  }
  .composer input,
  .composer select {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    border: 1px solid #bfae8d;
    border-radius: 4px;
    background: #fbf4e5;
    color: #182631;
    padding: 0.5rem;
  }
  .composer button {
    font-size: 0.82rem;
  }
  .warning {
    background: #ead7b4;
    color: #382c1b;
    padding: 0.7rem;
    text-align: left;
    font-size: 0.8rem;
  }
  .action-row {
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
  }
  .action-row p {
    font-size: 0.85rem;
    margin: 0.3rem 0;
  }
  .controls > .hint {
    margin: 8px 0;
  }
  .confirmation {
    min-height: 74px;
    margin-top: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .confirmation:has(button) {
    background: #211a14;
    border: 1px solid #a99065;
    padding: 10px;
    border-radius: 7px;
  }
  .confirmation div {
    display: grid;
    text-align: left;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .confirmation small {
    font-size: 0.65rem;
    color: #d6c296;
  }
  .confirmation strong {
    font:
      1.3rem Georgia,
      serif;
  }
  .confirmation button {
    font-size: 0.85rem;
  }
  .result h2 {
    font:
      1.6rem Georgia,
      serif;
    margin: 0.6rem;
  }
  .result p {
    font-size: 0.9rem;
  }
  .notice {
    padding: 0.7rem;
    background: #e8c27f;
    color: #182631;
    text-align: center;
  }
  .mobile-counters {
    display: none;
  }
  .mobile-counters details {
    flex: 1;
    min-width: 0;
  }
  .mobile-counters details:last-child {
    text-align: right;
  }
  .mobile-counters summary {
    cursor: pointer;
    min-height: 44px;
    overflow-wrap: anywhere;
  }
  .mobile-counters small {
    display: block;
    color: #d4c5ac;
    font-size: 0.65rem;
    line-height: 1.3;
    margin-top: 4px;
  }
  .mobile-counters p {
    font-size: 0.72rem;
  }
  dialog {
    box-sizing: border-box;
    background: #f5eedc;
    color: #182631;
    border: 1px solid #bca785;
    border-radius: 10px;
    width: min(850px, calc(100vw - 24px));
    max-height: 85dvh;
    padding: 24px;
  }
  dialog::backdrop {
    background: #17100bc9;
  }
  dialog header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    position: sticky;
    top: -24px;
    background: #f5eedc;
    z-index: 1;
  }
  dialog h2 {
    font:
      1.6rem Georgia,
      serif;
  }
  dialog header button {
    font-size: 1.5rem;
  }
  .preferences {
    display: grid;
    gap: 1rem;
    margin: 1rem 0 2rem;
  }
  .preferences label {
    min-height: 44px;
    cursor: pointer;
    display: flex;
    gap: 0.7rem;
    align-items: center;
  }
  .preferences input[type='range'] {
    flex: 1;
    min-height: 44px;
  }
  .preferences input[type='checkbox'] {
    width: 22px;
    height: 22px;
  }
  .history {
    font-size: 0.85rem;
    line-height: 1.7;
    padding-left: 1.2rem;
  }
  .sr-only {
    position: absolute;
    clip: rect(0, 0, 0, 0);
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  .reduced .dossier {
    transition: none;
  }
  .reduced .dossier:hover,
  .reduced .dossier.selected {
    transform: none;
  }
  @media (max-width: 1100px) {
    .operation {
      grid-template-columns: 1fr;
      max-width: 860px;
    }
    .side {
      display: none;
    }
    .mobile-counters {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      margin: 10px 0;
    }
    .masthead {
      margin-bottom: 18px;
    }
  }
  @media (max-width: 600px) {
    .cn-table {
      padding-left: max(12px, env(safe-area-inset-left));
      padding-right: max(12px, env(safe-area-inset-right));
    }
    .masthead {
      margin: 2px 50px 20px;
    }
    .masthead p {
      font-size: 0.46rem;
      letter-spacing: 0.08em;
    }
    .masthead h1 {
      overflow-wrap: anywhere;
      font-size: 1.35rem;
    }
    .manual {
      left: 12px;
      padding: 6px;
    }
    .manual span {
      display: none;
    }
    .gear {
      right: 12px;
    }
    .teams {
      gap: 10px;
    }
    .team-panel {
      padding: 0.7rem;
    }
    .team-panel h3 {
      font-size: 1.2rem;
    }
    .role-actions {
      display: grid;
    }
    .team-panel li {
      display: grid;
    }
    .setup {
      margin: 0 auto;
    }
    .setup h2 {
      font-size: 1.5rem;
    }
    .intro {
      font-size: 0.85rem;
    }
    .word-grid {
      gap: 6px;
    }
    .dossier {
      min-height: 64px;
      aspect-ratio: 1;
      padding: 5px 3px 3px;
    }
    .dossier:disabled {
      opacity: 1;
    }
    .dossier.unknown:hover:enabled {
      background: #f5eedc;
    }
    .primary:hover:enabled {
      background: #f1d397;
    }
    .corner:hover:enabled {
      background: #604a38;
    }
    .dossier strong {
      font-size: 0.76rem;
    }
    .file-number {
      font-size: 0.35rem;
    }
    .identity {
      font-size: 0.46rem;
      gap: 1px;
      min-height: 17px;
      flex-wrap: wrap;
    }
    .identity svg {
      width: 13px;
      height: 13px;
    }
    .clue-strip {
      min-height: 48px;
      margin-top: 7px;
      gap: 0.5rem;
      padding: 0.4rem;
    }
    .clue-strip strong {
      font-size: 1.25rem;
    }
    .phase {
      font-size: 0.75rem;
      gap: 0.35rem;
    }
    .key-badge {
      font-size: 0.53rem;
      margin: 8px 0;
    }
    .controls {
      margin-top: 12px;
    }
    .composer {
      flex-wrap: wrap;
      gap: 7px;
    }
    .composer button {
      width: 100%;
    }
    .composer label:first-child {
      min-width: 65%;
    }
    .composer label:nth-child(2) {
      flex: 1;
    }
    .hint {
      font-size: 0.75rem;
    }
    .confirmation {
      min-height: 66px;
      gap: 7px;
    }
    .confirmation div {
      width: 100%;
      text-align: center;
    }
    .confirmation button {
      font-size: 0.78rem;
    }
    .agreements {
      font-size: 0.75rem;
    }
    .mobile-counters {
      margin: 7px 0;
    }
    .result h2 {
      font-size: 1.3rem;
    }
    dialog {
      padding: 18px;
    }
    dialog header {
      top: -18px;
    }
  }
  @media (max-width: 350px) {
    .cn-table {
      padding-left: 10px;
      padding-right: 10px;
    }
    .word-grid {
      gap: 5px;
    }
    .dossier {
      min-height: 60px;
    }
    .dossier:disabled {
      opacity: 1;
    }
    .dossier.unknown:hover:enabled {
      background: #f5eedc;
    }
    .primary:hover:enabled {
      background: #f1d397;
    }
    .corner:hover:enabled {
      background: #604a38;
    }
    .dossier strong {
      font-size: 0.7rem;
    }
    .identity span {
      font-size: 0.42rem;
    }
    .setup .teams {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dossier {
      transition: none;
    }
    .dossier:not(:disabled):hover {
      transform: none;
    }
  }
</style>
