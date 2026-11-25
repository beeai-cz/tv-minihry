/* Fotbal a hokej (inspirace: sportovní hry SEGA 90. let, hřiště shora).
 * Varianta Fotbal (tráva) nebo Hokej (led: hráč i puk kloužou). Dítě běhá šipkami, míč se mu lepí
 * k noze, OK / B = střela. V bráně je hodný brankář (medvěd), Nele navíc překážejí dva pomalí
 * obránci (lišky), kteří míč jen odkopnou. Gól = oslava a hvězdičky. Nikdo neprohrává, hraje se
 * do daného počtu gólů. SPOLU = Maty a Nela v jednom týmu. */
(function () {
  "use strict";

  const { rnd, clamp } = KIT;
  const F = { x0: 60, y0: 170, x1: 1860, y1: 1040 }; // hřiště
  const MIDY = (F.y0 + F.y1) / 2;
  const PR = 46; // poloměr hráče
  const GOALS = { maty: 4, nela: 6, spolu: 6 };
  const MOUTH = {
    fotbal: { maty: 400, nela: 300 },
    hokej: { maty: 340, nela: 250 },
  };
  const KEEPER = { maty: 110, nela: 190 }; // rychlost brankáře
  const SPEED = { maty: 330, nela: 400 };
  const SHOT = { maty: 1150, nela: 1350 };

  function paintPitch(c, w, h, hokej) {
    const kx = w / 1920,
      ky = h / 1080;
    c.save();
    c.scale(kx, ky);
    if (hokej) {
      c.fillStyle = "#cfe0ea";
      c.fillRect(0, 0, 1920, 1080);
      c.fillStyle = "#eef7fc";
      KIT.roundRect(c, F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0, 120);
      c.fill();
      c.lineWidth = 10;
      c.strokeStyle = "#3a6fb0";
      c.stroke();
      c.fillStyle = "rgba(225,60,60,0.85)";
      c.fillRect(958, F.y0, 10, F.y1 - F.y0);
      c.fillStyle = "rgba(58,111,176,0.8)";
      c.fillRect(600, F.y0, 12, F.y1 - F.y0);
      c.fillRect(1310, F.y0, 12, F.y1 - F.y0);
      c.strokeStyle = "rgba(225,60,60,0.85)";
      c.lineWidth = 8;
      c.beginPath();
      c.arc(960, MIDY, 120, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = "rgba(120,190,255,0.35)";
      c.beginPath();
      c.arc(F.x1 - 10, MIDY, 170, Math.PI / 2, Math.PI * 1.5);
      c.fill();
      // odlesky ledu
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 4;
      for (let k = 0; k < 30; k++) {
        const x = 150 + ((k * 397) % 1600),
          y = 230 + ((k * 211) % 760);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 60, y - 14);
        c.stroke();
      }
    } else {
      for (let k = 0; k < 12; k++) {
        c.fillStyle = k % 2 ? "#5cb83a" : "#66c443";
        c.fillRect((k * 1920) / 12, 0, 1920 / 12 + 1, 1080);
      }
      c.strokeStyle = "#fff";
      c.lineWidth = 8;
      c.strokeRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
      c.beginPath();
      c.moveTo(960, F.y0);
      c.lineTo(960, F.y1);
      c.stroke();
      c.beginPath();
      c.arc(960, MIDY, 120, 0, Math.PI * 2);
      c.stroke();
      c.strokeRect(F.x1 - 260, MIDY - 260, 260, 520);
      c.strokeRect(F.x1 - 100, MIDY - 150, 100, 300);
      c.strokeRect(F.x0, MIDY - 260, 260, 520);
    }
    c.restore();
  }
  let bg = {};
  function paintBg(v) {
    const cv = document.createElement("canvas");
    cv.width = 960;
    cv.height = 540;
    paintPitch(cv.getContext("2d"), 960, 540, v === "hokej");
    bg[v] = cv;
  }

  function makeKid(p, y) {
    return {
      p,
      who: p.who,
      x: 420,
      y,
      vx: 0,
      vy: 0,
      fx: 1,
      fy: 0,
      run: 0,
      kick: 0,
    };
  }
  function resetBall(g, toKid) {
    const b = g.ball;
    b.x = 960;
    b.y = MIDY + (g.kids.length > 1 ? 0 : rnd(-120, 120));
    b.vx = b.vy = 0;
    b.owner = null;
    b.z = 0;
    if (toKid) {
      g.kids.forEach((k, i) => {
        k.x = 620;
        k.y = MIDY + (g.kids.length > 1 ? (i ? 180 : -180) : 0);
        k.vx = k.vy = 0;
      });
    }
    g.keeper.y = MIDY;
    for (const d of g.defs) {
      d.x = d.hx;
      d.y = d.hy;
    }
  }

  function updateKid(g, k, dt) {
    const h = k.p.held;
    const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0),
      ay = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    const len = Math.hypot(ax, ay) || 1;
    const sp = SPEED[k.who] * (g.hokej ? 1.05 : 1);
    if (g.hokej) {
      // brusle: zrychlení a klouzání
      k.vx += (ax / len) * 1300 * dt;
      k.vy += (ay / len) * 1300 * dt;
      const fr = ax || ay ? 0.6 : 1.1;
      k.vx *= 1 - fr * dt;
      k.vy *= 1 - fr * dt;
      const s = Math.hypot(k.vx, k.vy);
      if (s > sp) {
        k.vx *= sp / s;
        k.vy *= sp / s;
      }
    } else {
      const tx = (ax / len) * sp,
        ty = (ay / len) * sp;
      k.vx += (tx - k.vx) * Math.min(1, dt * 10);
      k.vy += (ty - k.vy) * Math.min(1, dt * 10);
    }
    if (ax || ay) {
      k.fx = ax / len;
      k.fy = ay / len;
    }
    k.x = clamp(k.x + k.vx * dt, F.x0 + PR, F.x1 - PR);
    k.y = clamp(k.y + k.vy * dt, F.y0 + PR, F.y1 - PR);
    if (k.x === F.x0 + PR || k.x === F.x1 - PR) k.vx *= -0.3;
    if (k.y === F.y0 + PR || k.y === F.y1 - PR) k.vy *= -0.3;
    k.run += Math.hypot(k.vx, k.vy) * dt;
    if (k.kick > 0) k.kick -= dt;
    // hráči se neprolínají
    for (const o of g.kids)
      if (o !== k) {
        const dx = k.x - o.x,
          dy = k.y - o.y,
          d = Math.hypot(dx, dy);
        if (d < PR * 2 && d > 0.1) {
          k.x += (dx / d) * (PR * 2 - d) * 0.5;
          k.y += (dy / d) * (PR * 2 - d) * 0.5;
        }
      }
  }
  function shoot(g, k) {
    const b = g.ball;
    if (b.owner !== k) return;
    let dx = k.fx,
      dy = k.fy;
    // Maty: když míří aspoň trochu k bráně, míč letí na bránu
    if (k.who === "maty" && dx > -0.2) {
      // do rohu, kde brankář zrovna není
      const mouth = MOUTH[g.variant].maty / 2;
      const side = g.keeper.y > MIDY ? -1 : 1;
      const gx = F.x1 + 20 - b.x,
        gy = MIDY + side * (mouth - 70) - b.y;
      const l = Math.hypot(gx, gy);
      dx = gx / l;
      dy = gy / l;
    }
    b.owner = null;
    b.vx = dx * SHOT[k.who];
    b.vy = dy * SHOT[k.who];
    b.lastKick = k;
    b.shot = (b.shot || 0) + 1;
    b.noGrab = 0.35;
    k.kick = 0.25;
    KIT.noise(0, 0.08, 0.3, 600);
    KIT.tone(180, 0, 0.1, "sine", 0.2);
  }

  function updateBall(g, dt) {
    const b = g.ball;
    if (b.noGrab > 0) b.noGrab -= dt;
    if (b.owner) {
      const k = b.owner;
      b.x = k.x + k.fx * (PR + 26);
      b.y = k.y + k.fy * (PR + 26);
      b.vx = k.vx;
      b.vy = k.vy;
      b.spin += Math.hypot(k.vx, k.vy) * dt * 0.05;
      const mouthO = MOUTH[g.variant][g.mode === "maty" ? "maty" : "nela"] / 2;
      if (b.x > F.x1 - 20 && Math.abs(b.y - MIDY) < mouthO - 30) {
        b.owner = null;
        b.lastKick = k;
        b.vx = 400;
        b.vy = 0;
      }
      return;
    }
    const fr = g.hokej ? 0.35 : 1.1;
    b.vx *= 1 - fr * dt;
    b.vy *= 1 - fr * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += Math.hypot(b.vx, b.vy) * dt * 0.05;
    const r = g.hokej ? 22 : 28;
    const mouth = MOUTH[g.variant][g.mode === "maty" ? "maty" : "nela"] / 2;
    // gól
    if (b.x > F.x1 - r && Math.abs(b.y - MIDY) < mouth - r * 0.5) {
      if (b.vx < 300) b.vx = 300; // v ústí brány se míč nezastaví, vždy dokutálí do sítě
      if (b.x > F.x1 + 30) goal(g);
      b.vy *= 0.9;
      if (b.x > F.x1 + 60) b.x = F.x1 + 60;
      return;
    }
    if (b.x < F.x0 + r) {
      b.x = F.x0 + r;
      b.vx = Math.abs(b.vx) * 0.75;
    }
    if (b.x > F.x1 - r) {
      b.x = F.x1 - r;
      b.vx = -Math.abs(b.vx) * 0.75;
      TV.sound.bump();
    }
    if (b.y < F.y0 + r) {
      b.y = F.y0 + r;
      b.vy = Math.abs(b.vy) * 0.75;
    }
    if (b.y > F.y1 - r) {
      b.y = F.y1 - r;
      b.vy = -Math.abs(b.vy) * 0.75;
    }
    // převzetí míče
    if (b.noGrab <= 0)
      for (const k of g.kids)
        if (
          Math.hypot(k.x - b.x, k.y - b.y) < PR + r + 8 &&
          Math.hypot(b.vx, b.vy) < 900
        ) {
          b.owner = k;
          TV.sound.move();
          break;
        }
  }
  function goal(g) {
    if (g.scored) return;
    g.scored = true;
    g.goals++;
    const k = g.ball.lastKick || g.kids[0];
    KIT.addStars(k.p, 3);
    for (const o of g.kids) if (o !== k) KIT.addStars(o.p, 1);
    TV.sound.win();
    KIT.noise(0, 1.4, 0.12, 900); // fanoušci
    TV.confetti(KIT.fx, 90);
    KIT.toast("GÓÓÓL!", 1800);
    KIT.sayCs(
      g.hokej
        ? "Gól! Puk je v bráně!"
        : k.who === "nela"
          ? "Gól! Nela dala gól!"
          : "Gól! Maty dal gól!",
    );
    g.netShake = 1;
    KIT.at(g, 2200, () => {
      g.scored = false;
      if (g.goals >= g.need) KIT.finish(g);
      else resetBall(g, true);
    });
  }

  function updateKeeper(g, dt) {
    const kp = g.keeper,
      b = g.ball;
    const mouth = MOUTH[g.variant][g.mode === "maty" ? "maty" : "nela"] / 2;
    // brankář míří k míči, jen když je míč na jeho polovině, a je pomalejší než střela
    const target = b.x > 900 ? MIDY + (b.y - MIDY) * 0.45 : MIDY;
    const sp = KEEPER[g.mode === "maty" ? "maty" : "nela"];
    kp.y += clamp(target - kp.y, -sp * dt, sp * dt);
    kp.y = clamp(kp.y, MIDY - mouth + 40, MIDY + mouth - 40);
    if (kp.dive > 0) kp.dive -= dt;
    if (kp.hold > 0) {
      kp.hold -= dt;
      b.x = kp.x - 60;
      b.y = kp.y;
      if (kp.hold <= 0) {
        // vyhodí míč zpátky doprostřed hřiště (žádný trest)
        b.vx = -rnd(600, 800);
        b.vy = rnd(-300, 300);
        b.noGrab = 0.2;
      }
      return;
    }
    const r = g.hokej ? 22 : 28;
    if (!b.owner && !g.scored && Math.hypot(kp.x - b.x, kp.y - b.y) < 48 + r && b.missed !== b.shot) {
      // rychlou střelu hodný brankář často nechytí (skočí pozdě)
      const fast = Math.hypot(b.vx, b.vy) > 700;
      if (fast && Math.random() < (g.mode === "maty" ? 0.7 : 0.45)) {
        b.missed = b.shot;
        kp.dive = 0.6;
        return;
      }
      kp.hold = 0.9;
      b.vx = b.vy = 0;
      TV.sound.bump();
      if (g.t - (g.saidSave || -99) > 8) {
        g.saidSave = g.t;
        KIT.sayCs("Chytil to! Zkus to znovu!");
      }
    }
  }
  function updateDefs(g, dt) {
    const b = g.ball;
    for (const d of g.defs) {
      if (d.wait > 0) {
        d.wait -= dt;
        continue;
      }
      // pomalu k míči, ale jen ve svém území
      // každý hlídá svůj pruh, uprostřed mezi nimi zůstává mezera
      const tx = clamp(b.x, d.hx - 220, d.hx + 220),
        ty = clamp(b.y, d.hy - 140, d.hy + 140);
      const dx = tx - d.x,
        dy = ty - d.y,
        l = Math.hypot(dx, dy);
      if (l > 4) {
        d.x += (dx / l) * (g.hokej ? 95 : 120) * dt;
        d.y += (dy / l) * (g.hokej ? 95 : 120) * dt;
      }
      if (!g.scored && Math.hypot(d.x - b.x, d.y - b.y) < PR + 30) {
        b.owner = null;
        b.vx = g.hokej ? -rnd(250, 350) : -rnd(400, 550);
        b.vy = rnd(-250, 250);
        b.noGrab = 0.3;
        d.wait = 3;
        TV.sound.bump();
      }
    }
  }

  // ---------- kreslení ----------
  function drawKid(c, g, k) {
    const bob = Math.sin(k.run / 18) * 4;
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.beginPath();
    c.ellipse(k.x, k.y + PR * 0.8, PR, PR * 0.38, 0, 0, Math.PI * 2);
    c.fill();
    // dres
    c.fillStyle = k.p.color;
    c.beginPath();
    c.arc(k.x, k.y + 6, PR, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "#fff";
    c.stroke();
    if (g.hokej) {
      // hokejka
      const a = Math.atan2(k.fy, k.fx) + (k.kick > 0 ? -0.9 : 0.5);
      c.strokeStyle = "#8a5a2b";
      c.lineWidth = 10;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(k.x + Math.cos(a) * 20, k.y + Math.sin(a) * 20);
      c.lineTo(k.x + Math.cos(a) * 82, k.y + Math.sin(a) * 82);
      c.stroke();
      c.strokeStyle = "#222";
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(k.x + Math.cos(a) * 80, k.y + Math.sin(a) * 80);
      c.lineTo(k.x + Math.cos(a + 0.5) * 92, k.y + Math.sin(a + 0.5) * 92);
      c.stroke();
    }
    KIT.drawAvatar(c, k.who, k.x, k.y - 14 + bob, 38, "#fff");
  }
  function drawAnimal(c, x, y, col, ears, t) {
    c.fillStyle = "rgba(0,0,0,0.2)";
    c.beginPath();
    c.ellipse(x, y + 38, 44, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = col;
    if (ears === "bear")
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(x + s * 28, y - 34, 15, 0, Math.PI * 2);
        c.fill();
      }
    else
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(x + s * 14, y - 32);
        c.lineTo(x + s * 38, y - 62);
        c.lineTo(x + s * 40, y - 22);
        c.fill();
      }
    c.beginPath();
    c.arc(x, y, 44, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff6e6";
    c.beginPath();
    c.ellipse(x, y + 12, 22, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#222";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(x + s * 15, y - 8 + Math.sin(t * 2) * 1, 6, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(x, y + 6, 6, 0, Math.PI * 2);
    c.fill();
  }
  function drawGoal(c, g) {
    const mouth = MOUTH[g.variant][g.mode === "maty" ? "maty" : "nela"];
    const sh = g.netShake > 0 ? Math.sin(g.t * 50) * 8 * g.netShake : 0;
    const x = F.x1,
      y = MIDY - mouth / 2;
    c.fillStyle = "rgba(255,255,255,0.25)";
    c.fillRect(x, y, 56 + sh, mouth);
    c.strokeStyle = "rgba(255,255,255,0.8)";
    c.lineWidth = 2;
    for (let k = 0; k <= mouth; k += 24) {
      c.beginPath();
      c.moveTo(x, y + k);
      c.lineTo(x + 56 + sh, y + k);
      c.stroke();
    }
    for (let k = 0; k <= 56; k += 14) {
      c.beginPath();
      c.moveTo(x + k + sh * (k / 56), y);
      c.lineTo(x + k + sh * (k / 56), y + mouth);
      c.stroke();
    }
    c.fillStyle = g.hokej ? "#e14b3b" : "#fff";
    c.fillRect(x - 6, y - 10, 66, 12);
    c.fillRect(x - 6, y + mouth - 2, 66, 12);
  }
  function drawBall(c, g) {
    const b = g.ball;
    if (g.hokej) {
      if (!KIT.draw(c, "puck", b.x, b.y, 50)) {
        c.fillStyle = "#111";
        c.beginPath();
        c.ellipse(b.x, b.y, 24, 16, 0, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(b.x + 6, b.y + 22, 26, 10, 0, 0, Math.PI * 2);
    c.fill();
    if (!KIT.draw(c, "ball", b.x, b.y, 58, 0, false, b.spin)) {
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(b.x, b.y, 28, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#222";
      c.lineWidth = 3;
      c.stroke();
    }
  }

  KIT.game({
    title: "Fotbal a hokej",
    res: 0.5,
    images: { ball: "img/ball.png", puck: "img/puck.png" },
    variantTitle: "Co budeme hrát?",
    variantSay: "Fotbal, nebo hokej?",
    variants: [
      {
        id: "fotbal",
        label: "Fotbal",
        say: "Fotbal!",
        paint: (c, w, h) => paintPitch(c, w, h, false),
      },
      {
        id: "hokej",
        label: "Hokej",
        say: "Hokej!",
        paint: (c, w, h) => paintPitch(c, w, h, true),
      },
    ],
    init() {
      paintBg("fotbal");
      paintBg("hokej");
    },
    start(g) {
      g.hokej = g.variant === "hokej";
      g.need = GOALS[g.mode];
      g.goals = 0;
      g.kids = g.players.map((p, i) =>
        makeKid(p, MIDY + (g.players.length > 1 ? (i ? 180 : -180) : 0)),
      );
      g.ball = {
        x: 960,
        y: MIDY,
        vx: 0,
        vy: 0,
        owner: null,
        spin: 0,
        noGrab: 0,
      };
      g.keeper = { x: F.x1 - 50, y: MIDY, hold: 0 };
      g.defs =
        g.mode === "maty"
          ? []
          : [
              { hx: 1350, hy: MIDY - 220, x: 1350, y: MIDY - 220, wait: 0 },
              { hx: 1350, hy: MIDY + 220, x: 1350, y: MIDY + 220, wait: 0 },
            ];
      g.netShake = 0;
      resetBall(g, true);
    },
    go(g) {
      KIT.sayCs(g.spolu ? "Jdeme na to! Dejte gól!" : "Jdeme na to! Dej gól!");
    },
    key(g, p, e) {
      if ((e.name === "ok" || e.name === "action") && e.type === "down")
        shoot(g, g.kids[p.idx]);
    },
    update(g, dt) {
      if (g.netShake > 0) g.netShake = Math.max(0, g.netShake - dt);
      if (g.phase !== "play") return;
      for (const k of g.kids) updateKid(g, k, dt);
      updateBall(g, dt);
      updateKeeper(g, dt);
      updateDefs(g, dt);
    },
    draw(g, c) {
      c.drawImage(bg[g.variant], 0, 0, 1920, 1080);
      drawGoal(c, g);
      for (const d of g.defs) drawAnimal(c, d.x, d.y, "#f28a2e", "fox", g.t);
      const kp = g.keeper;
      c.save();
      if (kp.dive > 0) {
        c.translate(kp.x, kp.y);
        c.rotate(Math.sin(kp.dive * 5) * 0.6);
        c.translate(-kp.x, -kp.y);
      }
      drawAnimal(c, kp.x, kp.y, "#9a6a3a", "bear", g.t);
      c.restore();
      // rukavice brankáře
      c.fillStyle = "#ffd23d";
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(g.keeper.x - 30, g.keeper.y + s * 40, 14, 0, Math.PI * 2);
        c.fill();
      }
      const objs = g.kids.slice().sort((a, b) => a.y - b.y);
      for (const k of objs) drawKid(c, g, k);
      drawBall(c, g);
      // góly nahoře uprostřed
      for (let i = 0; i < g.need; i++) {
        const x = 960 - (g.need - 1) * 36 + i * 72;
        c.fillStyle = i < g.goals ? "#ffd23d" : "rgba(255,255,255,0.35)";
        c.beginPath();
        c.arc(x, 85, 26, 0, Math.PI * 2);
        c.fill();
        if (i < g.goals) {
          c.fillStyle = "#222";
          c.beginPath();
          c.arc(x, 85, 9, 0, Math.PI * 2);
          c.fill();
        }
      }
      KIT.drawStars(c, g);
    },
  });
})();
