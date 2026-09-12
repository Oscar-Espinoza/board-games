# Azul implementation handoff

Implementation owner: Astra Medium, 2026-09-12. Worktree `/home/oscar/Projects/board-games-three-games/azul`, branch `feature/azul`. The original `/home/oscar/Projects/board-games` checkout was not edited. No nested agents or optional plugins were used.

The planning handoff supplied by the coordinator and `docs/games/azul-plan.md` were executed. Source rules and the exact independently transcribed colored wall remain as locked by the planning phase; see [rules, conventions and primary sources](../games/azul.md). No new architectural framework or ADR was needed: this applies ADR 011's explicit projection and accepted-event boundary.

## Delivered

- A full standard colored-wall 2–4-player reducer: setup, injected shuffle/starter, strict exact runtime intention validation, all-one-color drafting/spill, single destination, floor overflow, physical marker conventions, top-to-bottom wall scoring, floor clamp/ledger, bag-before-discard recycling, total shortage, all-player end resolution, bonuses and shared/tiebroken wins. Scores are uncapped. Invalid actions leave state/events/revision/RNG unchanged.
- Explicit deep-copied public views with empty private projection, public boards/counts and accepted typed intermediate events. Bag order never leaves the server. Game code imports no fixture data.
- A ceramic workshop table with five original patterned tile families, stable factory slots, grouped center picks, exact marker/overflow/discard preview, explicit confirmation, inspected opponent boards, pattern/wall alignment, floor risk, round/turn/connection state and full score ledgers. Upper-left illustrated help and upper-right settings are native dialogs with Escape/opener-focus restoration.
- Searchable illustrated before/action/result lessons in both the table and lazy library guide; original catalog cover and summary art; English/Spanish Paraglide text throughout.
- Measured source-to-destination tile flights, wall contribution highlights/text and factory deals, skipped on nonconsecutive/first/reconnected/changed-seat/match snapshots. Resize, tab visibility and preference changes cancel effects. Skip and next-turn interaction settle immediately. Audio is gesture-unlocked, restrained/default 25%, saved and optional; mute stops scheduled tones.
- Separate deterministic conserved practice openings for 2/4 seats, marker+overflow, top-to-bottom scoring and shared victory. It uses real apply/view and manual seat switching, with no bots or production fixture actions.
- Real registry/dependency/catalog/lazy-client wiring. Azul intentionally has no metadata `practice:true` because that currently signals server UNO bot practice. Its practice route is the separate local route.

## Integration boundaries

Coordinator commit `ef5a1be` was cherry-picked as `9790459` for shared room controls, structured synchronization and six-game library layout. **Do not cherry-pick that duplicate coordinator commit again.** Owner did not edit the room page, socket layer or session client.

Board accepts optional `settingsContent`, `canRematch`, `rematch` and `errorCode` props. Host result rematch delegates to the supplied callback. The latest coordinator errorCode propagation was not independently copied; integration should retain the coordinator version. Shared error rendering should translate `AZUL_*` rule failures via `m.azul_error()` and coded stale/match changes via `m.azul_changed()` or the shared translated equivalent.

Suggested coordinator root-doc additions: include Azul in README/architecture/AGENTS catalog lists; link `docs/games/azul.md`; identify `/practice/azul` as a local all-seats workshop; add the Azul unit/session/E2E checks to validation docs. Keep the existing Bun/TypeScript/in-memory/no-accounts architecture unchanged.

## Actual validation and evidence

- `bun test games/azul`: **28 pass**, 1,817 assertions. Includes nine seeded complete games across 2/3/4 seats with inventory checked after every action, independent wall/scoring expectations, marker conventions, immutable rejection/RNG, incomplete lines, partial refill, bonuses/ties, projection isolation and revision gating.
- `bun test apps/server/src/azul.test.ts`: **2 pass**, 220 assertions. Rooms and real Socket.IO: actor binding, concurrent/stale intentions, duplicate requests, reconnect state/identity, expired-seat replacement/revoked token, full-game projections and rematch generation.
- `bun run test`: **163 pass**, 29,924 assertions across 17 files, no failures.
- `bun run check`: zero errors and zero warnings.
- `bun run build`: passes, including the lazy guide and game chunks.
- `bun run format:check`: all maintained files passed before the final handoff/evidence notes; a final check is recorded below.
- Browser command: `TEST_PORT=3111 WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit bun run test:e2e tests/e2e/azul.spec.ts --project=chromium --project=webkit`. The wrapper supplies the host's missing WebKit dependencies. Both projects exercise actual browsers, no skips. WebKit multiplayer uses separate browser processes per seat for isolation.
- Six final-layout browser journeys passed (desktop keyboard/actual travel/help/scoring/shared finish, phone/tablet/silent-reduced-motion/Spanish, and four real browser seats, in both engines). The two full two-seat game/rematch journeys received a focused rerun after correcting current-host rematch selection and transparent center hit interception; final results are recorded below.

Early browser failures were diagnosed and fixed: Chrome's search-input Escape behavior did not close/restore focus; an empty sticky confirmation surface covered the floor; nine elliptical factories overlapped; the widened center's transparent container intercepted a factory corner. Current factories use two arcs for 7/9 displays, and noninteractive center space has no pointer events. Factory tile-control rectangles are checked for overlap. The test uses a 15-second action timeout to expose a blocked target promptly.

[Evidence directory](../evidence/azul/) contains actual screenshots and a six-second WebM recording, not mockups. Owner inspected desktop two/four-seat composition, tablet, 390px four-seat table/own board, 360px overflow preview and Spanish board, shared/real results, and a contact sheet of recorded source→pattern, spill→center, wall transfers and deal flights. The final screenshot capture used the built app at port 3011. A small amount of intentional vertical scrolling is needed on phones, and on the fullest desktop composition. No horizontal page overflow was found.

## High review successor

Do a High review/fix pass in this same worktree, then report to the coordinator. Prioritize:

1. Independently recheck every marker/finish/recycling/tie invariant against the sources and the preserved planning handoff. Verify the serialized whitelist remains secret-free at initial, draft, refill and finish revisions.
2. Inspect code and video for real coordinate travel and correct intermediate wall/floor explanations; test rapid updates, rejection, skipped/reduced motion, reconnect during travel, hidden-tab restoration and resize. The pure gate and selected browser behaviors are automated; not every adversarial effects combination has a dedicated browser test yet.
3. Check focus, scrolling and safe-area corner controls on compact layouts; source hit testing and nine-factory layout were corrected from real trace/screenshot evidence. Check 200% text zoom and other font settings beyond the captured viewports.
4. Review Spanish wording and accessibility, including explanations on unavailable pattern rows and static empty-wall motif contrast. Confirm lazy guide art imports do not pull in rules or fixtures eagerly.
5. Integrate coordinator errorCode/translated error rendering and final combined catalog changes, then run affected combined checks. Shared page modifications in owner commits are only summary/loop data; preserve coordinator layout.
6. Safari on actual macOS/iOS, real touch/audio quality, a multi-human game and fluent Spanish editorial review remain explicitly **unverified**. WebKit automation is not a claim of Safari device validation.

## Commits and final rerun

Commit hashes and final targeted browser/check results are appended when the implementation commits are created. `bun.lock` is intentionally left uncommitted for coordinator regeneration.

Final focused results: the six desktop/phone/four-seat journeys passed on both engines in the final-layout run; WebKit's complete two-seat game/rematch passed in **14.3 seconds** after the center hit fix; Chromium's complete two-seat game/rematch passed in **10.9 seconds** after the test awaited both recipient game revisions between moves. That last harness change removes a cross-page snapshot race; it is not a gameplay retry. **All eight Azul browser journeys now have passing evidence across the focused runs.** No additional passing browser journeys were repeated unnecessarily.

Final `bun run check` again reports zero errors and warnings after the layout/hit fix. Build passes. The full 163-test run preceded only UI/harness/documentation fixes; no later rule changes invalidate it.

Committed implementation:

- `f2eb656` — game-owned reducer/UI/practice/help, unit/session/browser tests, rules and inspected visual evidence.
- `a000b06` — shared app dependencies/server registry, lazy catalog/client/guide wiring, original lightweight catalog art and English/Spanish messages.

Final `bun run format:check` passes for all matched maintained files. `git diff --check` passes. `bun.lock` remains the sole intentional uncommitted integration artifact. The subsequent handoff-only commit records these hashes. Do not include `9790459` in owner cherry-picks; it duplicates coordinator `ef5a1be`.
