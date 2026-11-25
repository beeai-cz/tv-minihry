"""Společné řezání obrázků z Higgsfieldu: bílé pozadí pryč, buňky mřížky 3x3, banner na dlaždici TV."""
import numpy as np
from PIL import Image
from scipy import ndimage


def erase_ground_lines(a, min_run=260):
    """Bojovníci stojí na tmavé čáře země: dlouhé vodorovné tmavé úseky přebarvit na bílou,
    jinak by čára zůstala pod nohama a uzavřela bílé místo mezi nimi."""
    rgb = a[:, :, :3].astype(int)
    dark = (rgb.max(axis=2) < 130) & (rgb.min(axis=2) < 90)
    for y in range(int(a.shape[0] * 0.7), a.shape[0]):  # čára je dole, ruce výš nechat
        row = dark[y]
        if row.sum() < min_run:
            continue
        x = 0
        n = len(row)
        while x < n:
            if not row[x]:
                x += 1
                continue
            x0 = x
            while x < n and row[x]:
                x += 1
            if x - x0 >= min_run:
                a[max(0, y - 2):y + 3, x0:x, :3] = 255
    return a


def alpha_cut(cell, lines=False, minfrac=0.02, holes=0.0):
    """RGBA pole s průhledným pozadím (bílé oblasti spojené s okrajem buňky)."""
    a = np.array(cell.convert("RGBA"))
    if lines:
        a = erase_ground_lines(a)
    white = a[:, :, :3].min(axis=2) > 228
    if lines:
        # šedý stín pod nohama (nízká sytost, světlý) ve spodní části bereme jako pozadí
        rgb = a[:, :, :3].astype(int)
        grey = ((rgb.max(axis=2) - rgb.min(axis=2)) < 45) & (rgb.min(axis=2) > 150)
        grey[: int(a.shape[0] * 0.7)] = False
        white |= grey
    lab, _ = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    kill = np.isin(lab, list(border))
    if holes:
        # velké uzavřené bílé plochy (např. pod uchem košíku) jsou taky pozadí
        n = lab.max()
        areas = ndimage.sum(white, lab, range(1, n + 1))
        big = [i + 1 for i, ar in enumerate(areas) if ar > holes * white.size]
        kill |= np.isin(lab, big)
    kill = ndimage.binary_dilation(kill, iterations=1) & (a[:, :, :3].min(axis=2) > 200) | kill
    a[kill, 3] = 0
    # drobné zbytky (šum, kousky stínu) pryč: nech jen větší souvislé kusy
    solid = a[:, :, 3] > 0
    lab2, n = ndimage.label(solid)
    if n > 1:
        sizes = ndimage.sum(solid, lab2, range(1, n + 1))
        small = [i + 1 for i, s in enumerate(sizes) if s < max(sizes) * minfrac]
        a[np.isin(lab2, small), 3] = 0
    return a


def cells(path, m=0.03):
    im = Image.open(path)
    W, H = im.size
    for k in range(9):
        r, c = divmod(k, 3)
        yield im.crop((int(c * W / 3 + W / 3 * m), int(r * H / 3 + H / 3 * m),
                       int((c + 1) * W / 3 - W / 3 * m), int((r + 1) * H / 3 - H / 3 * m)))


def save_item(arr, out, size):
    im = Image.fromarray(arr)
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit("prázdná buňka: " + out)
    im = im.crop(bbox)
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(out, optimize=True)
    return im.size


def banner(src, dst):
    b = Image.open(src).convert("RGB")
    W, H = b.size
    th = int(W * 9 / 16)
    t = max(0, (H - th) // 2)
    b.crop((0, t, W, t + min(th, H))).resize((640, 360), Image.LANCZOS).save(dst, optimize=True)
