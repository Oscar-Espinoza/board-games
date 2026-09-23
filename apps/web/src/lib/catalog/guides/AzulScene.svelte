<script lang="ts">
  import type { Lesson } from '../types';
  import HelpScene from '@board-games/azul/HelpScene.svelte';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
</script>

<div role="img" aria-label="{lesson.title()} · {lesson.frames[step]()}">
  <HelpScene scene={lesson.scene} {step} />
</div>
