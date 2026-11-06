# Azul

Standard 2–4-player colored-wall Azul, using the small game contract and original ceramic art. See [rules, sources and conventions](../../docs/games/azul.md).

- `src/index.ts`: authoritative rules and explicit public view.
- `src/presentation.ts`, `src/effects.ts`: accepted-revision eligibility, measured tile travel and gesture-unlocked sound.
- `src/Board.svelte`, `PlayerBoard.svelte`, `Tile.svelte`: responsive table and inspectable public boards.
- `src/locations.ts`: the tile-location ids rules events carry and the table renders as `data-azul-location` anchors.
- `src/HelpScene.svelte`: illustrated scenes for the catalog guide (the rules text lives in the web catalog).
- `src/practice.ts`: isolated deterministic conserved fixtures; never imported by multiplayer initialization.

The full app uses `bun run dev` or `bun run start` at the root.
