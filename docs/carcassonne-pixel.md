# Carcassonne 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md), styled like a 16-bit tile-laying
game. `Board.svelte` adds `px-tokens` and `cc-pixel` to the table and its dialogs when
`gameSkin('carcassonne')` is `pixel` (the home theme is 8-bit, or ⚙ Settings › Table style), then lazy-loads
`games/carcassonne/src/pixel.css`, the chiptune pack (`pixel/sound.ts`) and the art. Classic
players never download any of it. Rules, the affine camera, hit testing and layouts are
unchanged.

## How it draws

- **Tiles are rasterized at runtime** (`pixel/atlas.svelte.ts`). Each tile is painted in world
  orientation into a 128×128 image. The ground (meadow, rivers, lakes, towns, stone walls,
  roads, bridges, gardens and the bevelled tile rim) is drawn on a chunky 64px grid. It samples
  tileable textures at world coordinates, so meadows and towns flow from tile to tile.
  Buildings and symbols (monasteries, keeps, cathedrals, shrines, inns, fields,
  shields, goods, gold, magic, robbers, flights and crop circles) stand upright on the 128px grid.
  Geometry comes from the same `art.ts` paths as the classic SVG (rasterized into hard
  masks through a small canvas), so decoration never changes topology. Rasters are
  cached per tile, rotation and position (about 2 ms each; all 138 designs take about 230 ms).
- **Raised walls** (`wallImage`) stack stone courses along every inner city edge, 2 high
  while open and 6 once complete, offset by the camera's `lift()` so they stand up on screen.
- **Standing scenery** (`Elevation.svelte`) swaps the painted sprites for pixel sprites at
  the sprite grid (0.78 tile units per pixel), ignoring random scale so pixels stay square.
  Rises, sway and smoke use `steps()`.
- **Figures** (`FigureSprite.svelte`) are neutral grey pixel sprites recoloured at runtime
  into a four-step ramp of each player colour (no SVG filter).
- **HUD**: wooden plaques and parchment panels with `--px` borders and hard shadows, a red
  banner behind the title and the winner, hand-set pixel icons (`pixel/PixelIcon.svelte`),
  marching-ant slots, a blinking ghost frame, bobbing arrows over legal meeple spots, and a
  score pop: a 6-frame gold burst plus a `+N` floating over the scored feature.
- **Sound** (`pixel/sound.ts`): ZzFX cues for drawing, rotating, previews, placing tiles
  and meeples, returns, building, gold, goods, flights, ferries, magic, messages and robbers.
  Square-wave arpeggios play for scores, final scoring and extra turns, and a short fanfare
  for the win. It uses the kit's ZzFX builder (`buildSamples`).
- Reduced motion turns off every stepped animation. The Ambient motion setting still controls
  the table's idle motion.

## Art

Generated on 2026-09-24 with the Codex CLI image tool. The style reference was
`apps/web/static/games/pixel-store/store.webp` converted to PNG. Raw generations are not
committed. Files in `apps/web/static/games/carcassonne/pixel/`:

| File             | Size   | Contents                                                              |
| ---------------- | ------ | --------------------------------------------------------------------- |
| `terrain.webp`   | ~39 KB | meadow 128², town 176², road, water and stone 64² (tileable)          |
| `sprites.webp`   | ~23 KB | buildings, trees, sheep, fields and figures (map in `pixel/sheet.ts`) |
| `table.webp`     | ~34 KB | 384×216 wooden table, drawn with `cover`                              |
| `parchment.webp` | ~4 KB  | 96² tileable parchment for panels and dialogs, shown at 3×            |
| `burst.webp`     | ~1 KB  | 6-frame 32px score burst                                              |
| `banner.webp`    | ~1 KB  | 112×18 title ribbon, shown at 2× or 3×                                |

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < <prompt>.md
python3 terrain.py raw/terrain apps/web/static/games/carcassonne/pixel/terrain.webp
python3 pack.py apps/web/static/games/carcassonne/pixel/sprites.webp \
  keep=raw/buildings/keep.png:80:40 monastery=raw/buildings/monastery.png:70:40 \
  cathedral=raw/buildings/cathedral.png:60:40 keep-small=raw/buildings/keep.png:46:32 \
  gatehouse=raw/buildings/gatehouse.png:30 windmill=raw/buildings/windmill.png:40:28 \
  houses-a=raw/buildings/houses-a.png:40:32 houses-b=raw/buildings/houses-b.png:38:32 \
  houses-c=raw/buildings/houses-c.png:41:32 houses-d=raw/buildings/houses-d.png:33:28 \
  house-single-a=raw/buildings/house-single-a.png:23 house-single-b=raw/buildings/house-single-b.png:18 \
  tower-round=raw/buildings/tower-round.png:18 tower-square=raw/buildings/tower-square.png:18 \
  shrine=raw/buildings/shrine.png:18 trees-a=raw/nature/trees-a.png:32 trees-b=raw/nature/trees-b.png:22 \
  trees-c=raw/nature/trees-c.png:28 bush=raw/nature/bush.png:13:12 sheep-a=raw/nature/sheep-a.png:12:10 \
  sheep-b=raw/nature/sheep-b.png:12:10 haystack=raw/nature/haystack.png:13:12 \
  wheat=raw/nature/wheat.png:34 vineyard=raw/nature/vineyard.png:34 \
  meeple=raw/figures/meeple.png:26:10 abbot=raw/figures/abbot.png:22:10 \
  builder=raw/figures/builder.png:14:10 pig=raw/figures/pig.png:26:10
python3 pack.py apps/web/static/games/carcassonne/pixel/banner.webp banner=raw/scene/banner.png:112:24
python3 docs/domino-pixel/pixelate.py sheet raw/scene/burst.png apps/web/static/games/carcassonne/pixel/burst.webp 6 1 32 16
python3 docs/domino-pixel/pixelate.py image raw/scene/table.png apps/web/static/games/carcassonne/pixel/table.webp 384 216 28
python3 docs/domino-pixel/pixelate.py image raw/scene/parchment.png apps/web/static/games/carcassonne/pixel/parchment.webp 96 96 12
```

`pack.py` prints the atlas map; paste it into `games/carcassonne/src/pixel/sheet.ts`.
Sprites below about 40px turn to mush at the ground grid's density, so sprites use twice
the ground resolution. Small map symbols (shields, goods, gold, magic, robbers, flights and crop
circles) are hand-set bitmaps in `pixel/bitmaps.ts`, and the UI icons are hand-set in
`PixelIcon.svelte`.

### terrain.py

```python
"""Reduce Codex terrain textures to small tileable pixel textures and pack them in one row.

usage: python3 terrain.py <raw-dir> <out.webp>
Order: meadow, town, road, water, stone. Each texture is box-downsampled, its seams
cross-faded with a half-offset copy (only near the edges), then palette-quantized
without dithering so every pixel is hard.
"""
import sys

from PIL import Image, ImageChops

raw, out = sys.argv[1], sys.argv[2]
sizes = {'meadow': 128, 'town': 176, 'road': 64, 'water': 64, 'stone': 64}
names = ['meadow', 'town', 'road', 'water', 'stone']
colors = {'meadow': 20, 'town': 40, 'road': 16, 'water': 12, 'stone': 16}
sheet = Image.new('RGB', (sum(sizes.values()), max(sizes.values())))
x0 = 0
for name in names:
    size = sizes[name]
    im = Image.open(f'{raw}/{name}.png').convert('RGB').resize((size, size), Image.Resampling.BOX)
    # Seam fix: blend a half-offset copy in a band around the borders.
    shifted = ImageChops.offset(im, size // 2, size // 2)
    band = 10
    mask = Image.new('L', (size, size), 0)
    px = mask.load()
    for y in range(size):
        for x in range(size):
            d = min(x, y, size - 1 - x, size - 1 - y)
            px[x, y] = 0 if d >= band else round(255 * (1 - d / band) * 0.5)
    im = Image.composite(shifted, im, mask) if name in ('meadow', 'water', 'road') else im
    im = im.quantize(colors[name], method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    sheet.paste(im, (x0, 0))
    print(f'  {name}: [{x0}, 0, {size}, {size}],')
    x0 += size
sheet.save(out, lossless=True, method=6)
print(out, sheet.size)
```

### pack.py

```python
"""Key, shrink and pack Codex sprites into one pixel-art sheet.

usage: python3 pack.py <out.webp> <name>=<raw.png>:<width>[:colors] ...
Each sprite: magenta keyed (existing alpha kept), trimmed, box-downsampled to <width>
logical pixels, palette-quantized without dithering, alpha made hard, then a 1px dark
outline is closed around the silhouette. Sprites are shelf-packed with 1px gaps; the
script prints the atlas map (name: [x, y, w, h]) for games/carcassonne/src/pixel/sheet.ts.
Requires Pillow only.
"""
import sys

from PIL import Image, ImageChops

out, *specs = sys.argv[1:]


def key(image):
    image = image.convert('RGBA')
    r, g, b, given = image.split()
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: 0 if v > 70 else 255)
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(alpha, given)))


def shrink(path, width, colors):
    im = key(Image.open(path))
    im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox())
    w, h = im.size
    height = max(1, round(h * width / w))
    # Premultiply so the magenta/transparent surround never tints the edge pixels.
    rgb = Image.new('RGB', im.size, (0, 0, 0))
    rgb.paste(im, mask=im.getchannel('A'))
    small = rgb.resize((width, height), Image.Resampling.BOX)
    a = im.getchannel('A').resize((width, height), Image.Resampling.BOX)
    cover = a.point(lambda v: 255 if v > 110 else 0)
    # Undo premultiplication.
    sp, ap = small.load(), a.load()
    for y in range(height):
        for x in range(width):
            k = ap[x, y]
            if k:
                r, g, b = sp[x, y]
                sp[x, y] = tuple(min(255, round(c * 255 / k)) for c in (r, g, b))
    q = small.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    q.putalpha(cover)
    # Close a dark outline: transparent pixels next to the silhouette become ink.
    px = q.load()
    ink = (34, 22, 14, 255)
    solid = {(x, y) for y in range(height) for x in range(width) if px[x, y][3]}
    edge = [(x, y) for (x, y) in solid if any(
        (x + dx, y + dy) not in solid for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        px[x, y] = ink
    return q


sprites = []
for spec in specs:
    name, rest = spec.split('=')
    path, *opts = rest.split(':')
    width = int(opts[0])
    colors = int(opts[1]) if len(opts) > 1 else 24
    sprites.append((name, shrink(path, width, colors)))

# Shelf packing, tallest first.
limit = 256
order = sorted(sprites, key=lambda s: -s[1].size[1])
x = y = shelf = 0
places = {}
for name, im in order:
    w, h = im.size
    if x + w > limit:
        x, y, shelf = 0, y + shelf + 1, 0
    places[name] = (x, y, w, h)
    x += w + 1
    shelf = max(shelf, h)
used = max(px + w for px, _, w, _ in places.values())
sheet = Image.new('RGBA', (used, y + shelf), (0, 0, 0, 0))
for name, im in sprites:
    sheet.alpha_composite(im, places[name][:2])
sheet.save(out, lossless=True, method=6)
print(out, sheet.size)
for name, _ in sprites:
    print(f"  '{name}': {list(places[name])},")
```

## Prompts

### terrain

```text
You are producing pixel-art textures for an original medieval tile-laying board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines where needed, limited warm palette, hard pixel edges, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE square image, then copy each resulting PNG to ./raw/terrain/<name>.png (exact names below; create the folder; do not modify the images otherwise).

Every texture: seen perfectly straight down from above (top-down, orthographic, no perspective, no horizon), evenly lit, fills the whole square edge to edge, SEAMLESS and TILEABLE (the left edge continues into the right edge, the top into the bottom), chunky visible pixels (the image should look like a ~64x64 pixel texture scaled up), no text, no border, no vignette, no objects cut off at the edges except what tiles naturally.

1. meadow: lush green meadow grass for a sunny medieval countryside, several shades of green, small grass tufts, a few tiny white and yellow wildflowers scattered sparsely, very even so it tiles well. Mid-green overall, not too dark.
2. town: densely packed medieval town rooftops seen from directly above: terracotta and orange-red clay tile roofs with ridge lines, a few darker roofs, tiny chimneys, narrow cream cobblestone alleys between the houses. Warm and cheerful, like the town of a 16-bit RPG world map.
3. road: a packed light-brown dirt road surface seen from above: sandy earth with small pebbles and faint cart ruts, warm tan and ochre shades.
4. water: clear river water seen from above: medium blue with lighter cyan ripple highlights and a few white glints, calm, no shore.
5. stone: a cream-grey castle wall top seen from above: rows of large square stone blocks with dark mortar lines, a little moss.

Work through all five. If a generation fails, retry. At the end, list the files in ./raw/terrain.
```

### buildings

```text
You are producing pixel-art game sprites for an original medieval tile-laying board game. The attached image is the STYLE reference: crisp 16-bit pixel art with clean dark outlines, a warm limited palette, hard pixel edges, no blur, no gradients, no anti-aliasing.

Use your image generation tool to create EACH of the following sprites as a SEPARATE square image. Requirements for every image:
- Exactly ONE subject, centered, fully inside the frame with generous margin, nothing cropped.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no ground plane, no grass base, no cast shadow on the background, no text, no border, no vignette.
- High three-quarter top-down view like a classic 16-bit RPG town (camera about 50 degrees above the ground), light from the upper left.
- Chunky, readable pixel art with a thick dark outline around the silhouette, so it still reads when shrunk to about 32 pixels wide. Big simple shapes, few details.
- Palette: terracotta/orange-red roofs, cream plaster and cream-grey stone walls, dark brown timber, warm and cheerful. All sprites must look like one consistent set.

After each image is generated, copy the resulting PNG file to ./raw/buildings/<name>.png (exact names below; create the folder). Do not modify the images otherwise.

1. houses-a: a tight cluster of 3 medieval half-timbered houses with orange-red roofs, cream plaster walls.
2. houses-b: a cluster of 4 small stone townhouses with terracotta roofs and one small chimney.
3. houses-c: a cluster of 5 tightly packed town houses of varying height, red roofs, a tiny bell tower among them.
4. houses-d: a cluster of 2 houses, one taller with a steep red roof.
5. house-single-a: one small cottage with a red roof and a chimney.
6. house-single-b: one narrow tall townhouse with a dark orange roof.
7. tower-round: one round stone wall tower with crenellations and a pointed red conical roof.
8. tower-square: one square stone wall tower with crenellations and a small red pyramid roof.
9. gatehouse: a stone city gatehouse with an arched gate and two small turrets with red roofs.
10. keep: a large medieval stone castle keep with several towers with pointed red roofs, grey-cream walls and a red banner.
11. cathedral: a large gothic stone cathedral with a tall spire and red roofs.
12. monastery: a medieval abbey church with a bell tower, cream stone and a red roof, a small cloister wall.
13. windmill: a medieval wooden windmill with four sails on a stone base.
14. shrine: a tiny roadside wayside chapel, just a small stone hut with a red roof and a little cross on top.

Work through all fourteen. If a generation fails, retry. At the end, list the files in ./raw/buildings.
```

### nature

```text
You are producing pixel-art game sprites for an original medieval tile-laying board game. The attached image is the STYLE reference: crisp 16-bit pixel art with clean dark outlines, a warm limited palette, hard pixel edges, no blur, no gradients, no anti-aliasing.

Use your image generation tool to create EACH of the following sprites as a SEPARATE square image. Requirements for every image:
- Exactly ONE subject, centered, fully inside the frame with generous margin, nothing cropped.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no ground plane, no cast shadow on the background, no text, no border, no vignette.
- High three-quarter top-down view like a classic 16-bit RPG overworld (camera about 50 degrees above the ground), light from the upper left.
- Chunky, readable pixel art with a thick dark outline around the silhouette, so it still reads when shrunk to about 24 pixels wide. Big simple shapes.
- All sprites must look like one consistent set.

After each image is generated, copy the resulting PNG file to ./raw/nature/<name>.png (exact names below; create the folder). Do not modify the images otherwise.

1. trees-a: a clump of 3 round leafy deciduous trees, bright green.
2. trees-b: a clump of 2 tall dark-green cypress trees and a bush.
3. trees-c: a single large round oak tree.
4. bush: a small round green bush.
5. sheep-a: a single white woolly sheep standing, facing left.
6. sheep-b: a single white woolly sheep grazing, head down, facing right.
7. haystack: a small golden haystack.
8. wheat: seen from directly above (top-down, flat): a small rectangular patch of golden wheat field with rows, soft irregular edges.
9. vineyard: seen from directly above (top-down, flat): a small rectangular patch of green vineyard rows with a little wooden fence.

Work through all nine. If a generation fails, retry. At the end, list the files in ./raw/nature.
```

### figures

```text
You are producing pixel-art game-piece sprites for an original medieval tile-laying board game. The attached image is the STYLE reference: crisp 16-bit pixel art with clean dark outlines, hard pixel edges, no blur, no gradients, no anti-aliasing.

Use your image generation tool to create EACH of the following as a SEPARATE square image. Requirements for every image:
- Exactly ONE wooden game piece, centered, standing upright, fully inside the frame with generous margin.
- The piece is painted a NEUTRAL LIGHT GREY (near white highlights, mid grey body, darker grey shading) so it can be recoloured later per player. No coloured tint, no face, no text, no markings.
- A thick near-black outline around the silhouette. Chunky, simple, readable shapes: it must still read when shrunk to about 16 pixels tall. Light from the upper left.
- Seen from the front, very slightly from above.
- Solid flat pure magenta background (#FF00FF) everywhere around the piece; no ground, no cast shadow, no border.

After each image is generated, copy the resulting PNG to ./raw/figures/<name>.png (exact names; create the folder). Do not modify the images.

1. meeple: the classic chunky wooden meeple person shape (round head, arms stretched out to the sides, legs apart), glossy wood.
2. abbot: a meeple-like abbot figure with a hooded monk robe silhouette, same chunky wood.
3. builder: a tall narrow wooden builder figure (a tall meeple variant with a small head), same wood.
4. pig: a small chunky wooden pig game piece standing side-on facing right, same wood.

Do all four, then list the files in ./raw/figures.
```

### scene (table, parchment, burst, banner)

```text
You are producing pixel-art assets for an original medieval tile-laying board game. The attached image is the STYLE reference: crisp 16-bit pixel art (warm wood, clean dark outlines, limited palette, hard pixel edges, no blur, no gradients, no anti-aliasing).

Use your image generation tool to create EACH of the following as a SEPARATE image and copy each resulting PNG to ./raw/scene/<name>.png (exact names; create the folder; do not modify them otherwise).

1. table (wide 16:9): a top-down view of a big old oak game table seen straight from above, filling the whole image: warm medium-brown wooden planks running horizontally with pixel wood grain, a few knots and small nail heads, a subtle darker border of the table frame along the edges. Evenly lit, fairly low contrast and calm so game tiles and text can sit on top. NO objects, NO props, NO cards, NO people, NO text, NO vignette.
2. parchment (square): a seamless tileable top-down parchment paper texture: warm cream and light tan with faint pixel fibres and a few tiny darker speckles, very calm and low contrast, fills the whole square, no border, no text. Chunky visible pixels.
3. burst (wide 6:1): an animation strip of EXACTLY 6 frames in one horizontal row, evenly spaced in 6 equal invisible cells, on a solid flat pure magenta (#FF00FF) background: a golden sparkle/coin burst for scoring points in a game. Frame 1 a small bright gold star spark; frames 2-4 it bursts outward into a ring of gold and cream sparkles and little coins; frames 5-6 the sparkles fade into a few scattered pixels. Same centre in every frame, nothing crosses cell borders, no text, no numbers.
4. banner (wide 4:1): a horizontal medieval cloth banner / pennant ribbon for a title plaque: deep red cloth with a gold trim border and forked swallowtail ends, completely BLANK in the middle (no text, no symbols), on a solid flat pure magenta (#FF00FF) background, thick dark outline, nothing cropped.

Do all four. If a generation fails, retry. At the end, list the files in ./raw/scene.
```
