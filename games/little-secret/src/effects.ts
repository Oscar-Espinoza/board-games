import { createAudio } from '@board-games/shared/ui';
/** Public feedback only. No context is created before an explicit user gesture. */
export function soundEffects() {
  const audio = createAudio();
  const cues = {
    clue: [900, 300, 0.09, 'triangle'],
    reveal: [150, 75, 0.16, 'sine'],
    handoff: [220, 280, 0.16, 'triangle'],
    finish: [440, 660, 0.28, 'sine'],
  } as const;
  return {
    unlock: audio.unlock,
    play(volume: number, cue: keyof typeof cues) {
      const [from, to, duration, type] = cues[cue];
      audio.tone({
        from,
        to,
        duration,
        type,
        volume: Math.min(1, Math.max(0, volume)) * 0.08,
        attack: 0.015,
      });
    },
    cancel: audio.stop,
    dispose: audio.close,
  };
}
