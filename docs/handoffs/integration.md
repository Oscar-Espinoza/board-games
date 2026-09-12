# Three-game integration handoff

Delivery workspace: `/home/oscar/Projects/board-games-three-games/integration`.
Branch: `integration/three-games`. All three planning, implementation and
independent review phases are complete. Final combined verification is recorded
in [validation](../validation.md); [visual evidence](../evidence/integration/README.md)
links the actual table captures and recordings.

## Checkout preservation and ancestry

Baseline `4eb18bb` captured tracked and nonignored untracked project work through
a temporary Git index, including the existing Carcassonne/library work. Reviewed
ignore rules and the snapshot file list excluded secrets and generated artifacts.
The original checkout/index were verified unchanged at baseline creation; the
initial audit lives outside discovery/worktree directories at
`/home/oscar/Projects/board-games-three-games/original-checkout.json`.

During the run, original `main` advanced independently to `7d69ad1` ("Carcassone
added, catan improvements added") and became clean. Its tree exactly matches
`4eb18bb`. Integration merge `6b1d5cd` records that already-contained main commit
as an ancestor while retaining the integration tree unchanged. No original
checkout reset, switch or history rewrite was performed. Its initial dirty
index/status audit is historical; it must not be restored over this newer commit.

Game worktrees remain siblings `azul`, `codenames` and `sushi-go-party` on
`feature/azul`, `feature/codenames`, `feature/sushi-go-party`. The user-requested
Astra High → Medium → High phases used no nested delegation and never exceeded
three owners plus coordinator. Owners' uncommitted Bun lockfile updates were
excluded; the combined lockfile was regenerated and frozen installation passed.

## Integrated ownership

| Game           | Implementation / wiring on integration | High review on integration                   | Handoffs                                                                                                              |
| -------------- | -------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Azul           | `c15a022`, `2edae65`                   | `5230b2c`, `d72c08b`                         | [planning](azul.md), [implementation](azul-implementation.md), [review](azul-review.md)                               |
| Codenames      | `db7554b`, `86a96c4`                   | `76fffbc`, `41d62cc`, warm palette `332d2be` | [planning](codenames.md), [implementation](codenames-implementation.md), [review](codenames-review.md)                |
| Sushi Go Party | `a60cc3f`, `2814027`, `c10296c`        | `d4963f4`, `5f6abe9`                         | [planning](sushi-go-party.md), [implementation](sushi-go-party-implementation.md), [review](sushi-go-party-review.md) |

Planning handoffs are preserved separately from Medium delivery appendices.
Do not replay owners' separate final handoff commits: their contents are already
included. The owner review documents map original commit IDs and exact evidence.

## Shared integration

- `ef5a1be`: structured `STALE_REVISION` / `MATCH_CHANGED` replies and an
  authenticated `sync` returning only the caller's current projection and its
  own action acceptance bit. Timeout recovery synchronizes before retrying.
- `3560bf3`: freeze the JSON wire representation before submission, unwrapping
  Svelte proxies and retaining the same selection and ID for at most three total
  attempts. Carcassonne/Codenames readiness and Sushi readiness/picks revalidate
  seat, room, match, setup or round/turn/prompt, ownership and uncommitted state.
  Passed hands invalidate old picks. Azul drafts/Codenames guesses never retry.
- `5b56db9`: retain error codes in session/board props and provide bilingual
  stale/match/timeout feedback. Game-owned error keys are translated by the room.
- New-game rooms use corner controls. Existing `settingsContent` supplies locale,
  invite/copy feedback, connection/room ID, leave and host rematch; optional
  `canRematch` / `rematch` props also support results. Connection failures remain
  visible directly on the table.
- Lazy metadata/boards/guides preserve UNO/Catan/Carcassonne order and append
  Azul/Codenames/Sushi. Covers use selected/previous/next entries, with six desktop
  selectors and readable compact layouts. The library has 118 bilingual lessons.
- `d2829d1`: combined dependency lockfile and lazy-loading checks that account for
  source-keyed or shared Board chunks. All six boards are covered.

## Verification and environment

Final combined check passed with zero errors/warnings; 263 rules/session/content
tests passed with 53,401 assertions; the production frontend/server build and
frozen workspace installation passed. Browser and final formatting results are
in [validation](../validation.md), including the original test lookup correction,
focused reruns and the inherited WebKit-only native pinch skip.

Browser binaries are isolated at `/tmp/board-games-three-games-browsers` to avoid
unrelated browser-cache cleanup. Set `PLAYWRIGHT_BROWSERS_PATH` there and
`WEBKIT_EXECUTABLE` to its `webkit` wrapper. The wrapper uses locally extracted
codec libraries under `/tmp/board-games-browser-deps`; no system package or new
optional plugin was installed. These temporary paths are test-machine details,
not player/runtime requirements.

Integration browser tests use port 3110. Owners used 3111/3112/3113, with allocated
backend ports 3011/3012/3013 and Vite ports 5181/5182/5183. The user's explicit
follow-up requires every owned server to stop after validation; final listener
verification is recorded with the results.

Physical Safari devices, native OS backgrounding, human group playtesting,
subjective speaker quality and fluent Spanish review remain unverified. Automated
matches, WebKit and synthetic visibility/audio instrumentation do not replace them.
