/* Rybaření (inspirace: rybářské hry SEGA Dreamcastu, pro malé děti).
 * Loďka na jezeře: šipky vlevo/vpravo pojíždí, OK / B nahodí háček. Šipky nahoru/dolů vedou háček
 * hloubkou. Když ryba zabere, ukáže se „!“ - zmáčkni tlačítko, a pak ťukáním tlačítka navíjej.
 * Nic se nepokazí: utečená ryba za chvíli zabere znovu. Občas se chytí bota nebo krab (legrace).
 * Úlovky se sbírají do alba nahoře. Maty: ryby berou hned a navíjí se rychle. SPOLU = dvě loďky. */
(function () {
  "use strict";

  const { rnd, pick, clamp } = KIT;
  const SURF = 380,
    BOTTOM = 1040;
  const KINDS = [
    { img: "fish-green", w: 150, name: "Zelená rybka!" },
    { img: "fish-pink", w: 150, name: "Růžová rybka!" },
    { img: "fish-yellow", w: 140, name: "Žlutá rybka!" },
    { img: "fish-blue", w: 160, name: "Modrá rybka!" },
    { img: "fish-orange", w: 150, name: "Oranžová rybka!" },
    { img: "fish-purple", w: 150, name: "Fialová rybka!" },
    { img: "puffer", w: 140, name: "Ježík!", rare: true },
    { img: "crab", w: 120, name: "Krab!", bottom: true },
    { img: "boot", w: 120, name: "Stará bota!", bottom: true, junk: true },
    { img: "starfish", w: 110, name: "Hvězdice!", bottom: true },
  ];
  const NEED = { maty: 5, nela: 8, spolu: 10 };

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const sky = c.createLinearGradient(0, 0, 0, SURF);
    sky.addColorStop(0, "#7cc8ff");
    sky.addColorStop(1, "#d8f2ff");
    c.fillStyle = sky;
    c.fillRect(0, 0, 1920, SURF);
    c.fillStyle = "#fff59a";
    c.beginPath();
    c.arc(1700, 110, 70, 0, Math.PI * 2);
    c.fill();
    // les na druhém břehu
    c.fillStyle = "#4f9a3a";
    for (let x = 0; x < 1920; x += 70) {
      c.beginPath();
      c.moveTo(x, SURF);
      c.lineTo(x + 35, SURF - 90 - (x % 3) * 20);
      c.lineTo(x + 70, SURF);
      c.fill();
    }
    const w = c.createLinearGradient(0, SURF, 0, 1080);
    w.addColorStop(0, "#4fc1f0");
    w.addColorStop(1, "#145a9a");
    c.fillStyle = w;
    c.fillRect(0, SURF, 1920, 1080 - SURF);
    c.fillStyle = "#d9c080";
    c.fillRect(0, BOTTOM, 1920, 60);
    for (let x = 40; x < 1920; x += 160) {
      c.strokeStyle = "#2f8a3a";
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(x, BOTTOM);
      c.quadraticCurveTo(x + 30, BOTTOM - 80, x - 10, BOTTOM - 160);
      c.stroke();
    }
  }

  function spawnFish(g) {
    let k = pick(KINDS);
    if (k.rare && Math.random() < 0.6) k = KINDS[0];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = k.bottom ? BOTTOM - 40 : rnd(SURF + 120, BOTTOM - 120);
    g.fish.push({
      k,
      x: dir > 0 ? -150 : 2070,
      y,
      dir,
      sp: k.bottom ? rnd(25, 50) : rnd(70, 150),
      ph: rnd(0, 6),
      hooked: null,
      interest: 0,
    });
  }
  function makeBoat(p, x) {
    return {
      p,
      x,
      state: "idle",
      hx: x + 120,
      hy: SURF - 120,
      fish: null,
      biteT: 0,
      reel: 0,
      showT: 0,
    };
  }
  const rodTip = (b) => ({ x: b.x + 130, y: SURF - 150 });

  function updateBoat(g, b, dt) {
    const h = b.p.held;
    const maty = b.p.who === "maty";
    const tip = rodTip(b);
    if (b.state === "idle") {
      const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0);
      const lim = g.spolu ? (b.p.idx ? [1000, 1760] : [80, 840]) : [80, 1700];
      b.x = clamp(b.x + ax * 300 * dt, lim[0], lim[1]);
      b.hx = tip.x;
      b.hy = tip.y + 40;
    } else if (b.state === "sink") {
      const ay = (h.down ? 1 : 0) - (h.up ? 1 : 0);
      b.hy = clamp(b.hy + (ay ? ay * 300 : 60) * dt, SURF + 20, BOTTOM - 30);
      const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0);
      b.hx = clamp(b.hx + ax * 220 * dt, b.x - 250, b.x + 450);
      if (h.up && b.hy <= SURF + 25) b.state = "idle";
      // ryba si všimne háčku
      for (const f of g.fish) {
        if (f.hooked) continue;
        const d = Math.hypot(f.x - b.hx, f.y - b.hy);
        if (d < (maty ? 220 : 160)) {
          f.interest += dt;
          f.x += Math.sign(b.hx - f.x) * 80 * dt;
          f.y += Math.sign(b.hy - f.y) * 60 * dt;
          if (f.interest > (maty ? 0.4 : 1.1) && d < 90) {
            f.hooked = b;
            b.fish = f;
            b.state = "bite";
            b.biteT = 0;
            TV.sound.beep();
          }
          f.near = true;
        }
      }
    } else if (b.state === "bite") {
      b.biteT += dt;
      b.fish.x = b.hx + Math.sin(g.t * 20) * 10;
      b.fish.y = b.hy;
      if (b.biteT > (maty ? 5 : 2.5)) {
        // nestihl: ryba se pustí a odplave (zkusí to znovu)
        b.fish.hooked = null;
        b.fish.interest = -1.5;
        b.fish = null;
        b.state = "sink";
      }
    } else if (b.state === "reel") {
      // ryba táhne dolů, ťukání vytahuje
      if (!maty) b.hy = Math.min(BOTTOM - 30, b.hy + 70 * dt);
      b.hx += (tip.x - b.hx) * Math.min(1, dt * 1.5);
      b.fish.x = b.hx + Math.sin(g.t * 14) * 14;
      b.fish.y = b.hy + 30;
      if (b.hy <= SURF - 40) caught(g, b);
    } else if (b.state === "show") {
      b.showT += dt;
      if (b.showT > 1.8) {
        b.state = "idle";
        b.fish = null;
      }
    }
  }
  function caught(g, b) {
    const f = b.fish;
    b.state = "show";
    b.showT = 0;
    g.fish.splice(g.fish.indexOf(f), 1);
    KIT.addStars(b.p, f.k.junk ? 1 : f.k.rare ? 4 : 2);
    g.count++;
    if (!g.album.includes(f.k.img)) g.album.push(f.k.img);
    TV.sound.match();
    KIT.noise(0, 0.4, 0.2, 700);
    KIT.sayCs(f.k.junk ? "Stará bota! Ha ha!" : f.k.name);
    if (g.count >= g.need && !g.over) {
      g.over = true;
      KIT.at(g, 2000, () => KIT.finish(g));
    }
  }

  KIT.game({
    title: "Rybaření",
    res: 0.5,
    images: Object.assign(
      { boat: "img/boat.png", boot: "img/boot.png", crab: "img/crab.png" },
      Object.fromEntries(
        [
          "fish-green",
          "fish-pink",
          "fish-yellow",
          "fish-blue",
          "fish-orange",
          "fish-purple",
          "puffer",
          "starfish",
        ].map((n) => [n, "../rybicky/img/" + n + ".png"]),
      ),
    ),
    init: paintBg,
    start(g) {
      g.boats = g.players.map((p, i) =>
        makeBoat(p, g.spolu ? (i ? 1250 : 330) : 760),
      );
      g.fish = [];
      for (let k = 0; k < 7; k++) {
        spawnFish(g);
        g.fish[k].x = rnd(100, 1820);
      }
      g.count = 0;
      g.need = NEED[g.mode];
      g.album = [];
      g.over = false;
    },
    go(g) {
      KIT.sayCs(
        g.mode === "maty"
          ? "Zmáčkni tlačítko a nahoď udici!"
          : "Nahoď udici a chyť rybu!",
      );
    },
    key(g, p, e) {
      if (!(e.name === "ok" || e.name === "action") || e.type !== "down")
        return;
      const b = g.boats[p.idx];
      if (b.state === "idle") {
        b.state = "sink";
        b.hx = rodTip(b).x + 60;
        b.hy = SURF + 30;
        KIT.noise(0, 0.2, 0.15, 1200);
      } else if (b.state === "bite") {
        b.state = "reel";
        TV.sound.flip();
        KIT.sayCs("Navíjej!");
      } else if (b.state === "reel") {
        b.hy -= b.p.who === "maty" ? 110 : 70;
        KIT.tone(
          300 + Math.max(0, BOTTOM - b.hy) * 0.6,
          0,
          0.06,
          "square",
          0.04,
        );
      }
    },
    update(g, dt) {
      for (const f of g.fish) {
        if (f.hooked) continue;
        f.ph += dt;
        f.x += f.dir * f.sp * dt;
        if (!f.k.bottom) f.y += Math.sin(f.ph * 1.5) * 20 * dt;
        if (f.interest < 0) f.interest += dt;
      }
      g.fish = g.fish.filter((f) => f.hooked || (f.x > -200 && f.x < 2120));
      while (g.fish.length < 7) spawnFish(g);
      for (const f of g.fish) f.near = false;
      if (g.phase === "play") for (const b of g.boats) updateBoat(g, b, dt);
      // zájem o háček opadá jen rybám, které nejsou u žádného háčku (SPOLU = dva háčky)
      for (const f of g.fish) if (!f.near && f.interest > 0) f.interest = Math.max(0, f.interest - dt);
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      for (const f of g.fish) {
        const flip = f.hooked ? false : f.dir < 0;
        // obrázky ryb z Rybiček koukají doprava
        if (
          !KIT.draw(
            c,
            f.k.img,
            f.x,
            f.y,
            f.k.w,
            0,
            f.k.bottom ? false : flip,
            f.hooked ? -0.5 : 0,
          )
        ) {
          c.fillStyle = "#ffb03d";
          c.beginPath();
          c.ellipse(f.x, f.y, f.k.w / 2, f.k.w / 4, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const b of g.boats) {
        const tip = rodTip(b);
        const rock = Math.sin(g.t * 2 + b.x) * 4;
        // vlasec
        if (b.state !== "idle") {
          c.strokeStyle = "rgba(255,255,255,0.9)";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(tip.x, tip.y + rock);
          c.lineTo(b.hx, b.hy);
          c.stroke();
          c.fillStyle = "#e14b3b";
          c.beginPath();
          c.arc(b.hx, b.hy - 6, 9, 0, Math.PI * 2);
          c.fill();
        }
        if (!KIT.draw(c, "boat", b.x + 40, SURF - 40 + rock, 330)) {
          c.fillStyle = "#8a5a2b";
          c.fillRect(b.x - 120, SURF - 60, 300, 60);
        }
        KIT.drawAvatar(c, b.p.who, b.x, SURF - 120 + rock, 52);
        if (b.state === "bite")
          KIT.text(
            c,
            "!",
            b.hx,
            b.hy - 90 - Math.abs(Math.sin(g.t * 10)) * 20,
            120,
            "#ffd23d",
          );
        if (b.state === "reel")
          KIT.text(c, "ŤUK ŤUK!", b.x + 60, SURF - 260, 56, b.p.color);
        if (b.state === "show" && b.fish) {
          const k = Math.min(1, b.showT * 3);
          c.fillStyle = "rgba(255,255,255,0.85)";
          c.beginPath();
          c.arc(b.x + 60, SURF - 330, 120 * k, 0, Math.PI * 2);
          c.fill();
          KIT.draw(c, b.fish.k.img, b.x + 60, SURF - 330, b.fish.k.w * 1.2 * k);
        }
      }
      // album úlovků
      g.album.forEach((n, i) => KIT.draw(c, n, 520 + i * 85, 70, 76));
      KIT.text(c, g.count + " / " + g.need, 1420, 72, 54, "#fff");
      KIT.drawStars(c, g);
    },
  });
})();
