# SwipeUp+ logo seçenekleri için ana ekran / favicon ikonlarını üretir.
# Kaynak: public/icons/*.png (klasik). Çıktı: public/icons/logo/<id>/*.png
# Kullanım: python3 scripts/build-logo-icons.py
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
FILES = {'icon-512.png': 512, 'icon-192.png': 192, 'maskable-512.png': 512, 'apple-touch.png': 180, 'favicon-64.png': 64, 'favicon-32.png': 32}

def hexc(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)

def ramp(stops, t):
    """t (0..1) dizisini renk geçişine çevir."""
    cols = [hexc(c) for c in stops]; n = len(cols) - 1
    t = np.clip(t, 0, 1) * n; i = np.minimum(t.astype(int), n - 1); f = (t - i)[..., None]
    a = np.stack(cols)[i]; b = np.stack(cols)[i + 1]
    return a * (1 - f) + b * f

def diag(h, w):
    y, x = np.mgrid[0:h, 0:w]; return (x / max(1, w - 1) * 0.55 + (1 - y / max(1, h - 1)) * 0.45)

def recolor(img, kind):
    a = np.asarray(img.convert('RGB')).astype(float)
    h, w, _ = a.shape
    v = (a.max(axis=2) / 255.0)[..., None]  # parlaklık = şeklin ve ışıltının maskesi
    t = diag(h, w)
    if kind == 'altin':
        out = ramp(['#7a4a0c', '#c58b22', '#ffe08a', '#f0c25a', '#fff3c4'], t) * np.power(v, 0.85)
    elif kind == 'pastel':
        g = ramp(['#f9a8d4', '#c4b5fd', '#93c5fd'], t); out = (g * 0.85 + 255 * 0.15) * np.power(v, 0.8)
    elif kind == 'gokkusagi':
        out = ramp(['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'], 1 - (t - 0.2) / 0.6) * np.power(v, 0.85)
    elif kind == 'gece':
        g = a.mean(axis=2, keepdims=True); out = np.clip((g - 128) * 1.35 + 128 + 40, 0, 255) * (v > 0.02) * np.power(v, 0.6)
        out = np.repeat(out, 3, axis=2) if out.shape[2] == 1 else out
    elif kind == 'neon':
        base = Image.fromarray(a.astype(np.uint8))
        r = max(2, int(w / 22))
        glow = np.asarray(base.filter(ImageFilter.GaussianBlur(r))).astype(float)
        tint = ramp(['#ff3d6e', '#a855f7'], t)
        out = a * 1.08 + (glow.max(axis=2, keepdims=True) / 255.0) * tint * 0.9
    else:
        out = a
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

for kind in ['altin', 'neon', 'gece', 'pastel', 'gokkusagi']:
    d = os.path.join(SRC, 'logo', kind); os.makedirs(d, exist_ok=True)
    for f, size in FILES.items():
        src = Image.open(os.path.join(SRC, f))
        recolor(src, kind).save(os.path.join(d, f), optimize=True)
print('ok')
