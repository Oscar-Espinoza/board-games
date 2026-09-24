import { getContext, setContext } from 'svelte';

/** The Board shares whether the 8-bit skin is on; cards and tiles draw sprites then. */
const key = Symbol('sgp-pixel');
export const providePixel = (on: () => boolean) => setContext(key, on);
export function usePixel(): () => boolean {
  return getContext<(() => boolean) | undefined>(key) ?? (() => false);
}
