// Robot pro tools/headless.js: běží k míči, s míčem k bráně, z blízka střílí.
module.exports = function (S, key, step) {
  const held = {};
  const set = (n, on, dev) => {
    const k = n + dev;
    if (!!held[k] === on) return;
    held[k] = on;
    key(on ? "down" : "up", n, dev);
  };
  for (let i = 0; i < 6000 && S.screen === "game"; i++) {
    const g = S.game;
    g.kids.forEach((k, idx) => {
      const dev = idx + 1;
      const b = g.ball;
      let tx = b.x - 40,
        ty = b.y;
      if (b.owner === k) {
        tx = 1800;
        ty = 605;
        if (k.x > 1350 && Math.abs(k.fy) < 0.5) {
          key("down", "ok", dev);
          key("up", "ok", dev);
        }
      }
      set("right", tx - k.x > 25, dev);
      set("left", tx - k.x < -25, dev);
      set("down", ty - k.y > 25, dev);
      set("up", ty - k.y < -25, dev);
    });
    step(0.05);
  }
  console.log("robot hotov, góly:", S.game && S.game.goals);
};
