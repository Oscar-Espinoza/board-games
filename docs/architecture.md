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
| `games/codenames`      | Team/role consent, authoritative clues/turns, public history and private key table                          |
| `games/sushi-go-party` | Simultaneous drafting, full standard menu, resumable effects and private hands                              |
| `games/domino`         | Venezuelan pairs dominoes, cosmetic strike scatter and a three.js patio table                               |

## Authority and state delivery

`GameDefinition` exposes `create`, `apply`, `view` and `isFinished`, plus game ID and player limits. Rules receive an explicit random source and an optional server-supplied action context containing the current room host. They do not depend on sockets, DOM, storage or rendering. Invalid actions must reject without changing state. Each game owns legal moves, turn rules, setup and victory; these differ enough that they are not forced into a universal turn framework.

A socket joins a Socket.IO room and is bound to a verified seat. Action envelopes carry an action ID, round and expected revision. Bun derives the actor from this binding, rejects stale or invalid intentions, applies accepted changes and sends fresh recipient projections. Bounded accepted-action IDs prevent repeated application of retried actions. The room host controls starting a round; it has no privileged access to canonical game state and is not the rules authority.

`view(state, playerId)` is the only state delivery boundary. Each snapshot includes public state and that recipient's private state. Canonical hands, deck order and reconnect secrets must never be broadcast. Shared animation/UI effects use accepted projections; they cannot mutate server state.

## Seats and reconnection

Bun generates seat IDs, unguessable room IDs and private reconnect tokens. The client keeps credentials under a room-specific localStorage key. Names are labels, never credentials. Socket.IO reconnect or reopening a room presents the token to restore its existing seat. Claiming an already connected seat with its valid token replaces the old connection.

Disconnect reserves a seat for `RECONNECT_GRACE_MS` (default 120000). Expiration invalidates the old token. Lobby vacancies are removed; an active game's seat remains available for a replacement, preserving its game identity and position while assigning a new name and secret. Host metadata moves to a connected seat when needed, including when a token reconnect is the first seat back. Empty lobbies are collected once their last reservation expires; abandoned games after an hour. Room creation is capped at 64 rooms and 12 new rooms per minute server-wide. No state survives a Bun restart.

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
The viewport table and sound/motion controls remain game-specific. Chrome and Safari are the delivery targets.

## Catan island and local sandbox

Catan fills the viewport with an SVG island over ocean. Edge controls and internally
scrolling panels keep the page stationary. Placement intentions first show a
translucent preview; only an accepted revision produces a landing effect. The island fits the available space and supports bounded wheel/pinch/button zoom
with drag/keyboard panning while zoomed. Wheel zoom preserves the world point under the pointer; pinch zoom uses the fingers’ midpoint. Legal map targets reveal a translucent piece on hover or keyboard focus. Double-click submits the ordinary placement action; a single click retains preview/confirmation. Up to four civilizations occupy cardinal seats relative to the viewer;
five and six use additional perimeter seats. The physical tabletop uses local
painted WebP scenery/terrain beneath SVG pieces, number discs, illustrated harbors
and a black wooden robber. Four wooden plaques surround the island, with the
local hand below its plaque, controls at lower left and parchment costs at lower
right. A wooden toolbar exposes navigation, rules, invite, language, settings and
connection state. Settings contains sound, motion, help and local scenario
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
See [ADR 011](adr/011-catan-presentation.md) and the current
[physical tabletop presentation](adr/022-catan-physical-table.md).

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

The painted table combines local WebP scenery/materials with SVG region geometry,
symbols and wooden figures. A single affine ground transform and its inverse own
camera rendering, pointer hit testing, zoom and focus. The desktop player column
and bottom tray become a horizontal seat strip and compact supply on small screens.
`/practice/carcassonne?scenario=table` supplies a deterministic six-seat landscape,
separate from multiplayer initialization. See
[ADR 024](adr/024-carcassonne-painted-table.md). Standing scenery (walls, towns,
churches, meadow props) uses the same plane through stacked `lift()` offsets and
upright sprites in a depth-sorted, non-interactive elevation pass; see
[ADR 025](adr/025-carcassonne-standing-scenery.md).

## Azul, Codenames and Sushi Go Party

The three games retain the same authoritative contract and game-owned rules,
readiness, effects and private projections. Each fills the viewport with
rules/settings overlays (Codenames places them in its header); room controls arrive through `settingsContent`, and host
results use the optional `canRematch`/`rematch` props. Local practice routes and
illustrated library lessons load separately from game initialization and metadata.

The room protocol now preserves structured stale/match errors. An authenticated
`sync` request returns the caller's own projected snapshot and acceptance of its
own action ID. The client keeps that ID for at most three attempts, revalidating
eligible Carcassonne/Codenames readiness and Sushi readiness/picks after each
synchronization. Round/turn/prompt/ownership changes, commitment or disconnected
seats stop retries. Azul drafts and Codenames clues, guesses and end-turn are never automatically
reconfirmed. A missing acknowledgement is synchronized before any resubmission.
See [ADR 013](adr/013-three-game-delivery.md) for the precise boundaries.

Azul's table uses the Rich & Dramatic presentation recorded in
[ADR 020](adr/020-azul-rich-dramatic.md), which supersedes ADR 017's visual
choice while retaining its interaction, animation and anchor contracts. Generated
raster materials sit under live Svelte/HTML state; the change affects no rules,
projection or event. Colours and artwork remain game-owned rather than shared.

Codenames uses setup/clue/guessing/finished with authoritative active teams,
clues, guess budgets and public revealed-only history. Only active spymasters give
clues and active operatives guess/end turns. The group still judges clue legality.
A paper word grid, header, team panels, players/history and private key panel form
the viewport table. Original local WebP wood/transparent props are an approved
Codenames-only exception to CSS/SVG visuals; UI text stays in Svelte. Reconnects
cancel pending selections and events. See [ADR 019](adr/019-codenames-table-turns.md).
Client and server ship together for this protocol migration.

Sushi Go Party's approved illustrated desktop table is recorded in
[ADR 021](adr/021-sushi-illustrated-table.md). Shared game-owned Svelte/CSS/SVG
primitives render real recipient views; the archived prototype fixture remains
isolated. Compact layouts, actor-only prompts and the existing accepted-event,
privacy, audio and retry contracts remain intact.

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

Little Secret's shared room/practice board uses the local desk and paper assets
beneath live Svelte state. Accepted typed clues are a detached public ledger for
the current cycle; Mime confirms without text. Desktop perimeter seats become a
scrolling two-column compact table with actions first. Ballot review is local
presentation of accepted public events, while outcomes come from authoritative
results. See [ADR 023](adr/023-little-secret-table.md).

## Dominó

Exactly four seats in fixed pairs. Rules, projection and the slam scatter live in
`games/domino/src/index.ts`. Each tile's resting pose is public, cosmetic state: a new
tile plugs onto its neighbour wherever that neighbour lies, a slam jitters poses with
the server's random source, and any player can tidy them. Pure chain geometry
(`layout.ts`) is shared by two looks: a three.js patio and an 8-bit Canvas 2D table,
each loaded lazily with its own art and sound over one `DominoGame` controller. The
player picks the look (defaulting to the home page theme). The local
practice route is pass-and-play and follows whoever is to move. See
[Dominó](games/domino.md).
