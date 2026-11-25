/* Kuřátka (inspirace: sbírání ptáčků po patrech ze SEGA arkád 80. a 90. let).
 * Slepička běhá šipkami po patrech dvorku, OK / B / nahoru = skok. Kuřátka, kterých se dotkne,
 * jdou za ní v řadě. Dovést je do kurníku = hvězdičky. Kocour (jen Nela a Spolu) kuřátka jen
 * rozprchne zpátky po dvorku, nic víc. Kdo vyběhne z kraje, objeví se na druhé straně.
 * SPOLU = dvě slepičky. */
(function () {
  "use strict";

  const { rnd, pick } = KIT;
  const GROUND = 990;
  const LAYOUTS = [
    [
      [150, 760, 520],
      [1250, 760, 520],
      [650, 540, 620],
      [180, 330, 420],
      [1320, 330, 420],
    ],
    [
      [100, 780, 400],
      [760, 700, 400],
      [1420, 780, 400],
      [380, 500, 460],
      [1080, 500, 460],
      [730, 290, 460],
    ],
    [
      [0, 800, 380],
      [1540, 800, 380],
      [560, 720, 800],
      [200, 520, 520],
      [1200, 520, 520],
      [520, 310, 300],
      [1100, 310, 300],
    ],
  ];
  const CHICKS = { maty: [4, 5, 6], nela: [6, 7, 8], spolu: [7, 8, 9] };
  const CATS = { maty: [0, 0, 0], nela: [1, 1, 2], spolu: [1, 2, 2] };
  const COOP = { x: 1770, y: GROUND };

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#9fdcff");
    g.addColorStop(0.7, "#e6f7ff");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = "#8fd06a";
    c.beginPath();
    c.ellipse(500, 1080, 900, 360, 0, Math.PI, 0);
    c.ellipse(1600, 1080, 800, 300, 0, Math.PI, 0);
    c.fill();
    // stodola v dálce
    c.fillStyle = "#c9473a";
    c.fillRect(820, 640, 300, 220);
    c.beginPath();
    c.moveTo(800, 640);
    c.lineTo(970, 520);
    c.lineTo(1140, 640);
    c.fill();
    c.fillStyle = "#fff";
    c.fillRect(925, 740, 90, 120);
    c.fillStyle = "#7a5230";
    c.fillRect(0, GROUND, 1920, 90);
    c.fillStyle = "#6cbf4a";
    c.fillRect(0, GROUND, 1920, 18);
  }
  function plats(g) {
    return g.plats;
  }

  function loadLevel(g, n) {
    g.level = n;
    g.plats = LAYOUTS[n - 1].map(([x, y, w]) => ({ x, y, w }));
    const spots = g.plats.concat([{ x: 100, y: GROUND, w: 1500 }]);
    g.chicks = [];
    for (let k = 0; k < CHICKS[g.mode][n - 1]; k++) {
      const p = spots[k % spots.length];
      g.chicks.push({
        x: p.x + rnd(40, p.w - 40),
        y: p.y,
        home: false,
        owner: null,
        hop: rnd(0, 6),
        flee: 0,
      });
    }
    g.cats = [];
    for (let k = 0; k < CATS[g.mode][n - 1]; k++) {
      const p = g.plats[k % g.plats.length];
      g.cats.push({
        p,
        x: p.x + p.w / 2,
        dir: k % 2 ? 1 : -1,
        sp: g.mode === "nela" ? 150 : 120,
      });
    }
    g.hens.forEach((h, i) => {
      h.x = 300 + i * 200;
      h.y = GROUND;
      h.vy = 0;
      h.train = [];
      h.hist = [];
    });
    g.doneT = 0;
    KIT.toast(("Úroveň " + n).toUpperCase(), 1400);
    if (n === 1)
      KIT.at(g, 500, () =>
        KIT.sayCs("Posbírej kuřátka a doveď je do kurníku!"),
      );
  }

  function updateHen(g, h, dt) {
    const k = h.p.held;
    const sp = h.p.who === "maty" ? 360 : 420;
    const ax = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    h.x += ax * sp * dt;
    if (ax) h.face = ax;
    // za krajem na druhou stranu
    if (h.x < -60) h.x += 1980;
    if (h.x > 1980) h.x -= 1980;
    h.vy += 2600 * dt;
    const ny = h.y + h.vy * dt;
    const land = h.vy >= 0 ? landOn(g, h.x, h.y, ny) : null;
    if (land != null) {
      h.y = land;
      h.vy = 0;
      h.ground = true;
    } else {
      h.y = ny;
      h.ground = false;
    }
    // dolů = seskočit z plošiny
    if (k.down && h.ground && h.y < GROUND && !h.dropT) {
      h.y += 6;
      h.dropT = 0.25;
      h.ground = false;
    }
    if (h.dropT) h.dropT = Math.max(0, h.dropT - dt);
    if (ax || !h.ground) h.walk += dt;
    h.hist.unshift({ x: h.x, y: h.y, f: h.face });
    if (h.hist.length > 100) h.hist.pop(); // stačí na 10 kuřátek po 9 snímcích
    // kuřátka v řadě
    h.train.forEach((c, i) => {
      const p = h.hist[Math.min(h.hist.length - 1, (i + 1) * 9)];
      c.x = p.x;
      c.y = p.y;
      c.face = p.f;
    });
    // nová kuřátka
    for (const c of g.chicks)
      if (
        !c.home &&
        !c.owner &&
        c.flee <= 0 &&
        Math.abs(c.x - h.x) < 80 &&
        Math.abs(c.y - h.y) < 90
      ) {
        c.owner = h;
        h.train.push(c);
        TV.sound.ding();
        KIT.tone(1500, 0.05, 0.08, "sine", 0.06);
      }
    // kurník
    if (
      h.train.length &&
      Math.abs(h.x - COOP.x) < 120 &&
      Math.abs(h.y - COOP.y) < 60
    ) {
      for (const c of h.train) {
        c.home = true;
        c.owner = null;
        c.inT = 0;
        KIT.addStars(h.p, 1);
      }
      TV.sound.match();
      KIT.toast(h.train.length > 1 ? "Doma!" : "Pííp!", 900, "small");
      h.train = [];
    }
    // kocour
    for (const cat of g.cats) {
      if (
        Math.abs(cat.x - h.x) < 90 &&
        Math.abs(cat.p.y - h.y) < 60 &&
        !h.hurt
      ) {
        h.hurt = 1.2;
        h.vy = -700;
        KIT.tone([500, 900], 0, 0.3, "sawtooth", 0.05); // mňau
        if (h.train.length) {
          for (const c of h.train) {
            const p = pick(g.plats);
            c.owner = null;
            c.flee = 1.5;
            c.tx = p.x + rnd(40, p.w - 40);
            c.ty = p.y;
            c.fx = c.x;
            c.fy = c.y;
          }
          h.train = [];
          KIT.sayCs("Pozor na kocoura!");
        }
      }
    }
    if (h.hurt) h.hurt = Math.max(0, h.hurt - dt);
  }
  function landOn(g, x, y0, y1) {
    for (const p of plats(g))
      if (x > p.x - 20 && x < p.x + p.w + 20 && y0 <= p.y + 1 && y1 >= p.y)
        return p.y;
    if (y1 >= GROUND) return GROUND;
    return null;
  }

  KIT.game({
    title: "Kuřátka",
    res: 0.5,
    images: {
      "hen-green": "img/hen-green.png",
      "hen-pink": "img/hen-pink.png",
      chick: "img/chick.png",
      cat: "img/cat.png",
      coop: "img/coop.png",
    },
    init: paintBg,
    start(g) {
      g.hens = g.players.map((p) => ({
        p,
        x: 300,
        y: GROUND,
        vy: 0,
        face: 1,
        walk: 0,
        train: [],
        hist: [],
        ground: true,
        hurt: 0,
      }));
      loadLevel(g, 1);
    },
    key(g, p, e) {
      if (
        (e.name === "ok" || e.name === "action" || e.name === "up") &&
        e.type === "down"
      ) {
        const h = g.hens[p.idx];
        if (h.ground) {
          h.vy = h.p.who === "maty" ? -1300 : -1350;
          h.ground = false;
          TV.sound.move();
        }
      }
    },
    update(g, dt) {
      for (const c of g.chicks) {
        c.hop += dt * 5;
        if (c.flee > 0) {
          c.flee -= dt;
          const k = 1 - Math.max(0, c.flee) / 1.5;
          c.x = c.fx + (c.tx - c.fx) * k;
          c.y = c.fy + (c.ty - c.fy) * k - Math.sin(k * Math.PI) * 220;
        }
        if (c.home) c.inT += dt;
      }
      if (g.phase !== "play") return;
      for (const h of g.hens) updateHen(g, h, dt);
      for (const cat of g.cats) {
        cat.x += cat.dir * cat.sp * dt;
        if (cat.x < cat.p.x + 30 || cat.x > cat.p.x + cat.p.w - 30)
          cat.dir *= -1;
      }
      if (g.chicks.every((c) => c.home)) {
        if (g.doneT === 0) {
          for (const p of g.players) KIT.addStars(p, 3);
          TV.sound.win();
          TV.confetti(KIT.fx, 60);
          KIT.sayCs("Hurá! Všechna kuřátka jsou doma!");
        }
        g.doneT += dt;
        if (g.doneT > 2.6) {
          if (g.level >= 3) {
            g.doneT = -999;
            KIT.finish(g);
          } else loadLevel(g, g.level + 1);
        }
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      for (const p of g.plats) {
        c.fillStyle = "#a0672f";
        KIT.roundRect(c, p.x, p.y, p.w, 34, 12);
        c.fill();
        c.fillStyle = "#6cbf4a";
        KIT.roundRect(c, p.x, p.y - 6, p.w, 16, 8);
        c.fill();
      }
      if (!KIT.draw(c, "coop", COOP.x, COOP.y - 110, 240)) {
        c.fillStyle = "#c9473a";
        c.fillRect(COOP.x - 100, COOP.y - 200, 200, 200);
      }
      const waiting = g.chicks.filter((c2) => !c2.home).length;
      if (waiting)
        KIT.text(
          c,
          "⬇",
          COOP.x,
          COOP.y - 280 + Math.sin(g.t * 4) * 10,
          60,
          "#ffd23d",
        );
      for (const cat of g.cats) {
        const y = cat.p.y - 50;
        if (!KIT.draw(c, "cat", cat.x, y, 150, 0, cat.dir < 0)) {
          c.fillStyle = "#ff9d3d";
          c.beginPath();
          c.arc(cat.x, y, 40, 0, Math.PI * 2);
          c.fill();
        }
      }
      for (const ch of g.chicks) {
        if (ch.home) {
          if (ch.inT > 0.4) continue;
          c.globalAlpha = 1 - ch.inT / 0.4;
        }
        const hop = ch.owner
          ? Math.abs(Math.sin(ch.hop * 2)) * 10
          : Math.abs(Math.sin(ch.hop)) * 14;
        const face = ch.owner ? ch.face : Math.sin(ch.hop * 0.3) > 0 ? 1 : -1;
        if (!KIT.draw(c, "chick", ch.x, ch.y - 38 - hop, 76, 0, face < 0)) {
          c.fillStyle = "#ffe14d";
          c.beginPath();
          c.arc(ch.x, ch.y - 30 - hop, 26, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      for (const h of g.hens) {
        const bob = h.ground ? Math.abs(Math.sin(h.walk * 14)) * 6 : 0;
        if (h.hurt && Math.floor(g.t * 12) % 2) continue;
        const name = h.p.who === "maty" ? "hen-green" : "hen-pink";
        if (!KIT.draw(c, name, h.x, h.y - 70 - bob, 150, 0, h.face < 0)) {
          c.fillStyle = "#fff";
          c.beginPath();
          c.arc(h.x, h.y - 60, 55, 0, Math.PI * 2);
          c.fill();
        }
        if (g.spolu) KIT.drawAvatar(c, h.p.who, h.x, h.y - 175, 26);
      }
      // kolik kuřátek zbývá
      g.chicks.forEach((ch, i) => {
        c.globalAlpha = ch.home ? 1 : 0.3;
        KIT.draw(c, "chick", 960 - (g.chicks.length - 1) * 35 + i * 70, 80, 56);
        c.globalAlpha = 1;
      });
      KIT.drawStars(c, g);
    },
  });
})();
