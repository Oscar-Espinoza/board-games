import { getContext, setContext } from 'svelte';

const key = Symbol('ls-pixel');
export const providePixel = (on: () => boolean) => setContext(key, on);
export const usePixel = () =>
  getContext<(() => boolean) | undefined>(key) ?? (() => false);
