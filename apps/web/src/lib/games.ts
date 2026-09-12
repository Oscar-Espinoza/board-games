/** Only this registry knows client module paths. Imports run after room selection. */
export const gameClients = {
  azul: () => import('@board-games/azul/Board.svelte'),
  uno: () => import('@board-games/uno/Board.svelte'),
  carcassonne: () => import('@board-games/carcassonne/Board.svelte'),
  catan: () => import('@board-games/catan/Board.svelte'),
};
