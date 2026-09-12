# Sushi Go Party independent review

Reviewed September 12, 2026 in `feature/sushi-go-party`, after Medium delivery
`c503066`, `930e46c`, `d02059e` and `a3ece84`. The review stayed in the Sushi
worktree, used no nested agents or optional plugins, and preserved the unrelated
`bun.lock` change. `plan_turn` was not exposed; direct repository searches were
used. The coordinator owns shared registration, transport fixes and the final
combined catalog validation.

## Findings and fixes

1. **Old snapshots could rewind the cosmetic cursor.** `EventCursor` now ignores
   older/equal sequences without moving its baseline backward. Its explicit reset
   establishes a fresh baseline after lifecycle interruptions. A regression sends
   10, 11, 9, 10, 11, 12 and verifies the old effects never replay.
2. **Hidden tabs and interrupted transitions left stale visuals active.** The
   Board now cancels every reveal/score/pass effect and timer on visibility,
   reconnect/scope changes, gaps, resize, preference changes and disposal. A
   generation guard prevents an already queued Svelte `tick()` from starting a
   canceled pass. Hidden/disconnected states do not play event audio. Restoring a
   tab initializes at the latest state. Browser instrumentation checks actual
   source/destination seat coordinates, gesture-only audio initialization, hidden
   audio suppression, mute, motion settings and cancellation without replay.
3. **The illustrated library did not teach scoring.** All 26 lessons now have
   three authored states with actual card counts, shapes, comparisons, exchange
   destinations and numerical outcomes. Examples include incomplete/complete
   sets, Tofu overcollection, Onigiri 16+1, tied Maki ranks, simultaneous Uramaki
   places, whole-turn Miso collisions, private Spoon supplier selection, Menu's
   four-card offer, copied utensils and linked Wasabi boxing. English and Spanish
   captions and accessible `role="img"` labels explain each frame. Artwork uses
   the existing original Dish SVG; catalog imports remain lazy. Lesson count
   stays **26**.
4. **360×640 had overlapping table regions.** Actual captures showed the lower
   opponents and wrapped menu underneath the player's area despite passing
   confirmation-button bounds checks. Short phones now use a compact, stable
   clockwise seat arrangement and a scrollable single-row menu. The regression
   checks nonoverlap and 44-pixel public-tray targets. Desktop/tablet/larger-phone
   composition is retained.

The pale Nigiri topping questioned during review is the intended squid variant.
The public projection and Card/Dish props preserve its variant; no face data was
being dropped.

## Rules and privacy assessment

Fresh review covered `cards.ts`, `menus.ts`, `scoring.ts`, the accepted-action
resolver and recipient projections, presentation/effects, Board/Card/Dish,
practice isolation, the socket regressions and prior evidence. The
[Gamewright rulebook](https://gamewright.com/pdfs/Rules/SushiGoPartyTM-RULES.pdf)
was reopened, including primary/bonus ordering, simultaneous Uramaki, whole-turn
Miso and Special Order/Takeout clauses (printed pages 6, 9, 11–15). The prior
photographic manifest record and named C1–C7 conventions remain disclosed in the
[game rules](../games/sushi-go-party.md); this review does not claim to have
independently photographed the physical box or resolved those conventions through
new publisher evidence.

No additional engine defect was found in the reviewed advanced branches. The
engine retains explicit physical zones, frozen copied appearances, actor-owned
saved prompts, hand-handle renewal after ownership changes and allowlisted
recipient/event projections. Miso retains the complete turn ledger; primary
Uramaki crosses as one batch, and immediate points remain separate from receipt
deltas. Returned copied utensils restore their physical Special Order identity;
boxed links, copies and retained desserts follow the documented behavior.

A new adversarial physical-state fixture starts round three at six seats with
12 fruit cards and all three dessert-copy Special Orders retained. The accepted
READY actions deal 48 cards and leave only six in the deck. Three accepted Menu
resolutions each receive four-card offers and finish with three deck cards, with
physical conservation after every transition. This is a deliberately arranged
worst-case fixture, not a claim that a random complete match reached that state.

Socket tests now inspect captured payloads for every other recipient's original
hand handles, including all eight seats. Menu and Spoon supplier privacy and
reconnection assertions inspect actual delivered snapshots, not just an internal
`rooms.view()` result. Existing reconnect-before/after-commit, expired replacement,
host migration, spoofing, stale handles and same-ID continuation regressions were
reviewed. The coordinator's newer shared wire-snapshot/localized-alert commits
were not cherry-picked here and must not be duplicated during integration.

## Validation

- `bun run check`: passed, zero Svelte errors/warnings and clean TypeScript.
- `bun run build`: passed after the final short-phone changes.
- New/strengthened focused rules/socket checks: **5 passed, 18,595 assertions**.
  The coordinator already ran the broad rules suite; this review did not repeat
  every previously passing seeded game test.
- The complete Sushi Playwright file passed **12 checks** across Chromium and
  WebKit after the lifecycle/lesson changes. This includes full three-round
  multiplayer/rematch, eight independent seats using Spoon/Chopsticks, advanced
  practice, locale state preservation, all 26×3 lesson frames in both languages,
  and the presentation lifecycle/audio instrumentation.
- After the final short-phone fix, the affected eight-seat, advanced-practice and
  lifecycle checks were rerun in both engines: **6 passed**. Whole-catalog final
  checks belong to the coordinator.
- Changed maintained files passed Prettier and whitespace validation. Browser
  binaries use the isolated shared cache; no browser install or cache GC occurred.

[Evidence index](../evidence/sushi-go-party/README.md) distinguishes real rooms,
local rule fixtures and instrumentation. Captures include exact 1440×900,
768×1024, 390×844 and 360×640 viewports plus landscape. Actual videos and decoded
frames were inspected; no mockup/slideshow is described as gameplay video.

Physical Safari devices, OS-level backgrounding, a live human group playtest,
subjective speaker quality and a full device accessibility audit remain
unverified. WebKit automation and synthetic visibility/audio instrumentation do
not replace those checks.

## Integration and cleanup

The implementation review commit is `0f32d7f`. Apply it and the evidence/handoff
commit reported to the coordinator. Do not copy
`bun.lock` or reapply the shared `79e4c79` transport cherry-pick. All servers opened
by this review were owned by Playwright on port 3113 and have stopped. A final
listener check found ports 3113, 3013 and 5183 unused. No standalone server was
started on 3013 or 5183.
