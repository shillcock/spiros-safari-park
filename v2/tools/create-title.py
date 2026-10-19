"""Create editable, self-contained title art using this edition's assets.
Run: uv run --with pillow python v2/tools/create-title.py
Produces assets/welcome.svg; export at 800x600 to assets/welcome.png.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64
import io

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
source = Image.open(ASSETS / 'welcome-handdrawn.png').convert('RGBA')
ImageDraw.Draw(source).rectangle((0, 0, 80, 29), fill=(255, 255, 255, 255))


def embedded(image):
    output = io.BytesIO()
    image.save(output, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()


def lettering(box, x, y, width, height):
    crop = source.crop(box)
    # Remove scanned white paper, retaining original purple outlines and crayon.
    pixels = []
    for r, g, b, a in crop.getdata():
        alpha = min(255, max(0, (250 - min(r, g, b)) * 5))
        pixels.append((r, g, b, alpha))
    crop.putdata(pixels)
    return f'<image href="{embedded(crop)}" x="{x}" y="{y}" width="{width}" height="{height}"/>'


parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs>
  <radialGradient id="paper"><stop stop-color="#fffdf2"/><stop offset="1" stop-color="#f0e5c5"/></radialGradient>
  <linearGradient id="grass" x2="0" y2="1"><stop stop-color="#d4de9d"/><stop offset="1" stop-color="#99b96f"/></linearGradient>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter>
  <g id="leaf"><path d="M0 0 Q-25-35-4-66 Q25-43 0 0Z" fill="#91ac63" stroke="#527346" stroke-width="2"/><path d="M0 0 L-4-54" fill="none" stroke="#658647" stroke-width="2"/></g>
  <g id="tuft" stroke="#6c914e" stroke-width="2" stroke-linecap="round"><path d="M0 0l-5-12M0 0l3-17M0 0l9-8" fill="none"/></g>
  <g id="flower"><path d="M0 0v-15" stroke="#648146" stroke-width="2"/><g fill="#e5ad56"><circle cx="0" cy="-18" r="5"/><circle cx="-5" cy="-14" r="4"/><circle cx="5" cy="-14" r="4"/></g><circle cy="-15" r="2.5" fill="#fff1bb"/></g>
</defs>
<path fill="url(#paper)" d="M0 0H800V600H0Z"/>
<g filter="url(#grain)">
<path d="M0 445 Q130 408 260 452 Q410 482 555 440 Q680 414 800 447V600H0Z" fill="#e2e5bd"/>
<path d="M0 475 Q160 442 313 479 Q484 506 650 467 Q741 449 800 474V600H0Z" fill="url(#grass)"/>
<!-- Soft hand-drawn frame, left deliberately imperfect. -->
<path d="M24 109L22 25Q390 14 777 24L780 576Q406 586 23 575L24 109" fill="none" stroke="#91a465" stroke-width="3" opacity=".65"/>
<path d="M30 102L31 31L770 31L771 570L30 568Z" fill="none" stroke="#c0bf85" stroke-width="1.5" opacity=".65"/>
<!-- Leafy corners and stems. -->
<g fill="none" stroke="#6d8550" stroke-width="3"><path d="M16 185Q69 105 41 18"/><path d="M783 185Q730 105 759 18"/></g>
<g>
<use href="#leaf" transform="translate(41 72) rotate(-55) scale(.8)"/>
<use href="#leaf" transform="translate(45 106) rotate(50) scale(.8)"/>
<use href="#leaf" transform="translate(32 148) rotate(-53) scale(.75)"/>
<use href="#leaf" transform="translate(759 72) rotate(55) scale(.8)"/>
<use href="#leaf" transform="translate(755 106) rotate(-50) scale(.8)"/>
<use href="#leaf" transform="translate(768 148) rotate(53) scale(.75)"/>
</g>
<!-- Sun and little crayon rays. -->
<g stroke="#d9b95b" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"><circle cx="687" cy="106" r="26" fill="#f5dc85"/><path d="M687 66v-9M687 145v9M647 106h-9M726 106h10M659 77l-7-7M716 136l7 7M716 77l7-7M659 136l-7 7"/></g>
<g fill="#586e43" font-family="Georgia, serif" font-size="12" letter-spacing="1.5"><text x="83" y="39">OCTOBER 2026</text><text x="714" y="39" text-anchor="end">ENHANCED EDITION</text></g>
''']
parts += [
    lettering((0, 0, 570, 146), 163, 50, 456, 117),
    lettering((344, 145, 530, 254), 340, 177, 120, 70),
    lettering((85, 291, 386, 448), 123, 240, 271, 141),
    lettering((482, 281, 800, 399), 410, 249, 275, 102),
    lettering((317, 396, 649, 576), 267, 353, 266, 144),
]
# Original animal cutouts gather around the sign, with light grounding shadows.
for name, x, y, h, flip in [
    ('elephant', 48, 385, 69, False), ('beaver', 157, 425, 76, False),
    ('monkey', 61, 467, 76, True), ('zebra', 643, 395, 59, True),
    ('snake', 595, 431, 78, False), ('penguin', 692, 470, 75, False),
]:
    image = Image.open(ASSETS / f'{name}.png').convert('RGBA')
    if flip:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    w = round(image.width * h / image.height)
    parts.append(f'<ellipse cx="{x+w/2}" cy="{y+h-2}" rx="{w*.48}" ry="5" fill="#597947" opacity=".16"/>')
    parts.append(f'<image href="{embedded(image)}" x="{x}" y="{y}" width="{w}" height="{h}"/>')
for x, y in [(36,474),(147,470),(228,499),(558,491),(668,499),(764,465),(47,555),(749,550)]:
    parts.append(f'<use href="#tuft" transform="translate({x} {y})"/>')
for x, y in [(210,462),(569,465),(143,535),(653,547)]:
    parts.append(f'<use href="#flower" transform="translate({x} {y})"/>')
parts.append('''</g>
<g text-anchor="middle" fill="#365132" font-family="Georgia, serif">
<text x="400" y="520" font-size="14">A little imagination. A whole safari.</text>
<text x="400" y="541" font-family="Arial, sans-serif" font-size="11">Game idea, artwork &amp; sound effects by Spiro JJ Pettas · age 7</text>
</g>
</svg>''')
(ASSETS / 'welcome.svg').write_text('\n'.join(parts))
print('Created v2/assets/welcome.svg')
