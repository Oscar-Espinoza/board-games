# UNO 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md). `Board.svelte` adds `uno-pixel` and
`px-tokens` to the table and the settings dialog when `gameSkin('uno')` is `pixel` (home theme
8-bit, or ⚙ **Table style**), and lazy-loads `games/uno/src/pixel.css` together with the
chiptune pack `games/uno/src/pixel/sound.ts`. Classic players download neither. Rules, layout
logic and the server are unchanged.

- **Cards** are sprites at whole-number scales: `--u` for table cards, `--hu` for the hand
  (`round()` of the classic sizes over the 44×64 sprite), `--k` per card. A face is three
  layers: `cards.webp` (red, yellow, green, blue, wild, back), a centre glyph and two corner
  indices from `glyphs.webp`. Hand cards sit flat (no fan rotation): playable cards rise and
  get a gold frame, hover lifts them further, the rest dim under a flat overlay.
- **Table**: `table-wide.webp` / `table-tall.webp` (640×360 / 360×640, cover, pixelated).
  Seats get one of eight character portraits (`avatars.webp`, by roster seat) and a card
  count chip; the direction arrows are dashed tracks that march with `steps()`.
- **Motion** (`motion.ts`, `pixel` option): flights hop flat along a higher arc in
  `steps(8)`. Action cards add a table effect over the pile (skip / reverse / +2 / +4 stamp
  their glyph, +2 / +4 also shake the centre, a wild colour flashes a ring in the new colour).
  The UNO! callout is the generated starburst with the word on top plus pixel sparks. The
  result screen shows a trophy or rain cloud, the crowned winner and confetti when you win.
  Everything stops with the motion setting or reduced motion.
- **Sound** (`pixel/sound.ts`): `createAudio` square / triangle voices and noise, plus the
  shared ZzFX `coin`: play, draw, skip, reverse, +2 / +4 hits, wild colour, UNO call, your
  turn, win and lose. The paper swish of the classic skin is off in 8-bit.

Art is about 96 KB in total: the two tables (~40 KB each) and five sheets under 6 KB.

## Pipeline

Generated 2026-09-24 with the Codex CLI image tool, with `pixel-store/store.webp` (converted
to PNG) as the style reference, in a scratch folder outside the repo:

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < prompt.md
```

Reduction (Pillow only):

```sh
# Tables: box-downsample, repaint the felt with a 4x4 Bayer dither, 32 colours.
python3 docs/uno-pixel/table.py raw/table-wide.png apps/web/static/games/uno/pixel/table-wide.webp 640 360 5 32
python3 docs/uno-pixel/table.py raw/table-tall.png apps/web/static/games/uno/pixel/table-tall.webp 360 640 5 32
# Cards: number faces and the back are redrawn at 44x64 from the render's sampled tones
# (frame, checker dither, stepped diamond, medallion); the wild orb is downsampled.
python3 docs/uno-pixel/cards.py raw apps/web/static/games/uno/pixel 44 64
# Numerals and action icons: hand-authored bitmaps, no generation.
python3 docs/uno-pixel/glyphs.py apps/web/static/games/uno/pixel/glyphs.webp
# Portraits and effects: 4x2 sheets keyed and aligned into one row of 40 px cells.
python3 docs/domino-pixel/pixelate.py sheet raw/avatars.png apps/web/static/games/uno/pixel/avatars.webp 4 2 40 96
python3 docs/domino-pixel/pixelate.py sheet raw/fx.png apps/web/static/games/uno/pixel/fx.webp 4 2 40 64
```

Sheet layouts the CSS relies on:

| File             | Cells                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `cards.webp`     | 6 × 44×64: red, yellow, green, blue, wild, back                                                         |
| `glyphs.webp`    | 15 × 28×24 big glyphs in rows red, yellow, green, blue, white; then 12×10 corner glyphs at y 120        |
|                  | columns: 0–9, skip, reverse, +2, +4, wild                                                               |
| `fx.webp`        | 8 × 39×40: starburst, trophy, rain cloud, ruby, topaz, emerald, sapphire, crown (gems at x 3–35, y 11+) |
| `avatars.webp`   | 8 × 41×40 portraits                                                                                     |
| `mini-back.webp` | 18×26 back for seat fans                                                                                |

Raw generations are not committed.

## Prompts

### tables

```text
You are producing pixel-art game backgrounds. The attached image is the STYLE reference: a cozy 16-bit pixel-art board game store (warm wood, warm hanging-lamp light, green plants, crisp pixels, clean dark outlines, limited palette, no blur, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE image and copy each resulting PNG to ./raw/<name>.png (exact names; do not modify them otherwise).

1. table-wide: a WIDE 16:9 image. A straight top-down (bird's-eye) view of a large OVAL card table seen from above, for a colourful card-matching party game. The table fills almost the whole image: its oval rim runs close to all four image edges (about 3-6% margin at left/right/top; the bottom rim is just inside the bottom edge). The table has a thick polished walnut wooden rim with small brass studs, and a deep GREEN card-room FELT playing surface inside, with a subtle pixel dither texture and a faint thin gold inlay line running around the felt about 8% inside the rim. The felt centre is slightly brighter from a warm lamp above, evenly lit elsewhere, low contrast so cards and text can sit on top. In the four image CORNERS only (outside the oval), a hint of a cozy wooden game room floor with small props: top-left a potted fern, top-right a small table lamp glow and a stack of game boxes, bottom-left a bowl of popcorn, bottom-right a mug of cocoa and a sleeping black-and-white cat. NO cards, NO people, NO hands, NO text, NO logos, NO UI, NO border.

2. table-tall: a TALL 9:16 portrait image of the SAME table and room in the same style and palette: a straight top-down view of a tall OVAL (egg-shaped, taller than wide) walnut-rimmed green felt card table filling almost the whole image, rim close to all four edges, the same gold inlay line, the same corner props (fern top-left, lamp and game boxes top-right, popcorn bottom-left, cocoa mug and sleeping cat bottom-right) squeezed into the corners. NO cards, NO people, NO text, NO logos, NO UI, NO border.

Both: crisp 16-bit pixel art with chunky visible pixels (as if drawn at about 640x360 pixels and upscaled with nearest neighbour), same palette and lighting as the reference, original design.
```

### cards

```text
You are producing pixel-art playing card sprites for an ORIGINAL colour-matching card game (not any existing brand). The attached image is the STYLE reference: crisp 16-bit pixel art, clean dark outlines, limited palette, no blur, no anti-aliasing mush.

Use your image generation tool to create EACH of the following as a SEPARATE image and copy each resulting PNG to ./raw/<name>.png (exact names; do not modify them otherwise).

Every card image: ONE upright playing card (portrait, width:height about 2:3), perfectly FLAT FRONT VIEW (not tilted, not rotated, no perspective), centred, filling about 80% of the image height, on a solid flat pure magenta background (#FF00FF) everywhere around the card; no shadow on the background. Square card corners cut as a one-pixel stair-step bevel (pixel art, not smooth rounded). Chunky visible pixels, as if the card were drawn at about 48x72 pixels and upscaled with nearest neighbour. A 1-pixel near-black outline around the card, then a 2-pixel cream-white inner border, then the coloured field. NO numbers, NO letters, NO text, NO symbols in the centre: the centre must hold an EMPTY plate so a number can be placed on top later.

1. face-red: coloured field in rich crimson RED with a subtle darker-red pixel checker dither pattern and a slightly lighter highlight band at the top edge; in the centre a large empty cream-white plate shaped like a DIAMOND with stair-stepped pixel edges and a dark 1-pixel outline, filling about 70% of the card width; tiny pixel sparkle motifs in two opposite corners.
2. face-yellow: identical layout to face-red but the field is warm golden YELLOW with darker amber dither.
3. face-green: identical layout but the field is emerald GREEN with darker green dither.
4. face-blue: identical layout but the field is cobalt BLUE with darker navy dither.
5. face-wild: identical frame, but the field is near-black charcoal with a faint dark dither, and instead of a plate the centre holds a glowing pixel-art faceted CRYSTAL ORB split into four quadrants coloured red (top-right), blue (bottom-right), yellow (bottom-left) and green (top-left), with a few pixel sparkles around it.
6. back: the card BACK: the same outline and cream-white border, field in deep midnight navy with a small repeating pixel diamond lattice pattern, and in the centre a bold round medallion: a four-coloured (red, yellow, green, blue) pinwheel star with a dark outline and a tiny white highlight. No text.

All six must share exactly the same card size, frame, border thickness and art style so they look like one deck.
```

### sprites (portraits and effects)

```text
You are producing pixel-art game sprites for an ORIGINAL colour-matching card party game. The attached image is the STYLE reference: crisp 16-bit pixel art, clean dark outlines, limited palette, warm cozy colours, no blur, no anti-aliasing mush.

Use your image generation tool to create EACH of the following as a SEPARATE image and copy each resulting PNG to ./raw/<name>.png (exact names; do not modify them otherwise). Every image uses a solid flat pure magenta background (#FF00FF) everywhere around the subjects, no shadows on the background, NO text, NO letters, NO numbers, NO border, NO frame lines.

1. avatars: a WIDE 2:1 image with a grid of 4 columns x 2 rows = 8 separate head-and-shoulders portrait busts of 8 DIFFERENT original friendly cartoon characters playing cards on game night, each centred in its own equal invisible cell with margin, all facing the viewer, identical scale and framing (head fully visible, shoulders cut at the cell bottom), cheerful expressions. Row 1: (a) a boy with a red baseball cap and freckles, (b) a girl with big curly black hair and a yellow headband, (c) an old man with a white beard and round glasses and a green sweater vest, (d) a woman with a blue bob haircut and star earrings. Row 2: (e) a tan-and-white corgi dog wearing a tiny bow tie, (f) a teenager with spiky orange hair and a purple hoodie, (g) a grandma with a grey bun and a pink cardigan, (h) a small green alien with a round head and a teal scarf. Nothing overlaps cell boundaries.

2. fx: a WIDE 2:1 image with a grid of 4 columns x 2 rows = 8 separate game sprites, each centred in its own equal invisible cell with generous margin, same pixel scale:
   (a) a jagged comic-book explosion STARBURST, yellow centre fading to orange then red spikes, dark outline, EMPTY centre (no text);
   (b) a shiny gold TROPHY cup with two handles on a small dark base, a sparkle;
   (c) a sad grey RAIN CLOUD with three blue rain drops falling under it;
   (d) a red RUBY gem, faceted, front view;
   (e) a yellow TOPAZ gem, same cut and size as the ruby;
   (f) a green EMERALD gem, same cut and size;
   (g) a blue SAPPHIRE gem, same cut and size;
   (h) a small pixel CROWN, gold with a red jewel.
```
