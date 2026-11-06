<script lang="ts">
  import { prefersReducedMotion } from 'svelte/motion';
  import {
    modal,
    RevisionGate,
    ViewerSkin,
    viewerPreferences,
    type BoardProps,
  } from '@board-games/shared/ui';
  import { onMount, tick } from 'svelte';
  import type { view as project, Action, Choice } from './index.js';
  import {
    rolls,
    appetizers,
    specials,
    desserts,
    kinds,
    face,
    picksPerRound,
    type Kind,
    type PublicCard,
  } from './cards.js';
  import {
    presets,
    validMenu,
    unavailable,
    menuKinds,
    type Menu,
  } from './menus.js';
  import { t, cardName } from './labels.js';
  import { tableAudio, passBundles } from './effects.js';
  import Dish from './table/FoodArt.svelte';
  import Card from './Card.svelte';
  import PartyBoard from './table/PartyBoard.svelte';
  import TableControls from './table/TableControls.svelte';
  import ScorePawn from './table/ScorePawn.svelte';
  import TableDecor from './table/TableDecor.svelte';
  import OpponentSeat from './table/OpponentSeat.svelte';
  import { desktopSeats, tableMenu, pawnColors } from './table/layout.js';
  import type { Skin } from '@board-games/shared/ui/pixel';
  import { m } from '@board-games/shared/messages';
  import { providePixel } from './pixel/context.js';
  import { pixelSounds, type PixelCue } from './pixel/sound.js';
  import PixelDecor from './pixel/PixelDecor.svelte';
  import PixelDish from './pixel/PixelDish.svelte';
  import './table/table.css';
  let {
    view,
    playerId,
    players,
    send,
    locale = 'en',
    round = 0,
    connected = true,
    pending = false,
    canRematch = false,
    rematch,
    rulesContent,
    settingsContent,
    practiceStep,
  }: BoardProps<ReturnType<typeof project>, Action> & {
    /** The practice route's button that plays the other seats. */
    practiceStep?: {
      label: string;
      disabled: boolean;
      run: (seat: string) => unknown;
    };
  } = $props();
  const pub = $derived(view.public),
    priv = $derived(view.private);
  const own = $derived(pub.players.find((p) => p.id === playerId)!);
  let viewportWidth = $state(1440),
    viewportHeight = $state(900);
  const phoneLayout = $derived(
    viewportWidth < 700 || (viewportWidth <= 1000 && viewportHeight <= 500),
  );
  const scale = $derived(Math.min(viewportWidth / 1440, viewportHeight / 900));
  const stageWidth = $derived(viewportWidth / scale);
  const stageHeight = $derived(viewportHeight / scale);
  const richSeats = $derived(desktopSeats(pub.players.length - 1));
  const color = (id: string) =>
    pawnColors[pub.players.findIndex((p) => p.id === id) % pawnColors.length];
  const scorePlayers = $derived(
    pub.players.map((p) => ({
      id: p.id,
      name: name(p.id),
      score: p.score,
      color: color(p.id),
    })),
  );
  const richMenu = $derived(tableMenu(pub.menu, pub.players.length, locale));
  const friends = $derived([
    ...pub.players.slice(pub.players.findIndex((p) => p.id === playerId) + 1),
    ...pub.players.slice(
      0,
      pub.players.findIndex((p) => p.id === playerId),
    ),
  ]);
  const allowed = $derived(
    connected && !pending && pub.connected.length === pub.players.length,
  );
  const selectedCard = $derived(priv.hand.find((c) => c.handle === selection));
  let selection = $state(''),
    copyTarget = $state(''),
    armed = $state<string[]>([]),
    boxes = $state<string[]>([]),
    requestKind = $state<Kind>('nigiri'),
    requestVariant = $state(''),
    requestPriority = $state('');
  let root: HTMLElement;
  let panel = $state<'rules' | 'guide' | 'settings' | 'tray' | null>(null),
    search = $state(''),
    tray = $state('');
  let custom = $state(false),
    customMenu = $state<Menu>(structuredClone(presets.first));
  const prefs = viewerPreferences('sushi-go-party', {
    sound: true,
    volume: 0.35,
    motion: null,
  });
  const motion = $derived(prefs.motion ?? !prefersReducedMotion.current);
  let announcement = $state(''),
    revealCards = $state<{ seat: string; card: PublicCard }[]>([]),
    scoring = $state(false);
  let scoredCards = $state<string[]>([]);
  const gate = new RevisionGate(),
    audio = tableAudio(),
    chip = pixelSounds(),
    skin = new ViewerSkin('sushi-go-party', () => import('./pixel.css'));
  let beltMoving = $state(false);
  const pixel = $derived(skin.pixel);
  providePixel(() => pixel);
  const totalPicks = $derived(picksPerRound(pub.players.length));
  const podium = $derived(
    [...pub.players].sort(
      (a, b) => b.score - a.score || b.desserts.length - a.desserts.length,
    ),
  );
  const tally = (list: PublicCard[]) =>
    Object.entries(
      list.reduce<Record<string, number>>(
        (all, c) => ((all[c.kind] = (all[c.kind] ?? 0) + 1), all),
        {},
      ),
    );
  function combo(card: PublicCard) {
    const mine = own.tableau.filter(
      (c) => c.kind === card.kind && !c.boxed && c.collectedRound === pub.round,
    ).length;
    return (
      (card.kind === 'tempura' && mine > 0 && mine % 2 === 0) ||
      (card.kind === 'sashimi' && mine > 0 && mine % 3 === 0) ||
      (card.kind === 'nigiri' && !!card.wasabi)
    );
  }
  let lastPick = '';
  let lastPrompt = '';
  let cancelMotion = () => {};
  let motionVersion = 0;
  let hidden = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  function clearPresentation() {
    motionVersion++;
    cancelMotion();
    cancelMotion = () => {};
    clearTimeout(timer);
    revealCards = [];
    scoring = false;
    scoredCards = [];
    beltMoving = false;
  }
  const label = (key: string, values: Record<string, string | number> = {}) =>
    t(key, values, locale);
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }
  function gesture() {
    if (prefs.sound) (skin.choice === 'pixel' ? chip : audio).unlock();
  }
  function cue(name: PixelCue) {
    if (prefs.sound && pixel) chip.play(name, prefs.volume);
  }
  function keep() {
    if (!selectedCard || !allowed || priv.committed) return;
    gesture();
    cue('lock');
    void send({
      type: 'PICK',
      round: pub.round,
      turn: pub.turn,
      promptId: priv.pickPromptId!,
      card: selection,
      utensils: armed,
      ...(selectedCard.kind === 'special_order' && copyTarget
        ? { copyTarget }
        : {}),
    });
  }
  function resolve(choice: Choice) {
    if (!priv.prompt || !allowed) return;
    gesture();
    void send({
      type: 'RESOLVE',
      round: pub.round,
      turn: pub.turn,
      promptId: priv.prompt.id,
      choice,
    });
  }
  function ready() {
    gesture();
    void send({ type: 'READY', round: pub.round, version: pub.setupVersion });
  }
  function propose(menu: Menu) {
    gesture();
    void send({ type: 'SET_MENU', version: pub.setupVersion, menu });
  }
  function open(next: typeof panel, id = '') {
    panel = next;
    tray = id;
  }
  onMount(() => {
    const resize = () => clearPresentation();
    const visibility = () => {
      hidden = document.hidden;
      clearPresentation();
      gate.reset();
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      clearPresentation();
      audio.close();
      chip.close();
    };
  });
  $effect(() => {
    void [prefs.sound, prefs.volume, motion];
    clearPresentation();
    gate.reset();
  });
  $effect(() => {
    const prompt = `${round}:${playerId}:${priv.pickPromptId}`;
    if (prompt !== lastPick) {
      lastPick = prompt;
      selection = '';
      copyTarget = '';
      armed = [];
    }
  });
  $effect(() => {
    const id = priv.prompt?.id ?? '';
    if (id === lastPrompt) return;
    lastPrompt = id;
    boxes = [];
    requestKind = 'nigiri';
    requestVariant = '';
    requestPriority = '';
    if (id)
      void tick().then(() =>
        root
          ?.querySelector<HTMLButtonElement>('.decision button:not(:disabled)')
          ?.focus({ preventScroll: true }),
      );
  });
  $effect(() => {
    const events = gate.accept(
      pub.presentation.sequence,
      `${round}:${playerId}`,
      connected,
      view,
    )
      ? pub.presentation.events
      : [];
    clearPresentation();
    if (!events.length || hidden || !connected) return;
    const version = motionVersion;
    const revealed = events.flatMap((e) =>
      e.type === 'reveal'
        ? e.cards
        : e.type === 'copy'
          ? [{ seat: e.seat, card: e.card }]
          : [],
    );
    const passing = events.find((e) => e.type === 'pass');
    const scored = events.some((e) => e.type === 'score');
    announcement = scored
      ? label('scored')
      : passing
        ? label('pass')
        : revealed.length
          ? label('revealed')
          : '';
    if (prefs.sound && pixel) {
      const finished = events.find((e) => e.type === 'finished');
      const mine = revealed
        .filter((r) => r.seat === playerId)
        .map((r) => r.card);
      chip.play(
        finished?.type === 'finished'
          ? finished.winners.includes(playerId)
            ? 'win'
            : 'lose'
          : events.some((e) => e.type === 'round-end')
            ? 'round'
            : scored
              ? 'score'
              : mine.some(combo)
                ? 'combo'
                : mine.some((c) =>
                      (desserts as readonly string[]).includes(c.kind),
                    )
                  ? 'dessert'
                  : revealed.length
                    ? 'reveal'
                    : 'pass',
        prefs.volume,
      );
      if (passing && revealed.length)
        setTimeout(() => {
          if (version === motionVersion) chip.play('pass', prefs.volume);
        }, 420);
    } else if (prefs.sound)
      audio.play(
        scored ? 'score' : revealed.length ? 'ceramic' : 'paper',
        prefs.volume,
      );
    if (motion) {
      if (pixel && passing) {
        // The conveyor belt around the board steps round while hands travel.
        beltMoving = true;
        setTimeout(
          () => {
            if (version === motionVersion) beltMoving = false;
          },
          (revealed.length ? 300 : 0) + 760,
        );
      }
      revealCards = revealed;
      scoring = scored;
      scoredCards = events.flatMap((e) =>
        e.type === 'score' && e.seat === playerId
          ? e.groups.flatMap((g) => g.cards)
          : [],
      );
      if (passing?.type === 'pass')
        void tick().then(() => {
          if (root && version === motionVersion && !document.hidden)
            cancelMotion = passBundles(
              root,
              passing.edges,
              revealed.length ? 300 : 0,
              pixel,
            );
        });
      timer = setTimeout(
        () => {
          revealCards = [];
          scoring = false;
          scoredCards = [];
        },
        revealed.length ? 760 : 560,
      );
    }
  });
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<div
  class="sushi-table"
  bind:this={root}
  class:reduce={!motion}
  class:scoring
  class:rich={true}
  class:px-tokens={pixel}
  class:sgp-pixel={pixel}
  class:passing={beltMoving}
  style:--table-scale={scale}
  style:--table-width={`${stageWidth}px`}
  style:--table-height={`${stageHeight}px`}
  style:--phone-board-scale={(viewportWidth - 16) / 840}
  data-layout={phoneLayout ? 'phone' : 'desktop'}
  role="group"
  aria-label="Sushi Go Party!"
  data-phase={pub.phase}
  data-round={pub.round}
  data-turn={pub.turn}
>
  <div class="table-grain" aria-hidden="true"></div>

  <span class="table-wordmark">SUSHI GO <b>PARTY!</b></span>

  <span class="sr-only" role="status" aria-live="polite">{announcement}</span>

  <TableControls
    guideLabel={label('guide')}
    settingsLabel={label('settings')}
    onguide={() => open('rules')}
    onsettings={() => open('settings')}
  />

  <div class="table-stage" data-guests={pub.players.length}>
    {#if pixel}<PixelDecor
        notes={[
          label('table_note_one'),
          label('table_note_two'),
          label('table_note_three'),
        ]}
      />{:else}<TableDecor
        notes={[
          label('table_note_one'),
          label('table_note_two'),
          label('table_note_three'),
        ]}
      />{/if}
    <div class="table-content">
      <PartyBoard
        players={scorePlayers}
        scoreLabel={(n, s) => `${n}: ${label('score', { score: s })}`}
        menu={richMenu}
        boardLabel={label('table_board')}
        indicator={pub.phase === 'setup'
          ? label('menu_title')
          : label('table_pick', {
              round: pub.round,
              pick: pub.turn,
              total: totalPicks,
            })}
        onrule={(kind) => {
          search = label(kind);
          void open('guide');
        }}
      />
      <p class="passing-note">
        {#each label('table_clockwise').split('|') as line}<span>{line}</span
          >{/each}
      </p>
      {#if pub.players.length === 5}<svg
          class="passing-arrows"
          viewBox="0 0 1440 900"
          aria-hidden="true"
          ><defs
            ><marker
              id="sushi-live-arrow"
              markerWidth="12"
              markerHeight="12"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
              ><path d="m0 0 12 5-12 5 3-5Z" fill="#dfedcd" /></marker
            ></defs
          ><path d="M220 650Q177 559 204 453" /><path
            d="M290 199Q346 112 465 112"
          /><path d="M975 112Q1119 119 1176 199" /><path
            d="M1299 452Q1293 495 1242 530"
          /><path d="M1340 758Q1370 830 1270 865" /></svg
        >{/if}

      <div class="opponent-trays">
        {#each friends as friend, i (friend.id)}
          <div
            class="seat"
            style={`--seat-x:${richSeats[i].x}px;--seat-y:${richSeats[i].y}px;--seat-w:${richSeats[i].w}px;--seat-h:${richSeats[i].h}px`}
            data-seat={friend.id}
            class:top-seat={!phoneLayout && richSeats[i].top}
          >
            <OpponentSeat
              name={name(friend.id)}
              score={friend.score}
              color={color(friend.id)}
              count={friend.count}
              tableau={friend.tableau}
              saved={friend.desserts.length}
              status={revealCards.length
                ? 'passing'
                : pub.ready.includes(friend.id) ||
                    pub.committed.includes(friend.id)
                  ? 'ready'
                  : 'choosing'}
              top={!phoneLayout && richSeats[i].top}
              newlyPlayed={revealCards
                .filter((r) => r.seat === friend.id)
                .map((r) => r.card.id)}
              {locale}
              onclick={() => open('tray', friend.id)}
            />
          </div>
        {/each}
      </div>

      {#if pub.phase === 'setup'}
        <section class="menu-setup">
          <div class="setup-platter">
            <Dish card={face('nigiri', 'salmon')} /><Dish
              card={face('maki', '3')}
            /><Dish card={face('dumpling')} />
          </div>
          {#if pixel}<i class="px-chef" aria-hidden="true"></i>{/if}
          <p class="eyebrow">SUSHI GO PARTY! · {pub.players.length}</p>
          <h1>{label('menu_title')}</h1>
          <p>{label('menu_intro')}</p>
          <div class="presets">
            {#each Object.entries(presets) as [key, menu]}<button
                class:chosen={JSON.stringify(menu) === JSON.stringify(pub.menu)}
                disabled={!allowed || !validMenu(menu, pub.players.length)}
                title={!validMenu(menu, pub.players.length)
                  ? label('unavailable')
                  : menuKinds(menu)
                      .map((k) => label(k))
                      .join(', ')}
                onclick={() => propose(menu)}
                ><span class="preset-art"><Dish card={face(menu.roll)} /></span
                ><span>{label('preset_' + key)}</span></button
              >{/each}
          </div>
          <button
            class="text-button"
            onclick={() => {
              custom = !custom;
              customMenu = {
                roll: pub.menu.roll,
                appetizers: [...pub.menu.appetizers],
                specials: [...pub.menu.specials],
                dessert: pub.menu.dessert,
              };
            }}
            aria-expanded={custom}
            >{label('custom')} {custom ? '−' : '+'}</button
          >
          {#if custom}<div class="custom-menu">
              <label
                >{label('rolls')}<select bind:value={customMenu.roll}
                  >{#each rolls as k}<option value={k}>{label(k)}</option
                    >{/each}</select
                ></label
              >
              {#each [0, 1, 2] as i}<label
                  >{label('appetizers')}
                  {i + 1}<select bind:value={customMenu.appetizers[i]}
                    >{#each appetizers as k}<option
                        value={k}
                        disabled={unavailable(k, pub.players.length)}
                        >{label(k)}</option
                      >{/each}</select
                  ></label
                >{/each}
              {#each [0, 1] as i}<label
                  >{label('specials')}
                  {i + 1}<select bind:value={customMenu.specials[i]}
                    >{#each specials as k}<option
                        value={k}
                        disabled={unavailable(k, pub.players.length)}
                        >{label(k)}</option
                      >{/each}</select
                  ></label
                >{/each}
              <label
                >{label('desserts')}<select bind:value={customMenu.dessert}
                  >{#each desserts as k}<option value={k}>{label(k)}</option
                    >{/each}</select
                ></label
              ><button
                disabled={!allowed ||
                  !validMenu(customMenu, pub.players.length)}
                onclick={() => propose(customMenu)}>{label('propose')}</button
              >
            </div>{/if}
          <div class="menu-strip">
            {#each menuKinds(pub.menu) as k}<button
                title={label('rule_' + k)}
                onclick={() => {
                  search = label(k);
                  void open('guide');
                }}
                ><span
                  ><Dish
                    card={face(
                      k,
                      k === 'nigiri'
                        ? 'salmon'
                        : k === 'onigiri'
                          ? 'triangle'
                          : '',
                    )}
                  /></span
                >{label(k)}</button
              >{/each}
          </div>
          <button
            class="primary"
            disabled={!allowed || pub.ready.includes(playerId)}
            onclick={ready}
            >{label(
              pub.ready.includes(playerId) ? 'ready_wait' : 'menu_ready',
            )}</button
          >
          <p class="ready-count">
            {label('waiting', {
              count: pub.ready.length,
              total: pub.players.length,
            })}
          </p>
        </section>
      {:else}
        <div class="table-center">
          <p class="eyebrow">
            {label('round_turn', { round: pub.round, turn: pub.turn })}
          </p>
          <h1>
            {pub.phase === 'finished'
              ? label('finished')
              : pub.phase === 'round-end'
                ? label('round_end')
                : label('current_menu')}
          </h1>

          {#if pub.phase === 'draft'}<p class="ready-count">
              {label('waiting', {
                count: pub.committed.length,
                total: pub.players.length,
              })}
            </p>{/if}
          {#if pub.prompt && !priv.prompt}<p class="waiting-prompt">
              {label('prompt_wait', { name: name(pub.prompt.actorId) })}<small
                >{label('prompt_' + pub.prompt.kind)}</small
              >
            </p>{/if}
          {#if !allowed && pub.connected.length < pub.players.length}<p
              class="waiting-prompt"
            >
              {label('disconnected')}
            </p>{/if}
        </div>

        {#if priv.prompt}
          <section
            class="decision"
            aria-label={label('prompt_' + priv.prompt.kind)}
            data-prompt={priv.prompt.id}
          >
            <p class="eyebrow">{name(playerId)}</p>
            <h2>{label('prompt_' + priv.prompt.kind)}</h2>
            {#if ['menu', 'chopsticks', 'supplier'].includes(priv.prompt.kind)}<div
                class="choice-cards"
              >
                {#each priv.prompt.cards as card}<button
                    data-handle={card.handle}
                    disabled={!allowed}
                    title={label('rule_' + card.kind)}
                    aria-label={cardName(card, locale)}
                    onclick={() => resolve({ type: 'card', card: card.handle })}
                    ><Card {card} {locale} /></button
                  >{/each}
              </div>
            {:else if priv.prompt.kind === 'copy' || priv.prompt.kind === 'attach'}<div
                class="choice-cards"
              >
                {#each priv.prompt.targets as card}<button
                    disabled={!allowed}
                    aria-label={cardName(card, locale)}
                    onclick={() =>
                      resolve(
                        priv.prompt!.kind === 'copy'
                          ? { type: 'copy', target: card.id }
                          : { type: 'attach', wasabi: card.id },
                      )}><Card {card} {locale} /></button
                  >{/each}
              </div>
              {#if priv.prompt.kind === 'attach'}<button
                  onclick={() => resolve({ type: 'attach', wasabi: null })}
                  disabled={!allowed}>{label('no_attach')}</button
                >{/if}
            {:else if priv.prompt.kind === 'takeout'}<div class="choice-cards">
                {#each priv.prompt.targets as card}<button
                    class:chosen={boxes.includes(card.id)}
                    aria-pressed={boxes.includes(card.id)}
                    disabled={!allowed}
                    aria-label={cardName(card, locale)}
                    onclick={() => (boxes = toggle(boxes, card.id))}
                    ><Card {card} {locale} /></button
                  >{/each}
              </div>
              <button
                class="primary"
                disabled={!allowed}
                onclick={() => resolve({ type: 'takeout', cards: boxes })}
                >{label(boxes.length ? 'box_selected' : 'flip_none')}</button
              >
            {:else if priv.prompt.kind === 'spoon'}<div class="request-row">
                <select
                  aria-label={label('ask')}
                  bind:value={requestKind}
                  onchange={() => {
                    requestVariant = '';
                    requestPriority = '';
                  }}
                  >{#each priv.prompt.requests as r}<option value={r.kind}
                      >{label(r.kind)}</option
                    >{/each}</select
                ><select
                  aria-label={label('request_any')}
                  bind:value={requestVariant}
                  ><option value="">{label('request_any')}</option
                  >{#each priv.prompt.requests
                    .find((r) => r.kind === requestKind)
                    ?.variants.filter(Boolean) ?? [] as v}<option value={v}
                      >{cardName(
                        face(
                          requestKind,
                          v,
                          0,
                          0,
                          requestKind === 'fruit'
                            ? v.split('').map(Number)
                            : [0, 0, 0],
                        ),
                        locale,
                      )}</option
                    >{/each}</select
                >{#if priv.prompt.requests.find((r) => r.kind === requestKind)?.priorities.length}<select
                    aria-label={label('priority', { number: '' })}
                    bind:value={requestPriority}
                    ><option value="">{label('request_any')}</option
                    >{#each priv.prompt.requests.find((r) => r.kind === requestKind)?.priorities ?? [] as n}<option
                        value={String(n)}
                        >{label('priority', { number: n })}</option
                      >{/each}</select
                  >{/if}<button
                  class="primary"
                  disabled={!allowed}
                  onclick={() =>
                    resolve({
                      type: 'request',
                      kind: requestKind,
                      ...(requestVariant ? { variant: requestVariant } : {}),
                      ...(requestPriority
                        ? { priority: Number(requestPriority) }
                        : {}),
                    })}>{label('ask')}</button
                >
              </div>{/if}
          </section>
        {/if}

        {#if pub.phase === 'round-end' || pub.phase === 'finished'}
          <section class="results">
            <h2>
              {pub.phase === 'finished'
                ? label('winners', { names: pub.winners.map(name).join(', ') })
                : label('receipt')}
            </h2>
            {#if pixel && pub.phase === 'finished'}<ol class="px-podium">
                {#each podium as seat, rank (seat.id)}<li
                    class:winner={pub.winners.includes(seat.id)}
                    style:--d={`${rank * 120}ms`}
                  >
                    <b class="px-rank">{rank + 1}</b><ScorePawn
                      color={color(seat.id)}
                    /><span class="px-name">{name(seat.id)}</span><span
                      class="px-dessert-count"
                      ><PixelDish card={face(pub.menu.dessert)} />{seat.desserts
                        .length}</span
                    ><strong>{seat.score} ✦</strong>
                  </li>{/each}
              </ol>{/if}
            <div class="receipts">
              {#each pub.receipts.filter((r) => r.round === pub.round) as receipt}<details
                  open={receipt.playerId === playerId}
                >
                  <summary
                    ><span>{name(receipt.playerId)}</span><strong
                      >{receipt.total} ✦</strong
                    ></summary
                  >
                  <p>
                    {label('round_delta', {
                      points: receipt.delta,
                      immediate: receipt.immediate,
                    })}
                  </p>
                  {#each receipt.groups as g, n}<div class="score-line">
                      <span>{label(g.kind)}</span>{#if pixel}<span
                          class="px-ticks"
                          class:minus={g.amount < 0}
                          aria-hidden="true"
                          >{#each Array.from( { length: Math.min(12, Math.abs(g.amount)) } ) as _, i}<i
                              style:--d={`${n * 90 + i * 45}ms`}
                            ></i>{/each}</span
                        >{/if}<strong
                        >{g.amount > 0 ? '+' : ''}{g.amount}</strong
                      >
                    </div>{/each}
                  {#if pixel}{@const seat = pub.players.find(
                      (p) => p.id === receipt.playerId,
                    )}{#if seat?.desserts.length}<div
                        class="px-desserts"
                        aria-label={label('saved', {
                          count: seat.desserts.length,
                        })}
                      >
                        {#each tally(seat.desserts) as [kind, count]}<span
                            ><PixelDish
                              card={{ kind: kind as Kind, variant: '' }}
                            /><b>×{count}</b></span
                          >{/each}
                      </div>{/if}{/if}
                </details>{/each}
            </div>
            {#if pixel && pub.phase === 'finished'}<i
                class="px-chef px-chef-win"
                aria-hidden="true"
              ></i>{/if}
            {#if pub.phase === 'round-end'}<button
                class="primary"
                disabled={!allowed || pub.ready.includes(playerId)}
                onclick={ready}
                >{label(
                  pub.ready.includes(playerId) ? 'ready_wait' : 'next_round',
                )}</button
              >{:else if canRematch && rematch}<button
                class="primary"
                onclick={() => rematch?.()}>{label('rematch')}</button
              >{/if}
          </section>
        {/if}

        {#if practiceStep}<button
            class="practice-action rich-practice-action"
            disabled={practiceStep.disabled}
            onclick={() => practiceStep.run(playerId)}
            >{practiceStep.label}</button
          >{/if}
        <section
          class="own-area"
          data-seat={playerId}
          aria-label={label('plate')}
        >
          <div class="own-label">
            <ScorePawn color={color(playerId)} />
            <span>{name(playerId)} <small>{label('you')}</small></span><strong
              >{own.score} ✦</strong
            ><span class="own-hand-count"
              >{label('hand_count', { count: own.count })}</span
            ><button
              class="dessert-badge"
              aria-label={label('saved', { count: own.desserts.length })}
              onclick={() => open('tray', playerId)}
              >{#if pixel}<span class="px-badge-art"
                  ><PixelDish card={face(pub.menu.dessert)} /></span
                >{:else}♡{/if}
              {own.desserts.length}</button
            >
          </div>
          <span class="own-caption">{label('table_my_dishes')}</span>
          <div class="own-plate" class:empty={!own.tableau.length}>
            {#if !own.tableau.length}<p>
                {label('empty_plate')}
              </p>{/if}{#each own.tableau as card (card.id)}<button
                class:wasabi-linked={card.wasabi}
                class:score-hit={scoredCards.includes(card.id)}
                class:settling={revealCards.some((r) => r.card.id === card.id)}
                title={`${cardName(card, locale)}: ${label('rule_' + card.kind)}`}
                aria-label={cardName(card, locale)}
                onclick={() => {
                  search = label(card.kind);
                  void open('guide');
                }}><Card {card} {locale} small /></button
              >{/each}
          </div>
        </section>
        {#if pub.phase === 'draft'}
          <section class="hand-area" aria-label={label('hand')}>
            {#if selectedCard && !priv.committed}<div class="selection-details">
                <span>{label('rule_' + selectedCard.kind)}</span
                >{#if priv.legalUtensils.length}<div class="utensil-choices">
                    <b>{label('utensils')}</b
                    >{#each priv.legalUtensils as id}{@const utensil =
                        own.tableau.find((c) => c.id === id)!}<button
                        class:chosen={armed.includes(id)}
                        aria-pressed={armed.includes(id)}
                        onclick={() => (armed = toggle(armed, id))}
                        >{label(utensil.kind)} {utensil.priority}</button
                      >{/each}
                  </div>{/if}
                {#if selectedCard.kind === 'special_order'}<div
                    class="copy-choices"
                  >
                    {#if priv.copyTargets.length}<label
                        >{label('copy_target')}<select bind:value={copyTarget}
                          ><option value="">{label('copy_target')}</option
                          >{#each priv.copyTargets as c}<option value={c.id}
                              >{cardName(c, locale)}{c.boxed
                                ? ` · ${label('boxed')}`
                                : ''}</option
                            >{/each}</select
                        ></label
                      >{#if copyTarget}<span class="ghost-copy"
                          ><Dish
                            card={priv.copyTargets.find(
                              (c) => c.id === copyTarget,
                            )!}
                          /><span>{label('copy_preview')}</span></span
                        >{/if}{:else}<span>{label('copy_first')}</span>{/if}
                  </div>{/if}
              </div>{/if}
            <div class="hand">
              {#each priv.hand as card, i (card.handle)}<button
                  style:--card-angle={`${(i - (priv.hand.length - 1) / 2) * 2.3}deg`}
                  style:--card-rise={`${Math.min(12, Math.abs(i - (priv.hand.length - 1) / 2) * 5)}px`}
                  style:--hand-overlap={`${priv.hand.length > 6 ? (562 - priv.hand.length * 90) / (priv.hand.length - 1) : 0}px`}
                  data-handle={card.handle}
                  class:selected={selection === card.handle}
                  class:committed={priv.committed?.card === card.handle}
                  disabled={!allowed || !!priv.committed}
                  aria-pressed={selection === card.handle}
                  aria-label={`${cardName(card, locale)}: ${label('rule_' + card.kind)}`}
                  onclick={() => {
                    if (selection !== card.handle) cue('pick');
                    selection = card.handle;
                    copyTarget = '';
                  }}><Card {card} {locale} /></button
                >{/each}
            </div>
            <div class="confirmation">
              <span
                >{label(
                  priv.committed ? 'locked' : selectedCard ? 'keep' : 'select',
                )}</span
              ><button
                class="primary"
                disabled={!allowed ||
                  !selectedCard ||
                  !!priv.committed ||
                  (selectedCard.kind === 'special_order' &&
                    priv.copyTargets.length > 0 &&
                    !copyTarget)}
                onclick={keep}>{priv.committed ? '✓' : label('keep')}</button
              >
            </div>
          </section>
        {/if}
      {/if}
    </div>
  </div>
</div>

<dialog
  class="sushi-dialog"
  class:px-tokens={pixel}
  class:sgp-pixel={pixel}
  {@attach modal(() => panel !== null)}
  onclose={() => (panel = null)}
>
  <button
    class="dialog-close"
    aria-label={label('close')}
    onclick={() => (panel = null)}>×</button
  >
  {#if panel === 'rules'}{@render rulesContent?.()}{:else if panel === 'guide'}<h2
    >
      {label('guide')}
    </h2>
    <input
      class="guide-search"
      type="search"
      placeholder={label('search')}
      aria-label={label('search')}
      bind:value={search}
    />
    <div class="dish-guide">
      {#each kinds.filter((k) => !search || `${label(k)} ${label('rule_' + k)}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase())) as kind}<article>
          <div class="guide-art">
            <Dish
              card={face(
                kind,
                kind === 'nigiri'
                  ? 'salmon'
                  : kind === 'onigiri'
                    ? 'triangle'
                    : '',
              )}
            />
          </div>
          <div>
            <h3>{label(kind)}</h3>
            <p>{label('rule_' + kind)}</p>
            <small
              >{label('color', {
                group: label(kind === 'wasabi' ? 'nigiri' : kind),
              })}</small
            >
          </div>
        </article>{/each}
    </div>
  {:else if panel === 'settings'}<h2>{label('settings')}</h2>
    <label class="setting"
      ><span>{label('sound')}</span><input
        type="checkbox"
        bind:checked={prefs.sound}
        onchange={gesture}
      /></label
    ><label class="setting"
      ><span>{label('volume')}</span><input
        type="range"
        min="0"
        max="1"
        step=".05"
        bind:value={prefs.volume}
      /></label
    ><label class="setting"
      ><span>{label('motion')}</span><input
        type="checkbox"
        checked={motion}
        onchange={(e) => (prefs.motion = e.currentTarget.checked)}
      /></label
    >
    <fieldset class="skin-choice">
      <legend>{m.skin()}</legend>
      {#each [['classic', m.skin_classic()], ['pixel', m.skin_pixel()]] as [value, text]}<label
          ><input
            type="radio"
            name="sgp-skin"
            {value}
            checked={skin.choice === value}
            onchange={() => skin.choose(value as Skin)}
          />{text}</label
        >{/each}
    </fieldset>
    {@render settingsContent?.()}
  {:else if panel === 'tray'}{@const seat = pub.players.find(
      (p) => p.id === tray,
    )}{#if seat}<h2>{name(seat.id)} · {seat.score} ✦</h2>
      <h3>{label('tableau')}</h3>
      <div class="tray-cards">
        {#each seat.tableau as card}<div>
            <Card {card} {locale} />
            <p>{card.boxed ? label('boxed') : label('rule_' + card.kind)}</p>
          </div>{/each}
      </div>
      <h3>{label('saved', { count: seat.desserts.length })}</h3>
      <div class="tray-cards">
        {#each seat.desserts as card}<Card {card} {locale} />{/each}
      </div>{/if}{/if}
</dialog>

<style>
  :global(body:has(.sushi-table)) {
    background:
      radial-gradient(ellipse at 49% 51%, #8fb69b66, transparent 65%),
      radial-gradient(ellipse at 7% 20%, #173f3333, transparent 35%), #578c79;
  }
  .sushi-table {
    --ink: #284b43;
    position: relative;
    isolation: isolate;
    width: 100%;
    height: 100dvh;
    min-height: 570px;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 49% 51%, #8fb69b66, transparent 65%),
      radial-gradient(ellipse at 7% 20%, #173f3333, transparent 35%), #578c79;
    color: var(--ink);
    font-family: ui-rounded, 'Trebuchet MS', system-ui, sans-serif;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
  }
  .table-grain {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(ellipse at center, #e8efda70, transparent 64%),
      repeating-linear-gradient(
        0deg,
        #31544b03 0,
        #31544b03 1px,
        transparent 1px,
        transparent 7px
      );
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    border: 1px solid #31544b35;
    background: #fff6df;
    border-radius: 10px;
    min-height: 44px;
    padding: 8px 14px;
    touch-action: manipulation;
  }
  button:disabled {
    cursor: default;
    opacity: 0.55;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 3px solid #9f483e;
    outline-offset: 4px;
  }
  button:hover:not(:disabled) {
    filter: brightness(1.035);
  }
  .primary {
    background: #cf705e;
    color: #fffbed;
    border-color: #a95746;
    font-weight: 800;
    box-shadow: 0 3px 0 #965340;
    font-size: 15px;
    min-height: 48px;
    padding: 10px 24px;
  }

  .table-wordmark {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    font-weight: 900;
    letter-spacing: 2px;
    font-size: 13px;
    white-space: nowrap;
  }
  .table-wordmark b {
    color: #b55e51;
  }
  .practice-action {
    border: 1px solid #728f78;
    border-radius: 12px;
    background: #e9efd9;
    color: #31544b;
    font-size: 10px;
    font-weight: 700;
    min-height: 44px;
    padding: 7px 10px;
    box-shadow: 0 3px 0 #31544b18;
  }

  .rich-practice-action {
    position: absolute;
    z-index: 6;
    left: 1053px;
    top: 846px;
    width: 180px;
    font-size: 13px;
  }
  .seat {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: 148px;
    z-index: 2;
  }

  .table-center {
    position: absolute;
    top: 32%;
    left: 50%;
    transform: translateX(-50%);
    text-align: center;
    width: min(480px, 62%);
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
    margin: 0 0 8px;
  }
  h1 {
    font-family: ui-rounded, 'Trebuchet MS', system-ui, sans-serif;
    font-size: clamp(24px, 3vw, 39px);
    letter-spacing: -1px;
    margin: 0 0 10px;
    line-height: 1.05;
  }
  h2 {
    font-size: 22px;
    line-height: 1.15;
    margin: 5px 0 16px;
  }
  p {
    line-height: 1.45;
  }

  .ready-count {
    font-size: 11px;
    font-weight: 700;
    margin: 9px 0;
  }
  .waiting-prompt {
    font-weight: 700;
    background: #fff5dba8;
    border-radius: 16px;
    padding: 10px;
    font-size: 13px;
  }
  .waiting-prompt small {
    display: block;
    font-size: 11px;
    margin-top: 4px;
  }
  .own-area {
    position: absolute;
    bottom: 258px;
    left: 50%;
    transform: translateX(-50%);
    width: min(780px, 82%);
    z-index: 2;
  }
  .own-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 15px 7px;
    font-size: 13px;
  }
  .own-label > span {
    font-weight: 800;
    max-width: 45%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .own-label small {
    font-size: 10px;
    margin-left: 7px;
    opacity: 0.6;
  }
  .dessert-badge {
    margin-left: auto;
    font-size: 10px;
    padding: 0 8px;
    min-height: 44px;
    background: #f1eed880;
    border: none;
  }
  .own-plate {
    display: flex;
    gap: 5px;
    min-height: 99px;
    align-items: center;
    justify-content: center;
    padding: 9px 22px;
    background: #fcf6df;
    border: 5px double #e4dfc3;
    box-shadow:
      0 5px 0 #31544b15,
      0 12px 24px #31544b10;
    border-radius: 48%;
    overflow-x: auto;
  }
  .own-plate > button {
    min-height: 0;
    padding: 0;
    background: none;
    border: 0;
    flex-shrink: 0;
  }
  .own-plate.empty p {
    font-size: 13px;
    color: #96a48b;
    font-style: italic;
  }
  .score-hit {
    outline: 3px solid #e1b650;
    outline-offset: 2px;
  }
  .scoring .own-label strong {
    animation: score-counter 550ms ease;
  }
  @keyframes score-counter {
    50% {
      transform: scale(1.18);
      color: #a56731;
    }
  }
  .wasabi-linked {
    box-shadow: 0 3px 0 #d6b451 !important;
  }
  .hand-area {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 4;
    background: linear-gradient(transparent 0, #a6c8b840 30%, #a6c8b8e0 100%);
    padding-top: 14px;
  }
  .hand {
    display: flex;
    justify-content: center;
    gap: 7px;
    padding: 19px 20px 10px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    min-height: 198px;
  }
  .hand > button,
  .choice-cards > button {
    border: 0;
    padding: 0;
    background: none;
    min-height: 0;
    flex-shrink: 0;
    transition: transform 140ms;
  }
  .hand > button.selected {
    transform: translateY(-12px) rotate(-2deg);
    filter: drop-shadow(0 0 3px #a25845);
  }
  .hand > button.committed {
    transform: translateY(-8px);
    filter: saturate(0.6);
  }
  .confirmation {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 22px;
    padding: 4px 16px max(12px, env(safe-area-inset-bottom));
    min-height: 60px;
  }
  .confirmation > span {
    font-size: 12px;
    font-weight: 700;
  }
  .selection-details {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: min(650px, 94%);
    background: #fff6e1f5;
    border: 1px solid #c3ccb4;
    padding: 9px 14px;
    border-radius: 14px;
    font-size: 12px;
    box-shadow: 0 5px 14px #284b4315;
    max-height: 170px;
    overflow: auto;
  }
  .utensil-choices,
  .copy-choices {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .utensil-choices button {
    min-height: 44px;
    padding: 4px 9px;
    font-size: 11px;
  }
  .chosen {
    outline: 3px solid #bd6e59 !important;
    outline-offset: 2px;
  }
  .copy-choices select {
    font-size: 12px;
    margin-left: 8px;
    max-width: 240px;
  }
  .ghost-copy {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
  }
  .ghost-copy :global(svg) {
    width: 40px;
    height: 35px;
    opacity: 0.6;
  }
  .menu-setup {
    position: absolute;
    top: 61px;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(730px, 76%);
    z-index: 5;
    text-align: center;
    overflow: auto;
    background: #f9f5e6ef;
    border: 2px solid #e5e4cb;
    border-radius: 32px;
    padding: 16px 28px;
    box-shadow: 0 12px 35px #31544b18;
    scrollbar-width: thin;
  }
  .setup-platter {
    display: flex;
    justify-content: center;
    height: 74px;
    margin-top: -8px;
  }
  .setup-platter :global(svg) {
    width: 90px;
  }
  .menu-setup > p:not(.eyebrow):not(.ready-count) {
    font-size: 13px;
    margin: 8px auto 15px;
    max-width: 460px;
  }
  .presets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 15px 0;
  }
  .presets button {
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
    text-align: left;
    font-size: 11px;
    font-weight: 800;
  }
  .preset-art {
    width: 34px;
    height: 38px;
    flex-shrink: 0;
  }
  .text-button {
    background: none;
    border: 0;
    text-decoration: underline;
    font-size: 12px;
  }
  .menu-strip {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin: 8px 0 17px;
    flex-wrap: wrap;
  }
  .menu-strip button {
    font-size: 9px;
    width: 70px;
    line-height: 1.2;
    padding: 4px;
    border: 0;
    background: #e9eed780;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 3px;
  }
  .menu-strip button > span {
    width: 48px;
    height: 42px;
  }
  .custom-menu {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    font-size: 10px;
    text-align: left;
  }
  .custom-menu label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .custom-menu button {
    font-size: 11px;
  }
  select,
  input {
    font: inherit;
    color: #284b43;
    border: 1px solid #a7bba9;
    border-radius: 8px;
    background: #fff9e9;
    padding: 9px;
    min-height: 44px;
    max-width: 100%;
  }
  .decision {
    position: absolute;
    z-index: 7;
    top: 31%;
    left: 50%;
    transform: translateX(-50%);
    width: min(650px, 90%);
    padding: 18px;
    background: #fff8e7f7;
    border: 2px solid #dfd8bb;
    border-radius: 24px;
    box-shadow: 0 12px 28px #31544b25;
    text-align: center;
    max-height: 53%;
    overflow: auto;
  }
  .decision .choice-cards {
    display: flex;
    gap: 12px;
    justify-content: center;
    overflow: auto;
    padding: 8px 5px 14px;
  }
  .decision h2 {
    font-size: 21px;
  }
  .request-row {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .request-row select {
    max-width: 220px;
  }
  .results {
    position: absolute;
    z-index: 6;
    top: 32%;
    bottom: 135px;
    left: 50%;
    transform: translateX(-50%);
    width: min(650px, 86%);
    padding: 18px 22px;
    background: #fff6e4f7;
    border: 2px solid #d9d9bc;
    border-radius: 22px;
    overflow: auto;
    text-align: center;
  }
  .receipts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 15px;
    text-align: left;
  }
  .receipts details {
    background: #e6edd97a;
    border-radius: 9px;
    padding: 8px 11px;
    align-self: start;
  }
  .receipts summary {
    cursor: pointer;
    min-height: 35px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .receipts summary span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .receipts p {
    font-size: 10px;
  }
  .score-line {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    line-height: 1.7;
  }
  .sushi-table[data-phase='round-end'] .own-area,
  .sushi-table[data-phase='finished'] .own-area {
    bottom: 10px;
  }
  .scoring .own-plate {
    animation: score-glow 550ms ease;
  }
  .sushi-dialog {
    color: #284b43;
    border: 3px solid #31544b;
    border-radius: 24px;
    background: #fff7e5;
    width: min(780px, calc(100vw - 28px));
    max-height: 85dvh;
    padding: 27px;
    box-sizing: border-box;
    font-family: ui-rounded, 'Trebuchet MS', system-ui, sans-serif;
  }
  .sushi-dialog::backdrop {
    background: #173d366b;
    backdrop-filter: blur(3px);
  }
  .dialog-close {
    position: sticky;
    top: 0;
    float: right;
    z-index: 2;
    width: 44px;
    padding: 4px;
    font-size: 24px;
  }
  .guide-search {
    width: 100%;
    margin: 8px 0 15px;
  }
  .dish-guide {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .dish-guide article {
    display: flex;
    gap: 10px;
    border-bottom: 1px solid #e0dec7;
    padding: 12px 0;
  }
  .guide-art {
    width: 70px;
    height: 70px;
    flex-shrink: 0;
  }
  .dish-guide h3 {
    margin: 0;
    font-size: 16px;
  }
  .dish-guide p {
    font-size: 12px;
    margin: 6px 0;
  }
  .dish-guide small {
    font-size: 9px;
    opacity: 0.7;
  }
  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    min-height: 64px;
    border-bottom: 1px solid #dfdeca;
  }
  .skin-choice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 18px;
    margin: 0;
    padding: 12px 0;
    min-height: 64px;
    box-sizing: border-box;
    border: 0;
    border-bottom: 1px solid #dfdeca;
  }
  .skin-choice legend {
    float: left;
    padding: 0;
    margin-right: auto;
  }
  .skin-choice label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .skin-choice input {
    width: 20px;
    height: 20px;
    min-height: 0;
    accent-color: #b96453;
  }
  .setting input[type='checkbox'] {
    width: 24px;
    height: 24px;
    accent-color: #b96453;
  }
  .setting input[type='range'] {
    padding: 0;
    width: 150px;
    accent-color: #b96453;
  }
  .tray-cards {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }
  .tray-cards > div {
    max-width: 150px;
  }
  .tray-cards p {
    font-size: 11px;
  }
  .reduce * {
    animation: none !important;
    transition: none !important;
  }
  @keyframes reveal {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) rotateY(85deg);
    }
    20%,
    55% {
      opacity: 1;
      transform: translate(-50%, -50%) rotateY(0);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -70%) rotateY(0);
    }
  }
  @keyframes score-glow {
    50% {
      box-shadow:
        0 0 0 7px #d7ae55,
        0 4px 25px #d7ae5560;
    }
  }
  @media (min-width: 1400px) {
    .seat {
      width: 174px;
    }

    .table-center {
      top: 29%;
    }
    .own-area {
      bottom: 266px;
    }
    .own-plate {
      min-height: 110px;
    }
  }
  @media (max-width: 1000px) {
    .seat {
      width: 116px;
    }

    .own-area {
      width: 92%;
      bottom: 252px;
    }
    .own-plate {
      justify-content: flex-start;
      border-radius: 55px;
      min-height: 87px;
      padding: 7px 15px;
    }
    .hand {
      justify-content: flex-start;
    }
    .table-center {
      top: 32%;
      width: 64%;
    }
    .table-center h1 {
      font-size: 25px;
    }

    .menu-setup {
      width: 83%;
      padding: 16px;
    }
    .presets {
      grid-template-columns: repeat(2, 1fr);
    }
    .custom-menu {
      grid-template-columns: 1fr 1fr;
    }
    .decision {
      max-height: 55%;
    }
    .results {
      top: 32%;
    }
    .dish-guide {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 500px) {
    .sushi-table {
      min-height: 600px;
    }

    .table-wordmark {
      top: 23px;
      font-size: 10px;
      letter-spacing: 1px;
    }
    .seat {
      width: 88px;
      top: calc(var(--y) * 0.82 + 24px);
    }

    .table-center {
      top: 30%;
      width: 60%;
    }
    .table-center h1 {
      font-size: 21px;
      margin-bottom: 6px;
    }
    .eyebrow {
      font-size: 9px;
      margin-bottom: 6px;
    }
    .ready-count {
      font-size: 10px;
    }

    .own-area {
      bottom: 246px;
      width: 96%;
    }
    .own-label {
      padding: 0 9px 3px;
      gap: 7px;
      font-size: 11px;
    }
    .own-label small {
      display: none;
    }
    .dessert-badge {
      font-size: 9px;
      padding: 0 4px;
    }
    .own-plate {
      min-height: 81px;
      padding: 5px 10px;
      border-width: 3px;
      gap: 4px;
    }
    .hand {
      gap: 6px;
      padding-left: 10px;
      padding-right: 10px;
      min-height: 194px;
    }
    .confirmation {
      gap: 8px;
      padding: 4px 10px max(10px, env(safe-area-inset-bottom));
    }
    .confirmation > span {
      font-size: 10px;
      max-width: 40%;
    }
    .confirmation .primary {
      font-size: 13px;
      padding: 10px 14px;
      flex: 1;
    }
    .selection-details {
      font-size: 11px;
      max-height: 190px;
    }
    .menu-setup {
      top: 63px;
      width: 95%;
      bottom: 8px;
      padding: 12px;
      border-radius: 23px;
    }
    .setup-platter {
      height: 56px;
    }
    .setup-platter :global(svg) {
      width: 70px;
    }
    .menu-setup h1 {
      font-size: 29px;
    }
    .menu-setup > p:not(.eyebrow):not(.ready-count) {
      font-size: 12px;
      margin-bottom: 8px;
    }
    .presets {
      gap: 8px;
      margin: 10px 0;
    }
    .presets button {
      font-size: 11px;
      min-height: 48px;
    }
    .preset-art {
      height: 32px;
      width: 33px;
    }
    .menu-strip {
      gap: 4px;
      margin: 5px 0 10px;
    }
    .menu-strip button {
      width: 65px;
      font-size: 9px;
    }
    .menu-strip button > span {
      height: 28px;
      width: 36px;
    }
    .decision {
      top: 28%;
      width: 96%;
      padding: 14px 10px;
      max-height: 64%;
      border-radius: 18px;
    }
    .decision .choice-cards {
      justify-content: flex-start;
    }
    .decision h2 {
      font-size: 18px;
    }
    .results {
      top: 28%;
      bottom: 124px;
      width: 96%;
      padding: 12px;
    }
    .receipts {
      gap: 5px;
    }
    .receipts details {
      padding: 5px 7px;
    }
    .receipts summary {
      font-size: 11px;
    }
    .sushi-dialog {
      padding: 18px;
      max-height: 91dvh;
    }
    .sushi-dialog h2 {
      font-size: 23px;
      padding-right: 40px;
    }
    .guide-art {
      width: 58px;
      height: 60px;
    }
    .setting {
      font-size: 13px;
    }
    .tray-cards {
      gap: 10px;
    }
    .tray-cards > div {
      max-width: 135px;
    }
    .copy-choices select {
      margin-left: 0;
      max-width: 100%;
    }
    .sushi-table:has(.seat:nth-of-type(7)) .seat {
      width: 72px;
    }
  }
  @media (max-width: 500px) and (max-height: 700px) {
    .seat {
      left: var(--short-x);
      top: var(--short-y);
      width: 72px;
    }

    .table-center {
      top: 207px;
      width: 94%;
    }
    .table-center .eyebrow {
      position: absolute;
      top: -160px;
      left: 0;
      right: 0;
    }
    .table-center h1,
    .table-center .ready-count {
      display: none;
    }
  }
  @media (max-height: 700px) and (min-width: 650px) {
    .sushi-table {
      min-height: 530px;
    }
    .seat {
      width: 105px;
      top: calc(var(--y) * 0.6 + 12px);
    }

    .table-center {
      top: 23%;
      left: 26%;
      width: 38%;
    }
    .table-center h1 {
      font-size: 23px;
    }
    .own-area {
      bottom: 233px;
      left: 64%;
      width: 62%;
    }
    .own-plate {
      min-height: 79px;
    }
    .decision {
      top: 23%;
      left: 60%;
      width: 62%;
      max-height: 72%;
    }
    .results {
      top: 22%;
      bottom: 100px;
    }
    .hand {
      min-height: 189px;
      padding-top: 13px;
    }
    .menu-setup {
      top: 59px;
      width: 76%;
    }
    .setup-platter {
      display: none;
    }
    .menu-setup h1 {
      font-size: 25px;
    }
    .presets {
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
    }
    .menu-strip {
      margin: 5px 0 8px;
    }
    .menu-strip button > span {
      height: 28px;
    }
    .menu-strip button {
      width: 60px;
    }
    .menu-setup > p:not(.eyebrow):not(.ready-count) {
      margin-bottom: 8px;
    }
    .selection-details {
      left: 65%;
      width: 65%;
      max-height: 160px;
    }
  }
  @media (max-width: 1099px), (max-height: 679px) {
  }
  @media (max-height: 500px) and (min-width: 650px) {
    .sushi-table {
      min-height: 0;
      height: 100dvh;
    }
    .seat {
      width: min(82px, calc((100vw - 128px) / var(--seat-count) - 6px));
      left: calc(64px + (100% - 128px) * var(--seat-fraction));
      top: 86px;
    }

    .table-center {
      top: 32%;
      left: 21%;
      width: 36%;
    }
    .table-center h1 {
      font-size: 21px;
    }

    .own-area {
      bottom: 16px;
      left: 21%;
      width: 38%;
    }
    .own-plate {
      min-height: 78px;
      border-radius: 40px;
      padding: 5px 12px;
    }
    .own-label {
      font-size: 10px;
      padding-bottom: 2px;
    }
    .own-label small {
      display: none;
    }
    .dessert-badge {
      font-size: 8px;
      min-height: 44px;
    }
    .hand-area {
      left: 42%;
      padding-top: 0;
    }
    .hand {
      min-height: 187px;
      padding: 13px 10px 6px;
      justify-content: flex-start;
    }
    .confirmation {
      min-height: 51px;
      padding: 0 10px max(9px, env(safe-area-inset-bottom));
    }
    .confirmation > span {
      display: none;
    }
    .confirmation .primary {
      width: 100%;
      min-height: 44px;
      padding: 8px;
      font-size: 13px;
    }
    .selection-details {
      left: 50%;
      width: 98%;
      max-height: 124px;
      font-size: 11px;
    }
    .decision {
      top: 68px;
      bottom: 66px;
      max-height: none;
      left: 62%;
      width: 72%;
      padding: 12px;
    }
    .decision h2 {
      font-size: 18px;
      margin-bottom: 8px;
    }
    .decision .choice-cards {
      justify-content: flex-start;
    }
    .results {
      top: 65px;
      bottom: 12px;
      left: 62%;
      width: 72%;
    }
    .sushi-table[data-phase='round-end'] .own-area,
    .sushi-table[data-phase='finished'] .own-area {
      display: none;
    }
    .menu-setup {
      top: 57px;
      bottom: 6px;
    }
    .table-wordmark {
      font-size: 10px;
    }
    .ready-count {
      font-size: 9px;
      margin-top: 5px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
