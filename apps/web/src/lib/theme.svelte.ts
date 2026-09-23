export type Theme = 'classic' | 'pixel';
const key = 'board-games:theme';
/** Home page look. `app.html` applies the saved value before first paint. */
export const theme = $state({
  value: (document.documentElement.dataset.theme === 'pixel'
    ? 'pixel'
    : 'classic') as Theme,
});
export function setTheme(next: Theme) {
  theme.value = next;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(key, next);
  } catch {}
}
