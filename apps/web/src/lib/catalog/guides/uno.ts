import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
export default {
  title: m.learn_uno_title,
  chapters: [
    {
      id: 'setup',
      title: m.learn_uno_setup_chapter_title,
      lessons: [
        {
          id: 'deal',
          title: m.learn_uno_deal_title,
          explanation: m.learn_uno_deal_info,
          frames: [
            m.learn_uno_deal_before,
            m.learn_uno_deal_action,
            m.learn_uno_deal_result,
          ],
          scene: 'hand',
          values: ['7', '7', '7'],
        },
        {
          id: 'match',
          title: m.learn_uno_match_title,
          explanation: m.learn_uno_match_info,
          frames: [
            m.learn_uno_match_before,
            m.learn_uno_match_action,
            m.learn_uno_match_result,
          ],
          scene: 'match',
          values: ['7', '3 / 7', '✓ / ✕'],
        },
        {
          id: 'draw',
          title: m.learn_uno_draw_title,
          explanation: m.learn_uno_draw_info,
          frames: [
            m.learn_uno_draw_before,
            m.learn_uno_draw_action,
            m.learn_uno_draw_result,
          ],
          scene: 'hand',
          values: ['7', '+1', '8'],
        },
      ],
    },
    {
      id: 'actions',
      title: m.learn_uno_actions_chapter_title,
      reference: {
        title: m.library_dictionary,
        layout: 'symbols',
        entries: [
          [() => '⊘', m.library_skip],
          [() => '↺', m.library_reverse],
          [() => '+2', m.library_draw_two],
          [() => '✦', m.library_wild],
          [() => '+4', m.library_wild_four],
        ],
      },
      lessons: [
        {
          id: 'skip',
          title: m.learn_uno_skip_title,
          explanation: m.learn_uno_skip_info,
          frames: [
            m.learn_uno_skip_before,
            m.learn_uno_skip_action,
            m.learn_uno_skip_result,
          ],
          scene: 'turn',
          values: ['A → B → L', '⊘', 'A → L'],
        },
        {
          id: 'reverse',
          title: m.learn_uno_reverse_title,
          explanation: m.learn_uno_reverse_info,
          frames: [
            m.learn_uno_reverse_before,
            m.learn_uno_reverse_action,
            m.learn_uno_reverse_result,
          ],
          scene: 'turn',
          values: ['A → B → L', '↺', 'L ← B ← A'],
        },
        {
          id: 'wild',
          title: m.learn_uno_wild_title,
          explanation: m.learn_uno_wild_info,
          frames: [
            m.learn_uno_wild_before,
            m.learn_uno_wild_action,
            m.learn_uno_wild_result,
          ],
          scene: 'wild',
          values: ['✦', '→', 'B'],
        },
        {
          id: 'wild-four',
          title: m.learn_uno_wild_four_title,
          explanation: m.learn_uno_wild_four_info,
          frames: [
            m.learn_uno_wild_four_before,
            m.learn_uno_wild_four_action,
            m.learn_uno_wild_four_result,
          ],
          scene: 'stack',
          values: ['0', '+4', '4'],
        },
      ],
    },
    {
      id: 'penalties',
      title: m.learn_uno_penalties_chapter_title,
      lessons: [
        {
          id: 'stack-two',
          title: m.learn_uno_stack_two_title,
          explanation: m.learn_uno_stack_two_info,
          frames: [
            m.learn_uno_stack_two_before,
            m.learn_uno_stack_two_action,
            m.learn_uno_stack_two_result,
          ],
          scene: 'stack',
          values: ['2', '+2', '4'],
        },
        {
          id: 'stack-four',
          title: m.learn_uno_stack_four_title,
          explanation: m.learn_uno_stack_four_info,
          frames: [
            m.learn_uno_stack_four_before,
            m.learn_uno_stack_four_action,
            m.learn_uno_stack_four_result,
          ],
          scene: 'stack',
          values: ['2', '+4', '6'],
        },
        {
          id: 'pay',
          title: m.learn_uno_pay_title,
          explanation: m.learn_uno_pay_info,
          frames: [
            m.learn_uno_pay_before,
            m.learn_uno_pay_action,
            m.learn_uno_pay_result,
          ],
          scene: 'stack',
          values: ['6', '+6', '0'],
        },
      ],
    },
    {
      id: 'declaration',
      title: m.learn_uno_declaration_chapter_title,
      lessons: [
        {
          id: 'declare',
          title: m.learn_uno_declare_title,
          explanation: m.learn_uno_declare_info,
          frames: [
            m.learn_uno_declare_before,
            m.learn_uno_declare_action,
            m.learn_uno_declare_result,
          ],
          scene: 'hand',
          values: ['2', 'UNO', '1'],
        },
        {
          id: 'catch',
          title: m.learn_uno_catch_title,
          explanation: m.learn_uno_catch_info,
          frames: [
            m.learn_uno_catch_before,
            m.learn_uno_catch_action,
            m.learn_uno_catch_result,
          ],
          scene: 'hand',
          values: ['1', '+2', '3'],
        },
        {
          id: 'catch-window',
          title: m.learn_uno_catch_window_title,
          explanation: m.learn_uno_catch_window_info,
          frames: [
            m.learn_uno_catch_window_before,
            m.learn_uno_catch_window_action,
            m.learn_uno_catch_window_result,
          ],
          scene: 'turn',
          values: ['✦', 'B →', '✓'],
        },
      ],
    },
    {
      id: 'ending',
      title: m.learn_uno_ending_chapter_title,
      lessons: [
        {
          id: 'win',
          title: m.learn_uno_win_title,
          explanation: m.learn_uno_win_info,
          frames: [
            m.learn_uno_win_before,
            m.learn_uno_win_action,
            m.learn_uno_win_result,
          ],
          scene: 'hand',
          values: ['1', '+4', '0'],
        },
        {
          id: 'reshuffle',
          title: m.learn_uno_reshuffle_title,
          explanation: m.learn_uno_reshuffle_info,
          frames: [
            m.learn_uno_reshuffle_before,
            m.learn_uno_reshuffle_action,
            m.learn_uno_reshuffle_result,
          ],
          scene: 'stock',
          values: ['0', '↻', '7'],
        },
        {
          id: 'short-stock',
          title: m.learn_uno_short_stock_title,
          explanation: m.learn_uno_short_stock_info,
          frames: [
            m.learn_uno_short_stock_before,
            m.learn_uno_short_stock_action,
            m.learn_uno_short_stock_result,
          ],
          scene: 'stock',
          values: ['6', '2', '0'],
        },
      ],
    },
  ],
} satisfies Guide;
