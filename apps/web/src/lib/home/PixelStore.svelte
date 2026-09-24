<script lang="ts">
  import '@board-games/shared/ui/pixel.css';
  import { untrack } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import { catalog } from '@board-games/shared';
  import { m } from '@board-games/shared/messages';
  import type { GameId } from '$lib/catalog/types';
  import {
    cells,
    counter,
    cycle,
    errand,
    type Pose,
    type Say,
    type Shelf,
  } from './shopkeeper';

  type Panel = 'start' | 'summary' | 'rules';
  let {
    selected,
    onselect,
    onopen,
  }: {
    selected: GameId;
    onselect: (id: GameId) => void;
    onopen: (panel: Panel) => void;
  } = $props();

  const art = '/games/pixel-store';
  type Category = 'strategy' | 'family' | 'party' | 'card';
  const categories: Record<GameId, Category[]> = {
    uno: ['card', 'party'],
    catan: ['strategy'],
    carcassonne: ['strategy', 'family'],
    azul: ['family', 'strategy'],
    codenames: ['party'],
    'sushi-go-party': ['card', 'family'],
    'little-secret': ['party'],
    domino: ['family', 'strategy'],
  };
  // Where each box lives on the painted shelves (% of scene width).
  const shelves: Record<GameId, Shelf> = {
    catan: { x: 9, high: true },
    carcassonne: { x: 19, high: false },
    azul: { x: 33, high: true },
    'sushi-go-party': { x: 42, high: false },
    'little-secret': { x: 53, high: true },
    uno: { x: 58, high: false },
    codenames: { x: 63, high: true },
    domino: { x: 30, high: false },
  };
  const labels = {
    all: m.pixel_all,
    strategy: m.pixel_strategy,
    family: m.pixel_family,
    party: m.pixel_party,
    card: m.pixel_card,
  };
  const lines: Record<Say, (() => string)[]> = {
    go: [m.pixel_go_0, m.pixel_go_1, m.pixel_go_2, m.pixel_go_3],
    lost: [
      m.pixel_lost_0,
      m.pixel_lost_1,
      m.pixel_lost_2,
      m.pixel_lost_3,
      m.pixel_lost_4,
    ],
    search: [m.pixel_search_0, m.pixel_search_1, m.pixel_search_2],
    found: [m.pixel_found_0, m.pixel_found_1, m.pixel_found_2, m.pixel_found_3],
  };
  const quotes: (() => string)[] = [
    m.pixel_review_0,
    m.pixel_review_1,
    m.pixel_review_2,
    m.pixel_review_3,
    m.pixel_review_4,
  ];
  const pick = <T,>(list: T[]) =>
    list[Math.floor(Math.random() * list.length)]!;
  // Made-up reviews, rerolled on every visit.
  const reviews = Object.fromEntries(
    catalog.map((g) => [
      g.id,
      {
        stars: 3.5 + Math.floor(Math.random() * 4) * 0.5,
        count: 7 + Math.floor(Math.random() * 114),
        quote: pick(quotes),
      },
    ]),
  ) as Record<GameId, { stars: number; count: number; quote: () => string }>;

  let filter = $state<Category | 'all'>('all');
  let query = $state('');
  const shown = $derived(
    catalog.filter(
      (g) =>
        (filter === 'all' || categories[g.id].includes(filter)) &&
        g.name.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
  const game = $derived(catalog.find((g) => g.id === selected)!);
  const review = $derived(reviews[selected]);

  let x = $state(counter);
  let ladder = $state(47);
  let pose = $state<Pose>('idle');
  let climb = $state(false);
  let ms = $state(0);
  let stride = $state(0);
  let facing = $state(1);
  let speech = $state<(() => string) | null>(null);
  let bubble = $state(false);
  let found = $state<GameId | null>(null);
  let run = 0;

  async function fetchBox(id: GameId) {
    const token = ++run;
    found = null;
    if (prefersReducedMotion.current) {
      x = counter;
      pose = 'idle';
      climb = false;
      speech = pick(lines.found);
      found = id;
      return;
    }
    for (const beat of errand(x, shelves[id])) {
      if (beat.x !== x) facing = beat.x > x ? 1 : -1;
      ms = beat.ms;
      stride++;
      x = beat.x;
      pose = beat.pose;
      climb = !!beat.climb;
      if (beat.ladder !== undefined) ladder = beat.ladder;
      if (beat.say) {
        speech = pick(lines[beat.say]);
        bubble = beat.say === 'lost' || beat.say === 'search';
      } else bubble = false;
      if (beat.found) found = id;
      await new Promise((done) => setTimeout(done, beat.ms));
      if (token !== run) return;
    }
    facing = -1;
  }
  let first = true;
  $effect(() => {
    const id = selected;
    if (first) {
      first = false;
      found = id;
      return;
    }
    untrack(() => void fetchBox(id));
  });
  $effect(() => () => void ++run);
</script>

<svelte:head>
  {#each ['walk', 'carry'] as strip}<link
      rel="preload"
      as="image"
      href="{art}/sprites/{strip}-strip.webp"
    />{/each}
</svelte:head>

<div class="pixel-store">
  <section class="games" aria-labelledby="pixel-games-title">
    <div class="games-top">
      <h2 id="pixel-games-title">{m.pixel_our_games()}</h2>
      <input
        type="search"
        bind:value={query}
        placeholder={m.pixel_search()}
        aria-label={m.pixel_search()}
      />
    </div>
    <div
      class="chips"
      id="pixel-categories"
      role="group"
      aria-label={m.pixel_categories()}
    >
      {#each ['all', 'strategy', 'family', 'party', 'card'] as const as c}<button
          aria-pressed={filter === c}
          onclick={() => (filter = c)}>{labels[c]()}</button
        >{/each}
    </div>
    <div class="grid" id="pixel-games">
      {#each shown as item (item.id)}<button
          class="tile"
          aria-pressed={selected === item.id}
          onclick={() => onselect(item.id)}
          ><img src="{art}/boxes/{item.id}.webp" alt="" loading="lazy" /><span
            class="tile-name">{item.name}</span
          >{@render stars(reviews[item.id].stars)}<small
            >({reviews[item.id].count})</small
          ></button
        >{:else}<p class="none">{m.pixel_none()}</p>{/each}
    </div>
    <p class="showing">
      {m.pixel_showing({ shown: shown.length, total: catalog.length })}
    </p>
  </section>

  <section class="scene">
    <div class="stage" aria-hidden="true">
      <img class="store" src="{art}/store.webp" alt="" />
      <p class="sign">{m.pixel_sign_2()}</p>
      <p class="note">{m.pixel_sign_1()}</p>
      <p class="rug">{m.pixel_sign_0()}</p>
      <img
        class="ladder"
        src="{art}/sprites/ladder.webp"
        alt=""
        style="--x:{ladder};--ms:{ms}ms"
      />
      <div
        class="keeper {pose}"
        class:climb
        style="--x:{x};--ms:{ms}ms;--face:{facing}"
      >
        {#if bubble}<p class="bubble">?</p>{/if}
        <div class="body">
          {#if pose === 'walk' || pose === 'carry'}
            {#key stride}<div
                class="cycle"
                style="--aspect:{cells[pose]};--cycle:{cycle}ms"
              >
                <img src="{art}/sprites/{pose}-strip.webp" alt="" />
              </div>{/key}
          {:else}<img src="{art}/sprites/{pose}.webp" alt="" />{/if}
        </div>
      </div>
    </div>
    <div class="talk" aria-live="polite">
      <img src="{art}/sprites/portrait.webp" alt="" />
      <p>
        {speech?.() ?? m.pixel_go_3()}
      </p>
    </div>
  </section>

  <section class="detail">
    <div class="cover">
      {#if found === selected}<img
          src="{art}/boxes/{selected}.webp"
          alt={game.name}
        />{:else}<p class="slot">{m.pixel_slot()}</p>{/if}
    </div>
    <h2>{game.name}</h2>
    <p class="rating">
      {@render stars(review.stars)}
      <span>{m.pixel_reviews({ count: review.count })}</span>
    </p>
    <ul class="tags">
      {#each categories[selected] as c, i}<li class:lead={i === 0}>
          {labels[c]()}
        </li>{/each}
      <li>{m.players({ min: game.minPlayers, max: game.maxPlayers })}</li>
    </ul>
    <p class="about">{game.description()}</p>
    <p class="quote">{review.quote()}</p>
    <button class="open" onclick={() => onopen('start')}
      ><span aria-hidden="true">▶</span> {m.pixel_open()}</button
    >
    <div class="more">
      <button onclick={() => onopen('summary')}>{m.library_summary()}</button
      ><button onclick={() => onopen('rules')}>{m.library_rules()}</button>
    </div>
  </section>

  <footer class="ticker">
    <span>▣ {m.catalog()}</span>
    <span>{m.pixel_ticker_0()}</span>
    <span>{m.pixel_ticker_1()}</span>
    <span>{m.pixel_ticker_2()}</span>
  </footer>
</div>

{#snippet stars(value: number)}<span
    class="stars"
    style="--fill:{value * 20}%"
    role="img"
    aria-label="{value}/5">★★★★★</span
  >{/snippet}

<style>
  :global(html:has(.pixel-store)),
  :global(body:has(.pixel-store)) {
    background: #2a1a10;
    color: #f6e7c8;
    font-family: 'Pixelify Sans', system-ui, sans-serif;
  }
  .pixel-store {
    --wood: #5b3620;
    --wood-dark: #3a2213;
    --wood-edge: #8a5a32;
    --cream: #f6e7c8;
    --gold: #f2c14e;
    --green: #3f9a4a;
    display: grid;
    grid-template-columns: minmax(260px, 330px) minmax(0, 1fr) minmax(
        260px,
        330px
      );
    grid-template-areas:
      'games scene detail'
      'ticker ticker ticker';
    gap: 10px;
    padding: 0 10px 10px;
    align-items: start;
  }
  .pixel-store :global(button) {
    font-family: inherit;
  }
  img {
    image-rendering: pixelated;
    display: block;
  }
  .games,
  .detail {
    background: var(--wood);
    border: 4px solid var(--wood-dark);
    box-shadow:
      inset 0 0 0 3px var(--wood-edge),
      0 6px 0 #1a0f08;
    padding: 14px;
  }
  .games {
    grid-area: games;
  }
  .games-top {
    background: var(--cream);
    color: #3a2213;
    padding: 8px 10px;
    margin: -4px -4px 10px;
    display: grid;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-family: inherit;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .games h2 {
    font-size: 1.3rem;
  }
  .games-top input {
    border: 2px solid #3a2213;
    border-radius: 0;
    padding: 6px 8px;
    background: #fffaf0;
    font-family: inherit;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  .chips button,
  .more button {
    background: var(--wood-dark);
    color: var(--cream);
    border: 2px solid #1e110a;
    border-radius: 0;
    box-shadow: inset 0 -3px 0 #00000055;
    padding: 5px 10px;
    font-weight: 400;
  }
  .chips button[aria-pressed='true'] {
    background: var(--green);
    border-color: #1f5a27;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .tile {
    background: var(--wood-dark);
    border: 3px solid transparent;
    border-radius: 0;
    padding: 6px 4px;
    color: var(--cream);
    display: grid;
    justify-items: center;
    gap: 3px;
    font-weight: 400;
    text-align: center;
  }
  .tile:hover:enabled {
    background: #4a2c18;
  }
  .tile[aria-pressed='true'] {
    border-color: var(--gold);
    box-shadow: 0 0 0 2px #1e110a;
  }
  .tile img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
  }
  .tile-name {
    font-size: 0.82rem;
    line-height: 1.1;
  }
  .tile small {
    font-size: 0.7rem;
    opacity: 0.8;
  }
  .none {
    grid-column: 1 / -1;
  }
  .showing {
    margin: 12px 0 0;
    font-size: 0.8rem;
    opacity: 0.85;
  }
  .stars {
    font-size: 0.9rem;
    letter-spacing: 1px;
    background: linear-gradient(
      90deg,
      var(--gold) var(--fill),
      #7a5a3a var(--fill)
    );
    background-clip: text;
    color: transparent;
    line-height: 1;
  }

  .scene {
    grid-area: scene;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    background: var(--wood-dark);
    border: 4px solid var(--wood-dark);
    box-shadow: 0 6px 0 #1a0f08;
    container-type: inline-size;
    overflow: hidden;
  }
  .stage {
    position: relative;
    aspect-ratio: 1672 / 941;
  }
  .store {
    width: 100%;
    height: 100%;
  }
  .sign,
  .note,
  .rug {
    position: absolute;
    margin: 0;
    text-align: center;
    font-weight: 700;
    line-height: 1.15;
  }
  .sign {
    left: 78.5%;
    top: 18%;
    width: 15%;
    color: #4a2a14;
    font-size: 1.45cqw;
  }
  .note {
    left: 74.5%;
    top: 67%;
    width: 13%;
    padding: 0.5cqw;
    background: #fdf3d8;
    color: #3a2213;
    font-size: 1cqw;
    font-weight: 400;
    transform: rotate(-3deg);
    box-shadow: 0.3cqw 0.3cqw 0 #00000055;
  }
  .rug {
    left: 27%;
    top: 86%;
    width: 42%;
    color: #c65b52;
    font-size: 2.1cqw;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .ladder,
  .keeper {
    position: absolute;
    left: 0;
    transition: transform var(--ms) linear;
  }
  .ladder {
    top: 15%;
    height: 78%;
    width: auto;
    transform: translateX(calc(var(--x) * 1cqw - 50%));
    transition-timing-function: ease-in-out;
  }
  .keeper {
    transition-timing-function: cubic-bezier(0.15, 0, 0.85, 1);
    bottom: 5%;
    width: 0;
    height: 23cqw;
    transform: translateX(calc(var(--x) * 1cqw));
  }
  .keeper .body {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 100%;
    transform: translateX(-50%);
    transition: transform 0.6s ease-in-out;
  }
  .keeper.climb .body {
    transform: translate(-50%, -14cqw);
  }
  .keeper img {
    height: 100%;
    width: auto;
    position: absolute;
    bottom: 0;
    left: 50%;
    translate: -50% 0;
    scale: var(--face) 1;
    max-width: none;
  }
  .keeper.reach img {
    height: 112%;
  }
  /* 8-frame strip, one cell visible, stepped at ~10 fps (see docs/pixel-store.md). */
  .keeper .cycle {
    position: absolute;
    bottom: 0;
    left: 50%;
    height: 100%;
    aspect-ratio: var(--aspect);
    translate: -50% 0;
    scale: var(--face) 1;
    overflow: hidden;
  }
  .keeper .cycle img {
    position: static;
    translate: none;
    scale: none;
    width: 800%;
    height: 100%;
    animation: cycle var(--cycle) steps(8, jump-none) infinite;
  }
  .bubble {
    position: absolute;
    bottom: 100%;
    left: 1cqw;
    margin: 0;
    padding: 0.2cqw 1cqw;
    font-weight: 700;
    background: #fffaf0;
    color: #2a1a10;
    font-size: 2.4cqw;
    line-height: 1.2;
    border: 0.3cqw solid #2a1a10;
    box-shadow: 0.4cqw 0.4cqw 0 #00000066;
    animation: pop 0.2s steps(3);
  }
  .keeper.reach .bubble {
    bottom: 75%;
    left: 4cqw;
  }
  .keeper.climb .bubble {
    bottom: calc(75% + 14cqw);
  }

  .detail {
    grid-area: detail;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
  .cover {
    background: #f1dfb8;
    border: 3px solid var(--wood-dark);
    aspect-ratio: 1.3;
    display: grid;
    place-items: center;
    padding: 8px;
  }
  .cover img {
    max-width: 100%;
    max-height: 100%;
    animation: pop 0.25s steps(4);
  }
  .slot {
    color: #6a4a2a;
    margin: 0;
    animation: blink 1s steps(2) infinite;
  }
  .detail h2 {
    font-size: 1.6rem;
  }
  .rating {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
  }
  .rating .stars {
    font-size: 1.2rem;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tags li {
    background: var(--wood-dark);
    padding: 3px 9px;
    font-size: 0.85rem;
  }
  .tags .lead {
    background: var(--green);
  }
  .about,
  .quote {
    margin: 0;
    line-height: 1.35;
  }
  .quote {
    font-size: 0.85rem;
    color: #e9cf9a;
  }
  .open {
    background: var(--green);
    border: 3px solid #1f5a27;
    border-radius: 0;
    box-shadow: inset 0 -4px 0 #1f5a27;
    font-size: 1.3rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .open:hover:enabled {
    background: #4bb257;
  }
  .more {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .more button {
    padding: 9px;
  }
  .talk {
    flex: 1;
    display: flex;
    font-size: 1.15rem;
    align-items: center;
    gap: 10px;
    background: var(--cream);
    color: #3a2213;
    border: 3px solid var(--wood-dark);
    padding: 6px 10px 6px 6px;
    min-height: 96px;
    margin: 8px;
    box-shadow: inset 0 0 0 3px #d9bf8c;
  }
  .talk img {
    width: 84px;
    height: 84px;
    object-fit: contain;
  }
  .talk p {
    margin: 0;
    flex: 1;
  }
  .talk p::after {
    content: ' ▼';
    color: #a0522d;
    animation: blink 1s steps(2) infinite;
  }
  .ticker {
    grid-area: ticker;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
    padding: 10px 14px;
    background: #1a0f08;
    font-size: 0.85rem;
    color: #d9c49c;
  }
  .ticker span:first-child {
    color: var(--gold);
    text-transform: uppercase;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--gold);
    outline-offset: 2px;
  }
  @keyframes cycle {
    to {
      transform: translateX(-87.5%);
    }
  }
  @keyframes pop {
    from {
      scale: 0.6;
      opacity: 0;
    }
  }
  @keyframes blink {
    50% {
      opacity: 0.4;
    }
  }
  @media (max-width: 1100px) {
    .pixel-store {
      grid-template-columns: minmax(0, 1fr) minmax(250px, 300px);
      grid-template-areas:
        'scene detail'
        'games detail'
        'ticker ticker';
    }
  }
  @media (max-width: 720px) {
    .pixel-store {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'scene' 'games' 'detail' 'ticker';
      padding: 0 16px 16px;
    }
    .grid {
      grid-auto-flow: column;
      grid-auto-columns: 96px;
      grid-template-columns: none;
      overflow-x: auto;
    }
    .scene {
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .talk {
      min-height: 0;
      font-size: 0.95rem;
      margin: 6px;
    }
    .talk img {
      width: 48px;
      height: 48px;
    }
    .cover {
      aspect-ratio: 1.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ladder,
    .keeper,
    .keeper .body,
    .keeper .cycle img {
      transition: none;
      animation: none;
    }
  }
</style>
