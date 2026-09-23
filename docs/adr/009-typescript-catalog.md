# ADR 009: TypeScript board-game catalog and separate Zombies project

Status: accepted by explicit user migration request, September 10, 2026.

## Decision and scope

`board-games` contains only UNO and Catan for now. Replace its Rust/Wasm and browser-host/WebRTC implementation with pnpm workspaces, TypeScript, a SvelteKit SPA, an authoritative Node.js Socket.IO server and Paraglide English/Spanish localization. Use CSS/SVG/Svelte for visuals. Keep rooms in memory and serve the built frontend and sockets from one Node port. Do not add accounts, a database, Redis or production orchestration for a game night among roughly 4–8 friends.

Move the existing Zombies/Survival game into `../zombies-game`, preserving its Rust simulation, Bevy/WebGPU renderer, Wasm worker, assets, saves, replay fixtures and diagnostic tooling. It has its own Cargo workspace, lockfile, browser dependencies and minimal Rust static/metrics server. It has no path dependency on board-games. Survival crate and route identifiers remain unchanged to preserve contracts. Its README and extraction document are the current source of truth for that project.

This decision explicitly supersedes the catalog's Rust-primary instructions and ADRs 001–004 where they prescribe Wasm execution, Rust browser rendering or browser-host multiplayer. Deterministic rules, explicit randomness and recipient-specific hidden-information boundaries remain useful principles. Survival-specific ADRs 005–008 continue to apply in the extracted project. Historical rule/product documents remain references; their old transport, rendering and build details are not compatibility requirements.

## Rationale and consequences

The user normally hosts a PC in Argentina through a tunnel for friends, often in Europe. An authoritative Node process avoids host handoff and peer connectivity complexity while giving a clear validation and privacy boundary. Full recipient snapshots are sufficient for turn-based games. In-memory state makes a server restart destructive to current rooms, which is an accepted product tradeoff.

A small game contract owns creation, action validation, player projection and completion. Each game keeps its rules and UI. Metadata and dynamic UI imports keep catalog downloads independent of individual games. Future games add a package and registry entries without a general-purpose framework.

Generated seat IDs and browser-held private tokens provide reconnection without accounts. Reserved seats expire after a configurable grace period. Replacements inherit active-game seat positions with new secrets; matching a display name confers no rights.

## Preservation and verification

Before modification, the complete original source/assets tree was copied to `/home/oscar/.local/state/board-games-migration/20260910-212058`, excluding `.git`, `node_modules`, `target`, browser test reports and generated Svelte caches. The sibling did not exist and was created without overwriting an existing project. Preserve that snapshot as migration recovery material outside discovery directories.

## Runtime follow-up

[ADR 010](010-bun-runtime.md) replaces the original pnpm package manager and Node runtime with Bun. The authoritative Socket.IO architecture and game boundaries above remain in effect.
