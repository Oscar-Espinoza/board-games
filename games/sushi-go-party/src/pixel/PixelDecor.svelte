<script lang="ts">
  import {
    propCells,
    propSheet,
    cellStyle,
    type PropSprite,
  } from './sprites.js';
  let { notes }: { notes: string[] } = $props();
  const prop = (name: PropSprite) =>
    cellStyle(propSheet, propCells.indexOf(name));
  const pieces: { name: PropSprite; style: string }[] = [
    { name: 'bonsai', style: 'left:-14px;top:40px' },
    { name: 'lucky-cat', style: 'right:150px;top:-8px' },
    { name: 'teapot', style: 'left:20px;top:452px' },
    { name: 'chopstick-rest', style: 'left:150px;bottom:10px' },
    { name: 'bamboo', style: 'right:-6px;bottom:-4px' },
    { name: 'soy-dish', style: 'right:110px;bottom:-22px' },
    { name: 'lantern', style: 'left:318px;top:-40px' },
  ];
</script>

<div class="px-decor" aria-hidden="true">
  {#each pieces as p}<i
      class="px-prop"
      data-prop={p.name}
      style={`${prop(p.name)};${p.style}`}
    ></i>{/each}
  <p class="px-note top">
    {#each notes[0].split('|') as line}<span>{line}</span>{/each}<b>♥</b>
  </p>
  <p class="px-note right">
    {#each notes[1].split('|') as line}<span>{line}</span>{/each}<b>♥</b>
  </p>
  <p class="px-note bottom">
    {#each notes[2].split('|') as line}<span>{line}</span>{/each}<b>♥</b>
  </p>
</div>

<style>
  .px-decor {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .px-prop {
    position: absolute;
    width: 128px;
    height: 128px;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
  .px-prop[data-prop='bonsai'],
  .px-prop[data-prop='bamboo'] {
    width: 176px;
    height: 176px;
  }
  /* Paper order slips pinned to the counter: flat, hard-edged, real text. */
  .px-note {
    position: absolute;
    margin: 0;
    padding: 14px 16px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #fbf1da;
    color: #3a2213;
    border: 3px solid #1a0f08;
    box-shadow:
      inset 0 -6px 0 #e7d2a8,
      6px 6px 0 #1a0f0855;
    font:
      400 26px/0.95 'Jersey 10',
      monospace;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .px-note::before {
    content: '';
    position: absolute;
    top: -12px;
    left: calc(50% - 9px);
    width: 18px;
    height: 12px;
    background: #c8453a;
    border: 3px solid #1a0f08;
  }
  .px-note b {
    color: #c8453a;
    font-weight: 400;
    margin-top: 4px;
  }
  .top {
    left: 150px;
    top: 34px;
  }
  .right {
    right: 64px;
    top: 72px;
    font-size: 22px;
  }
  .bottom {
    left: 18px;
    bottom: 110px;
  }
</style>
