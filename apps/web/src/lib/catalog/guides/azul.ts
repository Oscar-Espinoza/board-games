import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
const entries = [
  [
    'draft',
    m.learn_azul_draft_title,
    m.learn_azul_draft_info,
    [
      m.learn_azul_draft_before,
      m.learn_azul_draft_action,
      m.learn_azul_draft_result,
    ],
  ],
  [
    'marker',
    m.learn_azul_marker_title,
    m.learn_azul_marker_info,
    [
      m.learn_azul_marker_before,
      m.learn_azul_marker_action,
      m.learn_azul_marker_result,
    ],
  ],
  [
    'pattern',
    m.learn_azul_pattern_title,
    m.learn_azul_pattern_info,
    [
      m.learn_azul_pattern_before,
      m.learn_azul_pattern_action,
      m.learn_azul_pattern_result,
    ],
  ],
  [
    'cross',
    m.learn_azul_cross_title,
    m.learn_azul_cross_info,
    [
      m.learn_azul_cross_before,
      m.learn_azul_cross_action,
      m.learn_azul_cross_result,
    ],
  ],
  [
    'penalty',
    m.learn_azul_penalty_title,
    m.learn_azul_penalty_info,
    [
      m.learn_azul_penalty_before,
      m.learn_azul_penalty_action,
      m.learn_azul_penalty_result,
    ],
  ],
  [
    'finish',
    m.learn_azul_finish_title,
    m.learn_azul_finish_info,
    [
      m.learn_azul_finish_before,
      m.learn_azul_finish_action,
      m.learn_azul_finish_result,
    ],
  ],
  [
    'conventions',
    m.learn_azul_conventions_title,
    m.learn_azul_conventions_info,
    [
      m.learn_azul_conventions_before,
      m.learn_azul_conventions_action,
      m.learn_azul_conventions_result,
    ],
  ],
] as const;
export default {
  title: m.learn_azul_title,
  chapters: [
    {
      id: 'draft',
      title: m.learn_azul_draft_chapter,
      lessons: entries.slice(0, 2),
    },
    {
      id: 'wall',
      title: m.learn_azul_wall_chapter,
      lessons: entries.slice(2, 5),
    },
    { id: 'end', title: m.learn_azul_end_chapter, lessons: entries.slice(5) },
  ].map((c) => ({
    ...c,
    lessons: c.lessons.map(([id, title, explanation, frames]) => ({
      id,
      title,
      explanation,
      frames: [...frames],
      scene: id,
      values: ['1', '2', '3'],
    })),
  })),
} satisfies Guide;
