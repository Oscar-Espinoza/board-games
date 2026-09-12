<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import { lessons } from './help.js';
  import HelpScene from './HelpScene.svelte';
  let search = $state(''),
    chapter = $state('all'),
    frames = $state<Record<string, number>>({});
  const chapters = [
    m.learn_azul_draft_chapter,
    m.learn_azul_wall_chapter,
    m.learn_azul_end_chapter,
  ];
  const visible = $derived(
    lessons.filter((l) =>
      search.trim()
        ? `${l.title()} ${l.explanation()}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase())
        : chapter === 'all' || l.chapter() === chapter,
    ),
  );
</script>

<label class="search"
  >{m.azul_search()}<input type="search" bind:value={search} /></label
>
<label
  >{m.azul_chapters()}<select bind:value={chapter}
    ><option value="all">{m.learn_azul_title()}</option
    >{#each chapters as c}<option value={c()}>{c()}</option>{/each}</select
  ></label
>
{#each visible as lesson}<article>
    <h3>{lesson.title()}</h3>
    <div
      role="img"
      aria-label="{lesson.title()} · {lesson.frames[frames[lesson.id] ?? 2]()}"
    >
      <HelpScene scene={lesson.id} step={frames[lesson.id] ?? 2} />
    </div>
    <p>{lesson.explanation()}</p>
    <div class="frames">
      {#each lesson.frames as frame, i}<button
          class:chosen={(frames[lesson.id] ?? 2) === i}
          aria-pressed={(frames[lesson.id] ?? 2) === i}
          onclick={() => (frames[lesson.id] = i)}
          ><b>{i + 1}</b> {frame()}</button
        >{/each}
    </div>
  </article>{:else}<p>{m.azul_no_results()}</p>{/each}
<p class="sources">
  {m.azul_sources()}:
  <a
    href="https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf"
    target="_blank"
    rel="noreferrer">English</a
  >
  ·
  <a
    href="https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf"
    target="_blank"
    rel="noreferrer">Español</a
  >
</p>

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 12px 0;
    font-size: 13px;
  }
  input,
  select {
    padding: 12px;
    border: 1px solid #a99b7c;
    border-radius: 4px;
    background: #fff9ed;
    color: #172b3a;
    min-height: 44px;
  }
  article {
    border-top: 1px solid #c9bda3;
    margin-top: 24px;
    padding-top: 8px;
  }
  h3 {
    font:
      24px Georgia,
      serif;
    margin: 12px 0;
  }
  p {
    font-size: 15px;
    line-height: 1.6;
  }
  .frames {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  button {
    min-height: 44px;
    padding: 9px;
    border: 1px solid #ac9a76;
    background: #f4ecd9;
    color: #243c47;
    border-radius: 4px;
    text-align: left;
    font-size: 12px;
    line-height: 1.4;
    cursor: pointer;
  }
  .chosen {
    background: #d9e6e0;
    border-color: #487483;
  }
  button:focus-visible {
    outline: 3px solid #1170a8;
  }
  .sources {
    font-size: 13px;
  }
  a {
    color: #145783;
  }
  @media (max-width: 500px) {
    .frames {
      grid-template-columns: 1fr;
    }
  }
</style>
