import type { Event } from './index.js';
export function tableAudio() {
  let ctx: AudioContext | undefined;
  let muted = false;
  let generation = 0;
  const active = new Set<AudioScheduledSourceNode>();
  const noise = (
    at: number,
    duration: number,
    volume: number,
    frequency: number,
  ) => {
    if (!ctx) return;
    const b = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    );
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const o = ctx.createBufferSource(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    o.buffer = b;
    f.type = 'bandpass';
    f.frequency.value = frequency;
    f.Q.value = 0.55;
    g.gain.setValueAtTime(0.001, at);
    g.gain.linearRampToValueAtTime(volume, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, at + duration);
    o.connect(f).connect(g).connect(ctx.destination);
    active.add(o);
    o.onended = () => {
      active.delete(o);
      o.disconnect();
      g.disconnect();
      f.disconnect();
    };
    o.start(at);
    o.stop(at + duration);
  };
  function play(kind: string, delay = 0) {
    try {
      if (muted || ctx?.state !== 'running') return;
      const t = ctx.currentTime + delay;
      // Broad filtered textures, never pitched oscillators: paper, wood and metal.
      const cues: Record<string, number[][]> = {
        rotate: [[0, 0.12, 0.09, 2100]],
        preview: [[0, 0.065, 0.08, 850]],
        place: [
          [0, 0.12, 0.24, 190],
          [0.018, 0.07, 0.12, 850],
        ],
        meeple: [
          [0, 0.065, 0.19, 650],
          [0.035, 0.045, 0.08, 1300],
        ],
        return: [
          [0, 0.15, 0.07, 2600],
          [0.13, 0.06, 0.1, 600],
        ],
        score: [
          [0, 0.08, 0.1, 800],
          [0.1, 0.07, 0.09, 1200],
          [0.2, 0.09, 0.07, 1700],
        ],
        final: [
          [0, 0.08, 0.1, 800],
          [0.1, 0.07, 0.09, 1200],
          [0.2, 0.09, 0.07, 1700],
        ],
        gold: [
          [0, 0.035, 0.12, 4300],
          [0.06, 0.05, 0.09, 6100],
          [0.13, 0.04, 0.07, 3700],
        ],
        goods: [
          [0, 0.07, 0.12, 480],
          [0.09, 0.09, 0.1, 950],
        ],
        flight: [
          [0, 0.12, 0.09, 1100],
          [0.09, 0.13, 0.08, 1800],
          [0.19, 0.15, 0.07, 2600],
        ],
        ferry: [
          [0, 0.4, 0.15, 450],
          [0.12, 0.3, 0.08, 1100],
        ],
        magic: [
          [0, 0.28, 0.06, 4500],
          [0.12, 0.3, 0.05, 6200],
        ],
        draw: [
          [0, 0.18, 0.065, 3200],
          [0.12, 0.08, 0.04, 1800],
        ],
        message: [
          [0, 0.24, 0.06, 2400],
          [0.17, 0.12, 0.05, 3900],
        ],
        extra: [
          [0, 0.08, 0.1, 650],
          [0.14, 0.08, 0.1, 950],
        ],
        robber: [
          [0, 0.15, 0.12, 300],
          [0.08, 0.08, 0.05, 1600],
        ],
        win: [
          [0, 0.12, 0.12, 850],
          [0.13, 0.12, 0.1, 1300],
          [0.26, 0.14, 0.08, 2100],
          [0.4, 0.2, 0.06, 3400],
        ],
      };
      for (const [offset, duration, volume, frequency] of cues[kind] ?? [])
        noise(t + offset, duration, volume, frequency);
    } catch {}
  }
  return {
    unlock() {
      try {
        ctx ??= new AudioContext();
        const g = generation;
        void ctx
          .resume()
          .then(() => {
            if (g !== generation) return;
          })
          .catch(() => {});
      } catch {}
    },
    play,
    events(events: Event[]) {
      events
        .slice(-10)
        .forEach((e, i) => play(e.kind, Math.min(i * 0.06, 0.4)));
    },
    mute(value: boolean) {
      muted = value;
      generation++;
      if (value)
        for (const o of active)
          try {
            o.stop();
          } catch {}
    },
    close() {
      generation++;
      void ctx?.close().catch(() => {});
    },
  };
}
/** Snapshots after a gap establish a baseline rather than replaying old effects. */
export class EventGate {
  private round = -1;
  private last = -1;
  private offline = false;
  take(round: number, events: Event[], connected = true) {
    const newest = events.at(-1)?.id ?? 0;
    if (!connected || this.offline || round !== this.round || this.last < 0) {
      this.offline = !connected;
      this.round = round;
      this.last = newest;
      return [];
    }
    const fresh = events.filter((e) => e.id > this.last);
    const contiguous = !fresh.length || fresh[0].id === this.last + 1;
    this.last = newest;
    return contiguous ? fresh : [];
  }
}
