<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import Badge from './Badge.svelte';
  import type { Power } from './types.js';
  let {
    lesson,
    step,
  }: {
    lesson: {
      scene: string;
      values: [string, string, string];
      frames: [() => string, () => string, () => string];
    };
    step: number;
  } = $props();
  const powers = [
    'mime',
    'novice',
    'elder',
    'sage',
    'revenant',
    'dictator',
    'adept',
  ];
</script>

<div class="scene" role="img" aria-label={lesson.frames[step]()}>
  {#each ['Ada', 'Bea', 'Leo'] as name, i}<div
      class:chosen={step === 2 && i === 1}
    >
      <span>{name}</span><svg viewBox="0 0 90 65" aria-hidden="true"
        ><path d="M4 4h82v57H4z" fill="#eeddb9" stroke="#b69d76" /><path
          d={step > 0 && i === 0
            ? 'M4 4L45 35 86 4M4 61l28-26m54 26L58 35'
            : 'M4 4l41 37L86 4M4 61l30-27m52 27L56 34'}
          fill="none"
          stroke="#b69d76"
        /><circle cx="45" cy="37" r="11" fill="#863e3c" /><path
          d="M39 37h12m-6-6v12"
          stroke="#e2b66d"
        /></svg
      >{#if powers.includes(lesson.scene) && i === 0}<Badge
          power={lesson.scene as Power}
        />{:else}<strong
          >{step === 0
            ? '?'
            : step === 1
              ? ['♪', '♫', '?'][i]
              : ['✓', '✕', '✓'][i]}</strong
        >{/if}
    </div>{/each}
  <p>{[m.ls_loop_0, m.ls_loop_1, m.ls_loop_2][step]()}</p>
</div>

<style>
  .scene {
    background: #213d39;
    border-radius: 12px;
    padding: 18px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    color: #f5e6ca;
  }
  .scene > div {
    width: 25%;
    text-align: center;
  }
  .scene span {
    font:
      italic 16px Georgia,
      serif;
  }
  .scene svg {
    display: block;
    width: 100%;
    margin: 8px auto;
  }
  .chosen {
    opacity: 0.65;
  }
  .scene strong {
    font-size: 24px;
  }
  .scene p {
    width: 100%;
    margin: 4px 0;
    text-align: center;
    font-size: 13px;
  }
</style>
