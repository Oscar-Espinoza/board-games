import { replaceState } from '$app/navigation';
import { gameIds, type GameId } from '@board-games/shared';

const param = '_guideRetry';
/** The rules button that reopens the rulebook once the page has reloaded. */
const rulesButton = '[data-rules]';

/**
 * Failed ES module imports are cached by the browser, and WebKit keeps failed script
 * resources across reloads. Refresh the already-requested app chunks, then reload this
 * page with a hash that reopens only this rulebook. False when `cancelled()` after the fetch.
 */
export async function reloadRulebook(game: GameId, cancelled: () => boolean) {
  const assets = new Set(
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => {
        const url = new URL(name);
        return (
          url.origin === location.origin &&
          url.pathname.startsWith('/_app/') &&
          url.pathname.endsWith('.js')
        );
      }),
  );
  await Promise.allSettled(
    [...assets].map((url) =>
      fetch(url, { cache: 'reload', signal: AbortSignal.timeout(5000) }),
    ),
  );
  if (cancelled()) return;
  const url = new URL(window.location.href);
  url.searchParams.set(param, String(Date.now()));
  url.hash = `rules-${game}`;
  window.location.replace(url);
}

/** The game whose rulebook a retry reload should reopen, if this load is one. */
export function recoveredRulebook(): GameId | undefined {
  return gameIds.find((id) => window.location.hash === `#rules-${id}`);
}

/** Drops the retry param and returns focus to the rules button. */
export function finishRecovery() {
  const restored = new URL(window.location.href);
  restored.searchParams.delete(param);
  replaceState(restored.pathname + restored.search, {});
  document.querySelector<HTMLButtonElement>(rulesButton)?.focus();
}
