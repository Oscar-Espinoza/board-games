# Codenames browser evidence

Captured September 12, 2026 from the Codenames owner branch, including High fixes
in `ded18f8`. These are disposable test rooms and explicitly local training cases.
No publisher artwork is used.

- `operative-desktop.webp`, `spymaster-desktop.webp`: independent multiplayer roles.
- `waiting-webkit.webp`: disconnected required spymaster and actual seat reservation.
- `eight-seat-setup.webp`, `race-confirmation.webp`, `race-settled.webp`: eight independent
  contexts, fixed Spanish word pack, two distinct operative confirmations carrying
  the same revision, exactly one accepted reveal and a fresh second confirmation.
- `phone-320.webp`, `phone-360.webp`, `phone-390.webp`, `enlarged-text-320.webp`: five-column
  layout and deliberate vertical scrolling. Enlarged text shows an expanded roster;
  the board remains further down the same scroll region.
- `review.webp`, `penalty-webkit.webp`, `civilian-handoff.webp`,
  `enemy-handoff-phone.webp`: review, own-agent penalty selection and wrong guesses.
- `history-settings-phone.webp`, `spanish-connection-webkit.webp`,
  `spanish-review-webkit.webp`: settings and the searchable illustrated manual.
- `final-agent-phone.webp`, `assassin-result.webp`: normal and assassin outcomes.
- [Operative rounds recording](operative-rounds-chromium.webm): original Playwright
  recording, 17.08 seconds, 1280×800. Shows setup, clue/review, accepted public
  reveals, disconnect/reconnect, ordinary win, host rematch and assassin finish.
- [Review and penalty recording](review-penalty-chrome.webm): original Playwright
  recording, 3.40 seconds, 1440×900 canvas, Google Chrome 153. The automated journey
  includes viewport changes; gray margins reflect the original recording canvas.

The principal role, setup, narrow/mobile, selection, penalty, waiting, guide and
result images were opened during High review. Video frames were sampled with
FFmpeg, including a visible in-progress operative card flip and contact sheets
across both journeys. The original WebM files are preserved, not reconstructed
from screenshots. Human real-time playback, device smoothness, subjective audio,
physical touch/keyboard behavior and actual Safari devices remain unverified.

Raw final runs remain outside the repository at `/tmp/codenames-high-final/` and
`/tmp/codenames-high-review-chrome/`. The files here survive later Playwright runs.
See [High review](../../handoffs/codenames-review.md) for exact validation outcomes.
