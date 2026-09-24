import { getContext, setContext } from 'svelte';

/** Board shares whether the 8-bit skin is active with its table components. */
const key = Symbol('ls-pixel');
export const providePixel = (on: () => boolean) => setContext(key, on);
export const usePixel = () =>
  getContext<(() => boolean) | undefined>(key) ?? (() => false);
