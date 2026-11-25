// Robot pro tools/headless.js: drží zrychlení a skáče před překážkami.
module.exports = function (S, key, step) {
  S.game.lanes.forEach((L, i) => key("down", "right", i + 1));
  for (let i = 0; i < 4000 && S.screen === "game"; i++) {
    S.game.lanes.forEach((L, i) => {
      const o = L.objs.find((o) => !o.gone && !o.hit && o.x > L.x && o.x - L.x < 170 && !["star", "finish", "ramp", "ring"].includes(o.type));
      if (o && !L.air) {
        key("down", "ok", i + 1);
        key("up", "ok", i + 1);
      }
    });
    step(0.05);
  }
  console.log("robot hotov, zakopnutí:", S.game && S.game.lanes.map((L) => L.objs.filter((o) => o.hit).length).join("/"));
};
