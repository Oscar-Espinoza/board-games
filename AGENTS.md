# Working agreements

Infer intent from the request and repository context. Carry authorized implementation through to completion, make routine choices autonomously, and preserve unrelated user changes. Ask only when missing information materially affects the outcome or an irreversible external action needs approval. Use effective available tools; optional tooling is not a blocker. Validate proportionately and communicate actual results and limitations clearly.

## Optional extension policy

Keep only Ponytail (`ponytail@ponytail`) and Diagram Design (`diagram-design@diagram-design`) as optional plugins and their bundled skills in Claude Code and Codex. Do not install, import, restore, or enable any other optional plugins, standalone skills, or extension frameworks unless the user explicitly requests it. This includes automatic imports from the other tool and shared skills. Preserve application-required built-in capabilities and independently configured MCP servers.

Run `~/.local/bin/audit-agent-extensions` for an on-demand, read-only extension audit. Backups live outside discovery directories in `~/.local/state/extension-cleanup/`.

## Repository architecture

This Bun/TypeScript workspace contains UNO, Catan, Carcassonne, Azul, Codenames, Sushi Go Party and Little Secret. SvelteKit supplies the browser SPA; Bun and Socket.IO own authoritative in-memory rooms. Use Paraglide for English/Spanish localization and CSS/SVG/Svelte for visuals. No Rust/Wasm, database, Redis, accounts or WebRTC belongs in this catalog. The explicit migration request supersedes the previous Rust-primary instructions; [ADR 009](docs/adr/009-typescript-catalog.md) records the decision. [ADR 010](docs/adr/010-bun-runtime.md) replaces pnpm/Node with Bun package management and runtime.

Zombies is a separate sibling project at `../zombies-game`, retaining its Rust/Wasm architecture and independent instructions. Do not reintroduce its dependencies into this workspace.

Keep game rules independent of DOM, networking and storage. Make randomness explicit. Each game owns its state, validation, turn rules, win conditions, private projection and UI. Share only demonstrated concepts through the small game contract. Server socket bindings establish actor identity; client intentions never directly mutate canonical state. Never deliver other players' secrets and merely hide them in UI. Keep catalog metadata free of eager game imports.

Document major architectural decisions in `docs/`, updating affected instructions together. Current references: [architecture](docs/architecture.md), [migration](docs/adr/009-typescript-catalog.md), [setup](README.md), [hosting](docs/deployment.md), [validation](docs/validation.md). [UNO house rules](docs/rules.md) and [Catan rules](docs/games/catan.md) describe the retained game behavior.

## Commands and validation

Use `bun install`, `bun run dev`, `bun run build` and `bun run start` from the root. Run `bun run check`, `bun run test` and appropriate `bun run test:e2e` coverage after changes. `bun run format` formats maintained source; `bun run format:check` checks it. Test meaningful game, session, privacy and browser behavior. Stop repeating passing checks without new evidence. Report unavailable or deferred checks as unverified. Documentation-only changes need accuracy, link and scope review rather than application tests.

Chrome and Safari are required browser targets. Run Chromium and WebKit browser checks for browser changes; WebKit automation does not replace final Safari device validation. Firefox is optional. Audio must unlock through a user gesture and unavailable audio must not block play.

Catan presentation events are typed, generated only by accepted rules actions,
and projected explicitly through player views. Keep theft identities and hidden
development cards recipient-only. `/practice/catan` uses separate local fixtures;
never import them into multiplayer initialization or eager catalog metadata.
[ADR 011](docs/adr/011-catan-presentation.md) records this boundary.

Catan's physical tabletop follows the supplied September 2026 reference: locally
bundled painted WebP scenery and materials under the real SVG island, wooden
cardinal player plaques, a local hand below its plaque, and parchment building
costs. Keep game information and controls in SVG/Svelte, preserve recipient
privacy and accepted-event effects, and keep desktop layouts within the viewport.
The last public dice result may rest in the bowl without replaying an event.
[ADR 022](docs/adr/022-catan-physical-table.md) records this presentation migration.

Carcassonne uses explicit tile regions and field half-edges, recomputed feature
components, and resumable actor-owned choices. Do not replace its graph with a
merge-only cache: ferries disconnect roads. Preserve Big Box 3.1 builder/pig and
unfinished-feature behavior. Keep `/practice/carcassonne` fixtures out of room
initialization and catalog metadata. See [ADR 012](docs/adr/012-carcassonne-table.md)
and [Carcassonne rules](docs/games/carcassonne.md).

Carcassonne's painted wooden table uses local WebP materials beneath real SVG
tile regions, symbols and numbered wooden pieces. One affine camera controls
drawing and inverse hit testing; never apply an independent CSS perspective.
Keep the fixed desktop player column and tile tray separate from camera controls;
compact layouts use a scrollable seat strip and expandable piece supply. Tile
drops remain previews requiring confirmation. The six-seat painted practice
fixture and artwork inventory stay isolated from multiplayer and eager metadata.
See [ADR 024](docs/adr/024-carcassonne-painted-table.md).

Azul, Codenames and Sushi Go Party own viewport tables with rules/settings corner
controls. Preserve role-private Codenames keys and Sushi hands, picks and Menu
offers in actual recipient payloads. Their practice fixtures stay separate from
multiplayer initialization and catalog metadata. Only still-valid simultaneous
readiness/picks retry coded stale errors, keeping the action ID through at most
three total attempts; never retry Azul drafts or Codenames clues, guesses or end-turn automatically.
See [ADR 013](docs/adr/013-three-game-delivery.md), [Azul rules](docs/games/azul.md),
[Codenames rules](docs/games/codenames.md) and
[Sushi Go Party rules](docs/games/sushi-go-party.md).

Azul's accepted table presentation is Rich & Dramatic: generated raster materials
under real Svelte/HTML state, one collision-free circle of factory plates around a
loose centre pool, opponents rendered as real boards, and a decorative 0–100 score
track with uncapped exact scores and a `100+` indicator. The desktop board stays
below the complete ring. Compact layouts use whole-factory buttons, colour and
destination dialogs, and a collapsed-by-default local board tray; only an explicitly
expanded tray may cover lower factories. Compact boards are noninteractive and
dialog copies emit no table anchors. The main table never scrolls. Stage
scoring/cleanup only from accepted public events and snapshots; keep the existing
audio system. Take colours and artwork from game-owned modules, and keep every
`data-azul-location` anchor — a missing or zero-sized anchor drops its flight
silently, and flying tiles live outside the component tree. This is presentation
only. [ADR 020](docs/adr/020-azul-rich-dramatic.md) supersedes ADR 017's visual
choice while preserving its behavioral contracts; see the
[Azul redesign](docs/azul-redesign/README.md) documents.

Little Secret uses Spanish classic 3–9-player rules and the pinned seven-type
classic power set. Keep production words and selection server-only; practice
imports the pure engine with its own pack. Living password-holders never receive
their faction; pending Journalist/Revenant actors do not receive solutions.
Reveal ballots and RPS only after all required commitments. Preserve resumable
actor-owned reactions and explicit host context. Retry only unchanged,
uncommitted readiness, continuation, ballots and RPS. See
[ADR 014](docs/adr/014-little-secret.md) and [rules](docs/games/little-secret.md).

Codenames uses setup, clue, guessing and finished phases with authoritative active
teams, clues, guess budgets and public clue history. Only the active spymaster
submits clues; only active-team operatives reveal or end turns. Keep mandatory
first guesses, immediate wins, private unrevealed identities and unanimous setup
readiness. The fixed 5×5 paper grid, header, team panels, history, players and key
follow [ADR 019](docs/adr/019-codenames-table-turns.md). Original locally bundled
WebP materials/transparent props are approved for Codenames only; gameplay and
interface text remain Svelte/CSS. See the [redesign](docs/codenames-redesign/README.md)
and [rules](docs/games/codenames.md).

Sushi Go Party uses the approved illustrated desktop table with eight real-text
menu tiles, ivory trays and a perimeter score track. Shared CSS/SVG components
live under the game's `src/table/`; the archived prototype fixture stays isolated.
Use actual recipient views and accepted public reveal/pass events only. Preserve
all 26 cards, 2–8 seats, private prompts, compact layouts, rules/settings controls,
localization and cancellation/no-replay behavior. See
[ADR 021](docs/adr/021-sushi-illustrated-table.md) and the
[migration handoff](docs/sushi-go-party-redesign.md).
