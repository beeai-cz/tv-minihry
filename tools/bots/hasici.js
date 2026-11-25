// Robot pro tools/headless.js: jede po tečkách k požáru, hasí, zachraňuje koťátko.
module.exports = function (S, key, step) {
  const DIRS = ["up", "right", "down", "left"];
  let held = null;
  for (let i = 0; i < 9000 && S.screen === "game"; i++) {
    const g = S.game,
      tr = g.trucks[0];
    const fire = g.fires.find(
      (f) => Math.abs(f.x - tr.tx) + Math.abs(f.y - tr.ty) === 1,
    );
    const kt =
      g.kitten &&
      !g.kitten.saved &&
      Math.abs(g.kitten.x - tr.tx) + Math.abs(g.kitten.y - tr.ty) === 1;
    const dry = tr.who !== "maty" && tr.water <= 0.01;
    if (((fire && !dry) || kt) && !tr.moving) {
      if (held) (key("up", held), (held = null));
      if (kt) {
        key("down", "ok");
        key("up", "ok");
      } else {
        key("down", "ok");
        if (tr.who !== "maty") {
          const live = fire.flames.findIndex((f) => f.hp > 0);
          while (tr.aim < live)
            (key("down", "right"), key("up", "right"), step(0.02));
          while (tr.aim > live)
            (key("down", "left"), key("up", "left"), step(0.02));
        }
        step(0.3);
        key("up", "ok");
      }
      step(0.05);
      continue;
    }
    const p = tr.path;
    let want = null;
    if (p.length > 1) {
      const [nx, ny] = p[1];
      const dx = nx - tr.tx,
        dy = ny - tr.ty;
      want = DIRS[dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3];
      if (!dx && !dy) want = null;
    }
    if (want !== held) {
      if (held) key("up", held);
      if (want) key("down", want);
      held = want;
    }
    step(0.1);
  }
  console.log(
    "robot hotov, put:",
    S.game && S.game.put,
    "úroveň",
    S.game && S.game.level,
  );
};
