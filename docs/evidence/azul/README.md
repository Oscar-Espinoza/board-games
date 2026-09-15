# Azul visual evidence

Captured from the built application during implementation on 2026-09-12. Artwork is original CSS/SVG. These are actual browser screenshots, not design mockups.

- `azul-desktop-opening.webp`, `azul-desktop-four.webp`: 1440×900 two/four-seat workshop tables.
- `azul-tablet-four.webp`: 768×1024, nine factories and aligned player board.
- `azul-phone-four.webp`, `azul-phone-board.webp`: 390×844 overview and scrolled local board.
- `azul-phone-overflow-preview.webp`, `azul-phone-overflow.webp`: 360×640 exact marker-before-overflow confirmation and accepted result.
- `azul-phone-spanish.webp`: Spanish local board at 360×640.
- `azul-scoring.webp`, `azul-shared-result.webp`: accepted top-to-bottom wall resolution and shared-finish ledger.
- `azul-real-*`: real multiplayer browser snapshots and final results where captured.
- `workshop-motion.webm`: six seconds of actual source→pattern/spill→center and scoring/deal movement.
- `motion-contact.webp`: sampled frames from that recording, inspected alongside the full screenshots.

The table scrolls internally on compact viewports. See [owner handoff](../../handoffs/azul.md) for actual test coverage and the explicit Safari/device-review limitations.

## High review evidence

The `azul-review-*` images were captured after the High corrections: right-to-left pattern filling, readable empty-wall motifs, compact opponent dialog and explicit empty/occupied accessible wall labels. `azul-review-text-200.webp` is WebKit at 360×640 with every computed HTML font size doubled through browser scripting; it is a text-enlargement stress check, not a claim of Safari or native browser zoom validation. `azul-review-desktop.webp` and `azul-review-scoring.webp` show the final desktop table and corrected axis contributions.

`review-motion.webm` is a short clip from the final real Chromium keyboard/scoring browser journey. It supplements the original Medium recording, whose faint wall previews and pattern direction were subsequently corrected. High independently sampled the original recording at five frames per second and inspected the final recording and updated screenshots.

## Table Light — September 13

The [corrected Table Light implementation](table-light/README.md) has separate
Chromium/WebKit after-captures, actual motion recordings and endpoint assertions.
All original captures above remain the before-images. The latest
[viewport-fit revision](table-light/viewport-fit/README.md) keeps the main screen
fixed and uses colour/destination dialogs on compact screens.

## Rich & Dramatic — September 14

The [production Rich & Dramatic evidence](rich-dramatic/README.md) supersedes
Table Light visually. It includes Chromium and WebKit 1728×960 tables, rendered-size
material close-ups, and the collapsed/open compact board tray. The earlier images
remain historical before-captures.
