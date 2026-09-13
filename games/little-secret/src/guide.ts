import { m } from '@board-games/shared/messages';
const ids = [
  'identity',
  'setup',
  'clues',
  'voting',
  'rps',
  'journalist',
  'reactions',
  'scoring',
  'conventions',
  'mime',
  'novice',
  'elder',
  'sage',
  'revenant',
  'dictator',
  'adept',
] as const;
export default {
  title: m.ls_rules,
  chapters: ids.map((id) => ({
    id,
    title: m[`ls_guide_${id}`],
    lessons: [
      {
        id,
        title: m[`ls_guide_${id}`],
        explanation: m[`ls_guide_${id}_info`],
        frames: [
          m[`ls_guide_${id}_0`],
          m[`ls_guide_${id}_1`],
          m[`ls_guide_${id}_2`],
        ] as [() => string, () => string, () => string],
        scene: id,
        values: ['1', '2', '3'] as [string, string, string],
      },
    ],
  })),
};
