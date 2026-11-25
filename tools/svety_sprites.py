"""Nařeže obrázky z Higgsfieldu pro barevného Dinosaura, trasy Závodů a světy Bludiště.
Vstupy v art/raw/: sheet-dino.png, sheet-trasy.png (3x3), walls-maze.png (2x2 textury), bg-dino.png,
banner-dino.png, a z dřívějška sheet-worlds.png (smrk, sněhulák, cupcake, cukrová hůl, sníh).
Chybějící soubory přeskočí. Spouštět: python -P tools/svety_sprites.py [náhled.jpg]"""
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_tools import alpha_cut, banner, cells, save_item  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
ASSETS = os.path.join(ROOT, "app", "src", "main", "assets")
RES = os.path.join(ROOT, "app", "src", "main", "res", "drawable-xhdpi")
DINO = os.path.join(ASSETS, "dino", "img")
RACE = os.path.join(ASSETS, "zavody", "img")
MAZE = os.path.join(ASSETS, "bludiste", "img")
for d in (DINO, RACE, MAZE):
    os.makedirs(d, exist_ok=True)
done = []


def raw(name):
    p = os.path.join(RAW, name)
    if not os.path.exists(p):
        print("chybí", name)
        return None
    return p


def group(arrs, names, out_dir, out_h):
    """Pózy jedné postavy: společné měřítko, nohy na stejné spodní hraně a střed těla uprostřed,
    ať dinosaurus při běhu neposkakuje ani nemění velikost (hra kreslí každou pózu stejně vysokou)."""
    tops, bots = [], []
    for a in arrs:
        ys = np.where(a[:, :, 3].any(axis=1))[0]
        tops.append(ys[0])
        bots.append(ys[-1])
    top, bot = min(tops), max(bots)
    scale = out_h / (bot - top + 1)
    for n, a in zip(names, arrs):
        al = a[:, :, 3] > 0
        xs = np.where(al.any(axis=0))[0]
        cx = int(np.median(np.where(al)[1]))
        half = max(cx - xs[0], xs[-1] - cx) + 4
        pad = np.zeros((a.shape[0], 2 * half + 1, 4), dtype=np.uint8)
        x0 = cx - half
        s0, s1 = max(0, x0), min(a.shape[1], cx + half + 1)
        pad[:, s0 - x0:s0 - x0 + (s1 - s0)] = a[:, s0:s1]
        im = Image.fromarray(pad[top:bot + 1])
        im = im.resize((max(1, int(im.width * scale)), out_h), Image.LANCZOS)
        out = os.path.join(out_dir, n + ".png")
        im.save(out, optimize=True)
        done.append(out)
        print(n, im.size)


# ---------- Dinosaurus ----------
p = raw("sheet-dino.png")
if p:
    c = [alpha_cut(x, minfrac=0.1) for x in cells(p)]
    group([c[0], c[1], c[2], c[5]], ["dino-run1", "dino-run2", "dino-jump", "dino-hit"], DINO, 240)
    group([c[3], c[4]], ["dino-duck1", "dino-duck2"], DINO, 150)
    # ptakoještěr v obrázku letí doprava, ve hře letí proti dinosaurovi (doleva)
    group([c[6][:, ::-1].copy(), c[7][:, ::-1].copy()], ["ptero-up", "ptero-down"], DINO, 200)
    out = os.path.join(DINO, "cactus-small.png")
    print("cactus-small", save_item(c[8], out, 220))
    done.append(out)

# ---------- Závody: poušť, zima, cukrová země ----------
p = raw("sheet-trasy.png")
if p:
    # None = buňka se nepoužívá (dva malé kaktusy, keř)
    names = ["cactus", None, "palm", "rock", "tumbleweed", "ice", "chocolate", "cloud", None]
    for n, cell in zip(names, cells(p)):
        if n is None:
            continue
        a = alpha_cut(cell, minfrac=0.1)
        out = os.path.join(DINO if n == "cloud" else RACE, n + ".png")
        print(n, save_item(a, out, 240))
        done.append(out)
    # vysoký kaktus i pro Dinosaura
    shutil.copyfile(os.path.join(RACE, "cactus.png"), os.path.join(DINO, "cactus-large.png"))
p = raw("sheet-worlds.png")
if p:
    # z dřívějšího archu pro Skákačku: 1 sněhulák, 2 smrk, 5 cupcake, 7 cukrová hůl, 8 hromádka sněhu
    want = {1: "snowman", 2: "pine-snow", 5: "cupcake", 7: "candy-cane", 8: "snowball"}
    for k, cell in enumerate(cells(p)):
        if k in want:
            out = os.path.join(RACE, want[k] + ".png")
            print(want[k], save_item(alpha_cut(cell, minfrac=0.1), out, 240))
            done.append(out)
for n in ("lollipop", "gummy"):
    src = os.path.join(ASSETS, "skakacka", "img", n + ".png")
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(RACE, n + ".png"))

# ---------- Bludiště: textury zdí (2x2) ----------
p = raw("walls-maze.png")
if p:
    im = Image.open(p).convert("RGB")
    W, H = im.size
    for k, n in enumerate(["wall-snow", "wall-sand", "wall-candy", "wall-stone"]):
        r, c = divmod(k, 2)
        m = 0.04  # okraj buňky pryč (případná spára mezi texturami)
        t = im.crop((int((c + m / 2) * W / 2), int((r + m / 2) * H / 2),
                     int((c + 1 - m / 2) * W / 2), int((r + 1 - m / 2) * H / 2)))
        t = t.resize((128, 128), Image.LANCZOS)
        # bezešvě: dlaždice složená ze 4 zrcadlených kopií (textura z generátoru na krajích nenavazuje)
        s = Image.new("RGB", (256, 256))
        s.paste(t, (0, 0))
        s.paste(t.transpose(Image.FLIP_LEFT_RIGHT), (128, 0))
        s.paste(t.transpose(Image.FLIP_TOP_BOTTOM), (0, 128))
        s.paste(t.transpose(Image.ROTATE_180), (128, 128))
        out = os.path.join(MAZE, n + ".png")
        s.save(out, optimize=True)
        done.append(out)
        print(n, s.size)

# ---------- pozadí a dlaždice Dinosaura ----------
p = raw("bg-dino.png")
if p:
    Image.open(p).convert("RGB").resize((1920, 1080), Image.LANCZOS).save(
        os.path.join(DINO, "bg.jpg"), quality=82, optimize=True)
p = raw("banner-dino.png")
if p:
    banner(p, os.path.join(RES, "banner_dino.png"))

if len(sys.argv) > 1 and done:
    cols = 9
    rows = (len(done) + cols - 1) // cols
    prev = Image.new("RGBA", (cols * 170, rows * 190), (110, 120, 135, 255))
    for i, f in enumerate(done):
        t = Image.open(f).convert("RGBA")
        t.thumbnail((160, 180))
        prev.alpha_composite(t, ((i % cols) * 170 + 5, (i // cols) * 190 + 5))
    prev.convert("RGB").save(sys.argv[1], quality=88)
