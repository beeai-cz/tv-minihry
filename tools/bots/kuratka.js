// Robot pro tools/headless.js: sbírá kuřátka (skáče po patrech) a nosí je do kurníku.
module.exports = function (S, key, step) {
  const held = {};
  const set = (n, on, dev) => { if (!!held[n + dev] === on) return; held[n + dev] = on; key(on ? "down" : "up", n, dev); };
  for (let i = 0; i < 12000 && S.screen === "game"; i++) {
    const g = S.game;
    g.hens.forEach((h, idx) => {
      const dev = idx + 1;
      const free = g.chicks.filter((c) => !c.home && !c.owner && c.flee <= 0);
      let T;
      if (h.train.length >= 3 || (!free.length && h.train.length)) T = { x: 1770, y: 990 };
      else T = free.sort((a, b) => Math.abs(a.y - h.y) * 3 + Math.abs(a.x - h.x) - (Math.abs(b.y - h.y) * 3 + Math.abs(b.x - h.x)))[0];
      if (!T) { set("left", false, dev); set("right", false, dev); return; }
      let tx = T.x;
      set("down", false, dev);
      if (T.y < h.y - 30) {
        // nahoru: plošina nad námi, co je nejblíž cíli
        const ps = g.plats.filter((p) => p.y < h.y - 30 && h.y - p.y < 300).sort((a, b) => Math.abs(a.x + a.w / 2 - T.x) - Math.abs(b.x + b.w / 2 - T.x));
        const p = ps[0];
        if (p) {
          tx = Math.max(p.x + 40, Math.min(p.x + p.w - 40, T.x));
          if (h.ground && h.x > p.x - 110 && h.x < p.x + p.w + 110) { key("down", "ok", dev); key("up", "ok", dev); }
        }
      } else if (T.y > h.y + 30 && h.ground) {
        set("down", true, dev);
      }
      set("right", tx - h.x > 15, dev); set("left", tx - h.x < -15, dev);
    });
    step(0.05);
  }
  const g = S.game;
  console.log("robot hotov, úroveň", g && g.level, "doma", g && g.chicks.filter((c) => c.home).length, "/", g && g.chicks.length, JSON.stringify(g.chicks.filter(c=>!c.home).map(c=>[c.x|0,c.y|0,!!c.owner])), JSON.stringify(g.hens.map(h=>[h.x|0,h.y|0,h.ground,h.train.length])));
};
