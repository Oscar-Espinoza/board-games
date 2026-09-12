# Codenames implementation → High review

High review is now complete; see [review and fixes](codenames-review.md). The
review priorities below are retained as the original Medium handoff.

Prepared September 12, 2026. The Medium implementation is complete and committed;
this document records actual evidence and the targeted independent review still
needed. Original planning handoff remains in the integration worktree at
`docs/handoffs/codenames.md`; its “not started” checkboxes are historical.

## Worktree and commits

Worktree: `/home/oscar/Projects/board-games-three-games/codenames`.
Branch: `feature/codenames`. Do not work in the original checkout.

- Shared prerequisite `ef5a1be` was cherry-picked as `345496d`.
- **`23aa459`**: game package, authoritative rules, recipient projection, events,
  table, field manual/scenes, original word packs, local practice, tests, game docs
  and ADR 015. This commit depends on the messages/wiring commit below to build.
- **`ccb1c57`**: server/client registration, metadata, catalog art and summary,
  creation options, lazy guide adapters, workspace dependencies and EN/ES messages.
- This handoff is in a following documentation commit.

Do not cherry-pick the shared prerequisite back onto integration. Coordinator owns
shared room/socket/session code. `bun.lock` is intentionally modified only locally
and **not committed**; coordinator regenerates it after all package wiring lands.
The Board accepts optional `errorCode`, `settingsContent`, `canRematch`, `rematch`
props. Coordinator's subsequent shared commits supply localized `cn_error` handling
and errorCode; the owner branch retains the prerequisite shared implementation.

## Implemented decisions

- 4–8 seats, no bots. Creation-only board language and abbreviation/multiword-name
  agreements are explicitly wired into catalog controls, visible during setup and
  immutable for the round. No setup configure action is necessary.
- Authenticated actors choose only their own team/role. Exactly one spymaster and
  at least one operative per team; uneven teams are legal. All seats ready against
  `setupVersion`; role changes clear all readiness. Setup presence blocks dealing
  while disconnected; seat replacement clears consent and increments version.
- Wire readiness is exactly `{ type: 'ready', version }`, phase `setup`, public
  `setupVersion` and `ready: string[]`, matching coordinator's bounded safe retry.
- No board/key before deal. Injected shuffles draw 25 unique words and correct
  9/8/7/1 identities with independently random starting team. Original packs hold
  **344 English and 354 Spanish words**; no publisher assets/deck copied.
- Clue → opposing-spymaster review → guesses or opponent's optional own-agent
  penalty reveal. Unicode/NFC/accent-aware structural input checks, advisory exact
  word/multiword warnings, finite count+1 / zero / unlimited budgets, mandatory
  first guess, all victory routes, no undo, inert finished board and host rematch.
- Public views/events explicitly allowlist data. Only spymaster private views hold
  unrevealed identities; operative hosts receive no extra information. Public
  history is bounded to 200 events. UI runtime imports do not include rules/packs.
- Selection/confirmation is local and clears on actions, phase/seat/round changes,
  reconnect and failed/uncertain sends. Shared send may swallow errors, so cleanup
  occurs in `finally`. Never automatically retry clues, reviews, reveals or guesses.
- Warm original dossier table with original agent/civilian/assassin SVGs, secret
  patterns, durable stamps, upper-left field manual and upper-right single gear.
  Settings render shared invite/leave/locale/host controls. No site toolbar in
  multiplayer or local practice. Mobile team summaries expand into roster details.
- Table scrolls internally when narrow/text-enlarged; 5 columns never reorder.
  320px text zoom wraps the title rather than overlapping the settings gear.
- Accepted events decorate current state with bounded deal arrival, clue arrival,
  perspective flip, identity stamp and counter emphasis. Gate identity includes
  round/seat/role. Reconnect waits for a genuinely fresh snapshot object, not the
  earlier connect notification carrying stale state; backwards sequence is clamped.
  Initial mount, gaps, repeated snapshots, resize, hidden tabs and motion changes
  establish a baseline. Sources/animations cancel at resets/unmount.
- Sound enabled by default but AudioContext is created/resumed only by a user
  gesture. Public reveal/clue tones only; no key-based audio. Preferences only in
  storage. Missing AudioContext does not block actions.
- Lazy catalog guide and in-table searchable native-dialog manual share localized
  lightweight guide content and original scene component. Guide scenes illustrate
  setup, clues/review, guess budget, selected cards and finishing without live data.
- Local practice alone imports deterministic fixtures and can switch roles and
  scenarios (setup, full case, final agent, assassin). It has localized seat labels.

## Actual validation

Commands ran in the owner worktree with ports backend/web/browser **3012/5182/3112**.
Browser checks use
`WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit TEST_PORT=3112`.

- `bun install` succeeded; no dependencies outside existing workspace/runtime.
- `bun run check` passed, **0 errors / 0 warnings**, including final guide changes.
- `bun run build` passed, including final guide/deal-opacity changes.
- `bun run test` passed **146 tests, 28,196 assertions**. Codenames rules/gate subset
  has 12 tests / 288 assertions. Real socket test adds 21 assertions over 5 seats.
- `bun run format:check` passed; final edited owner files also formatted afterward.
- Complete `tests/e2e/codenames.spec.ts` run: **10 passed**, Chromium and WebKit.
  Four independent browser contexts completed ordinary all-agents win, reconnect
  after a reveal, host rematch and assassin loss. Eight independent contexts chose
  roles/consented to Spanish-board agreements and displayed the table.
- Other browser cases cover 1440×900, 768×1024, 390×844, 360×640, 320×568;
  all 25 card targets ≥44px, no horizontal document overflow, 200% root text;
  search/Escape/focus return, keyboard select/cancel without reveal, EN→ES word
  stability, gesture-only AudioContext, accepted flip/stamp count, mute/motion
  controls and unavailable AudioContext.
- After the title-wrap/local-seat-label adjustment, focused responsive/eight-seat
  tests passed **4/4** across both browsers. After scene illustration/deal-opacity
  polish, focused responsive/effects tests passed **4/4** across both browsers.
- Serialized operative socket projections and unrevealed operative DOM identities
  are asserted absent. Rules metamorphic tests permute hidden keys without changing
  operative serialized views. Socket test verifies host-operative privacy, forged
  actor rejection, simultaneous guesses, stale revision, duplicate ID, round mismatch,
  sync acceptance, token reconnection and fresh rematch.
- Computed principal contrast ratios: ink/paper **13.34:1**, paper/table **13.52:1**,
  revealed-red text **6.88:1**, revealed-blue text **7.53:1**. This is a focused palette
  calculation, not a full automated accessibility audit.

## Artifacts inspected

Latest complete-run artifacts are under owner `test-results/` (gitignored):

- `codenames-four-private-cli-5d79f-ch-and-lose-to-the-assassin-{chromium,webkit}`:
  operative/spymaster desktop, ordinary result, assassin result, four client videos.
- `codenames-responsive-pract-a7ea7-gs-and-Spanish-stable-board-{chromium,webkit}`:
  five responsive sizes and Spanish screen.
- `codenames-eight-seats-cons-b5cc1-greements-and-fit-the-table-{chromium,webkit}`:
  eight-seat setup/tablet and enlarged text.
- `codenames-accepted-public--baf05-l-on-resize-and-mute-safely-{chromium,webkit}`:
  accepted reveal.

Final layout-only screenshots are in `/tmp/codenames-final-layout/` and final
scene/effects screenshots in `/tmp/codenames-final-effects/`. Existing `/tmp/cn-*.log`
files retain check/build/test/format output. `/tmp/codenames-video-contact.png` is
an inspected 16-frame contact sheet from a real Chromium operative video: setup,
deal, public clue/review, reveal, disconnected baseline, reconnect and later reveals.
Desktop operative/key and 390/320/tablet/enlarged-text images were visually inspected.

Inspection found and fixed: inherited disabled-button opacity dimming words,
practice site-header overlap, inaccessible exact select labels, full-title overlap
at enlarged text and too-strong initial deal fade. No unrevealed identity appeared
in inspected operative frames. Real-time playback on a human device and measured
frame timing were **not** performed; do not claim an FPS or final Safari certification.

## High successor review priorities

The code and tests are ready for an independent High pass, not declared release
certified. Focus on these remaining acceptance checks:

1. Review all rule/phase/actor branches and the fresh-snapshot reconnect gate with
   coordinator's latest shared error/retry commits. Expand expiry/replacement and
   host-reassignment socket coverage specifically for Codenames if useful (shared
   session tests already exercise those mechanisms).
2. Add an actual browser race with two active operatives confirming concurrently;
   current real socket test covers authoritative racing, browser tests cover local
   confirmation, competing-state cleanup and reconnect separately.
3. Independently inspect review rejection, penalty skip/benefit, civilian/enemy
   reveals, finite budget/end-turn, local final-agent fixture and full Spanish guide
   screenshots. All corresponding rules branches are automated; not every one has
   its own multi-client browser screenshot yet.
4. Review all guide scene/content coverage and accessibility focus/announcements
   against the spec; add rulebook screenshot evidence if desired. The current common
   guide schema remains lightweight and every lesson has three explicit frames.
5. Review motion transitions at real-time playback, hidden-tab restoration and
   repeated invalid-snapshot effects; automated gate tests cover these discontinuity
   rules, but not every condition was manually filmed. Audit that private key data
   never enters animation/audio/storage/import graphs after final shared integration.
6. Coordinator updates root README, architecture, catalog AGENTS and consolidated
   validation docs for all six games and regenerates lockfile. ADR 015 is reserved
   and supplied. Do not rewrite historical ADRs.

Still externally unverified: actual Safari on macOS/iOS, physical touch/virtual
keyboard behavior, a fluent human Spanish review of both packs and copy, four-human
clue-review usability playtest, normal-device animation smoothness and adverse
network-condition testing beyond automated offline/reconnect. No such checks are
claimed passed. No optional plugins/skills were installed/imported or enabled.
