# Architecture

The catalog runs on Bun workspaces, TypeScript, SvelteKit, Bun and Socket.IO. Bun is the only game authority. This explicitly supersedes the former Rust/Wasm browser-hosted catalog architecture; [ADR 009](adr/009-typescript-catalog.md) records the migration and independent Zombies extraction. [ADR 010](adr/010-bun-runtime.md) records the subsequent Bun runtime and tooling migration.

| Location               | Responsibility                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/web`             | SvelteKit SPA, catalog, room UI, shared session client and Paraglide localization                           |
| `apps/server`          | In-memory rooms, token verification, connection ownership, action acceptance and same-origin static serving |
| `packages/game-core`   | Small game contract and common player/room/view types                                                       |
| `packages/shared`      | Metadata-only catalog and shared message types                                                              |
| `games/uno`            | UNO rules, private/public projection and lazily imported Svelte table                                       |
| `games/catan`          | Catan board/rules, private/public projection and lazily imported Svelte table                               |
| `games/carcassonne`    | Big Box 3.1 tiles, connected features, resumable decisions and lazy SVG table                               |
| `games/azul`           | Standard-wall tile drafting, conservation, scoring and ceramic table                                        |
| `games/codenames`      | Team/role setup, clue review, recipient-private key and dossier table                                       |
| `games/sushi-go-party` | Simultaneous drafting, full standard menu, resumable effects and private hands                              |

## Authority and state delivery

`GameDefinition` exposes `create`, `apply`, `view` and `isFinished`, plus game ID and player limits. Rules receive an explicit random source and an optional server-supplied action context containing the current room host. They do not depend on sockets, DOM, storage or rendering. Invalid actions must reject without changing state. Each game owns legal moves, turn rules, setup and victory; these differ enough that they are not forced into a universal turn framework.

A socket joins a Socket.IO room and is bound to a verified seat. Action envelopes carry an action ID, round and expected revision. Bun derives the actor from this binding, rejects stale or invalid intentions, applies accepted changes and sends fresh recipient projections. Bounded accepted-action IDs prevent repeated application of retried actions. The room host controls starting a round; it has no privileged access to canonical game state and is not the rules authority.

`view(state, playerId)` is the only state delivery boundary. Each snapshot includes public state and that recipient's private state. Canonical hands, deck order and reconnect secrets must never be broadcast. Shared animation/UI effects use accepted projections; they cannot mutate server state.

## Seats and reconnection

Bun generates seat IDs, unguessable room IDs and private reconnect tokens. The client keeps credentials under a room-specific localStorage key. Names are labels, never credentials. Socket.IO reconnect or reopening a room presents the token to restore its existing seat. Claiming an already connected seat with its valid token replaces the old connection.

Disconnect reserves a seat for `RECONNECT_GRACE_MS` (default 120000). Expiration invalidates the old token. Lobby vacancies are removed; an active game's seat remains available for a replacement, preserving its game identity and position while assigning a new name and secret. Host metadata moves to a connected seat when needed. Abandoned rooms are eventually collected; no state survives a Bun restart.

## Browser delivery and languages

The static adapter emits an SPA into `apps/web/build`. Bun serves it with `sirv`, including room-route fallback, and handles Socket.IO on the same origin. Development uses Vite with a proxy to Bun. The catalog imports metadata only. `apps/web/src/lib/games.ts` contains dynamic client imports invoked after game selection; opening the catalog does not import every game's UI or server rules.

Paraglide generates localized functions from `packages/shared/messages/en.json` and `es.json`. Locale configuration lives in `packages/shared/project.inlang/settings.json`; adding a locale means adding that locale's messages and registration. CSS, SVG and Svelte handle presentation; there is no game engine.

## Adding a game

Create a workspace game package with the contract implementation and its Svelte UI. Register server rules in the server registry, catalog metadata in `packages/shared`, and one dynamic UI import in the client registry. Keep game assets and rules with that game. Extract additional shared helpers only when current games demonstrate the need.

The [UNO house rules](rules.md) and [Catan rules summary](games/catan.md) describe the retained game behavior.

## UNO practice and table effects

UNO offers private practice rooms with one human and three computer seats. The
optional game `botAction(view)` contract receives the same recipient projection
as a player. The server schedules at most one bot action per room every 900 ms,
uses ordinary rule validation, and pauses when the human disconnects. Tokens
cannot claim computer seats; outside players cannot join a practice room.

UNO's browser presentation compares consecutive recipient snapshots and captures
old/new DOM geometry to animate accepted moves with Web Animations. It never
receives opponent faces for draws. Resynchronization cancels obsolete effects.
The viewport table and sound/motion controls remain game-specific. Chrome and Safari are required delivery targets; CI exercises
Chromium and WebKit, with actual Safari device validation separate.

## Catan island and local sandbox

Catan fills the viewport with an SVG island over ocean. Edge controls and internally
scrolling panels keep the page stationary. Placement intentions first show a
translucent preview; only an accepted revision produces a landing effect. The island fits the available space and supports bounded wheel/pinch/button zoom
without drag-to-pan. Wheel zoom preserves the world point under the pointer; pinch zoom uses the fingers’ midpoint. Legal map targets reveal a translucent piece on hover or keyboard focus. Double-click submits the ordinary placement action; a single click retains preview/confirmation. Up to four civilizations occupy cardinal seats relative to the viewer;
five and six use additional perimeter seats. Resource cards, illustrated harbors
and a hooded robber replace the compact counters and text/glyph placeholders.
A single Settings menu contains sound, motion, language, help and local scenario
controls. Sound and motion preferences use Catan-specific localStorage keys;
reduced motion removes moving effects and sound unlocks through a user gesture.

Rules generate typed Catan presentation events after each accepted action. Public
views include the existing revision and public events; recipient events contain
only that player's development purchase or theft details. Public theft never
includes resource identity. The browser renders consecutive revisions only,
cancelling on reconnection, seat/round changes, gaps, resizing or motion changes.
Events are transient decoration and cannot delay or mutate authoritative play.

The catalog's **Try Catan** link opens the lazy route `/practice/catan`. It loads
the same board through the client registry and runs the same rules locally with
seeded randomness and four switchable seats. Separate finite-bank fixtures cover
setup, building, production, robber, Monopoly, trade, army awards and victory.
Only the selected seat's projection reaches the board. Practice creates no room,
uses no bots, has no persistence, and never changes multiplayer initialization.
See [ADR 011](adr/011-catan-presentation.md).

## Carcassonne landscape and practice

Carcassonne owns expansion configuration and readiness inside its game state. A
narrow optional `GameDefinition.presence` callback receives connected seat IDs
and replacement identity from the room layer; it clears unconsumed readiness
without rewriting a pending game choice. Only setup readiness can retry a stale
revision for the identical configuration, using its original action ID.

Road/city regions and field half-edges connect across rotated tile edges. The
small feature graph is recomputed because ferries can split connections. Pending
decisions store legal targets and the entitled actor. Deck/message order remains
server-only; accepted presentation events carry no future information. The local
`/practice/carcassonne` route follows the required seat and includes short-game
and expansion fixtures. See [ADR 012](adr/012-carcassonne-table.md) and the
[rules and app conventions](games/carcassonne.md).

## Azul, Codenames and Sushi Go Party

The three games retain the same authoritative contract and game-owned rules,
readiness, effects and private projections. Each fills the viewport with corner
rules/settings overlays; room controls arrive through `settingsContent`, and host
results use the optional `canRematch`/`rematch` props. Local practice routes and
illustrated library lessons load separately from game initialization and metadata.

The room protocol now preserves structured stale/match errors. An authenticated
`sync` request returns the caller's own projected snapshot and acceptance of its
own action ID. The client keeps that ID for at most three attempts, revalidating
eligible Carcassonne/Codenames readiness and Sushi readiness/picks after each
synchronization. Round/turn/prompt/ownership changes, commitment or disconnected
seats stop retries. Azul drafts and Codenames guesses are never automatically
reconfirmed. A missing acknowledgement is synchronized before any resubmission.
See [ADR 013](adr/013-three-game-delivery.md) for the precise boundaries.

Azul's table presentation is being reworked to Table Light, recorded in
[ADR 017](adr/017-azul-table-light.md) with tokens, components, motion and mobile
layout in [Azul redesign](azul-redesign/README.md). It changes no rules, no
projection and no event, and the game keeps its colours in a game-owned palette
module rather than in shared packages.

## Little Secret

The seventh game uses a pure content-injected engine with explicit randomness.
Its server entry alone imports production word packs; practice supplies a small
independent teaching collection. Canonical roles, word orientation, aliases,
content IDs and incomplete commitments never cross the player projection.
Public powers are independent of factions. Journalist and Revenant reactions
are resumable actor-owned prompts, resolved before terminal scoring, with
solutions withheld from actors until their reactions finish.

The existing room transport handles identity, host transfer, deduplication and
replacement. Its retry predicate additionally permits unchanged, uncommitted
Little Secret readiness, continuation, ballots and RPS, preserving the original
action ID and the existing three-attempt limit. Other actions never retry
automatically. See [ADR 014](adr/014-little-secret.md) and
[Little Secret rules](games/little-secret.md).
