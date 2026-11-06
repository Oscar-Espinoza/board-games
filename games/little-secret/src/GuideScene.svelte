<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import { gameSkin } from '@board-games/shared/ui/pixel';
  import Badge from './Badge.svelte';
  import Sprite from './pixel/Sprite.svelte';
  import { powers } from './limits.js';
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
  const isPower = (scene: string): scene is Power =>
    (powers as readonly string[]).includes(scene);
  // The guide follows the viewer's table style (or the home theme).
  const pixel = gameSkin('little-secret') === 'pixel';
  if (pixel) void import('./pixel.css');
  const marks = $derived(
    step === 0
      ? ['?', '?', '?']
      : step === 1
        ? ['♪', '♫', '?']
        : ['✓', '✕', '✓'],
  );
</script>

{#if pixel}<div
    class="px-scene px-tokens"
    role="img"
    aria-label={lesson.frames[step]()}
  >
    <div class="px-cast">
      {#each ['Ada', 'Bea', 'Leo'] as name, i}<div
          class="px-guest"
          class:talking={step === 1 && i === 0}
          class:chosen={step === 2 && i === 1}
        >
          <span class="px-portrait"
            ><Sprite
              sheet="suspects"
              frame={String(i)}
              row={step === 2 && i === 1 ? 1 : 0}
              fill
            />{#if step === 2 && i === 1}<b class="px-x">✕</b>{/if}</span
          >
          <span class="px-name">{name}</span>
          <span class="px-props"
            ><Sprite
              sheet="envelope"
              frame={step > 0 && i === 0 ? 'open' : 'closed'}
            />{#if isPower(lesson.scene) && i === 0}<Badge
                power={lesson.scene}
                pixel
              />{:else}<strong class="px-bubble" class:no={marks[i] === '✕'}
                >{marks[i]}</strong
              >{/if}</span
          >
        </div>{/each}
      <span class="px-cat"
        ><Sprite
          sheet="mascot"
          frame={['shh', 'look', 'cheer'][step] ?? 'idle'}
        /></span
      >
    </div>
    <p>{[m.ls_loop_0, m.ls_loop_1, m.ls_loop_2][step]()}</p>
  </div>{:else}
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
        >{#if isPower(lesson.scene) && i === 0}<Badge
            power={lesson.scene}
          />{:else}<strong>{marks[i]}</strong>{/if}
      </div>{/each}
    <p>{[m.ls_loop_0, m.ls_loop_1, m.ls_loop_2][step]()}</p>
  </div>
{/if}

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
  /* 8-bit: felt stage, hard ink borders, stepped motion. */
  .px-scene {
    --px: 3px;
    padding: 12px 12px 10px;
    background: #173a33;
    color: #f6e7c8;
    border: 4px solid #1a0f08;
    box-shadow:
      inset 0 0 0 3px #8a5a32,
      inset 0 0 0 6px #0f2a26,
      0 6px 0 #0000008c;
    font-family: 'Jersey 10', system-ui, sans-serif;
    font-synthesis: none;
    image-rendering: pixelated;
  }
  .px-cast {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 18%;
    gap: 10px;
    align-items: end;
  }
  .px-guest {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .px-portrait {
    position: relative;
    display: block;
    width: min(100%, 104px);
    aspect-ratio: 52 / 48;
    background: #3a2213;
    border: 3px solid #1a0f08;
    box-shadow:
      inset 0 0 0 3px #8a5a32,
      0 3px 0 #1a0f08;
  }
  .talking .px-portrait {
    border-color: #f2c14e;
    animation: px-talk 0.5s steps(2, jump-none) infinite;
  }
  .px-x {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #c8453a;
    font: 48px/1 system-ui;
    text-shadow: 3px 3px 0 #1a0f08;
    animation: px-stamp 0.32s steps(4, jump-end) both;
  }
  .px-name {
    font-size: 22px;
    line-height: 1;
    letter-spacing: 0.04em;
    text-shadow: 3px 3px 0 #1a0f08;
  }
  .px-props {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .px-bubble {
    min-width: 32px;
    padding: 2px 6px;
    background: #fff4d6;
    color: #1a0f08;
    border: 3px solid #1a0f08;
    font: 22px/1.2 system-ui;
    text-align: center;
  }
  .px-bubble.no {
    background: #c8453a;
    color: #fff4ec;
  }
  .px-cat {
    align-self: end;
    justify-self: center;
    width: 100%;
    max-width: 96px;
    aspect-ratio: 48 / 56;
  }
  .px-cat :global(.ls-sprite) {
    width: 100%;
    height: 100%;
  }
  .px-scene p {
    margin: 10px 0 0;
    padding-top: 8px;
    border-top: 3px solid #0f2a26;
    text-align: center;
    font-size: 20px;
    line-height: 1.15;
  }
  @keyframes px-talk {
    to {
      translate: 0 -3px;
    }
  }
  @keyframes px-stamp {
    from {
      scale: 2.2;
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .px-scene * {
      animation: none !important;
    }
  }
</style>
