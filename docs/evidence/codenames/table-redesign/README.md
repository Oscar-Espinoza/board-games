# Codenames table redesign evidence

Captured from the production build on 2026-09-13 with Playwright. All review images
are WebP, encoded with Ubuntu's installed `cwebp` at quality 88. They are running-app
captures, not mockups or automated screenshot baselines.

Decision: [ADR 019](../../../adr/019-codenames-table-turns.md).
Structure: [migration](../../../codenames-redesign/migration.md).
Material/lighting precedence: [Checked-in realistic reference](../../../codenames-redesign/images/reference.webp).
Original assets and exact development prompts: [provenance](../../../../games/codenames/src/table/README.md).

## Review views

- [Desktop, eight players](desktop.webp), [team row](teams.webp), [aligned table](alignment.webp)
- [1280×720](compact-desktop.webp)
- [Tablet](tablet.webp)
- [390px phone](phone-390.webp), [360px phone](phone-360.webp), [320px phone](phone-320.webp)
- [Spanish desktop](spanish-desktop.webp), [Spanish phone](spanish-phone.webp)
- [Spymaster](spymaster.webp), [card close-up](cards.webp)
- [Phone history](history.webp), [Spanish history](spanish-history.webp)
- [WebKit desktop](webkit-desktop.webp), [WebKit phone](webkit-phone.webp)

## Visual review

The composition retains the header, mirrored team panels, central turn banner,
5×5 word grid, players and right-hand history. Only spymasters see the key panel;
operative players span both bottom columns. The practice frame has coherent round-3
history and three revealed agents per team, with no revealed assassin.

Materials follow the realistic reference rather than the procedural mockup: actual
varied leaf silhouettes, matte ceramic and coffee, granular cork, blank paper and
unlettered clothbound books. Wood and transparent props are separate local WebP
assets. The wood now resolves through an imported Vite URL in development and
production. Dark panels use smoked-glass gradients and a tiny backdrop filter; red/blue
team panels are now opaque with paper/mottled texture, per the latest reference. Filled coral/blue people icons flank
the counts, and captions align below them in mirrored compositions. Light comes from upper left; contact shadows fall lower right. Cards keep
fine fibres across cream/red/blue/civilian/assassin faces, restrained thin edges,
soft external shadows and small deterministic rotations. The subsequent card
correction follows the [supplied close-up](../../../codenames-redesign/images/card-reference.webp):
multiplied paper grain, soft surface light and no inset frame or inset shadow,
including on private spymaster cards. The latest follow-up removes corner symbols from word cards. Private key
colouring, accessible identity labels and the outside keyboard focus ring remain. Revealed words remain centred.
The reference's writing and chat are excluded. A game result always follows an
assassin reveal; the mockup's unfinished assassin state is not reproduced.

Below 1024px, compact views hide props and use a flat grid, team strip, action bar and native
history/players/key dialogs. At 200% text the same compact controls apply at every
width, with short visual team labels and full accessible turn labels. The app is
usable with the WebP requests blocked. All cards and action controls are checked
for non-zero geometry and at least 44px targets (0.01px floating-point tolerance).
Dialogs retain internal scrolling and Escape/focus return.

## Latest reference correction

The [supplied team/glass crop](../../../codenames-redesign/images/team-glass-reference.webp)
takes precedence over the earlier transparent team treatment. Team panels are
opaque with a soft mottled surface. The other table panels share clear smoked glass
with tiny backdrop blur, darkening, a warm reflection and a contact shadow. Roboto
Condensed is a closer visual approximation than Archivo, not an identified exact
font match. Word cards contain only their word. Fonts are locally bundled.

## Alignment correction

The team row, word grid and bottom panels now share their outer edges. The 30px
team inset, 10px bottom inset and perspective transform are removed. Their shared bounds are retained within the new centred desktop composition. The centre turn panel
aligns over the middle word column. Existing card rotation and compact controls remain.
Production build, formatting and all four Chromium/WebKit viewport/contrast checks passed.

## Compact desktop composition

From 1024px upward, the header and table form one centred group. The table caps
at 1120×680px, the header/decorative scene at 1440px, and the cards stop growing
on larger screens. History is centred beside the word grid, with internal scrolling
when needed. Empty history uses the same alignment. A short-window variant keeps
1024×600 usable; below 1024px and with 200% text, compact dialogs remain available.

- [1024×600](desktop-1024x600.webp), [1024×768](desktop-1024x768.webp)
- [1920×1080](desktop-1920x1080.webp), [2560×1440](desktop-2560x1440.webp)
- [Empty history](empty-history.webp)

## Validation

Centred desktop update: production build, type/Svelte checks, 320 unit/server tests
and formatting passed. All 18 distinct Codenames Chromium/WebKit cases passed across
the full run and final six-case rerun. The new layout case checks empty/populated
history, 1024×600, 1024×768, 1440×900, 1920×1080 and 2560×1440, eight players and
spymaster mode. It asserts bounded size, centring, header proximity, no row overlap,
history alignment and visibility of the last key cell. Existing six-size English/
Spanish and 200%-text coverage also passed. The brand text was slightly brightened
for contrast where the repositioned header crosses the foliage in WebKit.

Latest reference correction: type/Svelte checks, 320 unit/server tests, production
build and formatting passed. All 16 distinct Codenames Chromium/WebKit cases passed
across the full suite and final four-case material/viewport rerun. The history round
label uses primary text colour to meet 4.5:1 over the book in both engines. Tests
now also require opaque team surfaces, filtered glass, loaded condensed typography
and no symbols/images in word cards. Updated captures reflect this correction.

Earlier verification:

The wood/panel correction passed 320 game/server tests, type checks, production
build and formatting. All 16 Codenames Chromium/WebKit cases passed across the
final suite and focused keyboard verification. After the card follow-up, all eight
material/viewport/keyboard/missing-artwork cases passed again in Chromium/WebKit. The existing keyboard test now
waits for the native dialog close event before sending its next input.

The browser suite checks six sizes in English/Spanish with eight players and 200%
text, clue composition with missing artwork, keyboard confirmation, private four-
and eight-seat sessions, both wins, host rematch, reconnect, stale races without
retries, persistent key/sound/motion preferences, silent audio fallback and
accepted-only motion. Wood and all five props return HTTP 200 and decode in both
Vite development and production in Chromium and WebKit. Set
`CODENAMES_DEV_URL=http://127.0.0.1:5173` to include the running development server
in the asset test.

Contrast checks sample the actual rendered backgrounds underneath text after
hiding ink, including paper, wood, props, lighting and translucent fills. Both
turn colours and small history/player/key/header text require at least 4.5:1.
Invalid colours, empty measurements, non-finite ratios and missing targets fail.
Metadata and correct-guess text were brightened after checking the bright book
under the history panel. Final results are in [validation](../../../validation.md).

WebKit uses the existing `/tmp/cn-webkit-libs/webkit` wrapper on this machine to
supply locally extracted codec libraries. This is development infrastructure only.
Review capture generation requires `cwebp` (`webp` package on Ubuntu); it adds no
application runtime dependency.

Physical Safari/iOS, real-device touch/audio and fluent Spanish review are unverified.
