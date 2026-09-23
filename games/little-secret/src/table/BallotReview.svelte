<script lang="ts">
  import { m } from '@board-games/shared/messages';
  import type { Event } from '../types.js';
  import PlayerToken from './PlayerToken.svelte';
  let {
    ballot,
    players,
    close,
  }: {
    ballot: Extract<Event, { type: 'ballots' }>;
    players: { id: string; name: string }[];
    close: () => void;
  } = $props();
  const highest = $derived(Math.max(...Object.values(ballot.totals)));
  const suspects = $derived(
    players.filter((p) => ballot.totals[p.id] === highest),
  );
</script>

<div class="ballot-review" data-testid="ls-ballot-review">
  <h3>{suspects.length > 1 ? m.ls_table_tied() : m.ls_table_suspect()}</h3>
  <div class="suspects">
    {#each suspects as p}<div class="suspect">
        <PlayerToken
          name={p.name}
          seat={players.findIndex((other) => other.id === p.id) + 1}
        /><strong>{p.name}</strong><span
          >{m.ls_table_votes({ count: highest })}</span
        >
      </div>{/each}
  </div>
  <button class="primary" onclick={close}>{m.ls_table_review()} →</button>
</div>

<style>
  .ballot-review {
    text-align: center;
  }
  h3 {
    font:
      28px 'Secret Hand',
      cursive;
    border-bottom: 2px solid #9e342a;
    padding-bottom: 8px;
    margin: 0 0 22px;
  }
  .suspects {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
  }
  .suspect {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 120px;
    --token-size: 90px;
  }
  .suspect strong {
    font:
      22px 'Secret Hand',
      cursive;
    overflow-wrap: anywhere;
  }
  .suspect span {
    font:
      18px 'Secret Hand',
      cursive;
    color: #9d3027;
  }
  .primary {
    width: 100%;
    min-height: 44px;
    margin-top: 24px;
    padding: 10px;
    border: 1px solid #7c332b;
    background: #a3382d;
    color: #fff1ce;
    font:
      18px 'Secret Hand',
      cursive;
    cursor: pointer;
  }
  .primary:focus-visible {
    outline: 3px solid #c18a39;
    outline-offset: 3px;
  }
</style>
