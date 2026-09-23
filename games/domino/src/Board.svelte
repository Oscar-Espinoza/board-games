<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import {
    RevisionGate,
    createAudio,
    modal,
    read,
    write,
  } from '@board-games/shared/ui';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  import type { Player } from '@board-games/game-core';
  import {
    TILES,
    TARGET,
    pips,
    teamOf,
    type Action,
    type End,
    type View,
  } from './index.js';
  import { layoutChain } from './layout.js';
  import Tile from './Tile.svelte';

  let {
    view,
    playerId,
    players,
    send,
    locale,
    round = 0,
    connected = true,
    pending = false,
    canRematch = false,
    rematch,
    rulesContent,
    settingsContent,
  }: {
    view: View;
    playerId: string;
    players: Player[];
    send: (action: unknown) => void;
    locale: Locale;
    round?: number;
    connected?: boolean;
    pending?: boolean;
    canRematch?: boolean;
    rematch?: () => void;
    rulesContent?: Snippet;
    settingsContent?: Snippet;
  } = $props();

  const L = $derived({ locale });
  const t = $derived.by(() => {
    const o = { locale };
    return {
      play: m.domino_play({}, o),
      pass: m.domino_pass({}, o),
      arrange: m.domino_arrange({}, o),
      rules: m.domino_rules({}, o),
      settings: m.domino_settings({}, o),
      close: m.domino_close({}, o),
      soft: m.domino_soft({}, o),
      hard: m.domino_hard({}, o),
      view: m.domino_camera({}, o),
      seated: m.domino_seated({}, o),
      overhead: m.domino_overhead({}, o),
      yourTurn: m.domino_your_turn({}, o),
      chooseEnd: m.domino_choose_end({}, o),
      nextHand: m.domino_next_hand({}, o),
      sound: m.domino_sound({}, o),
      motion: m.domino_motion({}, o),
      rename: m.domino_rename({}, o),
      holdHint: m.domino_hold_hint({}, o),
      passed: m.domino_passed({}, o),
    };
  });

  const pub = $derived(view.public);
  const own = $derived(Math.max(0, pub.players.indexOf(playerId)));
  /** 0 = you (south), 1 = right, 2 = partner (north), 3 = left. */
  const rel = (seat: number) => (seat - own + 4) % 4;
  const name = (seat: number) =>
    players.find((p) => p.id === pub.players[seat])?.name ?? `#${seat + 1}`;
  const seatAt = (r: number) => (own + r) % 4;
  const myTeam = $derived(teamOf(own));
  const myTurn = $derived(
    pub.phase === 'playing' && pub.turn === own && connected,
  );
  const hand = $derived(view.private.hand);
  const legal = $derived(view.private.legal);
  const mustPass = $derived(myTurn && legal[0]?.type === 'PASS');
  const playable = $derived(
    new Set(legal.flatMap((l) => (l.type === 'PLAY' ? [l.tileId] : []))),
  );
  const layout = $derived(layoutChain(pub.chain, pub.offsets, 6.5));
  // Tile thickness is stacked layers so perspective shows a solid side wall.
  const SLAB = [0, 1, 2, 3, 4, 5];
  /** Lamp-light shadow offset (down-right on the table), in the tile's own rotated frame. */
  const shadowAt = (deg: number) => {
    const a = (deg * Math.PI) / 180,
      dx = 0.14,
      dy = 0.3;
    return [
      dx * Math.cos(a) + dy * Math.sin(a),
      -dx * Math.sin(a) + dy * Math.cos(a),
    ];
  };
  const scattered = $derived(Object.keys(pub.offsets).length > 0);

  // Selection lifts a tile; a tile that fits both ends waits for an end choice.
  let selected = $state<number | null>(null),
    chosenEnd = $state<End | null>(null);
  const options = $derived(
    selected === null
      ? []
      : legal.flatMap((l) =>
          l.type === 'PLAY' && l.tileId === selected ? [l.end] : [],
        ),
  );
  const end = $derived<End | null>(
    options.length === 1 ? options[0] : chosenEnd,
  );
  const ready = $derived(
    myTurn && !pending && selected !== null && end !== null,
  );
  $effect(() => {
    // Drop a stale selection once the turn or hand moves on.
    if (!myTurn || (selected !== null && !playable.has(selected))) {
      selected = null;
      chosenEnd = null;
    }
  });
  function pick(id: number) {
    audio.unlock();
    if (!myTurn || !playable.has(id)) return;
    selected = selected === id ? null : id;
    chosenEnd = null;
    click(0.25);
  }

  // Strength: hold to charge, release to strike.
  let charge = $state(0),
    charging = $state(false),
    started = 0,
    frame = 0;
  function startCharge() {
    if (!ready || charging) return;
    audio.unlock();
    charging = true;
    started = performance.now();
    const tick = () => {
      charge = Math.min(1, (performance.now() - started) / 1100);
      if (charging) frame = requestAnimationFrame(tick);
    };
    tick();
  }
  function releaseCharge() {
    if (!charging) return;
    charging = false;
    cancelAnimationFrame(frame);
    if (ready)
      act({
        type: 'PLAY',
        tileId: selected!,
        end: end!,
        force: Math.round(charge * 100) / 100,
      });
    charge = 0;
  }
  function cancelCharge() {
    charging = false;
    cancelAnimationFrame(frame);
    charge = 0;
  }
  function act(action: Action) {
    audio.unlock();
    send(action);
    if (action.type === 'PLAY') {
      selected = null;
      chosenEnd = null;
    }
  }

  // Camera: 0 = seated at the table, 1 = straight overhead.
  const stored = Number(read('domino:camera'));
  let camera = $state(
    Number.isFinite(stored) && read('domino:camera') !== null ? stored : 0.25,
  );
  $effect(() => write('domino:camera', String(camera)));
  const tilt = $derived(54 - camera * 48);
  function wheel(e: WheelEvent) {
    if (settingsOpen || rulesOpen) return;
    camera = Math.max(0, Math.min(1, camera + e.deltaY * 0.0012));
  }

  // Preferences.
  let soundOn = $state(read('domino:sound') !== 'off'),
    motionSetting = $state(read('domino:motion')),
    settingsOpen = $state(false),
    rulesOpen = $state(false);
  const motion = $derived(
    motionSetting ? motionSetting !== 'off' : !prefersReducedMotion.current,
  );
  function preference(kind: 'sound' | 'motion', on: boolean) {
    write(`domino:${kind}`, on ? 'on' : 'off');
    if (kind === 'sound') {
      soundOn = on;
      if (!on) audio.stop();
      audio.unlock();
    } else motionSetting = on ? 'on' : 'off';
  }

  // Accepted-play effects: sound, drop and shake, only across consecutive revisions.
  const audio = createAudio();
  const gate = new RevisionGate();
  let dropping = $state<number | null>(null),
    shake = $state(0);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  function click(volume: number) {
    if (soundOn)
      audio.noise({
        duration: 0.05,
        volume: volume * 0.2,
        frequency: 2600,
        q: 1.4,
      });
  }
  function thud(force: number) {
    if (!soundOn) return;
    audio.noise({
      duration: 0.08 + force * 0.12,
      volume: 0.12 + force * 0.5,
      frequency: 900 - force * 500,
      sweep: 180,
      filter: 'lowpass',
      q: 0.8,
    });
    audio.noise({
      duration: 0.04,
      volume: 0.08 + force * 0.25,
      frequency: 3200,
      q: 1.2,
    });
    if (force > 0.55)
      for (let i = 0; i < 4; i++)
        audio.noise({
          delay: 0.06 + i * 0.045 + Math.random() * 0.03,
          duration: 0.035,
          volume: 0.05 + force * 0.08,
          frequency: 2200 + Math.random() * 1400,
          q: 2,
        });
  }
  function knock() {
    if (!soundOn) return;
    for (const delay of [0, 0.16])
      audio.noise({
        delay,
        duration: 0.07,
        volume: 0.22,
        frequency: 420,
        filter: 'lowpass',
      });
  }
  $effect(() => {
    const last = pub.last,
      fresh = gate.accept(pub.revision, String(round), connected);
    if (!fresh || !last) return;
    if (last.type === 'pass') return knock();
    if (pub.chain.length && pub.chain.some((l) => l.id === last.id)) {
      thud(last.force);
      if (!motion) return;
      dropping = last.id;
      later(() => (dropping = null), 420);
      if (last.force > 0.55) {
        shake++;
        const current = shake;
        later(() => {
          if (shake === current) shake = 0;
        }, 460);
      }
    }
  });
  onDestroy(() => {
    timers.forEach(clearTimeout);
    cancelAnimationFrame(frame);
    audio.close();
  });

  // Team names on the chalkboard.
  let editing = $state<0 | 1 | null>(null),
    draft = $state('');
  function startEdit(team: 0 | 1) {
    editing = team;
    draft = pub.teams[team];
  }
  function commitEdit() {
    const team = editing,
      value = draft.trim().slice(0, 16);
    editing = null;
    if (team !== null && value && value !== pub.teams[team])
      act({ type: 'RENAME_TEAM', team, name: value });
  }
  const focus = (el: HTMLInputElement) => {
    el.focus();
    el.select();
  };

  const status = $derived(
    pub.phase !== 'playing'
      ? ''
      : myTurn
        ? mustPass
          ? m.domino_blocked({}, L)
          : selected !== null && end === null
            ? t.chooseEnd
            : t.yourTurn
        : m.domino_turn_of({ name: name(pub.turn) }, { locale }),
  );
  const result = $derived(pub.result);
  const tiles = (seat: number) => result?.hands[seat] ?? [];
  const count = (seat: number) =>
    tiles(seat).reduce((sum, id) => sum + pips(id), 0);
  const handsLeft = (r: number) => pub.handCounts[seatAt(r)] ?? 0;
</script>

<section
  class="domino"
  class:still={!motion}
  style:--tilt="{tilt}deg"
  style:--camera={camera}
>
  <div class="backdrop" aria-hidden="true"></div>

  <button
    class="corner rules"
    onclick={() => (rulesOpen = true)}
    aria-label={t.rules}
    ><svg viewBox="0 0 24 24" aria-hidden="true"
      ><path
        d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 20a4 4 0 0 1 0-8h9"
      /></svg
    ><span>{t.rules}</span></button
  >
  <button
    class="corner settings"
    onclick={() => (settingsOpen = true)}
    aria-label={t.settings}
    ><span>{t.settings}</span><svg viewBox="0 0 24 24" aria-hidden="true"
      ><circle cx="12" cy="12" r="3.2" /><path
        d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"
      /></svg
    ></button
  >

  <div class="chalkboard">
    {#each [0, 1] as const as team}
      <div class="team" class:ours={team === myTeam}>
        {#if editing === team}<input
            {@attach focus}
            maxlength="16"
            aria-label={t.rename}
            bind:value={draft}
            onblur={commitEdit}
            onkeydown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') editing = null;
            }}
          />{:else}<button
            class="team-name"
            title={t.rename}
            onclick={() => startEdit(team)}>{pub.teams[team]}</button
          >{/if}
        <strong>{pub.scores[team]}</strong>
      </div>
      {#if team === 0}<span class="rule" aria-hidden="true"></span>{/if}
    {/each}
    <small>{m.domino_hand({ n: pub.handNumber, target: TARGET }, L)}</small>
  </div>

  <div class="stage" onwheel={wheel}>
    <div class="shaker" class:shake={shake > 0}>
      <div class="table">
        <div class="felt">
          {#each layout.tiles as p (p.id)}
            <div
              class="placed"
              class:double={TILES[p.id].a === TILES[p.id].b}
              class:drop={dropping === p.id}
              style:--x={p.x}
              style:--y={p.y}
              style:--r="{p.angle}deg"
              style:--lx={shadowAt(p.angle)[0]}
              style:--ly={shadowAt(p.angle)[1]}
              style:--force={pub.last?.type === 'play' ? pub.last.force : 0.3}
            >
              <span class="shadow"></span>
              {#each SLAB as z}<span class="slab" style:--z={z}></span>{/each}
              <span class="face"><Tile near={p.near} far={p.far} /></span>
            </div>
          {/each}
          {#if myTurn && selected !== null}
            {#if !pub.chain.length}<button
                class="ghost"
                style:--x={0}
                style:--y={0}
                style:--r="0deg"
                aria-label={t.play}
                onclick={() => (chosenEnd = 'right')}
              ></button>{:else if layout.next}{#each options as option}<button
                  class="ghost"
                  class:chosen={end === option}
                  style:--x={layout.next[option].x}
                  style:--y={layout.next[option].y}
                  style:--r="{layout.next[option].angle}deg"
                  aria-label={option === 'left'
                    ? m.domino_left_end({}, L)
                    : m.domino_right_end({}, L)}
                  aria-pressed={end === option}
                  onclick={() => {
                    chosenEnd = option;
                    click(0.2);
                  }}
                ></button>{/each}{/if}
          {/if}
        </div>

        {#each [1, 2, 3] as r}
          {@const seat = seatAt(r)}
          <div class="rail-hand r{r}" aria-hidden="true">
            {#each Array(result ? 0 : handsLeft(r)) as _}<span class="standing"
                >{#each SLAB as z}<span class="slab" style:--z={z}
                  ></span>{/each}<span class="face"
                  ><Tile back vertical={r === 2} /></span
                ></span
              >{/each}
          </div>
          <div
            class="plaque p{r}"
            class:active={pub.phase === 'playing' && pub.turn === seat}
          >
            <i aria-hidden="true"></i>{name(seat)}
            {#if pub.phase === 'playing' && pub.last?.type === 'pass' && pub.last.seat === seat}<em
                >{t.passed}</em
              >{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="tray">
    <div
      class="plaque mine"
      class:active={pub.phase === 'playing' && pub.turn === own}
    >
      <i aria-hidden="true"></i>{name(own)}{#if status}<em role="status"
          >{status}</em
        >{/if}
    </div>
    <div class="controls left">
      <button
        class="wood"
        disabled={!mustPass || pending}
        onclick={() => act({ type: 'PASS' })}>{t.pass}</button
      >
      <button
        class="wood small"
        disabled={!scattered || pending}
        onclick={() => act({ type: 'ARRANGE' })}>{t.arrange}</button
      >
    </div>
    <div class="rack" role="group" aria-label={m.domino_your_tiles({}, L)}>
      {#each hand as id (id)}
        <button
          class="rack-tile"
          class:lifted={selected === id}
          class:dim={myTurn && !playable.has(id)}
          aria-pressed={selected === id}
          aria-label={`${TILES[id].a}–${TILES[id].b}`}
          onclick={() => pick(id)}
          ><Tile near={TILES[id].b} far={TILES[id].a} vertical /></button
        >
      {/each}
    </div>
    <div class="controls right">
      <div class="meter" class:live={charging} aria-hidden="true">
        <span style:--charge={charge}></span>
        <small>{t.soft}</small><small>{t.hard}</small>
      </div>
      <button
        class="wood strike"
        disabled={!ready}
        title={t.holdHint}
        onpointerdown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          startCharge();
        }}
        onpointerup={releaseCharge}
        onpointercancel={cancelCharge}
        onkeydown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            startCharge();
          }
        }}
        onkeyup={(e) => {
          if (e.key === ' ' || e.key === 'Enter') releaseCharge();
        }}>{t.play}</button
      >
    </div>
  </div>

  <div class="camera" role="group" aria-label={t.view}>
    <button
      aria-label={t.seated}
      title={t.seated}
      aria-pressed={camera === 0}
      onclick={() => (camera = 0)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" /><circle
          cx="12"
          cy="12"
          r="2.5"
        /></svg
      ></button
    >
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      aria-label={t.view}
      bind:value={camera}
    />
    <button
      aria-label={t.overhead}
      title={t.overhead}
      aria-pressed={camera === 1}
      onclick={() => (camera = 1)}
      ><svg viewBox="0 0 24 24" aria-hidden="true"
        ><rect x="5" y="5" width="14" height="14" rx="2" /><path
          d="M12 1v3M12 20v3"
        /></svg
      ></button
    >
  </div>

  {#if result}
    <div class="result" role="dialog" aria-labelledby="domino-result">
      <h2 id="domino-result">
        {result.kind === 'domino'
          ? m.domino_domino({}, L)
          : m.domino_tranque({}, L)}
      </h2>
      <p>
        {#if result.winner === null}{m.domino_tie(
            {},
            L,
          )}{:else}{m.domino_points(
            { team: pub.teams[result.winner], points: result.points },
            L,
          )}{/if}
      </p>
      <ul>
        {#each [0, 1, 2, 3] as seat}
          <li class:winner={result.seat === seat}>
            <span>{name(seat)}</span>
            <span class="revealed"
              >{#each tiles(seat) as id}<span class="mini"
                  ><Tile near={TILES[id].a} far={TILES[id].b} /></span
                >{/each}</span
            >
            <b>{count(seat)}</b>
          </li>
        {/each}
      </ul>
      {#if pub.phase === 'finished'}
        <p class="winner-line">
          {m.domino_match_won(
            { team: pub.teams[pub.scores[0] >= TARGET ? 0 : 1] },
            L,
          )}
        </p>
        {#if canRematch && rematch}<button class="wood" onclick={rematch}
            >{m.domino_new_match({}, L)}</button
          >{/if}
      {:else}
        <button
          class="wood"
          disabled={pending}
          onclick={() => act({ type: 'NEXT_HAND' })}>{t.nextHand}</button
        >
      {/if}
    </div>
  {/if}

  <dialog
    class="panel"
    aria-label={t.settings}
    {@attach modal(() => settingsOpen)}
    onclose={() => (settingsOpen = false)}
    onclick={(e) => {
      if (e.target === e.currentTarget) settingsOpen = false;
    }}
  >
    <header>
      <h2>{t.settings}</h2>
      <button
        class="close"
        aria-label={t.close}
        onclick={() => (settingsOpen = false)}>×</button
      >
    </header>
    <div class="panel-body">
      <label class="toggle"
        ><input
          type="checkbox"
          checked={soundOn}
          onchange={(e) => preference('sound', e.currentTarget.checked)}
        />{t.sound}</label
      >
      <label class="toggle"
        ><input
          type="checkbox"
          checked={motion}
          onchange={(e) => preference('motion', e.currentTarget.checked)}
        />{t.motion}</label
      >
      <label
        >{t.view}<input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={camera}
        /></label
      >
      {@render settingsContent?.()}
    </div>
  </dialog>
  <dialog
    class="panel wide"
    aria-label={t.rules}
    {@attach modal(() => rulesOpen)}
    onclose={() => (rulesOpen = false)}
    onclick={(e) => {
      if (e.target === e.currentTarget) rulesOpen = false;
    }}
  >
    <header>
      <h2>{t.rules}</h2>
      <button
        class="close"
        aria-label={t.close}
        onclick={() => (rulesOpen = false)}>×</button
      >
    </header>
    <div class="panel-body">{@render rulesContent?.()}</div>
  </dialog>
</section>

<style>
  @font-face {
    font-family: 'Domino Plaque';
    src: url('/fonts/carcassonne/marcellus.woff2') format('woff2');
    font-display: swap;
  }
  @font-face {
    font-family: 'Domino Chalk';
    src: url('/fonts/little-secret/kalam.woff2') format('woff2');
    font-display: swap;
  }
  .domino {
    --wood-dark: #2a170c;
    --wood: #5a3519;
    --wood-light: #8a5a30;
    --brass: #d6a54f;
    --ink: #f3e6cc;
    --lamp: #ffb347;
    /* Table size: a tile's short side. */
    --u: min(3.8vw, calc((100vh - 130px) / 22.5));
    position: absolute;
    inset: 0;
    /* clip, not hidden: focusing a tile on the 3D plane must never scroll the table. */
    overflow: clip;
    background: #0d0906;
    color: var(--ink);
    font-family: 'Domino Plaque', Georgia, serif;
    user-select: none;
    -webkit-user-select: none;
  }
  .backdrop {
    position: absolute;
    inset: -4%;
    background:
      linear-gradient(to bottom, transparent 40%, #0d0906 92%),
      url('/games/domino/patio.webp') center 20% / cover,
      radial-gradient(ellipse at 50% 20%, #3b2a1a, #0d0906 70%);
    transform: translateY(calc(var(--camera) * -18%))
      scale(calc(1 + var(--camera) * 0.12));
    opacity: calc(1 - var(--camera) * 0.55);
    transition: transform 0.2s ease-out;
  }

  /* Corners */
  .corner {
    position: absolute;
    z-index: 6;
    top: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 14px;
    border: 2px solid #1c0f07;
    border-radius: 6px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 60%);
    box-shadow:
      inset 0 1px 0 rgb(255 220 170 / 0.25),
      0 4px 10px rgb(0 0 0 / 0.5);
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    cursor: pointer;
  }
  .rules {
    left: 14px;
  }
  .settings {
    right: 14px;
  }
  .corner svg,
  .camera svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Chalkboard scoreboard */
  .chalkboard {
    position: absolute;
    z-index: 5;
    top: 10px;
    left: 50%;
    translate: -50% 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2px 18px;
    padding: 10px 26px 8px;
    border: 7px solid #6b4424;
    border-radius: 4px;
    background:
      radial-gradient(ellipse at 40% 30%, rgb(255 255 255 / 0.08), transparent),
      #1f2421;
    box-shadow:
      inset 0 0 18px rgb(0 0 0 / 0.6),
      0 8px 18px rgb(0 0 0 / 0.55);
    font-family: 'Domino Chalk', cursive;
    color: #eeeadf;
    text-align: center;
  }
  .team {
    display: grid;
    min-width: 96px;
  }
  .team-name,
  .team input {
    font: inherit;
    font-size: 17px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: inherit;
    background: none;
    border: 0;
    padding: 0 4px;
    cursor: text;
  }
  .team input {
    width: 9em;
    border-bottom: 1px dashed rgb(255 255 255 / 0.5);
    text-align: center;
    outline: none;
  }
  .team strong {
    font-size: 34px;
    line-height: 1;
    font-weight: 400;
  }
  .team:not(.ours) strong {
    color: #f19b8c;
  }
  .rule {
    width: 2px;
    height: 44px;
    background: rgb(255 255 255 / 0.5);
    border-radius: 2px;
  }
  .chalkboard small {
    grid-column: 1 / -1;
    font-size: 12px;
    opacity: 0.65;
  }

  /* Table in perspective */
  .stage {
    position: absolute;
    inset: 0;
    perspective: calc(var(--u) * 60);
    perspective-origin: 50% 30%;
  }
  .shaker {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
    transform-style: preserve-3d;
  }
  .shake {
    animation: shake 0.42s ease-out;
  }
  @keyframes shake {
    20% {
      translate: calc(var(--u) * 0.25) calc(var(--u) * -0.1);
    }
    45% {
      translate: calc(var(--u) * -0.2) calc(var(--u) * 0.12);
    }
    70% {
      translate: calc(var(--u) * 0.1) 0;
    }
  }
  .table {
    --size: calc(var(--u) * 22);
    position: absolute;
    left: calc(var(--size) / -2);
    top: calc(var(--size) / -2);
    width: var(--size);
    height: var(--size);
    transform-style: preserve-3d;
    transform: translateY(calc(var(--u) * (2.9 - var(--camera) * 1.4)))
      rotateX(var(--tilt));
    transition: transform 0.2s ease-out;
    border-radius: calc(var(--u) * 1.2);
    background:
      url('/games/domino/table-top.webp') center / cover,
      radial-gradient(ellipse, #7a5635 0 58%, #4a2c15 60%, #2a170c 80%);
    box-shadow: 0 calc(var(--u) * 2) calc(var(--u) * 3) rgb(0 0 0 / 0.7);
  }
  .felt {
    position: absolute;
    inset: 10.5%;
    transform-style: preserve-3d;
  }
  .placed,
  .ghost {
    position: absolute;
    left: calc(50% + var(--x) * var(--u) - var(--u));
    /* The chain sits a little above centre: the near rail is partly behind your rack. */
    top: calc(50% + (var(--y) - 2) * var(--u) - var(--u) / 2);
    width: calc(var(--u) * 2);
    height: var(--u);
    font-size: var(--u);
    /* Lifted off the felt so 3D hit-testing never picks the coplanar felt. */
    transform: translateZ(1px) rotate(var(--r));
    transition:
      left 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15),
      top 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15),
      transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15);
  }
  .placed {
    transform-style: preserve-3d;
  }
  .placed > span {
    position: absolute;
    inset: 0;
    border-radius: 12% / 24%;
  }
  .shadow {
    box-shadow:
      calc(var(--lx) * var(--u)) calc(var(--ly) * var(--u)) calc(var(--u) * 0.3)
        rgb(20 10 4 / 0.55),
      calc(var(--lx) * var(--u) * 0.3) calc(var(--ly) * var(--u) * 0.3)
        calc(var(--u) * 0.08) rgb(20 10 4 / 0.5);
  }
  .slab {
    background: linear-gradient(90deg, #c2b18a, #d6c7a3 50%, #bba982);
    transform: translateZ(calc(var(--z) * var(--u) * 0.06));
  }
  .slab:first-of-type {
    background: #a8966e;
  }
  .face {
    transform: translateZ(calc(var(--u) * 0.36));
  }
  .drop {
    animation: drop calc(0.42s - var(--force) * 0.18s)
      cubic-bezier(0.5, 0, 0.9, 0.6);
  }
  @keyframes drop {
    from {
      transform: translateZ(calc(var(--u) * 4)) rotate(var(--r)) scale(1.08);
      opacity: 0.5;
    }
  }
  .ghost {
    border: 0;
    padding: 0;
    border-radius: 0.18em;
    background: rgb(255 244 220 / 0.18);
    box-shadow: inset 0 0 0 1px rgb(255 244 220 / 0.35);
    cursor: pointer;
  }
  .ghost {
    transform: translateZ(2px) rotate(var(--r));
  }
  .ghost.chosen {
    background: rgb(255 244 220 / 0.42);
  }

  /* Opponents' tiles stand along their rails, backs showing. */
  .rail-hand {
    position: absolute;
    display: flex;
    gap: calc(var(--u) * 0.1);
    transform-style: preserve-3d;
  }
  /* Positions follow the grooves carved in table-top.webp. */
  .rail-hand.r2 {
    top: 1.2%;
    left: 50%;
    translate: -50% 0;
  }
  .rail-hand.r1,
  .rail-hand.r3 {
    top: 50%;
    flex-direction: column;
    translate: 0 -50%;
  }
  .rail-hand.r1 {
    right: 3.2%;
  }
  .rail-hand.r3 {
    left: 3.2%;
  }
  .standing {
    display: block;
    font-size: var(--u);
    transform-style: preserve-3d;
  }
  .standing > span {
    position: absolute;
    inset: 0;
    border-radius: 12% / 24%;
  }
  .r2 .standing > span {
    border-radius: 24% / 12%;
  }
  .standing {
    position: relative;
  }
  .r2 .standing {
    width: var(--u);
    height: calc(var(--u) * 2);
    transform-origin: 50% 100%;
    transform: rotateX(-68deg);
  }
  .r1 .standing,
  .r3 .standing {
    width: calc(var(--u) * 2);
    height: var(--u);
  }
  .r1 .standing {
    transform-origin: 100% 50%;
    transform: rotateY(58deg);
  }
  .r3 .standing {
    transform-origin: 0 50%;
    transform: rotateY(-58deg);
  }

  /* Engraved plaques fixed to the rails */
  .plaque {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 0.45em;
    padding: 0.3em 0.8em;
    border: 1px solid #2a180b;
    border-radius: 4px;
    background: linear-gradient(170deg, #f0e2c4, #d7c197);
    box-shadow:
      inset 0 0 6px rgb(90 60 30 / 0.45),
      0 2px 4px rgb(0 0 0 / 0.5);
    color: #3a2412;
    font-size: calc(var(--u) * 0.72);
    white-space: nowrap;
  }
  .plaque i {
    width: 0.55em;
    height: 0.55em;
    border-radius: 50%;
    background: #6f5a3e;
    box-shadow: inset 0 1px 1px rgb(0 0 0 / 0.5);
  }
  .plaque.active i {
    background: var(--lamp);
    box-shadow:
      0 0 0.5em var(--lamp),
      0 0 1.2em rgb(255 170 60 / 0.6);
  }
  .plaque em {
    font-style: normal;
    font-size: 0.75em;
    opacity: 0.75;
  }
  .p2 {
    top: 10.5%;
    left: 50%;
    translate: -50% 0;
  }
  .p1 {
    right: 7%;
    top: 27%;
  }
  .p3 {
    left: 7%;
    top: 27%;
  }

  /* Your tray */
  .tray {
    position: absolute;
    z-index: 4;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 12px;
    padding: 0 16px 12px;
    pointer-events: none;
  }
  .tray > * {
    pointer-events: auto;
  }
  .plaque.mine {
    position: static;
    grid-column: 2;
    justify-self: center;
    font-size: 16px;
    margin-bottom: -4px;
    z-index: 1;
  }
  .rack {
    grid-column: 2;
    grid-row: 2;
    display: flex;
    gap: 6px;
    padding: 18px 16px 12px;
    border: 2px solid #1a0d05;
    border-radius: 8px;
    background:
      linear-gradient(to bottom, rgb(0 0 0 / 0.55), transparent 30%),
      repeating-linear-gradient(
        92deg,
        rgb(255 255 255 / 0.03) 0 3px,
        transparent 3px 11px
      ),
      linear-gradient(175deg, #6b401f, #3d2210);
    box-shadow:
      inset 0 3px 8px rgb(0 0 0 / 0.6),
      0 -2px 0 #8a5a30,
      0 10px 22px rgb(0 0 0 / 0.6);
    max-width: calc(100vw - 32px);
    overflow-x: auto;
  }
  .rack-tile {
    --h: clamp(72px, 15vh, 140px);
    flex: none;
    width: calc(var(--h) / 2);
    height: var(--h);
    padding: 0;
    border: 0;
    background: none;
    font-size: calc(var(--h) / 2);
    cursor: pointer;
    transition:
      transform 0.18s ease-out,
      opacity 0.2s;
  }
  .rack-tile :global(.tile) {
    box-shadow:
      inset 0.05em 0.05em 0.04em rgb(255 255 255 / 0.65),
      inset -0.05em -0.06em 0.08em rgb(110 88 55 / 0.4),
      0 0.06em 0 #cdbd97,
      0 0.12em 0 #b09f78,
      0 0.25em 0.3em rgb(0 0 0 / 0.55);
  }
  .rack-tile.lifted {
    transform: translateY(-16px);
  }
  .rack-tile.lifted :global(.tile) {
    box-shadow:
      inset 0.05em 0.05em 0.04em rgb(255 255 255 / 0.65),
      inset -0.05em -0.06em 0.08em rgb(110 88 55 / 0.4),
      0 0.06em 0 #cdbd97,
      0 0.12em 0 #b09f78,
      0 0.6em 0.5em rgb(0 0 0 / 0.45);
  }
  .rack-tile:focus:not(:focus-visible) {
    outline: none;
  }
  .rack-tile:focus-visible {
    outline: 2px solid var(--brass);
    outline-offset: 3px;
  }
  .controls {
    grid-row: 2;
    display: flex;
    gap: 10px;
    align-items: end;
    margin-bottom: 10px;
  }
  .controls.left {
    grid-column: 1;
    justify-self: end;
    flex-direction: column;
    align-items: stretch;
  }
  .controls.right {
    grid-column: 3;
    justify-self: start;
    flex-direction: column;
    align-items: stretch;
  }
  .wood {
    min-height: 48px;
    padding: 10px 18px;
    border: 2px solid #1a0d05;
    border-radius: 6px;
    background:
      repeating-linear-gradient(
        88deg,
        rgb(255 255 255 / 0.04) 0 2px,
        transparent 2px 9px
      ),
      linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    box-shadow:
      inset 0 1px 0 rgb(255 220 170 / 0.25),
      0 4px 10px rgb(0 0 0 / 0.5);
    color: var(--ink);
    font: inherit;
    font-size: 17px;
    cursor: pointer;
    touch-action: none;
  }
  .wood.small {
    min-height: 40px;
    font-size: 14px;
  }
  .wood:disabled {
    filter: brightness(0.7) saturate(0.6);
    color: rgb(243 230 204 / 0.6);
    cursor: default;
  }
  .wood:not(:disabled):active {
    translate: 0 1px;
  }
  .meter {
    position: relative;
    display: flex;
    justify-content: space-between;
    height: 22px;
    padding: 0 6px;
    border: 1px solid #1a0d05;
    border-radius: 11px;
    background: #24140a;
    overflow: hidden;
    font-size: 10px;
    line-height: 22px;
    opacity: 0.55;
    transition: opacity 0.15s;
  }
  .meter.live {
    opacity: 1;
  }
  .meter span {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--charge));
    background: linear-gradient(90deg, #c9a15a, #e2742e 70%, #c63a22);
  }
  .meter small {
    position: relative;
    z-index: 1;
    text-shadow: 0 1px 1px #000;
  }

  /* Camera */
  .camera {
    position: absolute;
    z-index: 5;
    right: 14px;
    top: 50%;
    translate: 0 -50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    border-radius: 22px;
    background: rgb(26 14 6 / 0.72);
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.5);
  }
  .camera button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }
  .camera button[aria-pressed='true'] {
    color: var(--brass);
  }
  .camera input {
    writing-mode: vertical-lr;
    height: 110px;
    width: 24px;
    accent-color: var(--brass);
  }

  /* Hand result */
  .result {
    position: absolute;
    z-index: 7;
    left: 50%;
    top: 46%;
    translate: -50% -50%;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 120px);
    overflow: auto;
    padding: 20px 24px;
    border: 3px solid #1a0d05;
    border-radius: 10px;
    background:
      repeating-linear-gradient(
        91deg,
        rgb(255 255 255 / 0.03) 0 3px,
        transparent 3px 12px
      ),
      linear-gradient(170deg, #6b401f, #3d2210);
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.7);
    text-align: center;
  }
  .result h2 {
    margin: 0;
    font-size: 30px;
    font-weight: 400;
    color: var(--brass);
  }
  .result p {
    margin: 6px 0 14px;
  }
  .result ul {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .result li {
    display: grid;
    grid-template-columns: 6.5em 1fr 2.5em;
    align-items: center;
    gap: 10px;
    text-align: left;
  }
  .result li.winner span:first-child {
    color: var(--brass);
  }
  .revealed {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .mini {
    display: block;
    width: 36px;
    height: 18px;
    font-size: 18px;
  }
  .winner-line {
    font-size: 20px;
    color: var(--brass);
  }

  /* Dialogs */
  dialog.panel {
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 3px solid #1a0d05;
    border-radius: 10px;
    background: #f1e4c8;
    color: #2b1a0c;
    box-shadow: 0 18px 40px rgb(0 0 0 / 0.6);
  }
  dialog.wide {
    width: min(760px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: rgb(10 6 3 / 0.6);
  }
  dialog header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood));
    color: var(--ink);
  }
  dialog h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 400;
  }
  .close {
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    color: inherit;
    font-size: 26px;
    cursor: pointer;
  }
  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    font-family: system-ui, sans-serif;
  }
  .panel-body label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .panel-body label.toggle {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .panel-body input[type='range'] {
    accent-color: #8a5a30;
  }
  .panel-body :global(:is(a, button, select):not(.close)) {
    min-height: 40px;
  }

  .still .placed,
  .still .table,
  .still .backdrop,
  .still .rack-tile {
    transition: none;
  }

  @media (max-width: 720px), (max-height: 520px) {
    .domino {
      --u: min(3.7vw, 3.4vh);
    }
    .corner span {
      display: none;
    }
    .chalkboard {
      padding: 6px 14px 4px;
      gap: 0 10px;
      border-width: 5px;
    }
    .team {
      min-width: 70px;
    }
    .team-name,
    .team input {
      font-size: 13px;
    }
    .team strong {
      font-size: 24px;
    }
    .tray {
      grid-template-columns: 1fr 1fr;
      padding: 0 8px 8px;
      gap: 8px;
    }
    .plaque.mine,
    .rack {
      grid-column: 1 / -1;
    }
    .rack {
      grid-row: 2;
      justify-self: center;
      padding: 12px 8px 8px;
      gap: 4px;
    }
    .rack-tile {
      --h: clamp(56px, 11vh, 80px);
    }
    .controls {
      grid-row: 3;
      margin: 0;
      flex-direction: row !important;
    }
    .controls.left {
      grid-column: 1;
      justify-self: start;
    }
    .controls.right {
      grid-column: 2;
      justify-self: end;
    }
    .meter {
      width: 90px;
      align-self: center;
    }
    .camera {
      top: auto;
      bottom: 45%;
      right: 6px;
    }
    .camera input {
      height: 80px;
    }
  }
</style>
