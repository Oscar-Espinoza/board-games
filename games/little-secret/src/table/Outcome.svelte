<script lang="ts">
  import type { Public, Role } from '../types.js';
  import { m } from '@board-games/shared/messages';
  import PlayerToken from './PlayerToken.svelte';
  import { usePixel } from '../pixel/context.js';
  import { awarded } from '../result.js';
  import Sprite from '../pixel/Sprite.svelte';
  const pixel = usePixel();
  let {
    state,
    players,
  }: { state: Public; players: { id: string; name: string }[] } = $props();
  const honored = $derived(
    players.filter((p) => state.result && awarded(state.result, p.id)),
  );
  const factions = $derived([
    ...new Set(honored.map((p) => state.result!.roles[p.id])),
  ]);
</script>

<div class="outcome" class:px={pixel()}>
  {#if pixel()}<div class="px-scene" aria-hidden="true">
      <Sprite
        sheet="props"
        frame={state.result!.winners.length
          ? 'trophy'
          : state.result!.reason === 'disciples'
            ? 'cuffs'
            : state.result!.reason === 'guess'
              ? 'open'
              : 'door'}
        scale={2}
      />
      {#each factions as faction}<Sprite
          sheet="icons"
          frame={faction}
          scale={2}
        />{/each}
      {#if state.result!.winners.length}<Sprite
          sheet="mascot"
          frame="cheer"
          scale={2}
        />{/if}
    </div>{:else}
    <div class="emblems" aria-hidden="true">
      {#each factions as faction}<span
          class:infiltrator={faction === 'infiltrator'}
          >{faction === 'disciple'
            ? '✦'
            : faction === 'journalist'
              ? '✒'
              : '◈'}</span
        >{/each}
    </div>{/if}
  <h3>
    {state.result!.winners.length
      ? m.ls_winners()
      : factions.map((f) => m[`ls_${f as Role}`]()).join(' + ')}
  </h3>
  <div class="honorees">
    {#each honored as p}<div>
        <PlayerToken
          name={p.name}
          seat={players.findIndex((other) => other.id === p.id) + 1}
          active
        /><strong>{p.name}</strong>
      </div>{/each}
  </div>
  <p class="outcome-caption">{m[`ls_reason_${state.result!.reason}`]()}</p>
</div>

<style>
  .outcome {
    text-align: center;
  }
  .emblems {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
  .emblems span {
    font: 28px Georgia;
    color: #b18742;
    border: double 5px #af8647;
    border-radius: 50%;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
  }
  .emblems .infiltrator {
    color: #96362b;
    border-color: #96362b;
  }
  h3 {
    font:
      24px 'Secret Hand',
      cursive;
    margin: 8px 0;
    border-bottom: 2px solid #9d4131;
  }
  .honorees {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px 12px;
  }
  .honorees > div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    max-width: 110px;
    --token-size: 42px;
  }
  .honorees strong {
    font:
      16px 'Secret Hand',
      cursive;
    overflow-wrap: anywhere;
  }
  .outcome-caption {
    font-size: 13px;
    line-height: 1.5;
    margin: 10px 0 0;
  }
</style>
