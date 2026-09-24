# Little Secret 8-bit skin

Viewer-only skin built on the [8-bit kit](pixel-kit.md). `Board.svelte` adds `px-tokens`
and `ls-pixel` to the table and its dialog when `gameSkin('little-secret')` is `pixel` (the
home theme, or ⚙ **Table style**), and lazy-loads `games/little-secret/src/pixel.css` plus
the chiptune pack `pixel/sound.ts`. Classic players download neither. Rules, layout slots and
the classic look are unchanged.

## What changes

- **Table**: a painted top-down card table (teal felt, walnut rail, desk lamp, envelopes,
  coffee, ink pot) covers the page; compact screens zoom past the rails so only felt sits
  behind the scrolling column.
- **Text first**: Jersey 10 everywhere (`font-size-adjust: ex-height 0.56`), ink on cream.
  The speaker's name is 40px, clue input 26px, the password 46px, clue bubbles 24px. Spanish
  accents and `ñ` render in the font.
- **Seats**: `PlayerToken` shows one of nine original suspect portraits per seat (faded sepia
  row once eliminated), seat number tag, gold score chip, bobbing gold arrow on the speaker
  and red arrow/frame on the chosen suspect. Name plaques are wood; clue slips are speech
  bubbles with a stepped tail. Revealed roles are a red stamp across the portrait with the
  faction icon, dropped with `steps(4)` only for eliminations accepted by the event gate.
- **Action area**: a clipboard (brass clip, wooden board, paper sheet). The envelope button
  shows the sealed / opened envelope sprite; the password letter slides out with `steps(3)`
  and scrolls into view.
- **Case notes**: a manila folder with a tab.
- **Badges**: power icons from `icons.webp` (`Badge.svelte`), also on RPS buttons.
- **Vote reveal**: ballot box and a "Most suspected / Tied" stamp that drops in.
- **Results**: handcuffs (intruders caught), open door (an intruder escaped), open envelope
  (Journalist guessed), or trophy + cheering mascot and stepped confetti at match end.
- **Guide**: `GuideScene.svelte` follows the same skin choice: three portraits, envelopes,
  speech bubbles, a stamped ✕ and the detective cat.
- **Sound** (`pixel/sound.ts`, `createAudio` + `playChiptune`): select blip, typewriter clue,
  turn ping, vote stamp, reveal arpeggio, envelope rustle, caught, escaped, deal, win, lose.
- Motion is `steps()` only and stops under the table's reduce-motion switch or the system
  preference.

## Art

| File            | Size    | Content                                                |
| --------------- | ------- | ------------------------------------------------------ |
| `table.webp`    | 42 KB   | 480×270 background, 40 colours                         |
| `suspects.webp` | 16 KB   | 9 portraits, 52×48 cells, colour row + faded row       |
| `icons.webp`    | 12.6 KB | 16 icons, 28×28 cells                                  |
| `props.webp`    | 3.9 KB  | 8 props, 55×48 cells                                   |
| `mascot.webp`   | 4.7 KB  | detective cat: idle, shh, look, cheer (48×56 cells)    |
| `envelope.webp` | 1.1 KB  | sealed / open envelope (37×40 cells)                   |
| `paper.webp`    | 0.3 KB  | 64×64 seamless paper tile (drawn in code, shown at 3×) |

Frame order lives in `pixel/Sprite.svelte` (`sheets`). Generated 2026-09-24 with the Codex CLI
image tool, using `pixel-store/store.webp` (converted to PNG) as the style reference:

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < <prompt>.md
```

Reduction (raw PNGs are not committed):

```sh
out=apps/web/static/games/little-secret/pixel
# table: box-downsample, median-smooth only the felt interior, 40 colours
python3 - <<'EOF'
from PIL import Image, ImageFilter
im = Image.open('raw/table.png').convert('RGB').resize((480, 270), Image.Resampling.BOX)
box = (48, 30, 430, 236)
im.paste(im.crop(box).filter(ImageFilter.MedianFilter(5)), box[:2])
im.quantize(40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB') \
  .save('apps/web/static/games/little-secret/pixel/table.webp', lossless=True, method=6)
EOF
python3 docs/domino-pixel/pixelate.py sheet raw/suspects.png $out/suspects.webp 3 3 48 64
python3 docs/domino-pixel/pixelate.py sheet raw/props.png $out/props.webp 4 2 48 40
python3 docs/domino-pixel/pixelate.py sheet raw/mascot.png $out/mascot.webp 4 1 56 40
# envelope: the top-left quarter of raw/props.png (sealed + open), re-reduced larger
python3 docs/domino-pixel/pixelate.py sheet raw/envelope.png $out/envelope.webp 2 1 40 32
```

`icons.webp` keys the 4×4 grid, trims each icon, scales all by one factor and centres them in
28 px cells without palette reduction (median cut dropped the seedling's green):

```python
# icon-sheet.py <raw.png> <out.webp> 4 4 28
im = key_magenta(Image.open(src))           # same key as pixelate.py
icons = [trim(cell) for cell in grid(im, 4, 4)]
scale = 26 / max(max(c.size) for c in icons)
# BOX-resize each, centre in its 28×28 cell, hard alpha (>127), lossless WebP
```

The suspects' second row is a sepia copy for eliminated players:

```python
sepia = ImageOps.colorize(ImageOps.grayscale(im), (38, 30, 26), (196, 178, 150))
# stack colour row + sepia row, quantize to 96 colours, keep hard alpha
```

`paper.webp` is drawn in code: base `#efddb4`, 90 random speckles in two darker and one
lighter cream, 14 short wrapping fibres (seed 7), 64×64.

### table

```text
You are producing a pixel-art game background for an original social-deduction party game about secret passwords and hidden infiltrators. The attached image is the STYLE reference: a cozy 16-bit pixel-art board game store (warm wood, crisp pixels, clean dark outlines, limited palette, no blur, no anti-aliasing mush).

Use your image generation tool to create ONE wide 16:9 image and copy the resulting PNG to ./raw/table.png (do not modify it otherwise).

table: a straight top-down view of a mysterious card table at night. The centre ~70% of the image is a large dark teal-green felt tabletop with a very subtle pixel felt texture, evenly lit, LOW contrast and fairly dark, so cream paper notes and text can sit on top of it. It is framed by a thick dark walnut wooden rail with a thin brass inlay line. Only in the four outer corners, small and partly cut off by the image edge: top-left a brass desk lamp casting a warm pool of light, top-right a stack of sealed cream envelopes with red wax seals, bottom-left a steaming coffee cup and a magnifying glass, bottom-right an ink pot with a quill and a small candle. Crisp 16-bit pixel art in the reference palette, moody film-noir mystery feel but cozy. NO people, NO cards in the centre, NO text, NO letters, NO border frame around the image, NO vignette gradient.
```

### suspects

```text
You are producing pixel-art character portraits for an original social-deduction party game (players whisper clues about a secret password and try to unmask infiltrators). The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited warm palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create ONE square image and copy the resulting PNG to ./raw/suspects.png (do not modify it otherwise).

suspects: a sprite sheet of NINE different head-and-shoulders portrait busts, arranged in a strict grid of 3 columns x 3 rows on a flat solid pure magenta (#FF00FF) background. Each bust sits centred in its own cell with wide empty magenta margins; nothing crosses from one cell into another; no frames, no cell borders, no shadows on the background. Every bust faces the viewer, same size, same framing (top of the head to the upper chest), same lighting, like a matching set of party-game guest portraits in a 1920s mystery-party mood. Big readable faces, bold dark outline around each bust.
Row 1: (1) a young woman with a short black bob and a pearl necklace, red dress, sly smile; (2) a cheerful older man with a white moustache and a green tweed flat cap; (3) a young man with messy ginger hair, round glasses and a blue sweater vest.
Row 2: (4) a woman with long curly brown hair and a mustard-yellow scarf, raised eyebrow; (5) a tall bald man with a thin goatee and a purple velvet smoking jacket; (6) a teenage girl with two braids, freckles and a teal hoodie, curious look.
Row 3: (7) an elegant grey-haired woman with a small feathered hat and cat-eye glasses; (8) a young man with dark curly hair and a leather aviator jacket, confident grin; (9) a woman with a platinum pixie cut and a black turtleneck, calm knowing look.
Original characters only. NO text, NO letters, NO numbers, NO logos.
```

### icons

```text
You are producing pixel-art game icons for an original social-deduction party game (secret passwords, hidden infiltrators, a journalist, voting, special powers). The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create ONE square image and copy the resulting PNG to ./raw/icons.png (do not modify it otherwise).

icons: a sprite sheet of SIXTEEN chunky item icons, arranged in a strict grid of 4 columns x 4 rows on a flat solid pure magenta (#FF00FF) background. Each icon is centred in its own cell, all icons roughly the same size (about 60% of a cell), with wide empty magenta margins; nothing crosses from one cell into another; no cell borders, no frames, no drop shadows on the background. Every icon has a bold 1-pixel dark outline and reads clearly when shrunk to 24x24 pixels. Warm palette with cream, brass gold, deep red, teal and ink black.
Row 1 (special powers): (1) a white mime face mask with black diamond eyes; (2) a small green seedling sprouting from a clump of soil; (3) an old wooden walking cane crossed with a pair of round spectacles; (4) a wise brown owl.
Row 2 (special powers): (5) a small ghost holding a dagger; (6) a golden judge's gavel; (7) a simple brass lapel pin shaped like a diamond; (8) a golden five-point sun medallion.
Row 3 (secret roles and tie-breakers): (9) a black masquerade eye mask; (10) a fountain pen crossed over a small reporter's notepad; (11) a grey rock; (12) a folded sheet of paper.
Row 4: (13) a pair of scissors; (14) a closed cream envelope with a red wax seal; (15) a small wooden ballot box with a paper slip going into its slot; (16) a red rubber stamp with a wooden handle.
Original designs only. NO text, NO letters, NO numbers, NO logos.
```

### props

```text
You are producing large pixel-art props for an original social-deduction party game (secret passwords in sealed envelopes, voting, unmasking infiltrators). The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited warm palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create ONE wide 3:2 image and copy the resulting PNG to ./raw/props.png (do not modify it otherwise).

props: a sprite sheet of EIGHT props, arranged in a strict grid of 4 columns x 2 rows on a flat solid pure magenta (#FF00FF) background. Each prop is centred in its own cell with wide empty magenta margins; nothing crosses from one cell into another; no cell borders, no frames, no drop shadows on the background. Bold dark outline on every prop, all drawn at the same pixel scale.
Row 1: (1) a large closed cream paper envelope seen from the back, flap closed with a round deep-red wax seal stamped with a keyhole shape; (2) the same envelope opened, flap up, with a blank cream letter card sliding halfway out; (3) the broken red wax seal in two halves; (4) a wooden rubber stamp with a brass collar, pressing down.
Row 2: (5) a golden trophy cup with two handles on a dark wooden base; (6) a pair of steel handcuffs; (7) an open wooden door with light spilling through and small dust puffs, suggesting someone escaped; (8) a brass magnifying glass.
Original designs only. NO text, NO letters, NO numbers, NO logos.
```

### mascot

```text
You are producing a pixel-art mascot sprite sheet for an original social-deduction party game about whispered secret passwords. The attached image is the STYLE reference: crisp 16-bit pixel art (clean dark outlines, limited warm palette, no blur, no gradients, no anti-aliasing mush).

Use your image generation tool to create ONE wide image (about 2:1) and copy the resulting PNG to ./raw/mascot.png (do not modify it otherwise).

mascot: FOUR poses of the same small cute black cat with big yellow eyes, wearing a tiny brown detective deerstalker hat and a red neckerchief, in a single row of 4 equal cells on a flat solid pure magenta (#FF00FF) background. Full body, sitting, facing the viewer, identical size and pixel scale in every cell, with wide magenta gaps between poses, nothing crossing between cells, no ground shadow. Poses: (1) sitting calmly, tail curled; (2) one paw raised to its mouth going "shh", eyes half-closed, secretive; (3) holding up a brass magnifying glass, one eye enlarged through it; (4) cheering with both paws in the air, eyes happy. Original character. NO text, NO letters, NO logos.
```

A paper-texture prompt (plain cream notepad paper, low contrast speckles) was also tried; its
speckles vanished at 64 px, so the shipped tile is drawn in code with its palette.
