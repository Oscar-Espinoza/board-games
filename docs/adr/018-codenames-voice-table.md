# ADR 018: Codenames voice-led tabletop

The voice-only turns, either-team reveals, grid-only composition and portraits are
superseded by [ADR 019](019-codenames-table-turns.md). Other guarantees remain.

Date: 2026-09-13. Status: accepted.

## Context

The approved design is a realistic wooden table with 25 paper cards, illustrated
reveals, and Rules/Settings corner controls. Groups play on an external voice call
or in the same room. They remember clues and manage turns themselves.

This decision supersedes ADR 015's clue review, penalties, turn enforcement and
history. Its role consent, recipient privacy, authenticated actions, local practice
boundary and accepted-event presentation remain in force.

## Decision

Use `setup`, `playing` and `finished`. Keep the existing 4–8 seats, exactly one
spymaster and at least one operative per team, versioned unanimous readiness,
English/Spanish board-language selection, and immutable dealt roles. Remove
clue-agreement options from room creation; groups agree on exceptions over voice.

The starting team receives nine agents; its opponent eight. Seven civilians and
one assassin complete the board. `startingTeam` is fixed metadata, not an active
turn. Clues, counts, review, penalties and handoffs are neither stored nor enforced.
Either team's operative can submit the existing `{ type: 'guess', card }` intention.
Spymasters cannot reveal. The authenticated revealing actor's team loses to the
assassin. Whichever team's last agent is revealed wins, regardless of the actor.

Keep accepted deal, reveal and finish events with sequence/index identifiers;
remove accumulated history. Operatives receive no unrevealed identities until the
match finishes. Hosts gain no extra key access. Public presentation never depends
on a hidden identity. Illustration variation derives only from public card index.

The playing surface contains only the grid and corner controls. Role/roster,
starting team, remaining agents, room controls and preferences live in Settings.
Card selection opens a temporary explicit confirmation; changes, reconnection,
resize and visibility discontinuities cancel pending selections. Guesses never
retry automatically. Results open a dismissible overlay; the host can rematch.
The starting team is briefly announced on a fresh board and remains in Settings.

Original SVG portraits show red/blue spies, civilians and an assassin after reveal.
Unrevealed spymaster cards use private colour/symbol markings. CSS and SVG supply
wood, paper, depth and printing textures, with no new runtime dependencies.
The same fixed 5×5 grid fits desktop and phone viewports. Audio retains gesture
unlock and silent fallback; accepted-event animation respects reduced motion.

## Consequences

Players must coordinate turns, counts and clue legality themselves. Any operative
can reveal, so a teammate should confirm only the group's agreed choice. There is
no undo or clue log. An absent spymaster no longer blocks the software.

This replaces the previous mode. Rooms are in memory and are lost on normal server
restart; there is no persisted-state migration or legacy protocol adapter. Deploy
client and server together. Update practice, guides, translations, tests and current
documentation together; older handoffs remain historical evidence.
