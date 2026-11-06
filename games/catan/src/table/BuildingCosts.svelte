<script lang="ts">
  import ResourceArt from '../ResourceArt.svelte';
  import { m } from '@board-games/shared/messages';
  import type { Locale } from '@board-games/shared/runtime';
  let { locale }: { locale?: Locale } = $props();
  const rows = [
    {
      label: m.catan_road,
      cost: [
        [0, 1],
        [3, 1],
      ],
    },
    {
      label: m.catan_settlement,
      cost: [
        [0, 1],
        [3, 1],
        [1, 1],
        [2, 1],
      ],
    },
    {
      label: m.catan_city,
      cost: [
        [2, 2],
        [4, 3],
      ],
    },
    {
      label: m.catan_development,
      cost: [
        [1, 1],
        [2, 1],
        [4, 1],
      ],
    },
  ];
</script>

<aside
  class="building-costs"
  aria-label={m.catan_building_costs({}, { locale })}
>
  <h2>{m.catan_costs_title({}, { locale })}</h2>
  {#each rows as row}<div class="cost-row">
      <b>{row.label({}, { locale })}</b><span
        class="cost-resources"
        aria-hidden="true"
        >{#each row.cost as [resource, count], i}{#if i}<span class="plus"
              >+</span
            >{/if}<span class="cost-resource"
            ><ResourceArt {resource} />{#if count > 1}<small>×{count}</small
              >{/if}</span
          >{/each}</span
      >
    </div>{/each}
</aside>

<style>
  .building-costs {
    position: absolute;
    right: 1.3%;
    bottom: 4.8%;
    width: 18%;
    padding: 12px 13px 10px;
    color: #302311;
    font-family: Georgia, serif;
    border: 6px ridge #c49c61;
    border-radius: 6px 9px 4px 7px;
    background: radial-gradient(ellipse at 40% 30%, #fff5d9, #e9cd92);
    box-shadow:
      inset 0 0 14px #b48644,
      3px 8px 7px #160b0caf;
    transform: rotate(0.3deg);
    z-index: 2;
  }
  h2 {
    text-align: center;
    text-transform: uppercase;
    font-size: clamp(12px, 1vw, 18px);
    margin: 0 0 5px;
  }
  .cost-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    border-top: 1px solid #98744180;
    min-height: clamp(31px, 4.6vh, 48px);
    font-size: clamp(10px, 0.85vw, 15px);
  }
  .cost-row b {
    font-weight: normal;
  }
  .cost-resources {
    display: flex;
    align-items: center;
  }
  .cost-resource {
    display: flex;
    align-items: center;
  }
  .cost-resource :global(.resource-art) {
    width: clamp(20px, 2vw, 35px);
    height: clamp(20px, 2vw, 35px);
  }
  .plus {
    font-size: 11px;
  }
  small {
    font:
      bold 10px Georgia,
      serif;
  }
  @media (max-width: 1000px) {
    .building-costs {
      right: 10px;
      width: 21%;
      padding: 6px;
    }
    .plus {
      display: none;
    }
  }
  @media (max-width: 700px) {
    .building-costs {
      display: none;
    }
  }
</style>
