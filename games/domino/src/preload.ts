import { gameSkin } from '@board-games/shared/ui/pixel';
import { COMPACT } from './constants.js';
import { PIXEL_ART } from './pixel/art.js';

/**
 * Starts every heavy download for the table as soon as a Domino board is
 * requested, in parallel with the board's own code, instead of one after another.
 * Only the chosen look is fetched: the 8-bit table never downloads three.js.
 */
const ART = ['patio.webp', 'wood.webp', 'leather.webp'];
/** Only the desktop 3D table carries the beer; phones never request it. */
const PROPS = ['beer-label.webp', 'beer-neck.webp'];
const PIXEL = PIXEL_ART.map((name) => `pixel/${name}.webp`);
let started = false;
export function preload() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const link = (href: string) => {
    const el = document.createElement('link');
    el.rel = 'preload';
    el.as = 'image';
    el.href = href;
    // No crossorigin: CSS, canvas and three.js request these plainly, and a
    // mode mismatch would download every image twice.
    document.head.append(el);
  };
  const phone = matchMedia(COMPACT).matches;
  if (gameSkin('domino') === 'pixel') {
    void import('./pixel/PixelTable.svelte');
    // Phones show no characters, only the patio.
    for (const file of phone ? PIXEL.slice(0, 2) : PIXEL)
      link(`/games/domino/${file}`);
    return;
  }
  void import('./three/Table3D.svelte');
  void import('./three/scene.js');
  for (const file of phone ? ART : [...ART, ...PROPS])
    link(`/games/domino/${file}`);
}
