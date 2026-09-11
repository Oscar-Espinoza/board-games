<script lang="ts">
  let { values }: { values: number[] | null } = $props();
  const faces = (front: number) => {
    const sides = [1, 2, 3, 4, 5, 6].filter(
      (n) => n !== front && n !== 7 - front,
    );
    return [front, 7 - front, sides[0], 7 - sides[0], sides[1], 7 - sides[1]];
  };
  const pips = [
    [4],
    [0, 8],
    [0, 4, 8],
    [0, 2, 6, 8],
    [0, 2, 4, 6, 8],
    [0, 2, 3, 5, 6, 8],
  ];
</script>

<div
  class="dice"
  aria-live="polite"
  aria-label={values ? values.join(' + ') : '—'}
>
  {#each [0, 1] as i}
    <div class="die-space">
      <div class="die" class:red={i === 1} data-value={values?.[i] ?? 0}>
        {#each faces(values?.[i] ?? 1) as value, face}
          <div class="face" data-face={face}>
            {#each Array(9) as _, cell}<i
                class:visible={pips[value - 1].includes(cell)}
              ></i>{/each}
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .dice {
    display: flex;
    gap: 18px;
    align-items: center;
    justify-content: center;
    padding: 12px;
    perspective: 650px;
  }
  .die-space {
    --size: 44px;
    width: var(--size);
    height: var(--size);
    filter: drop-shadow(3px 8px 5px #00192380);
  }
  .die {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
  }
  .face {
    position: absolute;
    inset: 0;
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 3px;
    border-radius: 7px;
    background: linear-gradient(135deg, #fff7de, #dfc895);
    box-shadow:
      inset 0 0 0 1px #9a793f,
      inset 1px 2px 2px #fff9;
    backface-visibility: hidden;
  }
  .red .face {
    background: linear-gradient(135deg, #ed7958, #a32a24);
  }
  .face:nth-child(1) {
    transform: translateZ(calc(var(--size) / 2));
  }
  .face:nth-child(2) {
    transform: rotateY(180deg) translateZ(calc(var(--size) / 2));
  }
  .face:nth-child(3) {
    transform: rotateY(90deg) translateZ(calc(var(--size) / 2));
  }
  .face:nth-child(4) {
    transform: rotateY(-90deg) translateZ(calc(var(--size) / 2));
  }
  .face:nth-child(5) {
    transform: rotateX(90deg) translateZ(calc(var(--size) / 2));
  }
  .face:nth-child(6) {
    transform: rotateX(-90deg) translateZ(calc(var(--size) / 2));
  }
  i {
    border-radius: 50%;
    background: #3c3526;
    box-shadow: inset 0 1px 1px #0008;
    opacity: 0;
  }
  i.visible {
    opacity: 1;
  }
  .red i {
    background: #fff0ce;
  }
  @media (max-width: 700px) {
    .die-space {
      --size: 30px;
    }
    .face {
      padding: 5px;
      gap: 2px;
    }
    .dice {
      gap: 12px;
      padding: 7px;
    }
  }
</style>
