<script lang="ts">
  import type { Lesson } from '../types';
  import HelpScene from '../../../../../../games/azul/src/HelpScene.svelte';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
</script>

<HelpScene scene={lesson.scene} {step} />
