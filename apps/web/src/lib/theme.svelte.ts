import { read, write } from '@board-games/shared/ui';
import type { Skin } from '@board-games/shared/ui/pixel';

export type Theme = Skin;
/** Also read by the inline script in `app.html`, which applies it before first paint. */
const key = 'board-games:theme';
/** Home page look, mirrored on `html[data-theme]`. */
export const theme = $state({
  value: (document.documentElement.dataset.theme === 'pixel'
    ? 'pixel'
    : 'classic') as Theme,
});
export function setTheme(next: Theme) {
  theme.value = next;
  document.documentElement.dataset.theme = next;
  write(key, next);
}
