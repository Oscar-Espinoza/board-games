<script lang="ts">
  import { onDestroy, onMount, type Snippet } from 'svelte';
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
    attach,
    pips,
    teamOf,
    type Action,
    type End,
    type View,
  } from './index.js';
  import { idealPoses, placements, plug } from './layout.js';
  import type { Rect, TableScene, TableState } from './three/scene.js';
  import Tile from './Tile.svelte';
  import Loading from './Loading.svelte';

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
      before: m.domino_seat_before({}, o),
      partner: m.domino_seat_partner({}, o),
      after: m.domino_seat_after({}, o),
    };
  });

  const pub = $derived(view.public);
  const own = $derived(Math.max(0, pub.players.indexOf(playerId)));
  /** 0 = you (front), 1 = right, 2 = partner (far rail), 3 = left. */
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
  const scattered = $derived.by(() => {
    const home = idealPoses(pub.chain);
    return pub.chain.some(({ id }) => {
      const a = pub.poses[id],
        b = home[id];
      return (
        !!a &&
        (Math.abs(a.x - b.x) > 0.01 ||
          Math.abs(a.y - b.y) > 0.01 ||
          Math.abs(a.angle - b.angle) > 0.5)
      );
    });
  });

  // Selection lifts a tile and shows a ghost on each end it fits; pressing a
  // ghost plays there, harder the longer it is held.
  let selected = $state<number | null>(null),
    chosenEnd = $state<End | null>(null);
  const options = $derived(
    selected === null
      ? []
      : legal.flatMap((l) =>
          l.type === 'PLAY' && l.tileId === selected ? [l.end] : [],
        ),
  );
  const ready = $derived(myTurn && !pending && selected !== null);
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
  /** Ghosts plug onto each open end exactly where that end tile lies now. */
  const ghosts = $derived(
    selected === null
      ? []
      : options.map((option) => ({
          end: option,
          pose: plug(
            attach(pub.chain, selected!, option),
            pub.poses,
            selected!,
          ),
          chosen: chosenEnd === option,
        })),
  );

  // Strength: hold to charge, release to strike.
  let charge = $state(0),
    charging = $state(false),
    started = 0,
    frame = 0;
  function startCharge(at: End) {
    if (!ready || charging || !options.includes(at)) return;
    audio.unlock();
    chosenEnd = at;
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
    if (ready && chosenEnd)
      act({
        type: 'PLAY',
        tileId: selected!,
        end: chosenEnd,
        force: Math.round(charge * 100) / 100,
      });
    charge = 0;
  }
  function cancelCharge() {
    charging = false;
    chosenEnd = null;
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

  // Phones get a compact layout: an overhead view zoomed to the chain, with your
  // hand and buttons in an HTML bar, and a lighter renderer.
  const COMPACT = '(max-width: 720px), (max-height: 520px)';
  const media = (q: string) =>
    typeof window !== 'undefined' && window.matchMedia(q).matches;
  let compact = $state(media(COMPACT));
  onMount(() => {
    const q = window.matchMedia(COMPACT);
    const change = () => (compact = q.matches);
    q.addEventListener('change', change);
    return () => q.removeEventListener('change', change);
  });

  // Camera: 0 = seated at the table, 1 = straight overhead.
  const stored = read('domino:camera');
  let camera = $state(
    stored !== null && Number.isFinite(Number(stored)) ? Number(stored) : 0.15,
  );
  $effect(() => write('domino:camera', String(camera)));
  function wheel(e: WheelEvent) {
    if (settingsOpen || rulesOpen || compact) return;
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

  // Sound for accepted plays and passes, only across consecutive revisions.
  const audio = createAudio();
  const gate = new RevisionGate();
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
    if (pub.chain.some((l) => l.id === last.id)) {
      // The tile lands a moment after it leaves the hand.
      setTimeout(() => thud(last.force), motion ? 300 - last.force * 120 : 0);
      if (motion && last.force > 0.55)
        setTimeout(() => scene?.shake(last.force), 260);
    }
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
          : selected !== null
            ? t.chooseEnd
            : t.yourTurn
        : m.domino_turn_of({ name: name(pub.turn) }, { locale }),
  );
  const result = $derived(pub.result);
  const tiles = (seat: number) => result?.hands[seat] ?? [];
  const count = (seat: number) =>
    tiles(seat).reduce((sum, id) => sum + pips(id), 0);
  const handsLeft = (r: number) =>
    result ? 0 : (pub.handCounts[seatAt(r)] ?? 0);
  const plaqueName = (seat: number) =>
    pub.phase === 'playing' &&
    pub.last?.type === 'pass' &&
    pub.last.seat === seat
      ? `${name(seat)} · ${t.passed}`
      : name(seat);

  // The three.js table.
  const tableState = $derived<TableState>({
    placements: placements(pub.chain, pub.poses),
    ghosts,
    rack: hand.map((id) => ({
      id,
      near: TILES[id].a,
      far: TILES[id].b,
      lifted: selected === id,
    })),
    standing: [handsLeft(1), handsLeft(2), handsLeft(3)],
    names: [
      plaqueName(own),
      plaqueName(seatAt(1)),
      plaqueName(seatAt(2)),
      plaqueName(seatAt(3)),
    ],
    active: pub.phase === 'playing' ? rel(pub.turn) : null,
    status: myTurn ? status : null,
    labels: { pass: t.pass, arrange: t.arrange },
    enabled: {
      pass: mustPass && !pending,
      arrange: scattered && !pending,
    },
    charge,
    camera,
    motion,
    last:
      pub.last?.type === 'play'
        ? { id: pub.last.id, from: rel(pub.last.seat), force: pub.last.force }
        : null,
    compact,
  });
  let canvas = $state<HTMLCanvasElement>(),
    scene = $state<TableScene | null>(null),
    rects = $state<Record<string, Rect>>({}),
    failed = $state(false),
    // Loading: the three.js code, then art (textures, font), then shaders.
    loaded = $state<number | null>(null),
    shown = $state(false),
    covered = $state(true);
  onMount(() => {
    let alive = true;
    import('./three/scene.js')
      .then(({ createTable }) => {
        if (!alive || !canvas) return;
        loaded = 0;
        scene = createTable(canvas, {
          // Touch devices with small screens render the light table.
          lite:
            compact ||
            (media('(pointer: coarse)') &&
              Math.min(screen.width, screen.height) < 820),
          onRects: (r) => (rects = r),
          onProgress: (p) => (loaded = Math.max(loaded ?? 0, p)),
          onReady: () => {
            // Let the last loading tiles land, then lift the cover as the hands deal in.
            setTimeout(() => {
              shown = true;
              scene?.intro();
              setTimeout(() => (covered = false), 600);
            }, 450);
          },
        });
      })
      .catch(() => (failed = true));
    return () => {
      alive = false;
      scene?.dispose();
      scene = null;
    };
  });
  $effect(() => {
    scene?.update(tableState);
  });
  onDestroy(() => {
    cancelAnimationFrame(frame);
    audio.close();
  });
  /** Hit area over a 3D object, grown to a comfortable 44px touch target. */
  const place = (r?: Rect, grow = true) => {
    if (!r) return 'display:none';
    const w = grow ? Math.max(44, r.w) : r.w,
      h = Math.max(44, r.h);
    return `left:${r.x - (w - r.w) / 2}px;top:${r.y - (h - r.h) / 2}px;width:${w}px;height:${h}px`;
  };
</script>

<section class="domino" class:compact>
  <div class="stage" onwheel={wheel}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    <div class="vignette" aria-hidden="true"></div>
    {#if failed}<p class="failed" role="alert">
        {m.domino_error({}, L)}
      </p>{:else if covered}<Loading
        progress={loaded === null ? 0.08 : 0.15 + loaded * 0.85}
        leaving={shown}
        label={loaded === null
          ? m.domino_loading({}, L)
          : loaded < 0.8
            ? m.domino_loading_art({}, L)
            : m.domino_loading_tiles({}, L)}
      />{/if}

    <!-- Invisible hit areas over the 3D objects: real buttons for mouse, touch and keyboard. -->
    <div class="hits">
      <div
        role="group"
        aria-label={m.domino_your_tiles({}, L)}
        hidden={compact}
      >
        {#each hand as id (id)}
          <button
            class="hit"
            class:live={myTurn && playable.has(id)}
            style={place(rects[`rack:${id}`], false)}
            aria-pressed={selected === id}
            aria-label={`${TILES[id].a}–${TILES[id].b}`}
            onclick={() => pick(id)}
          ></button>
        {/each}
      </div>
      {#each ghosts as g (g.end)}
        <button
          class="hit live"
          style={place(rects[`ghost:${g.end}`])}
          aria-label={g.end === 'left'
            ? m.domino_left_end({}, L)
            : m.domino_right_end({}, L)}
          title={t.holdHint}
          onpointerdown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            startCharge(g.end);
          }}
          onpointerup={releaseCharge}
          onpointercancel={cancelCharge}
          onkeydown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              startCharge(g.end);
            }
          }}
          onkeyup={(e) => {
            if (e.key === ' ' || e.key === 'Enter') releaseCharge();
          }}
        ></button>
      {/each}
      {#if !compact}<button
          class="hit"
          class:live={mustPass && !pending}
          style={place(rects.pass)}
          disabled={!mustPass || pending}
          onclick={() => act({ type: 'PASS' })}>{t.pass}</button
        >
        <button
          class="hit"
          class:live={scattered && !pending}
          style={place(rects.arrange)}
          disabled={!scattered || pending}
          onclick={() => act({ type: 'ARRANGE' })}>{t.arrange}</button
        >{/if}
      {#if !compact && rects.gauge && charging}<div
          class="gauge-labels"
          style={place(rects.gauge)}
          aria-hidden="true"
        >
          <small>{t.soft}</small><small>{t.hard}</small>
        </div>{/if}
    </div>
    <p class="sr-only" role="status">{status}</p>
  </div>

  {#if compact}
    <!-- Phone HUD: the other seats up top, your hand and buttons at the bottom. -->
    <!-- Seats as they sit around you: who plays before you, your partner, who plays next. -->
    <ul class="seats">
      {#each [3, 2, 1] as r}
        {@const seat = seatAt(r)}
        {@const passed =
          pub.phase === 'playing' &&
          pub.last?.type === 'pass' &&
          pub.last.seat === seat}
        <li
          class:active={pub.phase === 'playing' && pub.turn === seat}
          class:partner={r === 2}
        >
          <small class="role"
            >{r === 3
              ? `← ${t.before}`
              : r === 2
                ? t.partner
                : `${t.after} →`}{passed ? ` · ${t.passed}` : ''}</small
          >
          <span class="line"
            ><i class="dot" aria-hidden="true"></i><span class="who"
              >{name(seat)}</span
            ><span class="count">{handsLeft(r)}</span></span
          >
        </li>
      {/each}
    </ul>
    <div class="hand-bar">
      <div class="hand-top">
        <button
          class="pill"
          disabled={!mustPass || pending}
          onclick={() => act({ type: 'PASS' })}>{t.pass}</button
        >
        <p class="hand-status" aria-hidden="true">
          {#if charging}<span class="meter"
              ><span style:--charge={charge}></span><small>{t.soft}</small
              ><small>{t.hard}</small></span
            >{:else}{status}{/if}
        </p>
        <button
          class="pill"
          disabled={!scattered || pending}
          onclick={() => act({ type: 'ARRANGE' })}>{t.arrange}</button
        >
      </div>
      <div
        class="hand"
        role="group"
        aria-label={m.domino_your_tiles({}, L)}
        style:--n={Math.max(hand.length, 5)}
      >
        {#each hand as id (id)}
          <button
            class="hand-tile"
            class:lifted={selected === id}
            class:live={myTurn && playable.has(id)}
            aria-pressed={selected === id}
            aria-label={`${TILES[id].a}–${TILES[id].b}`}
            onclick={() => pick(id)}
            ><Tile near={TILES[id].a} far={TILES[id].b} vertical /></button
          >
        {/each}
      </div>
    </div>
  {/if}

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

  <div class="camera" role="group" aria-label={t.view} hidden={compact}>
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
      <label hidden={compact}
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
    position: absolute;
    inset: 0;
    overflow: clip;
    background: #0d0906;
    color: var(--ink);
    font-family: 'Domino Plaque', Georgia, serif;
    user-select: none;
    -webkit-user-select: none;
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
  .wood:disabled {
    filter: brightness(0.7) saturate(0.6);
    color: rgb(243 230 204 / 0.6);
    cursor: default;
  }
  .wood:not(:disabled):active {
    translate: 0 1px;
  }
  /* Camera */
  .camera {
    position: absolute;
    z-index: 5;
    right: 14px;
    bottom: 18px;
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
    max-height: calc(100dvh - 32px);
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

  /* The 3D table */
  .stage {
    position: absolute;
    inset: 0;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(
        ellipse 75% 70% at 50% 58%,
        transparent 55%,
        rgb(8 5 3 / 0.55)
      ),
      linear-gradient(to bottom, rgb(8 5 3 / 0.35), transparent 18%);
  }
  .hits {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .hit {
    position: absolute;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    color: transparent;
    font-size: 0;
    pointer-events: auto;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  .hit.live {
    cursor: pointer;
  }
  /* The app's green hover fill must never show over the 3D table. */
  .hit:hover:enabled {
    background: none;
    transform: none;
  }
  .hit:disabled {
    pointer-events: none;
  }
  .hit:focus {
    outline: none;
  }
  .hit:focus-visible {
    outline: 2px solid rgb(255 214 150 / 0.85);
    outline-offset: 3px;
  }
  .gauge-labels {
    position: absolute;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    translate: 0 -100%;
    font-size: 11px;
    color: rgb(243 230 204 / 0.8);
    text-shadow: 0 1px 2px #000;
    pointer-events: none;
  }
  .failed {
    position: absolute;
    top: 45%;
    width: 100%;
    text-align: center;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Hanging chalkboard: two cords up out of frame. */
  .chalkboard::before,
  .chalkboard::after {
    content: '';
    position: absolute;
    bottom: 100%;
    width: 2px;
    height: 40px;
    background: #8c7a5c;
  }
  .chalkboard::before {
    left: 18%;
  }
  .chalkboard::after {
    right: 18%;
  }

  /* Phone layout: a slim header, the seats around you, a low hand bar. */
  .compact .stage {
    top: 118px;
    bottom: calc(146px + env(safe-area-inset-bottom));
  }
  .compact .vignette {
    display: none;
  }
  .camera[hidden],
  label[hidden] {
    display: none;
  }
  .compact .corner {
    top: 8px;
    min-height: 0;
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
  }
  .compact .rules {
    left: 8px;
  }
  .compact .settings {
    right: 8px;
  }
  .compact .corner span {
    display: none;
  }
  .compact .chalkboard {
    top: 6px;
    gap: 0 10px;
    padding: 3px 12px 2px;
    border-width: 4px;
  }
  .compact .chalkboard::before,
  .compact .chalkboard::after {
    display: none;
  }
  .compact .team {
    min-width: 64px;
  }
  .compact .team-name,
  .compact .team input {
    font-size: 11px;
  }
  .compact .team strong {
    font-size: 20px;
  }
  .compact .rule {
    height: 28px;
  }
  .compact .chalkboard small {
    font-size: 10px;
  }
  .seats {
    position: absolute;
    z-index: 5;
    top: 76px;
    left: 6px;
    right: 6px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .seats li {
    display: grid;
    min-width: 0;
    padding: 2px 6px 3px;
    border: 1px solid #1a0d05;
    border-radius: 6px;
    background: linear-gradient(170deg, #e8dcc2, #cdbb98);
    color: #2a1a0d;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.5);
  }
  .seats li:nth-child(2) {
    text-align: center;
  }
  .seats li:nth-child(3) {
    text-align: right;
  }
  .seats li.active {
    box-shadow:
      0 0 0 2px var(--lamp),
      0 0 14px rgb(255 179 71 / 0.6);
  }
  .role {
    overflow: hidden;
    font-family: system-ui, sans-serif;
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: #6b4a2a;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    font-size: 13px;
  }
  .seats li:nth-child(2) .line {
    justify-content: center;
  }
  .seats li:nth-child(3) .line {
    justify-content: flex-end;
  }
  /* Team marks match the chalkboard: your pair chalk-white, the others red. */
  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border: 1px solid #2a1a0d;
    border-radius: 50%;
    background: #f19b8c;
  }
  .partner .dot {
    background: #fbf8ee;
  }
  .who {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
    min-width: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: #3b2413;
    color: var(--ink);
    font-size: 11px;
    text-align: center;
  }
  .hand-bar {
    position: absolute;
    z-index: 5;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    gap: 4px;
    padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
    background:
      repeating-linear-gradient(
        88deg,
        rgb(255 255 255 / 0.03) 0 2px,
        transparent 2px 9px
      ),
      linear-gradient(180deg, #4a2b14, #2a170c);
    border-top: 2px solid #1a0d05;
    box-shadow: 0 -6px 16px rgb(0 0 0 / 0.5);
  }
  .hand-top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }
  .pill {
    height: 30px;
    padding: 0 12px;
    border: 1px solid #1a0d05;
    border-radius: 15px;
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    touch-action: manipulation;
  }
  .pill:hover:enabled {
    background: linear-gradient(170deg, var(--wood-light), var(--wood) 65%);
    transform: none;
  }
  .pill:disabled {
    opacity: 0.4;
  }
  .hand-status {
    display: grid;
    place-items: center;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.2;
    text-align: center;
  }
  .meter {
    position: relative;
    display: flex;
    justify-content: space-between;
    width: 100%;
    max-width: 200px;
    height: 18px;
    padding: 0 8px;
    box-sizing: border-box;
    border-radius: 9px;
    background: #1a0d05;
    overflow: hidden;
    font-size: 10px;
    line-height: 18px;
  }
  .meter > span {
    position: absolute;
    inset: 0;
    transform-origin: left;
    transform: scaleX(var(--charge));
    background: linear-gradient(90deg, #c9a15a, #e2742e 70%, #c63a22);
  }
  .meter small {
    position: relative;
  }
  .hand {
    --w: min(42px, calc((100vw - 16px - (var(--n) - 1) * 6px) / var(--n)));
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 10px;
  }
  .hand-tile {
    width: var(--w);
    height: calc(var(--w) * 2);
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: none;
    box-shadow:
      0 1px 0 #d8cdb1,
      0 2px 0 #c7b994,
      0 6px 10px rgb(0 0 0 / 0.5);
    transition: transform 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .hand-tile:hover:enabled {
    background: none;
    transform: none;
  }
  .hand-tile.lifted,
  .hand-tile.lifted:hover:enabled {
    transform: translateY(-10px);
  }
  .hand-tile:focus {
    outline: none;
  }
  .hand-tile:focus-visible {
    outline: 2px solid rgb(255 214 150 / 0.85);
    outline-offset: 3px;
  }
  /* Landscape phones: header and seats in a left column, a lower hand bar. */
  @media (max-height: 520px) and (min-width: 521px) {
    .compact .stage {
      top: 0;
      left: 156px;
      bottom: calc(118px + env(safe-area-inset-bottom));
    }
    .compact .chalkboard {
      top: 52px;
      left: 6px;
      translate: none;
      width: 144px;
      box-sizing: border-box;
      padding: 3px 6px 2px;
    }
    .compact .team {
      min-width: 0;
    }
    .compact .team-name {
      font-size: 10px;
      letter-spacing: 0;
    }
    .compact .settings {
      left: 52px;
      right: auto;
    }
    .seats {
      top: 128px;
      left: 6px;
      right: auto;
      width: 144px;
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .seats li,
    .seats li:nth-child(n) {
      text-align: left;
    }
    .seats li:nth-child(n) .line {
      justify-content: flex-start;
    }
    .hand {
      --w: min(34px, calc((100vw - 40px) / var(--n)));
      padding-top: 8px;
    }
  }

  @media (max-width: 720px), (max-height: 520px) {
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
    .camera {
      right: 6px;
      bottom: 10px;
    }
    .camera input {
      height: 80px;
    }
  }
</style>
