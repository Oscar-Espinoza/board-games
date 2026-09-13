/** Only this registry knows client module paths. Imports run after room selection. */
export const gameClients = {
  'little-secret': () => import('@board-games/little-secret/Board.svelte'),
  azul: () => import('@board-games/azul/Board.svelte'),
  codenames: () => import('@board-games/codenames/Board.svelte'),
  'sushi-go-party': () => import('@board-games/sushi-go-party/Board.svelte'),
  uno: () => import('@board-games/uno/Board.svelte'),
  carcassonne: () => import('@board-games/carcassonne/Board.svelte'),
  catan: () => import('@board-games/catan/Board.svelte'),
};
