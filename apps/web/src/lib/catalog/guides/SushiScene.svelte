<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import Dish from '@board-games/sushi-go-party/Dish.svelte';
  import type { Lesson } from '../types';
  import { sushiScenes } from './sushi-scenes';
  let { lesson, step }: { lesson: Lesson; step: number } = $props();
  const frame = $derived(sushiScenes[lesson.id][step]);
</script>

<div
  class="sushi-scene"
  role="img"
  aria-label={`${lesson.title()}. ${lesson.frames[step]()}`}
>
  <div class="plates" aria-hidden="true">
    {#each frame.plates as plate}
      <div class="plate">
        <div class="cards">
          {#each plate.cards as card}
            <div class="tile" class:boxed={card.boxed}>
              <Dish {card} boxed={card.boxed} />
              {#if card.mark}<b>{card.mark}</b>{/if}
            </div>
          {:else}<span class="empty">∅</span>{/each}
        </div>
        {#if plate.result}<strong>{plate.result}</strong>{/if}
      </div>
    {/each}
  </div>
  <div class="equation" aria-hidden="true">{frame.equation}</div>
  <small aria-hidden="true">{m.sgp_example_tile()}</small>
</div>
{#if lesson.scene === 'draft'}<a href="/practice/sushi-go-party"
    >{m.sgp_practice()}</a
  >{/if}

<style>
  .sushi-scene {
    background: #c3daca;
    color: #244b40;
    border-radius: 20px;
    min-height: 190px;
    display: grid;
    justify-items: center;
    gap: 16px;
    padding: 20px 12px;
  }
  .plates {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: start;
    gap: 12px;
    width: 100%;
  }
  .plate {
    display: grid;
    justify-items: center;
    gap: 8px;
    background: #fff6df;
    border: 3px double #a2b29a;
    border-radius: 24px;
    padding: 12px;
    max-width: 100%;
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  .tile {
    position: relative;
    width: 62px;
    height: 72px;
    background: #fffdf6;
    border: 1px solid #adb7a1;
    border-radius: 7px;
    padding: 4px;
  }
  .tile b {
    position: absolute;
    top: -7px;
    right: -3px;
    border-radius: 50%;
    background: #244b40;
    color: #fff9e6;
    padding: 2px 5px;
    font-size: 14px;
  }
  .boxed {
    background: #e9d6b0;
  }
  .empty {
    min-width: 40px;
    padding: 20px 0;
    color: #687965;
  }
  strong {
    font-size: 19px;
  }
  .equation {
    font-size: clamp(17px, 3vw, 24px);
    font-weight: 750;
    text-align: center;
    overflow-wrap: anywhere;
  }
  small {
    text-align: center;
    font-size: 12px;
  }
  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-top: 8px;
  }
  @media (max-width: 420px) {
    .plate {
      padding: 8px;
    }
    .tile {
      width: 49px;
      height: 59px;
    }
    .plates {
      gap: 8px;
    }
  }
</style>
