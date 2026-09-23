# ADR 013: Three additional games and concurrent intentions

Date: 2026-09-12. Status: accepted.

## Context

Azul, Codenames and Sushi Go Party join UNO, Catan and Carcassonne. They have
substantially different turn structures and information boundaries: Azul's visible
tile draft, Codenames' role-private key, and Sushi's simultaneous private picks and
resumable special choices. Their tables occupy the viewport, with room controls
inside game-owned settings. The existing room authority remains suitable.

## Decision

Each game owns its rules, explicit randomness, private projection, presentation
batches, local practice fixtures, artwork, settings and board. No common turn
resolver, universal game UI, database or new extension framework is introduced.
The catalog holds metadata and lightweight original cover illustrations. Boards,
illustrated library lessons and practice routes load independently.

The room supplies its existing `settingsContent` snippet with language, invite,
connection/room identity, leave and host rematch controls. Optional `canRematch`
and `rematch` props also allow a host action in the results. The three new games
hide the persistent room toolbar, own accessible rules/settings corner buttons,
and keep names, seats, scores and waiting states on their playing surfaces.
Connection failures and rejected-action feedback remain visible without opening
settings. Presentation never pauses server acceptance.

Authoritative action envelopes continue to require the exact room revision and
match epoch. Failed replies may carry `STALE_REVISION` or `MATCH_CHANGED` codes;
the browser retains these separately from human-readable text. A socket-bound
`sync` request returns only its own fresh `RoomView` plus whether its own action
ID was accepted in the requested match. It does not reveal other seats' accepted
IDs, hands, key cards or credentials, and does not mutate the game.

Only simultaneous uncommitted intentions may retry automatically, at most three
**total** submission attempts. Every attempt keeps the original action ID and
payload. A stale response or missing acknowledgement first triggers authoritative
synchronization. An already accepted ID completes without another submission.
Otherwise the browser rechecks the synchronized and latest pushed views:

- Carcassonne and Codenames readiness requires the same seat, room, match and
  setup version, with every seat connected and the actor not already ready.
- Sushi readiness additionally retains its game round and setup/receipt phase.
- Sushi picks retain game round, turn, private prompt, current hand handle, copy
  target and declared utensil eligibility. A committed actor or a passed hand
  ends the retry opportunity.

Configuration and special-choice actions, Azul drafts and Codenames guesses need
fresh user confirmation after staleness. The server still validates every action
and deduplicates accepted IDs before checking its revision. These browser guards
improve concurrent interaction; they are not an authority boundary.

`GameDefinition.presence` retains its narrow purpose: rules receive connected
seat identities and replacement notifications from verified room bindings.
Disconnect/replacement preserves committed picks, hands, scores and resumable
choices. Game-owned setup readiness may be invalidated without changing a seat's
identity or revealing its private state.

## Consequences and validation

Private projections and accepted events remain explicit allowlists. Original
physical artwork is represented with CSS/SVG/Svelte. Audio starts only after a
user gesture and cannot block play; reduced motion settles pieces immediately.
Reconnection, revision gaps, rematches and hidden-tab restoration establish the
current view without replaying past effects.

Transport tests cover coded failures, original-ID retries, lost acknowledgements,
passed hands, setup changes and actual socket recipient privacy. Game-specific
rules/session/browser suites exercise each game's distinct boundaries; the
combined suite covers all six catalog entries and existing-game regressions.
Actual Safari devices, human group playtests and fluent Spanish review remain
unverified. See the per-game rules documents for disclosed app conventions.
