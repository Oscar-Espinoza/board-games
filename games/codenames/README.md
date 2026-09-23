# Codenames

Authoritative clue-and-turn Codenames for 4–8 friends. Bun owns in-memory rules;
Svelte renders a fixed 5×5 paper table with real room information, team counts,
turn banner, public history, players and a private spymaster panel.

Phases: setup → clue → guessing → finished. Active spymasters submit clues;
active operatives reveal and end turns after at least one guess. Finite budgets
allow count + 1; zero/unlimited remove the numerical cap. Opponent/civilian guesses
hand off; last agents and assassins finish immediately. Groups judge clue legality.

Operatives never receive unrevealed identities. Setup readiness is versioned and
unanimous. Only unchanged readiness retries; clues, guesses and end-turn do not.
The host can rematch. Production packs and practice fixtures stay separate.

Original optimized WebP table materials are bundled under `src/table/` with
provenance. All interface text/cards use Svelte/CSS. Archivo is self-hosted.
No runtime dependencies or sounds were added. Build and deploy client/server together.

See [rules](../../docs/games/codenames.md), [ADR 019](../../docs/adr/019-codenames-table-turns.md) and
[redesign](../../docs/codenames-redesign/README.md).
