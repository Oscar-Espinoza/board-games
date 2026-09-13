<script lang="ts">
  import type { Power } from './types.js';
  let { power }: { power: Power } = $props();
  const marks: Record<Power, string> = {
    mime: 'M8 16q8-14 16 0M9 16q7 13 14 0M12 13v2m8-2v2',
    novice: 'M8 12h16v10H8zM10 8l12 18m-6-18v4',
    elder: 'M8 10h6v14H8zM18 10h6v14h-6z',
    sage: 'M6 19l4-10 6 7 6-7 4 10v5H6z',
    revenant: 'M10 24V12a6 6 0 0112 0v12l-3-3-3 3-3-3zM13 12v3m6-3v3',
    dictator: 'M7 12h7v12H7zM18 12h7v12h-7zM10 8h12',
    adept: 'M16 7l9 9-9 9-9-9zM12 16h8',
  };
</script>

<svg viewBox="0 0 32 32" aria-hidden="true"
  ><circle cx="16" cy="16" r="15" fill="#713d3c" stroke="#d7b570" /><path
    d={marks[power]}
    fill="none"
    stroke="#f5e4b9"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  /></svg
>

<style>
  svg {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
  }
</style>
