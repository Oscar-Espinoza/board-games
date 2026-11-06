import { getContext, setContext } from 'svelte';

const key = Symbol('catan-skin');
/** The Board tells its parts whether the 8-bit skin is showing. */
export const provideSkin = (pixel: () => boolean) => setContext(key, pixel);
export const useSkin = () => getContext<() => boolean>(key);
