// Robot pro tools/headless.js: srovná se s nejbližším robotem vodorovně a střílí.
module.exports = function (S, key, step) {
  const held = {};
  const set = (n, on, dev) => {
    if (!!held[n + dev] === on) return;
    held[n + dev] = on;
    key(on ? "down" : "up", n, dev);
  };
  for (let i = 0; i < 6000 && S.screen === "game"; i++) {
    const g = S.game;
    g.kids.forEach((k, idx) => {
      const dev = idx + 1;
      const b = g.bots.reduce((a, c) => (Math.hypot(c.x - k.x, c.y - k.y) < Math.hypot(a.x - k.x, a.y - k.y) ? c : a));
      const dy = b.y - k.y, dx = b.x - k.x;
      set("down", dy > 30, dev);
      set("up", dy < -30, dev);
      const far = Math.abs(dx) > 500;
      set("right", dx > 0 && (far || Math.abs(dy) <= 30), dev);
      set("left", dx < 0 && (far || Math.abs(dy) <= 30), dev);
      if (Math.abs(dy) < 40) { key("down", "ok", dev); key("up", "ok", dev); }
    });
    step(0.05);
  }
  console.log("robot hotov, zásahy:", S.game && S.game.score, "/", S.game && S.game.need);
};
