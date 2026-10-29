"""Decode the original RT_BITMAP resources inventoried by REA; requires Pillow."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('executable', type=Path, help='Matching SkiFree 1.04 executable')
parser.add_argument('--contact-sheet', type=Path, help='Optional PNG preview destination')
args = parser.parse_args()
source = args.executable.read_bytes()
resources = json.loads((ROOT / 'tools/bitmap-resources.json').read_text())
if hashlib.sha256(source).hexdigest() != resources['source']['sha256']:
    parser.error('Executable SHA-256 does not match the analyzed SkiFree 1.04 build.')

sprites = {}
sheet = Image.new('RGB', (900, 1100), '#e4e9ed') if args.contact_sheet else None
draw = ImageDraw.Draw(sheet) if sheet else None
for resource in resources['bitmaps']:
    rid, offset, size = resource['id'], resource['offset'], resource['bytes']
    payload = source[offset:offset + size]
    assert hashlib.sha256(payload).hexdigest() == resource['sha256']
    header, width, height, planes, bits = struct.unpack_from('<IiiHH', payload)
    colors = struct.unpack_from('<I', payload, 32)[0] or (1 << bits if bits <= 8 else 0)
    pixel_offset = 14 + header + colors * 4
    bmp = b'BM' + struct.pack('<IHHI', len(payload) + 14, 0, 0, pixel_offset) + payload
    image = Image.open(io.BytesIO(bmp)).convert('RGBA')
    # Pure white is the original sprite background; preserve every other RGB value.
    image.putdata([(r, g, b, 0 if (r, g, b) == (255, 255, 255) else 255)
                   for r, g, b, alpha in image.getdata()])
    image.save(ROOT / f'assets/{rid}.png')
    sprites[str(rid)] = {'width': width, 'height': abs(height), 'file': f'assets/{rid}.png'}
    if sheet:
        x, y = ((rid - 1) % 9) * 100, ((rid - 1) // 9) * 110
        draw.text((x + 8, y + 5), str(rid), fill='#24303b')
        enlarged = image.resize((image.width * 2, image.height * 2), Image.Resampling.NEAREST)
        sheet.paste(enlarged, (x + 8, y + 23), enlarged)

(ROOT / 'assets/manifest.json').write_text(json.dumps(sprites, indent=2) + '\n')
(ROOT / 'assets.js').write_text('globalThis.SKI_SPRITES = ' + json.dumps(sprites, indent=2) + ';\n')
if sheet:
    args.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.contact_sheet)
print('Extracted', len(sprites), 'sprites')
