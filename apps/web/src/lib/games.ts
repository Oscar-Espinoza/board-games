import type { GameId } from '@board-games/shared';
import type { GameClient } from '@board-games/shared/ui';
import { client as uno } from '@board-games/uno/client';
import { client as catan } from '@board-games/catan/client';
import { client as carcassonne } from '@board-games/carcassonne/client';
import { client as azul } from '@board-games/azul/client';
import { client as codenames } from '@board-games/codenames/client';
import { client as sushiGoParty } from '@board-games/sushi-go-party/client';
import { client as littleSecret } from '@board-games/little-secret/client';
import { client as domino } from '@board-games/domino/client';

/** Each game's browser entry; tables load only after a room or practice route asks. */
export const gameClients: Record<GameId, GameClient> = {
  uno,
  catan,
  carcassonne,
  azul,
  codenames,
  'sushi-go-party': sushiGoParty,
  'little-secret': littleSecret,
  domino,
};
