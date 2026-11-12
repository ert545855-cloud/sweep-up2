# PNG'leri atlaslara paketler: public/img/farm/{obj,item}.webp + atlas.json, ayrıca kesintisiz çim dokusu.
import sys, os, glob, json
import numpy as np
from PIL import Image
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/farmart'
out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'img', 'farm'); os.makedirs(out, exist_ok=True)
sets = {}
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    n = os.path.basename(f)[:-5]; m = json.load(open(f)); sets.setdefault(m['set'], []).append((n, m, Image.open(f[:-5] + '.png').convert('RGBA')))
atlas = {}
for sname, items in sets.items():
    if sname == 'hero':
        for n, m, im in items: im.save(os.path.join(out, n + '.webp'), quality=90, method=6)
        continue
    items.sort(key=lambda t: -t[2].height); W = 2048 if sname == 'obj' else 1024; x = y = 2; rowh = 0; pos = []
    for n, m, im in items:
        if x + im.width + 2 > W: x = 2; y += rowh + 2; rowh = 0
        pos.append((x, y)); x += im.width + 2; rowh = max(rowh, im.height)
    sheet = Image.new('RGBA', (W, y + rowh + 2), (0, 0, 0, 0))
    for (n, m, im), (px, py) in zip(items, pos):
        sheet.paste(im, (px, py)); atlas[n] = [sname, px, py, m['w'], m['h'], m['ax'], m['ay']]
    sheet.save(os.path.join(out, sname + '.webp'), quality=90, method=6, exact=False)
    print(sname, sheet.size, os.path.getsize(os.path.join(out, sname + '.webp')) // 1024, 'KB')
json.dump(atlas, open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))
# --- çim dokusu (512 px, kenarları birbirini tamamlar) ---
rng = np.random.default_rng(7); N = 512
def pnoise(cells):
    g = rng.random((cells, cells)); t = np.linspace(0, cells, N, endpoint=False); i = t.astype(int); f = t - i; f = f * f * (3 - 2 * f)
    a = g[np.ix_(i % cells, i % cells)]; b = g[np.ix_((i + 1) % cells, i % cells)]; c = g[np.ix_(i % cells, (i + 1) % cells)]; d = g[np.ix_((i + 1) % cells, (i + 1) % cells)]
    fx = f[:, None]; fy = f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
n = pnoise(4) * 0.5 + pnoise(8) * 0.28 + pnoise(32) * 0.14 + pnoise(128) * 0.08
n = (n - n.min()) / (n.max() - n.min())
lo = np.array([104, 176, 72]); hi = np.array([150, 210, 92])
img = lo[None, None, :] + (hi - lo)[None, None, :] * n[:, :, None]
fine = pnoise(256)[:, :, None]; img = img * (0.94 + 0.12 * fine)
Image.fromarray(np.clip(img, 0, 255).astype('uint8')).save(os.path.join(out, 'grass.webp'), quality=82, method=6)
print('grass', os.path.getsize(os.path.join(out, 'grass.webp')) // 1024, 'KB', len(atlas), 'sprites')
