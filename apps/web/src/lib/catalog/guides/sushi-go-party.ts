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
          frames: [
            text('example_draft_0'),
            text('example_draft_1'),
            text('example_draft_2'),
          ],
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
        frames: [0, 1, 2].map((step) => text(`example_${kind}_${step}`)) as [
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
          frames: [
            text('example_advanced_0'),
            text('example_advanced_1'),
            text('example_advanced_2'),
          ],
          scene: 'spoon',
          values: ['1', '2', '3'],
        },
        {
          id: 'conventions',
          title: m.sgp_rules_conventions,
          explanation: m.sgp_conventions,
          frames: [
            text('example_conventions_0'),
            text('example_conventions_1'),
            text('example_conventions_2'),
          ],
          scene: 'special_order',
          values: ['C1', 'C3', 'C7'],
        },
      ],
    },
  ],
} satisfies Guide;
