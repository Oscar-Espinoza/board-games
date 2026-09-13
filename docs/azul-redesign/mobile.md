# Azul Table Light: viewport layout

The main table fits the viewport without horizontal or vertical scrolling. This requirement supersedes the earlier scrolling proposal and mockup geometry. Use actual `env(safe-area-inset-*)` values; do not reserve a fake OS band or paint a home indicator.

On wide, sufficiently tall screens, the supply circle and playable board sit side by side below a shallow row of opponent cards. All three opponents remain visible in four-player games. The footer reserves space for confirmation, costs and status. Desktop opponent previews tilt by 3°; the playable board and dialogs stay upright.

At widths ≤900px or heights ≤680px, use the compact interaction flow. Each 56px factory is one button, opening a colour dialog with counts and controls at least 44px high. Opening sends no action. Keyboard opening focuses the first colour; Escape or Cancel restores the factory's focus. Choosing a colour opens the full-size destination board and confirmation dialog. Centre colours open that destination dialog directly. Changed revisions, seats, matches or connection state invalidate the chooser. The table retains an inspectable miniature of the local board and readable exact score. No destination target is shrunk below 44px to fit.

The compact ring is a 340px square, with 56px discs on a 142px radius. The full ring is 460px square, with 96px discs on a 182px radius and direct 44px factory-tile controls. Starting angles are offset by half a spacing interval. Five, seven and nine factories use equal pixel radii, including rectangular control bounds in collision checks. The separate centre groups fit inside a 146×160px region.

Portrait phones place opponents above the ring and the local overview below it. Short landscape screens place the ring left and opponents/local overview right. Their destination dialog places the full board beside confirmation. Round explanations and results use dialogs, preserving access without extending the main table. Help and inspection may scroll internally when their full content exceeds a small viewport; the main screen never scrolls.

Required automated sizes: 360×640, 390×844, 768×1024, 1100×700, 1440×900, 1280×720 and 720×450, in Chromium and WebKit. Assert that the document and table have no scroll range, table regions remain inside the viewport, and draft confirmation stays visible. Physical Safari, actual device touch/audio and fluent Spanish review remain unverified until a person performs them.
