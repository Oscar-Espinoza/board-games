"""Hand-made 16x16 Azul tiles for the 8-bit skin (see docs/azul-pixel.md).

usage: python3 games/azul/scripts/pixel-tiles.py apps/web/static/games/azul/pixel/tiles.webp
Row 0: blue, yellow, red, black, white, first-player marker. Row 1: the faint wall hints.
Every colour has its own motif, matching its name (blue diamond, yellow sun, red chevron,
black lattice, white flower), so tiles stay distinguishable without colour.
Requires Pillow only.
"""
import sys

from PIL import Image

S = 16
# Motifs: '#' motif colour, '+' accent, '.' glaze.
MOTIFS = {
    # Blue diamond
    'blue': """
....##....
...####...
..##..##..
.##.++.##.
##.++++.##
##.++++.##
.##.++.##.
..##..##..
...####...
....##....""",
    # Yellow sun
    'yellow': """
....##....
.#..##..#.
..#....#..
...####...
##.#++#.##
##.#++#.##
...####...
..#....#..
.#..##..#.
....##....""",
    # Red chevron
    'red': """
....##....
...####...
..##..##..
.##.++.##.
##.####.##
#.##..##.#
.##....##.
##..++..##
#........#
..........""",
    # Black lattice
    'black': """
..#....#..
..#....#..
##########
..#....#..
..#.++.#..
..#.++.#..
..#....#..
##########
..#....#..
..#....#..""",
    # White flower
    'white': """
....##....
...#..#...
...#..#...
.##.++.##.
#..+..+..#
#..+..+..#
.##.++.##.
...#..#...
...#..#...
....##....""",
}
# outline, glaze, light, dark, motif, accent
COLOURS = {
    'blue': ('#0a1a3c', '#1f5fbf', '#4a8fe6', '#153f8a', '#e8f3ff', '#f2c14e'),
    'yellow': ('#4a2805', '#efb02a', '#ffd970', '#b8740e', '#5e3206', '#fff3c4'),
    'red': ('#3a0909', '#c0392b', '#e8674f', '#80201a', '#ffe3c6', '#f2c14e'),
    'black': ('#050608', '#2a313b', '#48535f', '#15191f', '#dcbc8a', '#5fd0c4'),
    'white': ('#3b4a50', '#f4ecd6', '#ffffff', '#c9bc98', '#1a7f8a', '#c0392b'),
}
BOARD = (0xE9, 0xD8, 0xAE)  # the pixel board's wall cell colour (pixel.css --az-cell)


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def tile(name):
    out, glaze, light, dark, motif, accent = map(hexrgb, COLOURS[name])
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    p = im.load()
    for y in range(S):
        for x in range(S):
            edge = x in (0, S - 1) or y in (0, S - 1)
            corner = (x in (0, S - 1)) and (y in (0, S - 1))
            if corner:
                continue
            if edge:
                p[x, y] = out + (255,)
            elif y == 1 or x == 1:
                p[x, y] = light + (255,)
            elif y == S - 2 or x == S - 2:
                p[x, y] = dark + (255,)
            else:
                p[x, y] = glaze + (255,)
    # Specular glint on the glaze.
    for x, y in ((2, 2), (3, 2), (2, 3)):
        p[x, y] = mix(light, (255, 255, 255), 0.6) + (255,)
    for j, row in enumerate(MOTIFS[name].strip().splitlines()):
        for i, c in enumerate(row):
            if c == '#':
                p[3 + i, 3 + j] = motif + (255,)
            elif c == '+':
                p[3 + i, 3 + j] = accent + (255,)
    return im


def hint(name):
    """The wall's printed hint: a flat pale tint of the colour with its motif."""
    _, glaze, *_ = map(hexrgb, COLOURS[name])
    motif = hexrgb(COLOURS[name][4])
    base = mix(BOARD, glaze, 0.2)
    line = mix(BOARD, glaze, 0.42)
    ink = mix(BOARD, glaze if name != 'white' else motif, 0.5)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    p = im.load()
    for y in range(1, S - 1):
        for x in range(1, S - 1):
            border = x in (1, S - 2) or y in (1, S - 2)
            p[x, y] = (line if border else base) + (255,)
    for j, row in enumerate(MOTIFS[name].strip().splitlines()):
        for i, c in enumerate(row):
            if c in '#+':
                p[3 + i, 3 + j] = ink + (255,)
    return im


def marker():
    """Octagonal ivory token with a brass rim; the numeral stays real text."""
    out, ivory, light, shade, brass, brass_dark = map(
        hexrgb, ('#2a1a0c', '#f6e7c8', '#fffaf0', '#d8c294', '#e0a93a', '#9a6a1c'))
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    p = im.load()
    cut = 3
    for y in range(S):
        for x in range(S):
            d = min(x, S - 1 - x) + min(y, S - 1 - y)
            if d < cut:
                continue
            if d == cut or x in (0, S - 1) or y in (0, S - 1):
                p[x, y] = out + (255,)
            elif d == cut + 1 or x in (1, S - 2) or y in (1, S - 2):
                p[x, y] = (brass if x + y < S else brass_dark) + (255,)
            elif x + y < 9:
                p[x, y] = light + (255,)
            elif x + y > 21:
                p[x, y] = shade + (255,)
            else:
                p[x, y] = ivory + (255,)
    return im


def outlined(fill):
    """Draw `fill(x, y) -> colour | None` with a one-pixel ink outline around it."""
    ink = hexrgb('#070b16') + (255,)
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    p = im.load()
    for y in range(S):
        for x in range(S):
            c = fill(x, y)
            if c:
                p[x, y] = hexrgb(c) + (255,)
    for y in range(S):
        for x in range(S):
            if p[x, y][3]:
                continue
            if any(0 <= x + dx < S and 0 <= y + dy < S and fill(x + dx, y + dy)
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                p[x, y] = ink
    return im


def gear(x, y):
    import math
    dx, dy = x - 7.5, y - 7.5
    d = math.hypot(dx, dy)
    tooth = ((math.atan2(dy, dx) / (2 * math.pi)) * 8 + 8.25) % 1 < 0.5
    if 2.3 < d <= 4.6 or (4.6 < d <= 6.6 and tooth):
        return '#ffd87a' if dx + dy < 0 else '#e0a93a'
    return None


def book(x, y):
    if y == 13 and 1 <= x <= 14:
        return '#9a6a1c'
    top = 3 if x in (1, 2, 13, 14) else 4 if x in (3, 4, 11, 12) else 5
    if 1 <= x <= 14 and top <= y <= 12:
        if x in (7, 8):
            return '#c9b68e'
        if y in (6, 8, 10) and (2 <= x <= 5 or 10 <= x <= 13):
            return '#2d5696'
        return '#fbe7b8'
    return None


order = ['blue', 'yellow', 'red', 'black', 'white']
sheet = Image.new('RGBA', (S * 6, S * 3), (0, 0, 0, 0))
for i, name in enumerate(order):
    sheet.alpha_composite(tile(name), (i * S, 0))
    sheet.alpha_composite(hint(name), (i * S, S))
sheet.alpha_composite(marker(), (5 * S, 0))
# Row 2: the corner button icons (rules book, settings gear).
sheet.alpha_composite(outlined(book), (0, 2 * S))
sheet.alpha_composite(outlined(gear), (S, 2 * S))
sheet.save(sys.argv[1], lossless=True, method=6)
if len(sys.argv) > 2:
    sheet.resize((sheet.width * 8, sheet.height * 8), Image.NEAREST).save(sys.argv[2])
print(sys.argv[1], sheet.size)
