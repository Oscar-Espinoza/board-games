<script lang="ts">
  import { tick } from 'svelte';
  import Board from '@board-games/sushi-go-party/Board.svelte';
  import {
    scenario,
    scenarios,
    demonstrationAction,
    seeded,
    type Scenario,
  } from '@board-games/sushi-go-party/practice';
  import { apply, view, create } from '@board-games/sushi-go-party/server';
  import { m } from '@board-games/shared/messages';
  import {
    getLocale,
    setLocale,
    type Locale,
  } from '@board-games/shared/runtime';
  let scene = $state<Scenario>('table'),
    count = $state(5),
    fixture = scenario('table', 5),
    gameState = $state.raw(fixture.state),
    seat = $state(fixture.state.players[0]),
    epoch = $state(1),
    error = $state('');
  let locale = $state<Locale>(getLocale());
  let advancing = $state(false);
  const names = [
    'Marina',
    'Kai',
    'Sakura',
    'Tomás',
    'Emi',
    'Ren',
    'Valentina de la Costa',
    'Nicolás del Río',
  ];
  const players = $derived(
    gameState.players.map((id, i) => ({ id, name: names[i] })),
  );
  function reset() {
    fixture = scenario(scene, count);
    gameState = fixture.state;
    seat = gameState.players[0];
    epoch++;
    error = '';
  }
  function send(action: unknown) {
    try {
      gameState = apply(
        gameState,
        seat,
        JSON.parse(JSON.stringify(action)),
        fixture.random,
      );
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  async function others() {
    if (advancing) return;
    advancing = true;
    try {
      let guard = 0;
      const turn = gameState.turn,
        round = gameState.round,
        phase = gameState.phase;
      while (guard++ < 100) {
        let moved = false;
        for (const player of gameState.players) {
          if (player === seat) continue;
          const action = demonstrationAction(gameState, player, fixture.random);
          if (action) {
            gameState = apply(gameState, player, action, fixture.random);
            // Deliver every accepted revision, as the live room does. Skipping
            // revisions correctly suppresses presentation after a state gap.
            await tick();
            moved = true;
            break;
          }
        }
        if (
          !moved ||
          gameState.prompt?.actor === gameState.players.indexOf(seat) ||
          gameState.turn !== turn ||
          gameState.round !== round ||
          (gameState.phase !== phase && gameState.phase !== 'resolving')
        )
          break;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      advancing = false;
    }
  }
  function setup() {
    fixture = {
      state: create(gameState.players, seeded(9)),
      random: seeded(9),
    };
    gameState = fixture.state;
    epoch++;
    error = '';
  }
  const sceneLabels = {
    table: m.sgp_table_scene,
    draft: m.sgp_scene_draft,
    wasabi: m.sgp_scene_wasabi,
    uramaki: m.sgp_scene_uramaki,
    miso: m.sgp_scene_miso,
    menu: m.sgp_scene_menu,
    spoon: m.sgp_scene_spoon,
    copy: m.sgp_scene_copy,
    takeout: m.sgp_scene_takeout,
  };
</script>

<svelte:head
  ><title>Sushi Go Party! · {m.sgp_practice({}, { locale })}</title
  ></svelte:head
>
<main class="practice-table">
  {#key locale}<Board
      view={view(gameState, seat)}
      playerId={seat}
      {players}
      {send}
      {locale}
      round={epoch}
      practice
      canRematch
      rematch={async () => reset()}
      practiceAction={others}
      practiceActionLabel={m.sgp_practice_step({}, { locale })}
      practiceActionDisabled={advancing}
      chooseSeat={(id) => {
        seat = id;
      }}
      {settingsContent}
    />{/key}
  {#if error}<p class="practice-error" role="alert">{error}</p>{/if}
</main>
{#snippet settingsContent()}
  <div class="practice-controls">
    <h3>{m.sgp_practice({}, { locale })}</h3>
    <label
      >{m.sgp_practice_scene({}, { locale })}<select
        aria-label={m.sgp_practice_scene({}, { locale })}
        bind:value={scene}
        onchange={reset}
        >{#each scenarios as s}<option value={s}
            >{sceneLabels[s]({}, { locale })}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_practice_seat({}, { locale })}<select
        aria-label={m.sgp_practice_seat({}, { locale })}
        bind:value={seat}
        >{#each players as p}<option value={p.id}>{p.name}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_guests({}, { locale })}<select
        aria-label={m.sgp_guests({}, { locale })}
        bind:value={count}
        onchange={reset}
        >{#each [2, 3, 4, 5, 6, 7, 8] as n}<option value={n}>{n}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_language({}, { locale })}<select
        aria-label={m.sgp_language({}, { locale })}
        value={locale}
        onchange={(e) => {
          locale = e.currentTarget.value as Locale;
          setLocale(locale, { reload: false });
        }}
        ><option value="en">English</option><option value="es">Español</option
        ></select
      ></label
    >
    <button onclick={reset}>{m.sgp_practice_reset({}, { locale })}</button
    ><button onclick={setup}>{m.sgp_practice_setup({}, { locale })}</button><a
      href="/">← {m.sgp_library({}, { locale })}</a
    >
  </div>
{/snippet}

<style>
  :global(body:has(.practice-table) .site-header) {
    display: none;
  }
  .practice-table {
    position: fixed;
    inset: 0;
    z-index: 20;
  }
  .practice-error {
    position: absolute;
    top: 75px;
    left: 15px;
    background: #f3d4c4;
    padding: 8px;
    color: #7b372e;
    z-index: 20;
  }
  .practice-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: #31544b;
  }
  .practice-controls label {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .practice-controls select,
  .practice-controls button {
    min-height: 44px;
    padding: 8px;
    border: 1px solid #a2b69e;
    border-radius: 8px;
    background: #fff6df;
    color: inherit;
  }
  .practice-controls a {
    color: inherit;
  }
  @media (max-width: 1099px), (max-height: 679px) {
    :global(.practice-table .table-wordmark) {
      display: none;
    }
  }
</style>
