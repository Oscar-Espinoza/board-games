import { createAudio } from '@board-games/shared/ui';
/** Public feedback only. No context is created before an explicit user gesture. */
export function soundEffects() {
  const audio = createAudio();
  // Brief original cues depend only on accepted public event types.
  const cues = { reveal: [150, 75, 0.16], finish: [440, 660, 0.28] } as const;
  return {
    unlock: audio.unlock,
    play(volume: number, cue: keyof typeof cues) {
      const [from, to, duration] = cues[cue];
      audio.tone({
        from,
        to,
        duration,
        volume: Math.min(1, Math.max(0, volume)) * 0.08,
        attack: 0.015,
      });
    },
    cancel: audio.stop,
    dispose: audio.close,
  };
}
