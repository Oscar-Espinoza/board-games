# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Also read `AGENTS.md`: it holds the binding engineering constraints (Rust owns all game logic, no
JS game engine, rules stay free of DOM/network/persistence, no premature universal framework).
Design decisions live in `docs/` — [architecture](docs/architecture.md), the ADRs under `docs/adr/`,
[CATAN contract](docs/games/catan.md), [Color Match rules](docs/rules.md),
[validation record](docs/validation.md), [deployment](docs/deployment.md).

## Commands

```sh
make dev            # build web package + run table-server on 127.0.0.1:8080 (PORT overrides)
make build          # release browser packages into web/assets/<game>/<hash>/
make check          # everything below except check-turn
make check-rust     # fmt, workspace clippy/tests, wasm32-unknown-unknown + wasm32-wasip2 clippy
make check-replay   # builds replay crates native + WASI, diffs against golden fixtures
make check-browser  # node transport tests, fixtures build, Playwright in all three browsers
make check-turn     # room suite forced through a disposable local coturn (needs coturn installed)
```

Focused runs:

```sh
cargo test -p catan                       # one crate
cargo test -p catan -- name_of_test       # one test
pnpm test:e2e --project=chromium          # one browser project
pnpm exec playwright test tests/browser/catan.spec.js --project=chromium
python3 scripts/check_replays.py          # after building color-match-replay native + wasip2
python3 scripts/check_catan_replays.py
```

Playwright starts `target/debug/table-server` itself on port **8081** (`TEST_PORT` overrides), so
build that binary first. `make check-browser` builds the Wasm with the `fixtures` feature (seed and
restart hooks); run `make build` afterwards to restore a production package. Node/pnpm are test
tooling only — never move runtime logic into them. Toolchain: Rust with the `wasm32-unknown-unknown`
and `wasm32-wasip2` targets, `wasm-pack` 0.15.0, Wasmtime, Node 24, pnpm 10.12.4, Python 3.

## Architecture

Two independent games — Color Match (2–8 players, bots) and CATAN (3–6 humans, no bots) — share a
generic table stack. The layering matters more than the file list:

- **Rules crates** (`color-match`, `catan`): private canonical state, explicit RNG, `Game::new(seed, config)`
  / `Game::apply(player, action)` / `Game::view_for(player)`, plus validated privileged checkpoint
  export/import. No public state fields, no general Serde derive that could leak as a snapshot.
- **Session adapters** (`table-session` + `color-match-session`, `catan-session`): generic
  browser-host authority — epochs, round IDs, monotonic per-seat action IDs, deduplication high-water
  marks, pauses, per-recipient event filtering, privileged host handoff.
- **Shared plumbing**: `table-types` (seat identity only), `table-protocol` (transport **v4** envelopes,
  signaling, game registry), `table-browser` (`room_client!` connection lifecycle for both browser crates).
- **Server** (`table-server`): Axum/Tokio, serves the static site and authenticated ephemeral signaling
  from one origin, issues TURN credentials. No database; rooms are in-memory and expire after four hours.
- **Browser crates** (`color-match-web`, `catan-web`): Rust does the DOM rendering and UI events from
  snapshots; `catan-web` renders terrain with wgpu. JS (`web/table/transport.js`, `web/color-match/color-match-motion.js`,
  `web/color-match/bridge.js`, loaders) only wraps WebSocket/WebRTC, animation overlays and audio.
- **Replay crates** (`color-match-replay`, `catan-replay`): privileged stdin/stdout commands built both
  natively and as WASI Preview 2 components, checked byte-for-byte against golden fixtures.

Authority is peer-to-peer with a host browser: guests send action envelopes over host-centred WebRTC
DataChannels, the host applies rules and returns an individually filtered snapshot per recipient.
The server never sees game state. Replay seeds and all-seat outputs are privileged — never send them
to guests, and keep every snapshot path per-recipient.

Version axes are independent and easy to confuse: **transport protocol v4** (rejects v3 clients),
**Color Match rules/replay v2** (fixtures under `tests/fixtures/v2/`; v1 fixtures are retained but
rejected), and content hashes for asset releases.

## Packaging

`scripts/build_web.py` compiles each game with `wasm-pack` in a temp dir, hashes every runtime file
(Wasm, JS, CSS, CATAN's SVG artwork), publishes `web/assets/<game>/<hash>/`, then atomically writes
`web/games/<game>/index.html` from the matching `site/<game>.html` template with `__ASSET_BASE__`
substituted. Hashed assets are immutable; entry pages and `/catalog.json` revalidate. Keep old asset
directories so in-flight clients can finish loading. `/` is a catalog that initializes no game runtime;
each game page loads exactly one release and games never share a bundle. `--game <name>` builds one game.

## Conventions

- Rust 2024 edition, workspace-wide `-D warnings` under Clippy; run `cargo fmt --all` before finishing.
- Crate tests live in `src/tests.rs` inside the crate they cover; browser specs in `tests/browser/*.spec.js`;
  the only Node test is `tests/transport/bridge.test.cjs`.
- Both lockfiles (`Cargo.lock`, `pnpm-lock.yaml`) and all replay fixtures stay checked in.
- Validate against the affected targets and record results in `docs/validation.md`; when a decision
  changes, update the ADR/architecture doc and `AGENTS.md` in the same change.
