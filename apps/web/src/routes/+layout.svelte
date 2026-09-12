<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import {
    getLocale,
    setLocale,
    locales,
    type Locale,
  } from '@board-games/shared/runtime';
  import { m } from '@board-games/shared/messages';
  import '../app.css';
  let { children } = $props();
  onMount(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<header class="site-header">
  <a class="brand" href="/">◈ {m.catalog()}</a>
  {#if page.url.pathname === '/'}<button
      class="catalog-join"
      onclick={() => window.dispatchEvent(new Event('catalog-join'))}
      >{m.library_join()} <span aria-hidden="true">↗</span></button
    >{/if}
  <label class="language"
    ><span class="sr-only">{m.language()}</span><select
      aria-label={m.language()}
      value={getLocale()}
      onchange={(event) => setLocale(event.currentTarget.value as Locale)}
    >
      {#each locales as locale}<option value={locale}
          >{new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ??
            locale}</option
        >{/each}
    </select></label
  >
</header>
{@render children()}

<style>
  .catalog-join {
    margin-left: auto;
    margin-right: 20px;
    background: transparent;
    color: #705c48;
    padding: 10px 4px;
    min-height: 44px;
    border-radius: 0;
    font-size: 0.9rem;
  }
  .catalog-join:focus-visible {
    outline: 3px solid #ad6138;
    outline-offset: 3px;
  }
  @media (max-width: 480px) {
    .catalog-join {
      font-size: 0.8rem;
      margin-right: 8px;
    }
    .catalog-join span {
      display: none;
    }
    :global(body:has(.library) .site-header) {
      padding: 12px 18px;
      gap: 8px;
    }
    :global(body:has(.library) .brand) {
      font-size: 0.85rem;
    }
    :global(body:has(.library) .language select) {
      padding: 8px 0;
      font-size: 0.8rem;
    }
  }
</style>
