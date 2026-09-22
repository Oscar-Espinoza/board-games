# Carcassonne painted table review

Completed September 22, 2026. The shipped board is used by multiplayer and practice.
Open `/practice/carcassonne?scenario=table` for the playable six-seat, 29-tile
landscape, or `/practice/carcassonne/artwork` for all 138 designs in four rotations.

- `completed-desktop.png`: default desktop framing and live controls.
- `completed-phone-placement.png`: a phone placement preview with confirmation.
- `chromium-painted-*.png` and `webkit-painted-*.png`: final automated evidence,
  including fitted desktop/tablet/phone landscapes and river/ferry inventories.
- Earlier `review-*`, `current-*`, `desktop-first.png` and `debug.png` files are
  intermediate captures, not the final acceptance evidence.

The tablet layout now separates the hand from the camera controls. Painting sits
under live SVG regions/symbols and does not change tile definitions. Wheel zoom,
keyboard panning, touch placement, cancelled drags, expansion choices, reconnects,
localization and no-audio play are covered in both browser engines. Physical
Safari/iOS and native pinch gestures remain unverified.

See [ADR 024](../../docs/adr/024-carcassonne-painted-table.md) and the
[validation record](../../docs/validation.md).
