import { m } from '@board-games/shared/messages';
import type { Guide } from '../types';
const names = [
  'nigiri',
  'maki',
  'temaki',
  'uramaki',
  'tempura',
  'sashimi',
  'dumpling',
  'eel',
  'tofu',
  'onigiri',
  'edamame',
  'miso',
  'chopsticks',
  'spoon',
  'menu',
  'special_order',
  'takeout',
  'wasabi',
  'tea',
  'soy',
  'pudding',
  'ice_cream',
  'fruit',
];
const text = (key: string) => () =>
  (m as unknown as Record<string, () => string>)[`sgp_${key}`]();
export default {
  title: m.sgp_guide,
  chapters: [
    {
      id: 'quick',
      title: m.sgp_rules_quick,
      lessons: [
        {
          id: 'draft',
          title: m.sgp_loop_0,
          explanation: m.sgp_quick,
          frames: [m.sgp_loop_0, m.sgp_loop_1, m.sgp_loop_2],
          scene: 'draft',
          values: ['1', '✓', '→'],
        },
      ],
    },
    {
      id: 'dishes',
      title: m.sgp_current_menu,
      lessons: names.map((kind) => ({
        id: kind,
        title: text(kind),
        explanation: text('rule_' + kind),
        frames: [text(kind), text('rule_' + kind), m.sgp_loop_2] as [
          () => string,
          () => string,
          () => string,
        ],
        scene: kind,
        values: ['1', '2', '3'] as [string, string, string],
      })),
    },
    {
      id: 'advanced',
      title: m.sgp_rules_advanced,
      lessons: [
        {
          id: 'advanced',
          title: m.sgp_rules_advanced,
          explanation: m.sgp_advanced,
          frames: [m.sgp_loop_0, m.sgp_loop_1, m.sgp_advanced],
          scene: 'spoon',
          values: ['1', '2', '3'],
        },
        {
          id: 'conventions',
          title: m.sgp_rules_conventions,
          explanation: m.sgp_conventions,
          frames: [m.sgp_quick, m.sgp_advanced, m.sgp_conventions],
          scene: 'special_order',
          values: ['C1', 'C3', 'C7'],
        },
      ],
    },
  ],
} satisfies Guide;
