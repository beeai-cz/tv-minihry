"""Nařeže obrázky z Higgsfieldu pro Rybičky, Bedýnky, Bludiště a Chytačku
(art/raw/sheet-*.png 3x3, bg-sea.png, banner-*.png) do assets/<hra>/img/ a res/drawable-xhdpi/banner_<hra>.png.
Chybějící soubory přeskočí. Spouštět: python -P tools/nove_hry_sprites.py [náhled.jpg]"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_tools import alpha_cut, banner, cells, save_item  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
ASSETS = os.path.join(ROOT, "app", "src", "main", "assets")
RES = os.path.join(ROOT, "app", "src", "main", "res", "drawable-xhdpi")

# None = buňka se ve hře nepoužívá (strom a plot v Chytačce kreslí hra sama, sedí jí líp)
SHEETS = {
    "rybicky": ("sheet-fish.png", ["fish-green", "fish-pink", "fish-yellow", "fish-blue", "fish-orange", "fish-purple",
                                   "shark", "puffer", "starfish"]),
    "bedynky": ("sheet-boxes.png", ["crate", "crate-done", "target", "wall", "hedge", "grass", "flower", None, None]),
    "bludiste": ("sheet-maze.png", ["chest", "chest-open", "key", "puppy", None, "star", "hedge", "footprints", None]),
    "chytacka": ("sheet-catch.png", ["basket-green", "basket-pink", "cloud", "sun", None, None, None, None, "bush"]),
    # světy Skákačky: zvířátka a ozdoby (tučňák a medvídek jdou doprava)
    "skakacka": ("sheet-worlds.png", ["penguin", "snowman", None, "gummy", "lollipop", None, None, None, None]),
}
SIZES = {"shark": 420, "grass": 160, "wall": 160, "hedge": 160, "crate": 160, "crate-done": 160, "target": 160}
# dlaždice plní celé políčko: neořezávat bílé okraje uvnitř, jen pozadí kolem
done = []
for game, (sheet, names) in SHEETS.items():
    out_dir = os.path.join(ASSETS, game, "img")
    os.makedirs(out_dir, exist_ok=True)
    p = os.path.join(RAW, sheet)
    if not os.path.exists(p):
        print("chybí", sheet)
        continue
    sheet_im = Image.open(p)
    W, H = sheet_im.size
    for n, cell in zip(names, cells(p)):
        if n is None:
            continue
        if n == "shark":
            # žralok přesahuje svou buňku doprava i hřbetní ploutví nahoru: širší a vyšší výřez,
            # kousky sousedních buněk odfiltruje minfrac
            cell = sheet_im.crop((int(W * 0.01), int(H * 0.6), int(W / 3 * 1.27), int(H * 0.99)))
        out = os.path.join(out_dir, n + ".png")
        # u žraloka přetekl ocas z buňky: odříznutý kousek pryč
        arr = alpha_cut(cell, minfrac=0.25 if n in ("shark", "puffer") else 0.02,
                        holes=0.02 if n.startswith("basket") else 0.0)
        print(game, n, save_item(arr, out, SIZES.get(n, 240)))
        if game == "rybicky" and n != "starfish":
            # ryby v obrázku plavou doleva, hra počítá s doprava
            Image.open(out).transpose(Image.FLIP_LEFT_RIGHT).save(out, optimize=True)
        done.append(out)
    b = os.path.join(RAW, "banner-" + game + ".png")
    if os.path.exists(b):
        banner(b, os.path.join(RES, "banner_" + game + ".png"))
    else:
        print("chybí banner", game)

for src, game, dst in [("bg-winter.png", "skakacka", "bg-winter.jpg"), ("bg-candy.png", "skakacka", "bg-candy.jpg")]:
    p = os.path.join(RAW, src)
    if os.path.exists(p):
        Image.open(p).convert("RGB").resize((1920, 1080), Image.LANCZOS).save(
            os.path.join(ASSETS, game, "img", dst), quality=82, optimize=True)

sea = os.path.join(RAW, "bg-sea.png")
if os.path.exists(sea):
    Image.open(sea).convert("RGB").resize((1920, 1080), Image.LANCZOS).save(
        os.path.join(ASSETS, "rybicky", "img", "bg.jpg"), quality=82, optimize=True)

if len(sys.argv) > 1 and done:
    cols = 9
    rows = (len(done) + cols - 1) // cols
    prev = Image.new("RGBA", (cols * 170, rows * 190), (110, 120, 135, 255))
    for i, f in enumerate(done):
        t = Image.open(f)
        t.thumbnail((160, 180))
        prev.alpha_composite(t, ((i % cols) * 170 + 5, (i // cols) * 190 + 5))
    prev.convert("RGB").save(sys.argv[1], quality=88)
