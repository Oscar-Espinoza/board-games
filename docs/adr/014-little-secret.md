# ADR 014: Little Secret's private missions and classic powers

Status: accepted. Date: September 12, 2026.

## Decision

Add Spanish classic Little Secret as the seventh Bun/TypeScript catalog game, with 3–9 seats, Spanish scoring in both interface languages and the named classic seven-type power variant. The [game rules](../games/little-secret.md) distinguish published rules, supplied edition research and explicit digital conventions. Do not combine French reissue rules or US Secret Weapons with this variant.

`games/little-secret/src/engine.ts` is a pure rules factory with injected content and randomness. Only the package's `server` entry imports the complete production word pack. Browser code imports types, presentation and guide modules. Local practice uses the engine with its own small pack; no multiplayer initialization or catalog import references practice fixtures.

Canonical missions retain hidden factions, word orientation, aliases, used IDs, private ballot and RPS commitments, and a resumable reaction queue. Recipient views are explicitly assembled and detached. A living password-holder receives their word without faction or teammates. Host status adds no secret access. Eliminated players cannot see the solution until their own pending reactions finish. Completed ballots, RPS rounds and results are public.

The existing room authority and transport remain unchanged. Actor identity and host context come from server bindings. Prompt IDs and mission/cycle identifiers validate resumable choices. Only unchanged, uncommitted readiness, continuation, ballots and RPS qualify for the existing bounded retry protocol. A disconnected actor waits for reconnection or seat replacement; no host-forged action or automatic timeout is introduced.

## Consequences

The app enforces progression, voting, reactions and scoring, while the group enforces spoken clue legality and power behavior using external conversation. Powers require visual communication as well. Public typed events support accepted-outcome feedback without revealing secrets. Words are independent of interface language. Pack structure is tested automatically; semantic quality still requires human review.
