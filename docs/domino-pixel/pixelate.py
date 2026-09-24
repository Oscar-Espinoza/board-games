"""Turn Codex pixel-art renders into true low-resolution sprites for the 8-bit Domino table.

usage:
  python3 pixelate.py image <raw.png> <out.webp> <width> <height> [colors=48]
  python3 pixelate.py sheet <raw.png> <out.webp> <cols> <rows> <cell-height> [colors=40] [anchor=body]

`image` box-downsamples to the exact logical size and quantizes the palette.
`sheet` keys magenta (or keeps existing alpha), cuts a cols x rows grid, aligns every
frame on its bottom edge and on the centre of its lower body (`anchor=body`) or on the leftmost
pixel of its bottom rows, the chair's back leg (`anchor=chair`), so poses never jitter,
and writes one row of equal cells at `cell-height` logical pixels with hard alpha.
Requires Pillow only.
"""
import sys

from PIL import Image, ImageChops


def key(image):
    image = image.convert('RGBA')
    r, g, b, given = image.split()
    # Same magenta key as docs/carcassonne-3d/key-sprites.py, without the soft edge.
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: 0 if v > 90 else 255)
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(alpha, given)))


def quantize(image, colors):
    alpha = image.getchannel('A').point(lambda v: 255 if v > 127 else 0)
    rgb = image.convert('RGB').quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def image_mode(src, out, width, height, colors=48):
    im = Image.open(src).convert('RGB').resize((int(width), int(height)), Image.Resampling.BOX)
    quantize(im.convert('RGBA'), int(colors)).save(out, lossless=True, method=6)


def sheet_mode(src, out, cols, rows, cell_height, colors=40, anchor='body'):
    cols, rows, cell_height = int(cols), int(rows), int(cell_height)
    im = key(Image.open(src))
    w, h = im.size
    cw, ch = w // cols, h // rows
    frames = []
    for j in range(rows):
        for i in range(cols):
            cell = im.crop((i * cw, j * ch, (i + 1) * cw, (j + 1) * ch))
            box = cell.getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox()
            cell = cell.crop(box)
            # Anchor: centre of the lowest third (torso and table edge), bottom edge.
            a = cell.getchannel('A').load()
            cw2, ch2 = cell.size
            if anchor == 'chair':
                xs = [x for y in range(ch2 * 88 // 100, ch2) for x in range(cw2) if a[x, y] > 127]
                frames.append((cell, min(xs)))
                continue
            xs = [x for y in range(ch2 * 2 // 3, ch2) for x in range(cw2) if a[x, y] > 127]
            frames.append((cell, sum(xs) / len(xs)))
    left = max(anchor for _, anchor in frames)
    right = max(c.size[0] - anchor for c, anchor in frames)
    top = max(c.size[1] for c, _ in frames)
    width = int(left + right) + 2
    scale = cell_height / top
    small_width = round(width * scale)
    strip = Image.new('RGBA', (small_width * len(frames), cell_height), (0, 0, 0, 0))
    for n, (cell, anchor) in enumerate(frames):
        frame = Image.new('RGBA', (width, top), (0, 0, 0, 0))
        frame.alpha_composite(cell, (int(left - anchor) + 1, top - cell.size[1]))
        strip.alpha_composite(frame.resize((small_width, cell_height), Image.Resampling.BOX), (n * small_width, 0))
    quantize(strip, int(colors)).save(out, lossless=True, method=6)
    print(out, 'cell', small_width, 'x', cell_height, 'frames', len(frames))


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    (image_mode if mode == 'image' else sheet_mode)(*args)
