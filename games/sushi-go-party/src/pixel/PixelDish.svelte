<script lang="ts">
  import type { Face } from '../cards.js';
  import { dishPieces, dishCells, dishSheet, cellStyle } from './sprites.js';
  let {
    card,
    trio = false,
    boxed = false,
  }: {
    card: Pick<Face, 'kind' | 'variant'>;
    trio?: boolean;
    boxed?: boolean;
  } = $props();
  const pieces = $derived(dishPieces(card, trio, boxed));
</script>

<span class="px-dish" data-n={pieces.length} aria-hidden="true"
  ><span class="px-row"
    >{#each pieces as piece}<i
        class="px-piece"
        style={cellStyle(dishSheet, dishCells.indexOf(piece))}
      ></i>{/each}</span
  ></span
>

<style>
  .px-dish {
    display: block;
    width: 100%;
    height: 100%;
    container-type: size;
  }
  .px-row {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  .px-piece {
    --s: min(100cqh, 100cqw);
    display: block;
    flex: none;
    width: var(--s);
    height: var(--s);
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  /* Several pieces overlap like a little platter; each one fits the box. */
  [data-n='2'] .px-piece {
    --s: min(82cqh, 64cqw);
  }
  [data-n='2'] .px-piece + .px-piece {
    margin-left: calc(var(--s) * -0.34);
    translate: 0 12%;
  }
  [data-n='3'] .px-piece {
    --s: min(72cqh, 46cqw);
  }
  [data-n='3'] .px-piece + .px-piece {
    margin-left: calc(var(--s) * -0.28);
  }
  [data-n='3'] .px-piece:nth-child(2) {
    translate: 0 -18%;
  }
  [data-n='3'] .px-piece:nth-child(3) {
    translate: 0 10%;
  }
</style>
