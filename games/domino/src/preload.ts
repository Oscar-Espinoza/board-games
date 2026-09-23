/**
 * Starts every heavy download for the table as soon as a Domino board is
 * requested, in parallel with the board's own code, instead of one after another.
 */
const ART = ['patio.webp', 'wood.webp', 'leather.webp'];
/** Only the desktop table carries the beer; phones never request it. */
const PROPS = ['beer-label.webp', 'beer-neck.webp'];
let started = false;
export function preload() {
  if (started || typeof document === 'undefined') return;
  started = true;
  void import('./three/scene.js');
  const link = (href: string) => {
    const el = document.createElement('link');
    el.rel = 'preload';
    el.as = 'image';
    el.href = href;
    // No crossorigin: CSS and three.js request these plainly, and a mode
    // mismatch would download every image twice.
    document.head.append(el);
  };
  const phone = matchMedia('(max-width: 720px), (max-height: 520px)').matches;
  for (const file of phone ? ART : [...ART, ...PROPS])
    link(`/games/domino/${file}`);
}
