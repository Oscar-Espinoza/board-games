# Catan 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md), in the style of a 16-bit strategy
map. `Board.svelte` adds `ca-pixel` and `px-tokens` when `gameSkin('catan')` is `pixel` (home
theme 8-bit, or ⚙ Settings › Table style, which switches live) and lazy-loads
`games/catan/src/pixel.css`; classic viewers never download it. Rules, events, layout and
the classic skin are unchanged. A `catan:pixel` Svelte context tells `Dice`, `ResourceArt`
and `PieceReserve` which look to draw.

## Island

- Everything on the SVG island snaps to one art pixel, `P = 100 / 64` board units (a hex
  is 64 px wide): `src/pixel/geometry.ts` rasterizes hexes, the shore, number discs and
  stair-stepped roads into merged per-row runs, drawn with `shape-rendering: crispEdges`.
- Terrain comes from `terrain.webp`, clipped to each pixel hex. It is a nested `<svg>` +
  `<image>`, not a `<pattern>`: Chrome smooths pattern images whatever `image-rendering` says.
- Settlements, cities and the robber are hand-pixelled grids in `src/pixel/sprites.ts`,
  recoloured per seat with a four-tone ramp (generated renders turn to mush at 15–20 px).
  Roads use the seat colour with an ink outline and a highlight row.
- Number tokens are pixel discs with real text (Jersey 10), 6 and 8 in red, and
  probability pips. Harbors are a pier, a bobbing boat sprite and a badge with the rate
  and a 16 px resource icon. When a number is rolled its tiles blink a gold ring.
- A result banner (crest, winner, civilization) drops in when the game ends; the phase
  line still announces it.

## Motion and sound

All effects in `effects.ts` take a `pixel` flag: tweens use `steps()` (about 12 fps),
dust is square, glows become hard gold outlines, nothing rotates. The dice replay the
same physics path sampled in hard frames, turning in quarter turns and flicking random
faces until they settle; the throw lasts `pixelThrowDuration(strength)`. Reduced motion
and the Motion setting skip all of it, as in the classic skin.

`src/pixel/sound.ts` is the chiptune pack (square/triangle tones and noise from
`createAudio`, plus the shared `playChiptune` win cue): dice rattle and landing clacks,
a coin when your delivery lands, falling whistle + crunch + chime for road / settlement /
city, a trade swap, a sneaky robber theme and thud, a theft zip, a card flip or fanfare
for development cards, an award fanfare, a win jingle, a turn ping and a reject buzz.

## Art

`apps/web/static/games/catan/pixel/` (≈61 KB in total):

| File                   | Size      | Contents                                                             |
| ---------------------- | --------- | -------------------------------------------------------------------- |
| `table.webp`           | 480×270   | tabletop: ocean, islets, ship, planks, map, compass, rope            |
| `terrain.webp`         | 6 × 64×69 | forest, pasture, fields, hills, mountains, desert                    |
| `resources.webp`       | 5 × 32    | wood, wool, wheat, brick, ore (cards, trade, costs, tokens)          |
| `resources-small.webp` | 5 × 16    | the same for harbor badges                                           |
| `boat.webp`            | 24        | harbor boat, with a 1 px ink outline                                 |
| `cards.webp`           | 6 × 64    | Knight, Road Building, Invention, Monopoly, Victory Point, card back |
| `crests.webp`          | 8 × 32    | six civilization crests, Longest Route and Largest Army icons        |

Generated on 2026-09-24 with the Codex CLI image tool, using `pixel-store/store.webp` (as
PNG) as the style reference, then reduced to true low-res sheets with
`games/catan/art/pixel-art.py` (box downsample, octree palette without dithering, magenta
key, hard alpha, hole fill, optional ink outline). The raw PNGs are not committed. The
`sea` tile from the terrain prompt was generated but not shipped.

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < prompt.md
ART='python3 games/catan/art/pixel-art.py'; OUT=apps/web/static/games/catan/pixel
$ART image bg/raw/table.png $OUT/table.webp 480 270 48
$ART tiles $OUT/terrain.webp 64 69 64 terrain/raw/{forest,pasture,fields,hills,mountains,desert}.png
$ART sprites $OUT/resources.webp 32 48 objects/raw/{wood,wool,wheat,brick,ore}.png
$ART sprites $OUT/resources-small.webp 16 32 objects/raw/{wood,wool,wheat,brick,ore}.png
$ART sprites $OUT/boat.webp 24 32 --outline objects/raw/boat.png:22
$ART tiles $OUT/cards.webp 64 64 64 cards/raw/{knight,road-building,invention,monopoly,victory-point,back}.png
$ART sprites $OUT/crests.webp 32 48 crests/raw/crest-{0,1,2,3,4,5}.png crests/raw/award-{road,army}.png
```

The objects prompt also produced robber, settlement and city renders; they were replaced
by the hand-pixelled sprites above.

### terrain

```text
You are producing pixel-art terrain tiles for an original hex-island trading and building board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited rich palette, warm light, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE SQUARE image (1:1). After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

Every tile: a straight top-down view (like the overworld map of a 16-bit strategy game), full-bleed terrain filling the whole square edge to edge, chunky readable pixel details, a slightly calmer plain patch in the very centre (a round number token will cover it). NO text, NO letters, NO numbers, NO border, NO frame, NO hexagon outline, NO roads, NO buildings, NO people, NO water unless stated. All seven share one consistent pixel size, palette and light direction (upper left) so they look like one tileset.

1. forest: a dense woodland of chunky round deciduous trees and a few dark green pines, each tree with a dark outline and a tiny shadow, grass visible between them, a couple of little mushrooms.
2. pasture: a bright light-green meadow with little tufts of grass and flowers, four or five small fluffy white sheep with dark faces grazing, a short wooden fence piece in one corner.
3. fields: golden wheat fields in neat rows with tilled furrows, a few tied wheat sheaves, warm yellow and ochre.
4. hills: terracotta clay hills with an open clay pit, small stacks of fired red bricks and a little brick kiln mound, orange-red earth with darker ridges.
5. mountains: craggy grey stone mountain peaks with snowy tips seen from above, scattered boulders, a small mine entrance with a cart of shiny blue-grey ore.
6. desert: pale golden sand dunes with ripples, a couple of small cacti, a sun-bleached skull-free rock, dry and bright.
7. sea: deep and mid blue ocean water with small white wave crests and sparkles, a SEAMLESSLY TILEABLE texture (left edge continues into right edge, top into bottom), even density everywhere, nothing else.
```

### objects

```text
You are producing pixel-art game sprites for an original hex-island trading and building board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited rich palette, warm light from the upper left, no blur, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE SQUARE image (1:1). Requirements for every image:
- Exactly ONE subject, centered, fully inside the frame with generous margin, nothing cropped, drawn big (filling about 70% of the frame).
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no floor, no cast shadow on the background, no text, no numbers, no border.
- Crisp pixel art matching the reference, chunky readable shapes with a 1-pixel dark outline, all images in one consistent pixel size and palette.
After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

1. wood: a small stack of three cut logs with bark and light ring ends, seen from a 3/4 view.
2. wool: one fluffy white sheep with a dark grey face and legs, standing, side view facing left.
3. wheat: one golden wheat sheaf tied with a brown band.
4. brick: a small neat stack of terracotta red bricks (six bricks, pyramid stack).
5. ore: a pile of three grey-blue ore rocks with shiny silver and blue crystal flecks.
6. robber: a hooded bandit figure seen from the front, dark charcoal grey hooded cloak covering almost the whole body, only two small glowing yellow eyes visible in the hood shadow, standing like a game pawn on a small round dark base.
7. boat: a small wooden harbor sailing boat with one cream sail and a brown hull, 3/4 view, on NO water.
8. settlement: a small house game piece carved from PLAIN WHITE-PAINTED wood: one square house with a pitched roof and a tiny door, seen from a 3/4 top-down view, only white and light-grey shading plus the dark outline (it will be recoloured per player later).
9. city: a city game piece carved from PLAIN WHITE-PAINTED wood: a wider building with a tall tower on the left and a lower pitched-roof hall on the right, 3/4 top-down view, only white and light-grey shading plus the dark outline (it will be recoloured per player later).
```

### cards

```text
You are producing pixel-art card illustrations for an original hex-island trading and building board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited rich palette, warm light, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE SQUARE image (1:1). After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

Every image: a small full-bleed pixel-art scene filling the whole square edge to edge, ONE clear central subject that still reads when shown tiny (about 64 pixels wide), a simple background. NO text, NO letters, NO numbers, NO border, NO frame, NO rounded corners, NO logos. All six share one consistent art style, pixel size and palette so they look like one card set. Original designs only.

1. knight: a brave knight in shining armour with a blue plume on the helmet, holding a raised sword and a round shield, standing on a grassy hill under a blue sky.
2. road-building: two cheerful road builders laying a stone-paved road that winds through green hills, one pushing a wheelbarrow of cobbles.
3. invention: an inventor's workbench with a brass gear contraption, a glowing lamp, rolled blueprints and small cogs, warm workshop light.
4. monopoly: a rich merchant in a red coat and hat hugging a big overflowing sack of goods at a market stall, sly grin.
5. victory-point: a grand stone castle with tall towers, golden flags and a golden laurel crown floating above it, sunset sky.
6. back: the back of a development card: a decorative golden compass rose on a deep navy blue background with a thin pattern of tiny stars, symmetrical.
```

### crests

```text
You are producing pixel-art heraldic crests for six original civilizations in a hex-island trading and building board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited rich palette, warm light, no blur, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE SQUARE image (1:1). Requirements for every image:
- Exactly ONE heater-shaped heraldic shield, front view, centered, fully inside the frame with generous margin, filling about 75% of the frame. Same shield shape, size, gold rim and pixel size in all eight images.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no shadow on the background, no text, no letters, no numbers, no border.
- Crisp pixel art matching the reference with a 1-pixel dark outline and a thin gold rim.
After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

1. crest-0: Ember Kingdom: a bright RED shield (#df261b family) with a golden eight-pointed blazing sun.
2. crest-1: Tideborn Clans: a bright BLUE shield (#008ce1 family) with three white curling ocean waves.
3. crest-2: Sunstone Empire: a bright YELLOW shield (#f5c735 family) with a big faceted amber gemstone diamond.
4. crest-3: Copper Citadel: a bright ORANGE shield (#f88719 family) with a dark brown castle tower gate.
5. crest-4: Verdant Union: a bright GREEN shield (#54b877 family) with a white curling leaf vine.
6. crest-5: Violet Dominion: a bright PURPLE shield (#ac79dd family) with a white four-pointed star.
7. award-road: NOT a shield: a wooden signpost with two arrow boards next to a short cobbled road segment (the Longest Route award icon).
8. award-army: NOT a shield: two crossed swords over a small round wooden shield (the Largest Army award icon).
```

### table

```text
You are producing a pixel-art game background. The attached image is the STYLE reference: a cozy 16-bit pixel-art board game store (warm wood, crisp pixels, rich limited palette, no blur, no anti-aliasing mush).

Use your image generation tool to create ONE wide 16:9 image and copy the resulting PNG to ./raw/table.png (do not modify it otherwise).

table: a straight top-down view of a board-game table scene in crisp 16-bit pixel art. The central 65% of the image is continuous open ocean: rich blue water with small pixel wave crests and a few sparkles, evenly patterned and calm, because a hexagonal island board will be placed on top of it. Around the ocean, only near the outer edges: dark warm wooden table planks along the left edge, right edge and bottom edge (bottom ~14%), a coiled hemp rope in one corner, a rolled parchment map and a small brass compass in the lower left corner, a tiny wooden sailing ship near the right edge on the water, two small rocky islets with palm trees near the top corners, green tropical leaves poking in at the top left and top right corners. Evenly lit, moderate contrast. NO island in the middle, NO hexagons, NO game pieces, NO dice, NO cards, NO people, NO text, NO letters, NO UI, NO border, NO vignette.
```
