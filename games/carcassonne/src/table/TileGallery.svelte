<script lang="ts">
  import TileArt from '../TileArt.svelte';
  import { tiles } from '../tiles.js';
  const groups = [...new Set(Object.values(tiles).map((t) => t.module))];
</script>

<main class="artwork-gallery">
  <h1>Carcassonne · Painted tile inventory</h1>
  <p>
    {Object.keys(tiles).length} designs · four rotations each · production renderer
  </p>
  {#each groups as module}<section data-module={module}>
      <h2>{module}</h2>
      <div class="sheet">
        {#each Object.values(tiles).filter((t) => t.module === module) as tile}<article
            data-design={tile.id}
          >
            <h3>{tile.id} <small>{tile.edges} · ×{tile.quantity}</small></h3>
            <div class="rotations">
              {#each [0, 1, 2, 3] as rotation}<svg
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label={`${tile.id} · ${rotation * 90}°`}
                  ><TileArt id={tile.id} {rotation} /></svg
                >{/each}
            </div>
          </article>{/each}
      </div>
    </section>{/each}
</main>

<style>
  .artwork-gallery {
    padding: 24px;
    background: #251d15;
    color: #ead9b7;
    font-family: Georgia, serif;
  }
  h1 {
    font-size: 26px;
  }
  h2 {
    text-transform: capitalize;
    border-bottom: 1px solid #9c8053;
    padding-bottom: 12px;
  }
  h3 {
    font-size: 15px;
    margin: 0 0 10px;
  }
  small {
    font-weight: normal;
    color: #b29a76;
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 22px;
  }
  article {
    min-width: 0;
  }
  .rotations {
    display: flex;
    gap: 8px;
  }
  svg {
    width: calc((100% - 24px) / 4);
  }
  @media (max-width: 700px) {
    .sheet {
      grid-template-columns: 1fr;
    }
  }
</style>
