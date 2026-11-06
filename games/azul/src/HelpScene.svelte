<script lang="ts">
  let { scene, step = 2 }: { scene: string; step?: number } = $props();
  import { palette as paints } from './palette.js';
  import { colors, penalties, wallColors } from './index.js';
  const palette = colors.map((color) => paints[color].glaze);
</script>

<svg viewBox="0 0 400 170" aria-hidden="true">
  <rect width="400" height="170" rx="8" fill="#142c43" />
  {#if scene === 'cross'}
    {#each [0, 1, 2, 3, 4] as r}{#each [0, 1, 2, 3, 4] as c}
        {@const connected = (r === 2 && c < 4) || (c === 2 && r > 0 && r < 4)}
        <rect
          x={60 + c * 27}
          y={17 + r * 27}
          width="23"
          height="23"
          rx="3"
          fill={connected && !(step === 0 && r === 2 && c === 2)
            ? paints.yellow.glaze
            : '#e9dfc422'}
          stroke={r === 2 && c === 2 ? '#fff6db' : 'none'}
          stroke-width="2"
        />
      {/each}{/each}
    <text x="270" y="80" fill="#f8edcc" font-size="24"
      >{step === 2 ? '4 + 3' : '+ ?'}</text
    ><text x="280" y="119" fill={paints.yellow.glaze} font-size="30"
      >{step === 2 ? '= 7' : '◇'}</text
    >
  {:else if scene === 'marker' || scene === 'penalty'}
    {#each penalties as penalty, i}<text
        x={38 + i * 49}
        y="46"
        fill="#f8edcc"
        text-anchor="middle"
        font-size="17">−{penalty}</text
      ><rect
        x={19 + i * 49}
        y="57"
        width="39"
        height="39"
        rx="5"
        fill={scene === 'marker' && i === 6
          ? paints.white.glaze
          : palette[i % 5]}
      />{/each}
    <text x="200" y="135" text-anchor="middle" fill="#f8edcc" font-size="22"
      >{scene === 'marker'
        ? step
          ? '① → −3     ◆ ◆ → ↗'
          : '6 / 7'
        : step === 2
          ? '2 − 6 → 0'
          : '1 + 1 + 2 + 2 = 6'}</text
    >
  {:else if scene === 'pattern' || scene === 'finish' || scene === 'conventions'}
    {#each [0, 1, 2, 3, 4] as r}{#each [0, 1, 2, 3, 4] as c}<rect
          x={204 + c * 25}
          y={16 + r * 27}
          width="22"
          height="22"
          rx="3"
          fill={paints[wallColors[r][c]].glaze}
          opacity={scene === 'finish'
            ? r === 0 || c === 0
              ? 1
              : 0.2
            : scene === 'conventions'
              ? 1
              : r === 2 && c === 4 && step === 2
                ? 1
                : 0.22}
        />{/each}{/each}
    {#if scene === 'pattern'}{#each [0, 1, 2] as i}<rect
          x={35 + i * 35}
          y="70"
          width="30"
          height="30"
          rx="4"
          fill={paints.yellow.glaze}
          opacity={(step === 0 && i === 2) || (step === 2 && i > 0) ? 0.15 : 1}
        />{/each}<text x="157" y="95" fill="#f8edcc" font-size="28">→</text>
    {:else}<text x="45" y="73" fill="#f8edcc" font-size="23"
        >{scene === 'finish' ? '+2 / +7' : '20 × 5'}</text
      ><text x="62" y="111" fill={paints.yellow.glaze} font-size="26"
        >{scene === 'finish' ? '+10' : '= 100'}</text
      >{/if}
  {:else}
    <circle
      cx="90"
      cy="80"
      r="62"
      fill="#f4ead3"
      stroke="#b98432"
      stroke-width="4"
    /><circle
      cx="90"
      cy="80"
      r="53"
      fill="none"
      stroke="#4a8094"
      stroke-width="2"
    />
    {#each [0, 0, 2, 1] as color, i}<rect
        x={56 + (i % 2) * 36}
        y={45 + Math.floor(i / 2) * 36}
        width="31"
        height="31"
        rx="4"
        fill={palette[color]}
        opacity={step === 2 ? 0.1 : 1}
      />{/each}
    <text x="177" y="88" fill="#f8edcc" font-size="32">→</text>
    {#each [0, 0] as color, i}<rect
        x={246 + i * 36}
        y="38"
        width="31"
        height="31"
        rx="4"
        fill={palette[color]}
        opacity={step === 0 ? 0.2 : 1}
      />{/each}
    {#each [2, 1] as color, i}<rect
        x={246 + i * 36}
        y="103"
        width="31"
        height="31"
        rx="4"
        fill={palette[color]}
        opacity={step === 2 ? 1 : 0.2}
      />{/each}
  {/if}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    max-height: 220px;
    border-radius: 8px;
  }
</style>
