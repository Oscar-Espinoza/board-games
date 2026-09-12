<script lang="ts">
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
  let scene = $state<Scenario>('draft'),
    count = $state(4),
    fixture = scenario('draft'),
    gameState = $state.raw(fixture.state),
    seat = $state(fixture.state.players[0]),
    epoch = $state(1),
    error = $state('');
  let locale = $state<Locale>(getLocale());
  const names = [
    'Marina',
    'Tomás',
    'Sakura',
    'Kai',
    'Lucía',
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
  function others() {
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

<svelte:head><title>Sushi Go Party! · {m.sgp_practice()}</title></svelte:head>
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
      chooseSeat={(id) => {
        seat = id;
      }}
      {settingsContent}
    />{/key}
  <button
    class="practice-advance"
    onclick={others}
    data-testid="sgp-practice-others">{m.sgp_practice_step()}</button
  >
  {#if error}<p class="practice-error" role="alert">{error}</p>{/if}
</main>
{#snippet settingsContent()}
  <div class="practice-controls">
    <h3>{m.sgp_practice()}</h3>
    <label
      >{m.sgp_practice_scene()}<select
        aria-label={m.sgp_practice_scene()}
        bind:value={scene}
        onchange={reset}
        >{#each scenarios as s}<option value={s}>{sceneLabels[s]()}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_practice_seat()}<select
        aria-label={m.sgp_practice_seat()}
        bind:value={seat}
        >{#each players as p}<option value={p.id}>{p.name}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_guests()}<select
        aria-label={m.sgp_guests()}
        bind:value={count}
        onchange={reset}
        >{#each [2, 3, 4, 5, 6, 7, 8] as n}<option value={n}>{n}</option
          >{/each}</select
      ></label
    >
    <label
      >{m.sgp_language()}<select
        aria-label={m.sgp_language()}
        value={locale}
        onchange={(e) => {
          locale = e.currentTarget.value as Locale;
          setLocale(locale, { reload: false });
        }}
        ><option value="en">English</option><option value="es">Español</option
        ></select
      ></label
    >
    <button onclick={reset}>{m.sgp_practice_reset()}</button><button
      onclick={setup}>{m.sgp_practice_setup()}</button
    ><a href="/">← {m.sgp_library()}</a>
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
  .practice-advance {
    position: absolute;
    right: 17px;
    top: 70px;
    z-index: 13;
    max-width: 180px;
    border: 1px solid #728f78;
    border-radius: 14px;
    background: #e9efd9;
    color: #31544b;
    font-size: 10px;
    font-weight: 700;
    min-height: 44px;
    padding: 7px 10px;
    box-shadow: 0 3px 0 #31544b18;
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
  @media (max-width: 500px) {
    .practice-advance {
      top: 58px;
      right: 9px;
      max-width: 110px;
      font-size: 9px;
      padding: 5px;
      min-height: 44px;
    }
  }
  @media (max-height: 500px) and (min-width: 650px) {
    .practice-advance {
      top: 14px;
      right: 75px;
      max-width: 160px;
      min-height: 44px;
      font-size: 9px;
    }
  }
</style>
