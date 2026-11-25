"""Nařeže obrázky z Higgsfieldu pro Hada a Bojovku.
Had: art/raw/sheet-snake.png, sheet-fruit2.png (3x3), bg-garden.png, banner-had.png -> assets/had/img/.
Bojovka: art/raw/fighter-<id>.png (3x3 pózy), bg-dojo.png, banner-bojovka.png -> assets/bojovka/img/.
U bojovníků mají všechny pózy stejné měřítko a výšku (od nejvyššího bodu po zem) a střed obrázku
je ve středu těla, aby postava při úderu nebo kopu neposkakovala.
Spouštět: python -P tools/had_bojovka_sprites.py [náhled.jpg]"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
ASSETS = os.path.join(ROOT, "app", "src", "main", "assets")
RES = os.path.join(ROOT, "app", "src", "main", "res", "drawable-xhdpi")
os.makedirs(RES, exist_ok=True)


from sprite_tools import alpha_cut, banner, cells, save_item  # noqa: E402


done = []

# ---------- Had ----------
had = os.path.join(ASSETS, "had", "img")
os.makedirs(had, exist_ok=True)
SNAKE = {
    "sheet-snake.png": ["snake-green", "snake-pink", "apple", "banana", "strawberry", "cherry", "pear", "orange",
                        "grapes"],
    "sheet-fruit2.png": ["watermelon", "carrot", "pineapple", "peach", "lemon", "blueberry", "rock", "bush", None],
}
for sheet, names in SNAKE.items():
    p = os.path.join(RAW, sheet)
    if not os.path.exists(p):
        print("chybí", sheet)
        continue
    for n, cell in zip(names, cells(p)):
        if n is None:
            continue
        print(n, save_item(alpha_cut(cell), os.path.join(had, n + ".png"), 200))
        done.append(os.path.join(had, n + ".png"))
if os.path.exists(os.path.join(RAW, "bg-garden.png")):
    Image.open(os.path.join(RAW, "bg-garden.png")).convert("RGB").resize((1920, 1080), Image.LANCZOS).save(
        os.path.join(had, "bg.jpg"), quality=82, optimize=True)
if os.path.exists(os.path.join(RAW, "banner-had.png")):
    banner(os.path.join(RAW, "banner-had.png"), os.path.join(RES, "banner_had.png"))

# ---------- Bojovka ----------
boj = os.path.join(ASSETS, "bojovka", "img")
os.makedirs(boj, exist_ok=True)
POSES = ["idle", "walk", "punch", "kick", "jump", "block", "hit", "win", "ko"]
OUT_H = 420
for fid in ["frog", "bunny", "panda", "fox"]:
    p = os.path.join(RAW, "fighter-" + fid + ".png")
    if not os.path.exists(p):
        print("chybí", p)
        continue
    arrs = [alpha_cut(c, lines=True) for c in cells(p, m=0.01)]
    # společná svislá osa: od nejvyššího bodu všech póz po nejnižší (zem)
    tops, bots = [], []
    for a in arrs:
        ys = np.where(a[:, :, 3].any(axis=1))[0]
        if len(ys) == 0:
            raise SystemExit("prázdná buňka u bojovníka " + fid)
        tops.append(ys[0])
        bots.append(ys[-1])
    top, bot = min(tops), max(bots)
    scale = OUT_H / (bot - top + 1)
    for pose, a in zip(POSES, arrs):
        al = a[:, :, 3] > 0
        xs = np.where(al.any(axis=0))[0]
        # střed těla = medián neprůhledných pixelů (končetiny ho moc neposunou)
        cx = int(np.median(np.where(al)[1]))
        half = max(cx - xs[0], xs[-1] - cx) + 4
        x0, x1 = cx - half, cx + half
        pad = np.zeros((a.shape[0], 2 * half + 1, 4), dtype=np.uint8)
        src0, src1 = max(0, x0), min(a.shape[1], x1 + 1)
        pad[:, src0 - x0:src0 - x0 + (src1 - src0)] = a[:, src0:src1]
        im = Image.fromarray(pad[top:bot + 1])
        im = im.resize((max(1, int(im.width * scale)), OUT_H), Image.LANCZOS)
        out = os.path.join(boj, fid + "-" + pose + ".png")
        im.save(out, optimize=True)
        done.append(out)
    print(fid, "ok")
if os.path.exists(os.path.join(RAW, "bg-dojo.png")):
    Image.open(os.path.join(RAW, "bg-dojo.png")).convert("RGB").resize((1920, 1080), Image.LANCZOS).save(
        os.path.join(boj, "bg.jpg"), quality=82, optimize=True)
if os.path.exists(os.path.join(RAW, "banner-bojovka.png")):
    banner(os.path.join(RAW, "banner-bojovka.png"), os.path.join(RES, "banner_bojovka.png"))

if len(sys.argv) > 1 and done:
    cols = 9
    rows = (len(done) + cols - 1) // cols
    prev = Image.new("RGBA", (cols * 170, rows * 200), (110, 120, 135, 255))
    for i, f in enumerate(done):
        t = Image.open(f)
        t.thumbnail((160, 190))
        prev.alpha_composite(t, ((i % cols) * 170 + 5, (i // cols) * 200 + 5))
    prev.convert("RGB").save(sys.argv[1], quality=88)
