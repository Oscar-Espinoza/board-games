import { face, type Face, type HandCard, type PublicCard } from '../cards.js';

import {
  menu,
  type PartyPlayer,
  type SeatPosition,
  type SeatStatus,
} from '../table/data.js';

function played(owner: string, cards: Face[]): PublicCard[] {
  return cards.map((card, i) => ({
    ...card,
    id: `${owner}-dish-${i}`,
    playedTurn: i + 1,
    collectedRound: 2,
    boxed: false,
    copied: false,
    wasabi: null,
    copyCanAttach: false,
  }));
}
function player(
  id: string,
  name: string,
  score: number,
  color: string,
  position: SeatPosition,
  status: SeatStatus,
  cards: Face[],
): PartyPlayer {
  const tableau = played(id, cards);
  return {
    id,
    name,
    score,
    color,
    position,
    status,
    count: 6,
    tableau,
    newlyPlayedId: tableau[2].id,
  };
}

// An authored presentation snapshot, not engine initialization. No opponent hands
// exist here: the only private faces belong to the local player.
export const fixture = {
  round: 2,
  pick: 3,
  totalPicks: 9,
  localId: 'marina',
  selectedHandle: 'marina-hand-3',
  menu,
  players: [
    player('marina', 'Marina', 47, '#4dba90', 'bottom', 'choosing', [
      face('maki', '1', 1),
      face('tempura'),
      face('pudding'),
    ]),
    player('kai', 'Kai', 7, '#35b6e8', 'left', 'passing', [
      face('nigiri', 'egg', 1),
      face('sashimi'),
      face('dumpling'),
    ]),
    player('sakura', 'Sakura', 13, '#ed8eac', 'top', 'choosing', [
      face('maki', '1', 1),
      face('dumpling'),
      face('nigiri', 'salmon', 2),
    ]),
    player('tomas', 'Tomás', 17, '#ef6863', 'right', 'ready', [
      face('sashimi'),
      face('nigiri', 'squid', 3),
      face('maki', '1', 1),
    ]),
    player('emi', 'Emi', 32, '#b98bd2', 'lower-right', 'passing', [
      face('dumpling'),
      face('maki', '2', 2),
      face('tempura'),
    ]),
  ],
  hand: [
    face('nigiri', 'salmon', 2),
    face('sashimi'),
    face('dumpling'),
    face('maki', '1', 1),
    face('tempura'),
    face('pudding'),
  ].map((card, i): HandCard => ({ ...card, handle: `marina-hand-${i}` })),
  passes: [
    { from: 'marina', to: 'kai', count: 6 },
    { from: 'kai', to: 'sakura', count: 6 },
    { from: 'sakura', to: 'tomas', count: 6 },
    { from: 'tomas', to: 'emi', count: 6 },
    { from: 'emi', to: 'marina', count: 6 },
  ],
};
