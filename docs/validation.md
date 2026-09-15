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

Checked-in evidence stays small: commit screenshots as WebP (`cwebp -q 90 -m 6 -sharp_yuv`) and recordings as VP9 WebM (`ffmpeg -c:v libvpx-vp9 -crf 32 -b:v 0 -an`), never raw PNG or Playwright's VP8 output. Keep byte-identical captures once.

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

## Little Secret delivery — September 12, 2026

Little Secret is the seventh catalog game, using Spanish classic 3–9-player rules,
the seven named classic powers, 300 original pairs per language, a 16-lesson
bilingual illustrated guide and eight local training scenarios. See
[game rules and edition scope](games/little-secret.md) and
[ADR 014](adr/014-little-secret.md).

Completed validation:

- `bun install` registered the workspace dependencies; `bun install --frozen-lockfile`
  passed afterward.
- `bun run check` passed with zero Svelte errors or warnings and a clean root
  TypeScript check.
- `bun run test` passed **296 tests across 25 files**. Little Secret coverage
  includes all seat distributions, deterministic randomness, setup authority,
  private views, immutable/weighted voting, Sage and multi-candidate RPS,
  reactions, exact aliases, scoring, retained powers, fresh missions/rematches,
  content structure, bounded history, and minimum/maximum complete matches.
- Independent Socket.IO clients completed 3- and 9-seat matches. Tests verify
  forged actors, competing revisions, duplicate IDs, lost-acknowledgement
  synchronization, private serialized snapshots/sync replies, reconnects during
  votes, a forced RPS tie and a forced Journalist reaction, host transfer,
  replacement credentials, and rematch boundaries. Test clients are paced to
  respect the unchanged production rate limiter.
- `bun run build` passed. Inspection of all **73 production JavaScript assets**
  found none of the **600 production word-pair IDs**. Catalog loading also
  asserts seven Board chunks and no eager game client requests.
- **12 distinct targeted browser cases passed across Chromium and WebKit**, in
  focused runs: 3- and 9-seat complete UI matches, forced RPS/Journalist reconnects,
  envelope concealment, interface-language changes retaining words, local
  reactions and shared victory, illustrated/searchable bilingual guides,
  seven-cover library sizing and lazy catalog loading. This is coverage across
  those runs, not an unfiltered full-catalog E2E run.
- Captures were inspected at desktop 1440×900, tablet 768×1024 and phone 360×640.
  Layout checks assert nine seats, no horizontal overflow and no seat/action
  overlap. A separate phone check verifies the primary action dock stays outside
  the scrolling content. Library checks also include 390×844. Keyboard focus
  return, reduced motion and unavailable audio are exercised.
- A development server on frontend port 5175/backend port 3015 was tested with
  three independent browser clients in **both engines**. Creation, joining,
  dealing and clue advancement succeeded through the `/socket.io` Vite proxy.
- `bun run format:check` and `git diff --check` passed. All servers started for
  this verification were stopped; pre-existing development processes were left
  alone.

Browser command (use the existing machine-specific codec wrapper):

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/board-games-three-games-browsers \
WEBKIT_EXECUTABLE=/tmp/board-games-three-games-browsers/webkit \
TEST_PORT=3114 bun run test:e2e \
  tests/e2e/little-secret.spec.ts \
  tests/e2e/three-games-library.spec.ts \
  tests/e2e/catalog.spec.ts \
  --grep 'independent browser|bilingual illustrated guide|seven|catalog loads no game clients'
```

Initial browser failures exposed missing immersive-header styling, ambiguous
select labels, a mobile sticky-button overlap, an extra desktop catalog row
exceeding the height budget, and decorative guide SVGs with redundant image
roles. These were fixed and the affected cases passed. One intermediate sweep
was invalidated by rebuilding its static assets while it was running; subsequent
focused runs used stable assets and passed. No browser dependency failure was
counted as a pass.

Still manual and **not verified**: physical Safari/iOS, a real group voice/video
playtest, fluent Spanish review, and human ambiguity/difficulty review of both
word collections. Structural uniqueness tests do not establish semantic quality.

## Azul Table Light — September 13, 2026

The corrected Table Light implementation keeps public rules, actions, projections,
accepted events, networking and retry policy unchanged. It adds a phone factory
colour chooser, collision-checked circular supply, explicit compact opponent boards,
scoped materials/fonts, uncapped scores with a decorative rail, and a pure local
accepted-event scoring/cleanup timeline. The first iteration allowed vertical scrolling;
the viewport-fit revision below supersedes that layout.

Validation completed:

- `bun run check`: zero errors and zero warnings; root TypeScript check passed.
- `bun run test`: 316 tests passed, including conserved practice fixtures, five/seven/nine
  factory geometry, final-draft reconstruction, floor-only rounds, capped loss,
  marker return and scores above 100.
- `bun run build`: passed before browser runs.
- `tests/e2e/azul.spec.ts`: 24 journeys passed across Chromium and WebKit. Coverage
  includes 360×640, 390×844, 768×1024, 1100×700, 1440×900 and 720×450; doubled text
  with non-overlapping rail numerals; phone picker keyboard focus/cancel/play;
  crowded-centre controls; unique nonzero anchors; full-size inspection without
  duplicate anchors; actual SVG flight endpoints/scales; staged cleanup; scroll,
  resize, visibility, reduced-motion and dialog cancellation; silent audio fallback;
  English/Spanish; and real two/four-seat acceptance, reconnect and final results.
- `tests/e2e/three-games-library.spec.ts`: four Chromium/WebKit checks passed for
  bilingual guides, practice entry points and all seven unchanged catalog covers.
- The final marker accessibility adjustment was rebuilt, type-checked and checked
  with the 360×640 geometry/interaction journey in both browsers.
- `bun run format:check` and `git diff --check`: passed.

On this machine WebKit first failed to launch because codec dependencies were
absent. Ubuntu libavif16, libgav1 and libyuv packages were downloaded and extracted
under `/tmp/azul-webkit-libs/`, without system package changes. The temporary
`WEBKIT_EXECUTABLE=/tmp/azul-webkit-libs/webkit` wrapper supplies those libraries to
the installed Playwright WebKit binary. This is test infrastructure only.

[Before/design/after comparison](azul-redesign/screenshots.md) and
[recordings, captures and contrast results](evidence/azul/table-light/README.md)
document explicit visual review. The suite does not compare screenshot baselines.
Physical Safari, real-device touch/audio and fluent Spanish review remain unverified.

### Azul fixed viewport follow-up

The main table now has no scroll range. Desktop places supply and the full board
side by side below all opponents; compact and short landscape layouts use a local
board overview plus colour/destination dialogs. Round details and results open in
dialogs. Confirmation remains visible and playable rows remain at least 44px high.
This supersedes the earlier scrolling layout and desktop side-column proposal.

- Built before browser verification. `bun run check` passed with zero errors and
  warnings; `bun run format:check` and `git diff --check` passed.
- `bun run test`: all 316 tests passed. An earlier concurrent run hit the existing
  five-second Catan full-game timeout; the standalone rerun passed without code changes.
- The combined `azul.spec.ts` and `azul-viewport.spec.ts` suites passed all 40
  Chromium/WebKit journeys. The seven sizes are 360×640, 390×844, 768×1024,
  1100×700, 1440×900, 720×450 and 1280×720. The viewport suite checks two/three/four
  players, floor overflow, actual zero scroll range, contained table regions,
  visible confirmation, and compact selection cancellation/focus across resize.
- Existing coverage still passes for actual flight endpoints and scales, cleanup,
  scores over 100, keyboard/touch emulation, 200% computed text, unavailable audio,
  English/Spanish, opponent inspection and real two/four-seat acceptance/reconnect.
  Endpoint assertions now compare directly with stable table geometry, without
  allowing a scrolling offset.
- New [screenshots and motion evidence](evidence/azul/table-light/viewport-fit/README.md)
  preserve the earlier images and label the latest fixed layout separately. Phone,
  short landscape confirmation, desktop, enlarged text and motion frames were
  inspected explicitly; screenshot-baseline comparison is still not automated.

Physical Safari, actual device touch/audio and fluent Spanish review remain
unverified. All browser test servers started for this work are stopped afterward.

## Codenames voice-led tabletop (2026-09-13)

[ADR 018](adr/018-codenames-voice-table.md) replaces recorded clues, mandatory
review, penalties and enforced turns with group-managed voice play. The fixed
5×5 wooden table has original illustrated reveals and Rules/Settings corners.
Role consent, recipient-private keys and authoritative confirmed reveals remain.

Validation completed:

- `bun run check`: zero Svelte errors/warnings; root TypeScript check passed.
- `bun run test`: 315 tests passed. Focused Codenames rules/socket coverage passed
  15 tests, including either operative team, actor-attributed assassin losses,
  either team's final agent, malformed actions, immutable state, key permutations,
  operative-host privacy, stale/duplicate races, replacement and reconnect/rematch.
- `bun run build`: passed before browser verification and after final changes.
- `tests/e2e/codenames.spec.ts` plus `three-games-library.spec.ts`: all 16 initial
  Chromium/WebKit journeys passed. These cover real four/eight-seat play, explicit
  confirmation races without automatic replay, actual operative payload privacy,
  rematches, silent audio fallback, keyboard dialogs, five viewport sizes with no
  scrolling/clipped cards, enlarged text and bilingual rules/practice entry points.
- After the final audio and artwork safeguards, six focused Chromium/WebKit checks
  passed for accepted effects, illustrated reveals/results and a finished board's
  locale remount without automatic audio unlock. Four additional focused checks
  passed after ensuring ordinary snapshot changes preserve result dismissal,
  including responsive layout and locale remounts in both browsers.
- Following obsolete-copy removal, the five library/localization tests passed.
- `bun run format:check` and `git diff --check`: passed.

[Desktop, phone, spymaster and assassin captures](evidence/codenames/voice-table/README.md)
were inspected explicitly. No automated screenshot baselines are claimed.
WebKit required a temporary `/tmp/cn-webkit-libs/webkit` wrapper with extracted
Ubuntu codec libraries; no system packages were changed. Physical Safari/iOS,
real-device touch/audio, fluent Spanish review and a human voice-call playtest
remain unverified. Local verification servers were stopped afterward.

## Codenames table and authoritative turns — 2026-09-13

[ADR 019](adr/019-codenames-table-turns.md) replaces the voice-only turn protocol
and introduces the accepted table migration. Client and server were built together;
deploy both together. Other games' pre-existing workspace changes were preserved.

- `bun run test`: **320 passed**, 0 failed, across 25 game/server/script files.
  Targeted Codenames rules, socket and retry coverage: **30 passed**. The subsequent
  explicit forged end-turn socket assertion also passed (both socket journeys).
- `bun run check`: TypeScript and Svelte checks passed, with zero Svelte errors or
  warnings. `bun run build` produced the SPA and Bun server successfully.
- `bun run format:check`: passed. Local Markdown links for the changed architecture,
  rules, migration, ADR and evidence documents resolve.
- Codenames plus catalog/library: **18 distinct Chromium/WebKit cases passed across
  the final runs**. The main run passed 16 gameplay/layout/library cases; the two
  added texture-contrast cases first exposed a test data-URL parsing issue and then
  an actual 4.22:1 textured red-card minimum. After correcting the parser and
  darkening red/blue fills and the blue panel, all four affected contrast/viewport
  cases passed. No application code changed after that production build.
- Both browsers exercised all six viewports: 1440×900, 1280×720, 768×1024, 390×844,
  360×640 and 320×568, in English/Spanish, with eight players and 200% text. The
  composer/missing-artwork journey also checks each viewport at enlarged text.
  Checks include native dialogs, keyboard selection/confirmation and focus return,
  operative payload privacy, role-key display persistence, handoffs, finite/zero/
  unlimited rules, normal/assassin results, host rematch, reconnect cancellation,
  eight-seat stale races with no automatic guess retry, and accepted-only effects.
  Existing gesture-unlocked audio, mute, reduced motion and silent fallback pass.
- Browser pixel tests composite the actual paper SVG texture over the computed
  gradient stops for red/blue word faces and both team panels; all now meet 4.5:1
  small-text contrast in Chromium and WebKit. Header/dialog contrast uses the
  scoped dark panel palette with lifted secondary text. No new sounds were added.
- [Thirteen WebP review captures](evidence/codenames/table-redesign/README.md) cover
  desktop, every compact size, Spanish, spymaster, history and WebKit. Reviewed
  against the realistic reference for wood, lighting, foliage, ceramic/cork, blank
  props and thin paper edges; structure follows the migration. These are review
  images, not automated screenshot baselines. Six original generated local WebP
  assets total 516,586 bytes; no runtime dependencies or generation were added.

Final browser commands:

```sh
WEBKIT_EXECUTABLE=/tmp/cn-webkit-libs/webkit bun run test:e2e \
  tests/e2e/codenames.spec.ts tests/e2e/three-games-library.spec.ts
WEBKIT_EXECUTABLE=/tmp/cn-webkit-libs/webkit bun run test:e2e \
  tests/e2e/codenames.spec.ts --grep 'paper texture|six viewports'
```

The existing temporary WebKit wrapper supplies this Ubuntu machine's extracted
codec libraries; it is not an application dependency. Review capture generation
uses installed `cwebp`. Physical Safari/iOS, real-device touch/audio and fluent
Spanish review remain **unverified**.

## Codenames wood, panels and card finish — September 13, 2026

- Imported wood now uses Vite's asset pipeline. The asset browser test verifies
  HTTP 200, WebP content type and successful decoding for wood plus five props in
  development and production, in Chromium and WebKit. Development checks used
  `CODENAMES_DEV_URL=http://127.0.0.1:5173` against the existing Vite server.
- Team tints expose the grain without paper noise. Dark panels use 68–73% opacity
  and no blur, with thin borders and softer contact shadows. Filled coral/blue
  icons, mirrored count captions and restrained turn gradients follow the reference.
- Contrast tests now measure rendered pixels under text with ink hidden, including
  wood, props, lighting, translucent panels and paper. Both turn colours and small
  metadata require 4.5:1. Invalid/empty/non-finite measurements fail. Brighter
  metadata and correct-guess colours resolve the bright book behind history.
- The subsequent card close-up request removes dashed inner frames and inset
  highlights, including from spymaster cards, and adds multiplied paper grain,
  subtle surface lighting and external edge/contact shadows. Private payloads,
  rules, identity symbols, exterior keyboard focus and responsive structure remain.
- `bun run check`, all 320 tests (78,814 assertions), production build and formatting
  passed. All 16 distinct Codenames browser cases passed across the stable full
  run and focused keyboard rerun. A prior run was interrupted by an overlapping
  rebuild; it is not counted as passing evidence. The keyboard helper now waits
  for the native dialog close event before subsequent input.
- Following the card changes, the production build and TypeScript check passed;
  all eight targeted Chromium/WebKit cases passed (six viewports in English and
  Spanish, eight players, 200% text, missing artwork/clue access, keyboard flow,
  rendered contrast and absence of inset card frames). Fresh WebP screenshots
  are in [table evidence](evidence/codenames/table-redesign/README.md).

WebKit used `/tmp/cn-webkit-libs/webkit`. Physical Safari/iOS, real-device touch/audio
and fluent Spanish review remain unverified.

## Codenames opaque teams, word-only cards and glass — September 13, 2026

The latest team/glass reference supersedes the earlier transparent team treatment.
Red and blue team panels are opaque with soft mottled texture. All existing glass
surfaces share a partially transparent smoked fill, 0.65px backdrop blur, brightness
and saturation filtering, warm edge reflections and short contact shadows. Native
dialogs retain their opaque surface. Word cards show only the word; private
spymaster colours, mini-key symbols and accessible identity labels remain.
Roboto Condensed is locally bundled as a closer visual approximation of the
reference, whose exact font is unknown. Latin/Latin-extended faces and OFL license
are recorded in the [font provenance](../apps/web/static/fonts/codenames/README.md).
The CSS approach and its primary reference are in [material tokens](codenames-redesign/tokens.md).

Type/Svelte checks, all 320 game/server tests (78,814 assertions), production build
and formatting passed. All 16 distinct Chromium/WebKit Codenames cases passed
across the full run and final four-case material/viewport rerun. WebKit's brighter
compositing over the book required the history round label to use primary text
colour. Tests check actual composited contrast, opaque team fills, filtered glass,
loaded typography, word-only cards, six viewport sizes, English/Spanish, eight
players and 200% text. Existing keyboard, privacy, session, audio and asset-loading
cases also passed. [Updated WebP evidence](evidence/codenames/table-redesign/README.md)
includes desktop, spymaster, phones, history, cards and the team row.

Physical Safari/iOS and real-device touch/audio remain unverified.

## Codenames centred desktop composition — September 13, 2026

Desktop mode starts at 1024px. The table caps at 1120×680px; the header stays close
above it and shares a 1440px maximum scene with the decorative props. History is
vertically centred beside the word grid for empty and populated states, with
internal scrolling when needed. The team/grid/bottom alignment is retained. Short
laptop windows have smaller panel spacing and a side-by-side key treatment; phones,
tablets below 1024px and enlarged text retain compact controls.

Type/Svelte checks, all 320 unit/server tests, production build and formatting
passed. All 18 distinct Chromium/WebKit Codenames cases passed across the full run
and final six-case rerun. New geometry assertions cover 1024×600 through 2560×1440,
with eight players, all key cells visible, bounded dimensions, a centred group,
header proximity, no overlapping rows and centred history. Existing six-size
English/Spanish, 200%-text, privacy, session, keyboard and sound tests passed.
The initial new test needed its Seats selector scoped to the settings dialog;
WebKit contrast required a slightly brighter brand over the repositioned foliage.
Final [WebP captures](evidence/codenames/table-redesign/README.md) include short
laptops, 1920px desktop, 2560px ultrawide and empty history. Physical Safari/iOS
remains unverified.

## Evidence media size and compact Codenames props — September 13, 2026

Documentation screenshots moved from PNG to WebP (quality 90) and recordings from
Playwright VP8 to VP9 WebM (CRF 32); side-by-side crops showed no visible loss.
Nine byte-identical Azul captures were kept once, and every Markdown image link
resolves. The Sushi Go Party spec now writes WebP evidence. Compact Codenames
layouts no longer mount the hidden decorative props, avoiding about 330 KB of
downloads on phones and tablets.

Type/Svelte checks, all 320 unit/server tests and the production build passed.
Five Codenames asset/layout cases passed in Chromium and WebKit, including a new
network assertion that fails against the previous component. All six Sushi Go
Party cases passed in both engines with WebP capture. Physical Safari/iOS remains
unverified.

## Azul Rich & Dramatic production migration — September 14, 2026

[ADR 020](adr/020-azul-rich-dramatic.md) replaces Azul's Table Light materials
and desktop arrangement while retaining its rules, state, sockets, actions,
privacy, accepted-event flights, audio and measurable-location contracts.

- `bun run check` passed with zero Svelte errors or warnings and a clean root
  TypeScript check. `bun run test` passed all **320 tests** with 78,898 assertions.
  The final production frontend/server build passed after the isolated `/dev`
  prototype was removed.
- Azul's viewport and gameplay specs passed all **22 Chromium cases** and all
  **22 WebKit cases**. They cover 360×640, 390×844, 720×450, 768×1024,
  1100×700, 1280×720, 1440×900 and 1728×960; 2/3/4-player factory geometry;
  compact tray/pickers; keyboard/focus; 200% text; English/Spanish; accepted
  scoring flights; 100+ scores; and real 2/4-client rooms and reconnects.
- Final capture checks decoded every raster asset, rejected failed requests and
  console/page errors, checked stable geometry and zero document overflow, and
  compared fixture text, assets, anchors and bounds across a clean reload.
  Chromium's settled reload was also pixel-identical. The inspected
  [Chromium/WebKit tables and close-ups](evidence/azul/rich-dramatic/README.md)
  are actual production component renders at a 1728×960 CSS viewport.
- `git diff --check` and scoped Prettier checks for every changed source/document
  passed. The repository-wide `bun run format:check` still reports the unchanged,
  out-of-scope `games/codenames/src/tokens.css`; this migration did not reformat
  that unrelated file.

WebKit used the existing temporary `/tmp/cn-webkit-libs/webkit` wrapper to supply
codec libraries missing from this Linux host; no system or application dependency
was installed. Physical Safari/iOS, real-device touch/audio and subjective speaker
review remain unverified. Playwright-owned servers and the implementation dev
server were stopped after verification.

## Sushi Go Party illustrated production table — September 15, 2026

[ADR 021](adr/021-sushi-illustrated-table.md) migrates the approved desktop
prototype's shared Svelte/CSS/SVG primitives into actual recipient-view gameplay.
Rules/settings, all 26 cards, 2–8 players, private prompts, localization, accepted
presentation events, audio preferences and guarded action retries are retained.
The deterministic practice scene remains separate from multiplayer initialization.

- Type/Svelte checks passed with zero errors or warnings; the production build
  passed. All **323 unit/server tests** passed (79,302 assertions).
- All **nine distinct Chromium** and **nine distinct WebKit** Sushi cases passed
  across the full and final focused runs. They cover real desktop-host/phone-guest
  2/8-client matches, reconnect, three-round scoring/rematch, advanced choices,
  all 26 bilingual lessons, privacy, accepted motion/cancellation, the archived
  prototype and the new illustrated practice scene. No game rules were changed.
- Browser review includes exact **1440×900, device scale factor 1** desktop and
  board/opponent/hand close-ups, settings/rules, Spanish and accepted passing;
  the layout matrix checks 2–8 desktop seats and 768×1024, 390×844, 360×640 and
  844×390 compact screens. It checks no document overflow, separated opponent
  trays/practice controls, usable targets and actual compact advance clicks.
- Review corrected long-hand clipping, the dessert-control overlap, landscape
  tray collisions, basic-rule popovers covering tableaus, practice presentation
  revision gaps and a hover transform that displaced the compact advance button.
  Screenshot capture now settles finite CSS transitions before comparing the
  archived static fixture; Chromium reload pixels match exactly.
- Scoped formatting, whitespace and documentation-link checks passed. Final
  screenshots and component/state mapping are in the
  [migration handoff](sushi-go-party-redesign.md).

WebKit required the existing temporary extracted-library wrapper and
`JSC_useJIT=false`: default-JIT runs on this Linux browser build produced
closed-page/invalid-attribute failures during longer multiplayer journeys.
The passing workaround is explicitly an automation-environment limitation, not
proof of normal Safari/JIT behavior. Native Safari, physical touch/audio and a
human group playtest remain unverified. All agent-started development/test
servers were stopped. Existing unrelated Azul changes were preserved.
