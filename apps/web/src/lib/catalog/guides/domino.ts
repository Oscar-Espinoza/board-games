import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
export default {
  title: m.learn_domino_title,
  chapters: [
    {
      id: 'setup',
      title: m.learn_domino_setup_chapter,
      lessons: [
        {
          id: 'deal',
          title: m.learn_domino_deal_title,
          explanation: m.learn_domino_deal_info,
          frames: [
            m.learn_domino_deal_before,
            m.learn_domino_deal_action,
            m.learn_domino_deal_result,
          ],
          scene: 'deal',
          values: ['28', '7 × 4', 'A · B · A · B'],
        },
        {
          id: 'lead',
          title: m.learn_domino_lead_title,
          explanation: m.learn_domino_lead_info,
          frames: [
            m.learn_domino_lead_before,
            m.learn_domino_lead_action,
            m.learn_domino_lead_result,
          ],
          scene: 'lead',
          values: ['6|6', '6|6', '→'],
        },
      ],
    },
    {
      id: 'play',
      title: m.learn_domino_play_chapter,
      lessons: [
        {
          id: 'match',
          title: m.learn_domino_match_title,
          explanation: m.learn_domino_match_info,
          frames: [
            m.learn_domino_match_before,
            m.learn_domino_match_action,
            m.learn_domino_match_result,
          ],
          scene: 'match',
          values: ['6 · 3', '3|5', '6 · 5'],
        },
        {
          id: 'pass',
          title: m.learn_domino_pass_title,
          explanation: m.learn_domino_pass_info,
          frames: [
            m.learn_domino_pass_before,
            m.learn_domino_pass_action,
            m.learn_domino_pass_result,
          ],
          scene: 'pass',
          values: ['2 · 4', '✕', '✊'],
        },
        {
          id: 'strike',
          title: m.learn_domino_strike_title,
          explanation: m.learn_domino_strike_info,
          frames: [
            m.learn_domino_strike_before,
            m.learn_domino_strike_action,
            m.learn_domino_strike_result,
          ],
          scene: 'strike',
          values: ['', '▮▮▯', '↺'],
        },
      ],
    },
    {
      id: 'score',
      title: m.learn_domino_score_chapter,
      lessons: [
        {
          id: 'out',
          title: m.learn_domino_out_title,
          explanation: m.learn_domino_out_info,
          frames: [
            m.learn_domino_out_before,
            m.learn_domino_out_action,
            m.learn_domino_out_result,
          ],
          scene: 'out',
          values: ['1', '0', '+42'],
        },
        {
          id: 'block',
          title: m.learn_domino_block_title,
          explanation: m.learn_domino_block_info,
          frames: [
            m.learn_domino_block_before,
            m.learn_domino_block_action,
            m.learn_domino_block_result,
          ],
          scene: 'block',
          values: ['', '18 / 25', '+43'],
        },
        {
          id: 'target',
          title: m.learn_domino_target_title,
          explanation: m.learn_domino_target_info,
          frames: [
            m.learn_domino_target_before,
            m.learn_domino_target_action,
            m.learn_domino_target_result,
          ],
          scene: 'target',
          values: ['40 · 25', '77 · 61', '100'],
        },
      ],
    },
  ],
} satisfies Guide;
