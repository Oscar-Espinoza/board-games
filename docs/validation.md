# Validation

Run commands from the repository root with Bun 1.4.2 or newer.

| Command                         | Purpose                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `bun install --frozen-lockfile` | Verify the committed workspace dependency graph                                      |
| `bun run check`                 | Compile Paraglide messages, synchronize SvelteKit types, check Svelte and TypeScript |
| `bun run test`                  | Run game-rule and authoritative room/session tests                                   |
| `bun run build`                 | Build the static frontend and Bun server bundle                                      |
| `bun run test:e2e`              | Run Playwright browser integration coverage                                          |
| `bun run format:check`          | Check source formatting                                                              |

Install the browser binary required by the Playwright configuration with `bun --bun playwright install --with-deps chromium webkit` when it is unavailable. Build first with `bun run build`; Playwright starts the built server automatically on port 3100 (`TEST_PORT` overrides it). Browser integration checks cover both game tables, room creation and joining, token-based reconnection, recipient privacy, lazy game loading, and English/Spanish UI. Inspect the current test configuration for server setup and ports.

Rules tests should exercise important legal/illegal moves and victory transitions. Session tests should verify actor binding, reservation expiration, replacement secrets, stale/duplicate actions and recipient projection. Browser tests should validate observable behavior rather than duplicate rule implementation.

This document lists validation commands and expectations, not a claim that a run passed. Report actual results, unavailable checks and intentionally deferred manual observations with each change. The old Rust/WASI and WebRTC validation commands no longer apply to this repository.

## Zombies

Zombies validation belongs to `../zombies-game`. Its independent README and Makefile document Rust/target tests, native/WASI replay comparisons, browser-support tests and graphics diagnostics. Detailed pre-migration Survival evidence and the original source snapshot were preserved during extraction; they do not describe the TypeScript catalog's validation status.

## Migration verification — September 10, 2026

- Frozen workspace installation, TypeScript/Svelte checks (zero warnings),
  production frontend/server build and formatting passed.
- 33 rule/session tests passed, including full Catan games for 3–6 players, UNO
  complete rounds, conservation, illegal actions, token expiry/replacement,
  stale/duplicate actions and real Socket.IO recipient privacy/reconnection.
- Six Chromium browser tests passed: catalog lazy loading and language
  persistence; UNO room creation/join/draw/reload; Catan loading and full snake
  setup/roll; six-player beginner paired turns; Spanish controls during a room.
- At the original migration, `pnpm dev` was smoke-tested by creating a room through the Vite proxy.
- Zombies independently passed a fresh release build of its Rust/Wasm renderer
  and worker, native tests and Clippy, 59 Node tests, 10 Python tests,
  native/WASI replay comparisons and standalone HTTP checks.

Actual tunnel/network conditions between Argentina and Europe, the new catalog
in other browser engines, and Zombies graphics matrices were not rerun.
Old GPU/audio presentation and historical replay compatibility are deliberately
retired from board-games; the retained rules and simpler SVG/CSS UI are tested.

## UNO table and required browsers

Chrome and Safari are required targets; Firefox is optional. `bun run test:e2e`
runs Chromium and WebKit. To exercise installed Google Chrome directly, use
`CHROME_CHANNEL=chrome bun run test:e2e --project=chromium`. WebKit tests run serially
with a longer timeout for several software-rendered Catan tables. WebKit is not
an actual Safari binary; Safari on macOS/iOS remains a separate device check.

`WEBKIT_EXECUTABLE` optionally selects a compatible local Playwright wrapper.
On this Linux machine the downloaded WebKit binary required libavif16, libgav1
and libyuv. These were extracted locally, with no system package changes; the
current wrapper is `/tmp/board-games-browser-deps/webkit`. It is temporary and
not a runtime requirement for players. Use Playwright's supported system
dependencies in a fresh environment.

UNO browser coverage checks solo creation, four-seat placement, viewport sizing,
card movement between measured endpoints, face-down draw overlays, actual Web
Audio source activation, remembered sound/motion controls, reconnection and
reduced-motion behavior at phone dimensions. Rule/session tests cover bot
privacy, legal choices, completed rounds, scheduling, pause and reconnection.

UNO polish verification (September 10, 2026): 40 rule/session/presentation tests,
TypeScript/Svelte checks, production build and formatting passed. The full
8-scenario browser suite passed in Chromium and WebKit; installed Google Chrome
also passed the four UNO scenarios. After the full-screen language-toolbar fix,
solo effects, phone layout and in-room language switching passed again in Google
Chrome and WebKit. Actual Safari device testing is still unperformed.

## Bun migration and opponent card regression

September 10, 2026: Bun 1.4.2 frozen workspace installation, TypeScript/Svelte
checks, all 40 rule/session tests and production build passed. All 16 browser
checks passed against the built Bun server in installed Google Chrome and
WebKit, covering both games, rooms/reconnect, lazy loading, localization, solo
play, sound and mobile reduced motion. Card-flight checks now verify a portrait
card layout and uniform scaling, including flights to/from opponent seats.
An isolated `PORT=3201 bun run dev` smoke test also passed catalog loading,
Socket.IO proxying, solo room creation and drawing in Chrome on Vite port 5174.
Existing development servers were left running; restart them to use Bun.
Actual Safari device testing remains unperformed.

## Catan island verification — September 10, 2026

59 rule/session/presentation tests passed, including accepted/rejected event
batches, theft/development privacy, repeated identical dice, the reconnect
notification/snapshot race, and all eight finite-inventory practice fixtures.
TypeScript/Svelte checks passed with zero errors or warnings; production build
and repository formatting checks passed.

Google Chrome and WebKit coverage passed for placement preview/cancel/confirm,
city continuity and measured landing motion, dust, production/theft/Monopoly/trade
feedback, drag versus selection, wheel/keyboard zoom, reset, local seat privacy,
Spanish phone sheets, reduced motion, remembered preferences, real Web Audio
activation, rejected offers and reconnection without replay. Existing catalog
lazy-loading, three-player snake setup and six-player paired-turn coverage also
passed. Final focused regressions for reconnect, landing, sound and Spanish phone
layout passed all eight Chrome/WebKit cases after fixes. Desktop and 390×844
phone screenshots were visually inspected.

A separate Chrome CDP two-finger input test passed pinch zoom limits and selection
suppression. WebKit's Playwright interface does not expose equivalent native
multi-touch injection; actual Safari device and pinch validation remain manual.
No competitive bots are part of this work.

## Catan civilization UI revision — September 10, 2026

The fixed island supersedes the previous pan/zoom UI and its pinch tests. Chrome
and WebKit passed the replacement checks for a stationary board under drag/wheel,
cardinal civilization seats, illustrated resource cards/harbors/robber, collapsed
settings with remembered preferences, dice tumbling to authoritative pips, taller
city landings with upgrade continuity, layered impact audio, rejected-action
feedback, phone seat switching and Spanish reduced-motion settings. Existing
three/six-player flows, reconnect-without-replay and catalog lazy loading passed.
A final ten-case Chrome/WebKit run passed the changed visual and seating cases.

All 59 rule/session tests, TypeScript/Svelte (zero warnings), formatting and the
production build passed. Desktop and phone screenshots were reviewed. Audio checks
verify synthesized sources and timing, not subjective loudspeaker quality. Actual
Safari device verification remains manual. Resource-card art is original artwork,
not official printed-card scans.

## Zoom, placement hints and development shutdown — September 10, 2026

60 tests passed, including a development-launcher integration test that starts
isolated frontend/backend ports, sends SIGINT, and verifies launcher exit, closed
ports and removal of both process groups. A real PTY Ctrl+C reproduction first
confirmed the old backend watcher stayed alive; the patched launcher returned to
the terminal and released both ports. The referenced 1.2-second fallback also
handles watchers that ignore graceful shutdown.

Chrome and WebKit passed zoom/reset controls, hidden markers, hover/focus plus
hints, confirmed placement, remembered settings and phone/Spanish behavior. Native
Chrome two-finger input also passed; equivalent WebKit multi-touch injection is
unavailable. Seven focused browser cases passed, with that one WebKit-only skip.
TypeScript/Svelte, production build and formatting passed. Actual Safari device
validation remains manual.
