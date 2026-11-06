<script lang="ts">
  type Name =
    | 'logo'
    | 'agents'
    | 'players'
    | 'key'
    | 'history'
    | 'check'
    | 'close'
    | 'red'
    | 'blue'
    | 'civilian'
    | 'assassin';
  let { name }: { name: Name } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#if name === 'logo'}<g fill="currentColor" stroke="none"
      ><circle cx="6" cy="6" r="5" /><circle cx="18" cy="6" r="5" /><circle
        cx="6"
        cy="18"
        r="5"
      /><circle cx="18" cy="18" r="5" /></g
    >
  {:else if name === 'agents'}<g fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="3.5" /><circle cx="18" cy="8" r="3" />
      <path
        d="M1 21v-3a8 8 0 0 1 16 0v3ZM18.5 21v-3a9.5 9.5 0 0 0-1.7-5.4A6 6 0 0 1 24 18v3Z"
      />
    </g>
  {:else if name === 'players'}<circle cx="9" cy="7" r="3" /><path
      d="M2 20v-3a7 7 0 0 1 14 0v3zM17 4a3 3 0 0 1 0 6m2 3a6 6 0 0 1 3 5v2h-3"
    />
  {:else if name === 'key'}<path
      d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"
    /><circle cx="12" cy="12" r="3" />
  {:else if name === 'history'}<path
      d="M3 10a9 9 0 1 1 1 7M3 3v7h7m2-4v6l4 3"
    />
  {:else if name === 'check'}<path d="m4 12 5 5L20 6" />
  {:else if name === 'red'}<path
      fill="currentColor"
      stroke="none"
      d="m12 3 9 9-9 9-9-9Z"
    />
  {:else if name === 'blue'}<circle cx="12" cy="12" r="8" fill="currentColor" />
  {:else if name === 'civilian'}<circle cx="12" cy="12" r="8" />
  {:else}<path d="m5 5 14 14M19 5 5 19" />{/if}
</svg>

<style>
  svg {
    width: 1.35em;
    height: 1.35em;
    flex: none;
    vertical-align: middle;
  }
</style>
