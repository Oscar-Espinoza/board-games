import { clamp01, type Audio } from '@board-games/shared/ui';

const cues = {
  reveal: [150, 75, 0.16, 'sine'],
  finish: [440, 660, 0.28, 'sine'],
} as const;
export type Cue = keyof typeof cues;

export function playCue(audio: Audio, cue: Cue, volume: number) {
  const [from, to, duration, type] = cues[cue];
  audio.tone({
    from,
    to,
    duration,
    type,
    volume: clamp01(volume) * 0.08,
    attack: 0.015,
  });
}
