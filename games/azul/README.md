# Azul

Standard 2–4-player colored-wall Azul, using the small game contract and original ceramic art. See [rules, sources and conventions](../../docs/games/azul.md).

- `src/index.ts`: authoritative rules and explicit public view.
- `src/presentation.ts`, `src/effects.ts`: accepted-revision eligibility, measured tile travel and gesture-unlocked sound.
- `src/Board.svelte`, `PlayerBoard.svelte`, `Tile.svelte`: responsive table and inspectable public boards.
- `src/Help.svelte`, `HelpScene.svelte`, `help.ts`: searchable illustrated English/Spanish guide.
- `src/practice.ts`: isolated deterministic conserved fixtures; never imported by multiplayer initialization.

Run `bun test games/azul apps/server/src/azul.test.ts`, `bun run check`, `bun run build`, then the Azul Playwright suite with Chromium and WebKit. The full app uses `bun run dev` or `bun run start` at the root.
