/** Public feedback only. No context is created before an explicit user gesture. */
export function soundEffects() {
  let context: AudioContext | null = null;
  const sources = new Set<OscillatorNode>();
  return {
    async unlock() {
      try {
        context ??= new AudioContext();
        if (context.state === 'suspended') await context.resume();
      } catch {}
    },
    play(volume: number, cue: 'reveal' | 'finish') {
      try {
        if (!context || context.state !== 'running') return;
        const oscillator = context.createOscillator(),
          gain = context.createGain();
        // Brief original cues depend only on accepted public event types.
        const [start, end, duration] = {
          reveal: [150, 75, 0.16],
          finish: [440, 660, 0.28],
        }[cue];
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(start!, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          end!,
          context.currentTime + duration!,
        );
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(
          Math.min(1, Math.max(0, volume)) * 0.08,
          context.currentTime + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          context.currentTime + duration!,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        sources.add(oscillator);
        oscillator.onended = () => {
          sources.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + duration! + 0.02);
      } catch {}
    },
    cancel() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {}
      }
      sources.clear();
    },
    dispose() {
      for (const source of sources) {
        try {
          source.stop();
        } catch {}
      }
      sources.clear();
      void context?.close().catch(() => {});
      context = null;
    },
  };
}
