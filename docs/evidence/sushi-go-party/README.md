# Sushi Go Party browser evidence

Captured September 12, 2026 from the real built application. All names are test
participants. Chromium and Playwright WebKit used independent browser contexts
and real Socket.IO rooms; practice fixtures are explicitly identified below.

| Files (each has `chromium-` and `webkit-` variants)                                    | What they show                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-table.webp`, `round-receipt.webp`, `final-feast.webp`                            | A complete two-seat, three-round multiplayer game, reconnection and results                                                     |
| `full-match.webm`                                                                      | The actual two-browser match, simultaneous reveals, moving hand backs, scoring and rematch by the migrated host                 |
| `eight-seats.webp`, `tablet.webp`, `narrow-phone.webp`, `wide-phone.webp`                  | Eight real seats, after accepted gameplay at 1440×900, 768×1024, 360×640 and 844×390 CSS pixels                                 |
| `eight-seat-drafting.webm`                                                             | Eight-seat Big Banquet play, observed Spoon and Chopsticks prompts, round scoring and accepted turns at every listed viewport   |
| `advanced-menu.webp`, `advanced-copy.webp`, `advanced-takeout.webp`, `advanced-spoon.webp` | Separate local practice prompts using real rules and conserved fixtures; Menu/copy at two seats, Spoon at three                 |
| `advanced-prompts.webm`                                                                | Keyboard-operated advanced practice with unavailable AudioContext and reduced motion                                            |
| `settings-spanish.webp`                                                                 | Persisted mute and motion settings after multiplayer language switching/reconnect                                               |
| `spanish-preserved-offer.webp`, `local-language.webm`                                   | A noninitial local Menu offer survives a language switch with identical prompt ID, private offer handles, round, turn and score |

The author inspected desktop, tablet, narrow-phone, landscape-phone and advanced
prompt screenshots, and sampled the actual full-match/eight-seat recordings as
contact sheets. This exposed and corrected clipped landscape confirmation controls
and overlapping tablet seats. The passing browser tests also check the confirmation
button's viewport bounds and guide-trigger focus restoration.

Recordings use Playwright's capture resolution; screenshots preserve the browser's
full render resolution. No human group playtest, physical Safari device run or
subjective speaker/audio-quality test is claimed. WebKit automation does not
replace Safari-device validation. Recordings are actual browser video, not a
mockup or a screenshot slideshow.

Tests write these files directly so subsequent focused Playwright runs cannot
remove the evidence by clearing `test-results/`.

## Independent review additions

The High review refreshed room screenshots and recordings after the presentation
lifecycle changes, then refreshed affected eight-seat/practice/lifecycle evidence
after fixing short-phone overlap. `portrait-phone.webp` adds the required 390×844
portrait view. The desktop, tablet, narrow phone and portrait phone now cover
exactly 1440×900, 768×1024, 360×640 and 390×844 in both engines. The short-phone
layout keeps stable clockwise seats in two rows and a horizontally scrollable
menu; all seven public tray targets remain at least 44 pixels high.

Additional files, each with Chromium and WebKit variants:

- `lesson-onigiri-en.webp`, `lesson-onigiri-es.webp`: the authored 16 + 1 = 17
  scoring diagram at 360×640. Each tile is one card and outlined plates show
  separate scoring sets.
- `authored-lessons.webm`: actual browser walkthrough of all 26 lessons, all three
  distinct frames, in both languages. Every scene has a localized accessible
  image label containing its frame's explanation.
- `lifecycle-phone-640.webp`, `presentation-lifecycle.webm`: accepted local
  two-seat actions, instrumented seat-to-seat hand paths, visibility-event
  cancellation, restoration without replay, resize cancellation, mute and reduced
  motion. This test simulates document visibility events and AudioContext to
  observe calls; it is not an OS backgrounding or subjective listening test.

The review inspected actual screenshot renders and decoded frame sequences from
both engines' recorded videos, including full-match/eight-seat play and the
lifecycle clip. It found the 360×640 overlap that button-bounds tests had missed;
regressions now check separation of opponent trays, menu and the player's area.
Recordings remain actual Playwright videos, with screenshots at full viewport
resolution. No physical Safari device or live human group validation is claimed.
