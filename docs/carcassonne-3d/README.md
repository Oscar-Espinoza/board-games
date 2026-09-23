# Carcassonne standing sprites

Painted sprites for [ADR 025](../adr/025-carcassonne-standing-scenery.md), generated
with the Codex CLI's built-in image tool on September 22, 2026. The reference was
the supplied board-game mock-up (`ChatGPT Image Sep 22, 2026, 12_41_27 AM.png`).

```sh
codex exec --skip-git-repo-check --sandbox workspace-write -i reference.png - < sprite-prompt.md
python3 docs/carcassonne-3d/key-sprites.py sprites-raw apps/web/static/games/carcassonne/sprites
```

The keying script needs only Pillow. It removes the magenta background, keeps
alpha that some generations already carry, erodes one edge pixel, removes spill,
trims and saves WebP images with a 320px maximum side. Raw generations are not committed.

## Prompt

```text
You are producing game sprite art. The attached image is the style reference: a painterly, warm, highly detailed medieval tile board game seen from a high three-quarter isometric angle (camera ~50 degrees above the table), warm key light from the upper left, soft shadows to the lower right, saturated greens, terracotta/orange-red roofs, cream-grey stone walls.

Use your image generation tool to create EACH of the following sprites as a SEPARATE image. Requirements for every image:
- Exactly ONE subject, centered, fully inside the frame with generous margin, nothing cropped.
- Solid flat pure magenta background (#FF00FF) everywhere around the subject; no ground plane, no grass base, no cast shadow on the background, no text, no border, no vignette.
- Same three-quarter isometric angle and lighting as the reference, painterly style matching the reference.
- Square image.

After each image is generated, copy the resulting PNG file to ./sprites-raw/<name>.png (exact names below). Do not modify the images otherwise.

Standing sprites (magenta background):
1. houses-a: a tight cluster of 3 medieval half-timbered houses with orange-red tile roofs, cream plaster walls.
2. houses-b: a cluster of 4 small stone townhouses with terracotta roofs and one small chimney.
3. houses-c: a cluster of 5 tightly packed town houses of varying height, red roofs, a tiny bell tower among them.
4. houses-d: a cluster of 2 houses, one taller with a steep red roof.
5. house-single-a: one small cottage with a red roof and chimney.
6. house-single-b: one narrow tall townhouse with a dark orange roof.
7. tower-round: one round stone wall tower with crenellations and a pointed red conical roof.
8. tower-square: one square stone wall tower with crenellations and a small red pyramid roof.
9. gatehouse: a stone city gatehouse with an arched gate and two small turrets with red roofs.
10. keep: a large medieval stone castle keep with several towers with pointed red roofs, grey walls, and a red banner, like the big castle in the reference.
11. cathedral: a large gothic stone cathedral with a tall spire and red roofs.
12. monastery: a medieval abbey church with a bell tower, cream stone and red roof, a small cloister wall, like the monastery in the center of the reference.
13. trees-a: a clump of 3 round leafy deciduous trees, green.
14. trees-b: a clump of 2 tall cypress trees and a bush.
15. trees-c: a single large round oak tree.
16. bush: a small round green bush.
17. sheep-a: a single white woolly sheep standing, facing left.
18. sheep-b: a single white woolly sheep grazing, head down, facing right.
19. windmill: a medieval wooden windmill with four sails on a stone base, like the one in the reference.
20. haystack: a small golden haystack.

Flat top-down ground decals (these are seen from directly above, still on magenta background):
21. wheat: a small rectangular patch of golden wheat field with rows, top-down, soft irregular edges.
22. vineyard: a small rectangular patch of green vineyard rows with a little wooden fence, top-down.
23. bridge: a small arched stone bridge, seen from the same isometric angle as the reference, spanning left to right.

Work through all 23. If a generation fails, retry once. At the end, list the files in ./sprites-raw.
```

Sprite widths (in tile units) and sway flags live in
`games/carcassonne/src/table/sprites.ts`.

## Figures

Keyed with a 256px maximum side and saved as `figure-<name>.webp`; players tint
them with an SVG multiply filter.

```text
You are producing game-piece sprite art. The attached image is the style reference: a painterly, warm, highly detailed board game seen from a high three-quarter angle, warm key light from the upper left. Look closely at the glossy wooden meeple figures standing on the board (red, blue, green, yellow): chunky, rounded, smooth lacquered wood with soft highlights and shading.

Use your image generation tool to create EACH of the following as a SEPARATE square image. Requirements for every image:
- Exactly ONE game piece, centered, fully inside the frame with generous margin, nothing cropped.
- The piece is painted a NEUTRAL VERY LIGHT GREY / near-white glossy lacquer (so it can be recoloured later by multiplying a colour over it). Keep the shading and glossy highlights; no coloured tint, no numbers, no text, no markings.
- Standing upright, seen from the same high three-quarter angle and lighting as the meeples in the reference.
- Transparent background if possible; otherwise a solid flat pure magenta (#FF00FF) background. No ground, no cast shadow, no border.

After each image is generated, copy the resulting PNG to ./meeples-raw/<name>.png (exact names below). Do not modify the images.

1. meeple: the classic Carcassonne meeple (round head, arms out, legs apart), chunky and glossy exactly like the ones in the reference.
2. abbot: a meeple-like abbot figure with a hooded robe silhouette, same chunky glossy wood.
3. builder: the tall narrow Carcassonne builder figure (a tall meeple variant with a small head), same glossy wood.
4. pig: a small chunky wooden pig game piece, same glossy wood.

Do all four, then list the files in ./meeples-raw. Do not regenerate images for background reasons; transparent or magenta are both acceptable.
```
