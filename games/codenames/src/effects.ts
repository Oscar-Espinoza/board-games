import { clamp01, type Audio } from '@board-games/shared/ui';
import { playChiptune } from '@board-games/shared/ui/pixel';

const cues = { reveal: [150, 75, 0.16], finish: [440, 660, 0.28] } as const;
export type Cue = keyof typeof cues;

export function playCue(
  audio: Audio,
  cue: Cue,
  volume: number,
  chiptune: boolean,
) {
  if (chiptune) {
    playChiptune(audio, cue === 'reveal' ? 'stamp' : 'win', volume);
    return;
  }
  const [from, to, duration] = cues[cue];
  audio.tone({
    from,
    to,
    duration,
    volume: clamp01(volume) * 0.08,
    attack: 0.015,
  });
}
