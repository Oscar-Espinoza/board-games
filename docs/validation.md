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

Install the browser binary required by the Playwright configuration with `bun --bun playwright install --with-deps chromium webkit` when it is unavailable. Build first with `bun run build`; Playwright starts the built server automatically on port 3100 (`TEST_PORT` overrides it). Browser integration checks cover all six game tables, room creation and joining, token-based reconnection, recipient privacy, lazy game loading, and English/Spanish UI. Inspect the current test configuration for server setup and ports.

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

## Carcassonne Big Box 3.1 — September 11, 2026

Added the 2–6 player catalog game, all eleven selectable modules, game-owned
readiness, original SVG landscape, connected-feature inspection, pan/pinch/zoom,
keyboard placement, distinct gesture-unlocked sounds, and English/Spanish controls.
`/practice/carcassonne` offers an 18-draw learning game, ordinary full setup and
focused expansion situations, automatically following the next required seat.

The complete rule/session/development suite passed 112 tests before the last
capacity/topology fixtures were added. The final Carcassonne-specific run passed
49 tests, including Full Big Box matches with two, three and six seats. Three
additional room/socket tests cover readiness after disconnection/replacement,
action deduplication, stale revisions, impersonation, recipient privacy and
restoration of a pending meeple choice. Inventory checks cover all 2,048 module
combinations. Focused cases include all eight Messages, 3.1 unfinished scoring,
builder consumption, pigs/farmer return, distinct-city field scoring, ferry graph
splits, shared gold order, flight misses without rerolls, magic modifiers,
Crop Circle order, score-track wrapping and non-chaining robbery.

TypeScript/Svelte checks passed with zero errors and warnings. The production
build and repository formatting check passed. The full Chromium/WebKit suite
passed **65 browser checks**, with the existing native Catan pinch test skipped on
WebKit. Carcassonne's six journeys cover a completed short practice game and
reset, phone/keyboard/zoom/reduced motion, shared multiplayer setup and reconnect,
expansion prompts, distinct Web Audio activation and unavailable/muted audio,
and Spanish phone setup. All 12 Carcassonne browser checks passed again after the
final ferry-connection and topology corrections. Catalog checks now
also assert that Carcassonne does not load eagerly.

The downloaded WebKit browser initially lacked libavif16. The temporary local
wrapper described above was recreated with extracted libavif16, libgav1 and libyuv
packages, without system installation. Use
`WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit` on this machine. These are
browser-test dependencies only. Desktop, phone and Spanish screenshots were
inspected; audio instrumentation checks actual source activation and differences,
not subjective speaker quality.

Actual macOS/iOS Safari, native Carcassonne two-finger device interaction, a real
group Expanded Classic/Full Big Box playtest, and an independent printed-tile
geometry audit remain **unverified**. The [rules document](games/carcassonne.md)
records deterministic app conventions for unresolved combined timing. Automated
seeded games are not a substitute for those checks.

### Carcassonne interaction revision

The landscape now fills the viewport with seats around it. Physical hand controls
replace the sidebar; picking up a tile or meeple reveals only its legal targets.
A tile drop remains a local preview, with rotation/confirmation beside it. Invalid
and cancelled drags return without advancing canonical play. Settings contains
sound, camera, history, locale and practice controls. A separate field guide covers
turns, scoring, figures and expansions. All sound cues now use
broad filtered noise textures, with no pitched oscillators or rotation tail beep.

The revision passes `bun run check`, `bun run build`, `bun run format:check`, and
all 119 rules/server tests. Chromium and WebKit cover eleven Carcassonne journeys:
complete practice/scoring/reset; phone layout and settings; host-owned shared setup
and multiplayer reconnect; expansion choices; audio source activation, mute and
unavailable audio; Spanish; warm setup cards, bare controls, field guide and piece
tooltips; the live board overview and feature focusing; physical tile/meeple dragging
with invalid return and in-place rotation; cancelled gestures; and touch
selection/placement. All 22 Carcassonne checks passed in Chromium and WebKit. Drag
checks use real browser mouse input; touch checks use browser touchscreen taps.
Native device touch dragging and final Safari/audio listening still need
physical-device validation. Desktop and phone screenshots were visually inspected.
A drag-test seat-position assertion was corrected to tolerate subpixel CSS rounding
rather than requiring exact strings.

Host ownership is enforced through server-supplied action context rather than a
client field. Focused rules tests cover guest rejection and configuration after
host transfer. The six Chromium catalog journeys passed after the shared contract
change and again after the overview addition. Setup, guide and overview screenshots
were inspected at desktop and 360px widths.

The broader catalog run passed its other journeys, but the existing six-player
Catan test timed out waiting for `End turn` after rolling. A focused retry passed
in Chromium and timed out in WebKit. This unrelated browser journey is not claimed
as passing for this revision; Carcassonne's own checks passed in both engines.

## Illustrated library and rulebooks — September 11, 2026

The catalog now uses three original illustrated game boxes and Start/Summary/Rules
controls. The rulebooks contain 78 English/Spanish lessons, each with three
manually selected frames. [Coverage and sources](games/library-guide-coverage.md)
record the connection to the current rules. The guides load independently of game
boards, rules engines, bots and practice fixtures.

Validation performed for this change:

- Full Bun suite: 125 passing rules/server/content tests. The six new content and
  numerical-example checks also passed after the final lesson additions.
- TypeScript/Svelte checks passed with zero errors or warnings; production build
  and repository formatting checks passed.
- Library and catalog journeys: 30 passing Chromium/WebKit checks after fixes,
  including every scenario, all three room/practice flows, bilingual search,
  keyboard/focus, touch, reduced motion, guide-load recovery and stale imports.
- After correcting Catan's production illustration to show both existing buildings
  before the roll, both Catan rulebook journeys passed again. Type checks, build,
  and formatting also passed for the final source.
- The full 94-case browser sweep initially reported 90 passing, three failures and
  one existing skip. The failures were the stale six-player Catan test's removed
  robber-location menu and guide import recovery in both engines. The targeted
  30-case rerun passed after these were fixed. The remaining 63 game checks passed
  in the full sweep; Catan's CDP-only two-finger pinch test remains skipped in WebKit.
- Desktop 1440×900, tablet 768×1024 and phone 360×800 screenshots were inspected in
  Chromium and WebKit. The selected boxes, dialogs, summaries and rule scenarios
  remain readable without horizontal overflow. Preview images were saved outside
  the repository in the task's visualization directory.

Browser verification used Playwright's owned server on port 3100. The initially
present user server on port 3000 was not terminated by the agent. All owned test
servers stopped; a final listener check confirmed ports 3000 and 3100 were empty.
Actual Safari hardware testing remains manual; WebKit automation does not replace it.

## Azul, Codenames and Sushi Go Party — September 12, 2026

This delivery lives on `integration/three-games` in the isolated integration
worktree. Implementation stayed isolated from the original checkout. Per-game planning,
implementation and independent High review handoffs live in [handoffs](handoffs/).
[Combined visual evidence](evidence/integration/README.md) links actual table
screenshots and motion recordings. The library contains 118 lessons across six
games with English/Spanish frames; practice routes use separate deterministic
fixtures and the real rules.

Shared coverage includes coded stale/match failures, authenticated private
synchronization, original-ID retries with at most three attempts, lost replies,
passed hands, setup changes and mutable reactive selections. Azul drafts and
Codenames guesses never retry automatically. Game suites cover complete seeded
matches, scoring, invalid intentions, recipient payload privacy, reconnect,
seat replacement, host migration and rematch. Sushi includes every standard box
card, all eight presets and advanced chained choices; documented app conventions
are distinguished from verified publisher rules.

After all three independent reviews were integrated, the final combined
rules/session/content suite passed **263 tests with 53,401 assertions**. Frozen
installation, type/Svelte checks (zero errors/warnings) and the production
frontend/server build passed. Repository formatting passed after the final
evidence/documentation update.

The broad combined browser sweep ran 126 checks: **123 passed, one inherited
WebKit pinch case was skipped, and two Chromium catalog checks failed** because
they assumed every Board retained a source-path manifest key. Codenames and Sushi
can compile as shared chunks. The assertion now identifies all six Board chunks;
the two corrected Chromium cases passed, as did their WebKit counterparts. Every
game's main browser journeys and the existing UNO/Catan/Carcassonne/library
regressions passed. The new illustrated-guide journey was held until Sushi's
authored scenes landed.

Final affected verification against the rebuilt combined branch passed **14
Chromium/WebKit checks**: ten cover complete Sushi matches/rematches, eight-seat
advanced play, saved private choices, locale continuity and the new bilingual
guide/practice journey; four walk all 26×3 Sushi frames in both languages and
verify actual movement paths, audio activation and interruption cancellation.
Across the broad sweep, corrected catalog reruns and final affected runs, all
**132 configured browser cases are accounted for: 131 passed and one skipped**.
This is coverage across those runs, not a claim of a separate final unfiltered run.

Desktop 1440×900, tablet 768×1024, phones 390×844 and 360×640, plus Codenames
320px and Sushi landscape, have inspected captures. The short-phone Sushi review
corrected actual region overlap and added non-overlap assertions. Motion records
are real browser video; privacy checks inspect actual recipient socket payloads.

The combined browser sweep uses isolated temporary browser installations to avoid
cache cleanup by unrelated sessions:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/board-games-three-games-browsers \
WEBKIT_EXECUTABLE=/tmp/board-games-three-games-browsers/webkit \
TEST_PORT=3110 bun run test:e2e
```

The wrapper supplies locally extracted WebKit codec dependencies; it is specific
to this test machine and is not shipped as an application requirement. Browser
journeys use independent clients and real in-memory rooms, plus explicitly local
practice fixtures. The inherited Catan native pinch case remains skipped in
WebKit because that test uses Chrome's CDP touch interface.

Physical macOS/iOS Safari, human group playtesting, subjective speaker listening
and fluent Spanish review remain **unverified**. Automated complete matches,
audio-source instrumentation and WebKit checks do not establish those outcomes.

### Original checkout audit

During implementation, `main` advanced independently to `7d69ad1` ("Carcassone
added, catan improvements added") and the original checkout became clean. Its
tree is exactly identical to baseline `4eb18bb`: `git diff 4eb18bb 7d69ad1` is
empty. Consequently its index/status differ from the initial dirty-checkout audit,
but no captured source content differs. The integration branch records that main
commit as an ancestor without changing its integrated tree. The original checkout
is not reset, switched or rewritten by this delivery.

### Final cleanup

Every server opened for this delivery has stopped. The final listener audit found
no process listening on allocated backend ports 3011–3013, frontend ports
5181–5183 or browser ports 3110–3113. The original checkout remains clean on
`7d69ad1`; its source tree still exactly matches the captured baseline. The
completed integration is committed separately on `integration/three-games`.
