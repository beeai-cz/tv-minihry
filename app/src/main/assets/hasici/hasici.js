/* Hasiči (inspirace: rozvážení po městě ve stylu Crazy Taxi, ale s hasičským autem).
 * Městečko na jedné obrazovce. V některém domku hoří, tečky na silnici ukazují cestu. Auto jede
 * šipkami po silnicích, u hořícího domku se drží OK nebo B a stříká se voda. Nela má navíc
 * nádrž (doplní se u hydrantu) a plamínky v různých oknech: šipkami vlevo/vpravo se míří.
 * Občas uvízne koťátko na stromě: dojet ke stromu a zmáčknout tlačítko = žebřík.
 * Jinde tlačítko zahouká sirénou. SPOLU = dvě auta, požáry jsou společné. */
(function () {
  "use strict";

  const T = 120;
  // '=' silnice, 'h' silnice s hydrantem, 'B' domek, 'S' hasičská zbrojnice, 'T' strom, 'P' park (tráva)
  const MAP = [
    "TTPPTTPPPPTTPPTT",
    "Th===========h=T",
    "T=BB=BBB=BBBB=BT",
    "T=BB=BBB=BBBB=BT",
    "T====h=========T",
    "T=SBB=BB=TT=BB=T",
    "T=BBB=BB=TT=BB=T",
    "Th=====h=======T",
    "TTPPTTPPTTPPTTPT",
  ];
  const W = 16,
    H = 9;
  const GOALS = { maty: [3, 3, 4], nela: [4, 5, 6], spolu: [4, 5, 6] };
  const SPEED = { maty: 230, nela: 290 };
  const SPRAY = { maty: 0.5, nela: 0.6 }; // kolik ohně za sekundu uhasí
  const TANK = 8; // sekund stříkání na plnou nádrž (jen Nela)
  const DX = [0, 1, 0, -1],
    DY = [-1, 0, 1, 0];
  const { rnd, irnd, pick } = KIT;

  const tile = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "T" : MAP[y][x]);
  const road = (x, y) => "=h".includes(tile(x, y));
  const HOUSES = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (
        tile(x, y) === "B" &&
        [0, 1, 2, 3].some((d) => road(x + DX[d], y + DY[d]))
      )
        HOUSES.push({ x, y });
  const TREES = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (
        tile(x, y) === "T" &&
        [0, 1, 2, 3].some((d) => road(x + DX[d], y + DY[d]))
      )
        TREES.push({ x, y });
  const ROOF = [
    "#e14b3b",
    "#3f8fe0",
    "#f0a030",
    "#8a5ad8",
    "#2fb07a",
    "#e05a9a",
  ];

  // ---------- pozadí (silnice, domky, stromy) ----------
  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    c.fillStyle = "#7fcf5a";
    c.fillRect(0, 0, 1920, 1080);
    let s = 9;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ch = tile(x, y),
          px = x * T,
          py = y * T;
        if (road(x, y)) {
          c.fillStyle = "#6d7380";
          c.fillRect(px, py, T, T);
          c.fillStyle = "#fff";
          // přerušovaná čára uprostřed
          const hz = road(x - 1, y) || road(x + 1, y),
            vt = road(x, y - 1) || road(x, y + 1);
          if (hz && !vt)
            for (let k = 0; k < 3; k++)
              c.fillRect(px + 10 + k * 40, py + T / 2 - 3, 22, 6);
          if (vt && !hz)
            for (let k = 0; k < 3; k++)
              c.fillRect(px + T / 2 - 3, py + 10 + k * 40, 6, 22);
        } else if (ch === "B" || ch === "S") {
          c.fillStyle = "#cfe9b8";
          c.fillRect(px, py, T, T);
          if (ch === "S") continue; // zbrojnice se kreslí zvlášť (obrázek)
          const col = ROOF[(x * 7 + y * 3) % ROOF.length];
          c.fillStyle = "#f4e3c8";
          c.fillRect(px + 14, py + 18, T - 28, T - 30);
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(px + 6, py + 52);
          c.lineTo(px + T / 2, py + 10);
          c.lineTo(px + T - 6, py + 52);
          c.closePath();
          c.fill();
          c.fillStyle = "rgba(0,0,0,0.15)";
          c.beginPath();
          c.moveTo(px + T / 2, py + 10);
          c.lineTo(px + T - 6, py + 52);
          c.lineTo(px + T / 2, py + 52);
          c.closePath();
          c.fill();
          c.fillStyle = "#7fd0ff";
          c.fillRect(px + 26, py + 62, 22, 20);
          c.fillRect(px + T - 48, py + 62, 22, 20);
          c.fillStyle = "#8a5a2b";
          c.fillRect(px + T / 2 - 10, py + 78, 20, 30);
        } else {
          c.fillStyle = (x + y) % 2 ? "#84d45e" : "#7acb55";
          c.fillRect(px, py, T, T);
          if (ch === "T") {
            c.fillStyle = "#6b4a2a";
            c.fillRect(px + T / 2 - 7, py + 60, 14, 40);
            c.fillStyle = "#3a9b38";
            c.beginPath();
            c.arc(px + T / 2, py + 50, 40, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = "#4fb54a";
            c.beginPath();
            c.arc(px + T / 2 - 12, py + 40, 22, 0, Math.PI * 2);
            c.fill();
          } else {
            for (let k = 0; k < 4; k++) {
              c.fillStyle = ["#fff", "#ffd23d", "#ff8fb8"][k % 3];
              c.beginPath();
              c.arc(px + r() * T, py + r() * T, 6, 0, Math.PI * 2);
              c.fill();
            }
          }
        }
      }
  }

  // ---------- auta ----------
  function makeTruck(p, x, y, d) {
    return {
      p,
      who: p.who,
      x: x * T + T / 2,
      y: y * T + T / 2,
      tx: x,
      ty: y,
      d,
      moving: false,
      ang: (d * Math.PI) / 2,
      water: TANK,
      spray: 0,
      aim: 1,
      sirenT: 0,
      path: [],
    };
  }
  function wantDir(p) {
    const h = p.held;
    if (h.up) return 0;
    if (h.right) return 1;
    if (h.down) return 2;
    if (h.left) return 3;
    return -1;
  }
  function moveTruck(g, tr, dt) {
    const sp = SPEED[tr.who];
    const want = wantDir(tr.p);
    // s drženým tlačítkem auto dojede do středu políčka a zastaví (stříká nebo houká), šipky pak míří
    const holding = tr.spray > 0 || tr.p.held.ok || tr.p.held.action;
    const cx = tr.tx * T + T / 2,
      cy = tr.ty * T + T / 2;
    let left = sp * dt;
    // otočit zpátky jde kdykoli
    if (!holding && want >= 0 && want === (tr.d + 2) % 4 && tr.moving) {
      tr.d = want;
      tr.tx += DX[want];
      tr.ty += DY[want];
      tr.path = pathTo(g, tr);
    }
    while (left > 0) {
      const tx = tr.tx * T + T / 2,
        ty = tr.ty * T + T / 2;
      const dist = Math.hypot(tx - tr.x, ty - tr.y);
      if (dist > 0.5) {
        tr.moving = true;
        if (left < dist) {
          // do středu dlaždice to tento snímek nedojede
          tr.x += ((tx - tr.x) * left) / dist;
          tr.y += ((ty - tr.y) * left) / dist;
          break;
        }
        left -= dist;
        tr.x = tx;
        tr.y = ty;
        continue;
      }
      // ve středu dlaždice: kam dál?
      tr.x = tx;
      tr.y = ty;
      if (holding) {
        tr.moving = false;
        break;
      }
      let nd = -1;
      if (want >= 0 && road(tr.tx + DX[want], tr.ty + DY[want])) nd = want;
      else if (want >= 0 && road(tr.tx + DX[tr.d], tr.ty + DY[tr.d])) nd = tr.d;
      if (nd < 0) {
        tr.moving = false;
        break;
      }
      tr.d = nd;
      tr.tx += DX[nd];
      tr.ty += DY[nd];
      onTile(g, tr);
    }
    void cx;
    void cy;
    // natočení auta plynule
    let target = (tr.d * Math.PI) / 2,
      da = target - tr.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    tr.ang += da * Math.min(1, dt * 12);
  }
  function onTile(g, tr) {
    // hydrant doplní nádrž
    if (tile(tr.tx, tr.ty) === "h" && tr.water < TANK) {
      tr.water = TANK;
      TV.sound.ding();
      if (tr.who === "nela") KIT.toast("Plno!", 900, "small");
    }
    tr.path = pathTo(g, tr);
  }
  /** Nejbližší požár / koťátko: cesta po silnici k políčku vedle něj (tečky). */
  function pathTo(g, tr) {
    const targets = new Set();
    if (tr.who !== "maty" && tr.water <= 0.01) {
      // bez vody: cesta k nejbližšímu hydrantu
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tile(x, y) === "h") targets.add(x + "," + y);
      return bfs(tr, targets);
    }
    const goals = g.fires.map((f) => [f.x, f.y]);
    if (g.kitten && !g.kitten.saved) goals.push([g.kitten.x, g.kitten.y]);
    for (const [x, y] of goals)
      for (let d = 0; d < 4; d++)
        if (road(x + DX[d], y + DY[d]))
          targets.add(x + DX[d] + "," + (y + DY[d]));
    return bfs(tr, targets);
  }
  function bfs(tr, targets) {
    if (!targets.size) return [];
    const start = tr.tx + "," + tr.ty;
    const prev = new Map([[start, null]]);
    const q = [[tr.tx, tr.ty]];
    while (q.length) {
      const [x, y] = q.shift();
      const k = x + "," + y;
      if (targets.has(k)) {
        const out = [];
        let cur = k;
        while (cur) {
          out.push(cur.split(",").map(Number));
          cur = prev.get(cur);
        }
        return out.reverse();
      }
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d],
          ny = y + DY[d],
          nk = nx + "," + ny;
        if (road(nx, ny) && !prev.has(nk)) {
          prev.set(nk, k);
          q.push([nx, ny]);
        }
      }
    }
    return [];
  }
  const adjacent = (tr, x, y) =>
    Math.abs(tr.tx - x) + Math.abs(tr.ty - y) === 1 && !tr.moving;

  // ---------- požáry ----------
  function spawnFire(g) {
    const busy = new Set(g.fires.map((f) => f.x + "," + f.y));
    const free = HOUSES.filter(
      (h) =>
        !busy.has(h.x + "," + h.y) &&
        g.trucks.every(
          (tr) => Math.abs(tr.tx - h.x) + Math.abs(tr.ty - h.y) > 3,
        ),
    );
    const h = pick(free.length ? free : HOUSES);
    const multi = g.mode !== "maty";
    g.fires.push({
      x: h.x,
      y: h.y,
      // tři okna/plamínky; Maty jen jeden velký
      flames: multi
        ? [0, 1, 2].map((k) => ({
            k,
            hp: k === 1 || Math.random() < 0.5 ? 1 : 0,
          }))
        : [{ k: 1, hp: 1 }],
      t: 0,
    });
    if (g.fires[g.fires.length - 1].flames.every((f) => f.hp <= 0))
      g.fires[g.fires.length - 1].flames[1].hp = 1;
    TV.sound.beep();
    for (const tr of g.trucks) tr.path = pathTo(g, tr);
  }
  const fireAlive = (f) => f.flames.some((fl) => fl.hp > 0);
  function siren() {
    for (let k = 0; k < 4; k++)
      KIT.tone(k % 2 ? 660 : 880, k * 0.28, 0.27, "triangle", 0.05);
  }

  function setLevel(g, n) {
    g.level = n;
    g.goal = GOALS[g.mode][n - 1];
    g.put = 0;
    g.fires = [];
    g.nextFire = 0.8;
    g.kitten = null;
    g.kittenAt = Math.max(1, Math.floor(g.goal / 2)); // po kolikátém požáru se ukáže koťátko
    KIT.toast(("Úroveň " + n).toUpperCase(), 1500);
  }
  function maxFires(g) {
    return g.mode === "maty" ? 1 : g.level >= 2 ? 2 : 1;
  }

  KIT.game({
    title: "Hasiči",
    res: 0.5,
    images: {
      truck: "img/truck.png",
      flame: "img/flame.png",
      kitten: "img/kitten.png",
      hydrant: "img/hydrant.png",
      station: "img/station.png",
      puppy: "img/puppy.png",
    },
    init: paintBg,
    start(g) {
      g.trucks = g.players.map((p, i) => makeTruck(p, i ? 5 : 1, 4, 1));
      g.drops = [];
      g.smoke = [];
      setLevel(g, 1);
    },
    go(g) {
      KIT.sayCs(
        g.spolu
          ? "Hasiči, jedeme! Uhaste požár!"
          : "Hasiči, jedeme! Uhas požár!",
      );
      siren();
    },
    key(g, p, e) {
      const tr = g.trucks[p.idx];
      if (e.type !== "down") return;
      if (e.name === "ok" || e.name === "action") {
        // koťátko na stromě
        const kt = g.kitten;
        if (kt && !kt.saved && adjacent(tr, kt.x, kt.y)) {
          kt.saved = true;
          kt.t = 0;
          KIT.addStars(tr.p, 2);
          TV.sound.match();
          KIT.toast("Mňau!", 1200, "small");
          KIT.sayCs("Koťátko je zachráněné!");
          for (const t2 of g.trucks) t2.path = pathTo(g, t2);
          return;
        }
        if (
          !g.fires.some((f) => adjacent(tr, f.x, f.y)) &&
          g.t - tr.sirenT > 1.3
        ) {
          tr.sirenT = g.t;
          siren();
        }
      }
      if ((tr.p.held.ok || tr.p.held.action) && tr.who !== "maty") {
        if (e.name === "left") tr.aim = Math.max(0, tr.aim - 1);
        if (e.name === "right") tr.aim = Math.min(2, tr.aim + 1);
      }
    },
    update(g, dt) {
      for (const d of g.drops) {
        d.t += dt;
      }
      g.drops = g.drops.filter((d) => d.t < d.life);
      for (const s of g.smoke) {
        s.t += dt;
        s.y -= 50 * dt;
        s.x += 12 * dt;
      }
      g.smoke = g.smoke.filter((s) => s.t < 1.6);
      if (g.phase !== "play") return;
      // nové požáry
      if (g.fires.length < maxFires(g) && g.put + g.fires.length < g.goal) {
        g.nextFire -= dt;
        if (g.nextFire <= 0) {
          spawnFire(g);
          g.nextFire = rnd(1.5, 3);
        }
      }
      for (const tr of g.trucks) {
        // stříkání: drží OK/B vedle hořícího domku
        const f = g.fires.find(
          (ff) => fireAlive(ff) && adjacent(tr, ff.x, ff.y),
        );
        const hold = tr.p.held.ok || tr.p.held.action;
        const hasWater = tr.who === "maty" || tr.water > 0;
        if (f && hold && hasWater) {
          if (tr.spray <= 0) {
            TV.sound.whoosh();
            // začátek stříkání: zamířit na hořící okno (další už si Nela přemíří šipkami)
            if (tr.who !== "maty" && f.flames[tr.aim].hp <= 0) tr.aim = f.flames.findIndex((x) => x.hp > 0);
          }
          tr.spray = 0.15;
          tr.fire = f;
          if (tr.who !== "maty") {
            tr.water = Math.max(0, tr.water - dt);
            if (tr.water <= 0) tr.path = pathTo(g, tr);
          }
          // trefa: Maty vždy, Nela musí mířit na hořící okno (ostatní okna se jen zalijí)
          const fl =
            tr.who === "maty"
              ? f.flames.find((x) => x.hp > 0)
              : f.flames[tr.aim];
          if (fl && fl.hp > 0) fl.hp = Math.max(0, fl.hp - SPRAY[tr.who] * dt);
          // Nela stříká na už uhašené okno: po chvilce se proud sám přesune na hořící
          if (tr.who !== "maty" && fl && fl.hp <= 0) {
            tr.deadAim = (tr.deadAim || 0) + dt;
            if (tr.deadAim > 0.8) {
              tr.aim = f.flames.findIndex((x) => x.hp > 0);
              tr.deadAim = 0;
            }
          } else tr.deadAim = 0;
          const sx = tr.x,
            sy = tr.y,
            ex = f.x * T + T / 2 + (tr.who === "maty" ? 0 : (tr.aim - 1) * 34),
            ey = f.y * T + T / 2 - 10;
          if (Math.random() < 0.9)
            g.drops.push({
              sx,
              sy,
              ex: ex + rnd(-10, 10),
              ey: ey + rnd(-10, 10),
              t: 0,
              life: 0.45,
            });
          if (!fireAlive(f)) {
            g.fires.splice(g.fires.indexOf(f), 1);
            g.put++;
            KIT.addStars(tr.p, 3);
            for (const t2 of g.trucks)
              if (t2 !== tr && adjacent(t2, f.x, f.y)) KIT.addStars(t2.p, 1);
            TV.sound.win();
            TV.confetti(KIT.fx, 40);
            KIT.toast("Uhašeno!", 1400);
            KIT.sayCs(pick(["Výborně, hasiči!", "Uhašeno!", "Paráda!"]));
            for (const t2 of g.trucks) t2.path = pathTo(g, t2);
            if (g.put === g.kittenAt && !g.kitten) {
              const t = pick(TREES);
              g.kitten = { x: t.x, y: t.y, saved: false, t: 0 };
              KIT.at(g, 1800, () => KIT.sayCs("Pomoc! Koťátko je na stromě!"));
              for (const t2 of g.trucks) t2.path = pathTo(g, t2);
            }
          }
        } else if (
          f &&
          hold &&
          !hasWater &&
          tr.spray <= 0 &&
          g.t - (tr.emptyT || 0) > 3
        ) {
          tr.emptyT = g.t;
          TV.sound.nope();
          KIT.sayCs("Došla voda. Jeď k hydrantu.");
        }
        if (tr.spray > 0) tr.spray -= dt;
        moveTruck(g, tr, dt);
      }
      for (const f of g.fires) {
        f.t += dt;
        if (Math.random() < dt * 6)
          g.smoke.push({
            x: f.x * T + T / 2 + rnd(-30, 30),
            y: f.y * T + 20,
            t: 0,
          });
      }
      if (g.kitten && g.kitten.saved) g.kitten.t += dt;
      // úroveň hotová
      const kittenOk = !g.kitten || g.kitten.saved;
      if (g.put >= g.goal && !g.fires.length && kittenOk && !g.levelDone) {
        g.levelDone = true;
        KIT.at(g, 1800, () => {
          g.levelDone = false;
          if (g.level >= 3) KIT.finish(g);
          else {
            KIT.sayCs("Hurá! Další úroveň!");
            setLevel(g, g.level + 1);
          }
        });
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      // zbrojnice, hydranty
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const ch = tile(x, y);
          if (
            ch === "S" &&
            !KIT.draw(c, "station", x * T + T / 2, y * T + T / 2, T * 1.05)
          ) {
            c.fillStyle = "#d8402f";
            c.fillRect(x * T + 10, y * T + 20, T - 20, T - 30);
            c.fillStyle = "#fff";
            c.fillRect(x * T + 30, y * T + 55, T - 60, T - 65);
          }
          if (
            ch === "h" &&
            !KIT.draw(c, "hydrant", x * T + T - 22, y * T + 30, 40)
          ) {
            c.fillStyle = "#e0302a";
            KIT.roundRect(c, x * T + T - 36, y * T + 12, 26, 40, 8);
            c.fill();
          }
        }
      // pes u zbrojnice
      KIT.draw(c, "puppy", 3 * T + T / 2, 5 * T + T / 2, 90);
      // tečky cesty
      for (const tr of g.trucks)
        tr.path.forEach(([x, y], i) => {
          if (i === 0) return;
          c.fillStyle = tr.p.color;
          c.globalAlpha = 0.55 + 0.45 * Math.sin(g.t * 6 - i * 0.7);
          c.beginPath();
          c.arc(x * T + T / 2, y * T + T / 2, 11, 0, Math.PI * 2);
          c.fill();
        });
      c.globalAlpha = 1;
      // požáry
      for (const f of g.fires) {
        const bx = f.x * T + T / 2,
          by = f.y * T + T / 2;
        c.fillStyle =
          "rgba(255,120,0," + (0.25 + 0.15 * Math.sin(g.t * 9)) + ")";
        c.beginPath();
        c.arc(bx, by, 72, 0, Math.PI * 2);
        c.fill();
        for (const fl of f.flames) {
          if (fl.hp <= 0) continue;
          const fx = bx + (f.flames.length > 1 ? (fl.k - 1) * 34 : 0);
          const s =
            (f.flames.length > 1 ? 52 : 80) *
            (0.45 + 0.55 * fl.hp) *
            (1 + 0.08 * Math.sin(g.t * 12 + fl.k));
          if (!KIT.draw(c, "flame", fx, by - s * 0.25, s))
            drawFlame(c, fx, by, s, g.t + fl.k);
        }
      }
      for (const s of g.smoke) {
        c.fillStyle = "rgba(90,90,100," + 0.45 * (1 - s.t / 1.6) + ")";
        c.beginPath();
        c.arc(s.x, s.y, 14 + s.t * 22, 0, Math.PI * 2);
        c.fill();
      }
      // koťátko
      const kt = g.kitten;
      if (kt && (!kt.saved || kt.t < 2)) {
        const x = kt.x * T + T / 2,
          y = kt.y * T + 30 + (kt.saved ? kt.t * 40 : Math.sin(g.t * 5) * 4);
        if (!KIT.draw(c, "kitten", x, y, 70)) {
          c.fillStyle = "#ff9d3d";
          c.beginPath();
          c.arc(x, y, 22, 0, Math.PI * 2);
          c.fill();
        }
        if (!kt.saved) KIT.text(c, "?", x + 40, y - 30, 40, "#fff");
      }
      // voda
      for (const d of g.drops) {
        const k = d.t / d.life;
        const x = d.sx + (d.ex - d.sx) * k,
          y = d.sy + (d.ey - d.sy) * k - Math.sin(k * Math.PI) * 50;
        c.fillStyle = "rgba(90,190,255,0.85)";
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fill();
      }
      for (const tr of g.trucks) drawTruck(c, g, tr);
      // nádrž (Nela)
      g.trucks.forEach((tr, i) => {
        if (tr.who === "maty") return;
        const x = g.spolu ? 1920 - 380 : 330,
          y = 58;
        void i;
        c.fillStyle = "rgba(0,0,0,0.4)";
        KIT.roundRect(c, x, y, 240, 44, 22);
        c.fill();
        c.fillStyle = tr.water < 1 ? "#ff6b6b" : "#4dc3ff";
        KIT.roundRect(c, x + 4, y + 4, 232 * (tr.water / TANK), 36, 18);
        c.fill();
        KIT.text(c, "💧", x - 30, y + 22, 40);
      });
      // ukazatel úrovně: domečky, které ještě zbývá uhasit
      for (let k = 0; k < g.goal; k++) {
        const x = 960 - (g.goal - 1) * 34 + k * 68;
        c.fillStyle = k < g.put ? "#3fbf3a" : "rgba(255,255,255,0.35)";
        c.beginPath();
        c.arc(x, 60, 24, 0, Math.PI * 2);
        c.fill();
        if (k < g.put) KIT.text(c, "✔", x, 62, 30, "#fff");
      }
      KIT.drawStars(c, g);
    },
  });

  function drawFlame(c, x, y, s, t) {
    c.save();
    c.translate(x, y);
    const w = Math.sin(t * 10) * s * 0.06;
    c.fillStyle = "#ff5a1f";
    c.beginPath();
    c.moveTo(-s * 0.4, s * 0.25);
    c.quadraticCurveTo(-s * 0.5, -s * 0.3, w, -s * 0.75);
    c.quadraticCurveTo(s * 0.5, -s * 0.3, s * 0.4, s * 0.25);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffd23d";
    c.beginPath();
    c.moveTo(-s * 0.22, s * 0.25);
    c.quadraticCurveTo(-s * 0.25, -s * 0.1, -w, -s * 0.4);
    c.quadraticCurveTo(s * 0.25, -s * 0.1, s * 0.22, s * 0.25);
    c.closePath();
    c.fill();
    c.restore();
  }
  function drawTruck(c, g, tr) {
    c.save();
    c.translate(tr.x, tr.y);
    c.rotate(tr.ang);
    if (!KIT.draw(c, "truck", 0, 0, 66)) {
      c.fillStyle = "#e0302a";
      KIT.roundRect(c, -34, -54, 68, 108, 14);
      c.fill();
      c.fillStyle = "#bfe8ff";
      c.fillRect(-26, -46, 52, 18);
      c.fillStyle = "#cfcfcf";
      c.fillRect(-8, -20, 16, 64);
      c.fillStyle = "#888";
      for (let k = 0; k < 5; k++) c.fillRect(-8, -16 + k * 13, 16, 3);
    }
    // pruh v barvě dítěte a blikající majáky
    c.fillStyle = tr.p.color;
    c.fillRect(-36, 8, 72, 10);
    const on = g.t - tr.sirenT < 1.2 || tr.moving ? Math.floor(g.t * 8) % 2 : 0;
    c.fillStyle = on ? "#4da3ff" : "#1b4f9c";
    c.beginPath();
    c.arc(-16, -30, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = on ? "#1b4f9c" : "#4da3ff";
    c.beginPath();
    c.arc(16, -30, 9, 0, Math.PI * 2);
    c.fill();
    c.restore();
    if (g.spolu) KIT.drawAvatar(c, tr.who, tr.x + 46, tr.y - 46, 24);
    // šipka míření (Nela u požáru)
    if (tr.spray > 0 && tr.who !== "maty" && tr.fire) {
      const ax = tr.fire.x * T + T / 2 + (tr.aim - 1) * 34;
      KIT.text(
        c,
        "▼",
        ax,
        tr.fire.y * T - 6 + Math.sin(g.t * 10) * 5,
        40,
        tr.p.color,
      );
    }
  }
})();
