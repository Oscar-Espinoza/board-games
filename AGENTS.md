# Working agreements

Infer intent from the request and repository context. Carry authorized implementation through to completion, make routine choices autonomously, and preserve unrelated user changes. Ask only when missing information materially affects the outcome or an irreversible external action needs approval. Use effective available tools; optional tooling is not a blocker. Validate proportionately and communicate actual results and limitations clearly.

## Optional extension policy

Keep only Ponytail (`ponytail@ponytail`) and Diagram Design (`diagram-design@diagram-design`) as optional plugins and their bundled skills in Claude Code and Codex. Do not install, import, restore, or enable any other optional plugins, standalone skills, or extension frameworks unless the user explicitly requests it. This includes automatic imports from the other tool and shared skills. Preserve application-required built-in capabilities and independently configured MCP servers.

Run `~/.local/bin/audit-agent-extensions` for an on-demand, read-only extension audit. Backups live outside discovery directories in `~/.local/state/extension-cleanup/`.

## Repository architecture

This Bun/TypeScript workspace contains UNO and Catan. SvelteKit supplies the browser SPA; Bun and Socket.IO own authoritative in-memory rooms. Use Paraglide for English/Spanish localization and CSS/SVG/Svelte for visuals. No Rust/Wasm, database, Redis, accounts or WebRTC belongs in this catalog. The explicit migration request supersedes the previous Rust-primary instructions; [ADR 009](docs/adr/009-typescript-catalog.md) records the decision. [ADR 010](docs/adr/010-bun-runtime.md) replaces pnpm/Node with Bun package management and runtime.

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
