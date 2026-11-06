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
  import { joinRequest } from '$lib/home/state.svelte';
  import '../app.css';
  let { children } = $props();
  const languageName = (locale: Locale) =>
    new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  const home = $derived(page.url.pathname === '/');
  onMount(() => {
    document.documentElement.lang = getLocale();
  });
  /** The home page restyles the chrome through `html[data-home]`: its look is the theme. */
  $effect(() => {
    if (!home) return;
    document.documentElement.dataset.home = theme.value;
    return () => {
      delete document.documentElement.dataset.home;
    };
  });
</script>

<header class="site-header">
  <a class="brand" href="/">◈ {m.catalog()}</a>
  {#if home && theme.value === 'pixel'}<nav class="store-nav">
      <a href="/">{m.pixel_home()}</a><a href="#pixel-games"
        >{m.pixel_games()}</a
      ><a href="#pixel-categories">{m.pixel_categories()}</a>
    </nav>{/if}
  {#if home}<button
      class="catalog-join"
      onclick={() => (joinRequest.pending = true)}
      >{m.library_join()} <span aria-hidden="true">↗</span></button
    >{/if}
  <label class="language"
    ><span class="sr-only">{m.language()}</span><select
      aria-label={m.language()}
      value={getLocale()}
      onchange={(event) => setLocale(event.currentTarget.value as Locale)}
    >
      {#each locales as locale}<option value={locale}
          >{languageName(locale)}</option
        >{/each}
    </select></label
  >
  {#if home}<div class="theme-switch" role="group" aria-label={m.theme_label()}>
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
  :global(html[data-home='pixel'] .site-header) {
    border: 0;
    background: #2a1a10;
    color: #f6e7c8;
    padding: 10px;
  }
  :global(html[data-home='pixel'] .brand) {
    font-size: 1.35rem;
    text-transform: uppercase;
    color: #f2c14e;
    background: #5b3620;
    border: 3px solid #1e110a;
    box-shadow: inset 0 0 0 2px #8a5a32;
    padding: 8px 14px;
    text-shadow: 2px 2px 0 #1e110a;
  }
  :global(html[data-home='pixel']) .catalog-join,
  :global(html[data-home='pixel'] .language select) {
    color: #f6e7c8;
  }
  :global(html[data-home='pixel'] .language option) {
    color: #2a1a10;
  }
  :global(html[data-home='pixel']) .theme-switch {
    border: 2px solid #1e110a;
    border-radius: 0;
  }
  :global(html[data-home='pixel']) .theme-switch button {
    color: #f6e7c8;
  }
  :global(html[data-home='pixel']) .theme-switch button[aria-pressed='true'] {
    background: #3f9a4a;
  }
  @media (max-width: 720px) {
    .store-nav {
      display: none;
    }
    :global(html[data-home='pixel'] .site-header) {
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 16px;
    }
    :global(html[data-home='pixel'] .brand) {
      font-size: 1rem;
      padding: 6px 10px;
    }
    :global(html[data-home='pixel']) .catalog-join {
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
    :global(html[data-home='classic'] .site-header) {
      padding: 12px 18px;
      gap: 8px;
    }
    :global(html[data-home='classic'] .brand) {
      font-size: 0.85rem;
    }
    :global(html[data-home='classic'] .language select) {
      padding: 8px 0;
      font-size: 0.8rem;
    }
  }
</style>
