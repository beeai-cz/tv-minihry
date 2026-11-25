/* Delfín (inspirace: podmořské putování delfína ze SEGA Mega Drive, vlastní příběh i vzhled).
 * Delfínek plave šipkami po velkém moři, OK / B = zpívá (zvukové kruhy). Zpěv ukáže schovaná
 * delfíňata a rozpustí krystalové brány. Najdi ztracená delfíňata (plavou pak za tebou) a dovez je
 * k mamince. Perly = hvězdičky. Medúza jen odstrčí. U hladiny se dá vyskočit nad vodu.
 * Maty: 2 delfíňata hned vidět, bez bran. Nela: 3 schovaná, brány. SPOLU = dva delfínci. */
(function () {
  "use strict";

  const { rnd, clamp } = KIT;
  const WW = 4200,
    WH = 2100; // svět (y = 0 je hladina)
  const SURF = 0;
  const LEVELS = 3;

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#3fb6ef");
    g.addColorStop(1, "#0b3f7a");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = "rgba(255,255,255,0.08)";
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      c.moveTo(150 + k * 300, 0);
      c.lineTo(260 + k * 300, 0);
      c.lineTo(60 + k * 300, 1080);
      c.lineTo(-60 + k * 300, 1080);
      c.fill();
    }
  }

  let seed = 1;
  const srnd = (a, b) =>
    a + ((seed = (seed * 16807) % 2147483647) / 2147483647) * (b - a);

  function buildLevel(g, n) {
    seed = 77 + n * 131;
    const maty = g.mode === "maty";
    const L = {
      rocks: [],
      pearls: [],
      jellies: [],
      babies: [],
      gates: [],
      weeds: [],
      crabs: [],
    };
    L.mom = { x: 420, y: 700 };
    // skály: sloupy ode dna
    for (let x = 900; x < WW - 300; x += srnd(420, 640)) {
      const h = srnd(350, maty ? 700 : 1050);
      for (let y = WH; y > WH - h; y -= 90)
        L.rocks.push({ x: x + srnd(-30, 30), y, r: srnd(70, 105) });
    }
    for (let k = 0; k < 26; k++)
      L.pearls.push({
        x: srnd(700, WW - 150),
        y: srnd(250, WH - 250),
        got: false,
      });
    const nj = maty ? 3 + n : 5 + n * 2;
    for (let k = 0; k < nj; k++)
      L.jellies.push({
        x: srnd(1000, WW - 200),
        y: srnd(300, WH - 400),
        ph: srnd(0, 6),
        hx: 0,
        hy: 0,
      });
    for (const j of L.jellies) {
      j.hx = j.x;
      j.hy = j.y;
    }
    const nb = maty ? 2 : 3;
    for (let k = 0; k < nb; k++) {
      const x = maty ? 1400 + k * 900 + n * 200 : 1500 + k * 1000 + n * 150;
      const y = srnd(500, WH - 350);
      L.babies.push({
        x,
        y,
        hidden: !maty,
        found: false,
        home: false,
        col: ["pink", "green", "pink"][k],
        ph: srnd(0, 6),
      });
      // Nela: první dvě delfíňata za krystalovou bránou
      if (!maty && k < 2) L.gates.push({ x, y, r: 150, hp: 1 }); // delfíně uvnitř krystalu
    }
    // pojistka: perly ani delfíňata uvnitř skal
    const inRock = (x, y, pad) =>
      L.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r + pad);
    for (const p of L.pearls) while (inRock(p.x, p.y, 40)) p.y -= 120;
    for (const b of L.babies) while (inRock(b.x, b.y, 80)) b.y -= 120;
    for (const gt of L.gates)
      gt.y = L.babies.find((b) => b.x === gt.x).y;
    for (let x = 100; x < WW; x += srnd(140, 260))
      L.weeds.push({ x, h: srnd(140, 260) });
    for (let k = 0; k < 6; k++)
      L.crabs.push({ x: srnd(600, WW - 200), dir: k % 2 ? 1 : -1 });
    return L;
  }

  function makeDolphin(p, k) {
    return {
      p,
      who: p.who,
      x: 560 + k * 140,
      y: 520 + k * 160,
      vx: 0,
      vy: 0,
      ang: 0,
      flip: false,
      sing: 0,
      rings: [],
      train: [],
      splashT: 0,
    };
  }
  function loadLevel(g, n) {
    g.level = n;
    g.L = buildLevel(g, n);
    g.dols = g.players.map((p, k) => makeDolphin(p, k));
    g.cam = { x: 960, y: 600, z: 1 };
    g.doneT = 0;
    KIT.toast(("Úroveň " + n).toUpperCase(), 1500);
    KIT.at(g, 600, () =>
      KIT.sayCs(
        g.mode === "maty"
          ? "Najdi ztracená delfíňata a přivez je k mamince."
          : g.spolu
            ? "Zpívejte tlačítkem a najděte ztracená delfíňata!"
            : "Zpívej tlačítkem a najdi ztracená delfíňata!",
      ),
    );
  }

  function updateDol(g, d, dt) {
    const h = d.p.held;
    const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0),
      ay = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    const inWater = d.y > SURF;
    const acc = d.who === "maty" ? 1300 : 1600,
      vmax = d.who === "maty" ? 520 : 640;
    if (inWater) {
      d.vx += ax * acc * dt;
      d.vy += ay * acc * dt;
      d.vx *= 1 - 1.6 * dt;
      d.vy *= 1 - 1.6 * dt;
      const s = Math.hypot(d.vx, d.vy);
      if (s > vmax) {
        d.vx *= vmax / s;
        d.vy *= vmax / s;
      }
    } else d.vy += 1600 * dt; // skok nad hladinu
    const wasIn = d.y > SURF;
    d.x = clamp(d.x + d.vx * dt, 80, WW - 80);
    d.y = Math.min(WH - 90, d.y + d.vy * dt);
    if (wasIn !== d.y > SURF && g.t - d.splashT > 0.4) {
      d.splashT = g.t;
      KIT.noise(0, 0.3, 0.2, 800);
      g.splash.push({ x: d.x, t: 0 });
    }
    if (Math.abs(d.vx) > 20) d.flip = d.vx < 0;
    const target = Math.atan2(d.vy, Math.abs(d.vx) + 1) * (d.flip ? -1 : 1);
    d.ang += (clamp(target, -1.1, 1.1) - d.ang) * Math.min(1, dt * 6);
    // skály
    for (const r of g.L.rocks) {
      const dx = d.x - r.x,
        dy = d.y - r.y,
        dd = Math.hypot(dx, dy);
      if (dd < r.r + 50 && dd > 0.1) {
        d.x = r.x + (dx / dd) * (r.r + 50);
        d.y = r.y + (dy / dd) * (r.r + 50);
        const vn = (d.vx * dx + d.vy * dy) / dd;
        if (vn < 0) {
          d.vx -= (vn * dx) / dd;
          d.vy -= (vn * dy) / dd;
        }
      }
    }
    // krystalové brány drží delfína venku
    for (const gt of g.L.gates) {
      if (gt.hp <= 0) continue;
      const dx = d.x - gt.x,
        dy = d.y - gt.y,
        dd = Math.hypot(dx, dy);
      if (dd < gt.r + 50) {
        d.x = gt.x + (dx / dd) * (gt.r + 50);
        d.y = gt.y + (dy / dd) * (gt.r + 50);
        d.vx *= -0.3;
        d.vy *= -0.3;
        if (g.t - (g.gateSay || -99) > 6) {
          g.gateSay = g.t;
          TV.sound.nope();
          KIT.sayCs("Zazpívej, krystal se rozpustí!");
        }
      }
    }
    // medúzy odstrčí
    for (const j of g.L.jellies) {
      const dx = d.x - j.x,
        dy = d.y - j.y,
        dd = Math.hypot(dx, dy);
      if (dd < 95 && dd > 0.1) {
        d.vx = (dx / dd) * 520;
        d.vy = (dy / dd) * 520;
        TV.sound.bump();
      }
    }
    // perly
    for (const p of g.L.pearls)
      if (!p.got && Math.hypot(p.x - d.x, p.y - d.y) < 85) {
        p.got = true;
        KIT.addStars(d.p, 1);
        TV.sound.ding();
      }
    // zpěv
    if (d.sing > 0) d.sing -= dt;
    for (const r of d.rings) r.r += 900 * dt;
    d.rings = d.rings.filter((r) => r.r < 700);
    for (const r of d.rings) {
      for (const b of g.L.babies)
        if (b.hidden && Math.abs(Math.hypot(b.x - r.x, b.y - r.y) - r.r) < 60) {
          b.hidden = false;
          TV.sound.match();
          KIT.toast("Delfíně!", 1000, "small");
        }
      for (const gt of g.L.gates)
        if (
          gt.hp > 0 &&
          Math.abs(Math.hypot(gt.x - r.x, gt.y - r.y) - r.r) < 60 + gt.r * 0.3
        ) {
          gt.hp -= 0.5;
          if (gt.hp <= 0) {
            TV.sound.win();
            g.shards.push({ x: gt.x, y: gt.y, t: 0 });
          } else TV.sound.ding();
        }
    }
    // delfíňata: najít (dotyk) a vézt v řadě za sebou
    for (const b of g.L.babies)
      if (!b.hidden && !b.found && Math.hypot(b.x - d.x, b.y - d.y) < 120) {
        b.found = true;
        d.train.push(b);
        TV.sound.match();
        KIT.sayCs("Pojď se mnou domů!");
      }
    let lead = d;
    for (const b of d.train) {
      if (b.home) continue;
      const dx = lead.x - b.x,
        dy = lead.y - b.y,
        dd = Math.hypot(dx, dy);
      if (dd > 110) {
        b.x += (dx / dd) * (dd - 110) * Math.min(1, dt * 6);
        b.y += (dy / dd) * (dd - 110) * Math.min(1, dt * 6);
      }
      b.flip = dx < 0;
      lead = b;
    }
    // u maminky
    if (Math.hypot(d.x - g.L.mom.x, d.y - g.L.mom.y) < 260)
      for (const b of d.train)
        if (!b.home) {
          b.home = true;
          b.homeT = 0;
          KIT.addStars(d.p, 3);
          TV.sound.win();
          TV.confetti(KIT.fx, 40);
          KIT.sayCs("Děkuju! Jsme zase spolu!");
        }
  }

  // ---------- kreslení ----------
  function drawDol(c, name, x, y, w, flip, ang, fallback) {
    if (KIT.draw(c, name, x, y, w, 0, flip, ang)) return;
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (flip) c.scale(-1, 1);
    c.fillStyle = fallback;
    c.beginPath();
    c.ellipse(0, 0, w * 0.45, w * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-w * 0.4, 0);
    c.lineTo(-w * 0.55, -w * 0.15);
    c.lineTo(-w * 0.55, w * 0.15);
    c.fill();
    c.restore();
  }
  function drawWorld(c, g) {
    const L = g.L;
    // kreslí se jen to, co je vidět (svět je mnohem větší než obrazovka)
    const X0 = g.cam.x - 960 / g.cam.z - 220,
      X1 = g.cam.x + 960 / g.cam.z + 220;
    const vis = (x) => x > X0 && x < X1;
    // hladina a nebe nad ní
    c.fillStyle = "#bfeaff";
    c.fillRect(-2000, -1400, WW + 4000, 1400);
    c.fillStyle = "rgba(255,255,255,0.7)";
    for (let x = Math.max(-200, Math.floor(X0 / 80) * 80); x < Math.min(WW + 200, X1); x += 80) {
      c.beginPath();
      c.arc(x + ((g.t * 40) % 80), SURF, 26, Math.PI, 0);
      c.fill();
    }
    // dno
    c.fillStyle = "#e8cf8f";
    c.fillRect(-2000, WH - 40, WW + 4000, 600);
    for (const w of L.weeds) {
      if (!vis(w.x)) continue;
      const sw = Math.sin(g.t * 1.5 + w.x) * 0.08;
      if (
        !KIT.draw(
          c,
          "seaweed",
          w.x,
          WH - 40 - w.h / 2,
          w.h * 0.55,
          w.h,
          false,
          sw,
        )
      ) {
        c.fillStyle = "#2f9a4a";
        c.fillRect(w.x - 8, WH - 40 - w.h, 16, w.h);
      }
    }
    for (const k of L.crabs) {
      if (!vis(k.x)) continue;
      const x = k.x + Math.sin(g.t * 0.7 + k.x) * 120;
      KIT.draw(c, "crab", x, WH - 70, 110);
    }
    for (const r of L.rocks) {
      if (!vis(r.x)) continue;
      c.fillStyle = "#5b6b8a";
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.beginPath();
      c.arc(r.x - r.r * 0.3, r.y - r.r * 0.3, r.r * 0.4, 0, Math.PI * 2);
      c.fill();
    }
    for (const p of L.pearls)
      if (
        !p.got &&
        vis(p.x) &&
        !KIT.draw(c, "pearl", p.x, p.y + Math.sin(g.t * 2 + p.x) * 6, 90)
      ) {
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(p.x, p.y, 18, 0, Math.PI * 2);
        c.fill();
      }
    for (const gt of L.gates) {
      if (gt.hp <= 0) continue;
      c.globalAlpha = 0.45 + 0.4 * gt.hp;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + g.t * 0.2;
        c.fillStyle = k % 2 ? "#b77cff" : "#7fe0ff";
        c.save();
        c.translate(
          gt.x + Math.cos(a) * gt.r * 0.55,
          gt.y + Math.sin(a) * gt.r * 0.55,
        );
        c.rotate(a);
        c.beginPath();
        c.moveTo(0, -60);
        c.lineTo(26, 0);
        c.lineTo(0, 60);
        c.lineTo(-26, 0);
        c.fill();
        c.restore();
      }
      c.globalAlpha = 1;
    }
    for (const s of g.shards) {
      c.globalAlpha = Math.max(0, 1 - s.t);
      for (let k = 0; k < 10; k++) {
        const a = k * 0.63;
        c.fillStyle = "#b77cff";
        c.fillRect(
          s.x + Math.cos(a) * s.t * 300,
          s.y + Math.sin(a) * s.t * 300,
          20,
          20,
        );
      }
      c.globalAlpha = 1;
    }
    for (const j of L.jellies) {
      if (!vis(j.x)) continue;
      if (!KIT.draw(c, "jelly", j.x, j.y, 130)) {
        c.fillStyle = "#c08cff";
        c.beginPath();
        c.arc(j.x, j.y, 50, Math.PI, 0);
        c.fill();
      }
    }
    // maminka
    KIT.draw(c, "dolphin", L.mom.x, L.mom.y + Math.sin(g.t * 2) * 10, 330) ||
      drawDol(c, "x", L.mom.x, L.mom.y, 330, false, 0, "#4da3ff");
    const waiting = L.babies.filter((b) => !b.home).length;
    if (waiting)
      KIT.text(
        c,
        "♥",
        L.mom.x + 30,
        L.mom.y - 150 + Math.sin(g.t * 3) * 8,
        70,
        "#ff6b9a",
      );
    for (const b of L.babies) {
      if (b.hidden) {
        // jen tušení: bublinky
        if (Math.floor(g.t * 2 + b.ph) % 3 === 0) {
          c.fillStyle = "rgba(255,255,255,0.35)";
          c.beginPath();
          c.arc(b.x + 20, b.y - 60 - ((g.t * 60) % 80), 9, 0, Math.PI * 2);
          c.fill();
        }
        continue;
      }
      let x = b.x,
        y = b.y + (b.found ? 0 : Math.sin(g.t * 3 + b.ph) * 10);
      if (b.home) {
        b.homeT = (b.homeT || 0) + 1 / 60;
        const a = g.t * 2 + b.ph;
        x = L.mom.x + Math.cos(a) * 200;
        y = L.mom.y + Math.sin(a) * 90;
        b.flip = Math.sin(a) > 0;
      }
      drawDol(
        c,
        "baby-" + b.col,
        x,
        y,
        140,
        b.flip,
        0,
        b.col === "pink" ? "#ff8fb8" : "#7bdc65",
      );
      if (!b.found) KIT.text(c, "?", x, y - 90, 54, "#fff");
    }
    for (const d of g.dols) {
      for (const r of d.rings) {
        c.strokeStyle = "rgba(255,255,255," + (1 - r.r / 700) + ")";
        c.lineWidth = 10;
        c.beginPath();
        c.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        c.stroke();
      }
      drawDol(
        c,
        "baby-" + (d.who === "maty" ? "green" : "pink"),
        d.x,
        d.y,
        230,
        d.flip,
        d.ang,
        d.p.color,
      );
      if (g.spolu) KIT.drawAvatar(c, d.who, d.x, d.y - 110, 30);
    }
    for (const s of g.splash) {
      c.fillStyle = "rgba(255,255,255," + Math.max(0, 1 - s.t * 1.5) + ")";
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.arc(
          s.x + (k - 2.5) * 30,
          SURF - Math.sin((k / 5) * Math.PI) * s.t * 200,
          12,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
  }
  function drawArrowTo(c, g, d) {
    // šipka na kraji obrazovky k cíli (delfíně nebo maminka)
    let tx, ty;
    const pend = d.train.some((b) => !b.home);
    if (pend) {
      tx = g.L.mom.x;
      ty = g.L.mom.y;
    } else {
      const b = g.L.babies
        .filter((b) => !b.found)
        .sort(
          (a, b) =>
            Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y),
        )[0];
      if (!b) return;
      tx = b.x;
      ty = b.y;
    }
    const a = Math.atan2(ty - d.y, tx - d.x);
    if (Math.hypot(tx - d.x, ty - d.y) < 700) return;
    const z = g.cam.z;
    const sx = 960 + (d.x - g.cam.x) * z + Math.cos(a) * 190,
      sy = 540 + (d.y - g.cam.y) * z + Math.sin(a) * 190;
    c.save();
    c.translate(sx, sy);
    c.rotate(a);
    c.fillStyle = pend ? "#ff6b9a" : d.p.color;
    c.globalAlpha = 0.85;
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(-20, -30);
    c.lineTo(-20, 30);
    c.fill();
    c.restore();
  }

  KIT.game({
    title: "Delfín",
    res: 0.5,
    images: {
      dolphin: "img/dolphin.png",
      "baby-pink": "img/baby-pink.png",
      "baby-green": "img/baby-green.png",
      jelly: "img/jelly.png",
      pearl: "img/pearl.png",
      seaweed: "img/seaweed.png",
      crab: "../rybareni/img/crab.png",
    },
    init: paintBg,
    start(g) {
      g.splash = [];
      g.shards = [];
      loadLevel(g, 1);
    },
    key(g, p, e) {
      if ((e.name === "ok" || e.name === "action") && e.type === "down") {
        const d = g.dols[p.idx];
        if (d.sing > 0) return;
        d.sing = 0.5;
        d.rings.push({ x: d.x, y: d.y, r: 40 });
        // zpěv delfína: tři stoupající pípnutí
        [880, 1175, 1568].forEach((f, i) =>
          KIT.tone([f, f * 1.25], i * 0.08, 0.12, "sine", 0.08),
        );
      }
    },
    update(g, dt) {
      for (const s of g.splash) s.t += dt;
      g.splash = g.splash.filter((s) => s.t < 0.8);
      for (const s of g.shards) s.t += dt;
      g.shards = g.shards.filter((s) => s.t < 1);
      for (const j of g.L.jellies) {
        j.ph += dt;
        j.x = j.hx + Math.sin(j.ph * 0.5) * 120;
        j.y = j.hy + Math.sin(j.ph * 0.9) * 90;
      }
      if (g.phase === "play") for (const d of g.dols) updateDol(g, d, dt);
      // kamera
      let mx = 0,
        my = 0;
      for (const d of g.dols) {
        mx += d.x / g.dols.length;
        my += d.y / g.dols.length;
      }
      let z = 0.8;
      if (g.dols.length > 1) {
        const dx = Math.abs(g.dols[0].x - g.dols[1].x) + 700,
          dy = Math.abs(g.dols[0].y - g.dols[1].y) + 500;
        z = Math.max(0.45, Math.min(0.8, 1920 / dx, 1080 / dy));
      }
      const k = Math.min(1, dt * 3);
      g.cam.z += (z - g.cam.z) * k;
      const hw = 960 / g.cam.z,
        hh = 540 / g.cam.z;
      g.cam.x += (clamp(mx, hw, WW - hw) - g.cam.x) * k;
      g.cam.y += (clamp(my, -300 + hh, WH + 60 - hh) - g.cam.y) * k;
      if (g.L.babies.every((b) => b.home)) {
        if (g.doneT === 0) {
          for (const p of g.players) KIT.addStars(p, 3);
          KIT.toast("Hurá!", 1500);
        }
        g.doneT += dt;
        if (g.doneT > 3) {
          if (g.level >= LEVELS) {
            g.doneT = -999;
            KIT.finish(g);
          } else {
            KIT.sayCs("Hurá! Další úroveň!");
            loadLevel(g, g.level + 1);
          }
        }
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      c.save();
      c.translate(960, 540);
      c.scale(g.cam.z, g.cam.z);
      c.translate(-g.cam.x, -g.cam.y);
      drawWorld(c, g);
      c.restore();
      for (const d of g.dols) drawArrowTo(c, g, d);
      // počítadlo delfíňat
      const B = g.L.babies;
      B.forEach((b, i) => {
        const x = 960 - (B.length - 1) * 55 + i * 110;
        c.globalAlpha = b.home ? 1 : 0.35;
        drawDol(c, "baby-" + b.col, x, 80, 90, false, 0, "#fff");
        c.globalAlpha = 1;
      });
      KIT.drawStars(c, g);
    },
  });
})();
