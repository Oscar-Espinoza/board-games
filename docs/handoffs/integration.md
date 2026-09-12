# Three-game integration handoff

Workspace: `/home/oscar/Projects/board-games-three-games/integration`.
Branch: `integration/three-games`.
Original checkout: `/home/oscar/Projects/board-games` on `main`, preserved.

Baseline commit `4eb18bb` snapshots tracked and nonignored untracked project work
through a temporary Git index. The original index and porcelain status were
verified unchanged after creation. Their audit record is outside all worktrees at
`/home/oscar/Projects/board-games-three-games/original-checkout.json`. The existing
Carcassonne and illustrated-library changes are included; secrets and generated
artifacts are excluded by the reviewed snapshot file list and ignore rules.

Game worktrees are siblings `azul`, `codenames`, `sushi-go-party` on corresponding
`feature/…` branches. Planning runs at Astra High, implementation at Astra Medium,
final game review/fixes at Astra High. No nested delegation. Three game owners
plus coordinator is the maximum active team. Each phase writes its game handoff
in this directory before a successor starts.

## Shared integration already implemented

- `ef5a1be`: structured `STALE_REVISION` and `MATCH_CHANGED` replies; authenticated
  `sync` returns the caller's own projection and its own action acceptance bit;
  original-ID bounded retry for Carcassonne/Codenames setup readiness and Sushi
  readiness/picks with identity/round/turn/prompt/hand/effect eligibility guards.
  Timeout recovery synchronizes before considering another submission. No
  automatic Azul drafts or Codenames guesses.
- Corner-only room controls for the three new games. Existing `settingsContent`
  carries language, invite/copy feedback, connection/room ID, leave and host
  rematch. New optional `canRematch` and `rematch` props support results controls.
  Disconnection is also visible directly on the table.
- Library covers now show selected, previous and next entries instead of using
  hard-coded three-game positions. Six names fit the desktop composition.
- `5b56db9`: preserve the last action's error code in session state and pass it to
  boards; bilingual stale/match/timeout feedback in the shared room alert.

Owners should cherry-pick `ef5a1be` before their wiring/browser checks. It is
already on integration; do not replay it during game integration. The second
shared commit will be retained when reconciling translation catalogs.

## Verification so far

- Eleven focused transport tests pass (37 assertions): retry invariants and real Socket.IO privacy,
  stale/match codes, deduplication, acceptance checks and private synchronization.
- Svelte/TypeScript check passed after the initial shared integration, zero
  warnings. Final combined checks are still required.
- Chromium and WebKit launch from an isolated temporary browser cache at
  `/tmp/board-games-three-games-browsers`. WebKit uses the `webkit` wrapper in
  that directory with locally extracted codec libraries; no system package or
  optional extension installation was needed. Set `PLAYWRIGHT_BROWSERS_PATH` to
  that directory and `WEBKIT_EXECUTABLE` to its wrapper for this machine.

## Remaining delivery

Integrate completed/reviewed Azul, Codenames, Sushi Go Party in that order;
reconcile shared registry/catalog/artwork/guide loaders/messages, regenerate Bun
lockfile, and run combined checks/build/tests/Chromium/WebKit/format. Inspect and
retain screenshots and motion recordings. Update root README, architecture,
AGENTS, rules/library coverage and validation with actual outcomes. Verify
original checkout/index unchanged again before delivery. Actual Safari hardware,
human group playtesting and fluent Spanish review remain separate, unverified
unless real evidence becomes available.

## Integration checkpoint

Azul Medium implementation and wiring are on integration as `c15a022` / `2edae65`
(from owner `f2eb656` / `a000b06`). Its original planning handoff is preserved;
Medium evidence including `b0df8ea` is in `azul-implementation.md`, so skip the
owner's separate handoff commit. High review is complete in the Azul worktree.

Codenames Medium implementation and wiring are on integration as `db7554b` /
`86a96c4` (from `23aa459` / `ccb1c57`). Its Medium handoff `bf2b10d` was copied into
integration via `b327de7`, so skip that owner handoff commit. High review is complete.
Shared catalog order preserves UNO/Catan/Carcassonne, then Azul/Codenames/Sushi.
Expected conflicts in manifests, message catalogs and lazy registries were
resolved by retaining each game's independent additions and shared error copy.

Five-game integrated type/Svelte check passed with zero errors/warnings. A current
uncommitted Bun lockfile reflects newly linked game packages; regenerate after
Sushi wiring before committing it. New all-six library tests intentionally wait
for Sushi's package/guide to land before their first run.

Shared `3560bf3` freezes the JSON wire representation before attempt 1, preventing
reactive selection edits from changing retained intentions. Nine retry-helper
tests pass, including a proxied payload changed during synchronization. The
existing real socket tests also passed earlier. Updated root catalog browser
checks now guard all six board chunks against eager loading.

Reviewer discovery propagated to all owners: Paraglide's default document reload
loses local in-memory practice progress. Use `reload:false` with locale-reactive
rendering, and verify an actual accepted action survives the locale switch.
Multiplayer state remains server-backed across reload.

## Reviewed game integration

Azul High fixes and final handoff are integrated as `5230b2c` / `d72c08b`
(owner `e2ecd17` / `9923c28`). They correct right-to-left pattern filling,
wall contrast and accessible labels, compact opponent inspection, 44px controls,
local practice language continuity and axis scoring explanations. See
[Azul review](azul-review.md) and [visual evidence](../evidence/azul/README.md).

Codenames High fixes/evidence are integrated as `76fffbc` / `41d62cc`
(owner `ded18f8` / `8c25ee1`). The final warm leather/wood table adjustment is
`332d2be` (owner `cec03e9`). The review covers competing operative confirmations,
clue review and penalties, reservation guidance, sound/presentation lifecycle,
compact controls and practice language continuity. See
[Codenames review](codenames-review.md) and
[visual evidence](../evidence/codenames/README.md).

`f4851e6` extends library coverage documentation and bilingual key checks to all
six games. Sushi's implementation is completing its commit/handoff phase; its
independent High review and final combined verification remain pending.

## Six-game implementation checkpoint

Sushi Medium implementation, translations and registration are integrated as
`a60cc3f` / `2814027` / `c10296c` (owner `c503066` / `930e46c` / `d02059e`).
The full Medium handoff, including final owner `a3ece84`, is preserved in
[sushi-go-party-implementation.md](sushi-go-party-implementation.md); do not
replay that handoff commit onto the planning document. Independent High review
is active, including complete library scoring examples and effect cancellation.

`d2829d1` records the regenerated six-game Bun lockfile and fixes lazy-loading
checks to recognize shared Board chunks without relying on source-path keys.
Combined frozen installation, check (zero errors/warnings), build, and 261 tests
with 39,705 assertions passed. Formatting passed after normalizing two handoffs/
coverage tables. The broad Chromium/WebKit run is underway; the new guide journey
awaits Sushi's illustrated-scene corrections. All owned servers must stop after
validation, per the user's explicit follow-up instruction.

## Original checkout advanced independently

Preservation audit found original `main` now at `7d69ad1`, committed at 03:02:47
on September 12, with a clean checkout. Its tree exactly matches the captured
baseline `4eb18bb`; their diff is empty. Original status/index therefore no longer
match the initial dirty record, but every captured source file does. Preserve this
new commit and clean checkout. Integration records `7d69ad1` as a parent via a
merge retaining the current integration tree, justified by that exact tree equality.
This keeps the delivery based on current main without replaying the same baseline.
