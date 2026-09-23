<script lang="ts">
  import type { Component } from 'svelte';
  import { onDestroy, tick } from 'svelte';
  import { m } from '@board-games/shared/messages';
  import { guideLoaders } from './guides/load';
  import type { GameId, Guide, Lesson } from './types';
  let { game }: { game: GameId } = $props();
  let guide = $state<Guide | null>(null),
    loading = $state(true),
    failure = $state(false);
  let Scene = $state<Component<{ lesson: Lesson; step: number }> | null>(null);
  let search = $state(''),
    chapter = $state(''),
    expanded = $state<Record<string, boolean>>({}),
    frames = $state<Record<string, number>>({});
  let navigation = $state<HTMLDetailsElement>();
  let disposed = false;
  onDestroy(() => {
    disposed = true;
  });
  const sceneLoaders = {
    azul: () => import('./guides/AzulScene.svelte'),
    codenames: () => import('./guides/CodenamesScene.svelte'),
    'little-secret': () => import('./guides/LittleSecretScene.svelte'),
    'sushi-go-party': () => import('./guides/SushiScene.svelte'),
    uno: () => import('./guides/UnoScene.svelte'),
    catan: () => import('./guides/CatanScene.svelte'),
    carcassonne: () => import('./guides/CarcassonneScene.svelte'),
    domino: () => import('./guides/DominoScene.svelte'),
  };
  $effect(() => {
    const id = game;
    let cancelled = false;
    loading = true;
    failure = false;
    guide = null;
    Scene = null;
    search = '';
    expanded = {};
    frames = {};
    Promise.all([guideLoaders[id](), sceneLoaders[id]()])
      .then(([content, scene]) => {
        if (cancelled) return;
        guide = content.default;
        Scene = scene.default;
        chapter = guide.chapters[0].id;
        loading = false;
      })
      .catch(() => {
        if (!cancelled) {
          failure = true;
          loading = false;
        }
      });
    return () => {
      cancelled = true;
    };
  });
  const visible = $derived(
    guide?.chapters
      .map((c) => ({
        ...c,
        lessons: c.lessons.filter(
          (l) =>
            !search.trim() ||
            [c.title(), l.title(), l.explanation(), ...l.frames.map((f) => f())]
              .join(' ')
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
        ),
      }))
      .filter((c) => c.lessons.length && (search.trim() || c.id === chapter)) ??
      [],
  );
  async function go(id: string) {
    chapter = id;
    search = '';
    navigation?.removeAttribute('open');
    await tick();
    const heading = document.getElementById(`chapter-${id}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  async function retry() {
    // Failed ES module imports are cached by the browser. A fresh document
    // clears that cache; the fragment restores only this open rulebook.
    // WebKit also retains failed script resources across document reloads.
    // Refresh only this app's already-requested JS assets before reopening.
    loading = true;
    const assets = new Set(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => {
          const url = new URL(name);
          return (
            url.origin === location.origin &&
            url.pathname.startsWith('/_app/') &&
            url.pathname.endsWith('.js')
          );
        }),
    );
    await Promise.allSettled(
      [...assets].map((url) =>
        fetch(url, { cache: 'reload', signal: AbortSignal.timeout(5000) }),
      ),
    );
    if (disposed) return;
    const url = new URL(window.location.href);
    url.searchParams.set('_guideRetry', String(Date.now()));
    url.hash = `rules-${game}`;
    window.location.replace(url);
  }
</script>

{#if loading}<h2 id="library-dialog-title">{m.library_rules()}</h2>
  <p role="status">{m.library_loading()}</p>
{:else if failure}<h2 id="library-dialog-title">{m.library_rules()}</h2>
  <p role="alert">{m.library_load_error()}</p>
  <button onclick={retry}>{m.library_retry()}</button>
{:else if guide}
  <h2 id="library-dialog-title">{guide.title()}</h2>
  <p class="guide-intro">{m.library_guide_intro()}</p>
  <div class="rulebook">
    <aside>
      <label class="search"
        >{m.library_search()}<input type="search" bind:value={search} /></label
      >
      <details bind:this={navigation} class="chapter-nav">
        <summary>{m.library_chapters()}</summary>
        <nav aria-label={m.library_chapters()}>
          {#each guide.chapters as c}<button
              aria-current={!search && chapter === c.id ? 'page' : undefined}
              onclick={() => go(c.id)}>{c.title()}</button
            >{/each}
        </nav>
      </details>
      <nav class="desktop-nav" aria-label={m.library_chapters()}>
        {#each guide.chapters as c}<button
            aria-current={!search && chapter === c.id ? 'page' : undefined}
            onclick={() => go(c.id)}>{c.title()}</button
          >{/each}
      </nav>
    </aside>
    <div class="chapter-content">
      {#if game === 'uno' && !search && chapter === 'actions'}
        <section class="reference">
          <h3>{m.library_dictionary()}</h3>
          <dl class="symbols">
            <dt>⊘</dt>
            <dd>{m.library_skip()}</dd>
            <dt>↺</dt>
            <dd>{m.library_reverse()}</dd>
            <dt>+2</dt>
            <dd>{m.library_draw_two()}</dd>
            <dt>✦</dt>
            <dd>{m.library_wild()}</dd>
            <dt>+4</dt>
            <dd>{m.library_wild_four()}</dd>
          </dl>
        </section>
      {/if}
      {#if game === 'catan' && !search && chapter === 'building'}<section
          class="reference"
        >
          <h3>{m.library_costs()}</h3>
          <dl>
            <dt>⌁ {m.library_road()}</dt>
            <dd>1 {m.library_wood()} + 1 {m.library_brick()}</dd>
            <dt>⌂ {m.library_settlement()}</dt>
            <dd>
              1 {m.library_wood()} + 1 {m.library_brick()} + 1 {m.library_wool()}
              + 1 {m.library_grain()}
            </dd>
            <dt>♜ {m.library_city()}</dt>
            <dd>2 {m.library_grain()} + 3 {m.library_ore()}</dd>
            <dt>▣ {m.library_development()}</dt>
            <dd>
              1 {m.library_wool()} + 1 {m.library_grain()} + 1 {m.library_ore()}
            </dd>
          </dl>
        </section>{/if}
      {#if !visible.length}<p role="status">{m.library_empty()}</p>
        <button onclick={() => (search = '')}>{m.library_clear()}</button>{/if}
      {#each visible as c}<section aria-labelledby={`chapter-${c.id}`}>
          <h3 id={`chapter-${c.id}`} tabindex="-1">{c.title()}</h3>
          {#each c.lessons as lesson}
            {@const step = frames[lesson.id] ?? 0}
            <article data-lesson={lesson.id}>
              <h4>{lesson.title()}</h4>
              <p>{lesson.explanation()}</p>
              <button
                class="example-toggle"
                aria-expanded={!!expanded[lesson.id]}
                aria-controls={`scene-${lesson.id}`}
                onclick={() => (expanded[lesson.id] = !expanded[lesson.id])}
                ><span aria-hidden="true"
                  >{expanded[lesson.id] ? '−' : '+'}</span
                >
                {m.library_example()}<span class="sr-only"
                  >: {lesson.title()}</span
                ></button
              >
              {#if expanded[lesson.id] && Scene}<div
                  id={`scene-${lesson.id}`}
                  class="scenario"
                >
                  <div class="frame-label">
                    <strong
                      >{[m.library_before, m.library_action, m.library_result][
                        step
                      ]()}</strong
                    ><span>{m.library_step({ step: step + 1 })}</span>
                  </div>
                  {#key step}<div class="scene-image">
                      <Scene {lesson} {step} />
                    </div>{/key}
                  <p class="frame-caption" aria-live="polite">
                    {lesson.frames[step]()}
                  </p>
                  <div class="scenario-controls">
                    <button
                      disabled={step === 0}
                      onclick={() => (frames[lesson.id] = step - 1)}
                      >← {m.library_previous()}</button
                    ><button
                      class="restart"
                      onclick={() => (frames[lesson.id] = 0)}
                      >{m.library_restart()}</button
                    ><button
                      disabled={step === 2}
                      onclick={() => (frames[lesson.id] = step + 1)}
                      >{m.library_next()} →</button
                    >
                  </div>
                </div>{/if}
            </article>
          {/each}
        </section>{/each}
    </div>
  </div>
{/if}

<style>
  h2 {
    font-size: 2.2rem;
    max-width: 760px;
    margin: 8px 0 18px;
  }
  .guide-intro {
    color: #705c48;
    max-width: 650px;
    line-height: 1.7;
  }
  .rulebook {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 30px;
    margin-top: 26px;
  }
  .search {
    font-size: 0.8rem;
    font-weight: 600;
    color: #705c48;
  }
  .search input {
    width: 100%;
    background: #fffaf0;
    color: #35291f;
    border-color: #bea780;
    min-height: 44px;
  }
  aside {
    min-width: 0;
  }
  .desktop-nav {
    margin-top: 20px;
    display: grid;
    gap: 4px;
  }
  .chapter-nav {
    display: none;
  }
  nav button {
    background: transparent;
    text-align: left;
    color: #705c48;
    line-height: 1.45;
    font-weight: 400;
    font-size: 0.85rem;
    border-radius: 3px;
    min-height: 44px;
    padding: 10px 12px;
  }
  nav button[aria-current] {
    background: #ecd7b3;
    color: #763a29;
    font-weight: 700;
  }
  button:focus-visible,
  input:focus-visible,
  summary:focus-visible {
    outline: 3px solid #a75b33;
    outline-offset: 3px;
  }
  .chapter-content {
    min-width: 0;
    scroll-margin-top: 80px;
  }
  h3 {
    scroll-margin-top: 80px;
    font-family: Georgia, serif;
    font-size: 1.6rem;
    font-weight: 400;
    margin: 0 0 23px;
  }
  h4 {
    font-family: Georgia, serif;
    font-size: 1.3rem;
    line-height: 1.3;
    font-weight: 600;
    margin: 0 0 10px;
  }
  article {
    padding: 0 0 25px;
    margin: 0 0 25px;
    border-bottom: 1px solid #ba9f7540;
  }
  article > p {
    color: #705c48;
    font-size: 0.96rem;
    line-height: 1.8;
    margin: 0 0 10px;
  }
  .example-toggle {
    background: transparent;
    color: #994b30;
    padding: 8px 0;
    min-height: 44px;
    font-size: 0.85rem;
  }
  .example-toggle > span:first-child {
    font-size: 20px;
    vertical-align: middle;
    margin-right: 5px;
  }
  .scenario {
    margin-top: 12px;
  }
  .frame-label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 0 0 12px;
    color: #7e5c3f;
    font-size: 0.78rem;
  }
  .frame-label strong {
    text-transform: uppercase;
    letter-spacing: 0.13em;
  }
  .frame-caption {
    line-height: 1.7;
    min-height: 75px;
    font-size: 0.96rem;
    color: #533e2d;
  }
  .scenario-controls {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .scenario-controls button {
    font-size: 0.8rem;
    background: #f1e3c8;
    color: #533e2d;
    border: 1px solid #bfa67966;
    padding: 10px 12px;
    min-height: 44px;
    border-radius: 4px;
  }
  .scenario-controls .restart {
    background: transparent;
  }
  .scene-image {
    animation: appear 180ms ease-out;
  }
  .reference {
    padding: 20px;
    background: #f1e3c8;
    margin-bottom: 28px;
    border-radius: 6px;
  }
  .reference h3 {
    font-size: 1.2rem;
  }
  .reference dt {
    font-weight: 600;
    font-size: 0.9rem;
    margin: 12px 0 4px;
  }
  .reference dd {
    font-size: 0.85rem;
    color: #705c48;
    margin-left: 20px;
    line-height: 1.7;
  }
  .symbols {
    display: grid;
    grid-template-columns: 44px 1fr;
    align-items: center;
    gap: 8px;
  }
  .symbols dt {
    margin: 0;
    color: #a34732;
    font-size: 22px;
  }
  .symbols dd {
    margin: 0;
  }
  @keyframes appear {
    from {
      opacity: 0.4;
    }
    to {
      opacity: 1;
    }
  }
  @media (max-width: 700px) {
    .rulebook {
      grid-template-columns: 1fr;
      gap: 22px;
    }
    .desktop-nav {
      display: none;
    }
    .chapter-nav {
      display: block;
      margin-top: 14px;
      border-bottom: 1px solid #bea780;
      padding-bottom: 12px;
    }
    .chapter-nav summary {
      cursor: pointer;
      min-height: 44px;
      padding: 12px 0;
      color: #705c48;
    }
    .chapter-nav nav {
      display: grid;
    }
    h2 {
      font-size: 1.7rem;
    }
    .guide-intro {
      font-size: 0.9rem;
    }
    h3 {
      font-size: 1.4rem;
    }
    h4 {
      font-size: 1.2rem;
    }
    .scenario-controls {
      gap: 4px;
    }
    .scenario-controls button {
      font-size: 0.73rem;
      padding: 10px 8px;
    }
    .frame-caption {
      min-height: 115px;
    }
    .reference {
      padding: 15px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .scene-image {
      animation: none;
    }
    button {
      transition: none;
      transform: none;
    }
  }
</style>
