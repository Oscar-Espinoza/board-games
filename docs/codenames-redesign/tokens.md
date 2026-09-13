# Implemented materials

The wood/panel correction follows the latest material plan (Image #1); the bundled
[`images/reference.webp`](images/reference.webp) is the available visual comparison.
[Runtime tokens](../../games/codenames/src/tokens.css) are authoritative. The original
mockup specifications below remain design history, including their superseded opaque
panels, blur, procedural wood, heavy bevels and inner card rules.

- `Board.svelte` imports the existing wood WebP and passes the resolved URL through
  `--cn-wood-image`, just like its imported decorative props. Vite serves the asset
  in development and emits a hashed asset in production. Horizontal grain, warm
  upper-left light and a restrained dark overlay remain visible.
- The latest [team/glass reference](images/team-glass-reference.webp) supersedes
  transparent team tints. Team surfaces are opaque red `#91332f` → `#702522` and
  blue `#15558d` → `#103e6d`, with multiplied fine paper and soft mottled texture.
- The current glass experiment uses the supplied lighter gradient: `rgba(50,38,30,.10)`
  → `rgba(20,14,10,.18)`, 2px backdrop blur, 120% saturation and 0.8 brightness.
  A faint white border, upper inset highlight, soft 4px/12px shadow and 10px corners
  follow the supplied CSS. The header, turn banner, players, key, history and compact
  action bar share it. Both prefixed and standard backdrop properties are supplied.
  Team surfaces retain their opaque fill and existing shadows. This experimental
  finish has not been tested; visual review is left to the user as requested.
- This uses the [CSS backdrop-filter mechanism](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter):
  it filters the actual scene behind a partially transparent element. Tiny blur
  preserves the grain, rather than producing a heavily frosted surface. Borders
  and inset highlights simulate the glass edge; this is not physical refraction.
- Team icons are coral `#ff786e` and blue `#189bff`. Captions remain aligned below
  prominent counts, mirrored on blue. The turn pill uses opaque red/blue gradients
  and a softer 7px radius, following the reference's coloured strip inside glass.
- Roboto Condensed replaces Archivo throughout the table and dialogs as a closer
  visual approximation of the reference. The exact original font is unknown.
  Headings and turn labels use medium weight, counts bold, and word cards semibold.
  Latin/Latin-extended variable WOFF2 files are locally bundled with their OFL license;
  no runtime font service is used. See [font provenance](../../apps/web/static/fonts/codenames/README.md).
- History team labels are `#ff9587`/`#86b9ff`; muted metadata is `#cdbfae` and
  correct guesses use `#8cda84` for small-text contrast over the brighter book.
- At widths of 1024px and above, the table is a centred composition capped at
  1120×680px. The 64px header sits directly above it; its width and the decorative
  scene cap at 1440px. Extra screen space surrounds the composition instead of
  expanding its cards or separating the header. The scene moves vertically with
  the table and props are clipped only at the viewport, not at an artificial edge.
- Clue history starts at the top of the right column, aligned with the blue team
  panel. It can grow alongside the team row and word grid, with internal scrolling
  for long history. Team, grid and bottom panels retain shared outer edges.
- Below 1024px or with enlarged text, use the compact controls and history/key/player
  dialogs. Short desktop windows (under 700px high) reduce panel padding and bottom
  panel height while retaining 44px controls and all five card rows. The 1024×600
  layout is explicitly verified. Decorative props scale down at 1024–1279px.
- Cards show only their word: no corner images or identity symbols. Private
  spymaster colouring, the mini-key, recipient-specific payloads and accessible
  identity/reveal labels remain. Paper grain, surface lighting and external edge
  shadows follow the [card close-up](images/card-reference.webp), without inset
  frames. The outside keyboard focus ring remains.

Contrast checks sample actual browser-composited pixels underneath text with only
ink temporarily hidden. That includes the wood, props, lighting, translucent fills
and card fibres at their rendered positions. Both turn colours are checked, with
at least 4.5:1 for every sampled text run. Missing targets/images, invalid colours,
empty samples and non-finite measurements fail. Gameplay is unchanged; props disappear with the compact layout below 1024px
or with enlarged text.

# Codenames Table: design tokens

Every value below comes from [`source/Main.dc.html`](source/Main.dc.html) and the
SVG props next to it, which render
[`images/design-desktop.webp`](images/design-desktop.webp). When this file and the
source disagree, the source wins. Geometry is given for the 1440×900 reference
frame. Compact layouts follow the rules in [migration](migration.md#4-compact-layouts).

Scope every token to `.cn-table`. The catalog cover and other games must not import them.

## Materials

### Wood table

- File: [`source/wood.svg`](source/wood.svg), 1440×900 and 4 KB. It replaces
  `games/codenames/src/table-wood.svg`, which is 559 KB.
- Base: diagonal gradient `#573320` → `#6a3f26` (45%) → `#3f2415`.
- Warm streaks: `feTurbulence fractalNoise 0.0012 0.02`, 3 octaves, tinted `#c77845` at low alpha.
- Grain:
  - Five horizontal planks, each 176–186 px tall.
  - Each plank has its own `fractalNoise` layer: baseFrequency ≈ `0.0018 0.05`, 5 octaves, seeds 11/42/7.
  - Grain is dark brown `#211209` with alpha `2.2·R − 0.9`.
- Fibre: `turbulence 0.0009 0.42` at 40% opacity. Pores: `fractalNoise 0.35 1.6` at 55%.
- Seams:
  - Horizontal: 3 px `#1b0e06` at 85%, with a 1 px `#b07a4b` highlight at 22%, 2.5 px below.
  - Staggered vertical end joints: 2.5 px at 75%.
- Lamp: radial gradient centred at (46%, 40%), r 78%:
  - `#f3b979` at 22% opacity in the centre.
  - `#140a04` at 28% opacity at 80% radius.
  - `#0c0603` at 62% opacity at the edge.
- The page background behind the SVG is `#3f2415`.

### Paper word card (unrevealed)

```css
background:
  url(paper.svg) /* existing 180×180 noise tile, 13% opacity */,
  radial-gradient(
    ellipse at 32% 18%,
    rgba(255, 252, 242, 0.6),
    transparent 70%
  ),
  linear-gradient(172deg, #efe6d3 0%, #e7dbc3 55%, #dacbae 100%);
border-radius: 5px;
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.75) /* top highlight */,
  inset 0 -3px 0 rgba(150, 124, 88, 0.5) /* card thickness */,
  inset 0 0 20px rgba(140, 105, 60, 0.16) /* paper edge tone */,
  0 2px 1px rgba(20, 10, 5, 0.5) /* contact shadow */,
  0 9px 14px rgba(20, 10, 5, 0.42); /* cast shadow */
text-shadow: 0 1px 0 rgba(255, 248, 230, 0.55);
```

- Inner printed rule: `::after` inset 5 px, 1 px `rgba(120, 95, 60, 0.08)`, radius 3 px.
- Hand-laid variation: a few cards are rotated by 0.4–0.5°, either direction (1-based cards 5, 7, 13, 16, 21, 24 in the mockup). This must be deterministic by card index.

### Revealed cards

Every revealed card keeps the `paper.svg` layer and the inner rule, which becomes
`rgba(255, 255, 255, 0.07)`.

| Identity | Fill (165°)                                                                                                                                 | Word colour | Edge (inset 0 −3px)     | Top highlight (inset 0 1px) |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------- | --------------------------- |
| Red      | `#e24c3d` → `#cc3c30` 55% → `#b5322a`, plus highlight `rgba(255,150,110,.35)` at 28% 22% and shade `rgba(120,20,10,.25)` at 80% 85%         | `#fff6f0`   | `rgba(95, 20, 14, .55)` | `rgba(255, 190, 170, .5)`   |
| Blue     | `#2b7de8` → `#1d67d4` 55% → `#1756b9`, plus highlight `rgba(120,180,255,.35)` and shade `rgba(8,30,90,.25)`                                 | `#f4f8ff`   | `rgba(10, 35, 95, .55)` | `rgba(170, 205, 255, .5)`   |
| Assassin | `#383533` → `#252322` 55% → `#1a1918`, plus highlight `rgba(255,255,255,.08)`                                                               | `#f1ece4`   | `rgba(0, 0, 0, .6)`     | `rgba(255, 255, 255, .14)`  |
| Civilian | Not revealed in the mockup. Use the unrevealed paper darkened with `#b9a078` → `#dbc9a2` (the current Board.svelte civilian), with ink text | `#2b2520`   | as unrevealed           | as unrevealed               |

Word text-shadow: red `0 1px 1px rgba(60, 10, 5, .35)`, blue `0 1px 1px rgba(5, 20, 60, .35)`, assassin `0 1px 1px rgba(0, 0, 0, .5)`.

### Glass panels

Used for the header, the round banner, Clue History, Players and the Spymaster key.

```css
background: linear-gradient(
  180deg,
  rgba(36, 29, 25, 0.93),
  rgba(22, 18, 15, 0.93)
);
border: 1px solid rgba(255, 236, 210, 0.09);
border-radius: 8px; /* header 10px */
box-shadow:
  inset 0 1px 0 rgba(255, 240, 220, 0.06),
  0 2px 4px rgba(8, 4, 2, 0.45),
  0 14px 30px rgba(8, 4, 2, 0.5);
backdrop-filter: blur(6px);
```

### Team status panels

- Red: `url(paper.svg)`, then radial `rgba(220,80,60,.35)` at 30% 20%, then
  linear 160° `#a52f29` → `#8a2420` 55% → `#6f1d1a`.
  - Border: 1 px `rgba(255,170,150,.18)`.
  - Shadow: inset `0 1px 0 rgba(255,190,170,.2)`, `0 2px 3px rgba(10,4,2,.5)`, `0 14px 26px rgba(10,4,2,.5)`.
- Blue: `url(paper.svg)`, then radial `rgba(90,160,255,.35)` at 70% 20%, then
  linear 160° `#2069d6` → `#1a57bb` 55% → `#16489c`.
  - Border: 1 px `rgba(150,190,255,.2)`.
- Both panels: radius 7 px, padding 16 px 22 px. Red content is left-aligned. Blue content mirrors it (right-aligned).
- Turn pill: linear 180° `#df4c40` → `#c23a30`, radius 5 px, 256×38.
  - Shadow: inset `0 1px 0 rgba(255,200,190,.35)`, `0 2px 4px rgba(0,0,0,.35)`.
  - Blue's turn uses the blue card fill instead.

### Decorative props

All props are original SVG with no text, logos or handwriting. They are purely
decorative: `alt=""`, `aria-hidden`, `pointer-events: none`, never focusable. They
are drawn above the wood and below the UI, except the plant, which overlaps the
header's left end.

| Prop           | File                                | Box at 1440×900 (left, top, width) | Transform                                           |
| -------------- | ----------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Dark book      | [`book.svg`](source/book.svg)       | 1232, 18, 300                      | rotate(−9deg); filter brightness(.42) saturate(1.4) |
| Tan book       | [`book.svg`](source/book.svg)       | 1196, 44, 286                      | rotate(−17deg)                                      |
| Ivy sprig      | [`sprig.svg`](source/sprig.svg)     | 1062, 66, 176                      | rotate(−8deg)                                       |
| Mug on coaster | [`mug.svg`](source/mug.svg)         | −66, 148, 240                      | —                                                   |
| Spiral notepad | [`notepad.svg`](source/notepad.svg) | −26, 540, 232                      | —                                                   |
| Book           | [`book.svg`](source/book.svg)       | 1112, 722, 296                     | rotate(−11deg)                                      |
| Pothos plant   | [`plant.svg`](source/plant.svg)     | −20, −16, 240 (above the header)   | —                                                   |

## Colour

| Token               | Value                                                  | Use                                 |
| ------------------- | ------------------------------------------------------ | ----------------------------------- |
| `--cn-ink`          | `#2b2520`                                              | Words on paper cards                |
| `--cn-text`         | `#f2e9dc`                                              | Primary text on glass               |
| `--cn-text-2`       | `#bfb3a4`                                              | Secondary text (banner subline)     |
| `--cn-text-3`       | `#a99c8c`                                              | Meta ("Round 2")                    |
| `--cn-nav-muted`    | `#c7bcae`                                              | Inactive nav links                  |
| `--cn-header-text`  | `#d9cfc2`                                              | Room code, seat count, header icons |
| `--cn-brand`        | `#f6efe5`                                              | Wordmark; logo fill `#f4ede3`       |
| `--cn-red-label`    | `#f26d5f`                                              | "Red" in Clue History               |
| `--cn-blue-label`   | `#5b9ff5`                                              | "Blue" in Clue History              |
| `--cn-red-dot`      | radial `#f47a6c`/`#d9473b`/`#b5352b`                   | Player dots, history dots           |
| `--cn-blue-dot`     | radial `#5ea0f5`/`#2c74de`/`#1d5bbd`                   | Player dots, history dots           |
| `--cn-success`      | `#7ccf73`                                              | Correct guess words and checkmarks  |
| `--cn-chip`         | `#3a3430`, border `rgba(255,240,220,.1)`               | Clue count chip                     |
| `--cn-toggle-on`    | `#45b653` → `#369a44`, knob `#f7f4ef`                  | Spymaster Mode switch               |
| `--cn-online`       | `#4cc45a`, glow `rgba(76,196,90,.6)`                   | Connection dot                      |
| `--cn-avatar`       | `#2566d2` (mockup `#3a82ee` → `#1f60cc`; see contrast) | Viewer initials disc                |
| `--cn-divider`      | `rgba(255,240,220,.12)`                                | Header separators, 1×30             |
| `--cn-key-red`      | `#d6493d`                                              | Mini key cell                       |
| `--cn-key-blue`     | `#2b73dc`                                              | Mini key cell                       |
| `--cn-key-civilian` | `#d8cab0`                                              | Mini key cell                       |
| `--cn-key-assassin` | `#050505`, inset ring `rgba(255,255,255,.28)`          | Mini key cell                       |
| `--cn-key-tray`     | `#141210`, border `rgba(255,240,220,.14)`              | Mini key background                 |
| `--cn-focus`        | `#edbf57` (existing Board.svelte)                      | 3 px focus outline, 4 px offset     |

## Contrast

Ratios were computed with the WCAG 2.2 relative-luminance formula. Glass is
composited at 93% over the lightest wood under a panel (`#7a5134`), which gives
`#2a211b`. Always measure against the lightest stop of a gradient.

| Pair                                            | Ratio                      | Verdict                                                                                                           |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Card ink `#2b2520` on cream `#efe6d3`/`#dacbae` | 12.20 / 9.46               | Pass                                                                                                              |
| Card word on red `#e24c3d` (lightest)           | 3.69                       | Passes only as large bold text (21 px/700). **Compact sizes below 18.66 px must use `#c93a2f` or darker (4.77).** |
| Card word on blue `#2b7de8` (lightest)          | 3.79                       | Same rule. **Compact: `#1d67d4` or darker (5.00).**                                                               |
| Card word on assassin                           | 10.35                      | Pass                                                                                                              |
| Primary / secondary / meta / nav text on glass  | 13.11 / 7.66 / 5.87 / 8.43 | Pass                                                                                                              |
| Red / blue history labels on glass              | 5.35 / 5.80                | Pass                                                                                                              |
| Success green on glass                          | 8.28                       | Pass                                                                                                              |
| Red panel title / caption                       | 5.88 / 4.89                | Pass                                                                                                              |
| Blue panel title `#eaf2ff`                      | 4.60                       | Pass                                                                                                              |
| Blue panel caption `#cfe0fa` on `#2069d6`       | 3.87                       | **Fail at 14 px. Use `#eaf2ff` (4.60).**                                                                          |
| Turn pill white on `#df4c40`                    | 4.00                       | **Fail (19 px/600 is not large text). Start the pill gradient at `#c83d33` (5.03).**                              |
| Avatar initials white on `#3a82ee`              | 3.74                       | **Fail at 13 px. Use `#2566d2` (5.37).**                                                                          |

Re-measure after implementation using composited browser colours. Decorative prop
art is not functional text.

## Typography

- Family: **Archivo**, weights 400–800 (variable). Fallback `Arial, Helvetica, sans-serif`.
- The mockup loads Archivo from Google Fonts. The app must self-host it instead:
  - Put a variable WOFF2 plus its OFL licence and a provenance README under `apps/web/static/fonts/codenames/`, as `apps/web/static/fonts/azul/README.md` does.
  - Keep full glyph coverage, including Spanish accents and ¿¡.
  - Use `font-display: swap`.

| Role                                | Size / weight / tracking                  |
| ----------------------------------- | ----------------------------------------- |
| Wordmark "Codenames"                | 27 / 700 / −0.01em                        |
| Nav                                 | 15 / 500; active 600, `#ffffff`           |
| Header meta                         | 14 / 400; viewer name 14 / 600; status 12 |
| Avatar initials                     | 13 / 700                                  |
| Team panel title                    | 19 / 600                                  |
| Team count                          | 42 / 700, line-height 1                   |
| Team caption                        | 14 / 400                                  |
| Round label                         | 18 / 500                                  |
| Turn pill                           | 19 / 600                                  |
| Banner subline                      | 14 / 400                                  |
| Card word                           | 21 / 700 / +0.015em, uppercase            |
| Panel title (Players, Clue History) | 18–19 / 600                               |
| Spymaster Mode title                | 16 / 600                                  |
| History row (team, clue)            | 16; team name 600                         |
| Count chip                          | 15 / 600, 26×24 min, radius 4             |
| Guess word                          | 13 / 600 / +0.03em, uppercase             |
| Player name                         | 15 / 400                                  |
| Key caption                         | 14 / 400, line-height 1.55                |

Long words keep the current Board.svelte approach: `overflow-wrap: anywhere`,
`text-wrap: balance`, and a smaller `.long` size for words over 10 characters.

## Geometry at 1440×900

| Region        | Box (left, top, w × h)     | Internals                                                                                                                              |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Header        | 8, 6, 1424 × 72; radius 10 | Padding 0 28 0 96; gap 56 (brand · nav · meta). Logo 28 px; brand gap 12; nav gap 36; meta gap 22; avatar 36; gear 24                  |
| Team row      | 226, 92, 804 × 114         | Flex, gap 12: red 236 · banner flex 1 · blue 236. Team icon 34; count–icon gap 14; caption indent 48                                   |
| Round banner  | ~308 × 114                 | Column, centred, gap 9                                                                                                                 |
| Word grid     | 196, 226, 864 × 462        | 5×5; row gap 11, column gap 12 (cards ≈ 163 × 83.6). `transform: perspective(1800px) rotateX(7deg)`; origin 50% 70%                    |
| Players       | 206, 722, 512 × 156        | Padding 18 26; gap 14; 2-column grid, gaps 12 row / 24 col; dot 20; dot–name gap 12                                                    |
| Spymaster key | 732, 722, 328 × 156        | Padding 16 20; gap 14. Eye 22. Switch 46 × 24, knob 20. Tray 118 × 90, padding 7, 5×5 cells, gap 3, cell radius 2. Tray–caption gap 18 |
| Clue History  | 1080, 196, 326 × auto      | Padding 18 22 22; entry gap 18; row gap 9; history dot 13; guess indent 23; guess gap 16; check 13                                     |

The main screen never scrolls. The desktop composition centres on the table. Beyond
1440 px, extend the wood and keep the regions centred (max content width 1440). Props
stay anchored to the viewport edges.

## Icons

Icons are inline SVG in [`source/Main.dc.html`](source/Main.dc.html). Do not use emoji or text glyphs.

| Icon        | Style                           | Where                                                    |
| ----------- | ------------------------------- | -------------------------------------------------------- |
| Clover logo | 4 filled circles r 5.4, 26 grid | Header brand                                             |
| Link        | Stroke 2, round caps, 24 grid   | Room invite                                              |
| Users       | Filled, 24 grid                 | Seat count, team panels (`#f19b90` red / `#8fbdf7` blue) |
| Gear        | Filled, even-odd, 24 grid       | Settings                                                 |
| Eye         | Stroke 2, 24 grid               | Spymaster Mode                                           |
| Check       | Stroke 2.2, 16 grid             | Correct guesses                                          |

## CSS custom properties

Paste this into `games/codenames/src/tokens.css`, which Board.svelte imports.

```css
.cn-table {
  --cn-font: 'Codenames Archivo', Arial, Helvetica, sans-serif;
  --cn-wood-base: #3f2415;
  --cn-ink: #2b2520;
  --cn-text: #f2e9dc;
  --cn-text-2: #bfb3a4;
  --cn-text-3: #a99c8c;
  --cn-nav-muted: #c7bcae;
  --cn-header-text: #d9cfc2;
  --cn-brand: #f6efe5;
  --cn-red-label: #f26d5f;
  --cn-blue-label: #5b9ff5;
  --cn-success: #7ccf73;
  --cn-chip: #3a3430;
  --cn-online: #4cc45a;
  --cn-avatar: #2566d2;
  --cn-divider: rgba(255, 240, 220, 0.12);
  --cn-focus: #edbf57;
  --cn-key-red: #d6493d;
  --cn-key-blue: #2b73dc;
  --cn-key-civilian: #d8cab0;
  --cn-key-assassin: #050505;
  --cn-glass: linear-gradient(
    180deg,
    rgba(36, 29, 25, 0.93),
    rgba(22, 18, 15, 0.93)
  );
  --cn-glass-border: 1px solid rgba(255, 236, 210, 0.09);
  --cn-glass-shadow:
    inset 0 1px 0 rgba(255, 240, 220, 0.06), 0 2px 4px rgba(8, 4, 2, 0.45),
    0 14px 30px rgba(8, 4, 2, 0.5);
  --cn-card-paper:
    url('./paper.svg'),
    radial-gradient(
      ellipse at 32% 18%,
      rgba(255, 252, 242, 0.6),
      transparent 70%
    ),
    linear-gradient(172deg, #efe6d3 0%, #e7dbc3 55%, #dacbae 100%);
  --cn-card-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 -3px 0 rgba(150, 124, 88, 0.5),
    inset 0 0 20px rgba(140, 105, 60, 0.16), 0 2px 1px rgba(20, 10, 5, 0.5),
    0 9px 14px rgba(20, 10, 5, 0.42);
  --cn-red-fill: linear-gradient(165deg, #e24c3d 0%, #cc3c30 55%, #b5322a 100%);
  --cn-blue-fill: linear-gradient(
    165deg,
    #2b7de8 0%,
    #1d67d4 55%,
    #1756b9 100%
  );
  --cn-assassin-fill: linear-gradient(
    165deg,
    #383533 0%,
    #252322 55%,
    #1a1918 100%
  );
  --cn-red-panel: linear-gradient(
    160deg,
    #a52f29 0%,
    #8a2420 55%,
    #6f1d1a 100%
  );
  --cn-blue-panel: linear-gradient(
    160deg,
    #2069d6 0%,
    #1a57bb 55%,
    #16489c 100%
  );
  --cn-turn-red: linear-gradient(180deg, #c83d33, #b3342b);
  --cn-turn-blue: linear-gradient(180deg, #1d67d4, #1756b9);
  --cn-radius-card: 5px;
  --cn-radius-panel: 8px;
  --cn-radius-header: 10px;
  --cn-grid-tilt: perspective(1800px) rotateX(7deg);
}
```
