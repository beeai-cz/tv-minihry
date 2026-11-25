"""Nařeže obrázky z Higgsfieldu pro Rakety: art/raw/sheet-space.png a sheet-power.png (3x3),
bg-space.png a banner-rakety.png -> app/src/main/assets/rakety/img/ a res/drawable-xhdpi/banner_rakety.png.
Spouštět: python -P tools/rakety_sprites.py [náhled.jpg]"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
OUT = os.path.join(ROOT, "app", "src", "main", "assets", "rakety", "img")
RES = os.path.join(ROOT, "app", "src", "main", "res", "drawable-xhdpi")
os.makedirs(OUT, exist_ok=True)
os.makedirs(RES, exist_ok=True)


def cut(cell, size):
    """Bílé pozadí pryč: spojité světlé oblasti dotýkající se okraje buňky."""
    a = np.array(cell.convert("RGBA"))
    white = a[:, :, :3].min(axis=2) > 228
    lab, _ = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    kill = np.isin(lab, list(border))
    kill = ndimage.binary_dilation(kill, iterations=1) & (a[:, :, :3].min(axis=2) > 200) | kill
    a[kill, 3] = 0
    im = Image.fromarray(a)
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit("prázdná buňka v mřížce - zkontroluj obrázek")
    im = im.crop(bbox)
    im.thumbnail((size, size), Image.LANCZOS)
    return im


SHEETS = {
    "sheet-space.png": ["rocket-green", "rocket-pink", "asteroid", "ufo", "slime", "comet", "boss", "star", None],
    "sheet-power.png": ["orb-flame", "orb-bolt", "orb-triple", "orb-rocket", "orb-shield", None, "boom", "fireball",
                        None],  # None = ve hře se nepoužívá
}
SIZES = {"boss": 520, "rocket-green": 300, "rocket-pink": 300}
done = []
for sheet, names in SHEETS.items():
    im = Image.open(os.path.join(RAW, sheet))
    W, H = im.size
    for k, n in enumerate(names):
        if n is None:
            continue
        r, c = divmod(k, 3)
        m = 0.03
        cell = im.crop((int(c * W / 3 + W / 3 * m), int(r * H / 3 + H / 3 * m),
                        int((c + 1) * W / 3 - W / 3 * m), int((r + 1) * H / 3 - H / 3 * m)))
        out = cut(cell, SIZES.get(n, 240))
        out.save(os.path.join(OUT, n + ".png"), optimize=True)
        done.append(n)
        print(n, out.size)

bg = Image.open(os.path.join(RAW, "bg-space.png")).convert("RGB")
bg.resize((1920, 1080), Image.LANCZOS).save(os.path.join(OUT, "bg.jpg"), quality=82, optimize=True)

b = Image.open(os.path.join(RAW, "banner-rakety.png")).convert("RGB")
W, H = b.size
th = int(W * 9 / 16)
t = max(0, (H - th) // 2)
b.crop((0, t, W, t + min(th, H))).resize((640, 360), Image.LANCZOS).save(os.path.join(RES, "banner_rakety.png"),
                                                                           optimize=True)

if len(sys.argv) > 1:
    prev = Image.new("RGBA", (len(done) * 130, 300), (110, 120, 135, 255))
    for i, n in enumerate(done):
        t = Image.open(os.path.join(OUT, n + ".png"))
        t.thumbnail((120, 280))
        prev.alpha_composite(t, (i * 130 + 5, 10))
    prev.convert("RGB").save(sys.argv[1], quality=88)
