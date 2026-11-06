<script lang="ts">
  import { untrack } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import { getLocale } from '@board-games/shared/runtime';
  import {
    practice,
    scenarios,
    seatCounts,
    type CodenamesPractice,
    type Scenario,
  } from '@board-games/codenames/practice';
  import Practice from '$lib/practice/Practice.svelte';

  // The wire contract of `/api/codenames/guess` (packages/jev-lab/src/codenames).
  type Personality = 'conservative' | 'normal' | 'risky';
  type Plan = { guesses: string[]; usd: number; situation: string | null };

  let scenario = $state<Scenario>('match'),
    seatCount = $state(4),
    jev = $state(true),
    // False once the server answers that its Jev lab (JEV_LAB=1) is off.
    lab = $state(true),
    jevStatus = $state(''),
    // Fixed from the first clue until a reset.
    personality = $state<Personality>('normal'),
    started = $state(false),
    busy = false,
    shell = $state<{ refresh(): void }>();
  let table = $state.raw<CodenamesPractice>();
  const personalities = [
    ['conservative', m.cn_jev_conservative],
    ['normal', m.cn_jev_normal],
    ['risky', m.cn_jev_risky],
  ] as const;
  const scenarioLabels = {
    setup: m.cn_practice_setup,
    match: m.cn_practice_match,
    midgame: m.cn_practice_midgame,
    final: m.cn_practice_final,
    assassin: m.cn_practice_assassin,
  };

  function start(next: Scenario) {
    const created = practice(next, {
      language: getLocale() === 'es' ? 'es' : 'en',
      size: seatCount,
    });
    created.botOperatives = jev;
    created.onMove = () => {
      syncStarted();
      void jevTurn();
    };
    return created;
  }
  const publicOf = (t: CodenamesPractice) => t.view(t.players[0]!.id).public;
  function syncStarted() {
    const p = publicOf(table!);
    started = p.clueHistory.length > 0 && p.phase !== 'finished';
  }
  // A new table (first load, scenario, reset, seat count) clears the status and may start Jev.
  $effect(() => {
    if (!table) return;
    untrack(() => {
      jevStatus = '';
      syncStarted();
      void jevTurn();
    });
  });

  /** The public view from the guessing team's point of view, as the Jev route expects it. */
  function jevBody(current: CodenamesPractice) {
    const p = publicOf(current);
    const team = p.activeTeam;
    const side = (identity: string) =>
      identity === team
        ? 'ours'
        : identity === 'civilian'
          ? 'civilian'
          : 'theirs';
    const count = (n: number | 'unlimited') => (n === 'unlimited' ? 0 : n);
    return JSON.stringify({
      view: {
        lang: p.options.boardLanguage,
        clue: { word: p.clue!.word, count: count(p.clue!.count) },
        board: p.board.filter((c) => !c.revealed).map((c) => c.word),
        revealed: p.board
          .filter((c) => c.revealed && c.identity !== 'assassin')
          .map((c) => ({ word: c.word, identity: side(c.identity!) })),
        history: p.clueHistory.slice(0, -1).map((h) => ({
          team: h.team === team ? 'ours' : 'theirs',
          word: h.word,
          count: count(h.count),
          guessed: h.guesses.map((g) => g.word),
        })),
      },
      personality,
      // Public score; lets Jev gamble when waiting would likely lose.
      score: {
        ours: p.remaining[team],
        theirs: p.remaining[team === 'red' ? 'blue' : 'red'],
      },
    });
  }
  /** The plan, or null when this server has no Jev lab. */
  async function requestPlan(body: string): Promise<Plan | null> {
    const request = () =>
      fetch('/api/codenames/guess', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    // One retry covers a dev server that is restarting.
    let res = await request().catch(() => null);
    if (!res || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await request();
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        reason = JSON.parse(await res.text()).error ?? reason;
      } catch {}
      throw new Error(reason);
    }
    return res.json();
  }
  async function jevTurn() {
    const current = table;
    if (!current || !jev || busy) return;
    const before = publicOf(current);
    if (before.phase !== 'guessing' || !before.clue) return;
    busy = true;
    const team = before.activeTeam;
    const guessing = () => {
      const p = publicOf(current);
      return (
        table === current && p.phase === 'guessing' && p.activeTeam === team
      );
    };
    jevStatus = m.cn_jev_thinking();
    try {
      const plan = await requestPlan(jevBody(current));
      if (!plan) {
        // No lab on this server: you play the operatives yourself.
        lab = jev = false;
        current.botOperatives = false;
        return;
      }
      const guessed: string[] = [];
      for (const word of plan.guesses) {
        await new Promise((r) => setTimeout(r, 900));
        if (!guessing()) break;
        const card = publicOf(current).board.findIndex(
          (c) => c.word === word && !c.revealed,
        );
        if (card < 0) continue;
        current.send(current.operative, { type: 'guess', card });
        guessed.push(word);
        shell?.refresh();
      }
      if (guessing()) current.send(current.operative, { type: 'endTurn' });
      jevStatus =
        (plan.situation === 'last-chance'
          ? `${m.cn_jev_last_chance()} · `
          : '') +
        m.cn_jev_guessed({
          words: guessed.join(', '),
          usd: plan.usd.toFixed(5),
        });
    } catch (error) {
      console.error('[jev]', error);
      jevStatus = `${m.cn_jev_error()} (${error instanceof Error ? error.message : error})`;
    } finally {
      busy = false;
      if (table === current) {
        syncStarted();
        shell?.refresh();
      }
    }
  }
  function toggleJev() {
    table!.botOperatives = jev;
    shell?.refresh();
    void jevTurn();
  }
</script>

{#key seatCount}
  <Practice
    bind:this={shell}
    game="codenames"
    title={`Codenames · ${m.cn_practice()}`}
    {start}
    {scenarios}
    label={(id) => scenarioLabels[id]()}
    bind:scenario
    bind:table
    boardProps={{ note: jev ? jevStatus : '' }}
  >
    {#snippet controls()}
      <label
        >{m.cn_seats()}<select aria-label={m.cn_seats()} bind:value={seatCount}
          >{#each seatCounts as size}<option value={size}>{size}</option
            >{/each}</select
        ></label
      >
      <label class="toggle"
        ><input
          type="checkbox"
          bind:checked={jev}
          disabled={!lab}
          onchange={toggleJev}
        />{m.cn_jev_mode()}{#if !lab}<small>{m.cn_jev_off()}</small>{/if}</label
      >
      <label
        >{m.cn_jev_personality()}<select
          aria-label={m.cn_jev_personality()}
          bind:value={personality}
          disabled={started}
          >{#each personalities as [value, name]}<option {value}
              >{name()}</option
            >{/each}</select
        >{#if started}<small>{m.cn_jev_locked()}</small>{/if}</label
      >
    {/snippet}
  </Practice>
{/key}

<style>
  label {
    display: grid;
    gap: 5px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  select {
    font: inherit;
    min-height: 44px;
    padding: 6px;
  }
</style>
