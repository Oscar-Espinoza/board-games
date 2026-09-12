<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import guide from './guide.js';
  import GuideScene from './GuideScene.svelte';
  let search = $state('');
</script>

<label>{m.cn_search()}<input type="search" bind:value={search} /></label>
{#each guide.chapters.filter( (c) => (c.title() + ' ' + c.lessons[0].explanation())
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()) ) as chapter}
  <details open={!!search}>
    <summary>{chapter.title()}</summary>{#each chapter.lessons as lesson}<p>
        {lesson.explanation()}
      </p>
      <div class="frames">
        {#each lesson.frames as frame, i}<figure>
            <GuideScene {lesson} step={i} />
            <figcaption>{frame()}</figcaption>
          </figure>{/each}
      </div>{/each}
  </details>
{/each}
<p>
  {m.cn_sources()}:
  <a
    href="https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20EN%2030.pdf"
    target="_blank"
    rel="noreferrer">English</a
  >
  ·
  <a
    href="https://filemanager.czechgames.com/storage/files/codenames/rules/CN%20rulebook%20ES%2007.pdf"
    target="_blank"
    rel="noreferrer">Español</a
  >
</p>

<style>
  label {
    display: grid;
    gap: 0.5rem;
  }
  input {
    box-sizing: border-box;
    min-height: 44px;
    padding: 0.7rem;
    font: inherit;
    min-width: 0;
  }
  input:focus-visible,
  summary:focus-visible,
  a:focus-visible {
    outline: 3px solid #245c97;
    outline-offset: 3px;
  }
  summary {
    cursor: pointer;
    padding: 1rem 0;
    font-weight: 700;
  }
  details {
    border-bottom: 1px solid #baa98d;
  }
  p {
    line-height: 1.6;
  }
  .frames {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 0.85rem;
  }
  a {
    color: #245c97;
  }
  @media (max-width: 500px) {
    .frames {
      grid-template-columns: 1fr;
    }
  }
</style>
