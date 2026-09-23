# 8-bit store home theme

The home page has two themes: **Classic** (the original library) and **8-bit**, a pixel
board-game store (`apps/web/src/lib/home/PixelStore.svelte`, lazy-loaded). The header
switch saves the choice in `localStorage['board-games:theme']`; `app.html` applies it
before first paint. Picking a game sends the shopkeeper on an errand
(`lib/home/shopkeeper.ts`): sometimes to the wrong shelf first, up the ladder for top
shelves, and always back with the box. Reviews are random per visit and not real.
Shelf positions in `PixelStore.svelte` are percentages of the painted `store.webp`.

## Art

Generated on September 22, 2026 with the Codex CLI's built-in image tool, using the
supplied Pixel Play mock-up as a style reference, then keyed with the Carcassonne script:

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < <prompt>.md
python3 docs/carcassonne-3d/key-sprites.py raw/sprites apps/web/static/games/pixel-store/sprites 360
python3 docs/carcassonne-3d/key-sprites.py raw/boxes apps/web/static/games/pixel-store/boxes 256
```

Walking and carrying use 8-frame cycles (contact, down, passing, up per leg), the usual
pixel-art walk, played at ~10 fps with CSS `steps(8, jump-none)` on a single strip. Codex
draws each cycle as one row; `pack-strip.py` keys it, aligns every frame on the head/torso
centroid and feet baseline (no per-frame trim, so no jitter) and writes equal cells:

```sh
python3 docs/pixel-store/pack-strip.py strips/walk.png apps/web/static/games/pixel-store/sprites/walk-strip.webp
python3 docs/pixel-store/pack-strip.py strips/carry.png apps/web/static/games/pixel-store/sprites/carry-strip.webp
```

The cell aspect goes in `cells` (`shopkeeper.ts`); `stride` is the scene-width % one
cycle covers, so walk durations keep the feet planted instead of skating.

`store.webp` is the unkeyed background saved as WebP quality 80. Raw generations are not committed.
Pixelify Sans is bundled under `static/fonts/pixel-store/` (OFL).

## Prompts

### store

```text
You are producing pixel-art game assets. The attached image is the STYLE reference: a cozy 16-bit style pixel-art board game store, warm wood, hanging lamps, green plants, a black-and-white cat, a dark red rug.

Use your image generation tool to create ONE image and copy the resulting PNG file to ./raw/store.png (do not modify it otherwise).

store: a wide 16:9 pixel-art interior of a small cozy board game store, seen straight-on from the front like a side-scrolling game level, crisp pixel art, same palette and lighting as the reference.
- NO people, NO shopkeeper, NO characters (except one sleeping black-and-white cat curled on the floor in the bottom-left corner).
- Left 70% of the image: one long wall of tall wooden shelves packed with colorful board game boxes, three shelf rows (top, middle, bottom). Above the shelves, three small wooden plaques that read exactly "STRATEGY", "FAMILY", "PARTY" from left to right. No other readable text anywhere.
- A thin brass rail runs along the top shelf for a rolling ladder, but do NOT draw the ladder.
- Right 30%: a wooden shop counter with an old beige computer, a bell, potted plants, a window with daylight behind it, and one blank hanging wooden sign (no text) above the counter.
- Three warm hanging lamps across the ceiling.
- A clear empty strip of wooden floor along the whole bottom of the image (bottom ~22%) where a character could walk from left to right, with a dark red rug in the middle that has NO text on it.
- No borders, no UI, no watermark, no text except the three shelf plaques.
```

### manager

`walk-a`, `walk-b` and `carry` from this v1 prompt were replaced by the 8-frame strips below.

```text
You are producing pixel-art game sprites. The attached image is the STYLE reference: a cozy 16-bit style pixel-art board game store. The shopkeeper in it (brown hair, brown beard, round glasses, white shirt with rolled sleeves, green apron, dark jeans, brown shoes) is the CHARACTER reference.

Use your image generation tool to create EACH of the following as a SEPARATE square image. Requirements for every image:
- Exactly ONE subject, centered, full body fully inside the frame with generous margin, nothing cropped.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no floor, no shadow on the background, no text, no border.
- Crisp pixel art matching the reference, same character design in every image (same face, beard, glasses, green apron, colors), side view facing RIGHT unless stated.
After each image is generated, copy the resulting PNG to ./raw/<name>.png (exact names below). Do not modify them otherwise.

1. idle: shopkeeper standing, facing the viewer, relaxed, hands on apron.
2. walk-a: shopkeeper walking to the right, left leg forward (walk cycle frame A).
3. walk-b: shopkeeper walking to the right, right leg forward (walk cycle frame B), otherwise identical to walk-a.
4. reach: shopkeeper seen from behind, standing on tiptoes, one arm reaching up high as if pulling a box from a shelf above.
5. confused: shopkeeper facing the viewer, scratching his head with one hand, puzzled expression, a small "?" is NOT drawn.
6. carry: shopkeeper walking to the right, holding a colorful board game box with both hands in front of his chest, proud smile.
7. portrait: head-and-shoulders bust of the shopkeeper facing the viewer, smiling warmly (for a dialogue box).
8. ladder: a wooden rolling library ladder alone (no person), tall and narrow, 7 rungs, small wheels at the bottom and hooks at the top, front view.
```

### boxes

```text
You are producing pixel-art game assets. The attached image is the STYLE reference: the chunky, colorful pixel-art board game boxes in the left grid (e.g. "Castle Quest", "Mystic Market"): a 3/4 view box showing the front cover and a thin side, bold pixel title lettering, rich illustrated cover.

Use your image generation tool to create EACH of the following board game boxes as a SEPARATE square image. Requirements:
- Exactly ONE box, centered, fully inside the frame with generous margin, same 3/4 angle for every box.
- Solid flat pure magenta background (#FF00FF) everywhere around the box; no shadow on the background, no border.
- Crisp pixel art in the reference style. The title text on the cover must be spelled EXACTLY as given and be large and legible. No other text.
After each image is generated, copy the resulting PNG to ./raw/<name>.png. Do not modify them otherwise.

1. uno — title "UNO": red box, big yellow-outlined title in a white oval, a fan of colorful number cards (red, yellow, green, blue) on the cover.
2. catan — title "CATAN": warm orange/yellow box, hex island of wheat, forest, hills and mountains surrounded by blue sea, a tiny red road and settlement.
3. carcassonne — title "CARCASSONNE": green and sky blue box, a medieval walled city with red roofs on a hill, fields and a road, small colorful meeples.
4. azul — title "AZUL": deep blue box with ornate Portuguese azulejo tile patterns, colorful square tiles in blue, yellow, red, black and teal.
5. codenames — title "CODENAMES": dark navy and red spy-themed box, a trench-coat agent silhouette, a grid of word cards, a magnifying glass.
6. sushi-go-party — title "SUSHI GO PARTY!": bright playful pink/orange box with cute smiling sushi characters (nigiri, maki, tempura) wearing party hats.
7. little-secret — title "LITTLE SECRET": dark green box with an old sealed envelope with a red wax seal and a keyhole, mysterious candlelight.
```

### walk and carry strips

```text
You are producing pixel-art animation sprite strips. Attached: (1) the STYLE reference, a cozy 16-bit pixel-art board game store; (2) the CHARACTER reference: the shopkeeper (brown messy hair, brown beard, round glasses, white shirt with rolled sleeves, green apron, dark blue jeans, brown shoes). Match the character exactly.

Use your image generation tool to create EACH strip below as a SEPARATE wide image (aspect about 4:1). Requirements for every strip:
- Exactly 8 animation frames of the SAME character in ONE horizontal row, evenly spaced in 8 equal-width invisible cells, left to right in animation order. Nothing overlaps cell boundaries.
- Every frame: identical scale, identical character size, feet on the SAME baseline near the bottom, full body visible with margin, side view facing RIGHT, walking in place (no horizontal travel between frames).
- A smooth, looping 8-frame walk cycle: 1 contact (right foot forward heel down), 2 down (weight on right leg, body lowest), 3 passing (left leg passes, body rising), 4 up (body highest), 5 contact (left foot forward), 6 down, 7 passing, 8 up. Arms swing opposite to legs. Subtle 1-2 pixel vertical body bob only.
- Solid flat pure magenta background (#FF00FF) everywhere; no floor, no shadows, no text, no frame lines, no numbers.
- Crisp pixel art matching the references.
After each image is generated, copy the resulting PNG to ./strips/<name>.png. Do not modify them otherwise.

1. walk: the shopkeeper walking, arms swinging naturally.
2. carry: the shopkeeper walking while holding a colorful board game box with both hands in front of his chest (arms stay on the box; only legs and slight body bob animate), proud smile.
```
