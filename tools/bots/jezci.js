// Robot pro tools/headless.js: kurzorem obchází drny a odkrývá (občas šlápne na ježka, občas dá praporek).
module.exports = function (S, key, step) {
  for (let i = 0; i < 3000 && S.screen === "game"; i++) {
    const g = S.game;
    if (g.won) { step(0.2); continue; }
    const p = g.players[0];
    let target = -1;
    for (let k = 0; k < g.W * g.H; k++) if (!g.open[k] && !g.ouch[k] && !(g.placed && g.hog[k] && (g.flag[k] || k % 3))) { target = k; break; }
    if (target < 0) { step(0.2); continue; }
    const tx = target % g.W, ty = Math.floor(target / g.W);
    const n = tx > p.cx ? "right" : tx < p.cx ? "left" : ty > p.cy ? "down" : ty < p.cy ? "up" : null;
    if (n) { key("down", n); key("up", n); }
    else if (g.placed && g.hog[target]) { key("down", "action"); key("up", "action"); }
    else { key("down", "ok"); key("up", "ok"); }
    step(0.05);
  }
  console.log("robot hotov");
};
