# ADR 015: Codenames roles, review and private dossiers

Date: 2026-09-12. Status: partially superseded by [ADR 018](018-codenames-voice-table.md).

Clue review, penalties, turn enforcement and history below describe the previous
mode. ADR 018 replaces them with voice-led play; role consent and privacy remain.

## Context

Classic Codenames introduces team roles and a shared word board whose identities
are known only to the two spymasters. The catalog already has an authoritative
Bun/Socket.IO room contract, per-seat projections, injected randomness and local
practice boundaries. An operative room host must have no key access.

## Decision

Implement a game-owned rules package and keep catalog metadata and guide imports
free of engine/word-pack imports. Create starts in `setup` with no board. Each
actor chooses only their own role and all seats ready against `setupVersion`.
Every role change invalidates consent. Presence and seat replacement use the
existing optional game presence contract. Role, board-language and clue agreements
freeze when final readiness atomically deals the board.

Use explicit clue, opposing-spymaster review, guessing and penalty phases. Human
review handles semantic clue rules; the engine validates structure and permissions.
Review approval is final before any guess. Never retry uncertain clues, guesses,
reviews or penalty reveals automatically. Local selection requires fresh explicit
confirmation after a competing action or reconnection.

Only spymaster private projections contain unrevealed identities. Public cells
include identities only after reveal or game completion. Events use explicit
allowlisted payloads and independent accepted-action sequence numbers. A recipient
view can be tested by permuting hidden keys without changing operative output.
Sound and motion use public accepted events only and cancel at discontinuities.

## Consequences

Trusted friends still must avoid sharing keys or credentials. Server restarts lose
in-memory matches. Absent spymasters naturally block their role's actions; there
is no host elevation or automatic role substitution. Local practice can show
multiple roles, but its fixtures are excluded from multiplayer and eager metadata.
The app's 4–8 capacity, generated key and pre-guess review are documented adaptations.
