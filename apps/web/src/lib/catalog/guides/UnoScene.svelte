<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
  const count = $derived(
    lesson.scene === 'hand'
      ? Number(lesson.values[step === 2 ? 2 : 0]) ||
          (lesson.id === 'win' && step === 2 ? 0 : 2)
      : 0,
  );
</script>

<svg
  viewBox="0 0 520 240"
  role="img"
  aria-label={`${lesson.title()}: ${lesson.frames[step]()}`}
>
  <rect width="520" height="240" rx="12" fill="#f1e3c8" />
  {#if lesson.scene === 'turn'}
    {#each [{ x: 90, name: 'Ada' }, { x: 260, name: 'Bea' }, { x: 430, name: 'Leo' }] as p, i}<circle
        cx={p.x}
        cy="96"
        r="35"
        fill={['#ad4835', '#47758a', '#6b8656'][i]}
      /><text x={p.x} y="103" class="initial">{p.name[0]}</text><text
        x={p.x}
        y="154">{p.name}</text
      >{/each}
    <path
      d={step === 0 ? 'M135 96h75m95 0h75' : 'M390 96h-75m-105 0h-75'}
      stroke="#997546"
      stroke-width="4"
      stroke-dasharray={lesson.id === 'skip' && step === 2 ? '8 6' : '0'}
    />
    <text x="260" y="208" class="value">{lesson.values[step]}</text>
  {:else if lesson.scene === 'match'}
    {#each [{ x: 52, y: 34, c: '#b84a38', n: '7' }, { x: 183, y: 70, c: '#b84a38', n: '3' }, { x: 289, y: 70, c: '#447a96', n: '7' }, { x: 395, y: 70, c: '#447a96', n: '5' }] as c, i}
      <rect
        x={c.x}
        y={c.y}
        width="72"
        height="110"
        rx="8"
        fill={c.c}
        stroke="#fff9e6"
        stroke-width="5"
      /><text x={c.x + 36} y={c.y + 70} class="card-number">{c.n}</text>
      {#if step > 0 && i > 0}<text
          x={c.x + 36}
          y="214"
          fill={i === 3 ? '#a33d2c' : '#466742'}
          font-size="25">{i === 3 ? '✕' : '✓'}</text
        >{/if}
    {/each}<text x="88" y="174" font-size="13">{m.library_discard()}</text>
  {:else if lesson.scene === 'wild'}
    <rect
      x="64"
      y="41"
      width="104"
      height="150"
      rx="10"
      fill="#3e3832"
      stroke="#fff9e6"
      stroke-width="6"
    />
    {#each ['#b74836', '#497f99', '#dbac40', '#6d8b50'] as color, i}<path
        d="M116 116L{116 + (i % 2 === 0 ? -35 : 35)} {116 +
          (i < 2 ? -45 : 45)}H116Z"
        fill={color}
      />{/each}
    {#each ['#b74836', '#497f99', '#dbac40', '#6d8b50'] as color, i}<circle
        cx={280 + (i % 2) * 80}
        cy={75 + Math.floor(i / 2) * 85}
        r="25"
        fill={color}
        stroke={step > 0 && i === 1 ? '#35291f' : 'none'}
        stroke-width="5"
      />{/each}
    <text x="428" y="128" class="value">{step > 0 ? '✓' : '?'}</text>
  {:else if lesson.scene === 'stack' || lesson.scene === 'stock'}
    {#each [0, 1, 2] as i}<rect
        x={69 + i * 7}
        y={57 - i * 6}
        width="86"
        height="122"
        rx="8"
        fill={lesson.scene === 'stock' ? '#806547' : '#b84a38'}
        stroke="#fff3d5"
        stroke-width="3"
      />{/each}
    <text x="126" y="123" class="card-number"
      >{lesson.scene === 'stock'
        ? '↻'
        : lesson.id === 'stack-two'
          ? '+2'
          : '+4'}</text
    >
    <path
      d="M195 113h80l-13-10m13 10-13 10"
      stroke="#997546"
      stroke-width="4"
    />
    <circle cx="368" cy="113" r="57" fill="#fffaec" /><text
      x="368"
      y="128"
      class="value">{lesson.values[step]}</text
    >
    <text x="126" y="215" font-size="15">{m.library_discard()}</text><text
      x="368"
      y="215"
      font-size="15">{m.library_hand()} · Bea</text
    >
  {:else}
    {#each Array.from({ length: count }, (_, i) => i) as i}<g
        transform="translate({260 - count * 19 + i * 38} {55 +
          Math.abs(i - (count - 1) / 2) * 5}) rotate({(i - (count - 1) / 2) *
          5} 30 50)"
        ><rect
          width="62"
          height="100"
          rx="7"
          fill={['#ad4835', '#dbad45', '#477a94', '#6c8a57'][i % 4]}
          stroke="#fff9e6"
          stroke-width="4"
        /><text x="31" y="66" class="card-number">{i + 1}</text></g
      >{/each}
    {#if count === 0}<circle cx="260" cy="106" r="48" fill="#e8bd62" /><text
        x="260"
        y="119"
        class="value">✓</text
      >{/if}
    <text x="260" y="213">Ada · {m.library_hand()} · {lesson.values[step]}</text
    >
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
  }
  text {
    text-anchor: middle;
    font-family: system-ui, sans-serif;
    fill: #513c2d;
    font-size: 17px;
  }
  .initial {
    fill: #fff5da;
    font-weight: 700;
    font-size: 24px;
  }
  .value {
    font-size: 32px;
    font-weight: 750;
  }
  .card-number {
    fill: #fff5da;
    font-size: 34px;
    font-weight: 800;
  }
</style>
