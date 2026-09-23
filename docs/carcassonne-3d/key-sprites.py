"""Key Codex magenta-background sprites into trimmed transparent WebP files.

usage: python3 key-sprites.py <raw-dir> <out-dir> [max-side]
Requires Pillow only.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

raw, out = Path(sys.argv[1]), Path(sys.argv[2])
side = int(sys.argv[3]) if len(sys.argv) > 3 else 320
out.mkdir(parents=True, exist_ok=True)
for src in sorted(raw.glob('*.png')):
    source = Image.open(src).convert('RGBA')
    r, g, b, given = source.split()
    # Magenta strength: how far both red and blue rise above green.
    excess = ImageChops.subtract(ImageChops.darker(r, b), g)
    alpha = excess.point(lambda v: max(0, min(255, round(255 * (1 - (v - 45) / 110)))))
    # Some generations already arrive transparent; keep that alpha too.
    alpha = ImageChops.multiply(alpha, given)
    # Remove magenta spill from translucent edge pixels.
    spill = excess.point(lambda v: v if v > 45 else 0)
    r, b = ImageChops.subtract(r, spill), ImageChops.subtract(b, spill)
    img = Image.merge('RGBA', (r, g, b, alpha.filter(ImageFilter.MinFilter(3))))
    img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox())
    img.thumbnail((side, side), Image.LANCZOS)
    img.save(out / f'{src.stem}.webp', 'WEBP', quality=82, method=6)
    print(src.stem, img.size)
