import type { Face, PublicCard } from '../cards.js';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right' | 'lower-right';
export type SeatStatus = 'choosing' | 'ready' | 'passing';
export type PartyPlayer = {
  id: string;
  name: string;
  score: number;
  color: string;
  position: SeatPosition;
  status: SeatStatus;
  count: number;
  tableau: PublicCard[];
  newlyPlayedId: string;
};
export type MenuTileData = {
  kind: Face['kind'];
  title: string;
  rules: string[];
  color: string;
  accent: string;
};

// Game-owned presentation data. Reusable components never import the fixture.
export const menu: MenuTileData[] = [
  {
    kind: 'nigiri',
    title: 'Nigiri',
    rules: ['Egg 1, Salmon 2,', 'Squid 3'],
    color: '#f7eab1',
    accent: '#e5b753',
  },
  {
    kind: 'maki',
    title: 'Maki',
    rules: ['Most 6,', 'second 3'],
    color: '#efbcb7',
    accent: '#d97578',
  },
  {
    kind: 'tempura',
    title: 'Tempura',
    rules: ['Pair = 5'],
    color: '#d7c4df',
    accent: '#b992c2',
  },
  {
    kind: 'sashimi',
    title: 'Sashimi',
    rules: ['Set of 3 = 10'],
    color: '#dce7ad',
    accent: '#a6bb66',
  },
  {
    kind: 'dumpling',
    title: 'Dumpling',
    rules: ['1 / 3 / 6 / 10 / 15'],
    color: '#bee0d6',
    accent: '#89bbad',
  },
  {
    kind: 'chopsticks',
    title: 'Chopsticks',
    rules: ['Play two cards', 'on a later turn'],
    color: '#c5e4e4',
    accent: '#8bbec5',
  },
  {
    kind: 'wasabi',
    title: 'Wasabi',
    rules: ['Next Nigiri ×3'],
    color: '#f6e6a8',
    accent: '#d8b95b',
  },
  {
    kind: 'pudding',
    title: 'Pudding',
    rules: ['End game: most +6,', 'fewest −6'],
    color: '#f3bcb1',
    accent: '#d6877b',
  },
];
