<script lang="ts">
  import { m } from '@board-games/shared/messages';
  let { lesson, step }: { lesson: { scene: string }; step: number } = $props();
</script>

<svg viewBox="0 0 420 190" role="img" aria-label={m.cn_rules()}>
  <rect width="420" height="190" rx="14" fill="#152532" />
  {#if lesson.scene === 'connection'}
    <rect x="32" y="35" width="120" height="110" rx="8" fill="#f5eedc" />
    <circle
      cx="92"
      cy="73"
      r="17"
      fill="#a93645"
      opacity={step === 2 ? 1 : 0.4}
    />
    <path
      d="M65 119q0-29 27-29t27 29"
      fill="#a93645"
      opacity={step === 2 ? 1 : 0.4}
    />
    <path
      d="M176 90h57m-10-10 10 10-10 10"
      fill="none"
      stroke="#e5b863"
      stroke-width="4"
    />
    <rect x="259" y="35" width="126" height="110" rx="8" fill="#f5eedc" />
    <path
      d="M291 89v-18a31 31 0 0 1 62 0v18"
      fill="none"
      stroke="#182631"
      stroke-width="7"
    />
    <rect x="284" y="81" width="76" height="48" rx="5" fill="#a93645" />
    <text x="322" y="114" text-anchor="middle" fill="#fff" font-size="28"
      >{step === 2 ? '✓' : '·'}</text
    >
    <text x="210" y="174" text-anchor="middle" fill="#f5eedc" font-size="15"
      >{m.cn_spymaster()}</text
    >
  {:else if lesson.scene === 'setup'}
    {#each [0, 1, 2, 3] as i}<g transform="translate({50 + i * 95} 60)"
        ><circle r="27" fill={i < 2 ? '#a93645' : '#245c97'} /><circle
          cy="-6"
          r="7"
          fill="#f5eedc"
        /><path
          d="M-13 15q0-15 13-15t13 15"
          fill="#f5eedc"
        />{#if i % 2 === 0}<path
            d="M-16-8h32l-7-9H-9z"
            fill="#152532"
          />{/if}{#if step > 0}<text
            x="0"
            y="58"
            text-anchor="middle"
            fill="#e5b863"
            font-size="25">✓</text
          >{/if}</g
      >{/each}
    <text x="210" y="159" text-anchor="middle" fill="#f5eedc" font-size="18"
      >{step === 2 ? '9 + 8 + 7 + 1 = 25' : m.cn_ready()}</text
    >
  {:else if lesson.scene === 'clues'}
    <rect x="35" y="35" width="255" height="110" rx="7" fill="#f5eedc" /><path
      d="M51 53h104"
      stroke="#b88b47"
      stroke-width="2"
    /><text
      x="162"
      y="99"
      text-anchor="middle"
      fill="#182631"
      font-family="Georgia"
      font-size="24">{m.cn_word()}</text
    ><text x="263" y="126" text-anchor="middle" fill="#245c97" font-size="25"
      >2</text
    >
    <path
      d="M302 86h45m-10-10 10 10-10 10"
      fill="none"
      stroke="#e5b863"
      stroke-width="4"
    />
    <circle
      cx="368"
      cy="86"
      r="24"
      fill={step === 2 ? '#245c97' : '#b88b47'}
    /><text x="368" y="94" text-anchor="middle" fill="#fff" font-size="25"
      >{step === 2 ? '2' : '…'}</text
    >
    <text x="210" y="173" text-anchor="middle" fill="#f5eedc" font-size="15"
      >{m.cn_give_clue()}</text
    >
  {:else if lesson.scene === 'budget'}
    <text x="76" y="50" text-anchor="middle" fill="#f5eedc" font-size="28"
      >2 + 1</text
    ><text x="295" y="50" text-anchor="middle" fill="#f5eedc" font-size="28"
      >0 / ∞</text
    >
    {#each [0, 1, 2] as i}<circle
        cx={40 + i * 53}
        cy="99"
        r="20"
        fill={step > 0 && i < step ? '#a93645' : '#f5eedc'}
      /><text
        x={40 + i * 53}
        y="106"
        text-anchor="middle"
        fill={step > 0 && i < step ? '#fff' : '#182631'}
        font-size="19">{i + 1}</text
      >{/each}
    <path
      d="M255 89c-35-37-35 57 0 20l49-20c35-37 35 57 0 20z"
      fill="none"
      stroke="#e5b863"
      stroke-width="5"
    />
    <text x="210" y="164" text-anchor="middle" fill="#f5eedc" font-size="16"
      >{step === 0 ? m.cn_count() : step === 1 ? '≥ 1' : m.cn_end_turn()}</text
    >
  {:else}
    {#each Array.from({ length: 15 }, (_, i) => i) as i}<g
        transform="translate({28 + (i % 5) * 76} {22 + Math.floor(i / 5) * 51})"
      >
        <rect
          width="65"
          height="40"
          rx="4"
          fill={(
            lesson.scene === 'finish'
              ? i % 4 === 0 && (i !== 8 || step === 2)
              : step === 2 && i === 7
          )
            ? '#a93645'
            : '#f5eedc'}
        />
        {#if lesson.scene === 'finish' ? i % 4 === 0 && (i !== 8 || step === 2) : step === 2 && i === 7}<path
            d="M12 17h41v2H12z"
            fill="#f5eedc"
          />{:else}<path
            d="M12 15h41M18 23h29"
            stroke="#b88b47"
            stroke-width="3"
          />{/if}
        {#if step === 1 && i === (lesson.scene === 'finish' ? 8 : 7)}<rect
            x="-3"
            y="-3"
            width="71"
            height="46"
            rx="5"
            fill="none"
            stroke="#e5b863"
            stroke-width="3"
          />{/if}</g
      >{/each}
  {/if}
  <text x="404" y="183" text-anchor="end" fill="#f5eedc" font-size="10"
    >0{step + 1}</text
  >
</svg>
