// Robot pro tools/headless.js: po „Teď ty!“ zopakuje řadu (občas schválně splete první pohyb).
module.exports = function (S, key, step) {
  const K = { left: "left", right: "right", up: "up", down: "down", clap: "ok" };
  let oops = 0;
  for (let i = 0; i < 5000 && S.screen === "game"; i++) {
    const g = S.game;
    if (g.state === "go") {
      g.dancers.forEach((d, idx) => {
        if (d.done) return;
        let m = g.seq[d.pos];
        if (Math.random() < 0.05) { m = m === "left" ? "right" : "left"; oops++; }
        key("down", K[m], idx + 1); key("up", K[m], idx + 1);
      });
    }
    step(0.25);
  }
  console.log("robot hotov, kolo", S.game && S.game.round, "chyb", oops);
};
