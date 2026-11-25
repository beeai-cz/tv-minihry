/* Generátor úrovní Křečků: náhodné desky (pevné semínko), ponechá jen ty, které jdou vyřešit
 * přesně daným počtem šipek (s menším počtem ne). Řešení se uloží do úrovně (nápověda ve hře).
 * Spuštění: node tools/krecci_levels.js  ->  app/src/main/assets/krecci/levels.js */
"use strict";
const fs = require("fs");
const path = require("path");
const K = require("../app/src/main/assets/krecci/sim.js");

let seed = 20261124;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const irnd = (a, b) => a + Math.floor(rnd() * (b - a + 1));

function makeBoard(w, h, density, hamsters) {
  const g = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      row.push(edge || rnd() < density ? "#" : ".");
    }
    g.push(row);
  }
  const freeCells = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (g[y][x] === ".") freeCells.push([x, y]);
  if (freeCells.length < 8) return null;
  // souvislost
  const seen = new Set([freeCells[0].join()]);
  const q = [freeCells[0]];
  while (q.length) {
    const [x, y] = q.pop();
    for (let d = 0; d < 4; d++) {
      const nx = x + K.DX[d],
        ny = y + K.DY[d];
      if (g[ny][nx] === "." && !seen.has(nx + "," + ny)) {
        seen.add(nx + "," + ny);
        q.push([nx, ny]);
      }
    }
  }
  if (seen.size !== freeCells.length) return null;
  const pickCell = () =>
    freeCells.splice(Math.floor(rnd() * freeCells.length), 1)[0];
  const [hx, hy] = pickCell();
  g[hy][hx] = "H";
  for (let k = 0; k < hamsters; k++) {
    const [x, y] = pickCell();
    g[y][x] = "^>v<"[irnd(0, 3)];
  }
  return g.map((r) => r.join(""));
}

let budget = 0;
function solve(L, arrows, k) {
  if (--budget < 0) throw new Error("budget");
  const r = K.run(L, arrows);
  if (r.ok) return [];
  if (k === 0) return null;
  for (const c of r.visited) {
    if (L.house[c] || arrows[c] >= 0) continue;
    for (let d = 0; d < 4; d++) {
      arrows[c] = d;
      const s = solve(L, arrows, k - 1);
      arrows[c] = -1;
      if (s) return [[c, d]].concat(s);
    }
  }
  return null;
}
function minSolution(L, maxK) {
  const arrows = new Int8Array(L.w * L.h).fill(-1);
  for (let k = 0; k <= maxK; k++) {
    budget = 400000;
    const s = solve(L, arrows, k);
    if (s) return s;
  }
  return null;
}

function make(spec) {
  for (let tries = 0; tries < 20000; tries++) {
    const rows = makeBoard(spec.w, spec.h, spec.density, spec.hams);
    if (!rows) continue;
    const L = K.parse(rows);
    let sol;
    try {
      sol = minSolution(L, spec.k);
    } catch (e) {
      continue;
    }
    if (!sol || sol.length !== spec.k) continue;
    const arrows = new Int8Array(L.w * L.h).fill(-1);
    for (const [c, d] of sol) arrows[c] = d;
    const r = K.run(L, arrows);
    if (r.ticks < spec.minTicks) continue;
    // semínka na cestě řešení (ne na startu, domečku ani na šipce)
    const cand = [...r.visited].filter(
      (c) =>
        !L.house[c] &&
        arrows[c] < 0 &&
        !L.hams.some((m) => m.y * L.w + m.x === c),
    );
    const seeds = [];
    while (seeds.length < Math.min(3, cand.length))
      seeds.push(cand.splice(Math.floor(rnd() * cand.length), 1)[0]);
    return { rows, k: spec.k, sol, seeds };
  }
  throw new Error("nepodařilo se: " + JSON.stringify(spec));
}

const S = (w, h, k, hams, density, minTicks) => ({
  w,
  h,
  k,
  hams,
  density,
  minTicks: minTicks || 6,
});
const SPECS = {
  maty: [
    S(7, 5, 1, 1, 0, 5),
    S(8, 5, 1, 1, 0.05),
    S(8, 6, 1, 1, 0.08),
    S(9, 6, 1, 1, 0.1),
    S(9, 6, 1, 2, 0.08),
    S(9, 6, 1, 2, 0.12),
    S(10, 6, 1, 2, 0.12, 8),
  ],
  nela: [
    S(9, 6, 1, 1, 0.1),
    S(9, 6, 1, 2, 0.12),
    S(10, 6, 2, 1, 0.12),
    S(10, 6, 2, 2, 0.12),
    S(10, 7, 2, 2, 0.15),
    S(11, 7, 2, 2, 0.15, 10),
    S(11, 7, 2, 3, 0.15, 10),
    S(10, 7, 3, 1, 0.15, 10),
    S(11, 7, 3, 2, 0.15, 10),
    S(11, 7, 3, 2, 0.18, 12),
    S(12, 7, 3, 3, 0.16, 12),
    S(12, 7, 3, 3, 0.2, 14),
  ],
  spolu: [
    S(9, 6, 1, 2, 0.08),
    S(10, 6, 1, 2, 0.12),
    S(10, 6, 2, 2, 0.12),
    S(11, 7, 2, 2, 0.15),
    S(11, 7, 2, 3, 0.15),
    S(11, 7, 3, 2, 0.15, 10),
    S(12, 7, 3, 3, 0.16, 12),
  ],
};
const TUTORIAL = {
  rows: ["#######", "#>...H#", "#######"],
  k: 0,
  sol: [],
  seeds: [9, 10],
};

const out = {};
for (const who in SPECS) {
  out[who] = who === "maty" ? [TUTORIAL] : [];
  for (const spec of SPECS[who]) {
    const t0 = Date.now();
    const lv = make(spec);
    out[who].push(lv);
    console.log(
      who,
      out[who].length,
      "k=" + lv.k,
      (Date.now() - t0) / 1000 + " s",
    );
    console.log("  " + lv.rows.join("\n  "));
  }
}
const file = path.join(__dirname, "../app/src/main/assets/krecci/levels.js");
fs.writeFileSync(
  file,
  "/* Vygenerováno tools/krecci_levels.js - neupravovat ručně. sol = [index políčka, směr] */\n" +
    "window.KRECCI_LEVELS = " +
    JSON.stringify(out) +
    ";\n",
);
console.log("zapsáno", file);
