# Sushi Go Party 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md): a cute 16-bit sushi bar. The rules,
layouts, projections and protocol are unchanged, and the skin never reaches the server.

## How it works

- `Board.svelte` reads `gameSkin('sushi-go-party')`. With `pixel` it lazy-loads
  `src/pixel.css` (it `@import`s the shared kit), adds `px-tokens sgp-pixel` to the table and
  the dialog, and shares the choice through `pixel/context.ts`. ⚙ **Table style** (Classic /
  8-bit, shared `m.skin*` keys) calls `setGameSkin` and switches live. Classic renders exactly
  as before and downloads no pixel CSS, fonts or images.
- `FoodArt.svelte` (used by `Card`, menu tiles, the picker and the guide) draws
  `pixel/PixelDish.svelte` instead of SVG: sprites from `dishes.webp`. Counts show as pieces
  (1–3 maki, two uramaki, each fruit of a mixed pair); the menu tiles show nigiri and onigiri
  trios. Pieces are sized with container queries so they always fit their box.
- `Card.svelte` sets `data-family` (nigiri+wasabi, roll, appetizer, special, dessert, boxed).
  Pixel cards are paper with an ink border and a family-coloured frame, a dish-coloured title
  banner and a black score strip in gold.
- `ScoreTrack.svelte` becomes a square conveyor belt (`belt-h/v.webp` tiles, a numbered plate
  every 5 points). While hands pass, `.passing` scrolls each run with `steps(6)` in the
  clockwise direction, the pass arrows march, and `passBundles(..., pixel)` moves the emblem
  card backs in `steps(7)` without rotation.
- `ScorePawn.svelte` draws a 10×13 pixel rice-ball pawn (`pixel/pawn.ts`) in the seat colour.
- `pixel/PixelDecor.svelte` replaces `TableDecor` with sprite props (bonsai, lucky cat,
  teapot, lantern, chopstick rest, bamboo, soy dish) and flat paper notes with real text.
- The menu picker has the chef mascot. Round receipts add score ticks (green for points, red
  for penalties, one per point up to 12) that appear in steps, plus a dessert tally per guest.
  The final screen adds a ranking with pawns, final scores and dessert counts, and the chef
  hops beside it. Your tray's dessert badge shows the menu's dessert sprite.
- `pixel/sound.ts` is the chiptune pack (square/triangle notes and noise plus the shared
  `coin`, `win` and `lose` cues): pick, lock, reveal, pass (belt clatter), combo (tempura pair,
  sashimi trio, wasabi nigiri on your plate), score, round end, dessert, win and lose.
- Hard edges only: borders and shadows in multiples of `--px`, no radius, blur, filter,
  rotation or gradients on chrome. Motion is `steps()` and stops with reduced motion or the
  table's motion setting. Phones keep the compact layout with smaller pixel type.

## Art

`apps/web/static/games/sushi-go-party/pixel/` (≈53 KB total):

| File                        | Size   | Content                                                           |
| --------------------------- | ------ | ----------------------------------------------------------------- |
| `dishes.webp`               | 34 KB  | 36 sprites, 64×64 cells, 8×5 (order in `pixel/sprites.ts`)        |
| `props.webp`                | 7 KB   | 9 table props, 64×64 cells, 3×3                                   |
| `table.webp`                | 8 KB   | 480×270 hinoki counter, tiled at 3× (1440×810)                    |
| `chef.webp`                 | 2.4 KB | 60×88 cat chef mascot                                             |
| `belt-h.webp`/`belt-v.webp` | <1 KB  | 8×16 hand-placed belt tiles (steel slats, red rails), drawn at 3× |

Generated on September 24, 2026 with the Codex CLI image tool, passing
`pixel-store/store.webp` (converted to PNG) as the style reference. Raw PNGs are not
committed. Every generation drew a 3×3 grid of items on magenta (some came back
transparent, which the pipeline accepts):

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < dishes.md
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < props.md
```

Pipeline (Python + Pillow scratch scripts, not committed; each step is described here):

1. **Key**: magenta excess `min(r, b) - g > 70` becomes transparent, multiplied by any
   existing alpha (the same key as `docs/domino-pixel/pixelate.py`).
2. **Cut**: label opaque blobs, give each blob to the grid cell holding its centroid (so a
   neighbour's tail crossing the cell line is dropped), crop to the union of that cell's blobs.
3. **Reduce**: box-downsample by the render's native pixel period (≈6.5 px for the dish and
   prop sheets, measured with a Fourier fit of the edge profile; 10.8 for the chef), fit
   into a 62 px box and centre in a 64 px cell.
4. **Palette**: quantize the whole sheet without dithering and with hard alpha, then save
   lossless WebP. `FASTOCTREE` at 256 colours kept the rainbow ticket and the blue ice-cream
   bowl that median cut at 128 colours washed out (35 KB instead of 29 KB).

```sh
COLORS=256 QM=FASTOCTREE python pack.py dishes.webp 64 8 \
  raw/dishes-1.png:6.5 raw/dishes-2.png:6.5 raw/dishes-3.png:6.5 raw/dishes-4.png:6.5
COLORS=192 QM=FASTOCTREE python pack.py props.webp 64 3 raw/props.png:6.7
QM=FASTOCTREE python single.py raw/chef.png chef.webp 10.8          # key, trim, reduce
QM=FASTOCTREE python single.py --bg raw/table.png table.webp 480 270 40  # box + 40 colours
python belt.py .   # writes the two belt tiles from a 16-row character grid
```

The belt tile grid (`R`/`r` red rail, `g` gap, `L`/`s`/`m`/`d` light→dark steel), one row
per line; `belt-v` is its transpose:

```text
RRRRRRRR rrrrrrrr rrrrrrrr gggggggg Lssssmdg Lssssmdg Lssssmdg Lsssssmg
Lsssssmg Lssssmdg Lssssmdg Lssssmdg gggggggg rrrrrrrr rrrrrrrr RRRRRRRR
```

### dishes.md

```text
You are producing pixel-art game sprites for an original, cute sushi-bar card game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited warm palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create EACH of the following sprite sheets as a SEPARATE image. After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

Rules for EVERY sheet:
- A SQUARE image with a 3 x 3 grid of equal invisible cells (3 columns, 3 rows), exactly ONE item per cell, centred in its cell with a generous empty margin so nothing touches or crosses a cell boundary, all items drawn at the same scale and the same 3/4 top-down angle, left to right, top to bottom in the order listed.
- Solid flat pure magenta background (#FF00FF) everywhere around the items; no floor, no plates unless stated, no cast shadows on the background, no grid lines, no text, no letters, no numbers, no border.
- Crisp chunky 16-bit pixel art like the reference: 1-pixel dark brown/ink outline around every item, 3-4 flat shading tones per colour, a few bright highlight pixels.
- Cute kawaii style: every FOOD item has a tiny happy face (two black dot eyes, a small smile, pink blush dots). Utensils and objects (chopsticks, spoon, menu, ticket, boxes, cup) have NO face.
- Original designs only; do not copy any existing card game's art.

1. dishes-1:
   row 1: egg nigiri (a block of white rice topped with a thick yellow sweet omelette slab tied with a thin dark-green nori belt); salmon nigiri (white rice topped with a bright orange salmon slice with pale stripes); squid nigiri (white rice topped with a pearly white squid slice scored with a light criss-cross pattern).
   row 2: maki roll piece (ONE thick round maki slice seen from above at an angle: dark-green nori outside, white rice ring, pink tuna and green cucumber centre); temaki hand roll (a cone of dark-green nori filled with rice, salmon, cucumber and a lettuce leaf sticking out the top); uramaki piece (ONE inside-out roll slice: white rice outside covered in black and white sesame seeds, thin nori ring, avocado and crab centre).
   row 3: tempura (two golden fried shrimp tempura with crispy bumpy batter and red tails, crossed); sashimi (three fanned slices of red tuna sashimi on a green shiso leaf); dumpling (one plump pan-fried gyoza dumpling with pleats and a browned bottom).

2. dishes-2:
   row 1: eel (a glossy brown grilled unagi eel fillet with dark sauce glaze on a block of rice, with a nori belt); tofu (a single wobbly white cube of silken tofu with a little green scallion on top); edamame (a small heap of four bright green edamame pods with bumps for beans).
   row 2: miso soup (a red lacquered bowl of brown miso soup with little tofu cubes, green scallion rings and a wakame leaf); circle onigiri (a ROUND flat rice ball with a small nori strip at the bottom); triangle onigiri (a TRIANGLE rice ball with a nori wrap at the bottom).
   row 3: square onigiri (a SQUARE rice cake with a nori band around the middle); rectangle onigiri (a long horizontal RECTANGLE rice block with a nori band, twice as wide as it is tall); wasabi (a mound of bright green wasabi paste shaped like a little leaf-topped hill).

3. dishes-3:
   row 1: chopsticks (a pair of red lacquered chopsticks with gold tips, crossed in an X, NO face); spoon (a white ceramic Chinese soup spoon with a blue flower on the handle, NO face); menu (a small closed restaurant menu booklet, red cover with a gold sushi emblem, NO text, NO face).
   row 2: special order (a glowing rainbow paper order ticket with a big golden star and sparkles around it, NO text, NO face); takeout (an open white paper takeout box with a red wire handle, a few sushi peeking out, NO face on the box); soy sauce (a small glass soy sauce bottle with a red cap next to a tiny dish of dark soy sauce, NO face).
   row 3: tea (a green ceramic Japanese teacup full of green tea with a little steam curl, NO face); closed box (a CLOSED plain brown cardboard takeout box seen upside-down, taped shut, NO face); card back emblem (a round red badge with a cream wave pattern ring and a tiny smiling salmon nigiri in the centre).

4. dishes-4:
   row 1: pudding (a wobbly caramel custard flan with dark caramel on top and a cherry); green tea ice cream (two scoops of pale green matcha ice cream in a small blue ceramic bowl); watermelon (one juicy triangular watermelon slice with black seeds).
   row 2: orange (one round orange with a green leaf and a tiny peeled segment beside it); pineapple (one small whole pineapple with a spiky green crown); sushi plate (an EMPTY small round conveyor-belt sushi plate seen from above, cream with a red rim, NO face).
   row 3: salmon roe gunkan (a rice oval wrapped in nori topped with shiny orange salmon roe pearls); tamago slices (a small stack of two yellow omelette slices); shrimp nigiri (white rice topped with a pink and white cooked shrimp).
```

The last three dishes (roe, tamago, shrimp) are spares for future decoration.

### props.md

```text
You are producing pixel-art decoration sprites for an original, cute sushi-bar board game table seen from above. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited warm palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create EACH of the following as a SEPARATE image. After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

1. props: a SQUARE image with a 3 x 3 grid of equal invisible cells, exactly ONE object per cell, centred with a generous empty margin so nothing touches or crosses a cell boundary, all at the same scale, 3/4 top-down view, left to right, top to bottom:
   row 1: a small bonsai pine tree in a blue ceramic pot; a white lucky cat figurine with a red collar and a gold bell, one paw raised (original design); a brown clay teapot with a small matching cup.
   row 2: a red paper lantern with black top and bottom rims (NO writing); a pair of wooden chopsticks resting on a small fish-shaped ceramic rest; a small wooden sushi serving board (geta) with a little pile of pink pickled ginger and a dab of wasabi.
   row 3: a small potted bamboo plant; a rolled green bamboo sushi mat; a small white ceramic dish of soy sauce next to a tiny fish-shaped soy bottle.
   Solid flat pure magenta background (#FF00FF) everywhere around the objects; no floor, no cast shadow on the background, no grid lines, no text, no letters, no border.

2. chef: ONE square image of a cute original mascot: a round, chubby orange-and-cream cat sushi chef standing, facing the viewer, wearing a white chef coat and a blue headband (hachimaki, no writing), smiling with closed happy eyes, holding a small wooden board with one salmon nigiri in both paws. Full body, centred, generous margin. Solid flat pure magenta background (#FF00FF) everywhere; no floor, no shadow, no text.

3. table: ONE wide 16:9 image: a top-down view of a light warm hinoki wood sushi bar counter filling the whole image, long horizontal planks with subtle pixel wood grain and a few tiny knots, evenly lit, LOW contrast so cards and text can sit on top of it. Crisp 16-bit pixel art with the reference palette. NO objects, NO props, NO food, NO people, NO text, NO border, NO vignette.
```
