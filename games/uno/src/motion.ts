import { movements, type UnoView } from './presentation.js';

export function cardMotion(
  root: HTMLElement,
  playerId: string,
  sound: () => void,
) {
  let previous: UnoView | undefined;
  let generation = 0;
  const running = new Set<() => void>();
  const query = (selector: string) => root.querySelector<HTMLElement>(selector);
  const card = (id: number) => query(`.hand [data-card="${id}"]`);
  const seat = (id: string) =>
    query(`[data-seat="${CSS.escape(id)}"] .seat-cards`);
  function clear() {
    generation++;
    for (const stop of running) stop();
    running.clear();
  }
  function flight(
    face: HTMLElement,
    from: DOMRect,
    target: HTMLElement,
    kind: string,
    delay: number,
    conceal: boolean,
    previousDiscard?: HTMLElement,
  ) {
    const to = target.getBoundingClientRect();
    const reference = query('.stock .card-back');
    if (!from.width || !to.width || !reference) return;
    // Lay out every face at full card size. Seat fans and rotated bounding boxes
    // are anchors, not card dimensions: stretching to them distorts the artwork.
    const width = reference.offsetWidth;
    const height = reference.offsetHeight;
    const fromScale = Math.min(from.width / width, from.height / height);
    const toScale = target.classList.contains('seat-cards')
      ? Math.min(to.width / width, to.height / height)
      : target.offsetWidth / width;
    const endRotation = target.classList.contains('discard') ? 5 : 0;
    const clone = face.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.removeAttribute('data-card');
    clone.removeAttribute('disabled');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('inert', '');
    clone.tabIndex = -1;
    clone.classList.add('uno-flight');
    clone.dataset.flight = kind;
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${from.left + from.width / 2 - width / 2}px`,
      top: `${from.top + from.height / 2 - height / 2}px`,
      width: `${width}px`,
      height: `${height}px`,
      margin: '0',
      zIndex: '100',
      pointerEvents: 'none',
      visibility: 'visible',
      opacity: '1',
      transition: 'none',
      transformOrigin: '50% 50%',
    });
    if (previousDiscard) {
      previousDiscard.classList.remove('discard');
      previousDiscard.classList.add('uno-pile-underlay');
      previousDiscard.setAttribute('aria-hidden', 'true');
      Object.assign(previousDiscard.style, {
        position: 'fixed',
        left: `${to.left + to.width / 2 - target.offsetWidth / 2}px`,
        top: `${to.top + to.height / 2 - target.offsetHeight / 2}px`,
        width: `${target.offsetWidth}px`,
        height: `${target.offsetHeight}px`,
        margin: '0',
        transform: 'rotate(5deg)',
        visibility: 'visible',
        pointerEvents: 'none',
        zIndex: '99',
      });
      root.append(previousDiscard);
    }
    root.append(clone);
    if (conceal) target.style.visibility = 'hidden';
    const dx = to.left + to.width / 2 - (from.left + from.width / 2),
      dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = clone.animate(
      [
        { transform: `translate(0,0) rotate(0deg) scale(${fromScale})` },
        {
          transform: `translate(${dx * 0.45}px,${dy * 0.45 - 28}px) rotate(${kind === 'play' ? -8 : 7}deg) scale(${(fromScale + toScale) / 2})`,
          offset: 0.45,
        },
        {
          transform: `translate(${dx}px,${dy}px) rotate(${endRotation}deg) scale(${toScale})`,
        },
      ],
      {
        duration: 480,
        delay,
        easing: 'cubic-bezier(.2,.65,.3,1)',
        fill: 'both',
      },
    );
    const finish = () => {
      animation.cancel();
      clone.remove();
      previousDiscard?.remove();
      if (conceal) target.style.visibility = '';
      running.delete(finish);
    };
    running.add(finish);
    void animation.finished.then(finish, finish);
  }
  return {
    /** Capture old geometry before Svelte patches the hand; run returned callback after tick. */
    prepare(next: UnoView, enabled: boolean, connected: boolean) {
      if (!connected || document.hidden) {
        clear();
        previous = undefined;
        return () => {};
      }
      const before = previous;
      previous = next;
      if (
        !before ||
        next.public.revision < before.public.revision ||
        next.public.revision > before.public.revision + 1
      ) {
        clear();
        return () => {};
      }
      const moves = movements(before, next, playerId);
      const previousDiscard = moves.some((move) => move.kind === 'play')
        ? (query('.discard')?.cloneNode(true) as HTMLElement | undefined)
        : undefined;
      const batch = generation;
      const prepared = moves.map((move) => {
        const source =
          move.kind === 'draw'
            ? query('.stock .card-back')
            : move.player === playerId
              ? card(move.cardId!)
              : seat(move.player);
        return {
          move,
          rect: source?.getBoundingClientRect(),
          face:
            move.kind === 'play' && move.player === playerId
              ? (source?.cloneNode(true) as HTMLElement)
              : undefined,
        };
      });
      return () => {
        if (generation !== batch || !root.isConnected) return;
        if (moves.length) sound();
        if (!enabled || typeof Element.prototype.animate !== 'function') return;
        let offset = 0;
        for (const { move, rect, face } of prepared) {
          if (!rect) continue;
          const destination =
            move.kind === 'play'
              ? query('.discard')
              : move.player === playerId
                ? card(move.cardId!)
                : seat(move.player);
          const appearance =
            move.kind === 'draw'
              ? query('.stock .card-back')
              : (face ?? query('.discard'));
          if (!destination || !appearance) continue;
          if (move.kind === 'draw' && move.player === playerId)
            destination.scrollIntoView({
              block: 'nearest',
              inline: 'nearest',
              behavior: 'instant',
            });
          for (let i = 0; i < Math.min(move.count, 5); i++)
            flight(
              appearance,
              rect,
              destination,
              move.kind,
              Math.min(offset++ * 45, 270),
              move.player === playerId || move.kind === 'play',
              move.kind === 'play' ? previousDiscard : undefined,
            );
        }
      };
    },
    clear,
    reset() {
      clear();
      previous = undefined;
    },
  };
}

/** Short, quiet filtered-paper sound. No music, external assets or continuous audio. */
export function cardAudio() {
  let context: AudioContext | undefined;
  let enabled = true;
  let last = -Infinity;
  const sources = new Set<AudioBufferSourceNode>();
  function stop() {
    for (const source of sources) {
      try {
        source.stop();
      } catch {}
    }
    sources.clear();
  }
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) stop();
    },
    unlock() {
      if (!enabled) return;
      try {
        const Context =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Context) return;
        context ??= new Context();
        if (context.state === 'suspended')
          void context.resume().catch(() => {});
      } catch {
        /* Sound is optional and never affects game actions. */
      }
    },
    play() {
      if (
        !enabled ||
        context?.state !== 'running' ||
        context.currentTime - last < 0.08
      )
        return;
      try {
        const ctx = context,
          time = ctx.currentTime;
        last = time;
        const buffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * 0.18),
          ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = ctx.createGain();
        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.Q.value = 0.6;
        filter.frequency.setValueAtTime(1300, time);
        filter.frequency.exponentialRampToValueAtTime(380, time + 0.18);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.045, time + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        source.connect(filter).connect(gain).connect(ctx.destination);
        sources.add(source);
        source.onended = () => {
          sources.delete(source);
          source.disconnect();
          filter.disconnect();
          gain.disconnect();
        };
        source.start(time);
        source.stop(time + 0.19);
      } catch {
        /* Restricted or unavailable audio leaves play unaffected. */
      }
    },
    dispose() {
      stop();
      if (context) void context.close().catch(() => {});
    },
  };
}
