/* Pravidla Křečků (sdílí hra i generátor úrovní tools/krecci_levels.js).
 * Deska = řádky textu: '#' keř (zeď), '.' tráva, 'H' domeček, '^ > v <' křeček na startu se směrem.
 * Křeček v každém kroku: když stojí na šipce, otočí se podle ní; pak jde rovně, a když nemůže,
 * zkusí doprava, doleva, nakonec zpátky. Kdo vejde do domečku, je doma. */
(function () {
  "use strict";
  const K =
    typeof module !== "undefined"
      ? module.exports
      : (window.KRECCI = window.KRECCI || {});
  const DX = [0, 1, 0, -1],
    DY = [-1, 0, 1, 0]; // 0 nahoru, 1 doprava, 2 dolů, 3 doleva
  const TURNS = [0, 1, 3, 2]; // rovně, doprava, doleva, zpátky
  K.DX = DX;
  K.DY = DY;

  K.parse = function (rows) {
    const h = rows.length,
      w = rows[0].length;
    const L = {
      w,
      h,
      wall: new Uint8Array(w * h),
      house: new Uint8Array(w * h),
      hams: [],
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        const i = y * w + x;
        if (ch === "#") L.wall[i] = 1;
        else if (ch === "H") L.house[i] = 1;
        else {
          const d = "^>v<".indexOf(ch);
          if (d >= 0) L.hams.push({ x, y, d });
        }
      }
    return L;
  };
  const free = (L, x, y) =>
    x >= 0 && y >= 0 && x < L.w && y < L.h && !L.wall[y * L.w + x];
  K.free = free;

  /** Jeden krok všech křečků (mění pole hs). */
  K.step = function (L, arrows, hs) {
    for (const m of hs) {
      if (m.home) continue;
      const a = arrows[m.y * L.w + m.x];
      if (a >= 0) m.d = a;
      for (const t of TURNS) {
        const d = (m.d + t) % 4;
        const nx = m.x + DX[d],
          ny = m.y + DY[d];
        if (!free(L, nx, ny)) continue;
        m.d = d;
        m.x = nx;
        m.y = ny;
        if (L.house[ny * L.w + nx]) m.home = true;
        break;
      }
    }
  };
  const key = (hs) =>
    hs.map((m) => (m.home ? "H" : m.x + "," + m.y + "," + m.d)).join("|");
  K.key = key;

  /** Celý běh: {ok, ticks, visited (indexy políček)}. Zacyklení = neúspěch. */
  K.run = function (L, arrows, maxT) {
    const hs = L.hams.map((m) => ({ x: m.x, y: m.y, d: m.d, home: false }));
    const seen = new Set();
    const visited = new Set();
    for (const m of hs) visited.add(m.y * L.w + m.x);
    let t = 0;
    while (t < (maxT || 400)) {
      if (hs.every((m) => m.home)) return { ok: true, ticks: t, visited };
      const k = key(hs);
      if (seen.has(k)) break;
      seen.add(k);
      K.step(L, arrows, hs);
      t++;
      for (const m of hs) visited.add(m.y * L.w + m.x);
    }
    return { ok: false, ticks: t, visited };
  };
})();
