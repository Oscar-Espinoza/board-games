# Catan physical tabletop evidence

September 15, 2026. These captures show the production `games/catan/src/Board.svelte`
through the existing `/practice/catan` route, which runs the real engine. The
production fixture was advanced with ordinary Roll dice and Buy development
actions. Captures wait for accepted effects to settle; no state was injected.
The multiplayer route mounts the same board and passed three/six-player journeys.

| Capture                               | Browser / CSS viewport                    |
| ------------------------------------- | ----------------------------------------- |
| [Desktop](desktop.webp)               | Chromium, 1672×941, device scale factor 1 |
| [Laptop](laptop.webp)                 | Chromium, 1280×720, device scale factor 1 |
| [Phone](phone.webp)                   | Chromium, 390×844, device scale factor 1  |
| [WebKit desktop](webkit-desktop.webp) | WebKit, 1672×941, device scale factor 1   |

The attached user reference guided composition and materials. Actual board
randomization, active seat, scores, hands, private development cards and available
actions follow the engine, so the pictured game state differs from the reference.
The background contains no pieces or interface. Wood controls, player plaques,
costs, hand quantities and gameplay feedback remain live HTML/SVG.

Visual iterations corrected board scale, plaque/count collisions, harbor overlap,
number-token size, compact controls, and a purchase animation that displaced a
centered plaque. Desktop and phone captures have no document overflow; both
browser captures reported no page errors. The Chromium capture also recorded no
failed requests. WebKit used locally extracted codec dependencies in
`/tmp/catan-webkit.X2va7s/webkit`; no JIT workaround was needed in the passing run.

Final WebKit image review also caught misplaced resource art inside SVG
`foreignObject`, unsupported brightness filter attributes on piece faces, and a
native white language selector. Harbors now use native SVG images; wooden faces
use explicit shaded colours; the selector disables native appearance. All ten
focused Chromium/WebKit cases passed after those corrections, including measured
harbor-icon bounds. Final screenshots were recaptured from the built server to
avoid development-server reloads during capture.

Follow-up visual review removed the blue sea frame, leaving the sand-edged island
directly on the ocean. The captures above were refreshed. All eight focused
Chromium/WebKit checks passed for layout, harbors, zoom/pan and dice placement;
typechecks and the production build also passed.

Migration validation: 323 unit/server tests; zero Svelte/TypeScript errors or warnings;
production build; 53 Chromium/WebKit browser cases passed. One WebKit case is
skipped because native multi-touch injection uses Chromium CDP. Physical Safari
and real-device touch/audio remain unverified.

See [decision](../../../adr/022-catan-physical-table.md) and
[asset provenance / prompts](../../../games/catan-assets.md).
