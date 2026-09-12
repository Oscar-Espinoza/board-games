# Six-game integration evidence

These are actual browser captures from `integration/three-games`, not mockups.
All participant names in game evidence belong to automated test clients.

- `six-game-library-1440.webp`, `six-game-library-768.webp`,
  `six-game-library-390.webp`, `six-game-library-360.webp`: Chromium at 1440×900,
  768×1024, 390×844 and 360×640. The phone images include the scrollable page.
  Every selector was keyboard-activated; all six covers were checked for overflow.
- [Azul](../azul/README.md): ceramic source/destination movement, pattern and
  floor previews, wall scoring, desktop and compact boards, actual motion clips.
- [Codenames](../codenames/README.md): warm briefing table, operative/spymaster
  projections, clue review and penalty, eight seats, phone layouts and motion.
- [Sushi Go Party](../sushi-go-party/README.md): complete three-round tables,
  eight seats, advanced private choices, hand circulation, receipts and rematch.

The coordinator inspected the desktop and phone library renders and all three
games' desktop/phone evidence. Reviewers also inspected their game recordings and
captured corrections; their handoffs record the exact scope. Screenshots alone
cannot establish keyboard, audio, privacy or network behavior; the corresponding
browser and socket tests provide that evidence.

See [validation](../../validation.md) for actual combined check results. Physical
Safari devices, subjective audio listening, human group playtesting and fluent
Spanish review remain unverified.
