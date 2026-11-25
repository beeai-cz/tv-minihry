"""Nařeže obrázky z Higgsfieldu pro Skákačku: art/raw/sheet-kids.png (2x2), sheet-jump.png (3x3 vpravo dole),
bg-hills.png -> app/src/main/assets/skakacka/img/. Bílé pozadí pryč (spojité bílé oblasti od okraje,
u dětí i větší uzavřené mezery mezi rukama a nohama). Spouštět: python -P tools/skakacka_sprites.py"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
OUT = os.path.join(ROOT, "app", "src", "main", "assets", "skakacka", "img")
os.makedirs(OUT, exist_ok=True)


def cut(cell, holes_area=None, size=360):
    a = np.array(cell.convert("RGBA"))
    white = a[:, :, :3].min(axis=2) > 228
    lab, n = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    kill = np.isin(lab, list(border))
    if holes_area:
        areas = ndimage.sum(white, lab, range(1, n + 1))
        big = [i + 1 for i, s in enumerate(areas) if s > holes_area]
        kill |= np.isin(lab, big)
    # Okraj o pixel rozšířit, ať nezůstane bílý lem.
    kill = ndimage.binary_dilation(kill, iterations=1) & (a[:, :, :3].min(axis=2) > 200) | kill
    a[kill, 3] = 0
    im = Image.fromarray(a)
    im = im.crop(im.getchannel("A").getbbox())
    im.thumbnail((size, size), Image.LANCZOS)
    return im


kids = Image.open(os.path.join(RAW, "sheet-kids.png"))
W, H = kids.size
for k, n in enumerate(["maty-stand", "maty-jump", "nela-stand", "nela-jump"]):
    r, c = divmod(k, 2)
    cell = kids.crop((c * W // 2, r * H // 2, (c + 1) * W // 2, (r + 1) * H // 2))
    im = cut(cell, holes_area=1800, size=300)
    im.save(os.path.join(OUT, n + ".png"), optimize=True)
    print(n, im.size)

sheet = Image.open(os.path.join(RAW, "sheet-jump.png"))
W, H = sheet.size
x0, y0 = W * 0.501, H * 0.501
cw, ch = (W - x0) / 3, (H - y0) / 3
names = ["snail", "ladybug", "star", "crate", "starblock", "bush", "flag", "cloud", "mushroom"]
for k, n in enumerate(names):
    r, c = divmod(k, 3)
    m = 0.04
    cell = sheet.crop((int(x0 + c * cw + cw * m), int(y0 + r * ch + ch * m),
                       int(x0 + (c + 1) * cw - cw * m), int(y0 + (r + 1) * ch - ch * m)))
    im = cut(cell, size=240)
    im.save(os.path.join(OUT, n + ".png"), optimize=True)
    print(n, im.size)

bg = Image.open(os.path.join(RAW, "bg-hills.png")).convert("RGB")
bg.resize((1920, 1080), Image.LANCZOS).save(os.path.join(OUT, "bg.jpg"), quality=82, optimize=True)

# kontrolní náhled na šedé
if len(sys.argv) > 1:
    alln = ["maty-stand", "maty-jump", "nela-stand", "nela-jump"] + names
    prev = Image.new("RGBA", (len(alln) * 170, 330), (110, 120, 135, 255))
    for i, n in enumerate(alln):
        t = Image.open(os.path.join(OUT, n + ".png"))
        t.thumbnail((160, 300))
        prev.alpha_composite(t, (i * 170 + 5, 15))
    prev.convert("RGB").save(sys.argv[1], quality=88)
