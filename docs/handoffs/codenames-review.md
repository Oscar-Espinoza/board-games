# Codenames High review → integration

September 12, 2026. High review and fixes are complete in
`/home/oscar/Projects/board-games-three-games/codenames`, branch `feature/codenames`.
The owner used no nested agents, optional plugins or original-checkout edits.

## Final warm-table presentation follow-up

The coordinator's final visual review required a warm spy briefing table distinct
from Azul's ink-blue table. This small follow-up changes only Codenames surface
colors: dark leather/wood `#30251e`, a warm `#574235` light pool and subtle CSS grain,
with matching brown corner buttons, clue strip, confirmation tray and backdrop.
Ivory dossiers, crimson/cobalt identities, layout, rules and interaction logic are
unchanged. High review opened the final Chromium operative desktop, 390px phone
and WebKit spymaster desktop screenshots and confirmed the visual direction.

Contrast calculations using WCAG relative luminance: paper/base table **12.88:1**,
paper/lightest conservative grain bound **7.74:1**, muted hint/lightest bound
**5.73:1**, paper/corner **10.22:1**, paper/hover **7.16:1**, paper/confirmation
**14.84:1**, focus/lightest bound **5.85:1**. Dossier ink/paper remains **13.34:1**.
The lightest bound `#5a4538` conservatively includes the pale grain overlay.

Validation: production build passed; changed-source Prettier and `git diff --check`
passed. Existing four-client round/reconnect/rematch and responsive screenshot
journeys passed **4/4 in Chromium and WebKit** (32.8s), using:

`PLAYWRIGHT_BROWSERS_PATH=/tmp/board-games-three-games-browsers WEBKIT_EXECUTABLE=/tmp/board-games-three-games-browsers/webkit TEST_PORT=3112 bun run test:e2e tests/e2e/codenames.spec.ts --grep 'four private|responsive practice' --output=/tmp/codenames-warm-final`

Selected desktop/phone/result/reservation PNGs are refreshed in the evidence
folder, with additional 1440px desktop and 390px WebKit images. The evidence index
identifies remaining prior-palette functional captures. No logic/unit tests were
added or rerun for this CSS-only follow-up. Earlier manual-device limits remain.

Coordinator already integrated `ded18f8` and `8c25ee1` as `76fffbc` and `41d62cc`;
apply only this new palette/evidence commit. The owner handoff is updated here;
coordinator will integrate it by cherry-pick, avoiding an overwrite of the tracked
integration handoff. `bun.lock` remains uncommitted.

## Integration commits

Apply the existing Medium commits `23aa459` (game) and `ccb1c57` (wiring/messages),
then **`ded18f8`** (High fixes/tests), then the following evidence/handoff commit.
Do not replay prerequisite `345496d`: integration already has `ef5a1be`.
Coordinator has already copied the Medium handoff; skip `bf2b10d`.
`bun.lock` is intentionally still locally dirty and uncommitted; regenerate centrally.

The owner did not cherry-pick coordinator's later `5b56db9`/`3560bf3`. Preserve those
shared error-code/localization and serialized-intention fixes during integration.
Board accepts their `errorCode` prop; tests avoid asserting the old stale-error copy.
Coordinator retains shared room/session, catalog-wide docs and final regression work.

## Findings fixed

1. Practice interface-language changes used Paraglide's default document reload,
   losing the in-memory case. The deterministic fixture concealed that defect in
   the original word-only test. Locale changes now remount localized Board content
   without reloading the page or changing the game object. Tests preserve the clue,
   guessing phase, board words and finished state across English → Spanish.
2. Resize, visibility and motion resets cleared the event baseline without settling
   it to the current snapshot, suppressing the next genuinely new reveal. They now
   establish the baseline immediately. Sequence gaps, backwards snapshots and role
   changes also cancel existing motion/audio; repeated snapshots leave live motion
   alone. Browser checks verify a fresh reveal after resize/visibility still flips
   and stamps exactly once. Reconnect still waits for a fresh snapshot object.
3. Waiting screens now identify the responsible names, team and role. Disconnected
   responsible seats display the real reservation deadline or replacement status.
   Review/penalty headings identify the acting team; penalty instructions explicitly
   offer one own-agent selection or skipping. Clue drafts clear on seat/round change.
4. Added distinct short synthesized public clue/reveal/handoff/result cues and
   handoff emphasis. Sound stays gesture-gated; mute cancels sources and prevents
   later accepted-event playback. Volume and motion preferences persist correctly.
5. Settings checkbox labels now have 44px touch targets. Manual search has a 44px
   input and clear focus styling. Added a bilingual illustrated reconnect/replacement
   lesson covering consent, locked roles and host privacy.
6. The browser rematch test now follows the current host after disconnection promotes
   another seat. Its old original-host assumption was nondeterministic. The new
   practice journey waits for hydration before reading the local training key.

## Review and new coverage

Reviewed canonical phase/actor rules, option/clue/index validation, readiness and
presence, word-pack handling, review boundaries, penalties, finite/zero/unlimited
budgets, all wins, projection allowlists, events/history, imports/storage, Board
controls, motion/audio, guide and local fixtures. No canonical rule/privacy defect
was found. Added all finite counts and role×phase rejection coverage, malformed
options, and hidden-key permutations guaranteed to change identities across clue,
review, guessing and penalty views.

The original socket race now uses **two distinct operative sockets** among six
seats. New real-socket coverage verifies setup disconnect/reconnect, expiry and
replacement, all-consent invalidation, token rejection, host promotion without key
access, absent spymasters blocking clue/review, locked replacement roles and the
same key after replacement. It uses a test-owned clock, not a production endpoint.

The eight-context browser test uses a transport barrier around real browser-created
confirmations. Two different active operatives select locally, confirm different
words at the same revision, and flush their own WebSocket messages. Exactly one
stale rejection and one reveal occur; neither browser retries its guess. Both
confirmation trays clear, operative DOMs stay private, and a fresh selection plus
confirmation reveals the remaining chosen word.

The new visual journey covers review rejection, own-agent penalty benefit, skip,
count-plus-one exhaustion, mandatory first guess, zero/unlimited budgets, civilian
and enemy handoffs, history, final-agent win, Spanish manual search and locale
preservation. Existing four-context round/reconnect/rematch/assassin, responsive,
keyboard, privacy, audio-unavailable and muted/reduced-motion cases remain covered.

## Actual validation

- `bun run check`: passed, 0 errors / 0 warnings, after final application changes.
- `bun run build`: passed after final application changes.
- `bun run format:check` and `git diff --check`: passed.
- `bun test games/codenames/src/index.test.ts apps/server/src/codenames-socket.test.ts`:
  **16 passed, 541 assertions**.
- Earlier full `bun run test`: **148 passed**. Final expanded full run: **148 passed,
  1 failed** because the unchanged Catan “complete 3–6 player games…” test exceeded
  its 5-second timeout (6.35 seconds) during concurrent owner browser/build activity.
  No Catan code was altered. Coordinator will run the final combined suite after
  owner browser work stops. Do not describe that final broad run as passed.
- Final owned-port full Codenames browser run (`TEST_PORT=3112`, existing WebKit
  wrapper): **11/12 passed**. All six WebKit cases passed; Chromium's new penalty
  journey read its training key before hydration. Added an explicit 25-key-card wait.
- The attempted focused rerun could not launch either cached browser because another
  install removed shared Chromium revision 1243 and WebKit 2359. No app change or
  browser download was made in response. Coordinator is restoring an isolated cache.
- Final focused rerun with installed Google Chrome **153.0.8010.36**:
  `CHROME_CHANNEL=chrome TEST_PORT=3112 bun run test:e2e tests/e2e/codenames.spec.ts --grep 'review rejection' --project=chromium --output=/tmp/codenames-high-review-chrome`
  **1/1 passed**. Every Codenames browser case therefore has passing Chrome/Chromium
  and WebKit evidence, with the hydration fix independently confirmed in Chrome.

Full browser command:
`WEBKIT_EXECUTABLE=/tmp/board-games-browser-deps/webkit TEST_PORT=3112 bun run test:e2e tests/e2e/codenames.spec.ts --output=/tmp/codenames-high-final`.
Check/build/format logs are `/tmp/cn-high-{check,build,format}.log`; the final broad
unit run is `/tmp/cn-high-tests.log`.

## Preserved evidence and limits

[Evidence index](../evidence/codenames/README.md) preserves **19 PNGs and two original
WebM recordings** (17.08s operative multiplayer journey and 3.40s local penalty
journey). High review opened representative desktop roles, eight-seat setup and
selection, 320/360/mobile, 200% text, waiting/reservation, penalty, Spanish guide and
result images. FFmpeg frame inspection showed neutral unrevealed operative cards,
accepted flip progression, durable public reveals, ordinary win and fresh rematch.
Viewport checks cover 1440×900, 768×1024, 390×844, 360×640 and 320×568; enlarged text
uses deliberate vertical scrolling without horizontal overflow.

Actual Safari on macOS/iOS, physical touch and virtual keyboards, human real-time
smoothness/audio judgment, an independent fluent Spanish review and a four-human
clue-review playtest remain unverified. Automated review cannot establish semantic
clue quality or social friction. No such manual validation is claimed complete.
