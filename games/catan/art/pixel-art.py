"""Reduce Codex pixel-art renders to the true low-res sheets of the 8-bit Catan skin.

usage:
  python3 pixel-art.py image  <raw.png> <out.webp> <width> <height> [colors=48]
  python3 pixel-art.py tiles  <out.webp> <cell-w> <cell-h> <colors> <raw.png>...
  python3 pixel-art.py sprites <out.webp> <cell> <colors> [--outline] <raw.png[:size]>...

`image` box-downsamples a full scene. `tiles` centre-crops each full-bleed render to the
cell aspect and joins the cells in one row. `sprites` keys the magenta background, trims,
fits each subject bottom-centred in a square cell with hard alpha and joins one row
(`--outline` adds a 1-pixel ink ring; leave a pixel of margin with `:size`).
Palettes use Pillow's octree quantizer without dithering. Requires Pillow only.
"""
import sys

from PIL import Image, ImageChops


def quantize(image, colors):
    alpha = image.getchannel('A').point(lambda v: 255 if v > 127 else 0)
    rgb = image.convert('RGB').quantize(int(colors), method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def save(image, out):
    image.save(out, lossless=True, method=6)
    print(out, image.size)


def key(image):
    image = image.convert('RGBA')
    r, g, b, given = image.split()
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: 0 if v > 70 else 255)
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(alpha, given)))


def cover(image, w, h):
    iw, ih = image.size
    scale = max(w / iw, h / ih)
    cw, ch = round(w / scale), round(h / scale)
    left, top = (iw - cw) // 2, (ih - ch) // 2
    return image.crop((left, top, left + cw, top + ch)).resize((w, h), Image.Resampling.BOX)


def fit(image, cell, size=None):
    box = image.getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox()
    image = image.crop(box)
    scale = ((size or cell) - 2) / max(image.size)
    small = image.resize((max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale))), Image.Resampling.BOX)
    frame = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
    frame.alpha_composite(small, ((cell - small.size[0]) // 2, cell - 1 - small.size[1]))
    return frame


def row(cells):
    strip = Image.new('RGBA', (sum(c.size[0] for c in cells), cells[0].size[1]), (0, 0, 0, 0))
    x = 0
    for c in cells:
        strip.alpha_composite(c, (x, 0))
        x += c.size[0]
    return strip


def image_mode(src, out, width, height, colors=48):
    im = Image.open(src).convert('RGBA').resize((int(width), int(height)), Image.Resampling.BOX)
    save(quantize(im, colors), out)


def tiles_mode(out, w, h, colors, *srcs):
    cells = [cover(Image.open(s).convert('RGBA'), int(w), int(h)) for s in srcs]
    save(quantize(row(cells), colors), out)


def load(spec, cell):
    """`raw.png` or `raw.png:size` (a smaller subject, still bottom-centred in the cell)."""
    path, _, size = spec.partition(':')
    return fit(key(Image.open(path)), int(cell), int(size) if size else None)


def outline(image):
    """A 1-pixel ink ring around the silhouette keeps tiny sprites readable on the board."""
    src = image.copy().load()
    px = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            if not src[x, y][3] and any(
                0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                px[x, y] = (26, 15, 8, 255)
    return image


def fill_holes(image):
    """Some renders arrive pre-cut with see-through blotches; fill enclosed holes from their neighbours."""
    px = image.load()
    w, h = image.size
    outside, todo = set(), [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while todo:
        x, y = todo.pop()
        if (x, y) in outside or not (0 <= x < w and 0 <= y < h) or px[x, y][3]:
            continue
        outside.add((x, y))
        todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    holes = {(x, y) for x in range(w) for y in range(h) if not px[x, y][3] and (x, y) not in outside}
    while holes:
        for x, y in list(holes):
            near = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3]]
            if near:
                px[x, y] = max(set(near), key=near.count)
                holes.discard((x, y))
    return image


def sprites_mode(out, cell, colors, *srcs):
    ring = srcs[0] == '--outline'
    srcs = srcs[1:] if ring else srcs
    cells = [load(s, cell) for s in srcs]
    sheet = fill_holes(quantize(row(cells), colors))
    save(outline(sheet) if ring else sheet, out)


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    {'image': image_mode, 'tiles': tiles_mode, 'sprites': sprites_mode}[mode](*args)
