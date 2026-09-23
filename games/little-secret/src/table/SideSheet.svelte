<script lang="ts">
  import type { Public, Event } from '../types.js';
  import { m } from '@board-games/shared/messages';
  import Paper from './Paper.svelte';
  let {
    state,
    players,
    onreview,
  }: {
    state: Public;
    players: { id: string; name: string }[];
    onreview: (event: Extract<Event, { type: 'ballots' }>) => void;
  } = $props();
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const ballot = $derived(state.history.findLast((e) => e.type === 'ballots'));
  const counting = $derived(state.phase === 'vote');
  const note = $derived(
    state.phase === 'setup'
      ? m.ls_conversation()
      : ['volunteer', 'clues'].includes(state.phase)
        ? m.ls_uncertain()
        : state.prompt
          ? state.prompt.kind === 'journalist'
            ? m.ls_guess_hint()
            : m[`ls_${state.prompt.kind}_hint`]()
          : m.ls_conversation(),
  );
</script>

<aside
  class="side-sheet"
  aria-label={state.result ? m.ls_table_summary() : m.ls_table_notes()}
>
  <Paper taped>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users must be able to scroll this bounded notes panel.) -->
    <div
      class="sheet-scroll"
      tabindex="0"
      role="region"
      aria-label={m.ls_table_notes()}
    >
      <h2>
        {state.result
          ? m.ls_table_summary()
          : counting
            ? m.ls_table_tally()
            : m.ls_table_notes()}
      </h2>
      {#if state.result}
        <dl class="solution">
          <dt>{m.ls_password()}</dt>
          <dd>{state.result.password}</dd>
          <dt>{m.ls_alternative()}</dt>
          <dd>{state.result.alternative}</dd>
        </dl>
        <ol class="score-list">
          {#each players as p}<li>
              <div>
                <strong>{p.name}</strong><small
                  >{m[`ls_${state.result.roles[p.id]!}`]()}</small
                >
              </div>
              <span
                >+{state.result.points[p.id]} <b>{state.scores[p.id]}</b></span
              >
            </li>{/each}
        </ol>
      {:else if counting}
        <p class="count">
          {state.committed.length}<span>
            / {state.players.length - state.eliminated.length}</span
          >
        </p>
        <p>{m.ls_table_sealed()}</p>
        <ul class="commitments">
          {#each players.filter((p) => !state.eliminated.includes(p.id)) as p}<li
            >
              <span>{p.name}</span><span
                >{state.committed.includes(p.id) ? '✓' : '—'}</span
              >
            </li>{/each}
        </ul>
      {:else}
        <p class="handwritten">{note}</p>
        {#if state.phase === 'tie'}<p class="stamp">{m.ls_table_tied()}</p>
          <p>{state.candidates.map(name).join(' · ')}</p>{/if}
        {#if state.prompt}<p class="stamp">{name(state.prompt.actor)}</p>{/if}
        <div class="case-count">
          <span>{m.ls_mission({ number: state.mission })}</span><span
            >{m.ls_table_cycle({ number: state.cycle || 1 })}</span
          >
        </div>
      {/if}
      {#if ballot?.type === 'ballots' && !counting}
        <section class="last-ballot">
          <h3>{m.ls_table_previous()}</h3>
          <ul>
            {#each Object.entries(ballot.ballots) as [v, t]}<li>
                <span>{name(v)}</span><span aria-hidden="true">→</span><strong
                  >{name(t)}{state.powers[v] === 'dictator'
                    ? ' ×2'
                    : ''}</strong
                >
              </li>{/each}
          </ul>
          <button class="review-button" onclick={() => onreview(ballot)}
            >{m.ls_table_tally()} ↗</button
          >
        </section>
      {/if}
      {#if state.history.length}<details class="history">
          <summary>{m.ls_history()}</summary>
          <ol>
            {#each state.history as e}<li>
                {#if e.type === 'elimination'}{name(e.player)} · {m[
                    `ls_${e.role}`
                  ]()}{:else if e.type === 'guess'}{name(e.player)} · {e.correct
                    ? m.ls_correct()
                    : m.ls_incorrect()}{:else if e.type === 'ballots'}{m.ls_ballots()}{:else if e.type === 'rps'}{m.ls_rps()}
                  <ul>
                    {#each Object.entries(e.choices) as [p, c]}<li>
                        {name(p)}: {m[`ls_${c}`]()}
                      </li>{/each}
                  </ul>{:else if e.type === 'score'}{m.ls_score_event()}{/if}
              </li>{/each}
          </ol>
        </details>{/if}
    </div>
  </Paper>
</aside>

<style>
  .side-sheet {
    width: 100%;
    min-width: 0;
    transform: rotate(2deg);
    align-self: center;
  }
  .sheet-scroll {
    max-height: calc(100dvh - 220px);
    overflow: auto;
    scrollbar-width: thin;
    padding: 0 4px;
    overflow-wrap: anywhere;
  }
  h2 {
    font:
      29px 'Secret Hand',
      cursive;
    margin: 0 0 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #785c4566;
  }
  h3 {
    font:
      20px 'Secret Hand',
      cursive;
    margin: 10px 0;
  }
  .handwritten {
    font:
      21px/1.6 'Secret Hand',
      cursive;
  }
  .stamp {
    color: #993c31;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    border-bottom: 2px solid #993c31;
    padding-bottom: 6px;
  }
  .case-count {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid #ac916b;
    padding-top: 14px;
    font-size: 13px;
  }
  .count {
    font:
      54px 'Secret Hand',
      cursive;
    color: #94392c;
    margin: 0;
  }
  .count span {
    font-size: 24px;
    color: #4b3c30;
  }
  p {
    font-size: 14px;
    line-height: 1.6;
  }
  .commitments,
  .last-ballot ul,
  .score-list {
    list-style: none;
    padding: 0;
  }
  .commitments li {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #9c825344;
  }
  .last-ballot {
    border-top: 2px solid #973e34;
    margin-top: 22px;
    padding-top: 8px;
  }
  .last-ballot li {
    display: grid;
    grid-template-columns: 1fr 18px 1fr;
    gap: 8px;
    font:
      17px/1.6 'Secret Hand',
      cursive;
    padding: 5px 0;
  }
  .review-button {
    width: 100%;
    min-height: 44px;
    border: 1px solid #8d5c40;
    background: #dbc096;
    color: #3c2c20;
    font:
      16px 'Secret Hand',
      cursive;
    cursor: pointer;
  }
  .solution {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 0;
  }
  .solution dt {
    font-size: 12px;
  }
  .solution dd {
    font:
      18px 'Secret Hand',
      cursive;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .score-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid #a28a6644;
  }
  .score-list strong,
  .score-list small {
    display: block;
  }
  .score-list strong {
    font:
      19px 'Secret Hand',
      cursive;
  }
  .score-list small {
    font-size: 11px;
  }
  .score-list li > span {
    white-space: nowrap;
    font-size: 12px;
    color: #9c3b2c;
  }
  .score-list b {
    display: inline-block;
    border: 1px solid #aa8d5d;
    padding: 4px 7px;
    font-size: 19px;
    color: #332820;
    margin-left: 5px;
  }
  .history {
    border-top: 1px solid #ac916b;
    margin-top: 18px;
    font-size: 12px;
    line-height: 1.6;
  }
  .history summary {
    padding: 14px 0;
    cursor: pointer;
    min-height: 44px;
    box-sizing: border-box;
  }
  .history ol {
    padding-left: 18px;
  }
  .history li {
    padding-bottom: 8px;
  }
  @media (max-width: 1099px), (max-height: 699px) {
    .side-sheet {
      transform: none;
      max-width: 650px;
      margin: 0 auto;
    }
    .sheet-scroll {
      max-height: none;
    }
  }
  button:focus-visible,
  summary:focus-visible,
  .sheet-scroll:focus-visible {
    outline: 3px solid #a55130;
    outline-offset: 3px;
  }
</style>
