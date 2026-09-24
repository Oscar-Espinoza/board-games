<script lang="ts">
  import { getContext } from 'svelte';
  import { resourceArtwork } from './table/artwork.js';
  import { cell, sheets } from './pixel/geometry.js';
  let { resource }: { resource: number } = $props();
  const pixel = getContext<(() => boolean) | undefined>('catan:pixel');
</script>

{#if pixel?.()}
  <span
    class="resource-art px-sprite px-resource"
    style={cell(sheets.resources.url, resource, sheets.resources.cols)}
  ></span>
{:else}
  <img
    decoding="async"
    src={resourceArtwork[resource]}
    alt=""
    class="resource-art"
  />
{/if}

<style>
  .resource-art {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 1px #18241344);
  }
  .px-resource {
    filter: none;
    background-repeat: no-repeat;
    aspect-ratio: 1;
    margin: auto;
    max-width: 100%;
    max-height: 100%;
  }
</style>
