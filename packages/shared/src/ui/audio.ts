/**
 * Gesture-unlocked Web Audio synthesis shared by every table. No context exists
 * before `unlock()` runs from a user gesture, and denied or missing audio never
 * throws into game code.
 */
export type Tone = {
  /** Seconds from now. */
  delay?: number;
  from: number;
  to?: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  attack?: number;
};
export type Noise = {
  delay?: number;
  duration: number;
  volume: number;
  frequency: number;
  /** Optional filter sweep target. */
  sweep?: number;
  filter?: BiquadFilterType;
  q?: number;
  attack?: number;
};

export const clamp01 = (volume: number) => Math.min(1, Math.max(0, volume));

export function createAudio() {
  let context: AudioContext | undefined;
  const live = new Set<AudioScheduledSourceNode>();
  const running = () => (context?.state === 'running' ? context : undefined);
  function envelope(ctx: AudioContext, at: number, s: Tone | Noise) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(s.volume, at + (s.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + s.duration);
    gain.connect(ctx.destination);
    return gain;
  }
  function start(
    source: AudioScheduledSourceNode,
    at: number,
    duration: number,
    nodes: AudioNode[],
  ) {
    live.add(source);
    source.onended = () => {
      live.delete(source);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
    source.start(at);
    source.stop(at + duration + 0.02);
  }
  function stop() {
    for (const source of live)
      try {
        source.stop();
      } catch {}
    live.clear();
  }
  return {
    /** True once a gesture has resumed the context. */
    get ready() {
      return !!running();
    },
    async unlock() {
      try {
        const Context =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Context) return;
        context ??= new Context();
        if (context.state === 'suspended') await context.resume();
      } catch {}
    },
    tone(s: Tone) {
      const ctx = running();
      if (!ctx) return;
      try {
        const at = ctx.currentTime + (s.delay ?? 0),
          oscillator = ctx.createOscillator(),
          gain = envelope(ctx, at, s);
        oscillator.type = s.type ?? 'sine';
        oscillator.frequency.setValueAtTime(s.from, at);
        if (s.to)
          oscillator.frequency.exponentialRampToValueAtTime(
            s.to,
            at + s.duration,
          );
        oscillator.connect(gain);
        start(oscillator, at, s.duration, [gain]);
      } catch {}
    },
    noise(s: Noise) {
      const ctx = running();
      if (!ctx) return;
      try {
        const at = ctx.currentTime + (s.delay ?? 0),
          buffer = ctx.createBuffer(
            1,
            Math.ceil(ctx.sampleRate * s.duration),
            ctx.sampleRate,
          ),
          data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          gain = envelope(ctx, at, s);
        source.buffer = buffer;
        filter.type = s.filter ?? 'bandpass';
        filter.Q.value = s.q ?? 0.6;
        filter.frequency.setValueAtTime(s.frequency, at);
        if (s.sweep)
          filter.frequency.exponentialRampToValueAtTime(
            s.sweep,
            at + s.duration,
          );
        source.connect(filter).connect(gain);
        start(source, at, s.duration, [filter, gain]);
      } catch {}
    },
    /** Play prebuilt mono samples (e.g. from ZzFX) at `volume` (0–1). */
    samples(data: ArrayLike<number>, sampleRate: number, volume: number) {
      const ctx = running();
      if (!ctx || !data.length) return;
      try {
        const buffer = ctx.createBuffer(1, data.length, sampleRate),
          channel = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) channel[i] = data[i]!;
        const source = ctx.createBufferSource(),
          gain = ctx.createGain();
        source.buffer = buffer;
        gain.gain.value = volume;
        source.connect(gain).connect(ctx.destination);
        start(source, ctx.currentTime, buffer.duration, [gain]);
      } catch {}
    },
    stop,
    close() {
      stop();
      void context?.close().catch(() => {});
      context = undefined;
    },
  };
}
export type Audio = ReturnType<typeof createAudio>;
