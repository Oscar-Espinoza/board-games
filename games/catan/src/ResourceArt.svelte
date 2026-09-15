<script lang="ts">
  import { resourceArtwork } from './table/artwork.js';
  let { resource }: { resource: number } = $props();
</script>

<svg viewBox="0 0 100 100" aria-hidden="true" class="resource-art">
  <image href={resourceArtwork[resource]} width="100" height="100" />
</svg>

<style>
  .resource-art {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 2px 1px #18241344);
  }
</style>
