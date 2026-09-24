<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { View, Role, Power, Symbol, Event } from './types.js';
  import Badge from './Badge.svelte';
  import Paper from './table/Paper.svelte';
  import PlayerToken from './table/PlayerToken.svelte';
  import SideSheet from './table/SideSheet.svelte';
  import Outcome from './table/Outcome.svelte';
  import BallotReview from './table/BallotReview.svelte';
  import { seatPosition } from './table/layout.js';
  import { eventGate, readJson, write } from '@board-games/shared/ui';
  import { prefersReducedMotion } from 'svelte/motion';
  import { soundEffects } from './effects.js';
  import {
    gameSkin,
    setGameSkin,
    type Skin,
  } from '@board-games/shared/ui/pixel';
  import { providePixel } from './pixel/context.js';
  import Sprite from './pixel/Sprite.svelte';
  import type { PixelCue } from './pixel/sound.js';
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
    rulesContent,
    canRematch = false,
    rematch = async () => {},
    errorCode = null,
  }: {
    view: View;
    playerId: string;
    players: { id: string; name: string; connected: boolean }[];
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
    mine = $derived(view.private),
    disabled = $derived(!connected || pending),
    living = $derived(s.players.filter((p) => !s.eliminated.includes(p)));
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const role = (id: Role) => m[`ls_${id}`]();
  const power = (id: Power) => m[`ls_${id}`]();
  const phaseLabel = $derived(m[`ls_${s.phase}`]());
  let ballotReview = $state<Extract<Event, { type: 'ballots' }> | null>(null);
  let clueText = $state('');
  let secret = $state(false),
    target = $state(''),
    symbol = $state<Symbol | ' '>(' '),
    answer = $state(''),
    localError = $state(''),
    busy = $state(false);
  let language = $state<'en' | 'es'>('en'),
    powers = $state(false),
    panel = $state<'rules' | 'settings' | null>(null);
  let dialog: HTMLDialogElement,
    root: HTMLElement,
    opener: HTMLElement | null = null;
  let sound = $state(true),
    reduced = $state(false),
    mounted = $state(false);
  const systemReduced = $derived(prefersReducedMotion.current);
  const audio = soundEffects(),
    animations = new Set<Animation>();
  // 8-bit skin: viewer-only. Its CSS and chiptune pack load only when chosen.
  let skin = $state<Skin>(gameSkin('little-secret')),
    pixelReady = $state(false),
    chip = $state<((cue: PixelCue) => void) | null>(null),
    stamped = $state<string[]>([]);
  $effect(() => {
    if (skin === 'pixel' && !pixelReady)
      void Promise.all([
        import('./pixel.css'),
        import('./pixel/sound.js'),
      ]).then(([, sound]) => {
        chip = sound.chiptune(audio.audio);
        pixelReady = true;
      });
  });
  const pixel = $derived(skin === 'pixel' && pixelReady);
  providePixel(() => pixel);
  const still = $derived(reduced || systemReduced);
  function cue(name: PixelCue) {
    if (pixel && sound && chip) chip(name);
  }
  /** One chiptune cue for a batch of accepted events, most dramatic first. */
  function pixelCue(events: Event[]): PixelCue {
    const score = events.find((e) => e.type === 'score');
    if (score?.type === 'score')
      return (score.points[playerId] ?? 0) > 0
        ? 'win'
        : s.result?.reason === 'survivors'
          ? 'escaped'
          : 'lose';
    const out = events.find((e) => e.type === 'elimination');
    if (out?.type === 'elimination')
      return out.role === 'disciple' ? 'vote' : 'caught';
    const guess = events.find((e) => e.type === 'guess');
    if (guess?.type === 'guess') return guess.correct ? 'win' : 'lose';
    if (events.some((e) => e.type === 'ballots')) return 'reveal';
    if (events.some((e) => e.type === 'deal')) return 'deal';
    return 'vote';
  }
  let lastSpeaker: string | null = null;
  $effect(() => {
    const speaker = s.speaker;
    untrack(() => {
      if (speaker && lastSpeaker && speaker !== lastSpeaker && mounted)
        cue('turn');
      lastSpeaker = speaker;
    });
  });
  function cancel() {
    for (const a of animations) a.cancel();
    animations.clear();
    audio.cancel();
  }
  const gate = eventGate<Event>(cancel);
  $effect(() => {
    s.mission;
    s.cycle;
    s.speaker;
    playerId;
    clueText = '';
  });
  const entitled = $derived(s.prompt?.actor === playerId);
  const choices = $derived(
    s.phase === 'tie' ? s.candidates : living.filter((p) => p !== playerId),
  );
  const choosing = $derived(
    !ballotReview &&
      !disabled &&
      !busy &&
      ((s.phase === 'vote' &&
        living.includes(playerId) &&
        !s.committed.includes(playerId)) ||
        (entitled &&
          (s.prompt?.kind === 'sage' || s.prompt?.kind === 'revenant'))),
  );
  const bannerLabel = $derived(ballotReview ? m.ls_ballots() : phaseLabel);
  function gesture() {
    if (sound) void audio.unlock();
  }
  async function act(action: unknown) {
    if (disabled || busy) return;
    gesture();
    busy = true;
    localError = '';
    try {
      await send(action);
      const type = (action as { type: string }).type;
      if (type === 'clue') cue('clue');
      else if (type === 'vote' || type === 'rps') cue('vote');
      else if (type !== 'guess') cue('select');
    } catch {
      localError = m.ls_error();
    } finally {
      busy = false;
    }
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
  $effect(() => {
    const version = s.setupVersion;
    untrack(() => {
      language = s.options.wordLanguage;
      powers = s.options.powers;
    });
  });
  $effect(() => {
    const identity = `${round}:${playerId}:${s.mission}`;
    untrack(() => {
      secret = false;
      ballotReview = null;
      answer = '';
      stamped = [];
    });
  });
  $effect(() => {
    const prompt = `${s.phase}:${s.prompt?.id}:${s.ballotId}:${s.rpsId}:${playerId}`;
    untrack(() => {
      target = '';
      symbol = ' ';
      answer = '';
      localError = '';
    });
  });
  $effect(() => {
    const online = connected,
      code = errorCode;
    untrack(() => {
      if (!online || code) {
        secret = false;
        ballotReview = null;
        gate.reset();
      }
    });
  });
  $effect(() => {
    const identity = `${round}:${playerId}`,
      sequence = s.actionSequence,
      events = s.events,
      online = connected;
    untrack(() => {
      const accepted = gate.consume(identity, sequence, events, online, s);
      if (!mounted || document.hidden) return;
      const reveal = accepted.find((e) => e.type === 'ballots');
      if (reveal?.type === 'ballots') ballotReview = reveal;
      stamped = accepted.flatMap((e) =>
        e.type === 'elimination' ? [e.player] : [],
      );
      if (accepted.length && !reduced && !systemReduced && root?.animate) {
        const a = root.animate([{ opacity: 0.82 }, { opacity: 1 }], {
          duration: 240,
        });
        animations.add(a);
        a.onfinish = () => animations.delete(a);
      }
      if (sound && accepted.length) {
        if (pixel && chip) chip(pixelCue(accepted));
        else
          audio.play(
            0.35,
            accepted.some((e) => e.type === 'score') ? 'finish' : 'reveal',
          );
      }
    });
  });
  $effect(() => {
    const motion = reduced || systemReduced;
    untrack(cancel);
  });
  $effect(() => {
    if (mounted) {
      write('little-secret:preferences', { sound, reduced });
      if (!sound) audio.cancel();
    }
  });
  onMount(() => {
    const p = readJson('little-secret:preferences');
    sound = p.sound !== false;
    reduced = p.reduced === true;
    const hide = () => {
      secret = false;
      ballotReview = null;
      gate.reset();
    };
    document.addEventListener('visibilitychange', hide);
    mounted = true;
    return () => {
      cancel();
      audio.dispose();
      document.removeEventListener('visibilitychange', hide);
    };
  });
</script>

<section
  class="ls-table"
  class:px-tokens={pixel}
  class:ls-pixel={pixel}
  class:still={pixel && still}
  class:result-stage={!!s.result && !ballotReview}
  class:dense={players.length > 6}
  data-testid="little-secret-board"
  data-phase={s.phase}
  bind:this={root}
>
  <nav class="corners" aria-label={m.ls_settings()}>
    <button
      onclick={(e) => open('rules', e.currentTarget)}
      aria-label={m.ls_rules()}
      >?<span class="sr-only">{m.ls_rules()}</span></button
    >
    <button
      aria-label={m.ls_settings()}
      onclick={(e) => open('settings', e.currentTarget)}>⚙</button
    >
  </nav>
  <header class="brand-note">
    <h1 aria-label="Little Secret">
      {#each ['LITTLE', 'SECRET'] as word}<span class="brand-line"
          >{#each [...word] as letter, i}<b
              style={`--letter-tilt:${[-7, 4, -2, 6, -4, 2][i]}deg`}>{letter}</b
            >{/each}</span
        >{/each}
    </h1>
    <p>{practice ? m.ls_practice() : m.ls_briefing()}</p>
    {#if pixel}<span class="brand-cat"
        ><Sprite
          sheet="mascot"
          frame={s.result?.winners.length
            ? 'cheer'
            : s.result || ballotReview
              ? 'look'
              : secret
                ? 'shh'
                : 'idle'}
          scale={2}
        /></span
      >{/if}
  </header>
  <div class="phase-banner">
    <Paper kind="banner"
      ><h2 aria-live="polite">{bannerLabel}</h2>
      <span
        >{m.ls_mission({ number: s.mission })} · {m.ls_table_cycle({
          number: s.cycle || 1,
        })}</span
      ></Paper
    >
  </div>
  {#if !connected || localError}<p class="notice" role="alert">
      {!connected ? m.ls_offline() : localError}
    </p>{/if}
  <div class="table-layout">
    <div class="seats" aria-label={m.ls_actor()}>
      {#each players as p, i}<article
          class="seat"
          class:out={s.eliminated.includes(p.id)}
          class:active={s.speaker === p.id}
          class:own={p.id === playerId}
          class:selected={target === p.id && choosing}
          class:winner={!!s.result &&
            (s.result.winners.length
              ? s.result.winners.includes(p.id)
              : s.result.points[p.id] > 0)}
          style={seatPosition(players.length, i)}
        >
          <div class="seat-top">
            {#if choosing && choices.includes(p.id)}<button
                class="seat-choice"
                aria-label={`${m.ls_choose()}: ${p.name}`}
                aria-pressed={target === p.id}
                onclick={() => {
                  gesture();
                  target = p.id;
                  cue('select');
                }}
                ><PlayerToken
                  name={p.name}
                  seat={i + 1}
                  active={s.speaker === p.id || target === p.id}
                  muted={s.eliminated.includes(p.id)}
                /></button
              >
            {:else}<PlayerToken
                name={p.name}
                seat={i + 1}
                active={s.speaker === p.id ||
                  (!!s.result &&
                    (s.result.winners.length
                      ? s.result.winners.includes(p.id)
                      : s.result.points[p.id] > 0))}
                muted={s.eliminated.includes(p.id)}
              />{/if}
            {#if s.powers[p.id]}<span
                class="power-badge"
                role="img"
                aria-label={power(s.powers[p.id]!)}
                title={power(s.powers[p.id]!)}
                ><Badge power={s.powers[p.id]!} /></span
              >{/if}
          </div>
          <div class="name-slip">
            <Paper kind="slip"><strong title={p.name}>{p.name}</strong></Paper>
          </div>
          {#if s.clues[p.id] !== undefined}<div class="clue-slip">
              <Paper kind="slip">
                <!-- svelte-ignore a11y_no_noninteractive_tabindex (Long clue slips need keyboard scrolling without moving seats.) -->
                <span
                  class="clue-strip"
                  tabindex="0"
                  role="region"
                  aria-label={`${p.name} · ${m.ls_clues()}`}
                  >{s.powers[p.id] === 'mime'
                    ? m.ls_table_mimed()
                    : s.clues[p.id]}</span
                ></Paper
              >
            </div>{/if}
          <small class="seat-score"
            >{m.ls_score({ points: s.scores[p.id] ?? 0 })}{p.id === playerId
              ? ' ◆'
              : ''}</small
          >
          {#if s.result || s.revealed[p.id]}<small
              class="role-stamp"
              class:drop={pixel && stamped.includes(p.id)}
              >{#if pixel}<Sprite
                  sheet="icons"
                  frame={s.result?.roles[p.id] ?? s.revealed[p.id]!}
                />{/if}{role(s.result?.roles[p.id] ?? s.revealed[p.id]!)}</small
            >{/if}
          {#if !p.connected}<small class="status-stamp">{m.ls_offline()}</small
            >{/if}
          {#if (s.phase === 'setup' && s.ready.includes(p.id)) || (s.phase === 'vote' && s.committed.includes(p.id)) || (s.phase === 'tie' && s.rpsCommitted.includes(p.id)) || (s.phase === 'missionResult' && s.continued.includes(p.id))}<small
              class="commit-mark"
              aria-label={m.ls_committed()}>✓</small
            >{/if}
        </article>{/each}
    </div>
    <main class="action-area" aria-label={bannerLabel}>
      <Paper taped>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll the bounded action panel.) -->
        <div
          class="action-scroll"
          tabindex="0"
          role="region"
          aria-label={bannerLabel}
        >
          {#if ballotReview}<BallotReview
              ballot={ballotReview}
              {players}
              close={() => (ballotReview = null)}
            />{:else}
            {#if s.phase === 'setup'}
              <p>{m.ls_conversation()}</p>
              <label
                >{m.ls_language()}<select
                  aria-label={m.ls_language()}
                  bind:value={language}
                  disabled={!canConfigure || disabled}
                  ><option value="en">English</option><option value="es"
                    >Español</option
                  ></select
                ></label
              >
              <label class="check"
                ><input
                  type="checkbox"
                  bind:checked={powers}
                  disabled={!canConfigure || disabled || players.length < 6}
                />{m.ls_powers()}</label
              >
              {#if canConfigure}<button
                  disabled={disabled ||
                    busy ||
                    (language === s.options.wordLanguage &&
                      powers === s.options.powers)}
                  onclick={() =>
                    act({
                      type: 'configure',
                      version: s.setupVersion,
                      options: { wordLanguage: language, powers },
                    })}>{m.ls_save()}</button
                >{/if}
              <button
                class="primary"
                disabled={disabled ||
                  busy ||
                  s.ready.includes(playerId) ||
                  s.connectedPlayers.length !== s.players.length ||
                  language !== s.options.wordLanguage ||
                  powers !== s.options.powers}
                onclick={() => act({ type: 'ready', version: s.setupVersion })}
                >{m.ls_ready()}</button
              >
            {:else if s.phase === 'volunteer'}<p>{m.ls_uncertain()}</p>
              <button
                class="primary"
                disabled={disabled || busy}
                onclick={() => act({ type: 'volunteer', mission: s.mission })}
                >{m.ls_volunteer_action()}</button
              >
            {:else if s.phase === 'clues'}<p class="speaker-label">
                <span>{m.ls_speaker()}</span><strong>{name(s.speaker!)}</strong>
              </p>
              {#if s.powers[playerId]}<p>
                  {m[`ls_${s.powers[playerId]!}_hint`]()}
                </p>{/if}{#if s.speaker === playerId}{#if s.powers[playerId] !== 'mime'}<input
                    aria-label={m.ls_table_clue()}
                    placeholder={m.ls_table_clue()}
                    maxlength={80}
                    bind:value={clueText}
                    autocomplete="off"
                    disabled={disabled || busy}
                  />{/if}<button
                  class="primary"
                  disabled={disabled ||
                    busy ||
                    (s.powers[playerId] !== 'mime' && !clueText.trim())}
                  onclick={() =>
                    act({
                      type: 'clue',
                      text: clueText,
                      mission: s.mission,
                      cycle: s.cycle,
                    })}>{m.ls_clue_action()}</button
                >{/if}
            {:else if s.phase === 'debate'}<p>{m.ls_conversation()}</p>
              {#if s.powers[playerId] === 'novice'}<p>
                  {m.ls_novice_hint()}
                </p>{/if}{#if canConfigure}<button
                  class="primary"
                  disabled={disabled || busy}
                  onclick={() =>
                    act({
                      type: 'openVote',
                      mission: s.mission,
                      cycle: s.cycle,
                    })}>{m.ls_open_vote()}</button
                >{/if}
            {:else if s.phase === 'vote' && living.includes(playerId) && !s.committed.includes(playerId)}
              <label
                >{m.ls_choose()}<select
                  aria-label={m.ls_choose()}
                  bind:value={target}
                  disabled={disabled || busy}
                  ><option value="">—</option>{#each choices as id}<option
                      value={id}>{name(id)}</option
                    >{/each}</select
                ></label
              ><button
                class="primary"
                disabled={disabled || busy || !target}
                onclick={() =>
                  act({ type: 'vote', ballotId: s.ballotId, target })}
                >{m.ls_confirm_vote()}</button
              >
            {:else if s.phase === 'tie' && !s.prompt && s.candidates.includes(playerId) && !s.rpsCommitted.includes(playerId)}
              <div class="symbols">
                {#each ['rock', 'paper', 'scissors'] as value}<button
                    aria-pressed={symbol === value}
                    disabled={disabled || busy}
                    onclick={() => {
                      gesture();
                      symbol = value as Symbol;
                      cue('select');
                    }}
                    >{#if pixel}<Sprite
                        sheet="icons"
                        frame={value}
                        scale={2}
                      />{/if}{m[`ls_${value as Symbol}`]()}</button
                  >{/each}
              </div>
              <button
                class="primary"
                disabled={disabled || busy || symbol === ' '}
                onclick={() => act({ type: 'rps', rpsId: s.rpsId, symbol })}
                >{m.ls_confirm_rps()}</button
              >
            {:else if entitled && s.prompt?.kind === 'journalist'}
              <p>{m.ls_guess_hint()}</p>
              <form
                onsubmit={(e) => {
                  e.preventDefault();
                  void act({ type: 'guess', promptId: s.prompt!.id, answer });
                }}
              >
                <label
                  >{m.ls_answer()}<input
                    bind:value={answer}
                    maxlength="120"
                    autocomplete="off"
                    disabled={disabled || busy}
                  /></label
                ><button
                  class="primary"
                  disabled={disabled || busy || !answer.trim()}
                  >{m.ls_confirm_guess()}</button
                >
              </form>
            {:else if entitled && (s.prompt?.kind === 'sage' || s.prompt?.kind === 'revenant')}
              <p>{m[`ls_${s.prompt.kind}_hint`]()}</p>
              <label
                >{m.ls_choose()}<select
                  aria-label={m.ls_choose()}
                  bind:value={target}
                  disabled={disabled || busy}
                  ><option value="">—</option>{#each choices as id}<option
                      value={id}>{name(id)}</option
                    >{/each}</select
                ></label
              ><button
                class="primary"
                disabled={disabled || busy || !target}
                onclick={() =>
                  act({
                    type: s.prompt!.kind === 'sage' ? 'resolveTie' : 'revenant',
                    promptId: s.prompt!.id,
                    target,
                  })}>{m.ls_confirm_target()}</button
              >{#if s.prompt.kind === 'revenant'}<button
                  disabled={disabled || busy}
                  onclick={() =>
                    act({
                      type: 'revenant',
                      promptId: s.prompt!.id,
                      target: null,
                    })}>{m.ls_decline()}</button
                >{/if}
            {:else if s.result}
              <Outcome state={s} {players} />
              {#if s.result.winners.length}<p>
                  <strong
                    >{m.ls_winners()}: {s.result.winners
                      .map(name)
                      .join(', ')}</strong
                  >
                </p>
                {#if canRematch}<button
                    class="primary"
                    disabled={disabled || busy}
                    onclick={() => rematch()}>{m.ls_rematch()}</button
                  >{/if}{:else}<button
                  class="primary"
                  disabled={disabled || busy || s.continued.includes(playerId)}
                  onclick={() => act({ type: 'continue', mission: s.mission })}
                  >{m.ls_continue()}</button
                >{/if}
            {:else}<p>{m.ls_wait()}</p>{/if}
            {#if s.prompt && !entitled}<p>
                {name(s.prompt.actor)} · {m.ls_wait()}
              </p>{/if}

            {#if s.phase !== 'setup' && !s.result}<aside class="envelope">
                <button
                  aria-expanded={secret}
                  onclick={() => {
                    gesture();
                    secret = !secret;
                    cue(secret ? 'open' : 'select');
                  }}
                  >{secret ? m.ls_conceal() : m.ls_reveal()}
                  {#if pixel}<Sprite
                      sheet="envelope"
                      frame={secret ? 'open' : 'closed'}
                      scale={1.5}
                    />{:else}<svg
                      class="envelope-mark"
                      viewBox="0 0 64 44"
                      aria-hidden="true"
                      ><rect
                        x="2"
                        y="2"
                        width="60"
                        height="40"
                        rx="2"
                        fill="#f6e9ca"
                        stroke="#a38960"
                      /><path
                        d="M2 2l30 25L62 2M2 42l20-17m40 17L42 25"
                        fill="none"
                        stroke="#a38960"
                      /><circle cx="32" cy="27" r="9" fill="#823f3b" /><path
                        d="M26 27q6-8 12 0-6 8-12 0z"
                        fill="none"
                        stroke="#e1ba75"
                      /></svg
                    >{/if}</button
                >{#if secret}<div
                    class="letter"
                    data-testid="own-secret"
                    {@attach (el) => {
                      if (pixel) el.scrollIntoView({ block: 'nearest' });
                    }}
                  >
                    <h3>{m.ls_envelope()}</h3>
                    <strong class="password"
                      >{mine.role === 'journalist'
                        ? m.ls_no_word()
                        : mine.password}</strong
                    >{#if mine.solution}<h4>{m.ls_solution()}</h4>
                      <p>
                        {m.ls_password()}: {mine.solution.password}<br
                        />{m.ls_alternative()}: {mine.solution.alternative}
                      </p>
                      <ul>
                        {#each players as p}<li>
                            {p.name}: {role(mine.solution.roles[p.id]!)}
                          </li>{/each}
                      </ul>{/if}
                  </div>{/if}
              </aside>{/if}
          {/if}
        </div>
      </Paper>
    </main>
  </div>
  <SideSheet state={s} {players} onreview={(event) => (ballotReview = event)} />
  {#if pixel && !still && s.result?.winners.length && !ballotReview}<div
      class="px-confetti"
      aria-hidden="true"
    >
      {#each { length: 28 } as _, i}<i
          style={`--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.23}s;--t:${2.4 + (i % 5) * 0.35}s;--c:${['#f2c14e', '#c8453a', '#3f9a4a', '#2f6fce', '#f6e7c8'][i % 5]}`}
        ></i>{/each}
    </div>{/if}
</section>
<dialog
  bind:this={dialog}
  class="ls-dialog"
  class:px-tokens={pixel}
  class:ls-pixel={pixel}
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
  aria-labelledby="ls-panel-title"
>
  <div class="dialog-head">
    <h2 id="ls-panel-title">
      {panel === 'rules' ? m.ls_rules() : m.ls_settings()}
    </h2>
    <button onclick={close}>{m.ls_close()}</button>
  </div>
  {#if panel === 'rules'}{@render rulesContent?.()}{:else if panel === 'settings'}<div
      class="settings"
    >
      {@render settingsContent?.()}
      <fieldset class="skin-choice">
        <legend>{m.skin()}</legend>
        {#each [['classic', m.skin_classic()], ['pixel', m.skin_pixel()]] as [value, label]}<label
            class="check"
            ><input
              type="radio"
              name="ls-skin"
              {value}
              checked={skin === value}
              onchange={() => {
                skin = value as Skin;
                setGameSkin('little-secret', skin);
              }}
            />{label}</label
          >{/each}
      </fieldset>
      <label class="check"
        ><input
          type="checkbox"
          bind:checked={sound}
          onchange={gesture}
        />{m.ls_sound()}</label
      ><label class="check"
        ><input type="checkbox" bind:checked={reduced} />{m.ls_motion()}</label
      >
    </div>{/if}
</dialog>

<style>
  @font-face {
    font-family: 'Secret Hand';
    src: url('/fonts/little-secret/kalam.woff2') format('woff2');
    font-display: swap;
  }
  :global(body:has(.ls-table) .site-header) {
    display: none;
  }
  .ls-table {
    position: fixed;
    inset: 0;
    overflow: hidden;
    isolation: isolate;
    color: #f4e1b9;
    background: #123b3a url('/games/little-secret/table.webp') center / cover;
    font-family: Georgia, serif;
  }
  .corners {
    position: absolute;
    inset: 16px 20px auto;
    display: flex;
    justify-content: space-between;
    z-index: 6;
    pointer-events: none;
  }
  .corners button {
    pointer-events: auto;
    width: 46px;
    height: 46px;
    padding: 0;
    border-radius: 50%;
    background: #e2c58f;
    color: #423223;
    border: 3px double #88653c;
    box-shadow: 0 3px 7px #071c1d88;
    font:
      25px Georgia,
      serif;
  }
  .brand-note {
    position: absolute;
    left: 2%;
    top: 105px;
    width: 12%;
    transform: rotate(-7deg);
    text-align: center;
  }
  h1 {
    margin: 0;
    font:
      bold clamp(20px, 2.2vw, 34px) Georgia,
      serif;
  }
  .brand-line {
    display: flex;
    justify-content: center;
    margin: 5px 0;
    gap: 2px;
  }
  .brand-line b {
    display: inline-block;
    padding: 2px;
    color: #2d2b23;
    background: #e9d6b3;
    transform: rotate(var(--letter-tilt));
    box-shadow: 1px 3px 3px #091e1c77;
  }
  .brand-line b:nth-child(3n) {
    background: #903c31;
    color: #f3ddb0;
  }
  .brand-note p {
    font:
      14px 'Secret Hand',
      cursive;
    color: #f8e4c0;
    text-shadow: 0 1px 4px #000;
  }
  .phase-banner {
    position: absolute;
    top: 22px;
    left: 44%;
    transform: translateX(-50%) rotate(-1deg);
    min-width: 250px;
    max-width: 48%;
    text-align: center;
  }
  .phase-banner h2 {
    margin: 0 0 4px;
    font:
      26px 'Secret Hand',
      cursive;
  }
  .phase-banner span {
    font-size: 12px;
  }
  .table-layout {
    position: absolute;
    inset: 112px 27% 40px 14%;
  }
  .seats {
    position: absolute;
    inset: 0;
  }
  .seat {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: clamp(96px, 9vw, 130px);
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    text-align: center;
    --token-size: clamp(48px, 8.5vh, 82px);
  }
  .dense .seat {
    --token-size: clamp(42px, 6.5vh, 64px);
  }
  .seat-top {
    position: relative;
  }
  .seat-choice {
    display: block;
    padding: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
  }
  .seat-choice:hover:enabled {
    background: transparent;
  }
  .power-badge {
    position: absolute;
    bottom: -4px;
    right: -19px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #f0dcad;
    box-shadow: 1px 2px 4px #071c1d88;
  }
  .power-badge :global(svg) {
    width: 100%;
    height: 100%;
  }
  .name-slip {
    width: 100%;
    margin-top: 4px;
    transform: rotate(-2deg);
  }
  .name-slip strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font:
      18px/1.25 'Secret Hand',
      cursive;
  }
  .clue-slip {
    width: 100%;
    transform: rotate(2deg);
  }
  .clue-strip {
    display: block;
    max-height: 2.5em;
    overflow: auto;
    scrollbar-width: thin;
    overflow-wrap: anywhere;
    font:
      14px/1.25 'Secret Hand',
      cursive;
  }
  .seat-score {
    font-size: 12px;
    text-shadow: 0 1px 3px #000;
  }
  .role-stamp,
  .status-stamp {
    font:
      12px 'Secret Hand',
      cursive;
    background: #edd5a7;
    color: #7f3128;
    padding: 2px 6px;
  }
  .out .name-slip {
    opacity: 0.7;
  }
  .commit-mark {
    position: absolute;
    top: -6px;
    left: 4px;
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #e9d8aa;
    color: #305a43;
  }
  .action-area {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(48%, 370px);
  }
  .action-scroll {
    max-height: calc((100dvh - 152px) * 0.42 - 48px);
    overflow: auto;
    scrollbar-width: thin;
    padding: 2px 4px;
    overflow-wrap: anywhere;
  }
  .action-area p {
    font-size: 14px;
    line-height: 1.5;
    margin: 0 0 12px;
  }
  .action-area label {
    margin-bottom: 12px;
  }
  .action-area input:not([type='checkbox']),
  .action-area select {
    width: 100%;
    margin-bottom: 8px;
  }
  button {
    min-height: 44px;
    border: 1px solid #9c784d;
    border-radius: 3px;
    background: #dcc192;
    color: #38291f;
    font-family: 'Secret Hand', cursive;
  }
  button:hover:enabled {
    background: #ecd4a9;
  }
  button.primary {
    width: 100%;
    background: #983d31;
    color: #fff0d0;
    margin: 6px 0;
    border-color: #713128;
  }
  button.primary:hover:enabled {
    background: #ac4939;
  }
  .speaker-label span,
  .speaker-label strong {
    display: block;
  }
  .speaker-label strong {
    font:
      26px 'Secret Hand',
      cursive;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .check input {
    width: 20px;
    height: 20px;
    flex: none;
    accent-color: #923e30;
  }
  .symbols {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .symbols button {
    flex: 1;
    padding: 8px;
  }
  .symbols button[aria-pressed='true'] {
    background: #983d31;
    color: #fff0d0;
  }
  .envelope {
    margin-top: 15px;
    padding-top: 12px;
    border-top: 1px dashed #a2875b;
  }
  .envelope > button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    gap: 12px;
    padding: 6px 10px;
  }
  .envelope-mark {
    flex: none;
    width: 48px;
    height: 34px;
  }
  .envelope h3 {
    font:
      22px 'Secret Hand',
      cursive;
    margin: 12px 0 6px;
  }
  .password {
    display: block;
    font:
      26px 'Secret Hand',
      cursive;
    color: #923e30;
  }
  .envelope ul {
    padding-left: 20px;
    font-size: 13px;
  }
  .ls-table > :global(.side-sheet) {
    position: absolute;
    width: 22%;
    right: 2.5%;
    top: 50%;
    transform: translateY(-50%) rotate(2deg);
  }
  .notice {
    position: absolute;
    z-index: 7;
    top: 80px;
    left: 25%;
    right: 25%;
    padding: 8px 12px;
    margin: 0;
    background: #812f29;
    color: #fff2d9;
    text-align: center;
    font-size: 13px;
  }
  dialog {
    width: min(680px, calc(100% - 24px));
    max-height: calc(100dvh - 32px);
    padding: 24px;
    border: 2px solid #967446;
    border-radius: 4px;
    background: #f4e7cc;
    color: #342a24;
    box-shadow: 0 18px 70px #0008;
  }
  dialog::backdrop {
    background: #061d20bb;
  }
  .dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }
  .dialog-head h2 {
    font:
      28px 'Secret Hand',
      cursive;
    margin: 0;
  }
  .settings {
    display: grid;
    gap: 16px;
  }
  .skin-choice {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin: 0;
    padding: 10px 14px 12px;
    border: 1px solid #b69d76;
    border-radius: 4px;
  }
  .skin-choice legend {
    padding: 0 6px;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  .action-scroll:focus-visible,
  .clue-strip:focus-visible {
    outline: 3px solid #c28639;
    outline-offset: 3px;
  }
  @media (max-width: 1099px), (max-height: 699px) {
    .ls-table {
      overflow-y: auto;
      background: radial-gradient(ellipse at top, #245653, #0c292b);
      padding: 78px 16px 32px;
    }
    .corners {
      position: fixed;
      top: 12px;
      left: 12px;
      right: 12px;
    }
    .brand-note {
      position: static;
      width: auto;
      transform: none;
      margin: 0 auto 20px;
    }
    .brand-note h1 {
      display: flex;
      justify-content: center;
      gap: 10px;
      font-size: 25px;
    }
    .brand-note p {
      margin: 6px 0;
    }
    .phase-banner {
      position: static;
      transform: none;
      width: min(100%, 650px);
      max-width: none;
      min-width: 0;
      margin: 0 auto 28px;
    }
    .phase-banner h2 {
      font-size: 25px;
    }
    .table-layout {
      position: static;
      display: flex;
      flex-direction: column;
      gap: 32px;
      max-width: 650px;
      margin: auto;
    }
    .action-area {
      position: static;
      transform: none;
      order: -1;
      width: 100%;
    }
    .action-scroll {
      max-height: none;
      overflow: visible;
    }
    .seats {
      position: static;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 30px 18px;
      padding: 6px 6px 32px;
    }
    .seat,
    .dense .seat {
      position: relative;
      inset: auto;
      transform: none;
      width: 100%;
      --token-size: 70px;
    }
    .name-slip,
    .clue-slip {
      max-width: 170px;
    }
    .ls-table > :global(.side-sheet) {
      position: static;
      transform: none;
      width: 100%;
      margin: 0 auto;
    }
    .notice {
      position: sticky;
      top: 0;
      margin-bottom: 16px;
    }
    dialog {
      padding: 18px;
    }
  }
</style>
