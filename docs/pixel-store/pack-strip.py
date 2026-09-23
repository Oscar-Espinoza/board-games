"""Pack a Codex magenta walk-cycle strip into an equal-cell transparent WebP strip.

usage: python3 pack-strip.py <raw.png> <out.webp> [frames=8] [height=360]
Requires Pillow only. Frames are found by alpha column runs, aligned on the
head/torso centroid and the feet baseline so the cycle never jitters.
"""
import sys

from PIL import Image, ImageChops, ImageFilter

src, out = sys.argv[1], sys.argv[2]
frames = int(sys.argv[3]) if len(sys.argv) > 3 else 8
height = int(sys.argv[4]) if len(sys.argv) > 4 else 360

# Same keying as docs/carcassonne-3d/key-sprites.py.
image = Image.open(src).convert('RGBA')
r, g, b, given = image.split()
excess = ImageChops.subtract(ImageChops.darker(r, b), g)
alpha = excess.point(lambda v: max(0, min(255, round(255 * (1 - (v - 45) / 110)))))
alpha = ImageChops.multiply(alpha, given).filter(ImageFilter.MinFilter(3))
spill = excess.point(lambda v: v if v > 45 else 0)
r, b = ImageChops.subtract(r, spill), ImageChops.subtract(b, spill)
image = Image.merge('RGBA', (r, g, b, alpha))

w, h = image.size
mask = alpha.point(lambda v: 255 if v > 16 else 0)
px = mask.load()
filled = [any(px[x, y] for y in range(0, h, 2)) for x in range(w)]
runs, start = [], None
for x, on in enumerate(filled + [False]):
    if on and start is None:
        start = x
    elif not on and start is not None:
        runs.append([start, x])
        start = None
# Merge runs split by tiny gaps (a swinging hand), then keep the widest N.
merged = []
for run in runs:
    if merged and run[0] - merged[-1][1] < 8:
        merged[-1][1] = run[1]
    else:
        merged.append(run)
merged = sorted(sorted(merged, key=lambda s: s[1] - s[0])[-frames:])
if len(merged) != frames:
    cell = w // frames
    merged = [[i * cell, (i + 1) * cell] for i in range(frames)]
print('frames at', merged)

cut = []
for left, right in merged:
    frame = image.crop((left, 0, right, h))
    box = frame.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    frame = frame.crop(box)
    fa = frame.getchannel('A').load()
    fw, fh = frame.size
    top = [x for y in range(int(fh * 0.45)) for x in range(fw) if fa[x, y] > 16]
    cut.append((frame, sum(top) / len(top)))

half = max(max(cx, f.width - cx) for f, cx in cut)
cell_w, cell_h = int(half * 2) + 4, max(f.height for f, _ in cut)
scale = height / cell_h
out_w = round(cell_w * scale)
strip = Image.new('RGBA', (out_w * frames, height))
for i, (frame, cx) in enumerate(cut):
    cell = Image.new('RGBA', (cell_w, cell_h))
    cell.alpha_composite(frame, (round(cell_w / 2 - cx), cell_h - frame.height))
    strip.alpha_composite(cell.resize((out_w, height), Image.LANCZOS), (i * out_w, 0))
strip.save(out, 'WEBP', quality=85, method=6)
print(out, strip.size, 'cell', out_w, 'x', height)
