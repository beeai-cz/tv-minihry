"""Nařeže obrázky z Higgsfieldu pro nové hry (art/raw/sheet-sega*.png 3x3 a banner-<hra>.png)
do assets/<hra>/img/ a res/drawable-xhdpi/banner_<hra>.png. Chybějící soubory přeskočí.
Spouštět: python -P tools/sega_sprites.py"""
import os
import sys

import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_tools import alpha_cut, banner, cells, save_item  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art", "raw")
ASSETS = os.path.join(ROOT, "app", "src", "main", "assets")
RES = os.path.join(ROOT, "app", "src", "main", "res", "drawable-xhdpi")

# buňka -> (hra, jméno) nebo None
SHEETS = {
    "sheet-sega1.png": [("krecci", "hamster1"), ("krecci", "hamster2"), ("krecci", "house"),
                        ("kuratka", "cat"), ("kuratka", "hen-green"), ("kuratka", "hen-pink"),
                        ("kuratka", "chick"), ("kuratka", "coop"), ("krecci", "seeds")],
    "sheet-sega2.png": [("delfin", "dolphin"), ("delfin", "baby-pink"), ("delfin", "baby-green"),
                        ("delfin", "jelly"), ("delfin", "pearl"), ("delfin", "seaweed"),
                        ("rybareni", "boat"), ("rybareni", "boot"), ("rybareni", "crab")],
    "sheet-sega4.png": [("tanec", "bunny-idle"), ("tanec", "bunny-left"), ("tanec", "bunny-right"),
                        ("tanec", "bunny-up"), None, None,  # dřep a tlesk nejdou čistě vyříznout
                        ("tanec", "parrot"), ("tanec", "parrot-point"), ("tanec", "discoball")],
    "sheet-sega6.png": [("hasici", "truck"), None, ("hasici", "flame"),
                        ("hasici", "kitten"), ("hasici", "hydrant"), ("hasici", "helmet"),
                        ("hasici", "puppy"), ("hasici", "station"), ("hasici", "drop")],
    "sheet-sega7.png": [("fotbal", "ball"), ("fotbal", "puck"), ("penovky", "dart"),
                        ("penovky", "frog"), ("penovky", "bunny"), ("penovky", "bear"),
                        ("penovky", "fox"), ("penovky", "crate"), ("jezci", "hedgehog")],
    "sheet-sega8.png": [("brusle", "inline-nela"), ("brusle", "inline-maty"), ("brusle", "ski-nela"),
                        ("brusle", "ski-maty"), ("brusle", "snow-nela"), ("brusle", "snow-maty"),
                        ("brusle", "swim-nela"), ("brusle", "swim-maty"), ("brusle", "cone")],
}
# delší strana v pixelech (výchozí 300)
SIZES = {"truck": 260, "station": 360, "dart": 160, "puck": 160, "ball": 200, "seeds": 200, "drop": 160,
         "hydrant": 200, "flame": 240, "crate": 260}
# kopie do dalších her
COPIES = {("delfin", "crab"): ["rybareni"], ("rybareni", "crab"): ["delfin"]}



def sealed_cut(cell, seal=4):
    """Bílé postavičky (zajíček): pozadí se zaplavuje jen přes bílou, kterou neodděluje obrys
    ztlustěný o seal px - tak se nevyteče do bílého těla mezerou v obrysu."""
    a = np.array(cell.convert("RGBA"))
    rgb = a[:, :, :3].astype(int)
    white = rgb.min(axis=2) > 228
    barrier = ndimage.binary_dilation(rgb.min(axis=2) < 170, iterations=seal)
    lab, _ = ndimage.label(white & ~barrier)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    kill = np.isin(lab, list(border))
    # zpátky až k obrysu (jen světlé pixely)
    kill = ndimage.binary_dilation(kill, iterations=seal + 1) & (rgb.min(axis=2) > 200)
    a[kill, 3] = 0
    solid = a[:, :, 3] > 0
    lab2, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n + 1))
        a[np.isin(lab2, [i + 1 for i, z in enumerate(sizes) if z < max(sizes) * 0.08]), 3] = 0
    return a


SEALED = {"sheet-sega4.png"}
done = 0
for sheet, names in SHEETS.items():
    p = os.path.join(RAW, sheet)
    if not os.path.exists(p):
        print("chybí", sheet)
        continue
    for item, cell in zip(names, cells(p)):
        if item is None:
            continue
        game, name = item
        d = os.path.join(ASSETS, game, "img")
        os.makedirs(d, exist_ok=True)
        out = os.path.join(d, name + ".png")
        arr = sealed_cut(cell, 10) if sheet in SEALED else alpha_cut(cell, minfrac=0.08)
        size = save_item(arr, out, SIZES.get(name, 300))
        done += 1
        print(game, name, size)

for game in ["drahokamy", "krecci", "kulicka", "pinball", "delfin", "kuratka", "tanec", "rybareni",
             "hasici", "fotbal", "brusle", "penovky", "kostky", "jezci"]:
    p = os.path.join(RAW, "banner-" + game + ".png")
    if os.path.exists(p):
        banner(p, os.path.join(RES, "banner_" + game + ".png"))
        done += 1
    else:
        print("chybí banner", game)
print("hotovo", done)
