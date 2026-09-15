<script lang="ts">
  import { resourceArtwork } from './table/artwork.js';
  let { resource }: { resource: number } = $props();
</script>

<img src={resourceArtwork[resource]} alt="" class="resource-art" />

<style>
  .resource-art {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 1px #18241344);
  }
</style>
