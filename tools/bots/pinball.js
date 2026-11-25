// Robot pro tools/headless.js: mávne ploutví, když je kulička nad ní.
module.exports = function (S, key, step) {
  let drains = 0, had = false;
  for (let i = 0; i < 8000 && S.screen === "game"; i++) {
    const g = S.game, b = g.ball;
    if (had && !b) drains++;
    had = !!b;
    const L = b && b.y > 860 && b.x < 960 && b.vy > -100, R = b && b.y > 860 && b.x >= 960 && b.vy > -100;
    const devL = 1, devR = g.spolu ? 2 : 1;
    key(L ? "down" : "up", "left", devL);
    key(R ? "down" : "up", "right", devR);
    step(0.03);
  }
  const g = S.game;
  console.log("robot hotov, úroveň", g && g.level, "hvězdy na stole", g && g.stars.filter((s) => s.got).length, "propadů", drains);
};
