/* Pěnovky (inspirace: bitvy kulatých postaviček shora ve stylu českých Bulánků).
 * Zvířátka s pěnovými pistolkami na zahradě mezi bednami. Šipky = běh, OK / B = výstřel pěnovkou.
 * Zásah jen „ťukne“: zasažený se na chvilku zamotá (hvězdičky nad hlavou), střelec dostane hvězdu.
 * Hraje se proti dvěma hodným robotům (medvěd a liška), kteří střílí pomalu a nepřesně.
 * Občas se objeví trojitá střela. Konec = nasbírat daný počet zásahů. SPOLU = Maty a Nela jeden tým. */
(function () {
  "use strict";

  const { rnd, pick, clamp } = KIT;
  const R = 52; // poloměr postavičky
  const A = { x0: 40, y0: 150, x1: 1880, y1: 1050 };
  const CRATES = [
    [560, 360],
    [1360, 360],
    [960, 600],
    [560, 840],
    [1360, 840],
    [300, 600],
    [1620, 600],
  ];
  const CS = 120; // velikost bedny
  const NEED = { maty: 10, nela: 15, spolu: 20 };
  const SPEED = { maty: 340, nela: 400, bot: 210 };
  const BOT = {
    maty: { cool: [2.2, 3.4], err: 0.45, dart: 520 },
    nela: { cool: [1.4, 2.4], err: 0.28, dart: 650 },
  };
  const DIZZY = { kid: 0.8, bot: 1.6 };

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    for (let y = 0; y < 1080; y += 60)
      for (let x = 0; x < 1920; x += 60) {
        c.fillStyle = (x / 60 + y / 60) % 2 ? "#78c850" : "#82d25a";
        c.fillRect(x, y, 60, 60);
      }
    let s = 4;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 120; k++) {
      c.fillStyle = ["#fff", "#ffd23d", "#ff8fb8"][k % 3];
      c.beginPath();
      c.arc(r() * 1920, r() * 1080, 5, 0, Math.PI * 2);
      c.fill();
    }
    // plot kolem
    c.fillStyle = "#c98f4e";
    for (let x = 0; x < 1920; x += 48) {
      c.fillRect(x + 6, 118, 30, 40);
      c.fillRect(x + 6, 1052, 30, 28);
    }
    c.fillRect(0, 130, 1920, 12);
  }

  const crateHit = (x, y, r) =>
    CRATES.some(
      ([cx, cy]) =>
        Math.abs(x - cx) < CS / 2 + r && Math.abs(y - cy) < CS / 2 + r,
    );

  function makeFighter(kind, x, y, p) {
    return {
      kind,
      p,
      x,
      y,
      fx: p ? 1 : -1,
      fy: 0,
      cool: 0,
      dizzy: 0,
      hits: 0,
      walk: 0,
      tx: x,
      ty: y,
      triple: 0,
      bob: rnd(0, 6),
    };
  }
  function moveF(f, dx, dy, sp, dt) {
    const nx = clamp(f.x + dx * sp * dt, A.x0 + R, A.x1 - R),
      ny = clamp(f.y + dy * sp * dt, A.y0 + R, A.y1 - R);
    if (!crateHit(nx, f.y, R * 0.8)) f.x = nx;
    if (!crateHit(f.x, ny, R * 0.8)) f.y = ny;
    if (dx || dy) f.walk += dt;
  }
  function shoot(g, f, dx, dy, speed) {
    const l = Math.hypot(dx, dy) || 1;
    const shots = f.triple > 0 ? [-0.25, 0, 0.25] : [0];
    for (const a of shots) {
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const vx = ((dx * ca - dy * sa) / l) * speed,
        vy = ((dx * sa + dy * ca) / l) * speed;
      g.darts.push({
        x: f.x + (vx / speed) * (R + 10),
        y: f.y + (vy / speed) * (R + 10),
        vx,
        vy,
        from: f,
        t: 0,
      });
    }
    TV.sound.pew();
  }

  function updateBot(g, b, dt) {
    if (b.dizzy > 0) {
      b.dizzy -= dt;
      moveF(b, Math.cos(g.t * 6), Math.sin(g.t * 6), 40, dt);
      return;
    }
    const P = BOT[g.mode === "maty" ? "maty" : "nela"];
    // procházka k náhodnému cíli
    if (
      Math.hypot(b.tx - b.x, b.ty - b.y) < 30 ||
      (b.stuck = (b.stuck || 0) + dt) > 3
    ) {
      b.stuck = 0;
      do {
        b.tx = rnd(A.x0 + 120, A.x1 - 120);
        b.ty = rnd(A.y0 + 100, A.y1 - 100);
      } while (crateHit(b.tx, b.ty, R));
    }
    const dx = b.tx - b.x,
      dy = b.ty - b.y,
      l = Math.hypot(dx, dy) || 1;
    moveF(b, dx / l, dy / l, SPEED.bot, dt);
    b.fx = dx / l;
    b.fy = dy / l;
    b.cool -= dt;
    if (b.cool <= 0) {
      b.cool = rnd(P.cool[0], P.cool[1]);
      const kids = g.kids.filter((k) => k.dizzy <= 0);
      if (!kids.length) return;
      const k = kids.reduce((a, c) =>
        Math.hypot(c.x - b.x, c.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y)
          ? c
          : a,
      );
      if (Math.hypot(k.x - b.x, k.y - b.y) > 1000) return;
      const ang = Math.atan2(k.y - b.y, k.x - b.x) + rnd(-P.err, P.err);
      shoot(g, b, Math.cos(ang), Math.sin(ang), P.dart);
    }
  }

  function hit(g, d, f) {
    f.dizzy = f.p ? DIZZY.kid : DIZZY.bot;
    KIT.tone([900, 300], 0, 0.18, "triangle", 0.12); // ťuk
    g.pops.push({ x: f.x, y: f.y - 40, t: 0 });
    const sh = d.from;
    if (sh.p) {
      KIT.addStars(sh.p, 1);
      g.score++;
      sh.hits++;
      if (g.score % 5 === 0 && g.score < g.need)
        KIT.toast(pick(["Super!", "Trefa!", "Paráda!"]), 900, "small");
      if (g.score >= g.need && !g.over) {
        g.over = true;
        KIT.at(g, 1200, () => KIT.finish(g));
      }
    }
  }

  KIT.game({
    title: "Pěnovky",
    res: 0.5,
    images: {
      frog: "img/frog.png",
      bunny: "img/bunny.png",
      bear: "img/bear.png",
      fox: "img/fox.png",
      crate: "img/crate.png",
      dart: "img/dart.png",
    },
    init: paintBg,
    start(g) {
      g.kids = g.players.map((p, i) =>
        makeFighter(
          p.who === "maty" ? "frog" : "bunny",
          180,
          g.players.length > 1 ? (i ? 840 : 380) : 380,
          p,
        ),
      );
      g.bots = [makeFighter("bear", 1720, 380), makeFighter("fox", 1720, 820)];
      g.bots.forEach((b) => (b.cool = rnd(2, 3)));
      g.all = g.kids.concat(g.bots);
      g.darts = [];
      g.pops = [];
      g.score = 0;
      g.need = NEED[g.mode];
      g.power = null;
      g.powerT = 12;
      g.over = false;
    },
    go(g) {
      KIT.sayCs("Jdeme na to!");
    },
    key(g, p, e) {
      const k = g.kids[p.idx];
      if (
        (e.name === "ok" || e.name === "action") &&
        e.type === "down" &&
        k.dizzy <= 0 &&
        k.cool <= 0
      ) {
        shoot(g, k, k.fx, k.fy, 1000);
        k.cool = 0.3;
      }
    },
    update(g, dt) {
      for (const pp of g.pops) pp.t += dt;
      g.pops = g.pops.filter((pp) => pp.t < 0.7);
      if (g.phase !== "play") return;
      for (const k of g.kids) {
        if (k.cool > 0) k.cool -= dt;
        if (k.triple > 0) k.triple -= dt;
        if (k.dizzy > 0) {
          k.dizzy -= dt;
          continue;
        }
        const h = k.p.held;
        const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0),
          ay = (h.down ? 1 : 0) - (h.up ? 1 : 0);
        const l = Math.hypot(ax, ay);
        if (l) {
          k.fx = ax / l;
          k.fy = ay / l;
          moveF(k, ax / l, ay / l, SPEED[k.p.who], dt);
        }
        if (g.power && Math.hypot(g.power.x - k.x, g.power.y - k.y) < R + 40) {
          g.power = null;
          k.triple = 8;
          TV.sound.match();
          KIT.sayCs("Trojitá střela!");
        }
      }
      for (const b of g.bots) updateBot(g, b, dt);
      // pěnovky
      for (const d of g.darts) {
        d.t += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (
          d.x < A.x0 ||
          d.x > A.x1 ||
          d.y < A.y0 - 20 ||
          d.y > A.y1 ||
          crateHit(d.x, d.y, 4) ||
          d.t > 2.5
        ) {
          d.dead = true;
          continue;
        }
        for (const f of g.all) {
          if (f === d.from || f.dizzy > 0) continue;
          if (!!f.p === !!d.from.p) continue; // spoluhráče netrefíš
          if (Math.hypot(f.x - d.x, f.y - d.y) < R) {
            d.dead = true;
            hit(g, d, f);
            break;
          }
        }
      }
      g.darts = g.darts.filter((d) => !d.dead);
      // trojitá střela občas na zemi
      g.powerT -= dt;
      if (!g.power && g.powerT <= 0) {
        g.powerT = rnd(14, 20);
        let x, y;
        do {
          x = rnd(300, 1620);
          y = rnd(250, 950);
        } while (crateHit(x, y, 60));
        g.power = { x, y };
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      for (const [x, y] of CRATES)
        if (!KIT.draw(c, "crate", x, y, CS, CS)) {
          c.fillStyle = "#b07a45";
          c.fillRect(x - CS / 2, y - CS / 2, CS, CS);
        }
      if (g.power) {
        const s = 1 + Math.sin(g.t * 6) * 0.1;
        c.fillStyle = "#ffd23d";
        c.beginPath();
        c.arc(g.power.x, g.power.y, 40 * s, 0, Math.PI * 2);
        c.fill();
        for (const a of [-0.4, 0, 0.4])
          KIT.draw(
            c,
            "dart",
            g.power.x,
            g.power.y,
            50,
            0,
            false,
            -Math.PI / 4 + a,
          );
      }
      const order = g.all.slice().sort((a, b) => a.y - b.y);
      for (const f of order) {
        const bob = Math.abs(Math.sin(f.walk * 10)) * 8;
        c.fillStyle = "rgba(0,0,0,0.2)";
        c.beginPath();
        c.ellipse(f.x, f.y + R * 0.9, R * 0.9, R * 0.3, 0, 0, Math.PI * 2);
        c.fill();
        const rot = f.dizzy > 0 ? Math.sin(g.t * 20) * 0.25 : 0;
        if (f.p) {
          c.strokeStyle = f.p.color;
          c.lineWidth = 8;
          c.beginPath();
          c.ellipse(f.x, f.y + R * 0.9, R, R * 0.36, 0, 0, Math.PI * 2);
          c.stroke();
        }
        if (
          !KIT.draw(c, f.kind, f.x, f.y - bob, R * 2.5, 0, f.fx < -0.1, rot)
        ) {
          c.fillStyle = {
            frog: "#5cc93b",
            bunny: "#ff8fb8",
            bear: "#4da3ff",
            fox: "#ff8a3d",
          }[f.kind];
          c.beginPath();
          c.arc(f.x, f.y - bob, R, 0, Math.PI * 2);
          c.fill();
        }
        if (f.p && f.triple > 0)
          KIT.text(c, "×3", f.x + 50, f.y - 70, 34, "#ffd23d");
        if (f.dizzy > 0)
          for (let k = 0; k < 3; k++) {
            const a = g.t * 6 + (k * Math.PI * 2) / 3;
            KIT.text(
              c,
              "★",
              f.x + Math.cos(a) * 40,
              f.y - 80 + Math.sin(a) * 12,
              30,
              "#ffd23d",
            );
          }
        // kam míří dítě
        if (f.p && f.dizzy <= 0) {
          c.fillStyle = f.p.color;
          c.beginPath();
          const ax = f.x + f.fx * (R + 34),
            ay = f.y + f.fy * (R + 34);
          c.arc(ax, ay, 9, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const d of g.darts) {
        const a = Math.atan2(d.vy, d.vx);
        if (!KIT.draw(c, "dart", d.x, d.y, 56, 0, false, a + Math.PI / 4)) {
          c.fillStyle = "#ff8a3d";
          c.beginPath();
          c.arc(d.x, d.y, 10, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const pp of g.pops)
        KIT.text(c, "ŤUK!", pp.x, pp.y - pp.t * 60, 46 * (1 + pp.t), "#fff");
      // ukazatel: kolik zásahů zbývá
      const bw = 700,
        bx = 960 - bw / 2;
      c.fillStyle = "rgba(0,0,0,0.35)";
      KIT.roundRect(c, bx, 60, bw, 40, 20);
      c.fill();
      c.fillStyle = "#ffd23d";
      KIT.roundRect(c, bx, 60, bw * Math.min(1, g.score / g.need), 40, 20);
      c.fill();
      KIT.drawStars(c, g);
    },
  });
})();
