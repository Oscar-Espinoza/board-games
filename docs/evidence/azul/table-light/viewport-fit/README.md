# Table Light: fixed viewport evidence

Actual built-application captures from September 13, 2026. This revision implements the requirement that the main screen never scroll. The [first Table Light iteration](../README.md) and original navy before-images remain preserved; design mockups remain separately labelled.

The `chromium/` and `webkit/` folders contain four-player table captures (`azul-fit-{width}.webp`) and destination confirmation (`azul-fit-confirm-{width}.webp`) at 360×640, 390×844, 768×1024, 1100×700, 1440×900, 720×450 and 1280×720. Each test also checks two- and three-player layouts and floor overflow. Assertions require zero document/table scroll range, table regions inside the viewport, visible confirmation and at least 44px playable rows. Attempts to scroll the main surface leave its position at zero.

Desktop places the ring beside the full playable board. Compact screens show a local board overview and use colour/destination dialogs; short landscape destination dialogs place confirmation beside the board. Opponent inspection, round details and results remain accessible through dialogs. Full help/inspection content can scroll inside its dialog when needed; it does not extend the main screen.

The additional `table-light-*` and `azul-*` images cover the crowded centre, 200% computed text sizes, inspection, Spanish, cleanup, scores above 100 and real multiplayer. Browser text enlargement is a scripted stress check, not native zoom or physical Safari validation. `scoring-motion.webm` and `phone-picker.webm` retain actual browser recordings. The scoring contact sheet samples the recording at two frames per second. Byte-identical captures are kept once under the `azul-fit-*` name: Chromium `table-light-{390,768,1100,1440}`, WebKit `table-light-{390,1440}` and both `azul-phone-four` copies matched those files.

Visual inspection compares these captures with the preserved scrolling iteration: the local board and confirmation now remain on screen, phone turn labels avoid collisions with opponent headings, and the short landscape destination dialog fits. Flight tests compare actual SVG animation endpoints and scales directly against table destinations, with 1.1px rounding tolerance and no allowance for scrolling shifts. Compact selection cancellation restores focus, and changing layout clears uncommitted selection without sending an action.

These are inspected captures, not automated screenshot-baseline comparisons. Physical Safari, real-device touch/audio and fluent Spanish editorial review remain unverified.
