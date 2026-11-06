import { getContext, setContext } from 'svelte';

const key = Symbol('sgp-pixel');
export const providePixel = (on: () => boolean) => setContext(key, on);
export function usePixel(): () => boolean {
  return getContext<(() => boolean) | undefined>(key) ?? (() => false);
}
