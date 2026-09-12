# Codenames

Classic word Codenames for 4–8 friends. Bun owns authoritative in-memory rules;
Svelte renders only recipient projections. No bots, timers, chat or accounts.

`src/index.ts` owns setup, role consent, clue review, penalty, guesses and wins.
`words.ts` contains original server-only English/Spanish packs. `Board.svelte`
imports rule types only; practice fixtures are a separate export and local route.
`guide.ts` and `GuideScene.svelte` are lightweight standalone lesson content shared
with the lazy library guide.

Rules and architecture: [game reference](../../docs/games/codenames.md),
[ADR 015](../../docs/adr/015-codenames-dossiers.md).
