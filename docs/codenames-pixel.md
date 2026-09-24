# Codenames 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md). `Board.svelte` adds `cn-pixel` and
`px-tokens` when `gameSkin('codenames')` is `pixel` (home theme 8-bit, or the ⚙ "Table style"
choice), and lazy-loads `games/codenames/src/pixel.css`. Layouts, rules and Jev are unchanged.

- Word cards, panels, buttons and dialogs are CSS: flat colours, `--px` borders, hard shadows.
- Revealed words are covered by full agent cards, like the physical game, in both skins:
  `apps/web/static/games/codenames/cards/{classic,pixel}/` holds `red-a|b`, `blue-a|b`,
  `bystander-a|b` and `assassin` (480×320 WebP, ≤ 30 KB). The card index picks a or b. The
  word stays in the card's accessible name and hover title.
- The cover drops with `steps(4)`; reveal and win play ZzFX `stamp` / `win` cues.
- `table.webp` tiles the background.

## Art

Generated 2026-09-23 with the Codex CLI image tool: original characters, tinted per card
colour like the physical agent cards. The pixel set used `pixel-store/store.webp` as the style
reference. Each PNG was centre-cropped to 3:2 and saved as 480×320 WebP (Lanczos for classic,
nearest-neighbour for pixel).

```sh
codex exec --skip-git-repo-check --sandbox workspace-write - < classic.md
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < pixel.md
```

### classic cards

```text
You are producing card illustrations for an original spy word-guessing board game. Style: bold modern comic-book illustration, clean confident ink lines, flat cel shading with a few soft highlights, stylish 1960s spy-movie mood.

Create EACH of the following as a SEPARATE image (exact names; copy each resulting PNG to ./classic/<name>.png, do not modify it otherwise):

1. red-a: a male secret agent with slicked-back dark hair and a thin moustache, dark suit and tie, speaking into his wristwatch, cool confident look. RED/ORANGE card.
2. red-b: a female secret agent with a long high ponytail and a black leather jacket, lowering a pair of binoculars, sly smile. RED/ORANGE card.
3. blue-a: a male secret agent with a crew cut and a square jaw, trench coat with the collar turned up, holding a folded newspaper, serious look. BLUE card.
4. blue-b: a female secret agent with short curly hair, small round tinted glasses and a turtleneck, arms crossed, confident smile. BLUE card.
5. bystander-a: an ordinary middle-aged man in a cardigan holding a coffee mug, mouth open in surprise. BEIGE card.
6. bystander-b: an ordinary young woman holding a paper shopping bag, one hand on her head, flustered. BEIGE card.
7. assassin: a sinister figure in a long black coat and wide-brim hat, face hidden in shadow except a faint glint of red eyes. BLACK card.

Colour rules (the whole image, background AND character, is tinted in its card's colour family, like a duotone):
- RED/ORANGE cards: deep red, orange and warm amber tones; background a simple office corridor with tall windows.
- BLUE cards: navy, cobalt and cyan tones; background the same kind of office corridor with tall windows.
- BEIGE cards: warm beige, cream and sepia tones; background a simple suburban street with a white picket fence.
- BLACK card: charcoal, black and dark grey with only the red eye glint; background a dark alley.

Every image: landscape 3:2, ONE character shown from the waist up, slightly off-centre, head fully visible, character filling about 65% of the image height; the illustration fills the whole image edge to edge (full bleed). NO text, NO letters, NO border, NO frame, NO rounded corners, NO logos. All seven share one consistent art style, framing and lighting so they look like one card set. Original character designs; do not copy any existing game's characters.
```

### pixel cards

```text
You are producing pixel-art card illustrations for an original spy word-guessing board game. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited palette, no blur, no gradients, no anti-aliasing mush).

Create EACH of the following as a SEPARATE image (exact names; copy each resulting PNG to ./pixel/<name>.png, do not modify it otherwise):

1. red-a: a male secret agent with slicked-back dark hair and a thin moustache, dark suit and tie, speaking into his wristwatch, cool confident look. RED/ORANGE card.
2. red-b: a female secret agent with a long high ponytail and a black leather jacket, lowering a pair of binoculars, sly smile. RED/ORANGE card.
3. blue-a: a male secret agent with a crew cut and a square jaw, trench coat with the collar turned up, holding a folded newspaper, serious look. BLUE card.
4. blue-b: a female secret agent with short curly hair, small round tinted glasses and a turtleneck, arms crossed, confident smile. BLUE card.
5. bystander-a: an ordinary middle-aged man in a cardigan holding a coffee mug, mouth open in surprise. BEIGE card.
6. bystander-b: an ordinary young woman holding a paper shopping bag, one hand on her head, flustered. BEIGE card.
7. assassin: a sinister figure in a long black coat and wide-brim hat, face hidden in shadow except a faint glint of red eyes. BLACK card.

Colour rules (the whole image, background AND character, is tinted in its card's colour family, like a duotone):
- RED/ORANGE cards: deep red, orange and warm amber tones; background a simple office corridor with tall windows.
- BLUE cards: navy, cobalt and cyan tones; background the same kind of office corridor with tall windows.
- BEIGE cards: warm beige, cream and sepia tones; background a simple suburban street with a white picket fence.
- BLACK card: charcoal, black and dark grey with only the red eye glint; background a dark alley.

Every image: landscape 3:2, ONE character shown from the waist up, slightly off-centre, head fully visible, character filling about 65% of the image height; the illustration fills the whole image edge to edge (full bleed). NO text, NO letters, NO border, NO frame, NO rounded corners, NO logos. All seven share one consistent art style, framing and lighting so they look like one card set. Original character designs; do not copy any existing game's characters.
```

### table

```text
You are producing a pixel-art game background. The attached image is the STYLE reference: a cozy 16-bit pixel-art board game store (warm wood, crisp pixels).

Use your image generation tool to create ONE wide 16:9 image and copy the resulting PNG to ./bg/table.png (do not modify it otherwise).

table: a top-down view of a dark walnut wooden tabletop filling the whole image, horizontal planks with subtle pixel wood grain and a few tiny knots, evenly lit, low contrast so cards and text can sit on top of it. Crisp 16-bit pixel art with the reference palette. NO objects, NO props, NO cards, NO people, NO text, NO border, NO vignette.
```
