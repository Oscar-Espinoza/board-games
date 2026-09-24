"""Reduce a Codex table render to a true low-res pixel background for the 8-bit UNO skin.

usage: python3 table.py <raw.png> <out.webp> <width> <height> [levels=5] [colors=40]

Box-downsamples to the logical size, then repaints the felt (the green region connected
to the centre) with a few flat greens and a 4x4 Bayer ordered dither that follows the
original lighting. The render's noisy felt becomes a clean retro dither and the file
shrinks to a fraction. Everything else is palette-quantized as is. Requires Pillow only.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def main(src, out, width, height, levels=5, colors=40):
    width, height, levels, colors = int(width), int(height), int(levels), int(colors)
    im = Image.open(src).convert('RGB').resize((width, height), Image.Resampling.BOX)
    px = im.load()
    mask = Image.new('L', im.size, 0)
    mp = mask.load()
    for y in range(height):
        for x in range(width):
            r, g, b = px[x, y]
            if g > r * 1.25 and g >= b:
                mp[x, y] = 255
    ImageDraw.floodfill(mask, (width // 2, height // 2), 128)
    felt = [(x, y) for y in range(height) for x in range(width) if mp[x, y] == 128]
    light = im.filter(ImageFilter.GaussianBlur(3)).convert('L').load()
    values = sorted(light[x, y] for x, y in felt)
    lo, hi = values[len(values) // 200], values[-len(values) // 200 - 1]
    # Flat shades: mean colour of each luminance band of the original felt.
    bands = [[0, 0, 0, 0] for _ in range(levels)]
    for x, y in felt:
        t = min(levels - 1, max(0, round((light[x, y] - lo) / max(1, hi - lo) * (levels - 1))))
        c = px[x, y]
        bands[t][0] += c[0]
        bands[t][1] += c[1]
        bands[t][2] += c[2]
        bands[t][3] += 1
    shades = [tuple(v // max(1, n) for v in (r, g, b)) for r, g, b, n in bands]
    for x, y in felt:
        t = max(0.0, min(1.0, (light[x, y] - lo) / max(1, hi - lo))) * (levels - 1)
        base = int(t)
        step = base + (1 if (t - base) * 16 > BAYER[y % 4][x % 4] + 0.5 else 0)
        px[x, y] = shades[min(levels - 1, step)]
    q = im.quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(out, lossless=True, method=6)
    print(out, im.size, 'felt px', len(felt))


if __name__ == '__main__':
    main(*sys.argv[1:])
