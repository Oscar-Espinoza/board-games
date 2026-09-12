# Sushi Go Party browser evidence

Captured September 12, 2026 from the real built application. All names are test
participants. Chromium and Playwright WebKit used independent browser contexts
and real Socket.IO rooms; practice fixtures are explicitly identified below.

| Files (each has `chromium-` and `webkit-` variants)                                    | What they show                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `desktop-table.webp`, `round-receipt.webp`, `final-feast.webp`                            | A complete two-seat, three-round multiplayer game, reconnection and results                                                     |
| `full-match.webm`                                                                      | The actual two-browser match, simultaneous reveals, moving hand backs, scoring and rematch by the migrated host                 |
| `eight-seats.webp`, `tablet.webp`, `narrow-phone.webp`, `wide-phone.webp`                  | Eight real seats, after accepted gameplay at 1440×1000, 820×1180, 360×800 and 844×390 CSS pixels                                |
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
