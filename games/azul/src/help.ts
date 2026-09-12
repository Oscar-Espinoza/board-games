import { m } from '@board-games/shared/messages';
export const lessons = [
  {
    id: 'draft',
    chapter: m.learn_azul_draft_chapter,
    title: m.learn_azul_draft_title,
    explanation: m.learn_azul_draft_info,
    frames: [
      m.learn_azul_draft_before,
      m.learn_azul_draft_action,
      m.learn_azul_draft_result,
    ],
  },
  {
    id: 'marker',
    chapter: m.learn_azul_draft_chapter,
    title: m.learn_azul_marker_title,
    explanation: m.learn_azul_marker_info,
    frames: [
      m.learn_azul_marker_before,
      m.learn_azul_marker_action,
      m.learn_azul_marker_result,
    ],
  },
  {
    id: 'pattern',
    chapter: m.learn_azul_wall_chapter,
    title: m.learn_azul_pattern_title,
    explanation: m.learn_azul_pattern_info,
    frames: [
      m.learn_azul_pattern_before,
      m.learn_azul_pattern_action,
      m.learn_azul_pattern_result,
    ],
  },
  {
    id: 'cross',
    chapter: m.learn_azul_wall_chapter,
    title: m.learn_azul_cross_title,
    explanation: m.learn_azul_cross_info,
    frames: [
      m.learn_azul_cross_before,
      m.learn_azul_cross_action,
      m.learn_azul_cross_result,
    ],
  },
  {
    id: 'penalty',
    chapter: m.learn_azul_wall_chapter,
    title: m.learn_azul_penalty_title,
    explanation: m.learn_azul_penalty_info,
    frames: [
      m.learn_azul_penalty_before,
      m.learn_azul_penalty_action,
      m.learn_azul_penalty_result,
    ],
  },
  {
    id: 'finish',
    chapter: m.learn_azul_end_chapter,
    title: m.learn_azul_finish_title,
    explanation: m.learn_azul_finish_info,
    frames: [
      m.learn_azul_finish_before,
      m.learn_azul_finish_action,
      m.learn_azul_finish_result,
    ],
  },
  {
    id: 'conventions',
    chapter: m.learn_azul_end_chapter,
    title: m.learn_azul_conventions_title,
    explanation: m.learn_azul_conventions_info,
    frames: [
      m.learn_azul_conventions_before,
      m.learn_azul_conventions_action,
      m.learn_azul_conventions_result,
    ],
  },
];
