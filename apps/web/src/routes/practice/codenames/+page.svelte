<script lang="ts">
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import Board from '@board-games/codenames/Board.svelte';
  import {
    practice,
    scenarios,
    type Scenario,
  } from '@board-games/codenames/practice';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let scenario = $state<Scenario>('match'),
    round = $state(0),
    game = practice(),
    seat = $state(game.actor),
    view = $state(game.view(game.actor)),
    locale = $state(getLocale()),
    seatCount = $state(4),
    // You give every clue for both teams; Jev plays each team's operative.
    jev = $state(true),
    // False once the server answers that its Jev lab (JEV_LAB=1) is off.
    lab = $state(true),
    jevStatus = $state(''),
    personality = $state<'conservative' | 'normal' | 'risky'>('normal'),
    busy = false;
  const seatSizes = [4, 5, 8, 12];
  const displaySeats = $derived.by(() => {
    locale;
    return view.public.players.map((id, i) => ({
      ...game.seats.find((p) => p.id === id)!,
      name: `${i < 2 || (i >= 4 && i % 2 === 0) ? m.cn_red() : m.cn_blue()} · ${i + 1}`,
    }));
  });
  // Personality is part of the match setup: fixed from the first clue until a reset.
  const started = $derived(
    view.public.clueHistory.length > 0 && view.public.phase !== 'finished',
  );
  const spymaster = () =>
    game.state.players.find(
      (p) =>
        game.state.assignments[p]?.team === game.state.activeTeam &&
        game.state.assignments[p]?.role === 'spymaster',
    );
  function refresh() {
    seat =
      jev && game.state.phase !== 'setup'
        ? (spymaster() ?? game.actor)
        : game.actor;
    view = game.view(seat);
  }
  function reset() {
    game = practice(scenario, locale === 'es' ? 'es' : 'en', seatCount);
    jevStatus = '';
    refresh();
    round++;
    void jevTurn();
  }
  /** Public information only, from the guessing team's point of view. */
  function publicView() {
    const s = game.state;
    const side = (identity: string) =>
      identity === s.activeTeam
        ? 'ours'
        : identity === 'civilian'
          ? 'civilian'
          : 'theirs';
    return {
      lang: s.options.boardLanguage,
      clue: {
        word: s.clue!.word,
        count: s.clue!.count === 'unlimited' ? 0 : s.clue!.count,
      },
      board: s.board.filter((c) => !c.revealed).map((c) => c.word),
      revealed: s.board
        .filter((c) => c.revealed && c.identity !== 'assassin')
        .map((c) => ({ word: c.word, identity: side(c.identity) })),
      history: s.clueHistory.slice(0, -1).map((h) => ({
        team: h.team === s.activeTeam ? 'ours' : 'theirs',
        word: h.word,
        count: h.count === 'unlimited' ? 0 : h.count,
        guessed: h.guesses.map((g) => g.word),
      })),
      guessedThisTurn: [],
    };
  }
  async function jevTurn() {
    const s = game.state;
    if (!jev || busy || s.phase !== 'guessing' || !s.clue) return;
    busy = true;
    const current = game;
    const team = s.activeTeam;
    jevStatus = m.cn_jev_thinking();
    try {
      const body = JSON.stringify({
        view: publicView(),
        unlimited: s.clue.count === 'unlimited',
        personality,
        // Public score; lets Jev gamble when waiting would likely lose.
        score: {
          ours: game.view(game.actor).public.remaining[team],
          theirs: game.view(game.actor).public.remaining[
            team === 'red' ? 'blue' : 'red'
          ],
        },
      });
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
      if (res.status === 404) {
        // No lab on this server: you play the operatives yourself.
        lab = jev = false;
        return;
      }
      if (!res.ok) {
        const detail = await res.text();
        let reason = `HTTP ${res.status}`;
        try {
          reason = JSON.parse(detail).error ?? reason;
        } catch {}
        throw new Error(reason);
      }
      const plan = (await res.json()) as {
        guesses: string[];
        usd: number;
        situation: string | null;
      };
      const guessed: string[] = [];
      for (const word of plan.guesses) {
        await new Promise((r) => setTimeout(r, 900));
        const g = game.state;
        if (game !== current || g.phase !== 'guessing' || g.activeTeam !== team)
          break;
        const card = g.board.findIndex((c) => c.word === word && !c.revealed);
        if (card < 0) continue;
        game.send(game.actor, { type: 'guess', card });
        guessed.push(word);
        refresh();
      }
      const g = game.state;
      if (game === current && g.phase === 'guessing' && g.activeTeam === team)
        game.send(game.actor, { type: 'endTurn' });
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
      if (game === current) refresh();
    }
  }
  function changeLocale(next: Locale) {
    setLocale(next, { reload: false });
    locale = next;
  }
  function send(action: unknown) {
    game.send(seat, action);
    refresh();
    void jevTurn();
  }
</script>

<svelte:head
  ><title>Codenames · {m.cn_practice({}, { locale })}</title></svelte:head
>

{#key locale}
  <Board
    {view}
    playerId={seat}
    players={displaySeats}
    {send}
    {round}
    practice
    canRematch
    rematch={async () => reset()}
    {locale}
    note={jev ? jevStatus : ''}
  >
    {#snippet rulesContent()}<Rulebook game="codenames" />{/snippet}
    {#snippet settingsContent()}<nav>
        <a href="/">{m.back()}</a><label
          >{m.cn_practice()}<select
            aria-label={m.cn_practice()}
            bind:value={scenario}
            onchange={reset}
            >{#each scenarios as id}<option value={id}
                >{{
                  setup: m.cn_practice_setup,
                  match: m.cn_practice_match,
                  midgame: m.cn_practice_midgame,
                  final: m.cn_practice_final,
                  assassin: m.cn_practice_assassin,
                }[id]()}</option
              >{/each}</select
          ></label
        ><label
          >{m.cn_actor()}<select
            aria-label={m.cn_actor()}
            bind:value={seat}
            onchange={() => (view = game.view(seat))}
            >{#each displaySeats as p}<option value={p.id}>{p.name}</option
              >{/each}</select
          ></label
        ><label
          >{m.cn_seats()}<select
            aria-label={m.cn_seats()}
            bind:value={seatCount}
            onchange={reset}
            >{#each seatSizes as size}<option value={size}>{size}</option
              >{/each}</select
          ></label
        ><label class="toggle"
          ><input
            type="checkbox"
            bind:checked={jev}
            disabled={!lab}
            onchange={() => {
              refresh();
              void jevTurn();
            }}
          />{m.cn_jev_mode()}{#if !lab}<small>{m.cn_jev_off()}</small
            >{/if}</label
        ><label
          >{m.cn_jev_personality()}<select
            aria-label={m.cn_jev_personality()}
            bind:value={personality}
            disabled={started}
            >{#each [['conservative', m.cn_jev_conservative()], ['normal', m.cn_jev_normal()], ['risky', m.cn_jev_risky()]] as [value, label]}<option
                {value}>{label}</option
              >{/each}</select
          >{#if started}<small>{m.cn_jev_locked()}</small>{/if}</label
        ><button onclick={reset}>{m.cn_reset()}</button><label
          >{m.language()}<select
            aria-label={m.language()}
            value={locale}
            onchange={(e) => changeLocale(e.currentTarget.value as Locale)}
            ><option value="en">EN</option><option value="es">ES</option
            ></select
          ></label
        >
      </nav>{/snippet}
  </Board>
{/key}

<style>
  nav {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 5px;
  }
  select,
  button {
    font: inherit;
    min-height: 44px;
    padding: 6px;
  }
  a {
    color: #245c97;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
