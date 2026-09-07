# Validation record

## Coding-practices cleanup, 2026-09-07

The cleanup uses protocol v5 while preserving Color Match v2 and CATAN v1 rules
and golden replay bytes. Prettier 3.9.6 is exactly pinned; rustfmt retains its
stable defaults. `make check` includes the maintained-web formatting gate.
Transport tests use actual isolated ES modules with Node's required
`--experimental-vm-modules` flag and evaluate the Rust constants exporter.

Focused validation passed 62 Rust tests and ten transport tests. Both replay
scripts also passed under `python -O`, including invalid-input rejection. Copies
run with missing fixture directories failed explicitly with `Missing replay input`
before attempting replay execution.

The first browser run could not launch the installed WebKit because this host
lacked `libavif.so.16`. The documented temporary wrapper and unpacked libraries
were recreated under `/tmp/board-games-browser-deps/`, along with coturn and its
libraries; no system packages were installed. Node subprocesses and wasm-pack's
cache required execution outside the filesystem sandbox.

A WebKit trace exposed a CATAN resize callback reaching Wasm before initialization.
Presentation now receives the module only after initialization resolves. A delayed
Wasm/resize regression and the handoff/rejoin scenario passed three repetitions
each without retries. That scenario's snapshot-convergence and rejoin assertions
now use 20-second readiness waits. The eight-human case also reproduced the
previously documented local five-second readiness limit; three repetitions passed
without retries using its existing CI wait settings. A native lifecycle regression also verifies that a reconnecting successor
recovers its staged authority if the commit event was lost; recovery is bound to the
expected successor, round and next epoch. Full verification uses
`CI=1` for the repository's existing single-worker browser configuration.

`CI=1 make check` passed with the temporary WebKit environment: 182 browser
cases passed and four intentional skips remained (unsupported WebGPU backend
checks and duplicate cross-engine coverage). The run had no flaky/retried cases.
The final missed-commit recovery regression was additionally checked natively
and with browser-target Clippy; relay and production builds include that change.

`CI=1 make check-turn` passed with 83 cases and 16 intentional skips using
only disposable local coturn. Skips cover fixture-only production exclusions,
unsupported WebGPU backends and duplicate cross-engine coverage. No flaky/retried
cases remained. The subsequent `make build` passed. Export-section inspection of
both active Wasm binaries and their JavaScript bindings found no `fixture_*`
exports; both releases include generated protocol v5 constants:

- Color Match: `328ef6f9686f8cd4d306`
- CATAN: `ffa57bc8c9c3a577a50c`

Final full commands used the existing host-specific verification environment:

```sh
export CI=1
export WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit
export LD_LIBRARY_PATH=/tmp/board-games-browser-deps/root/usr/lib/x86_64-linux-gnu
export TURN_SERVER_BINARY=/tmp/board-games-browser-deps/root/usr/bin/turnserver
make check
make check-turn
make build
```

The formatting-only pass is separately reviewable in the local artifact
`/tmp/board-games-cleanup/formatting-only.patch`; its pre-format source archive is
beside it. Existing uncommitted work was retained. Remote CI and deployment were
not run; `render.yaml` only renames the undeployed service configuration.


Observed locally on Ubuntu 24.04.4 LTS, 2026-09-05–07. These are tested versions,
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

## CATAN illustrated table v2 (2026-09-07)

The v2 presentation keeps the Rust rules, protocol v4, recipient views and WASI
replays unchanged. Original artwork, shared Rust layout, sRGB/mipmapped wgpu
materials, retained geometry and semantic DOM controls replace the scrolling
presentation. The rendering decision and artwork provenance were updated together.

- `make check-rust` passed workspace formatting, Clippy, native tests and browser/
  WASI target checks. Follow-up checks cover the final CATAN layout/renderer edits.
- `make check-replay` passed every Color Match and CATAN native/WASI/golden
  comparison, including rejected inputs. The eight CATAN fixtures are unchanged.
- Eight JavaScript transport regressions passed. The existing Color Match and
  shared-room browser suite passed **103 cases, with two intentional skips**,
  across Chromium, Firefox and WebKit with retries disabled.
- New CATAN checks exercise viewport fitting at 1920×1080, 1366×768, 768×1024,
  1024×768 and 390×844; all player counts; original avatars; direct dice activation;
  touch/keyboard piece previews and confirmation; player trades and seat notices;
  development choices; discards and robber decisions; fullscreen denial/entry/
  Escape; reduced motion, independent sound and idle frame suspension; graphics
  restoration; host transfer with open panels/effects; and rematches.
- Screenshot review caught an opaque WebGPU background; the WebGPU path now
  explicitly requests premultiplied alpha (supported by wgpu 26's implementation
  despite its incomplete capability list). WebKit exposed a fullscreen top-layer
  ordering issue; an already-open dialog is re-promoted after entry. The touch
  test exits desktop fullscreen before restoring the specified phone viewport.
- An intermediate concurrent run had a Playwright artifact-stream teardown error
  in the Chromium six-seat capture, after the page assertions. This is distinct
  from a game/renderer assertion; the acceptance rerun uses an isolated output.

- The final direct CATAN sweep passed 47 cases with two intentional backend
  skips; Firefox/WebKit initially failed a test assumption about Escape ordering.
  Firefox's focused correction passed, and both corrected Escape cases then
  passed in the full production relay run. Across those runs, all 49 applicable
  CATAN cases are verified. The catalog's 15 cross-browser cases also passed.
- The production local TURN suite passed **83 cases, with 16 intentional skips**,
  across all three engines, with retries disabled. Skips exclude four privileged
  fixture scenarios per engine and duplicate cross-engine/backend invocations.
  This includes room reconnect/handoff, active panels/effects, all table sizes,
  graphics recovery, fullscreen and actual relay-candidate assertions.
- Final visual review found external SVG icons disappearing at fractional intrinsic
  dimensions. Harbor icons now use full-size SVG images with a shared-coordinate
  transform. Follow-up production composition/WebGPU/asset-retry checks passed
  **7 cases with two intentional backend skips**, across all three engines.
  Two additional Chromium checks refreshed final five/six-seat captures.
- All 31 artwork SVGs regenerate byte-for-byte; the twelve terrain variations are
  distinct. The final production release excludes fixture exports. Docker's build
  context includes the artwork sources; no Docker image or public deployment was
  built in this presentation pass.

### Release and local software-renderer measurements

Measured on the local Intel i7-11700K host, Ubuntu 24.04.4, Chromium 153, at
1280×720 with WebGL2 through ANGLE / SwiftShader Vulkan (software rendering),
4× MSAA. Sixty explicit frame submissions in a three-context production relay
room measured 0.3 ms median and 0.6 ms p95 CPU submission time. Associated browser
RAF intervals were 33.4 ms median and 50 ms p95. These intervals include browser
scheduling/throttling and software rendering; neither metric measures physical
GPU completion or guarantees display frame rate. An idle scene requests no frames.

| Final runtime including artwork | Raw bytes | gzip bytes, offline estimate |
| --- | ---: | ---: |
| Color Match | 1,002,475 | 211,047 |
| CATAN | 7,441,342 | 1,375,046 |

CATAN Wasm is 6,233,195 bytes. The CATAN runtime total includes all 31
packaged SVGs; the catalog requests none of them. Compression estimates sum gzip
per file and do not assert deployment compression. Measurements and reviewed
screenshots were collected locally under `test-results/catan-v2-review/` (ignored
artifacts); browser tests regenerate captures into their selected output directory.

Reproduce the focused browser acceptance with:

```sh
python3 scripts/build_web.py --fixtures
cargo build -p table-server -p catan-replay -p color-match-replay --locked
CI=true ALSOFT_DRIVERS=null pnpm exec playwright test tests/browser/catan.spec.js \
  tests/browser/catalog.spec.js --retries=0 --output=/tmp/catan-v2-review
```

Use this host's WebKit wrapper/environment listed below when needed. Screenshots
and CPU submission JSON are emitted into the chosen Playwright output directory.
They are local verification artifacts, not runtime assets. Physical phones,
physical GPU memory/completion timings, subjective sound review and user visual
acceptance remain unavailable; software-adapter captures do not establish them.

## CATAN implementation (2026-09-07)

- Sixteen Rust rule tests exercise all counts/setups, published starting resources,
  construction, conservation, shortages, seven/discards, robber/theft privacy,
  development effects/timing, route branches/loops/cuts/ties, atomic trading,
  paired opportunities, checkpoint rejection and victory-point revelation.
- Session tests replay complete base and extension games through authority,
  restoring checkpoints and changing host/epoch after every action. Setup binding,
  duplicate requests, recipient snapshots and the no-bot disconnect policy are checked.
- Eight full games finish in 305–971 actions, covering all 3–6-player/setup pairs.
  Native, WASI and golden outputs match exactly, including canonical checkpoints.
- CATAN browser checks: 16 passed, two intentionally skipped (the explicit
  Chromium software-WebGPU test does not run in Firefox/WebKit). Coverage includes
  beginner play, variable keyboard placement, paired turns, deliberate handoff,
  victory/rematch, mobile controls and context recovery. WebGL2 runs in all engines.
- `make check-rust` passed workspace tests, formatting and Clippy, including both
  browser targets and both WASI replay targets. `make check-replay` passed both
  games' fixtures. Eight shared JavaScript transport tests passed.
- Color Match/catalog regression suite: 118 passed, two intentionally skipped,
  across Chromium, Firefox and WebKit, with retries disabled and CI readiness waits.
- Forced local TURN suite: 59 passed, seven intentionally skipped, across all
  three engines with retries disabled. Skips cover the scoring fixture and
  engine-specific tests.
- A final production build excludes scoring/seed fixture exports. Its WebGPU
  and mobile graphics-recovery tests also passed after adding device-loss notification.
- Graphics use original procedural meshes/materials, with no downloaded image set.
  No real-phone GPU memory or animation frame-time measurements were possible in
  this environment. Software GPU success is not a hardware performance result.

### Local release measurements

Production release measured on September 7 using an Intel i7-11700K, Ubuntu,
Chromium 153 and ANGLE SwiftShader (software Vulkan), at 1280×720. The local
server used uncompressed assets. A fresh browser context reached the initialized
CATAN page in 157 ms on loopback. Sixty explicit base-board animation submissions
had median 0.5 ms and p95 1.1 ms CPU submission time. These exclude asynchronous
GPU completion and are **not** end-to-end frame-time or physical GPU benchmarks.

| Runtime files (Wasm, JS, CSS) | Raw bytes | gzip bytes, offline estimate |
| --- | ---: | ---: |
| Color Match | 1,002,475 | 211,047 |
| CATAN | 6,310,912 | 1,266,605 |

CATAN Wasm alone is 6,162,989 bytes. Catalog visits request neither Wasm artifact.
Compression estimates sum gzip output for each file; they do not assert that a
particular deployment negotiates compression. Physical-phone startup, GPU memory
and frame-time measurements remain outstanding.

## Catalog and protocol v4 foundation (2026-09-06)

This historical pass validated the catalog and Color Match migration only.
CATAN was implemented in the subsequent September 7 pass below.

- `make check-rust` passed formatting, native/target Clippy and the Rust suite.
  The added game-binding test initially exposed a missing resume check; that was
  fixed before the successful run. Follow-up Color Match adapter tests and Clippy
  passed, including checkpoint restoration with nonconsecutive IDs above seven.
- `make check-replay` passed all four native/WASI/golden comparisons and invalid
  input cases after the shared identity extraction. Fixtures are unchanged.
- Eight deterministic transport tests passed after extracting presentation.
- The direct browser suite ran 117 cases: 114 passed, two intentionally skipped,
  and WebKit's eight-human test exceeded the existing local five-second readiness
  wait. The targeted test passed with `CI=true`, retries disabled and the existing
  20-second CI readiness allowance. No product deadlines or tests were relaxed.
- The default WebKit launcher initially failed before test execution; use the
  existing local `WEBKIT_EXECUTABLE`/`LD_LIBRARY_PATH` setup documented below.
- Production forced-TURN coverage completed across all three engines: 45 passed,
  two intentionally skipped and one Chromium eight-seat case passed on retry.
  That retry was caused by two concurrent test processes writing the same
  Playwright artifact directory (`ENOENT` during context closure), not a room
  assertion. A separate direct run was also affected by that collision. Always
  use distinct `--output` directories when running independent suites concurrently.
  The affected Chromium forced-TURN case subsequently passed in isolation with
  retries disabled (`--output=/tmp/catan-turn-eight`).
- Catalog request capture verifies no game runtime on `/` or the CATAN status
  page; Color Match loads its runtime from exactly one content-hashed release.
  Checks cover immutable asset/revalidated entry headers, legacy invite fragments
  and relay queries, inert failed loading and successful retry, and active-host
  transfer before catalog navigation. These passed in all three browser engines;
  departure also passed through forced TURN.

The workspace retains a production package. Docker packaging was updated for
Python and the source entry template; a Docker image was not built in this pass.

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

Final [GitHub run 34016734013](https://github.com/Oscar-Espinoza/board-games/actions/runs/34016734013)
for `35ed1e5` completed successfully on 2026-09-06. `make check` passed Rust,
WASI, replay and transport checks plus **100 browser tests with two intentional
skips** in 12.3 minutes. `make check-turn` passed **43 production room tests
with two intentional skips** in 9.1 minutes. Both browser suites used one worker,
with **no failed attempts, retries or flaky results**. All three engines,
real direct connections, forced local TURN and audio synthesis remained enabled.
The following documentation-only commit records this result without changing
the verified code or tests.

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
cargo run -q -p color-match --example color-match-fixture --locked -- 7
cargo run -q -p color-match --example color-match-fixture --locked -- 19
cargo run -q -p color-match --example color-match-fixture --locked -- 7 normal 8
cargo run -q -p color-match --example color-match-fixture --locked -- 7 drain
```

Golden updates are explicit compatibility changes. Seeds and all-player outputs
remain privileged development artifacts.

## Outstanding public acceptance

Render identity and Blueprint validation both returned unauthorized (HTTP 401).
No Cloudflare TURN credentials or verified zero-spend billing controls were
available. No service was provisioned, no paid resources were created, and the
public HTTPS invite/separate-network/Cloudflare TURN checks remain **incomplete**.
See [deployment](deployment.md) for the prepared configuration and remaining work.

## Catalog foundation checks

`python3 scripts/test_build_web.py` checks missing inputs, duplicate release filenames,
registration mismatches and optional table dependency agreement; `make check-browser`
includes it. `python3 scripts/build_web.py --validate` validates maintained declarations
and catalog/table agreement without compiling Wasm. `cargo test -p game-catalog --locked`
checks catalog/table modes and player bounds in both directions.
Browser catalog tests cover mode labels, metadata previews, legacy invites, independent
assets, loading failures/retry and a solo startup fixture with no room DOM or transport.
The fixture exists only in test interception. `make build` omits Wasm fixture exports;
`make check-browser` explicitly builds with them for game scenario tests.

Fixture browser builds publish to `target/browser-test-site/`, which Playwright serves
using the server's `WEB_ROOT` override. Production builds and `make dev` continue
to use `web/`; concurrent development cannot replace test fixture pages. TURN checks
set `TEST_WEB_ROOT=web` to exercise the production release.
Normal browser and relay runs also use separate artifact directories under
`test-results/browser/` and `test-results/relay/`, so one suite cannot remove the
other suite's screenshots and traces.

### Foundation verification, 2026-09-07

- Formatting, Clippy (native, browser and WASI targets), 63 Rust tests, ten
  transport tests and six build-validation tests passed. Native/WASI outputs
  matched every existing Color Match and CATAN golden replay.
- The 204-case browser run reported 198 passes, four intentional skips, one
  stale-template-runtime failure and one artifact-cleanup retry. The template
  reference was corrected and its Chromium room test passed without retries.
  Separate browser/relay artifact directories fix the cleanup collision; the
  Firefox layout case then passed three repetitions without retries. All 200
  non-skipped scenarios passed in the broad run or these focused rechecks.
- Production TURN coverage reported 82 passes, 16 intentional skips and one
  readiness-timeout retry. That Chromium handoff/rejoin case subsequently passed
  three forced-relay repetitions without retries. No session timing or authority
  behavior was changed to accommodate the test.
- `make build` passed. Export-section inspection of the active Wasm modules and
  JavaScript bindings found no fixture exports. Both releases contain protocol v5:
  Color Match `22b0045921420812e5a4`, CATAN `695cd23e9a4f844b2b68`.

Verification used the existing WebKit/coturn wrapper and library paths documented
above, with `CI=1`. Relay checks used `TEST_PORT=8082` while the normal browser
server used 8081. An initial development-build collision motivated isolating
fixture releases as well as test artifacts. Existing source work and historical
release directories were preserved; deployment infrastructure was not changed.
