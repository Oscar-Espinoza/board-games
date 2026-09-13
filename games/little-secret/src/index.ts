/** Server entry only. Browser presentation imports types, never the production pack. */
import { rules } from './engine.js';
import content from './words.json';
import type { Packs } from './types.js';
export const littleSecret = rules(content as Packs);
export type * from './types.js';
