#!/usr/bin/env python3
"""Original CATAN table illustrations. Deterministic art variation, never game RNG.
Run python3 games/catan/assets/draw.py to regenerate editable SVG runtime sources.
No third-party assets or rasterization tools required.
"""
from pathlib import Path
import random
OUT = Path(__file__).parent

def svg(body, size=256):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{body}</svg>'
def path(d, fill, stroke='none', width=1):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
def ellipse(x,y,rx,ry,c):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}"/>'

for kind in range(6):
    rng=random.Random(710+kind*11)
    base=['#176143','#79a844','#daa637','#b75b39','#687c89','#dba85f'][kind]
    b=f'<rect width="256" height="256" fill="{base}"/>'
    # Painted ground contours; broad brush-like layers remain flat under pieces.
    for j in range(12):
        y=j*25-30
        d=f'M-20 {y} Q60 {y-35+rng.randrange(55)} 132 {y+5} T280 {y-10} L280 {y+25} Q150 {y+55} -20 {y+22}Z'
        b+=path(d,['#226e48','#91b950','#e7ba4f','#ca7046','#7d9198','#edbd77'][kind])
    if kind==0:
        for j in range(110):
            x,y=rng.randrange(-10,266),rng.randrange(-10,266);s=rng.uniform(.6,1.5)
            b+=f'<g transform="translate({x} {y}) scale({s})">'+ellipse(3,5,10,7,'#174c3c')
            b+=path('M-1 0 L1 15','#633f28','#694a2d',2)
            b+=path('M0 -19 Q-4 -12 -9 -5 L-5 -6 -12 2 Q0 8 12 2 L5 -6 9 -5 Q4 -12 0 -19Z',rng.choice(['#287e4e','#368d54','#185f42','#439760']))
            b+=path('M0 -16 L-2 0 -8 1 M0 -9 L6 0','none','#67a466',1)+'</g>'
    elif kind==1:
        b+=path('M-10 188 Q60 111 124 161 T270 128 L270 260 H-10Z','#5d983f')
        for j in range(65):
            x,y=rng.randrange(256),rng.randrange(256)
            b+=path(f'M{x} {y} l-2 -4 m2 4 l3 -5','none','#b8cd68',1)
        for x,y in [(45,50),(193,69),(57,186),(184,192),(207,151),(86,74)]:
            b+=ellipse(x+2,y+5,12,6,'#477836')+path(f'M{x-5} {y+3} v6 m10 -6 v6','none','#443f32',2)
            b+=ellipse(x,y,10,7,'#f9e9c0')+ellipse(x-4,y-3,7,5,'#fff6d8')+ellipse(x+10,y+1,4,5,'#514f40')
    elif kind==2:
        for j in range(19):
            x=j*18-45
            b+=path(f'M{x} -10 Q{x+50} 90 {x+5} 270','none','#b4842c',4)
            b+=path(f'M{x+5} -10 Q{x+55} 90 {x+10} 270','none','#f5d16b',2)
        for j in range(70):
            x,y=rng.randrange(256),rng.randrange(256)
            b+=path(f'M{x} {y+12} v-23 m0 15 l-5 -6 m5 2 l5 -6 m-5 0 l-4 -5 m4 0 l4 -5','none','#ffe19a',1.5)
        b+=path('M-5 219 Q85 203 114 250 M192 -10 Q175 23 260 47','none','#8a7135',8)
    elif kind==3:
        for j in range(14):
            x,y=rng.randrange(-30,256),rng.randrange(-20,256)
            b+=path(f'M{x-35} {y+26} Q{x-28} {y-14} {x} {y-20} Q{x+28} {y-35} {x+50} {y+22}Z','#934631')
            b+=path(f'M{x-30} {y+16} Q{x-9} {y-30} {x+15} {y-15} L{x+30} {y+5}Z','#dd8552')
            b+=path(f'M{x-21} {y+7} Q{x} {y-3} {x+13} {y+8} M{x-12} {y+15} l37 3','none','#b65d3d',2)
    elif kind==4:
        for x,y,s in [(37,52,1),(165,26,1.2),(222,116,1),(40,207,1.2),(160,203,1.4),(107,113,.9)]:
            b+=f'<g transform="translate({x} {y}) scale({s})">'
            b+=path('M-52 37 L-9 -44 5 -50 52 36Z','#425867')+path('M5 -50 L12 0 52 36 -9 26 -27 33Z','#91a1a6')
            b+=path('M5 -50 L23 -17 11 -23 3 -13 -2 -28 -16 -17Z','#e3e6d9')+path('M-9 -17 L-25 15 -15 6 M14 6 l16 20','none','#b1bcb6',2)+'</g>'
    else:
        for j in range(9):
            y=j*35-25
            b+=path(f'M-15 {y+30} Q80 {y-40} 157 {y+12} T280 {y+5} Q175 {y+54} 96 {y+20} T-15 {y+30}Z','#f4cb89')
            b+=path(f'M-15 {y+30} Q80 {y-40} 157 {y+12} T280 {y+5}','none','#b8874e',2)
    # Fine stippling gives the vector painting paper texture at close zoom.
    for j in range(380):
        x,y=rng.randrange(256),rng.randrange(256)
        b+=f'<circle cx="{x}" cy="{y}" r="{rng.choice([.5,.7,1])}" fill="#fff3ca" opacity=".15"/>'
    (OUT/f'terrain-{kind}-0.svg').write_text(svg(b))

# Heraldic development faces, crisp titles/counts are DOM text.
icons=[path('M74 170 V96 L104 56 150 65 172 104 160 119 134 109 114 125 133 170Z','#e6c480')+path('M100 94 L112 77 M88 153 L117 156','none','#765238',5),path('M45 200 L99 135 75 93 163 41 212 69 123 112 151 153 87 222Z','#dec18c'),path('M53 174 L64 85 100 69 118 97 151 65 198 83 205 172 157 154 126 180 90 159Z','#e9d8a4')+path('M99 79 L91 151 M151 75 L156 145','none','#9b7646',4),path('M67 185 L67 103 94 103 94 80 117 80 117 58 140 58 140 80 163 80 163 103 189 103 189 185Z','#e4bd66'),path('M128 44 L149 99 208 102 162 139 177 197 128 162 79 197 94 139 48 102 107 99Z','#f1ce78')]
for name,icon in zip(['knight','roadbuilding','invention','monopoly','victorypoint'],icons):
    b='<rect width="256" height="256" rx="18" fill="#314f60"/><rect x="13" y="13" width="230" height="230" rx="12" fill="none" stroke="#cfb16e" stroke-width="3"/>'
    b+=ellipse(128,127,91,91,'#233e50')+icon
    (OUT/f'development-{name}.svg').write_text(svg(b))
print('Wrote six terrain paintings and five development card faces.')
