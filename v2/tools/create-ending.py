"""Compose the enhanced closing card from original hand lettering.
Run: uv run --with pillow python v2/tools/create-ending.py
Uses this edition's welcome.svg for matching scenery; exports way_to_go.svg.
Rasterize the SVG at 800x600 to assets/way_to_go.png for runtime.
"""
from pathlib import Path
from PIL import Image, ImageChops
import xml.etree.ElementTree as ET
import io
import base64

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
root = ET.parse(ASSETS / 'welcome.svg').getroot()
scene = root.find(f'{{{NS}}}g')
# Keep the opening card's paper, hills, border and leaves, but not its lettering.
children = list(scene)
first_image = next(i for i, child in enumerate(children) if child.tag == f'{{{NS}}}image')
for child in children[first_image:]:
    scene.remove(child)
for child in list(scene):
    if child.get('stroke') == '#d9b95b':  # The ending headline uses this space.
        scene.remove(child)
for child in list(root):
    if child.tag != f'{{{NS}}}defs' and child is not scene and child.tag != f'{{{NS}}}path':
        root.remove(child)
source = Image.open(ASSETS / 'way-to-go-handdrawn.png').convert('RGBA')


def add_image(image, x, y, w, h):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    ET.SubElement(scene, f'{{{NS}}}image', {
        'href': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode(),
        'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h),
    })


def lettering(box, x, y, w, h):
    crop = source.crop(box)
    r, g, b, _ = crop.split()
    darkness = ImageChops.darker(ImageChops.darker(r, g), b)
    crop.putalpha(darkness.point(lambda value: min(255, max(0, (250 - value) * 5))))
    add_image(crop, x, y, w, h)


lettering((8, 0, 794, 155), 87, 53, 626, 124)           # WAY TO GO!
lettering((89, 157, 729, 279), 195, 187, 410, 78)      # YOU ARE NOW
lettering((8, 285, 126, 411), 193, 279, 60, 64)        # A
lettering((247, 279, 706, 385), 273, 277, 298, 69)     # SPIRO'S
lettering((20, 416, 389, 540), 150, 351, 258, 87)      # SAFARI
lettering((413, 389, 667, 510), 425, 340, 203, 97)     # PARK
lettering((435, 509, 714, 597), 260, 444, 279, 88)     # RANGER!

for name, x, y, h, flip in [
    ('elephant', 42, 304, 62, False), ('beaver', 63, 386, 70, False),
    ('monkey', 90, 470, 68, True), ('zebra', 663, 305, 55, True),
    ('snake', 698, 387, 71, False), ('penguin', 652, 467, 70, False),
]:
    image = Image.open(ASSETS / f'{name}.png').convert('RGBA')
    if flip:
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    w = round(image.width * h / image.height)
    ET.SubElement(scene, f'{{{NS}}}ellipse', {'cx': str(x+w/2), 'cy': str(y+h-2),
        'rx': str(w*.48), 'ry': '5', 'fill': '#597947', 'opacity': '.16'})
    add_image(image, x, y, w, h)
for x, y in [(42, 475), (176, 499), (604, 508), (753, 472), (48, 550), (743, 546)]:
    ET.SubElement(scene, f'{{{NS}}}use', {'href': '#tuft', 'transform': f'translate({x} {y})'})
for x, y in [(161, 458), (634, 458), (44, 395), (756, 389)]:
    ET.SubElement(scene, f'{{{NS}}}use', {'href': '#flower', 'transform': f'translate({x} {y})'})
ET.ElementTree(root).write(ASSETS / 'way_to_go.svg', encoding='unicode')
print('Created v2/assets/way_to_go.svg')
