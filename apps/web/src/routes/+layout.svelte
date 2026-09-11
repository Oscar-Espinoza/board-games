<script lang="ts">
  import { onMount } from 'svelte';
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
  <a class="brand" href="/">◈ {m.catalog()}</a><label class="language"
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
