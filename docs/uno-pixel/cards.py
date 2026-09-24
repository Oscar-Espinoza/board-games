"""Reduce the Codex card renders to one low-res sprite sheet for the 8-bit UNO skin.

usage: python3 cards.py <raw-dir> <out-dir> [width=44] [height=64]

Reads face-red, face-yellow, face-green, face-blue, face-wild and back (.png, magenta or
transparent background). The generated designs are simple enough to redraw exactly at
the logical size, which keeps the checker dither and outlines crisp where a plain
downsample would smear them:

- number faces: the render's two checker tones, top highlight and cream are sampled and
  the frame, dithered field and stair-stepped diamond plate are drawn pixel by pixel
  (the corner sparkles are left out; the corner indices sit there);
- wild and back: the render is box-downsampled for the orb / medallion and the same
  frame is drawn around it, with the wild's corner sparkles and top band painted out.

Writes cards.webp (one row, in that order) and mini-back.webp (18x26, for seat fans).
Requires Pillow only.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

NAMES = ['face-red', 'face-yellow', 'face-green', 'face-blue', 'face-wild', 'back']
INK = (26, 15, 8, 255)
CREAM = (250, 244, 226, 255)


def key(image):
    image = image.convert('RGBA')
    r, g, b, given = image.split()
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: 0 if v > 90 else 255)
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(alpha, given)))


def card_crop(src):
    im = key(Image.open(src))
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox())


def tones(im, box, n=2):
    """The n dominant colours of a region, darkest first."""
    q = im.convert('RGB').crop(box).quantize(n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: n * 3]
    cols = [tuple(pal[i * 3 : i * 3 + 3]) + (255,) for i in range(n)]
    return sorted(cols, key=lambda c: sum(c[:3]))


def frame(px, w, h, field_edge):
    """1 px ink outline with stepped corners, 1 px cream border, 1 px darker field edge."""
    for y in range(h):
        for x in range(w):
            corner = (x in (0, w - 1)) and (y in (0, h - 1))
            if corner:
                px[x, y] = (0, 0, 0, 0)
            elif x in (0, w - 1) or y in (0, h - 1) or (x in (1, w - 2) and y in (1, h - 2)):
                px[x, y] = INK
            elif x in (1, w - 2) or y in (1, h - 2):
                px[x, y] = CREAM
            elif x in (2, w - 3) or y in (2, h - 3):
                px[x, y] = field_edge


def number_face(raw, w, h):
    W, H = raw.size
    dark, light = tones(raw, (int(W * 0.08), int(H * 0.4), int(W * 0.2), int(H * 0.6)))
    top = tones(raw, (int(W * 0.3), int(H * 0.045), int(W * 0.7), int(H * 0.06)), 1)[0]
    card = Image.new('RGBA', (w, h))
    px = card.load()
    edge = tuple(round(v * 0.7) for v in dark[:3]) + (255,)
    for y in range(h):
        for x in range(w):
            px[x, y] = light if (x + y) % 2 else dark
    for x in range(3, w - 3):
        px[x, 3] = top
        px[x, 4] = light
    frame(px, w, h, edge)
    # Stair-stepped diamond plate: 3 rows per 2 columns, 1 px ink outline, a shade on
    # the lower right edge for depth.
    cx, cy, rx, ry = (w - 1) / 2, (h - 1) / 2, w * 0.35, h * 0.35
    inside = lambda x, y: abs(x - cx) / rx + abs(y - cy) / ry <= 1
    shade = (224, 212, 186, 255)
    for y in range(h):
        for x in range(w):
            if inside(x, y):
                ring = not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                low = not inside(x + 1, y + 1) or not inside(x, y + 2)
                px[x, y] = INK if ring else shade if low and x > cx else CREAM
    return card


def wild_face(raw, w, h):
    small = raw.resize((w, h), Image.Resampling.BOX).convert('RGB')
    small = small.quantize(96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    px = small.load()
    W, H = raw.size
    dark, light = tones(raw, (int(W * 0.06), int(H * 0.3), int(W * 0.14), int(H * 0.45)))
    # Paint the corner sparkles and the top band out with the charcoal checker.
    zone = w // 4
    for y in range(3, h - 3):
        for x in range(3, w - 3):
            near_x = x < zone or x >= w - zone
            near_y = y < zone + 2 or y >= h - zone - 2
            if (near_x and near_y) or y < 6:
                px[x, y] = light if (x + y) % 2 else dark
    edge = tuple(round(v * 0.7) for v in dark[:3]) + (255,)
    frame(px, w, h, edge)
    return small


def back_face(raw, w, h):
    """The back: navy checker with a light diamond lattice (period 8), like the render."""
    W, H = raw.size
    dark, _, line = tones(raw, (int(W * 0.06), int(H * 0.3), int(W * 0.3), int(H * 0.45)), 3)
    light = tuple(round(a + (b - a) * 0.2) for a, b in zip(dark[:3], line[:3])) + (255,)
    line = tuple(round(a + (b - a) * 0.6) for a, b in zip(dark[:3], line[:3])) + (255,)
    card = Image.new('RGBA', (w, h))
    px = card.load()
    for y in range(h):
        for x in range(w):
            on = (x + y - 2) % 8 == 0 or (x - y + 64) % 8 == 0
            px[x, y] = line if on else light if (x + y) % 2 else dark
    frame(px, w, h, tuple(round(v * 0.7) for v in dark[:3]) + (255,))
    return card


def medallion(card, r):
    """Redraw the back's medallion crisply: a cream disc and a four-colour star."""
    w, h = card.size
    px = card.load()
    cx, cy = (w - 1) / 2, (h - 1) / 2
    quad = {(0, 0): (232, 42, 36), (1, 0): (250, 196, 20), (0, 1): (34, 104, 222), (1, 1): (30, 166, 72)}
    star = lambda x, y: abs(x - cx) ** 0.75 + abs(y - cy) ** 0.75 <= (r - 0.6) ** 0.75
    disc = lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    for y in range(h):
        for x in range(w):
            if not disc(x, y):
                continue
            edge = not all(disc(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                px[x, y] = INK
            elif star(x, y):
                ring = not all(star(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                px[x, y] = INK if ring else quad[(int(x > cx), int(y > cy))] + (255,)
            else:
                px[x, y] = CREAM
    return card


def main(raw, out, width=44, height=64):
    raw, out, width, height = Path(raw), Path(out), int(width), int(height)
    sheet = Image.new('RGBA', (width * len(NAMES), height), (0, 0, 0, 0))
    for i, name in enumerate(NAMES):
        src = card_crop(raw / f'{name}.png')
        if name == 'face-wild':
            card = wild_face(src, width, height)
        elif name == 'back':
            card = medallion(back_face(src, width, height), width * 0.27)
        else:
            card = number_face(src, width, height)
        sheet.alpha_composite(card, (i * width, 0))
    sheet.save(out / 'cards.webp', lossless=True, method=6)
    mini = medallion(back_face(card_crop(raw / 'back.png'), 18, 26), 5.2)
    mini.save(out / 'mini-back.webp', lossless=True, method=6)
    print(out / 'cards.webp', sheet.size, out / 'mini-back.webp', mini.size)


if __name__ == '__main__':
    main(*sys.argv[1:])
