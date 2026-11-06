import { m } from './paraglide/messages.js';
import { gameIds, games, type GameId } from './games.js';

export { games, gameIds, type GameId } from './games.js';

const descriptions: Record<GameId, () => string> = {
  uno: m.uno_description,
  catan: m.catan_description,
  carcassonne: m.carc_description,
  azul: m.azul_description,
  codenames: m.cn_description,
  'sushi-go-party': m.sgp_description,
  'little-secret': m.ls_description,
  domino: m.domino_description,
};
/** Metadata only: importing the catalog cannot import game rules or presentation. */
export const catalog = gameIds.map((id) => ({
  id,
  ...games[id],
  description: descriptions[id],
}));
