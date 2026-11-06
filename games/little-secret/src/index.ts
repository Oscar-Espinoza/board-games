import { rules, type Packs } from './engine.js';
import content from './words.json';
export const littleSecret = rules(content as Packs);
export type * from './types.js';
