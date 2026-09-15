/** Gesture-only, disposable synthesis. No network assets, loops or hidden-card cues. */
export function tableAudio() {
  let context: AudioContext | null = null;
  return {
    unlock() {
      try {
        if (!context) context = new AudioContext();
        if (context.state === 'suspended')
          void context.resume().catch(() => {});
      } catch {}
    },
    play(kind: 'paper' | 'ceramic' | 'score', volume: number) {
      try {
        if (!context || context.state !== 'running') return;
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.connect(gain);
        gain.connect(context.destination);
        const now = context.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(
          kind === 'paper' ? 220 : kind === 'ceramic' ? 740 : 490,
          now,
        );
        osc.frequency.exponentialRampToValueAtTime(
          kind === 'paper' ? 100 : kind === 'ceramic' ? 430 : 690,
          now + 0.08,
        );
        gain.gain.setValueAtTime(
          Math.min(0.035, Math.max(0, volume) * 0.045),
          now,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.14);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      } catch {}
    },
    close() {
      try {
        void context?.close().catch(() => {});
      } catch {}
      context = null;
    },
  };
}
export function passBundles(
  root: HTMLElement,
  edges: { from: string; to: string; count: number }[],
  delay = 0,
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
    const anim = bundle.animate(
      [
        { transform: `translate(${x1}px,${y1}px) rotate(-9deg)`, opacity: 0 },
        {
          transform: `translate(${x1}px,${y1}px) rotate(-9deg)`,
          opacity: 1,
          offset: 0.08,
        },
        {
          transform: `translate(${(x1 + x2) / 2}px,${(y1 + y2) / 2 - 35}px) rotate(5deg)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${x2}px,${y2}px) rotate(9deg)`, opacity: 0 },
      ],
      { duration: 420, delay, fill: 'both', easing: 'ease-in-out' },
    );
    animations.push(anim);
    anim.onfinish = () => bundle.remove();
  }
  return () => {
    animations.forEach((a) => a.cancel());
    elements.forEach((e) => e.remove());
  };
}
