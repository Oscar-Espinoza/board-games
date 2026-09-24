"""Hand-authored pixel glyphs for the 8-bit UNO cards (numerals and action icons).

usage: python3 glyphs.py <out.webp>

Writes one sheet: 5 rows of big centre glyphs (red, yellow, green, blue ink, then white
for wilds) in 28x24 cells, then one row of small white corner glyphs in 12x10 cells.
Columns: 0-9, skip, reverse, +2, +4, wild. Every glyph has a 1 px ink outline; big
glyphs add a 1 px drop shadow and a top highlight. Requires Pillow only.
"""
import sys

from PIL import Image

INK = (26, 15, 8, 255)
SHADOW = (26, 15, 8, 150)
# Glyph fills per row: card colours (matched to the generated faces) and white.
FILLS = [
    ((232, 42, 36), (255, 128, 104)),
    ((250, 196, 20), (255, 236, 140)),
    ((30, 166, 72), (120, 226, 132)),
    ((34, 104, 222), (122, 176, 255)),
    ((250, 246, 234), (255, 255, 255)),
]
WILD = [(232, 42, 36), (34, 104, 222), (250, 196, 20), (30, 166, 72)]

BIG = {
    '0': """
...######...
..########..
.###....###.
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
###......###
.###....###.
..########..
...######...""",
    '1': """
.....###....
...#####....
..######....
..##.###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
.....###....
..#########.
..#########.""",
    '2': """
..#######...
.#########..
###.....###.
##.......###
.........###
.........###
........###.
.......###..
......###...
.....###....
....###.....
...###......
..###.......
.###........
###.........
###.........
############
############""",
    '3': """
..#######...
.#########..
###.....###.
##.......###
.........###
.........###
........###.
...######...
...#######..
........###.
.........###
.........###
.........###
.........###
##.......###
###.....###.
.#########..
..#######...""",
    '4': """
.......####.
......#####.
.....######.
....###.###.
...###..###.
..###...###.
.###....###.
###.....###.
###.....###.
############
############
........###.
........###.
........###.
........###.
........###.
........###.
........###.""",
    '5': """
###########.
###########.
###.........
###.........
###.........
###.........
#########...
##########..
........###.
.........###
.........###
.........###
.........###
.........###
##.......###
###.....###.
.#########..
..#######...""",
    '6': """
...#######..
..#########.
.###.....##.
###.........
###.........
###.........
###.######..
###########.
####.....###
###......###
###......###
###......###
###......###
###......###
###......###
.###....###.
..########..
...######...""",
    '7': """
############
############
.........###
........###.
........###.
.......###..
.......###..
......###...
......###...
.....###....
.....###....
....###.....
....###.....
....###.....
....###.....
....###.....
....###.....
....###.....""",
    '8': """
...######...
..########..
.###....###.
###......###
###......###
###......###
.###....###.
..########..
..########..
.###....###.
###......###
###......###
###......###
###......###
###......###
.###....###.
..########..
...######...""",
}
BIG['9'] = '\n' + '\n'.join(row[::-1] for row in BIG['6'].strip().split('\n')[::-1])
PLUS = """
...###...
...###...
...###...
#########
#########
#########
...###...
...###...
...###..."""

SMALL = {
    '0': '###|#.#|#.#|#.#|###',
    '1': '.#.|##.|.#.|.#.|###',
    '2': '###|..#|###|#..|###',
    '3': '###|..#|.##|..#|###',
    '4': '#.#|#.#|###|..#|..#',
    '5': '###|#..|###|..#|###',
    '6': '###|#..|###|#.#|###',
    '7': '###|..#|.#.|.#.|.#.',
    '8': '###|#.#|###|#.#|###',
    '9': '###|#.#|###|..#|###',
    'skip': '.###.|#..##|#.#.#|##..#|.###.',
    'reverse': '..#..|#####|.....|#####|..#..',
    'plus': '.#.|###|.#.',
}


def grid(text):
    rows = [r for r in text.strip('\n').replace('|', '\n').split('\n') if r]
    return {(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c == '#'}


def size(mask):
    return (max(x for x, _ in mask) + 1, max(y for _, y in mask) + 1)


def join(a, b, gap=1):
    """Place b to the right of a, bottom-aligned."""
    wa, ha = size(a)
    wb, hb = size(b)
    h = max(ha, hb)
    out = {(x, y + h - ha) for x, y in a} if ha < h else set(a)
    out |= {(x + wa + gap, y + (h - hb) // 2) for x, y in b}
    return out


def skip_icon(n=18, stroke=3):
    c = (n - 1) / 2
    out = set()
    for y in range(n):
        for x in range(n):
            d = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            ring = c - stroke + 0.5 < d <= c + 0.5
            slash = d <= c and abs((x - y)) <= 1
            if ring or slash:
                out.add((x, y))
    return out


def reverse_icon():
    out = set()
    for y in range(9):  # top arrow, pointing right
        for x in range(18):
            shaft = 3 <= y <= 5 and x <= 11
            head = x >= 11 and abs(y - 4) <= (17 - x) * 4 / 6 + 0.01
            if shaft or head:
                out.add((x, y))
    out |= {(17 - x, 17 - y) for x, y in out}
    return out


def outline(mask):
    return {(x + dx, y + dy) for x, y in mask for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - mask


def draw(sheet, mask, ox, oy, cw, ch, fill, light=None, shadow=True, wild=False):
    w, h = size(mask)
    # Centre in the cell, leaving room for the outline and the shadow.
    x0 = ox + (cw - w - (1 if shadow else 0)) // 2
    y0 = oy + (ch - h - (1 if shadow else 0)) // 2
    edge = outline(mask)
    px = sheet.load()
    if shadow:
        for x, y in mask | edge:
            px[x0 + x + 1, y0 + y + 1] = SHADOW
    for x, y in edge:
        px[x0 + x, y0 + y] = INK
    for x, y in mask:
        colour = fill
        if wild:  # quadrants like the orb: red TR, blue BR, yellow BL, green TL
            right, low = x >= w / 2, y >= h / 2
            colour = WILD[(1 if low else 0) if right else (2 if low else 3)]
        elif light and (x, y - 1) not in mask:
            colour = light
        px[x0 + x, y0 + y] = colour + (255,)


def main(out):
    big = [grid(BIG[str(d)]) for d in range(10)]
    plus = grid(PLUS)
    big += [skip_icon(), reverse_icon(), join(plus, grid(BIG['2'])), join(plus, grid(BIG['4']))]
    small = [grid(SMALL[str(d)]) for d in range(10)]
    splus = grid(SMALL['plus'])
    small += [grid(SMALL['skip']), grid(SMALL['reverse']), join(splus, grid(SMALL['2'])), join(splus, grid(SMALL['4'])), grid('.#.|###|###|.#.')]
    cw, ch, sw, sh = 28, 24, 12, 10
    cols = 15
    sheet = Image.new('RGBA', (cols * cw, 5 * ch + sh), (0, 0, 0, 0))
    for row, (fill, light) in enumerate(FILLS):
        for col, mask in enumerate(big):
            draw(sheet, mask, col * cw, row * ch, cw, ch, fill, light)
    for col, mask in enumerate(small):
        draw(sheet, mask, col * sw, 5 * ch, sw, sh, FILLS[4][0], shadow=False, wild=col == 14)
    sheet.save(out, lossless=True, method=6)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1])
