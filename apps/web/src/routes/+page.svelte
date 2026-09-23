<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto, replaceState } from '$app/navigation';
  import { catalog } from '@board-games/shared';
  import { m } from '@board-games/shared/messages';
  import { connect, create, leave, session } from '$lib/session.svelte';
  import BoxArt from '$lib/catalog/BoxArt.svelte';
  import SummaryStep from '$lib/catalog/SummaryStep.svelte';
  import Rulebook from '$lib/catalog/Rulebook.svelte';
  import type { GameId } from '$lib/catalog/types';
  let selected = $state<GameId>('uno');
  let panel = $state<'start' | 'summary' | 'rules' | 'join' | null>(null);
  let secretPowers = $state(false);
  let boardLanguage = $state('en');
  let name = $state(''),
    code = $state(''),
    setup = $state('variable'),
    busy = $state(false);
  let dialog: HTMLDialogElement;
  let opener: HTMLElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout>;
  const selectedIndex = $derived(catalog.findIndex((g) => g.id === selected));
  const game = $derived(catalog[selectedIndex]!);
  const summaries = {
    'little-secret': m.ls_summary,
    azul: m.library_azul_summary,
    codenames: m.library_cn_summary,
    'sushi-go-party': m.sgp_summary,
    uno: m.library_uno_summary,
    catan: m.library_catan_summary,
    carcassonne: m.library_carcassonne_summary,
  };
  const loops = {
    'little-secret': [m.ls_loop_0, m.ls_loop_1, m.ls_loop_2],
    azul: [m.library_azul_loop_0, m.library_azul_loop_1, m.library_azul_loop_2],
    codenames: [m.library_cn_loop_0, m.library_cn_loop_1, m.library_cn_loop_2],
    'sushi-go-party': [m.sgp_loop_0, m.sgp_loop_1, m.sgp_loop_2],
    uno: [m.library_uno_loop_0, m.library_uno_loop_1, m.library_uno_loop_2],
    catan: [
      m.library_catan_loop_0,
      m.library_catan_loop_1,
      m.library_catan_loop_2,
    ],
    carcassonne: [
      m.library_carcassonne_loop_0,
      m.library_carcassonne_loop_1,
      m.library_carcassonne_loop_2,
    ],
  };
  onMount(() => {
    leave();
    connect();
    try {
      name = localStorage.getItem('board-games:name') ?? '';
    } catch {}
    const recovering = catalog.find(
      (item) => window.location.hash === `#rules-${item.id}`,
    );
    if (recovering) {
      selected = recovering.id;
      void tick().then(() => {
        const restored = new URL(window.location.href);
        restored.searchParams.delete('_guideRetry');
        replaceState(restored.pathname + restored.search, {});
        document
          .querySelector<HTMLButtonElement>(
            '.primary-actions button:last-child',
          )
          ?.focus();
        open('rules');
      });
    }
    const join = () => open('join');
    window.addEventListener('catalog-join', join);
    return () => {
      clearTimeout(hoverTimer);
      window.removeEventListener('catalog-join', join);
    };
  });
  function select(id: GameId) {
    clearTimeout(hoverTimer);
    selected = id;
  }
  function hover(event: PointerEvent, id: GameId) {
    if (event.pointerType === 'mouse') {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => (selected = id), 80);
    }
  }
  function open(next: typeof panel) {
    if (!panel)
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    clearTimeout(hoverTimer);
    session.error = '';
    panel = next;
    void tick().then(() => {
      if (dialog) dialog.scrollTop = 0;
    });
  }
  function close() {
    panel = null;
    opener?.focus();
  }
  $effect(() => {
    if (panel) {
      dialog?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    } else dialog?.close();
  });
  async function createRoom(practice = false) {
    if (busy) return;
    busy = true;
    session.error = '';
    try {
      try {
        localStorage.setItem('board-games:name', name.trim());
      } catch {}
      const credentials = await create(
        selected,
        practice ? name.trim() || 'Player' : name.trim(),
        selected === 'little-secret'
          ? { wordLanguage: boardLanguage, powers: secretPowers }
          : selected === 'codenames'
            ? { boardLanguage }
            : { setup, practice },
      );
      await goto(`/room/${credentials.roomId}`);
    } catch (error) {
      session.error = (error as Error).message;
    } finally {
      busy = false;
    }
  }
  function joinRoom() {
    const id = code.trim().split('/').filter(Boolean).at(-1)?.split(/[?#]/)[0];
    if (id) void goto(`/room/${encodeURIComponent(id)}`);
  }
</script>

<svelte:head><title>{m.catalog()}</title></svelte:head>
<main class="library">
  <section class="library-intro">
    <p class="kicker">{m.library_eyebrow()}</p>
    <h1>{m.library_heading()}</h1>
    <p class="invitation">{m.library_intro()}</p>
    <nav class="game-names" aria-label={m.library_select()}>
      {#each catalog as item, i}<button
          class:chosen={selected === item.id}
          aria-pressed={selected === item.id}
          onpointerenter={(event) => hover(event, item.id)}
          onpointerleave={() => clearTimeout(hoverTimer)}
          onfocus={() => select(item.id)}
          onclick={() => select(item.id)}
          ><span class="number">0{i + 1}</span><span>{item.name}</span><span
            class="name-arrow"
            aria-hidden="true">↗</span
          ></button
        >{/each}
    </nav>
  </section>
  <section class="collection" aria-label={game.name}>
    <div class="box-stage" data-selected={selected} aria-hidden="true">
      <div class="sun-disc"></div>
      {#each catalog as item, i}<div
          class="game-box {item.id}"
          class:front={selected === item.id}
          class:previous={i ===
            (selectedIndex + catalog.length - 1) % catalog.length}
          class:next={i === (selectedIndex + 1) % catalog.length}
          data-box={item.id}
        >
          <BoxArt game={item.id} />
        </div>{/each}
      <span class="spark one">✳</span><span class="spark two">✧</span>
    </div>
    <div class="selection-details">
      {#key selected}<div class="selection-copy">
          <p class="kicker">
            {m.players({ min: game.minPlayers, max: game.maxPlayers })}
          </p>
          <h2>{game.name}</h2>
          <p>{game.description()}</p>
        </div>{/key}
      <div class="primary-actions">
        <button class="start" onclick={() => open('start')}
          >{m.library_start()} <span aria-hidden="true">↗</span></button
        ><button onclick={() => open('summary')}>{m.library_summary()}</button
        ><button onclick={() => open('rules')}>{m.library_rules()}</button>
      </div>
    </div>
  </section>
</main>
<dialog
  bind:this={dialog}
  onclose={close}
  oncancel={close}
  class:rule-dialog={panel === 'rules'}
  aria-labelledby="library-dialog-title"
>
  <div class="dialog-top">
    <p class="kicker">{panel === 'join' ? m.library_join() : game.name}</p>
    <button class="close" aria-label={m.library_close()} onclick={close}
      >×</button
    >
  </div>
  {#if panel === 'join'}
    <h2 id="library-dialog-title">{m.library_join()}</h2>
    <p>{m.library_join_hint()}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        joinRoom();
      }}
    >
      <label>{m.room_code()}<input bind:value={code} required /></label><button
        class="solid"
        type="submit">{m.join()} →</button
      >
    </form>
  {:else if panel === 'start'}
    <h2 id="library-dialog-title">{m.library_start()}</h2>
    <p>{m.players({ min: game.minPlayers, max: game.maxPlayers })}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void createRoom();
      }}
    >
      <label
        >{m.name()}<input
          bind:value={name}
          maxlength="32"
          autocomplete="nickname"
          placeholder="Alex"
        /></label
      >
      {#if selected === 'little-secret'}<fieldset>
          <legend>{m.ls_language()}</legend><select
            bind:value={boardLanguage}
            aria-label={m.ls_language()}
            ><option value="en">English</option><option value="es"
              >Español</option
            ></select
          ><label
            ><input
              type="checkbox"
              bind:checked={secretPowers}
            />{m.ls_powers()}</label
          >
          <p>{m.ls_conversation()}</p>
        </fieldset>{/if}
      {#if selected === 'codenames'}<fieldset>
          <legend>{m.cn_language()}</legend><select
            bind:value={boardLanguage}
            aria-label={m.cn_language()}
            ><option value="en">English</option><option value="es"
              >Español</option
            ></select
          >
        </fieldset>{/if}
      {#if selected === 'catan'}<fieldset>
          <legend>{m.setup()}</legend>
          <div class="choice-row">
            {#each ['variable', 'beginner'] as mode}<button
                type="button"
                aria-pressed={setup === mode}
                onclick={() => (setup = mode)}
                >{mode === 'beginner' ? m.beginner() : m.variable()}</button
              >{/each}
          </div>
        </fieldset>{/if}
      {#if session.error}<p role="alert" class="error">{session.error}</p>{/if}
      {#if !session.connected}<p role="status">{m.library_connecting()}</p>{/if}
      <button
        class="solid"
        type="submit"
        disabled={!name.trim() || !session.connected || busy}
        >{busy ? m.library_creating() : m.create()} →</button
      >
      {#if selected === 'uno'}<button
          type="button"
          disabled={!session.connected || busy}
          onclick={() => createRoom(true)}
          >{m.library_practice()} <small>{m.uno_practice_hint()}</small></button
        >{:else}<a class="practice" href={`/practice/${selected}`}
          >{m.library_practice()} <span aria-hidden="true">↗</span></a
        >{/if}
    </form>
  {:else if panel === 'summary'}
    <div class="summary-heading">
      <div class="small-cover"><BoxArt game={selected} /></div>
      <div>
        <h2 id="library-dialog-title">{game.name}</h2>
        <p>{m.players({ min: game.minPlayers, max: game.maxPlayers })}</p>
      </div>
    </div>
    <p class="summary-prose">{summaries[selected]()}</p>
    <h3>{m.library_summary_loop()}</h3>
    <ol class="loop">
      {#each loops[selected] as step, i}<li>
          <SummaryStep game={selected} step={i} /><small>0{i + 1}</small
          >{step()}
        </li>{/each}
    </ol>
    <div class="summary-actions">
      <button class="solid" onclick={() => open('start')}
        >{m.library_start()}</button
      ><button onclick={() => open('rules')}>{m.library_read_rules()}</button>
    </div>
  {:else if panel === 'rules'}<Rulebook game={selected} />{/if}
</dialog>

<style>
  :global(body:has(.library)) {
    background: #f6ebd9;
    color: #35291f;
  }
  :global(body:has(.library) .site-header) {
    border: 0;
    color: #705c48;
    background: transparent;
  }
  .library {
    max-width: 1320px;
    margin: auto;
    padding: 35px 48px 45px;
    display: grid;
    grid-template-columns: 35% 65%;
    min-height: calc(100svh - 100px);
    background: radial-gradient(ellipse at 65% 35%, #fff7e4aa, transparent 65%);
    position: relative;
  }
  .library::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.13;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%238a694d' filter='url(%23n)' opacity='.3' d='M0 0h180v180H0z'/%3E%3C/svg%3E");
  }
  .library-intro,
  .collection {
    position: relative;
    min-width: 0;
  }
  .library-intro {
    padding-top: 40px;
    z-index: 1;
  }
  .kicker {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.17em;
    text-transform: uppercase;
    color: #896643;
    margin: 0 0 14px;
  }
  h1 {
    font-size: clamp(3rem, 5.1vw, 5.2rem);
    letter-spacing: -0.055em;
    line-height: 1.04;
    max-width: 400px;
    margin: 0 0 23px;
  }
  .invitation {
    color: #705c48;
    max-width: 260px;
    font-size: 1rem;
    line-height: 1.7;
  }
  .game-names {
    display: grid;
    gap: 4px;
    margin-top: 24px;
    max-width: 360px;
  }
  .game-names button {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 14px;
    background: transparent;
    color: #8e7961;
    padding: 8px 5px;
    min-height: 48px;
    border-radius: 0;
    border-bottom: 1px solid #aa88632c;
    font-family: Georgia, serif;
    font-size: clamp(1.3rem, 2.2vw, 1.85rem);
    font-weight: 400;
  }
  .game-names button.chosen {
    color: #993f2c;
  }
  .number {
    font: 10px system-ui;
    letter-spacing: 0.1em;
  }
  .name-arrow {
    margin-left: auto;
    opacity: 0;
    font: 24px system-ui;
  }
  .chosen .name-arrow {
    opacity: 1;
  }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 3px solid #ad6138;
    outline-offset: 4px;
  }
  .box-stage {
    position: relative;
    height: 450px;
    max-width: 720px;
    margin: 0 auto;
    isolation: isolate;
  }
  .sun-disc {
    position: absolute;
    width: 390px;
    height: 390px;
    border-radius: 50%;
    background: #e9cf9270;
    left: 25%;
    top: 6%;
    box-shadow: 0 0 90px #e8d0a04a;
  }
  .game-box {
    position: absolute;
    width: 270px;
    height: 300px;
    left: 25%;
    top: 100px;
    transform: scale(0.75);
    opacity: 0;
    visibility: hidden;
    filter: drop-shadow(10px 18px 9px #51321b38);
    transition:
      transform 380ms cubic-bezier(0.2, 0.75, 0.25, 1),
      left 380ms,
      top 380ms,
      filter 380ms,
      opacity 220ms;
    z-index: 1;
    pointer-events: none;
  }
  .game-box.front {
    opacity: 1;
    visibility: visible;
    z-index: 5;
    left: 25%;
    top: 48px;
    transform: rotate(-5deg) scale(1.12);
    filter: drop-shadow(15px 29px 14px #51321b4a);
  }
  .game-box.previous {
    visibility: visible;
    opacity: 1;
    left: 2%;
    top: 115px;
    transform: rotate(-18deg) scale(0.8);
  }
  .game-box.next {
    visibility: visible;
    opacity: 1;
    left: 52%;
    top: 91px;
    transform: rotate(15deg) scale(0.86);
  }
  .spark {
    position: absolute;
    color: #b87940;
    font-size: 40px;
    z-index: -1;
  }
  .one {
    top: 25px;
    left: 72%;
    transform: rotate(15deg);
  }
  .two {
    left: 12%;
    top: 340px;
    font-size: 31px;
  }
  .selection-details {
    max-width: 570px;
    margin: 0 auto;
    text-align: center;
  }
  .selection-copy {
    animation: appear 180ms ease-out;
    min-height: 138px;
  }
  .selection-copy h2 {
    font-size: 2.2rem;
    margin: 0 0 10px;
  }
  .selection-copy p:last-child {
    color: #705c48;
    margin: 0 auto 18px;
    max-width: 440px;
    line-height: 1.6;
  }
  .primary-actions {
    display: grid;
    grid-template-columns: 1.5fr 1fr 1fr;
    gap: 10px;
  }
  .primary-actions button,
  dialog button,
  .practice {
    border: 1px solid #b39a7355;
    background: #fffaec88;
    color: #523c2c;
    border-radius: 5px;
    padding: 14px 17px;
    min-height: 48px;
    font-weight: 600;
  }
  .primary-actions .start,
  .solid {
    background: #a74531 !important;
    color: #fff5df !important;
    border-color: #a74531 !important;
  }
  .start {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  dialog {
    background: #fff5e3;
    color: #35291f;
    border: 1px solid #c4a77d;
    border-radius: 9px;
    width: min(640px, calc(100% - 24px));
    max-height: calc(100dvh - 32px);
    padding: 0 30px 30px;
    box-shadow: 0 28px 100px #30211355;
    overflow: auto;
  }
  dialog::backdrop {
    background: #382a2266;
    backdrop-filter: blur(5px);
  }
  dialog.rule-dialog {
    width: min(1080px, calc(100% - 24px));
  }
  .dialog-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    background: #fff5e3;
    z-index: 10;
    padding: 14px 0 5px;
  }
  .dialog-top .kicker {
    margin: 0;
  }
  .dialog-top .close {
    border: 0;
    background: transparent;
    font-size: 28px;
    padding: 0;
    width: 44px;
    height: 44px;
  }
  dialog h2 {
    font-size: 2.5rem;
  }
  dialog form {
    display: grid;
    gap: 20px;
  }
  dialog label {
    color: #705c48;
  }
  dialog input {
    width: 100%;
    background: #fffcf4;
    color: #35291f;
    border-color: #b49c7b;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    margin-bottom: 10px;
    font-size: 0.9rem;
  }
  .choice-row {
    display: flex;
    gap: 10px;
  }
  .choice-row button {
    flex: 1;
  }
  .choice-row button[aria-pressed='true'] {
    box-shadow: inset 0 0 0 2px #a74531;
    background: #f3dfbb;
  }
  .practice {
    display: flex;
    justify-content: center;
    gap: 16px;
    text-decoration: none;
  }
  small {
    display: block;
    font-weight: 400;
  }
  .summary-heading {
    display: flex;
    align-items: center;
    gap: 30px;
  }
  .small-cover {
    width: 115px;
    height: 128px;
    flex-shrink: 0;
    transform: rotate(-7deg);
  }
  .summary-prose {
    line-height: 1.8;
    color: #705c48;
  }
  .loop {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    list-style: none;
    padding: 0;
    gap: 12px;
    margin: 20px 0 30px;
  }
  .loop li {
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .loop small {
    color: #98754c;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
  }
  .summary-actions {
    display: flex;
    gap: 12px;
  }
  .summary-actions button {
    flex: 1;
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (min-width: 1500px) {
    .library {
      align-items: center;
    }
    .collection {
      align-self: center;
    }
  }
  @media (max-width: 1100px) and (min-width: 900px) {
    .game-box {
      width: 230px;
      height: 256px;
    }
    .box-stage {
      height: 420px;
    }
    .library {
      padding-inline: 30px;
    }
    .sun-disc {
      width: 320px;
      height: 320px;
    }
    .primary-actions button {
      padding: 13px 10px;
    }
  }
  @media (max-width: 899px) {
    .library {
      display: block;
      padding: 20px 28px 45px;
      min-height: 0;
    }
    .library-intro {
      padding-top: 0;
    }
    .kicker {
      font-size: 0.62rem;
    }
    h1 {
      max-width: none;
      font-size: 3.5rem;
    }
    .invitation {
      max-width: none;
      margin: 8px 0;
    }
    .game-names {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 22px;
      max-width: none;
      margin: 22px 0 10px;
    }
    .game-names button {
      font-size: 1.5rem;
      gap: 8px;
      padding: 9px 0;
      min-height: 44px;
    }
    .name-arrow {
      display: none;
    }
    .box-stage {
      max-width: 620px;
      height: 410px;
    }
    .selection-copy {
      min-height: 135px;
    }
    .sun-disc {
      width: 340px;
      height: 340px;
    }
    .selection-details {
      max-width: 570px;
    }
  }
  @media (max-width: 480px) {
    .library {
      padding: 12px 18px 32px;
    }
    h1 {
      font-size: 2.8rem;
      max-width: 290px;
      margin-bottom: 12px;
    }
    .invitation {
      font-size: 0.92rem;
    }
    .game-names {
      gap: 5px 18px;
      margin-top: 17px;
    }
    .game-names button {
      font-size: 1.18rem;
      gap: 6px;
    }
    .number {
      font-size: 9px;
    }
    .box-stage {
      height: 290px;
      margin: 0 -4px;
    }
    .game-box {
      width: 164px;
      height: 182px;
      top: 65px;
    }
    .game-box.front {
      left: 25%;
      top: 42px;
      transform: rotate(-5deg) scale(1.12);
    }
    .box-stage[data-selected] .game-box:not(.front) {
      top: 80px;
    }
    .sun-disc {
      width: 230px;
      height: 230px;
      left: 17%;
      top: 18px;
    }
    .spark {
      font-size: 26px;
    }
    .one {
      top: 4px;
    }
    .two {
      top: 241px;
      left: 8%;
      font-size: 25px;
    }
    .selection-copy {
      min-height: 145px;
    }
    .selection-copy h2 {
      font-size: 2rem;
    }
    .primary-actions {
      grid-template-columns: 1fr;
    }
    .selection-details {
      max-width: 100%;
    }
    .primary-actions button {
      min-height: 48px;
    }
    dialog {
      padding: 0 18px 22px;
    }
    .summary-heading {
      gap: 15px;
    }
    .small-cover {
      width: 90px;
      height: 100px;
    }
    dialog h2 {
      font-size: 2rem;
    }
    .summary-actions {
      flex-direction: column;
    }
    .loop {
      gap: 10px;
    }
    .loop li {
      font-size: 0.8rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .game-box {
      transition: none;
    }
    .selection-copy {
      animation: none;
    }
    .library button,
    dialog button {
      transition: none;
      transform: none;
    }
  }
</style>
