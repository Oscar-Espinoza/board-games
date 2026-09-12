<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import Dish from '@board-games/sushi-go-party/Dish.svelte';
  import type { Lesson } from '../types';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
</script>

<div class="sushi-scene">
  <div class="plate">
    {#each [0, 1, 2] as n}<div
        class:lifted={step === 0 && n === 1}
        class:shown={step === 1}
      >
        <Dish
          card={{
            kind:
              lesson.scene === 'draft' ? 'nigiri' : (lesson.scene as 'nigiri'),
            variant: lesson.scene === 'onigiri' ? 'triangle' : 'salmon',
          }}
        />
      </div>{/each}
  </div>
  <span>{step === 2 ? '↻' : step === 1 ? '✦' : '▧'}</span>
</div>
{#if lesson.scene === 'draft'}<a href="/practice/sushi-go-party"
    >{m.sgp_practice()}</a
  >{/if}

<style>
  .sushi-scene {
    background: #c3daca;
    border-radius: 20px;
    min-height: 190px;
    display: grid;
    place-items: center;
    padding: 25px;
  }
  .plate {
    display: flex;
    justify-content: center;
    gap: 10px;
    background: #fff6df;
    border: 4px double #e0dfc0;
    border-radius: 50%;
    padding: 20px;
  }
  .plate > div {
    width: 75px;
    height: 75px;
    transition: transform 0.3s;
  }
  .plate .lifted {
    transform: translateY(-18px) rotate(-7deg);
  }
  .plate .shown {
    transform: rotate(5deg);
  }
  .sushi-scene > span {
    color: #b36d59;
    font-size: 28px;
    margin-top: 8px;
  }
  @media (prefers-reduced-motion: reduce) {
    .plate > div {
      transition: none;
    }
  }
</style>
