# Azul final High review

Reviewed and corrected by Astra High on 2026-09-12 in `/home/oscar/Projects/board-games-three-games/azul`, branch `feature/azul`. Game-owned work is ready for integration. No nested agents, optional plugins, original-checkout edits, or shared room/session changes were used. `bun.lock` remains intentionally uncommitted for coordinator regeneration.

## Findings fixed

- Pattern slots previously filled left to right. They now fill right to left, so slot zero is also the correct wall-transfer origin. A browser test checks actual slot coordinates and partial-row occupancy.
- Empty wall previews were too faint for planning. Original motifs now have dark readable strokes, pale glaze tints and dashed borders; occupied tiles retain full glaze, bevels and shadows. Accessible wall cells state row, column, color and empty/occupied status. Pattern and floor contents have translated accessible descriptions; unavailable rows show their reason visibly for touch users.
- The compact opponent dialog now gives the board enough width at 360px. Skip, settings labels and the volume slider have 44px hit areas; compact corner controls respect safe-area insets.
- Scoring feedback previously displayed a single unconnected tile as an axis contribution, for example `+2 (1 horizontal, 2 vertical)`. Unconnected axes now contribute zero in the explanation, with a separate isolated-tile message. The independent scoring fixture asserts `+2 (0 horizontal + 2 vertical)` and `+6 (4 horizontal + 2 vertical)`.
- Changing language in the local workshop previously reloaded and reset in-memory play. A locale-keyed board remount now changes language without discarding the accepted game state, while settling old effects. Browser coverage changes language after a real accepted overflow draft and verifies revision one and the two blue pattern tiles survive.
- Library and in-game help illustrations now expose meaningful image semantics using translated lesson/frame descriptions.
- Real Socket.IO coverage now goes beyond reconnect to expired-seat replacement, preserved boards, token rotation/revocation, and transferred host authority. The replacement cannot start a match as the former host.

## Independent rules and boundary review

Reopened the [English publisher rulebook](https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Azul-Rules-Next-Move-web.pdf) and [Spanish publisher rulebook](https://cdn.svc.asmodee.net/production-asmodeees/uploads/2023/06/Reglas_Azul.pdf), and inspected the reducer, tests, presentation gate, effects, practice entry, board and help/catalog boundaries. The exact colored wall, all-one-color drafting, marker-before-overflow, seven-slot cap, floor clamp, bag-before-discard refill, partial factories, all-player resolution, bonuses and score/row/shared ties agree with the approved rules baseline. Existing full-floor marker and unclaimed-marker conventions remain explicitly documented; this review does not claim new publisher clarification.

The reducer validates before cloning or consuming randomness, derives quantities itself and rejects extra actor/quantity fields. Public projections deep-copy whitelisted boards and aggregate reserve counts, with an empty private projection; no bag order, random state or credentials are serialized. The existing nine complete seeded games cover 2/3/4 players with per-color conservation after every accepted action. No rule source changed during High review, so the passing rule suite was not repeated without cause.

Wall flights preserve each player's top-to-bottom row order. Different players may resolve in parallel, as the publisher explicitly permits; no unnecessary global delay was introduced. Accepted events retain measured DOM source/destination coordinates. Flights are noninteractive. Initial/gapped/reconnected/changed-seat/match snapshots use silent baselines, and effects do not advance rules. Existing pure gate tests and real reconnect coverage were reviewed; added browser checks exercise resize and visibility-handler cancellation with the accepted board retained. The visibility-handler test dispatches visibility changes explicitly; it does not claim physical background-tab/device scheduling validation.

## Actual High validation

- `bun test apps/server/src/azul.test.ts`: **2 passed, 228 assertions**, including the added real replacement/host checks.
- `bun run check`: **zero errors, zero warnings** after final code changes.
- `bun run build`: **passed** after final code changes, including localized messages and lazy guide/board chunks.
- Focused Chromium/WebKit phone/tablet and High review journeys: **4 passed**. Coverage includes actual touch events at 360×640, all legal row targets and floor/confirmation, right-to-left geometry, readable accessible wall labels, expanded opponent board with no horizontal clipping, silent/reduced play, accepted-state retention through Spanish, resize/visibility cancellation and 720×450 viewport reflow.
- Final desktop keyboard/motion/help-focus/scoring/shared-result journeys: **2 passed**, one in each engine, after the scoring-text and unavailable-row corrections. Real Web Animations keyframes are inspected for nonzero travel.
- Manual scripted browser inspection doubled every computed HTML font size at 1440×900 and 360×640 in Chromium and WebKit. Page and player-board widths did not overflow; inspected captures retain readable boards and reachable floor controls. This is a font-enlargement stress check, separate from native browser zoom.
- `bun run format:check` and `git diff --check`: final results recorded with the commit below.

The first High browser attempt could not launch because the prior shared cache lacked the required binaries. An isolated `/tmp/azul-review-browsers` install plus `/tmp/azul-review-webkit` wrapper resolved it. Passing commands used `PLAYWRIGHT_BROWSERS_PATH=/tmp/azul-review-browsers PLAYWRIGHT_SKIP_BROWSER_GC=1 TEST_PORT=3111 WEBKIT_EXECUTABLE=/tmp/azul-review-webkit bun run test:e2e tests/e2e/azul.spec.ts --project=chromium --project=webkit` with focused grep filters. These are real Chromium and WebKit runs, with no skipped journeys. The coordinator owns the final combined six-game suite.

The Medium full 163-test suite, 28 Azul unit tests and eight browser journeys remain recorded in its implementation handoff. They were not needlessly repeated; High's six additional/focused passing journeys and final build/check cover the changes above.

## Evidence and remaining human validation

Preserved all original selected screenshots and actual `workshop-motion.webm`. Added inspected final desktop/scoring, 360px own/opponent board and doubled-text screenshots, plus `review-motion.webm`, a **4.92-second actual Chromium recording** showing accepted drafting, wall transfers and dealing. High sampled the original video at five frames per second and the final clip at six frames per second, checking actual travel and row order. See [evidence notes](../evidence/azul/README.md).

Actual Safari on macOS/iOS, physical-device touch/audio quality, a multi-human game and fluent Spanish editorial review remain **unverified**. WebKit automation and scripted touch/font checks do not claim those validations.

## Integration

Owner implementation commits remain `f2eb656` and `a000b06`. `9790459` duplicates coordinator `ef5a1be` and must not be picked again. The coordinator preserved the planning handoff as `azul.md` and renamed the Medium implementation handoff `azul-implementation.md`; keep that integration naming. High adds this separate `azul-review.md` and game/evidence corrections. Preserve the coordinator's room errorCode propagation, translated session errors, library layout and root documentation updates.
