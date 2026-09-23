<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    children,
    taped = false,
    kind = 'sheet',
  }: {
    children: Snippet;
    taped?: boolean;
    kind?: 'sheet' | 'slip' | 'banner';
  } = $props();
</script>

<div
  class="paper"
  class:taped
  class:slip={kind === 'slip'}
  class:banner={kind === 'banner'}
>
  <div class="paper-content">{@render children()}</div>
</div>

<style>
  .paper {
    position: relative;
    isolation: isolate;
    color: #342a24;
    filter: drop-shadow(2px 5px 3px #05191966);
  }
  .paper::before,
  .paper::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: #e8d1aa url('/games/little-secret/paper.webp') center/100% 100%;
    clip-path: polygon(
      1% 0,
      19% 1%,
      33% 0,
      49% 1%,
      65% 0,
      81% 1%,
      99% 0,
      100% 17%,
      99% 33%,
      100% 57%,
      99% 80%,
      100% 99%,
      83% 100%,
      66% 99%,
      49% 100%,
      30% 99%,
      12% 100%,
      0 99%,
      1% 76%,
      0 60%,
      1% 43%,
      0 22%
    );
  }
  .paper::before {
    transform: translate(5px, 5px) rotate(1deg);
    filter: brightness(0.86);
  }
  .paper-content {
    position: relative;
    padding: 24px;
  }
  .taped .paper-content::before {
    content: '';
    position: absolute;
    width: 80px;
    height: 25px;
    top: -12px;
    left: calc(50% - 40px);
    background: repeating-linear-gradient(
      90deg,
      #d4b36b77 0 2px,
      #d4b36b88 2px 4px
    );
    transform: rotate(-5deg);
    clip-path: polygon(2% 0, 98% 0, 100% 85%, 96% 100%, 2% 95%, 0 20%);
  }
  .slip .paper-content {
    padding: 5px 12px;
  }
  .slip::before {
    transform: translate(2px, 2px);
  }
  .banner .paper-content {
    padding: 12px 28px;
  }
</style>
