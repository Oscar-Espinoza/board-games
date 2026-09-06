# Validation record

Observed locally on Ubuntu 24.04.4 LTS, 2026-09-05–06. These are tested versions,
not a frozen toolchain requirement.

| Tool | Version |
| --- | --- |
| Rust / Cargo | 1.98.1 |
| wasm-pack | 0.15.0 |
| Wasmtime | 48.0.1 |
| Python | 3.12.3 |
| Node / pnpm | 24.20.0 / 10.12.4 |
| Playwright | 1.63.0 |
| Chromium / Firefox | 153.0.8010.12 / 155.0 |
| WebKit | 26.6, Playwright build 2359 |
| coturn | 4.6.1 |
| Docker | 29.7.2 |

## Browser CI and reconnection reliability (2026-09-06)

CI uses one browser worker, including the local TURN harness, following
[Playwright's CI recommendation](https://playwright.dev/docs/ci#workers).
CI budgets are 60 seconds normally, 120 seconds for eight-human and full-round
rematch tests, and 60 seconds for failed handoffs. Local budgets and the product's
15/60/120-second deadlines are unchanged. `ALSOFT_DRIVERS=null` selects OpenAL's
[null output backend](https://raw.githubusercontent.com/kcat/openal-soft/master/docs/env-vars.txt)
on CI; audio synthesis, mute and unavailable-audio coverage remain enabled.

`node --test tests/transport/*.test.cjs` runs deterministic production-bridge
regressions with controlled sockets, peers and retry scheduling. It is included
in `make check-browser`. Room tests attach timestamped socket, peer, ICE,
signaling-state and DataChannel transitions before closing contexts. These
attachments contain event types and local connection indices, never credentials,
SDP, checkpoints or hands. Normal-speed mouse/touch tests verify creation,
320ms duration, completion, visible arrival and cleanup; controlled-time tests
retain exact lift, midpoint and destination geometry assertions. The eight-human
capacity/privacy test checks each draw button is enabled, then dispatches the
DOM click through the Rust handler (as the full-round test does). This avoids
waiting for pointer stability frames in throttled background WebKit pages;
real pointer and touch input remain covered by the interaction tests. Its CI
turn-readiness and final-revision waits allow 20 seconds for eight-context
snapshot convergence, within the unchanged 120-second overall budget; local
assertion waits remain five seconds.

### Local results

- Final `CI=true ALSOFT_DRIVERS=null make check` passed formatting, native and
  target Clippy, Rust tests, native/WASI replay comparisons, eight transport
  regressions and **100 browser tests with two intentional interoperability
  skips**. No failures or flaky results.
- Final `CI=true ALSOFT_DRIVERS=null make check-turn` passed **43 production
  room tests with two intentional skips**, across all three engines through
  local coturn. No failures or flaky results. The workspace retains the
  production browser package.
- A lobby leave/rejoin regression passed **15 times** (five per engine) with
  retries disabled. It covers stale readiness after seat removal and host
  signaling availability. The signaling regression also checks delayed clears
  after bot seat reuse, rejection of absent-seat readiness, and host-only access.
- Eight deterministic transport regressions passed, covering authentication
  delays, failed/unsent offers, stale socket and peer callbacks, queued ICE work,
  authority changes, lobby departure cleanup and recovery of an open channel.
- Firefox passed all **30 direct** and **30 forced-TURN** reconnect cases:
  ten repetitions each of live-authority reconnect, failed offer and delayed
  authentication, with retries disabled.
- After the hosted trace investigation, the adjusted WebKit eight-human test
  passed **five direct and five forced-TURN runs**, with retries disabled.
- WebKit passed **10 normal-speed animation cases**: five repetitions each of
  mouse desktop and touch mobile, with retries disabled.

The stress checks used `CI=true ALSOFT_DRIVERS=null` and the existing local
WebKit/coturn paths shown below:

```sh
pnpm exec playwright test tests/browser/rooms.spec.js --project=firefox \
  --grep reconnect --repeat-each=10 --retries=0
python3 scripts/check_turn.py --project=firefox \
  --grep reconnect --repeat-each=10 --retries=0
pnpm exec playwright test tests/browser/game.spec.js --project=webkit \
  --grep 'normal speed' --repeat-each=5 --retries=0
```

### Hosted results

The first follow-up [GitHub run](https://github.com/Oscar-Espinoza/board-games/actions/runs/34014448428)
for `fe4ae22` passed Rust/WASI/replay checks and 96 browser tests, with two
intentional skips. The eight-human WebKit case exceeded its 120-second budget
on both attempts. The trace showed continued turn progress, with up to 7.7
seconds spent waiting for pointer stability before a single draw. This led to
the targeted DOM-action change above, retaining the 120-second CI budget.
Chromium, Firefox and the revised animation tests passed without flaky results.
The failed browser step prevented this run's TURN step from starting.

The second [GitHub run](https://github.com/Oscar-Espinoza/board-games/actions/runs/34015548741)
for `297c2ff` passed 99 browser tests with two intentional skips. The eight-human
WebKit case finished within the overall budget but failed its five-second
turn-readiness assertion. The trace retained open host channels and showed
the expected next-turn snapshot immediately after that assertion expired.
This led to the focused CI convergence wait above. TURN again did not run.

## Invitations, capacity and deliberate handoff (2026-09-06)

- `make check` passed: native formatting/Clippy/tests, browser/WASI Clippy,
  native/WASI golden comparisons, and **91 browser tests with two intentional
  duplicate interoperability skips** across Chromium, Firefox and WebKit.
- `make check-turn` passed **34 room tests with two intentional skips** using
  the production package and disposable local coturn relay in all three engines.
- Rust verification passed **26 tests** (13 rules, one golden integration,
  five authority and seven signaling tests), including the final focused
  missed-UNO/checkpoint continuation test.
- Checkpoint continuation matches uninterrupted canonical game/RNG state after
  every action in all four fixtures. Tests cover deduplication, epoch rejection,
  disconnect-age rebasing, immediate departure replacement, reclaim and bounds.
- Server tests exercise concurrent bot/human admissions, capacity reductions,
  two-human starts below capacity, active-round protection, nonzero host IDs,
  transfer participants/attempt binding, failed readiness, timeout/retry,
  former-host credentials and departure without a successor.
- Browser coverage includes repeated live handoffs, checkpoint delivery only to
  the successor, unchanged hands/turns, former-host rejoining, failed checkpoint
  delivery with retry, lobby promotion, invitation fragment navigation, mobile
  keyboard interaction, clipboard success/fallback and retained preferences.
- Deterministic presentation setup now uses the Rust `fixtures` feature. The
  production build excludes its exports, controls and startup behavior.
- Final production checks passed nine additional reconnect, repeated-handoff
  and mobile navigation cases across all engines. The mobile lobby screenshot
  was reviewed; production fixture exports/controls were confirmed absent,
  and local documentation links resolve. The workspace retains a production
  browser package.
- WebKit used the existing temporary executable and library-path wrapper below;
  the default system installation still lacks its documented libraries.

Full check commands:

```sh
WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit \
LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu \
make check
WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit \
LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu \
TURN_SERVER_BINARY=/tmp/board-games-browser-deps/root/usr/bin/turnserver \
make check-turn
```

## Visible card travel and centered UNO (2026-09-06)

- `make check-rust` passed.
- `make check-browser` passed **70 tests with two intentional interoperability
  skips** using the existing WebKit wrapper and library path documented below.
  The default WebKit launcher still lacks `libavif.so.16`.
- Coverage includes default animations with desktop reduced motion enabled,
  persistent animation opt-out, immediate flight cleanup, independent sound,
  65ms lift and 320ms arrival geometry, and centered UNO with catch controls
  visible and hidden at desktop/mobile widths.
- Mouse desktop and touch mobile plays from a scrolled hand were sampled at
  normal speed in all three engines. Lift, midflight and mobile arrival
  screenshots were reviewed. Existing keyboard, draw privacy, focus,
  restart and reconnect checks passed. Verification servers stopped afterward.

## Card presentation update (2026-09-06)

- `make check-rust` passed; release browser build passed.
- The expanded browser suite passed **55 tests with two intentional skips** across
  Chromium, Firefox and WebKit. Coverage includes captured play/draw geometry,
  arrival visibility, full card appearance, cancellation, own/opponent penalty
  draws, privacy, touch, keyboard, scrolling, reduced motion, mute persistence,
  unavailable audio, duplicate snapshots and clean connection text.
- Real OfflineAudioContext rendering in all three engines verified a nonzero,
  quiet signal and silence after the 220ms envelope. Desktop/mobile midflight
  screenshots were visually reviewed. Subjective listening remains unverified.
- A focused Chromium forced-relay private-room check passed using nonvisible
  `data-transport` diagnostics.
- Default `make check-browser` encountered the documented missing WebKit library.
  The final complete suite used the existing local wrapper and isolated output:

```sh
WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit \
LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu \
TEST_PORT=8085 pnpm exec playwright test --workers=3 --output=/tmp/board-presentation-final
```

Concurrent Playwright invocations must use separate output directories and ports;
sharing the default artifact directory caused teardown errors during verification.
A WebKit send/disconnect race also surfaced: the transport now closes a channel
when sending throws, allowing the existing disconnect/reconnect handling to run.

## Final results

- Rust formatting and Clippy passed with warnings denied: all native workspace
  targets, browser `wasm32-unknown-unknown`, and replay `wasm32-wasip2`.
- Native tests passed: 11 rules tests, one golden integration test covering four
  fixtures, three host protocol tests and three signaling/session tests.
- `make check-replay` passed: native and actual WASI component execution match
  all four v2 goldens byte-for-byte. Both runners reject malformed, incomplete,
  unsupported and illegal inputs. All six historical v1 files remain byte-for-byte
  unchanged; v1 inputs are explicitly rejected.
- Release `make build` passed. Actual browser Wasm matches native replay views at
  every accepted action through two complete games, including keyboard activation.
- Final direct browser suite: **37 passed, two intentional skips**. The skips are
  duplicate invocations of the Chromium/Firefox interoperability test, which runs
  once under the Chromium project. All three browser engines completed solo,
  eight-human-context, mixed human/bot, private-view, stale/duplicate action,
  guest reload, live-host reconnect, temporary-bot reclaim and rematch checks.
- Forced local TURN room suite: **19 passed, two intentional duplicate skips**,
  across Chromium, Firefox and WebKit, including cross-engine play. The selected
  candidate is asserted to be `relay`. The disposable `scripts/check_turn.py`
  harness also passed a focused authenticated-room run and cleaned up its relay.
- Docker build passed. A local container served `/healthz` and loaded the actual
  Wasm, with a stock click advancing the game revision. No public deployment ran.
- Visual review covered desktop and an eight-seat 390×844 table. A separate
  touch-enabled Chromium context at 360×640 accepted a stock tap and had no page
  width overflow. A compact seat layout was visually checked at that height to
  keep opponent fans clear of neighboring avatars. Browser tests cover horizontal hand scrolling, 44px minimum
  card/stock targets, visible keyboard focus, reduced motion, stable seat/pile
  nodes and cancellation of obsolete animation overlays.
- Local documentation links resolve. Cargo and pnpm lockfiles are retained.

The Rust/replay checks and final browser suites were run as focused commands;
these results do not imply that the default system can launch WebKit without
its missing libraries. Remote CI has been configured but was not executed here.

## Browser system dependencies on this host

Default WebKit launch initially failed because `libavif16` was absent. Rather
than installing system packages, the session downloaded Ubuntu packages with
`apt-get download` and extracted them under `/tmp/board-games-browser-deps/`.
WebKit also needed the package dependencies `libgav1-1` and `libyuv0`.
A temporary executable wrapper set the WebKit bundle paths and library search
path; the bundled launcher otherwise replaces `LD_LIBRARY_PATH`.

The final direct run was:

```sh
WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit \
LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu \
pnpm test:e2e --workers=3 --output=/tmp/color-match-direct-final
```

Those temporary files are local verification aids, not committed runtime
requirements. A normally provisioned machine should use:

```sh
pnpm exec playwright install --with-deps chromium firefox webkit
make check
```

During integration, a WebKit hang was isolated to CSS transitions while focused
hand state changed. Hand states now change immediately; 300ms Web Animations
still provide card travel. The failing replay passed three focused repetitions
and the final full suite. Early ICE candidates were also found to race SDP;
signaling now queues outgoing candidates until the description has been sent
and processes incoming signaling sequentially. Forced relay tests exercise that
ordering in all three engines.

## Repeatable local TURN checks

Install coturn, then run `make check-turn` after normal browser dependencies are
available. The harness starts a disposable relay bound only to loopback, uses
random test credentials, forces relay transport on both browsers, runs the room
suite and terminates the relay. It never calls a cloud provider.

Defaults: TURN port 3479, relay ports 50000–50100, browser server port 8081.
Use `TURN_TEST_PORT`, `TEST_PORT` and `TURN_SERVER_BINARY` when needed. The local
Firefox test configuration enables its loopback ICE preference only when
`LOCAL_TURN_TEST=true`; production browsers need no modified preferences.

For a focused check with the unpacked binary used in this session:

```sh
TURN_TEST_PORT=3480 TEST_PORT=8083 \
TURN_SERVER_BINARY=/tmp/board-games-browser-deps/root/usr/bin/turnserver \
LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu \
python3 scripts/check_turn.py --project=chromium -g 'private invite'
```

The full three-engine relay run used the same loopback coturn settings, temporary
WebKit wrapper and `LOCAL_ICE_SERVERS` pointing at the disposable relay. A local
TURN allocation and cross-engine gameplay do not verify Cloudflare billing,
public HTTPS, or connectivity between separate networks.

## Coverage and fixtures

Rules tests exercise 2–8-seat dealing/conservation across 100 seeds per size,
stable arbitrary seat IDs, turn direction, two-player Reverse, Skip, every
allowed/prohibited penalty response, Wild color selection, final-card wins,
optional draws, recycling/exhaustion, UNO declarations/catches and race windows,
view filtering, deterministic bots and rejection without state/RNG mutation.
Deterministic bot games finish for 20 seeds at every supported table size.

Host/server tests cover action high-water deduplication, stale revisions/rounds,
forged sender fields, capacity, host-only controls, admission locks, independent
reconnect credentials, socket-generation replacement, 60/120-second policies,
temporary bot invalidation and room expiration. Browser traffic inspection checks
recipient hands, public draw events and absence of credentials or privileged
state fields. Full games and rematches use DOM actions over actual DataChannels.

The v2 fixtures are `seed-07`, `seed-19`, `eight`, and `recycle`. The recycling
fixture drains the starting stock before deterministic play. Generate new
reviewable inputs with:

```sh
cargo run -q -p color-match --example fixture --locked -- 7
cargo run -q -p color-match --example fixture --locked -- 19
cargo run -q -p color-match --example fixture --locked -- 7 normal 8
cargo run -q -p color-match --example fixture --locked -- 7 drain
```

Golden updates are explicit compatibility changes. Seeds and all-player outputs
remain privileged development artifacts.

## Outstanding public acceptance

Render identity and Blueprint validation both returned unauthorized (HTTP 401).
No Cloudflare TURN credentials or verified zero-spend billing controls were
available. No service was provisioned, no paid resources were created, and the
public HTTPS invite/separate-network/Cloudflare TURN checks remain **incomplete**.
See [deployment](deployment.md) for the prepared configuration and remaining work.
