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
  import { setTheme, theme } from '$lib/theme.svelte';
  import '../app.css';
  let { children } = $props();
  onMount(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<header class="site-header">
  <a class="brand" href="/">◈ {m.catalog()}</a>
  {#if page.url.pathname === '/' && theme.value === 'pixel'}<nav
      class="store-nav"
    >
      <a href="/">{m.pixel_home()}</a><a href="#pixel-games"
        >{m.pixel_games()}</a
      ><a href="#pixel-categories">{m.pixel_categories()}</a>
    </nav>{/if}
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
  {#if page.url.pathname === '/'}<div
      class="theme-switch"
      role="group"
      aria-label={m.theme_label()}
    >
      {#each ['classic', 'pixel'] as const as option}<button
          aria-pressed={theme.value === option}
          onclick={() => setTheme(option)}
          >{option === 'pixel' ? m.theme_pixel() : m.theme_classic()}</button
        >{/each}
    </div>{/if}
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
  .theme-switch {
    display: flex;
    margin-left: 14px;
    border: 1px solid #b39a7355;
    border-radius: 6px;
    overflow: hidden;
  }
  .theme-switch button {
    background: transparent;
    color: #705c48;
    border-radius: 0;
    padding: 6px 10px;
    min-height: 36px;
    font-size: 0.8rem;
  }
  .theme-switch button[aria-pressed='true'] {
    background: #a74531;
    color: #fff5df;
  }
  .store-nav {
    display: flex;
    gap: 6px;
    margin-left: 24px;
  }
  .store-nav a {
    text-decoration: none;
    text-transform: uppercase;
    background: #3a2213;
    border: 2px solid #1e110a;
    box-shadow: inset 0 -3px 0 #00000055;
    padding: 8px 14px;
    letter-spacing: 0.04em;
  }
  .store-nav a:first-child {
    background: #3f9a4a;
    border-color: #1f5a27;
  }
  :global(body:has(.pixel-store) .site-header) {
    border: 0;
    background: #2a1a10;
    color: #f6e7c8;
    padding: 10px;
  }
  :global(body:has(.pixel-store) .brand) {
    font-size: 1.35rem;
    text-transform: uppercase;
    color: #f2c14e;
    background: #5b3620;
    border: 3px solid #1e110a;
    box-shadow: inset 0 0 0 2px #8a5a32;
    padding: 8px 14px;
    text-shadow: 2px 2px 0 #1e110a;
  }
  :global(body:has(.pixel-store)) .catalog-join,
  :global(body:has(.pixel-store) .language select) {
    color: #f6e7c8;
  }
  :global(body:has(.pixel-store) .language option) {
    color: #2a1a10;
  }
  :global(body:has(.pixel-store)) .theme-switch {
    border: 2px solid #1e110a;
    border-radius: 0;
  }
  :global(body:has(.pixel-store)) .theme-switch button {
    color: #f6e7c8;
  }
  :global(body:has(.pixel-store)) .theme-switch button[aria-pressed='true'] {
    background: #3f9a4a;
  }
  @media (max-width: 720px) {
    .store-nav {
      display: none;
    }
    :global(body:has(.pixel-store) .site-header) {
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 16px;
    }
    :global(body:has(.pixel-store) .brand) {
      font-size: 1rem;
      padding: 6px 10px;
    }
    :global(body:has(.pixel-store)) .catalog-join {
      margin-right: 0;
    }
  }
  @media (max-width: 480px) {
    .theme-switch {
      margin-left: 6px;
    }
    .theme-switch button {
      padding: 6px 7px;
    }
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
