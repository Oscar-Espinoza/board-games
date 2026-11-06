import { createAudio } from '@board-games/shared/ui';

/** Short, quiet filtered-paper sound. No music, external assets or continuous audio. */
export function cardAudio(enabled: () => boolean) {
  const audio = createAudio();
  let last = -Infinity;
  return {
    audio,
    unlock() {
      if (enabled()) void audio.unlock();
    },
    play() {
      const now = performance.now() / 1000;
      if (!enabled() || !audio.ready || now - last < 0.08) return;
      last = now;
      audio.noise({
        duration: 0.18,
        volume: 0.045,
        frequency: 1300,
        sweep: 380,
        attack: 0.025,
      });
    },
    call() {
      if (!enabled() || !audio.ready) return;
      audio.tone({ from: 660, duration: 0.12, volume: 0.05, type: 'triangle' });
      audio.tone({
        delay: 0.1,
        from: 880,
        to: 990,
        duration: 0.22,
        volume: 0.05,
        type: 'triangle',
      });
    },
    dispose: audio.close,
  };
}
