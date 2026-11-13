# Yürüyüş karelerini (ad_1, ad_2) ayrı bir atlasa paketler: public/img/farm/walk.webp + walk.json.
# Ana atlasa dokunmaz. Kullanım: node build.mjs /tmp/walk '_[12]$'  &&  python3 pack-walk.py /tmp/walk
import sys, os, glob, json
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/walk'
out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'img', 'farm')
items = [(os.path.basename(f)[:-5], json.load(open(f)), Image.open(f[:-5] + '.png').convert('RGBA')) for f in sorted(glob.glob(os.path.join(src, '*_[12].json')))]
items.sort(key=lambda t: -t[2].height); W = 1024; x = y = 2; rowh = 0; pos = []
for n, m, im in items:
    if x + im.width + 2 > W: x = 2; y += rowh + 2; rowh = 0
    pos.append((x, y)); x += im.width + 2; rowh = max(rowh, im.height)
sheet = Image.new('RGBA', (W, y + rowh + 2), (0, 0, 0, 0)); atlas = {}
for (n, m, im), (px, py) in zip(items, pos):
    sheet.paste(im, (px, py)); atlas[n] = ['walk', px, py, m['w'], m['h'], m['ax'], m['ay']]
sheet.save(os.path.join(out, 'walk.webp'), quality=90, method=6, exact=False)
json.dump(atlas, open(os.path.join(out, 'walk.json'), 'w'), separators=(',', ':'))
print('walk', sheet.size, os.path.getsize(os.path.join(out, 'walk.webp')) // 1024, 'KB', len(atlas), 'kare')
