"""Reduce Codex renders to true low-resolution 8-bit Azul art (see docs/azul-pixel.md).

usage:
  python3 pixel-art.py scene <raw.png> <out.webp> <width> <height> [colors=64]
  python3 pixel-art.py sprite <raw.png> <out.webp> <width> <height> [colors=32]
  python3 pixel-art.py floor <raw.png> <out.webp> <repeats> <size> [dim=0.55]

`scene` box-downsamples to the logical size and quantizes with an octree palette, which
keeps small warm accents (oranges, lamplight) that median cut merges away.
`sprite` keys the magenta background (or keeps existing alpha), trims, fits the subject
into width x height, and writes hard alpha. `floor` crops one repeat of a seamless
texture, reduces it to size x size and dims it so pieces read on top.
Requires Pillow only.
"""
import sys

from PIL import Image, ImageChops


def quantize(image, colors):
    alpha = image.getchannel('A').point(lambda v: 255 if v > 127 else 0)
    rgb = image.convert('RGB').quantize(
        int(colors), method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def key(image):
    image = image.convert('RGBA')
    r, g, b, given = image.split()
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: 0 if v > 70 else 255)
    return Image.merge('RGBA', (r, g, b, ImageChops.multiply(alpha, given)))


def scene(src, out, width, height, colors=64):
    im = Image.open(src).convert('RGB').resize((int(width), int(height)), Image.Resampling.BOX)
    quantize(im.convert('RGBA'), colors).convert('RGB').save(out, lossless=True, method=6)


def sprite(src, out, width, height, colors=32):
    im = key(Image.open(src))
    box = im.getchannel('A').point(lambda v: 255 if v > 127 else 0).getbbox()
    im = im.crop(box)
    width, height = int(width), int(height)
    scale = min(width / im.width, height / im.height)
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    # Pillow premultiplies RGBA while resizing, so keyed edges stay clean.
    small = im.resize(size, Image.Resampling.BOX)
    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((width - size[0]) // 2, (height - size[1]) // 2))
    quantize(canvas, colors).save(out, lossless=True, method=6)
    print(out, canvas.size)


def floor(src, out, repeats, size, dim=0.55):
    im = Image.open(src).convert('RGB')
    step = im.width // int(repeats)
    im = im.crop((0, 0, step, step)).resize((int(size), int(size)), Image.Resampling.BOX)
    im = im.point(lambda v: round(v * float(dim)))
    quantize(im.convert('RGBA'), 16).convert('RGB').save(out, lossless=True, method=6)


if __name__ == '__main__':
    mode, *args = sys.argv[1:]
    {'scene': scene, 'sprite': sprite, 'floor': floor}[mode](*args)
