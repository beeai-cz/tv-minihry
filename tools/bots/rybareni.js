// Robot pro tools/headless.js: nahodí, vede háček k nejbližší rybě, zasekne a navíjí.
module.exports = function (S, key, step) {
  const held = {};
  const set = (n, on, dev) => { if (!!held[n + dev] === on) return; held[n + dev] = on; key(on ? "down" : "up", n, dev); };
  for (let i = 0; i < 8000 && S.screen === "game"; i++) {
    const g = S.game;
    g.boats.forEach((b, idx) => {
      const dev = idx + 1;
      if (b.state === "idle") { ["left","right","up","down"].forEach((n) => set(n, false, dev)); key("down", "ok", dev); key("up", "ok", dev); }
      else if (b.state === "sink") {
        const f = g.fish.filter((f) => !f.hooked && f.x > b.x - 250 && f.x < b.x + 450).sort((a, c) => Math.hypot(a.x - b.hx, a.y - b.hy) - Math.hypot(c.x - b.hx, c.y - b.hy))[0];
        if (f) { set("down", f.y > b.hy + 20, dev); set("up", f.y < b.hy - 20 && b.hy > 420, dev); set("right", f.x > b.hx + 20, dev); set("left", f.x < b.hx - 20, dev); }
      } else if (b.state === "bite" || b.state === "reel") { key("down", "ok", dev); key("up", "ok", dev); }
    });
    step(0.1);
  }
  console.log("robot hotov, úlovků", S.game && S.game.count);
};
