// Robot pro tools/headless.js: pro každý tvar najde nejlepší místo (málo děr, nízko) a dojede tam klávesami.
module.exports = function (S, key, step) {
  const plan = new Map();
  function best(w) {
    const pc = w.piece, C = w.R.cols, Rr = w.R.rows;
    let cells = pc.cells.map((c) => c.slice()), bestS = -1e9, bestP = null;
    for (let rot = 0; rot < 4; rot++) {
      for (let x = -3; x < C; x++) {
        const ok = (y) => cells.every(([cx, cy]) => { const gx = x + cx, gy = y + cy; return gx >= 0 && gx < C && gy < Rr && (gy < 0 || w.grid[gy * C + gx] === -1); });
        if (!ok(0)) continue;
        let y = 0; while (ok(y + 1)) y++;
        const g = w.grid.slice(); cells.forEach(([cx, cy]) => { if (y + cy >= 0) g[(y + cy) * C + x + cx] = 1; });
        let lines = 0, holes = 0, hmax = 0;
        for (let r = 0; r < Rr; r++) { let f = true; for (let c = 0; c < C; c++) if (g[r * C + c] === -1) f = false; if (f) lines++; }
        for (let c = 0; c < C; c++) { let seen = false; for (let r = 0; r < Rr; r++) { if (g[r * C + c] !== -1) { if (!seen) hmax = Math.max(hmax, Rr - r); seen = true; } else if (seen) holes++; } }
        const s = lines * 10 - holes * 4 - hmax + y * 0.5;
        if (s > bestS) { bestS = s; bestP = { rot, x }; }
      }
      const maxY = Math.max(...cells.map((c) => c[1]));
      cells = cells.map(([x, y]) => [maxY - y, x]);
    }
    return bestP;
  }
  for (let i = 0; i < 12000 && S.screen === "game"; i++) {
    const g = S.game;
    g.wells.forEach((w, idx) => {
      const dev = idx + 1;
      if (!w.piece || w.state !== "fall") { key("up", "down", dev); return; }
      let pl = plan.get(w);
      if (!pl || pl.piece !== w.piece) { pl = { piece: w.piece, ...best(w), r: 0 }; plan.set(w, pl); key("up", "down", dev); }
      if (pl.r < pl.rot) { key("down", "up", dev); pl.r++; return; }
      if (w.piece.x < pl.x) key("down", "right", dev);
      else if (w.piece.x > pl.x) key("down", "left", dev);
      else key("down", "down", dev);
    });
    step(0.05);
  }
  console.log("robot hotov:", S.game && S.game.wells.map((w) => "úr." + w.level + " řad " + w.lines).join(" / "));
};
