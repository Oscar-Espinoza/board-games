<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import type { View, Role, Power, Symbol, Event } from './types.js';
  import Rulebook from './Rulebook.svelte';
  import Badge from './Badge.svelte';
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
    players: { id: string; name: string; connected: boolean }[];
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
    mine = $derived(view.private),
    disabled = $derived(!connected || pending),
    living = $derived(s.players.filter((p) => !s.eliminated.includes(p)));
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const role = (id: Role) => m[`ls_${id}`]();
  const power = (id: Power) => m[`ls_${id}`]();
  const phaseLabel = $derived(m[`ls_${s.phase}`]());
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
    systemReduced = $state(false),
    mounted = $state(false);
  const audio = soundEffects(),
    animations = new Set<Animation>();
  function cancel() {
    for (const a of animations) a.cancel();
    animations.clear();
    audio.cancel();
  }
  const gate = eventGate(cancel);
  const entitled = $derived(s.prompt?.actor === playerId);
  const choices = $derived(
    s.phase === 'tie' ? s.candidates : living.filter((p) => p !== playerId),
  );
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
  function eventLabel(e: Event) {
    if (e.type === 'elimination') return `${name(e.player)} · ${role(e.role)}`;
    if (e.type === 'guess')
      return `${name(e.player)} · ${e.correct ? m.ls_correct() : m.ls_incorrect()}`;
    return e.type === 'score' ? m.ls_score_event() : m[`ls_${e.type}`]();
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
      answer = '';
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
      if (accepted.length && !reduced && !systemReduced && root?.animate) {
        const a = root.animate([{ opacity: 0.82 }, { opacity: 1 }], {
          duration: 240,
        });
        animations.add(a);
        a.onfinish = () => animations.delete(a);
      }
      if (sound && accepted.length)
        audio.play(
          0.35,
          accepted.some((e) => e.type === 'score') ? 'finish' : 'reveal',
        );
    });
  });
  $effect(() => {
    const motion = reduced || systemReduced;
    untrack(cancel);
  });
  $effect(() => {
    if (mounted) {
      try {
        localStorage.setItem(
          'little-secret:preferences',
          JSON.stringify({ sound, reduced }),
        );
      } catch {}
      if (!sound) audio.cancel();
    }
  });
  onMount(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem('little-secret:preferences') ?? '{}',
      );
      sound = p.sound !== false;
      reduced = p.reduced === true;
    } catch {}
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    systemReduced = media.matches;
    const change = () => {
      systemReduced = media.matches;
    };
    const hide = () => {
      secret = false;
      gate.reset();
    };
    media.addEventListener('change', change);
    document.addEventListener('visibilitychange', hide);
    mounted = true;
    return () => {
      cancel();
      audio.dispose();
      media.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', hide);
    };
  });
</script>

<section
  class="ls-table"
  data-testid="little-secret-board"
  data-phase={s.phase}
  bind:this={root}
>
  <div class="corners">
    <button onclick={(e) => open('rules', e.currentTarget)}
      >{m.ls_rules()}</button
    ><button
      aria-label={m.ls_settings()}
      onclick={(e) => open('settings', e.currentTarget)}>⚙</button
    >
  </div>
  <header>
    <p>{practice ? m.ls_practice() : m.ls_briefing()}</p>
    <h1>Little Secret</h1>
    <span
      >{m.ls_mission({ number: s.mission })} · {m.ls_score({
        points: s.scores[playerId] ?? 0,
      })}</span
    >
  </header>
  {#if !connected}<p class="notice" role="status">{m.ls_offline()}</p>{/if}
  {#if localError}<p class="notice" role="alert">{localError}</p>{/if}
  <div class="table-layout">
    <div class="seats" aria-label={m.ls_actor()}>
      {#each players as p, i}<article
          class="seat"
          class:out={s.eliminated.includes(p.id)}
          class:active={s.speaker === p.id}
          class:own={p.id === playerId}
          style={`--x:${50 + 43 * Math.cos((2 * Math.PI * i) / players.length - Math.PI / 2)}%;--y:${50 + 40 * Math.sin((2 * Math.PI * i) / players.length - Math.PI / 2)}%`}
        >
          <div class="seat-top">
            <span class="number">{i + 1}</span>{#if s.powers[p.id]}<Badge
                power={s.powers[p.id]!}
              />{/if}
          </div>
          <strong>{p.name}</strong><span
            >{m.ls_score({ points: s.scores[p.id] ?? 0 })}</span
          >
          {#if s.powers[p.id]}<small>{power(s.powers[p.id]!)}</small>{/if}
          {#if s.revealed[p.id]}<small
              >{m.ls_eliminated()} · {role(s.revealed[p.id]!)}</small
            >{/if}
          {#if !p.connected}<small>{m.ls_offline()}</small>{/if}
          {#if s.speaker === p.id}<small>{m.ls_speaker()}</small>{/if}
          {#if (s.phase === 'setup' && s.ready.includes(p.id)) || (s.phase === 'vote' && s.committed.includes(p.id)) || (s.phase === 'tie' && s.rpsCommitted.includes(p.id)) || (s.phase === 'missionResult' && s.continued.includes(p.id))}<small
              >✓ {m.ls_committed()}</small
            >{/if}
        </article>{/each}
    </div>
    <main class="action-area" aria-label={phaseLabel}>
      <h2 aria-live="polite">{phaseLabel}</h2>
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
      {:else if s.phase === 'clues'}<p>{name(s.speaker!)} · {m.ls_speaker()}</p>
        {#if s.powers[playerId]}<p>
            {m[`ls_${s.powers[playerId]!}_hint`]()}
          </p>{/if}{#if s.speaker === playerId}<button
            class="primary"
            disabled={disabled || busy}
            onclick={() =>
              act({ type: 'clue', mission: s.mission, cycle: s.cycle })}
            >{m.ls_clue_action()}</button
          >{/if}
      {:else if s.phase === 'debate'}<p>{m.ls_conversation()}</p>
        {#if s.powers[playerId] === 'novice'}<p>
            {m.ls_novice_hint()}
          </p>{/if}{#if canConfigure}<button
            class="primary"
            disabled={disabled || busy}
            onclick={() =>
              act({ type: 'openVote', mission: s.mission, cycle: s.cycle })}
            >{m.ls_open_vote()}</button
          >{/if}
      {:else if s.phase === 'vote' && living.includes(playerId) && !s.committed.includes(playerId)}
        <label
          >{m.ls_choose()}<select
            aria-label={m.ls_choose()}
            bind:value={target}
            disabled={disabled || busy}
            ><option value="">—</option>{#each choices as id}<option value={id}
                >{name(id)}</option
              >{/each}</select
          ></label
        ><button
          class="primary"
          disabled={disabled || busy || !target}
          onclick={() => act({ type: 'vote', ballotId: s.ballotId, target })}
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
              }}>{m[`ls_${value as Symbol}`]()}</button
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
          ><button class="primary" disabled={disabled || busy || !answer.trim()}
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
            ><option value="">—</option>{#each choices as id}<option value={id}
                >{name(id)}</option
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
              act({ type: 'revenant', promptId: s.prompt!.id, target: null })}
            >{m.ls_decline()}</button
          >{/if}
      {:else if s.result}
        <p>{m[`ls_reason_${s.result.reason}`]()}</p>
        <dl>
          <dt>{m.ls_password()}</dt>
          <dd>{s.result.password}</dd>
          <dt>{m.ls_alternative()}</dt>
          <dd>{s.result.alternative}</dd>
        </dl>
        <ul class="results">
          {#each players as p}<li>
              <strong>{p.name}</strong>
              {role(s.result.roles[p.id]!)} · +{s.result.points[p.id]} → {s
                .scores[p.id]}
            </li>{/each}
        </ul>
        {#if s.result.winners.length}<p>
            <strong
              >{m.ls_winners()}: {s.result.winners.map(name).join(', ')}</strong
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
            }}
            >{secret ? m.ls_conceal() : m.ls_reveal()}
            <svg class="envelope-mark" viewBox="0 0 64 44" aria-hidden="true"
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
            ></button
          >{#if secret}<div data-testid="own-secret">
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
          <p>{m.ls_uncertain()}</p>
        </aside>{/if}
    </main>
  </div>
  {#if s.history.length}<details class="history">
      <summary>{m.ls_history()}</summary>
      <ol>
        {#each s.history as e}<li>
            {eventLabel(e)}{#if e.type === 'ballots'}<ul>
                {#each Object.entries(e.ballots) as [v, t]}<li>
                    {name(v)} → {name(t)}{s.powers[v] === 'dictator'
                      ? ' ×2'
                      : ''}
                  </li>{/each}
              </ul>{:else if e.type === 'rps'}<ul>
                {#each Object.entries(e.choices) as [p, c]}<li>
                    {name(p)}: {m[`ls_${c}`]()}
                  </li>{/each}
              </ul>{/if}
          </li>{/each}
      </ol>
    </details>{/if}
</section>
<dialog
  bind:this={dialog}
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
  {#if panel === 'rules'}<Rulebook />{:else if panel === 'settings'}<div
      class="settings"
    >
      {@render settingsContent?.()}<label class="check"
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
  :global(body:has(.ls-table) .site-header) {
    display: none;
  }
  :global(body:has(.ls-table)) {
    margin: 0;
    background: #112b29;
  }
  .ls-table {
    min-height: 100dvh;
    background: radial-gradient(ellipse at 50% 45%, #2a5149, #112b29 75%);
    color: #f0e1c3;
    padding: 16px clamp(12px, 3vw, 44px) 32px;
    font-family: system-ui, sans-serif;
    box-sizing: border-box;
  }
  .corners {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .corners button {
    background: #17342f;
    color: #f0e1c3;
    border: 1px solid #b29b6d;
  }
  .ls-table header {
    text-align: center;
    margin: 0 auto 16px;
  }
  .ls-table header p {
    font-size: 11px;
    letter-spacing: 0.18em;
  }
  .ls-table h1 {
    font-family: Georgia, serif;
    font-size: clamp(36px, 5vw, 64px);
    margin: 4px 0;
  }
  .ls-table header span {
    font-size: 13px;
    color: #d4c198;
  }
  .table-layout {
    position: relative;
    max-width: 1250px;
    margin: auto;
    min-height: 780px;
    padding: 140px 0;
    box-sizing: border-box;
    display: grid;
    place-items: center;
  }
  .seats {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .seat {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: 142px;
    min-height: 100px;
    padding: 10px;
    border: 1px solid #7b8d73;
    border-radius: 8px;
    background: #183b34;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }
  .seat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .seat .number {
    color: #d8b974;
    font:
      italic 22px Georgia,
      serif;
  }
  .seat strong {
    font-size: 14px;
  }
  .seat span,
  .seat small {
    font-size: 12px;
  }
  .seat.out {
    background: #283631;
    border-color: #6d7062;
  }
  .seat.own {
    border: 2px solid #d7b570;
  }
  .seat.active {
    box-shadow: 0 0 0 3px #d7b570;
  }
  .action-area {
    z-index: 1;
    width: min(390px, 100%);
    box-sizing: border-box;
    padding: 24px;
    background: #f1e4c7;
    color: #352c24;
    border: 1px solid #cfb586;
    border-radius: 4px;
    box-shadow: 0 14px 40px #061f2677;
  }
  .action-area h2 {
    font:
      24px Georgia,
      serif;
    margin: 0 0 14px;
  }
  .action-area p {
    font-size: 14px;
    line-height: 1.55;
  }
  .action-area button {
    width: 100%;
    margin-top: 10px;
  }
  .action-area form {
    display: grid;
    gap: 8px;
  }
  .ls-table button,
  dialog button {
    font: inherit;
    font-size: 14px;
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 5px;
    border: 1px solid #b5a17b;
    background: #e0cfaa;
    color: #352c24;
    cursor: pointer;
  }
  .ls-table button:disabled,
  dialog button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .ls-table button.primary {
    background: #753c39;
    color: #fff4df;
    border-color: #753c39;
    font-weight: 600;
  }
  .ls-table button[aria-pressed='true'] {
    background: #32544b;
    color: #fff4df;
  }
  .ls-table label,
  dialog label {
    display: grid;
    gap: 8px;
    font-size: 14px;
    margin: 10px 0;
  }
  .ls-table select,
  .ls-table input,
  dialog input {
    min-height: 44px;
    font: inherit;
    color: #352c24;
    background: #fff7e5;
    border: 1px solid #9f8c6c;
    border-radius: 4px;
    padding: 8px;
    width: 100%;
    box-sizing: border-box;
  }
  .ls-table .check,
  dialog .check {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .check input {
    width: 22px;
    flex-shrink: 0;
  }
  .symbols {
    display: flex;
    gap: 5px;
  }
  .ls-table :is(button, input, select, summary):focus-visible,
  dialog :is(button, input, select, summary):focus-visible {
    outline: 3px solid #c98836;
    outline-offset: 3px;
  }
  .envelope {
    max-width: 560px;
    margin: 20px auto 0;
    border-top: 1px solid #bca681;
    padding-top: 8px;
    text-align: center;
  }
  .envelope-mark {
    width: 50px;
    height: 34px;
    vertical-align: middle;
    margin-left: 8px;
  }
  .envelope > button {
    background: #edddba;
    min-width: 230px;
  }
  .envelope p {
    font-size: 13px;
    line-height: 1.6;
    color: #5d4b36;
  }
  .envelope > div {
    background: #ecdfc3;
    color: #352c24;
    padding: 22px;
    margin-top: 12px;
    text-align: left;
  }
  .envelope > div p {
    color: inherit;
  }
  .envelope h3 {
    font:
      18px Georgia,
      serif;
  }
  .password {
    font:
      24px Georgia,
      serif;
    overflow-wrap: anywhere;
  }
  .history {
    max-width: 680px;
    margin: 24px auto;
    font-size: 13px;
    line-height: 1.7;
  }
  .history summary {
    min-height: 44px;
    cursor: pointer;
  }
  .notice {
    padding: 12px;
    border: 1px solid #d7b570;
  }
  .results {
    padding-left: 16px;
    font-size: 13px;
    line-height: 1.8;
  }
  .action-area dt {
    font-size: 12px;
  }
  .action-area dd {
    font-weight: 700;
    margin: 3px 0 10px;
  }
  dialog {
    width: min(880px, 92vw);
    max-height: 85dvh;
    box-sizing: border-box;
    background: #f1e4c7;
    color: #352c24;
    border: 1px solid #b39b6d;
    border-radius: 10px;
    padding: 24px;
  }
  dialog::backdrop {
    background: #081c20bf;
  }
  .dialog-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .dialog-head h2 {
    font:
      24px Georgia,
      serif;
  }
  .settings {
    display: grid;
    gap: 12px;
  }
  @media (max-width: 900px) {
    .table-layout {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: 0;
      padding: 0;
    }
    .seats {
      position: static;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
      max-width: 660px;
    }
    .seat {
      position: static;
      transform: none;
      width: auto;
      min-height: 105px;
      padding: 8px;
    }
    .action-area {
      width: min(560px, 100%);
    }
    .ls-table {
      padding: 12px;
    }
    .ls-table header {
      margin: 16px 0;
    }
    .ls-table header p {
      letter-spacing: 0.08em;
    }
    .ls-table h1 {
      font-size: 40px;
    }
    .seat strong {
      font-size: 13px;
    }
    .seat small {
      font-size: 11px;
    }
    .action-area {
      padding: 20px;
    }
    .ls-table {
      height: calc(100dvh - 76px);
      min-height: 0;
      overflow: auto;
      margin-bottom: 76px;
    }
    .ls-table button.primary {
      position: fixed;
      bottom: 12px;
      left: 12px;
      width: calc(100% - 24px);
      margin: 0;
      z-index: 5;
      box-shadow: 0 0 0 12px #112b29;
    }

    .envelope {
      margin-top: 20px;
    }
    dialog {
      padding: 16px;
    }
    .dialog-head h2 {
      font-size: 20px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      scroll-behavior: auto;
    }
  }
</style>
