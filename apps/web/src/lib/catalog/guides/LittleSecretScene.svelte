<script lang="ts">
  import Scene from '@board-games/little-secret/GuideScene.svelte';
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
</script>

<Scene {lesson} {step} />
