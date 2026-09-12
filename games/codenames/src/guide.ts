import { m } from '@board-games/shared/messages';
const ids = ['setup', 'clues', 'review', 'guess', 'budget', 'finish'] as const;
export default {
  title: m.cn_rules,
  chapters: ids.map((id) => ({
    id,
    title: m[`cn_guide_${id}`],
    lessons: [
      {
        id,
        title: m[`cn_guide_${id}`],
        explanation: m[`cn_guide_${id}_info`],
        frames: [
          m[`cn_guide_${id}_0`],
          m[`cn_guide_${id}_1`],
          m[`cn_guide_${id}_2`],
        ] as [() => string, () => string, () => string],
        scene: id,
        values: ['1', '2', '3'] as [string, string, string],
      },
    ],
  })),
};
