# Azul Rich & Dramatic: viewport layout

The main table fits the viewport without horizontal or vertical scrolling. This requirement supersedes the earlier scrolling proposal and mockup geometry. Use actual `env(safe-area-inset-*)` values; do not reserve a fake OS band or paint a home indicator.

On wide, sufficiently tall screens, a perspective-correct factory ring surrounds the loose centre and the playable board sits below the lowest plate. All three opponents remain visible around the upper and side edges in four-player games. Plate, centre and board rectangles must not overlap. Confirmation and status occupy the lower side space without moving the physical composition.

At widths ≤900px or heights ≤800px, use the compact interaction flow. Each 56px factory is one button, opening a colour dialog with counts and controls at least 44px high. Opening sends no action. Keyboard opening focuses the first colour; Escape or Cancel restores factory focus. Choosing a colour opens the full-size destination/confirmation dialog; centre colours open it directly. Changed revisions, seats, matches or connection state invalidate the chooser.

The local board is a collapsed-by-default tray with a 44px toggle, name, exact score and live miniature. Expanding it overlays the lower table and may intentionally cover lower factories; collapsing restores the complete ring. The choice is not persisted. Only one board instance exists, so its exact anchors remain unique and nonzero in either state. The expanded main board stays noninteractive because draft destinations remain in the full-size dialog.

The compact ring is a 340px circle with 56px plates on a 142px radius. The desktop ring is 926×486px with 126px plates on 400×180px radii and direct 44px tile controls. Starting angles are offset by half an interval. Five, seven and nine factories use equal angular spacing. The centre is 146×160px compact and 198×160px desktop; full plate bounds participate in collision checks.

Portrait phones place opponents above the ring and the collapsed tray below it. Short landscape screens place the ring left and opponents/tray right. Optional lantern, chest and tea props are hidden. Destination, help, inspection, round-detail and result dialogs may scroll internally; the main screen never scrolls.

Required automated sizes: 360×640, 390×844, 720×450, 768×1024, 1100×700, 1280×720, 1440×900 and authoritative 1728×960, in Chromium and WebKit. Assert zero document/table scroll, contained regions, visible confirmation, tray behavior, unique anchors and no factory/centre/board collisions. Physical Safari, actual device touch/audio and fluent Spanish review remain manual.
