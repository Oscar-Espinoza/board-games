import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
export default {
  title: m.learn_catan_title,
  chapters: [
    {
      id: 'setup',
      title: m.learn_catan_setup_chapter_title,
      lessons: [
        {
          id: 'setup',
          title: m.learn_catan_setup_title,
          explanation: m.learn_catan_setup_info,
          frames: [
            m.learn_catan_setup_before,
            m.learn_catan_setup_action,
            m.learn_catan_setup_result,
          ],
          scene: 'build',
          values: ['1', '2', '2'],
        },
        {
          id: 'production',
          title: m.learn_catan_production_title,
          explanation: m.learn_catan_production_info,
          frames: [
            m.learn_catan_production_before,
            m.learn_catan_production_action,
            m.learn_catan_production_result,
          ],
          scene: 'production',
          values: ['6', '6', '1 / 2'],
        },
        {
          id: 'shortage',
          title: m.learn_catan_shortage_title,
          explanation: m.learn_catan_shortage_info,
          frames: [
            m.learn_catan_shortage_before,
            m.learn_catan_shortage_action,
            m.learn_catan_shortage_result,
          ],
          scene: 'resources',
          values: ['3', '4', '0 / 3'],
        },
      ],
    },
    {
      id: 'building',
      title: m.learn_catan_building_chapter_title,
      reference: {
        title: m.library_costs,
        entries: [
          [
            () => `⌁ ${m.library_road()}`,
            () => `1 ${m.library_wood()} + 1 ${m.library_brick()}`,
          ],
          [
            () => `⌂ ${m.library_settlement()}`,
            () =>
              `1 ${m.library_wood()} + 1 ${m.library_brick()} + 1 ${m.library_wool()} + 1 ${m.library_grain()}`,
          ],
          [
            () => `♜ ${m.library_city()}`,
            () => `2 ${m.library_grain()} + 3 ${m.library_ore()}`,
          ],
          [
            () => `▣ ${m.library_development()}`,
            () =>
              `1 ${m.library_wool()} + 1 ${m.library_grain()} + 1 ${m.library_ore()}`,
          ],
        ],
      },
      lessons: [
        {
          id: 'road-cost',
          title: m.learn_catan_road_cost_title,
          explanation: m.learn_catan_road_cost_info,
          frames: [
            m.learn_catan_road_cost_before,
            m.learn_catan_road_cost_action,
            m.learn_catan_road_cost_result,
          ],
          scene: 'build',
          values: ['2', '−2', '1'],
        },
        {
          id: 'settlement-cost',
          title: m.learn_catan_settlement_cost_title,
          explanation: m.learn_catan_settlement_cost_info,
          frames: [
            m.learn_catan_settlement_cost_before,
            m.learn_catan_settlement_cost_action,
            m.learn_catan_settlement_cost_result,
          ],
          scene: 'build',
          values: ['4', '−4', '1'],
        },
        {
          id: 'city-cost',
          title: m.learn_catan_city_cost_title,
          explanation: m.learn_catan_city_cost_info,
          frames: [
            m.learn_catan_city_cost_before,
            m.learn_catan_city_cost_action,
            m.learn_catan_city_cost_result,
          ],
          scene: 'build',
          values: ['1', '5', '2'],
        },
        {
          id: 'development-cost',
          title: m.learn_catan_development_cost_title,
          explanation: m.learn_catan_development_cost_info,
          frames: [
            m.learn_catan_development_cost_before,
            m.learn_catan_development_cost_action,
            m.learn_catan_development_cost_result,
          ],
          scene: 'resources',
          values: ['3', '−3', '1'],
        },
        {
          id: 'distance',
          title: m.learn_catan_distance_title,
          explanation: m.learn_catan_distance_info,
          frames: [
            m.learn_catan_distance_before,
            m.learn_catan_distance_action,
            m.learn_catan_distance_result,
          ],
          scene: 'distance',
          values: ['A', 'B', '✕ / ✓'],
        },
        {
          id: 'supplies',
          title: m.learn_catan_supplies_title,
          explanation: m.learn_catan_supplies_info,
          frames: [
            m.learn_catan_supplies_before,
            m.learn_catan_supplies_action,
            m.learn_catan_supplies_result,
          ],
          scene: 'build',
          values: ['5', '↑', '4 + 1'],
        },
      ],
    },
    {
      id: 'trade',
      title: m.learn_catan_trade_chapter_title,
      lessons: [
        {
          id: 'bank',
          title: m.learn_catan_bank_title,
          explanation: m.learn_catan_bank_info,
          frames: [
            m.learn_catan_bank_before,
            m.learn_catan_bank_action,
            m.learn_catan_bank_result,
          ],
          scene: 'resources',
          values: ['4:1', '3:1', '2:1'],
        },
        {
          id: 'offers',
          title: m.learn_catan_offers_title,
          explanation: m.learn_catan_offers_info,
          frames: [
            m.learn_catan_offers_before,
            m.learn_catan_offers_action,
            m.learn_catan_offers_result,
          ],
          scene: 'trade',
          values: ['1 ↔ 1', '✓', 'A ↔ B'],
        },
      ],
    },
    {
      id: 'robber',
      title: m.learn_catan_robber_chapter_title,
      lessons: [
        {
          id: 'seven',
          title: m.learn_catan_seven_title,
          explanation: m.learn_catan_seven_info,
          frames: [
            m.learn_catan_seven_before,
            m.learn_catan_seven_action,
            m.learn_catan_seven_result,
          ],
          scene: 'resources',
          values: ['9', '−4', '5'],
        },
        {
          id: 'robber',
          title: m.learn_catan_robber_title,
          explanation: m.learn_catan_robber_info,
          frames: [
            m.learn_catan_robber_before,
            m.learn_catan_robber_action,
            m.learn_catan_robber_result,
          ],
          scene: 'robber',
          values: ['6', '↗', '0'],
        },
      ],
    },
    {
      id: 'development',
      title: m.learn_catan_development_chapter_title,
      lessons: [
        {
          id: 'timing',
          title: m.learn_catan_timing_title,
          explanation: m.learn_catan_timing_info,
          frames: [
            m.learn_catan_timing_before,
            m.learn_catan_timing_action,
            m.learn_catan_timing_result,
          ],
          scene: 'development',
          values: ['+1', '✕', '✓'],
        },
        {
          id: 'knight',
          title: m.learn_catan_knight_title,
          explanation: m.learn_catan_knight_info,
          frames: [
            m.learn_catan_knight_before,
            m.learn_catan_knight_action,
            m.learn_catan_knight_result,
          ],
          scene: 'robber',
          values: ['♞', '↗', '1'],
        },
        {
          id: 'monopoly',
          title: m.learn_catan_monopoly_title,
          explanation: m.learn_catan_monopoly_info,
          frames: [
            m.learn_catan_monopoly_before,
            m.learn_catan_monopoly_action,
            m.learn_catan_monopoly_result,
          ],
          scene: 'trade',
          values: ['2 + 3', '→ A', '5'],
        },
        {
          id: 'road-building',
          title: m.learn_catan_road_building_title,
          explanation: m.learn_catan_road_building_info,
          frames: [
            m.learn_catan_road_building_before,
            m.learn_catan_road_building_action,
            m.learn_catan_road_building_result,
          ],
          scene: 'build',
          values: ['1', '0', '1'],
        },
        {
          id: 'invention',
          title: m.learn_catan_invention_title,
          explanation: m.learn_catan_invention_info,
          frames: [
            m.learn_catan_invention_before,
            m.learn_catan_invention_action,
            m.learn_catan_invention_result,
          ],
          scene: 'resources',
          values: ['2', '→', '2'],
        },
      ],
    },
    {
      id: 'awards',
      title: m.learn_catan_awards_chapter_title,
      lessons: [
        {
          id: 'longest',
          title: m.learn_catan_longest_title,
          explanation: m.learn_catan_longest_info,
          frames: [
            m.learn_catan_longest_before,
            m.learn_catan_longest_action,
            m.learn_catan_longest_result,
          ],
          scene: 'route',
          values: ['5 = 5', '6', '+2'],
        },
        {
          id: 'army',
          title: m.learn_catan_army_title,
          explanation: m.learn_catan_army_info,
          frames: [
            m.learn_catan_army_before,
            m.learn_catan_army_action,
            m.learn_catan_army_result,
          ],
          scene: 'development',
          values: ['3', '4', '+2'],
        },
        {
          id: 'victory',
          title: m.learn_catan_victory_title,
          explanation: m.learn_catan_victory_info,
          frames: [
            m.learn_catan_victory_before,
            m.learn_catan_victory_action,
            m.learn_catan_victory_result,
          ],
          scene: 'score',
          values: ['8', '+2', '10'],
        },
      ],
    },
    {
      id: 'extended',
      title: m.learn_catan_extended_chapter_title,
      lessons: [
        {
          id: 'paired',
          title: m.learn_catan_paired_title,
          explanation: m.learn_catan_paired_info,
          frames: [
            m.learn_catan_paired_before,
            m.learn_catan_paired_action,
            m.learn_catan_paired_result,
          ],
          scene: 'turn',
          values: ['A → D', 'D', 'B → E'],
        },
      ],
    },
  ],
} satisfies Guide;
