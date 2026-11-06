import { m } from '@board-games/shared/messages';
import type { GameId, Text } from './types';

/** The home page's one-paragraph summary and three-step loop for each game. */
export const summaries = {
  'little-secret': m.ls_summary,
  azul: m.library_azul_summary,
  codenames: m.library_cn_summary,
  'sushi-go-party': m.sgp_summary,
  uno: m.library_uno_summary,
  catan: m.library_catan_summary,
  carcassonne: m.library_carcassonne_summary,
  domino: m.library_domino_summary,
} satisfies Record<GameId, Text>;

export const loops = {
  'little-secret': [m.ls_loop_0, m.ls_loop_1, m.ls_loop_2],
  azul: [m.library_azul_loop_0, m.library_azul_loop_1, m.library_azul_loop_2],
  codenames: [m.library_cn_loop_0, m.library_cn_loop_1, m.library_cn_loop_2],
  'sushi-go-party': [m.sgp_loop_0, m.sgp_loop_1, m.sgp_loop_2],
  uno: [m.library_uno_loop_0, m.library_uno_loop_1, m.library_uno_loop_2],
  catan: [
    m.library_catan_loop_0,
    m.library_catan_loop_1,
    m.library_catan_loop_2,
  ],
  carcassonne: [
    m.library_carcassonne_loop_0,
    m.library_carcassonne_loop_1,
    m.library_carcassonne_loop_2,
  ],
  domino: [
    m.library_domino_loop_0,
    m.library_domino_loop_1,
    m.library_domino_loop_2,
  ],
} satisfies Record<GameId, Text[]>;
