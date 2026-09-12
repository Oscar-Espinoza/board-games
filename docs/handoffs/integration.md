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

- Ten focused transport tests pass: retry invariants and real Socket.IO privacy,
  stale/match codes, deduplication, acceptance checks and private synchronization.
- Svelte/TypeScript check passed after the initial shared integration, zero
  warnings. Final combined checks are still required.
- WebKit binary is present but its local libavif16 dependency was unavailable.
  Coordinator is recreating the temporary wrapper documented in validation.md;
  no system package or optional extension installation is needed.

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
owner's separate handoff commit. High review is active in the Azul worktree.

Codenames Medium implementation and wiring are on integration as `db7554b` /
`86a96c4` (from `23aa459` / `ccb1c57`). Its Medium handoff `bf2b10d` was copied into
integration via `b327de7`, so skip that owner handoff commit. High review is active.
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
