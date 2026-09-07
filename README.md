# The Game Table

Play **CATAN** with 3–6 humans on an overhead tabletop, or **Color Match** with 2–8 players. Both use Rust/Wasm and private WebRTC rooms. Color Match includes: a full-screen felt
surface, animated cards, deterministic bots, UNO calls and private WebRTC rooms.

## Play locally

Install Rust (rustfmt and Clippy), wasm-pack, and the browser/WASI targets:

```sh
rustup target add wasm32-unknown-unknown wasm32-wasip2
cargo install wasm-pack --version 0.15.0 --locked
make dev
```

Open **http://127.0.0.1:8080**, select a game, then create a table.
For CATAN, select 3–6 seats and variable or beginner setup, share the invite,
and start once at least three humans have connected. Five or six players use
the extension and paired turns. CATAN has no bots; disconnected seats pause play.
Click the large dice tray or **Roll dice** to begin. Select a piece in the rack,
choose a highlighted location and confirm. Trade and development choices open
compact panels; phone controls use sheets and an expandable hand. Choose an
animal avatar before joining. The table fills the viewport; the corner menu
contains rules, independent sound/motion controls and an optional fullscreen toggle.

For Color Match, choose **Create room**. Enter a name and
preset avatar, then copy the private invite link. **Room size** selects 2–8
seats including the host and optional bots (default eight). The host can change
capacity before the first round, provided it covers occupied seats.
Start with at least two connected humans and ready game connections; empty
seats need not be filled. Rematches also require two humans. Admissions lock
after the first start. There is no solo mode.

Local invite links work across browser contexts on the same machine. Internet
invites require the [public HTTPS deployment and TURN setup](docs/deployment.md),
which is **not yet deployed**. Render authentication, Cloudflare credentials and
verified zero-spend billing controls were unavailable. No paid services were
created. Local signaling success is not a public connectivity guarantee.

Match the active color, number or symbol; play a Wild and choose a color; or
click the stock to draw and end your turn. +2/+4 penalties can stack under the
[exact version-2 rules](docs/rules.md). Arm UNO when holding two cards, before
playing. Opponents can catch missed calls. Empty your hand to win.

Tab and Enter/Space activate controls; the hand scrolls horizontally on touch or
keyboard. The Card animations switch controls card travel. The toolbar's fullscreen button is
optional; the table already fills the viewport. Rules and room tools use dialogs.

New deals use browser Web Crypto. Sound and card animation preferences persist
locally. Seed and restart controls are available only in the compile-time test
fixture harness; production builds exclude that harness.

## Room lifetime and reconnects

**Back** on setup/invitation forms returns home and clears the invitation.
Closing room controls only dismisses the dialog. **Leave room** is available
in the lobby and during play. Before play it frees the seat and, if necessary,
promotes the earliest-joined connected human.

During play, a deliberate guest departure preserves their hand and seat. In Color Match, the
host can immediately choose **Wait** or **Fill with bot**. An accidental guest
disconnection keeps the 60-second replacement delay. Reopening the invitation
in the same browser tab reclaims the seat and stops its temporary bot.

When the host deliberately leaves, the earliest-joined connected human with an
open game connection receives a privileged checkpoint, including all hands and
future random state. That player becomes the trusted host only after validating
the checkpoint and completing a server-coordinated transfer. The round, hands,
turn order and player IDs remain intact. Preparation times out after 15 seconds;
a failed transfer leaves the host in the room with a retryable error. With no
connected human successor, leaving closes the room. Former hosts retain a
reconnect credential and return as guests.

Keep the host tab open except when using **Leave room**. Unexpected host loss
still allows 120 seconds for the same live browser to reconnect; reloading the
host loses canonical state. There is no saved-game recovery, background
replication or database. Rooms expire after four hours or server restart.

## Build and verify

`make build` creates separate content-addressed releases in `web/assets/<game>/`
and generates `web/games/<game>/index.html` from the corresponding `site/` template.
CATAN includes its original SVG artwork; see [provenance](docs/games/catan-assets.md).
Python 3 is required for this packaging step. The Axum server serves that package, the site,
and signaling from one origin. Rooms require this signaling service.
You can choose a different development port with `PORT=8082 make dev`.

Install Wasmtime, Node 24, pnpm and Playwright dependencies:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
make check
```

`make check` runs formatting, native workspace Clippy/tests, browser and WASI
Clippy, native/WASI golden replay comparisons, release Wasm build and browser
checks in Chromium, Firefox and WebKit. Browser tests use **8081**, independently
of the dev server; override with `TEST_PORT`. Browser checks build with the
`fixtures` feature; run `make build` afterward to restore a production package.
Node/pnpm are test tooling only.
Both dependency lockfiles remain part of the source.

```sh
make check-rust
make check-replay
make check-browser
# With coturn installed:
make check-turn
# After browser/server/replay builds:
pnpm test:e2e --project=chromium
```

Tests cover separate browser contexts, eight humans, mixed humans/bots, private
snapshots, duplicate/stale actions, guest/host reconnects, temporary bot reclaim,
rematches, animations, keyboard controls and narrow screens. See the
[validation record](docs/validation.md) for results, local TURN commands and any
checks needing additional infrastructure. CI runs direct-browser and local forced-TURN suites.

## Native and WASI replay

```sh
cargo build -p color-match-replay --locked
cargo build -p color-match-replay --target wasm32-wasip2 --locked
target/debug/color-match-replay < tests/fixtures/v2/eight.replay.json
wasmtime target/wasm32-wasip2/debug/color-match-replay.wasm < tests/fixtures/v2/eight.replay.json
```

Both produce stable JSON with an initial frame and a frame after each accepted
action, each containing views in roster order. Version 1 is explicitly rejected;
its fixtures remain unchanged as historical artifacts. Malformed or illegal
inputs produce a nonzero exit and no partial output. **Replay seeds and all-seat
outputs are privileged development data; never send them to guests.**

The browser uses `wasm32-unknown-unknown` with wasm-bindgen. The replay runner
uses a distinct WASI Preview 2 command component on `wasm32-wasip2`, executed by
Wasmtime. Browsers do not directly execute WASI commands or components.

Design: [architecture](docs/architecture.md), [execution targets](docs/adr/001-execution-targets.md),
[rendering](docs/adr/002-rendering.md), [determinism](docs/adr/003-determinism.md),
[multiplayer trust](docs/adr/004-multiplayer.md), [deployment](docs/deployment.md).


## Game catalog

`/` is a lightweight catalog; play Color Match at `/games/color-match/`.
Legacy root-level invites redirect there with their secret fragment preserved.
CATAN is playable at `/games/catan/`. See the [CATAN contract and validation limits](docs/games/catan.md).
The catalog never initializes a game runtime. Game entry pages revalidate and
load one immutable, content-hashed release. Retain old asset directories during
rolling deployments so clients with earlier entry pages can finish loading.
Transport v5 rejects older clients; Color Match's rules/replay fixtures remain v2.

Formatting uses stable rustfmt defaults and exactly pinned Prettier 3.9.6, following
its [installation guidance](https://prettier.io/docs/install).
Run `make format` to format Rust and maintained JS/CSS/HTML/configuration files;
`make check-format` checks the latter and `make check-rust` checks Rust formatting.
Generated assets, artwork and golden fixtures are excluded. Transport tests use
`node --experimental-vm-modules --test tests/transport/*.test.cjs`; the flag is
required for [isolated ES-module evaluation](https://nodejs.org/api/vm.html#class-vmmodule). Protocol constants are generated from
Rust as part of every release, not maintained in a separate JavaScript copy.

Maintained browser assets are grouped under `web/color-match/`, `web/catan/`,
`web/catalog/`, `web/shared/` and optional `web/table/`. The `game-catalog` crate
owns discovery independently of room admission. See [catalog and session ownership](docs/architecture.md#catalog-ownership-and-optional-table-sessions).
Validate build declarations without compiling Wasm with
`python3 scripts/build_web.py --validate`; build a single game with
`python3 scripts/build_web.py --game color-match` (or `catan`).
