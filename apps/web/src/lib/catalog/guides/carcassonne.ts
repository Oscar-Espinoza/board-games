import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
export default {
  title: m.learn_carcassonne_title,
  chapters: [
    {
      id: 'basics',
      title: m.learn_carcassonne_basics_chapter_title,
      lessons: [
        {
          id: 'setup',
          title: m.learn_carcassonne_setup_title,
          explanation: m.learn_carcassonne_setup_info,
          frames: [
            m.learn_carcassonne_setup_before,
            m.learn_carcassonne_setup_action,
            m.learn_carcassonne_setup_result,
          ],
          scene: 'placement',
          values: ['A + B', '✓', '1'],
        },
        {
          id: 'turn',
          title: m.learn_carcassonne_turn_title,
          explanation: m.learn_carcassonne_turn_info,
          frames: [
            m.learn_carcassonne_turn_before,
            m.learn_carcassonne_turn_action,
            m.learn_carcassonne_turn_result,
          ],
          scene: 'road',
          values: ['1', 'A', '→'],
        },
        {
          id: 'matching',
          title: m.learn_carcassonne_matching_title,
          explanation: m.learn_carcassonne_matching_info,
          frames: [
            m.learn_carcassonne_matching_before,
            m.learn_carcassonne_matching_action,
            m.learn_carcassonne_matching_result,
          ],
          scene: 'placement',
          values: ['✕', '↻', '✓'],
        },
        {
          id: 'unplaceable',
          title: m.learn_carcassonne_unplaceable_title,
          explanation: m.learn_carcassonne_unplaceable_info,
          frames: [
            m.learn_carcassonne_unplaceable_before,
            m.learn_carcassonne_unplaceable_action,
            m.learn_carcassonne_unplaceable_result,
          ],
          scene: 'placement',
          values: ['?', '4 × ↻', '✓'],
        },
      ],
    },
    {
      id: 'ownership',
      title: m.learn_carcassonne_ownership_chapter_title,
      lessons: [
        {
          id: 'deploy',
          title: m.learn_carcassonne_deploy_title,
          explanation: m.learn_carcassonne_deploy_info,
          frames: [
            m.learn_carcassonne_deploy_before,
            m.learn_carcassonne_deploy_action,
            m.learn_carcassonne_deploy_result,
          ],
          scene: 'ownership',
          values: ['B', 'A?', '✕'],
        },
        {
          id: 'merge',
          title: m.learn_carcassonne_merge_title,
          explanation: m.learn_carcassonne_merge_info,
          frames: [
            m.learn_carcassonne_merge_before,
            m.learn_carcassonne_merge_action,
            m.learn_carcassonne_merge_result,
          ],
          scene: 'ownership',
          values: ['1 : 1', '8', '8 / 8'],
        },
      ],
    },
    {
      id: 'scoring',
      title: m.learn_carcassonne_scoring_chapter_title,
      lessons: [
        {
          id: 'road',
          title: m.learn_carcassonne_road_title,
          explanation: m.learn_carcassonne_road_info,
          frames: [
            m.learn_carcassonne_road_before,
            m.learn_carcassonne_road_action,
            m.learn_carcassonne_road_result,
          ],
          scene: 'road',
          values: ['3', '✓', '3'],
        },
        {
          id: 'city',
          title: m.learn_carcassonne_city_title,
          explanation: m.learn_carcassonne_city_info,
          frames: [
            m.learn_carcassonne_city_before,
            m.learn_carcassonne_city_action,
            m.learn_carcassonne_city_result,
          ],
          scene: 'city',
          values: ['3 + 1', '×2', '8'],
        },
        {
          id: 'monastery',
          title: m.learn_carcassonne_monastery_title,
          explanation: m.learn_carcassonne_monastery_info,
          frames: [
            m.learn_carcassonne_monastery_before,
            m.learn_carcassonne_monastery_action,
            m.learn_carcassonne_monastery_result,
          ],
          scene: 'monastery',
          values: ['8', '+1', '9'],
        },
        {
          id: 'farmers',
          title: m.learn_carcassonne_farmers_title,
          explanation: m.learn_carcassonne_farmers_info,
          frames: [
            m.learn_carcassonne_farmers_before,
            m.learn_carcassonne_farmers_action,
            m.learn_carcassonne_farmers_result,
          ],
          scene: 'field',
          values: ['2', '×3', '6'],
        },
        {
          id: 'final',
          title: m.learn_carcassonne_final_title,
          explanation: m.learn_carcassonne_final_info,
          frames: [
            m.learn_carcassonne_final_before,
            m.learn_carcassonne_final_action,
            m.learn_carcassonne_final_result,
          ],
          scene: 'field',
          values: ['3 / 4 / 5', '→', '12'],
        },
      ],
    },
    {
      id: 'figures',
      title: m.learn_carcassonne_figures_chapter_title,
      lessons: [
        {
          id: 'standard',
          title: m.learn_carcassonne_standard_title,
          explanation: m.learn_carcassonne_standard_info,
          frames: [
            m.learn_carcassonne_standard_before,
            m.learn_carcassonne_standard_action,
            m.learn_carcassonne_standard_result,
          ],
          scene: 'road',
          values: ['7', '−1', '6'],
        },
        {
          id: 'large',
          title: m.learn_carcassonne_large_title,
          explanation: m.learn_carcassonne_large_info,
          frames: [
            m.learn_carcassonne_large_before,
            m.learn_carcassonne_large_action,
            m.learn_carcassonne_large_result,
          ],
          scene: 'ownership',
          values: ['2 : 1', '8', '8 / 0'],
        },
        {
          id: 'abbot-figure',
          title: m.learn_carcassonne_abbot_figure_title,
          explanation: m.learn_carcassonne_abbot_figure_info,
          frames: [
            m.learn_carcassonne_abbot_figure_before,
            m.learn_carcassonne_abbot_figure_action,
            m.learn_carcassonne_abbot_figure_result,
          ],
          scene: 'abbot',
          values: ['1', 'A', '5'],
        },
        {
          id: 'builder-figure',
          title: m.learn_carcassonne_builder_figure_title,
          explanation: m.learn_carcassonne_builder_figure_info,
          frames: [
            m.learn_carcassonne_builder_figure_before,
            m.learn_carcassonne_builder_figure_action,
            m.learn_carcassonne_builder_figure_result,
          ],
          scene: 'builder',
          values: ['A + ◇', '+1', '↻'],
        },
        {
          id: 'pig-figure',
          title: m.learn_carcassonne_pig_figure_title,
          explanation: m.learn_carcassonne_pig_figure_info,
          frames: [
            m.learn_carcassonne_pig_figure_before,
            m.learn_carcassonne_pig_figure_action,
            m.learn_carcassonne_pig_figure_result,
          ],
          scene: 'pig',
          values: ['2', '×3', '6'],
        },
      ],
    },
    {
      id: 'river',
      title: m.learn_carcassonne_river_chapter_title,
      lessons: [
        {
          id: 'river',
          title: m.learn_carcassonne_river_title,
          explanation: m.learn_carcassonne_river_info,
          frames: [
            m.learn_carcassonne_river_before,
            m.learn_carcassonne_river_action,
            m.learn_carcassonne_river_result,
          ],
          scene: 'river',
          values: ['↘', '↻', '→'],
        },
      ],
    },
    {
      id: 'abbot',
      title: m.learn_carcassonne_abbot_chapter_title,
      lessons: [
        {
          id: 'abbot',
          title: m.learn_carcassonne_abbot_title,
          explanation: m.learn_carcassonne_abbot_info,
          frames: [
            m.learn_carcassonne_abbot_before,
            m.learn_carcassonne_abbot_action,
            m.learn_carcassonne_abbot_result,
          ],
          scene: 'abbot',
          values: ['4 + 1', '↗', '5'],
        },
      ],
    },
    {
      id: 'inns',
      title: m.learn_carcassonne_inns_chapter_title,
      lessons: [
        {
          id: 'inn',
          title: m.learn_carcassonne_inn_title,
          explanation: m.learn_carcassonne_inn_info,
          frames: [
            m.learn_carcassonne_inn_before,
            m.learn_carcassonne_inn_action,
            m.learn_carcassonne_inn_result,
          ],
          scene: 'road',
          values: ['3', '×2', '6'],
        },
        {
          id: 'cathedral',
          title: m.learn_carcassonne_cathedral_title,
          explanation: m.learn_carcassonne_cathedral_info,
          frames: [
            m.learn_carcassonne_cathedral_before,
            m.learn_carcassonne_cathedral_action,
            m.learn_carcassonne_cathedral_result,
          ],
          scene: 'city',
          values: ['3 + 1', '×3', '12'],
        },
      ],
    },
    {
      id: 'traders',
      title: m.learn_carcassonne_traders_chapter_title,
      lessons: [
        {
          id: 'goods',
          title: m.learn_carcassonne_goods_title,
          explanation: m.learn_carcassonne_goods_info,
          frames: [
            m.learn_carcassonne_goods_before,
            m.learn_carcassonne_goods_action,
            m.learn_carcassonne_goods_result,
          ],
          scene: 'goods',
          values: ['B', 'A →', '2'],
        },
        {
          id: 'builder',
          title: m.learn_carcassonne_builder_title,
          explanation: m.learn_carcassonne_builder_info,
          frames: [
            m.learn_carcassonne_builder_before,
            m.learn_carcassonne_builder_action,
            m.learn_carcassonne_builder_result,
          ],
          scene: 'builder',
          values: ['1', '+1', '2'],
        },
        {
          id: 'pig',
          title: m.learn_carcassonne_pig_title,
          explanation: m.learn_carcassonne_pig_info,
          frames: [
            m.learn_carcassonne_pig_before,
            m.learn_carcassonne_pig_action,
            m.learn_carcassonne_pig_result,
          ],
          scene: 'pig',
          values: ['2', '×3', '6'],
        },
      ],
    },
    {
      id: 'flight',
      title: m.learn_carcassonne_flight_chapter_title,
      lessons: [
        {
          id: 'flight',
          title: m.learn_carcassonne_flight_title,
          explanation: m.learn_carcassonne_flight_info,
          frames: [
            m.learn_carcassonne_flight_before,
            m.learn_carcassonne_flight_action,
            m.learn_carcassonne_flight_result,
          ],
          scene: 'flight',
          values: ['?', '2', '✓ / ✕'],
        },
      ],
    },
    {
      id: 'messages',
      title: m.learn_carcassonne_messages_chapter_title,
      lessons: [
        {
          id: 'message-trigger',
          title: m.learn_carcassonne_message_trigger_title,
          explanation: m.learn_carcassonne_message_trigger_info,
          frames: [
            m.learn_carcassonne_message_trigger_before,
            m.learn_carcassonne_message_trigger_action,
            m.learn_carcassonne_message_trigger_result,
          ],
          scene: 'markers',
          values: ['12 / 18', '+3', '15'],
        },
        {
          id: 'message-1',
          title: m.learn_carcassonne_message_1_title,
          explanation: m.learn_carcassonne_message_1_info,
          frames: [
            m.learn_carcassonne_message_1_before,
            m.learn_carcassonne_message_1_action,
            m.learn_carcassonne_message_1_result,
          ],
          scene: 'message',
          values: ['4 / 7', '1', '4'],
        },
        {
          id: 'message-2',
          title: m.learn_carcassonne_message_2_title,
          explanation: m.learn_carcassonne_message_2_info,
          frames: [
            m.learn_carcassonne_message_2_before,
            m.learn_carcassonne_message_2_action,
            m.learn_carcassonne_message_2_result,
          ],
          scene: 'message',
          values: ['3 / 6', '2', '3'],
        },
        {
          id: 'message-3',
          title: m.learn_carcassonne_message_3_title,
          explanation: m.learn_carcassonne_message_3_info,
          frames: [
            m.learn_carcassonne_message_3_before,
            m.learn_carcassonne_message_3_action,
            m.learn_carcassonne_message_3_result,
          ],
          scene: 'message',
          values: ['5 / 7', '3', '5'],
        },
        {
          id: 'message-4',
          title: m.learn_carcassonne_message_4_title,
          explanation: m.learn_carcassonne_message_4_info,
          frames: [
            m.learn_carcassonne_message_4_before,
            m.learn_carcassonne_message_4_action,
            m.learn_carcassonne_message_4_result,
          ],
          scene: 'message',
          values: ['1', '4', '+1'],
        },
        {
          id: 'message-5',
          title: m.learn_carcassonne_message_5_title,
          explanation: m.learn_carcassonne_message_5_info,
          frames: [
            m.learn_carcassonne_message_5_before,
            m.learn_carcassonne_message_5_action,
            m.learn_carcassonne_message_5_result,
          ],
          scene: 'message',
          values: ['3', '×2', '6'],
        },
        {
          id: 'message-6',
          title: m.learn_carcassonne_message_6_title,
          explanation: m.learn_carcassonne_message_6_info,
          frames: [
            m.learn_carcassonne_message_6_before,
            m.learn_carcassonne_message_6_action,
            m.learn_carcassonne_message_6_result,
          ],
          scene: 'message',
          values: ['2', '×2', '4'],
        },
        {
          id: 'message-7',
          title: m.learn_carcassonne_message_7_title,
          explanation: m.learn_carcassonne_message_7_info,
          frames: [
            m.learn_carcassonne_message_7_before,
            m.learn_carcassonne_message_7_action,
            m.learn_carcassonne_message_7_result,
          ],
          scene: 'message',
          values: ['3', '×2', '6'],
        },
        {
          id: 'message-8',
          title: m.learn_carcassonne_message_8_title,
          explanation: m.learn_carcassonne_message_8_info,
          frames: [
            m.learn_carcassonne_message_8_before,
            m.learn_carcassonne_message_8_action,
            m.learn_carcassonne_message_8_result,
          ],
          scene: 'message',
          values: ['4', '8', '4 + ↗'],
        },
      ],
    },
    {
      id: 'ferries',
      title: m.learn_carcassonne_ferries_chapter_title,
      lessons: [
        {
          id: 'ferry',
          title: m.learn_carcassonne_ferry_title,
          explanation: m.learn_carcassonne_ferry_info,
          frames: [
            m.learn_carcassonne_ferry_before,
            m.learn_carcassonne_ferry_action,
            m.learn_carcassonne_ferry_result,
          ],
          scene: 'road',
          values: ['↔', '↻', '↗'],
        },
      ],
    },
    {
      id: 'gold',
      title: m.learn_carcassonne_gold_chapter_title,
      lessons: [
        {
          id: 'gold',
          title: m.learn_carcassonne_gold_title,
          explanation: m.learn_carcassonne_gold_info,
          frames: [
            m.learn_carcassonne_gold_before,
            m.learn_carcassonne_gold_action,
            m.learn_carcassonne_gold_result,
          ],
          scene: 'gold',
          values: ['3', 'A → B', '2 / 1'],
        },
        {
          id: 'gold-final',
          title: m.learn_carcassonne_gold_final_title,
          explanation: m.learn_carcassonne_gold_final_info,
          frames: [
            m.learn_carcassonne_gold_final_before,
            m.learn_carcassonne_gold_final_action,
            m.learn_carcassonne_gold_final_result,
          ],
          scene: 'gold',
          values: ['5', '×2', '10'],
        },
      ],
    },
    {
      id: 'magic',
      title: m.learn_carcassonne_magic_chapter_title,
      lessons: [
        {
          id: 'magic',
          title: m.learn_carcassonne_magic_title,
          explanation: m.learn_carcassonne_magic_info,
          frames: [
            m.learn_carcassonne_magic_before,
            m.learn_carcassonne_magic_action,
            m.learn_carcassonne_magic_result,
          ],
          scene: 'magic',
          values: ['8', '+3 ÷2', '6'],
        },
      ],
    },
    {
      id: 'robbers',
      title: m.learn_carcassonne_robbers_chapter_title,
      lessons: [
        {
          id: 'robber',
          title: m.learn_carcassonne_robber_title,
          explanation: m.learn_carcassonne_robber_info,
          frames: [
            m.learn_carcassonne_robber_before,
            m.learn_carcassonne_robber_action,
            m.learn_carcassonne_robber_result,
          ],
          scene: 'markers',
          values: ['5', '÷2', '3'],
        },
      ],
    },
    {
      id: 'crop',
      title: m.learn_carcassonne_crop_chapter_title,
      lessons: [
        {
          id: 'crop',
          title: m.learn_carcassonne_crop_title,
          explanation: m.learn_carcassonne_crop_info,
          frames: [
            m.learn_carcassonne_crop_before,
            m.learn_carcassonne_crop_action,
            m.learn_carcassonne_crop_result,
          ],
          scene: 'ownership',
          values: ['A → B → L', '−1', 'B → L → A'],
        },
        {
          id: 'crop-add',
          title: m.learn_carcassonne_crop_add_title,
          explanation: m.learn_carcassonne_crop_add_info,
          frames: [
            m.learn_carcassonne_crop_add_before,
            m.learn_carcassonne_crop_add_action,
            m.learn_carcassonne_crop_add_result,
          ],
          scene: 'ownership',
          values: ['1', '+1', '2'],
        },
      ],
    },
  ],
} satisfies Guide;
