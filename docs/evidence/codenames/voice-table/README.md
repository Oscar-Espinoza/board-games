# Codenames voice-table evidence

Captured September 13, 2026 from the production build using Playwright.
Implementation decision: [ADR 018](../../../adr/018-codenames-voice-table.md).

- [Desktop](desktop.webp): paper cards on wood, red/blue spies and a civilian,
  readable labels and only Rules/Settings on the playing surface.
- [Phone, 390×844](phone.webp): all 25 cards fit, with complete portrait illustrations
  and words; long words wrap within narrow cards.
- [Assassin](assassin.webp): dark assassin artwork and the finished public key after
  dismissing the result overlay.
- [Spymaster](spymaster.webp): full private identity colours/symbols; unrevealed cards
  have no character portraits. Operative payload tests verify the key is absent.
- [WebKit desktop](webkit-desktop.webp): the same materials and public reveals.

These are visual review captures, not automated screenshot baselines. Screenshots
were inspected for material contrast, readable labels, revealed character visibility
and contained layout. Browser geometry assertions cover 1440×900, 768×1024,
390×844, 360×640 and 320×568, with separate eight-seat enlarged-text coverage.
The suite additionally records multiplayer videos in its output directories.

The complete Codenames/catalog run passed 16 Chromium/WebKit journeys. Subsequent
focused checks cover accepted audio/motion, unavailable-audio safety, finished
board locale remounts, result dismissal and opaque portraits. See the repository
[validation record](../../../validation.md) for final commands and counts.

WebKit used a temporary wrapper at `/tmp/cn-webkit-libs/webkit`, supplying extracted
Ubuntu libavif16, libgav1 and libyuv libraries to the installed Playwright binary.
No system packages were changed. Physical Safari/iOS and real-device touch/audio
remain unverified; browser automation is not a substitute for those checks.
