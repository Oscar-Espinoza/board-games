# Repository instructions

## Project and navigation

This repository is a long-lived monorepo for browser-based board games. UNO or an UNO-like game is a probable first substantial game, but its rules, state model, and interaction patterns must not become universal assumptions for other games.

Before foundational changes, inspect existing code, manifests, applicable instructions, and architecture documentation. Follow established conventions where they exist; do not infer a settled architecture from this document. Use `docs/` for detailed designs and architectural decision records (ADRs) as decisions arise. Add links here to actual documents when created. Do not invent document paths, links, or documentation that does not yet exist.

## Engineering constraints

Rust is the primary implementation language. Implement all core game and domain logic in Rust, with substantial use of WebAssembly in the browser. JavaScript and TypeScript may support browser integration, tooling, and UI glue, but must not duplicate game rules or become the main implementation.

Intentionally explore and use WASI and the WebAssembly Component Model where technically valuable. Distinguish their capabilities and runtime requirements from browser Wasm execution. Choose targets, runtimes, or bridges that fit actual platform constraints, and document those distinctions and tradeoffs when making implementation decisions. Do not assume browser Wasm support implies native support for WASI or components.

Do not shift the main implementation into Three.js or another JavaScript game engine. When rendering is needed, investigate Rust-native and Wasm-compatible approaches and choose on technical merit, considering the game's actual needs.

Keep game rules independent of the DOM, browser APIs, networking, persistence, and rendering. Prefer deterministic, testable logic; make sources of randomness or other nondeterminism explicit and controllable. Develop shared abstractions from demonstrated needs across games rather than building a premature universal game framework.

Separate canonical game state from player-visible information. Never assume every browser may receive hidden information, even if the UI would conceal it. Add persistent storage only for a concrete requirement; multiplayer alone does not justify a database.

Favor correctness, clear boundaries, maintainability, and testability. Optimize performance based on evidence from relevant workloads, not speculation.

## Decisions and agent workflow

Leave crate structure, libraries, tooling, rendering, networking, protocols, servers, and testing details open until concrete work requires a decision. Make routine implementation decisions autonomously within these constraints and the available project context. Search for existing functionality before adding alternatives or duplicating behavior.

Document major decisions and their reasoning in `docs/`, then link the source of truth from this file. Keep detailed designs in those documents so these instructions remain concise. Do not silently overturn established project-wide decisions: explain proposed changes and update affected architectural documentation and instructions together. Preserve unrelated user changes throughout the work.

## Validation

Add appropriate formatting, linting, tests, and validation commands as the project develops. Document actual commands once they are available, including any target-specific requirements. Do not prescribe nonexistent commands or freeze a toolchain during initialization.

After changes, run checks relevant to the affected behavior and targets. Report what was checked, any failures, and checks that were unavailable. For documentation-only changes, review accuracy, concision, references, and scope; application tests do not apply when no application exists.

## Established architecture and commands

- [Exact Color Match rules](docs/rules.md)
- [Architecture](docs/architecture.md)
- ADRs: [execution targets](docs/adr/001-execution-targets.md), [rendering](docs/adr/002-rendering.md), [determinism](docs/adr/003-determinism.md), [multiplayer trust](docs/adr/004-multiplayer.md)
- [Setup and usage](README.md), [validation and tested versions](docs/validation.md)
- [Free deployment and connectivity](docs/deployment.md)

`make dev` builds browser Wasm and runs the Rust site/signaling service on loopback port 8080.
`make build` creates the release browser package. `make check` runs formatting,
Clippy and tests, browser/WASI target checks, native/WASI golden replay
comparisons, and Playwright in Chromium, Firefox, and WebKit. Focused checks are
`make check-rust`, `make check-replay`, and `make check-browser`. `make check-turn` exercises forced
relay through a disposable local coturn service. See README for
Rust targets, Wasmtime, and browser dependencies. Browser checks run an isolated
Rust server on port 8081 (`TEST_PORT` overrides it). Retain both dependency lockfiles and replay fixtures.
