# Azul 8-bit skin

A viewer-only skin built on the [8-bit kit](pixel-kit.md): a 16-bit puzzle game in a
Moorish palace. `Board.svelte` adds `px-tokens`, `az-pixel` (and `az-reduced` when motion is
reduced) to the table and its dialog when `gameSkin('azul')` is `pixel` (home theme 8-bit, or
the ⚙ **Table style** choice). Only then does it lazy-load `games/azul/src/pixel.css` and the
chiptune pack `games/azul/src/pixel/sound.ts`, so classic players download neither. Rules,
layout, anchors, presentation timing and the server are unchanged.

- **Skin context.** `Board` sets a Svelte context (`skinKey` in `palette.ts`) read by `Tile`
  and `PlayerBoard`, and flights pass it to the tiles they mount. In pixel mode `Tile` renders
  a sprite (`.px-tile`) instead of the ceramic photo, and `PlayerBoard` skips the rich board,
  rail and marker photos. Every `data-azul-location` anchor stays on the same elements.
- **Styles.** `pixel.css` wraps its rules in `:is(.azul-table.az-pixel, #az-pixel)`; the id
  in `:is()` lifts them above the classic scoped rules without touching them. `--px` is 2 px,
  so one chrome pixel equals one sprite pixel (tiles are 16 px sprites drawn at 2×). No radius,
  blur, gradients, `filter` or rotation (centre tiles keep their scatter but lose the tilt);
  `isolation: isolate` replaces the stacking context the classic drop-shadow filters made.
- **Motion** uses `steps()`: tile flights hop in 6 steps, factory tiles lift a pixel on hover,
  legal pattern lines blink, wall tiles pop `+N`, the header score and the result breakdown
  count up through registered `@property` integers (`--az-score`, `--az-n`) shown with CSS
  counters while the real number stays in the DOM for assistive tech. `az-reduced` turns all of
  it off.
- **Sound.** `ceramicAudio()` keeps the classic cues; with the pixel pack attached it plays
  chiptunes instead: pick blip, a click into a pattern line, a floor bump for overflow, the
  first-player arpeggio, rising point ticks for each wall tile (plus a coin for 5+), a falling
  buzz for floor penalties, a bonus fanfare, a round refill jingle and a win or lose tune.
- **Phones.** The compact layout is the classic one. Factory tiles use the sprites at 1×,
  the phone tray and draft dialog use a 1× frame with fluid slots, and the bonus legend hides
  on narrow boards.

## Art

All files live in `apps/web/static/games/azul/pixel/` (about 36 KB in total):

| File             | Size    | What                                                                  |
| ---------------- | ------- | --------------------------------------------------------------------- |
| `palace.webp`    | 480×270 | Table background, drawn with `cover`                                  |
| `zellige.webp`   | 64×64   | Dim seamless floor: centre pool rug and dialog backdrop (shown at 2×) |
| `tiles.webp`     | 96×48   | Hand-made sheet: tiles + marker, wall hints, book and gear icons      |
| `factory.webp`   | 63×63   | Factory display plate, shown at 2×                                    |
| `frame.webp`     | 96×96   | Player board frame, a 14 px `border-image` slice                      |
| `bag.webp`       | 60×60   | Tile bag                                                              |
| `lid.webp`       | 48×48   | Box lid used as the discard tray                                      |
| `medallion.webp` | 16×16   | Score track marker                                                    |

### Tiles (hand-made)

Downsampled generations turn to mush at 16 px, so tiles are drawn pixel by pixel in
`games/azul/scripts/pixel-tiles.py`. Each colour has a glaze, a bevel, an ink outline and the
motif its name promises (blue diamond, yellow sun, red chevron, black lattice, white flower),
so tiles stay distinguishable in greyscale and for colour-blind players. Row 1 holds the wall's
printed hints, flat tints pre-mixed with the wall colour (`--az-cell`, `#e9d8ae`). The
first-player marker is an octagonal ivory token; its numeral is real text.

```sh
python3 games/azul/scripts/pixel-tiles.py apps/web/static/games/azul/pixel/tiles.webp [preview.png]
```

### Generated art

Generated on September 24, 2026 with the Codex CLI image tool, using the pixel store
(`pixel-store/store.webp`, converted to PNG) as the style reference, in a scratch folder
outside the repo. Raw generations are not committed.

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < scene.md
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < props.md
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < lid.md
```

`games/azul/scripts/pixel-art.py` reduces them to true low resolution: box downsample, an
octree palette (median cut dropped the small oranges and lamplight), hard alpha, lossless WebP.

```sh
python3 games/azul/scripts/pixel-art.py scene raw/palace.png pixel/palace.webp 480 270 64
python3 games/azul/scripts/pixel-art.py floor raw/floor.png pixel/zellige.webp 3 64 0.36
python3 games/azul/scripts/pixel-art.py sprite raw/factory.png pixel/factory.webp 63 63 32
python3 games/azul/scripts/pixel-art.py sprite raw/bag.png pixel/bag.webp 60 60 32
python3 games/azul/scripts/pixel-art.py sprite raw/lid2.png pixel/lid.webp 48 48 32
python3 games/azul/scripts/pixel-art.py sprite raw/frame.png pixel/frame.webp 96 96 32
python3 games/azul/scripts/pixel-art.py sprite raw/medallion.png pixel/medallion.webp 16 16 16
```

#### scene.md

```text
You are producing pixel-art game backgrounds for an original tile-drafting board game set in a Moorish palace. The attached image is the STYLE reference ONLY: crisp 16-bit pixel art with clean dark outlines, a limited rich palette, warm lamplight, no blur, no gradients, no anti-aliasing mush. Do not copy its content.

Use your image generation tool to create EACH of the following as a SEPARATE image, then copy each resulting PNG to ./raw/<name>.png (exact names; do not modify them otherwise).

1. palace (wide 16:9): a Moorish palace hall at dusk seen from straight ABOVE (top-down, like a classic 16-bit RPG map), crisp pixel art with the reference's palette quality but in cool deep blues, teal and turquoise lifted by warm brass and terracotta accents. The WHOLE CENTRE (about 70% of the width and 75% of the height) is EMPTY floor: a calm, LOW-CONTRAST dark indigo and teal geometric zellige tile floor (eight-pointed stars and small crosses), evenly lit, so game pieces and text can sit on top of it. Only the EDGES are decorated: along the top edge a row of carved horseshoe arches with slender columns and a blue-and-white tile dado; in the four corners potted orange trees and tall brass Moroccan lanterns casting small warm pools of light; along the bottom edge a thin strip of a long rug with a geometric border; a small octagonal fountain with water in the lower-left corner. NO people, NO animals, NO text, NO letters, NO numbers, NO game tiles, NO border frame, NO vignette, NO UI.

2. floor (square 1:1): a SEAMLESS TILEABLE top-down texture of the same dark indigo and teal zellige palace floor (eight-pointed stars, small crosses, thin cream grout lines), crisp pixel art, evenly lit, low contrast, no perspective, no shadows, no objects, no text, no border. It must tile perfectly on all four edges.
```

#### props.md

`lid` from this prompt read as a plain framed square at 2×; it was replaced by `lid2` below.

```text
You are producing pixel-art game sprites for an original tile-drafting board game set in a Moorish palace. The attached image is the STYLE reference ONLY: crisp 16-bit pixel art with clean dark outlines, limited rich palette, no blur, no gradients, no anti-aliasing mush.

Use your image generation tool to create EACH of the following as a SEPARATE square image. Requirements for every image:
- Exactly ONE subject, centred, fully inside the frame with generous margin, nothing cropped.
- Seen from straight ABOVE (top-down), like a 16-bit RPG item, unless stated.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no floor, no cast shadow on the background, no text, no letters, no numbers, no border.
- Crisp pixel art with chunky readable shapes, dark outlines and a limited palette.
After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

1. factory: a round glazed ceramic serving plate seen from directly above, perfectly circular. A wide cobalt-blue rim painted with a small repeating white and turquoise geometric pattern and a thin brass-gold outer edge; the large inner well is PLAIN flat warm cream glaze with no pattern (game tiles will sit on it).
2. bag: a plump drawstring tile bag of deep royal-blue velvet with a gold geometric embroidered band and a gold cord tied at the top, seen from a 3/4 top-down angle, standing upright.
3. lid: an open square game-box lid lying flat, seen from directly above: a shallow wooden tray with dark cedar walls, brass corner caps and an EMPTY plain dark-teal felt floor inside.
4. frame: a SQUARE ornamental picture frame seen straight-on, for a game player board: a thick carved dark cedar-wood border with small brass studs, a thin inner line of blue-and-white zellige tiles along all four sides, and small brass eight-pointed star ornaments in the four corners. The four sides are straight and identical so the frame can be stretched. The whole INSIDE of the frame is one PLAIN flat warm parchment-cream colour with nothing on it.
5. medallion: a small round brass medallion with an eight-pointed star relief, like a score token, seen from above.
```

#### lid.md

```text
You are producing a pixel-art game sprite for an original tile-drafting board game set in a Moorish palace. The attached image is the STYLE reference ONLY: crisp 16-bit pixel art with clean dark outlines, limited rich palette, no blur, no gradients, no anti-aliasing mush.

Use your image generation tool to create ONE square image, then copy the resulting PNG to ./raw/lid2.png (do not modify it otherwise).

lid2: the open lid of a square wooden game box, lying upside down on a table and used as a discard tray, seen from a 3/4 top-down angle like a 16-bit RPG item. Shallow dark cedar-wood walls with small brass corner caps, a dark teal felt floor, and five or six loose square ceramic tiles tumbled inside it at different angles (one cobalt blue, one golden yellow, one terracotta red, one charcoal black, one cream white), each tile with a small simple painted motif. Exactly ONE subject, centred, fully inside the frame with generous margin, nothing cropped. Solid flat pure magenta background (#FF00FF) everywhere around the subject; no floor, no cast shadow on the background, no text, no letters, no numbers, no border. Chunky readable shapes with dark outlines.
```
