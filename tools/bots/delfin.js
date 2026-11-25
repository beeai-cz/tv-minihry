// Robot pro tools/headless.js: plave k nejbližšímu delfíněti (nebo s nimi k mamince) a zpívá.
module.exports = function (S, key, step) {
  const held = {};
  const set = (n, on, dev) => { if (!!held[n + dev] === on) return; held[n + dev] = on; key(on ? "down" : "up", n, dev); };
  const wobs = [0, 0];
  for (let i = 0; i < 9000 && S.screen === "game"; i++) {
    const g = S.game;
    g.dols.forEach((d, idx) => {
      const dev = idx + 1;
      let t = d.train.some((b) => !b.home) ? g.L.mom : g.L.babies.filter((b) => !b.found).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      if (!t) t = g.L.mom;
      let tx = t.x, ty = t.y;
      if (Math.hypot(d.vx, d.vy) < 60 && Math.hypot(tx - d.x, ty - d.y) > 300) wobs[idx] = 40; // uvízl u skály: chvíli nahoru
      if (wobs[idx] > 0) { wobs[idx]--; ty = d.y - 400; }
      set("right", tx - d.x > 40, dev); set("left", tx - d.x < -40, dev);
      set("down", ty - d.y > 40, dev); set("up", ty - d.y < -40, dev);
      if (i % 20 === 0) { key("down", "ok", dev); key("up", "ok", dev); }
    });
    step(0.05);
  }
  const g = S.game;
  console.log("robot hotov, úroveň", g && g.level, "doma", g && g.L.babies.filter((b) => b.home).length, JSON.stringify(g.L.babies.map(b=>[b.x|0,b.y|0,b.hidden,b.found,b.home])), JSON.stringify(g.dols.map(d=>[d.x|0,d.y|0,d.train.length])), JSON.stringify(g.L.gates));
};
