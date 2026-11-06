import { clamp01, createAudio } from '@board-games/shared/ui';
/** Gesture-only, disposable synthesis. No network assets, loops or hidden-card cues. */
export function tableAudio() {
  const audio = createAudio();
  const cues = { paper: [220, 100], ceramic: [740, 430], score: [490, 690] };
  return {
    unlock: () => void audio.unlock(),
    play(kind: keyof typeof cues, volume: number) {
      const [from, to] = cues[kind];
      audio.tone({
        from,
        to,
        duration: 0.12,
        volume: Math.min(0.035, clamp01(volume) * 0.045),
        attack: 0.002,
      });
    },
    close: audio.close,
  };
}
export function passBundles(
  root: HTMLElement,
  edges: { from: string; to: string; count: number }[],
  delay = 0,
  pixel = false,
): () => void {
  const elements: HTMLElement[] = [];
  const animations: Animation[] = [];
  const bounds = root.getBoundingClientRect();
  const seats = [...root.querySelectorAll<HTMLElement>('[data-seat]')];
  for (const edge of edges) {
    if (!edge.count) continue;
    const from = seats
        .find((el) => el.dataset.seat === edge.from)
        ?.getBoundingClientRect(),
      to = seats
        .find((el) => el.dataset.seat === edge.to)
        ?.getBoundingClientRect();
    if (!from || !to) continue;
    const bundle = document.createElement('div');
    bundle.className = 'sushi-passing-bundle';
    bundle.setAttribute('aria-hidden', 'true');
    bundle.style.cssText =
      'position:absolute;width:29px;height:41px;border:2px solid #f9dfbc;border-radius:6px;background:repeating-radial-gradient(ellipse at 50% 95%,transparent 0 3px,#f2aa9244 4px 5px,transparent 6px 8px),#aa474a;background-size:26px 27px;box-shadow:3px 3px 0 #8a4245,5px 5px 0 #fff4dd;pointer-events:none;z-index:8;left:0;top:0;display:grid;place-items:center;color:#f0b0a0';
    bundle.textContent = '✿';
    if (pixel) {
      // 8-bit: a hard-edged card back with the emblem sprite, moved in steps.
      bundle.className += ' px-bundle';
      bundle.textContent = '';
    }
    const large = root.dataset.layout === 'desktop';
    if (large) {
      bundle.style.width = '60px';
      bundle.style.height = '78px';
      bundle.style.fontSize = '32px';
    }
    root.append(bundle);
    elements.push(bundle);
    const x1 = from.x + from.width / 2 - bounds.x - (large ? 30 : 15),
      y1 = from.y + from.height / 2 - bounds.y - (large ? 39 : 20),
      x2 = to.x + to.width / 2 - bounds.x - (large ? 30 : 15),
      y2 = to.y + to.height / 2 - bounds.y - (large ? 39 : 20);
    const turn = (deg: number) => (pixel ? '' : ` rotate(${deg}deg)`);
    const anim = bundle.animate(
      [
        { transform: `translate(${x1}px,${y1}px)${turn(-9)}`, opacity: 0 },
        {
          transform: `translate(${x1}px,${y1}px)${turn(-9)}`,
          opacity: 1,
          offset: 0.08,
        },
        {
          transform: `translate(${(x1 + x2) / 2}px,${(y1 + y2) / 2 - 35}px)${turn(5)}`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${x2}px,${y2}px)${turn(9)}`, opacity: 0 },
      ],
      {
        duration: pixel ? 560 : 420,
        delay,
        fill: 'both',
        easing: pixel ? 'steps(7, jump-end)' : 'ease-in-out',
      },
    );
    animations.push(anim);
    anim.onfinish = () => bundle.remove();
  }
  return () => {
    animations.forEach((a) => a.cancel());
    elements.forEach((e) => e.remove());
  };
}
