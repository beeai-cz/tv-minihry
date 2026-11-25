/* Pinball (inspirace: pinballové stoly SEGA 90. let).
 * Šipka vlevo = levá ploutev, vpravo = pravá, OK / B / nahoru = obě. Kulička padá shora z trubky.
 * Na stole svítí 5 hvězd: trefit všechny = další úroveň. Nárazníky odrážejí a blikají.
 * Propadlá kulička nevadí, za chvilku spadne nová. Matymu pomáhá pružinka mezi ploutvemi.
 * SPOLU = Maty ovládá levou ploutev, Nela pravou. */
(function () {
  "use strict";

  const { rnd, clamp } = KIT;
  const BR = 22; // poloměr kuličky
  const GRAV = { maty: 900, nela: 1250, spolu: 1050 };
  const LEVELS = 3;
  // stěny stolu (úsečky)
  const WALLS = [];
  const CX = 960,
    CY = 400,
    RR = 360;
  for (let k = 0; k < 16; k++) {
    const a0 = Math.PI + (k * Math.PI) / 16,
      a1 = Math.PI + ((k + 1) * Math.PI) / 16;
    WALLS.push([
      CX + Math.cos(a0) * RR,
      CY + Math.sin(a0) * RR,
      CX + Math.cos(a1) * RR,
      CY + Math.sin(a1) * RR,
    ]);
  }
  WALLS.push([600, 400, 600, 800], [1320, 400, 1320, 800]);
  WALLS.push([600, 800, 768, 948], [1320, 800, 1152, 948]);
  // šikmé odrážečky nad ploutvemi
  const SLINGS = [
    [665, 690, 750, 845],
    [1255, 690, 1170, 845],
  ];
  for (const s of SLINGS) WALLS.push(s);
  WALLS.push([665, 690, 665, 800], [1255, 690, 1255, 800]);
  const BUMPERS = [
    { x: 840, y: 330, r: 46 },
    { x: 1080, y: 330, r: 46 },
    { x: 960, y: 470, r: 46 },
  ];
  const STAR_SPOTS = [
    [700, 250],
    [1220, 250],
    [960, 160],
    [720, 560],
    [1200, 560],
    [960, 640],
    [820, 740],
    [1100, 740],
    [960, 300],
  ];
  const FL = [
    { side: -1, px: 770, py: 950 },
    { side: 1, px: 1150, py: 950 },
  ];
  const FLEN = 145,
    REST = 0.52,
    UP = -0.42;

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#2b1260");
    g.addColorStop(1, "#0d0830");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    // plocha stolu
    c.beginPath();
    c.arc(CX, CY, RR, Math.PI, 0);
    c.lineTo(1320, 800);
    c.lineTo(1152, 948);
    c.lineTo(1152, 1080);
    c.lineTo(768, 1080);
    c.lineTo(768, 948);
    c.lineTo(600, 800);
    c.closePath();
    const tg = c.createLinearGradient(0, 40, 0, 1080);
    tg.addColorStop(0, "#3a7bd5");
    tg.addColorStop(1, "#6a3ad5");
    c.fillStyle = tg;
    c.fill();
    // hvězdičky na podkladu
    let s = 8;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.fillStyle = "rgba(255,255,255,0.5)";
    for (let k = 0; k < 120; k++) {
      c.beginPath();
      c.arc(r() * 1920, r() * 1080, 1 + r() * 2, 0, Math.PI * 2);
      c.fill();
    }
    // šipky k nárazníkům
    c.fillStyle = "rgba(255,255,255,0.12)";
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(960 - 40, 900 - k * 80);
      c.lineTo(960, 860 - k * 80);
      c.lineTo(1000, 900 - k * 80);
      c.fill();
    }
  }

  function flipAngle(f) {
    return f.ang;
  }
  function flipTip(f) {
    const a = flipAngle(f);
    return [
      f.px + f.side * -1 * Math.cos(a) * -FLEN * 1,
      f.py + Math.sin(a) * FLEN,
    ];
  }
  // levá ploutev míří doprava dolů (+x), pravá doleva dolů (-x)
  function flipEnd(f) {
    const dir = f.side < 0 ? 1 : -1;
    return [f.px + dir * Math.cos(f.ang) * FLEN, f.py + Math.sin(f.ang) * FLEN];
  }
  void flipTip;

  let ballSpr = null;
  /** Stříbrná kulička se kreslí jednou (gradient v každém snímku je na TV drahý). */
  function ballSprite() {
    if (ballSpr) return ballSpr;
    ballSpr = document.createElement("canvas");
    ballSpr.width = ballSpr.height = BR * 2;
    const c = ballSpr.getContext("2d");
    const gr = c.createRadialGradient(BR - 7, BR - 8, 3, BR, BR, BR);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.5, "#c9d3e3");
    gr.addColorStop(1, "#6b7a96");
    c.fillStyle = gr;
    c.beginPath();
    c.arc(BR, BR, BR, 0, Math.PI * 2);
    c.fill();
    return ballSpr;
  }
  function newBall(g) {
    g.ball = {
      x: 960 + rnd(-60, 60),
      y: 60,
      vx: rnd(-120, 120),
      vy: 80,
      spin: 0,
    };
    g.wait = 0;
  }
  function placeStars(g) {
    const spots =
      KIT.S.game === g ? TV.shuffle(STAR_SPOTS.slice()) : STAR_SPOTS.slice();
    g.stars = spots.slice(0, 5).map(([x, y]) => ({ x, y, got: false, pop: 0 }));
  }

  function collideSeg(b, x1, y1, x2, y2, rad, rest, vx0, vy0) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const L2 = dx * dx + dy * dy;
    let t = ((b.x - x1) * dx + (b.y - y1) * dy) / L2;
    t = clamp(t, 0, 1);
    const qx = x1 + dx * t,
      qy = y1 + dy * t;
    let nx = b.x - qx,
      ny = b.y - qy;
    const d = Math.hypot(nx, ny);
    const R = BR + rad;
    if (d >= R || d < 0.0001) return false;
    nx /= d;
    ny /= d;
    b.x = qx + nx * R;
    b.y = qy + ny * R;
    const pvx = vx0 ? vx0(t) : 0,
      pvy = vy0 ? vy0(t) : 0;
    const rvx = b.vx - pvx,
      rvy = b.vy - pvy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      b.vx -= (1 + rest) * vn * nx;
      b.vy -= (1 + rest) * vn * ny;
    }
    return true;
  }

  function physics(g, dt) {
    const b = g.ball;
    if (!b) return;
    const G = GRAV[g.mode];
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    for (const w of WALLS) collideSeg(b, w[0], w[1], w[2], w[3], 4, 0.45);
    for (const s of SLINGS)
      if (collideSeg(b, s[0], s[1], s[2], s[3], 6, 1.1)) {
        if (g.t - (g.slingT || 0) > 0.15) {
          g.slingT = g.t;
          TV.sound.bump();
        }
      }
    // ploutve (pohyblivá úsečka)
    for (const f of g.flips) {
      const [ex, ey] = flipEnd(f);
      const dir = f.side < 0 ? 1 : -1;
      const w = f.w;
      // rychlost bodu ploutve ve vzdálenosti t*FLEN: kolmo na rameno
      const vx = (t) => -Math.sin(f.ang) * w * t * FLEN * dir,
        vy = (t) => Math.cos(f.ang) * w * t * FLEN;
      if (collideSeg(b, f.px, f.py, ex, ey, 13, 0.3, vx, vy) && Math.abs(w) > 1)
        b.spin = 1;
    }
    // nárazníky
    for (const o of BUMPERS) {
      const dx = b.x - o.x,
        dy = b.y - o.y,
        d = Math.hypot(dx, dy);
      if (d < o.r + BR && d > 0.01) {
        const nx = dx / d,
          ny = dy / d;
        b.x = o.x + nx * (o.r + BR);
        b.y = o.y + ny * (o.r + BR);
        const sp = Math.max(750, Math.hypot(b.vx, b.vy));
        b.vx = nx * sp;
        b.vy = ny * sp;
        o.lit = 0.25;
        KIT.tone(520 + BUMPERS.indexOf(o) * 130, 0, 0.12, "square", 0.06);
      }
    }
    // Matyho pružinka mezi ploutvemi
    if (
      g.mode === "maty" &&
      b.y > 1010 &&
      b.y < 1060 &&
      Math.abs(b.x - 960) < 120 &&
      b.vy > 0
    ) {
      b.vy = -rnd(1150, 1500);
      b.vx = rnd(-350, 350);
      g.spring = 0.3;
      TV.sound.bump();
    }
    const sp = Math.hypot(b.vx, b.vy);
    // kulička uvízla (např. v koutě u ploutve): postrčit ke středu
    if (sp < 60) {
      b.still = (b.still || 0) + dt;
      if (b.still > 1.2) {
        b.still = 0;
        b.vy = -1000;
        b.vx = b.x < 960 ? 380 : -380;
        TV.sound.bump();
      }
    } else b.still = 0;
    if (sp > 2300) {
      b.vx *= 2300 / sp;
      b.vy *= 2300 / sp;
    }
    // hvězdy
    for (const s of g.stars)
      if (!s.got && Math.hypot(b.x - s.x, b.y - s.y) < 58 + BR) {
        s.got = true;
        const p = g.lastFlip || g.players[0];
        KIT.addStars(p, 1);
        TV.sound.ding();
        if (g.stars.every((x) => x.got)) levelDone(g);
      }
    if (b.y > 1140) {
      g.ball = null;
      g.wait = 1.2;
      TV.sound.miss();
      if (g.t - (g.saidT || -99) > 10) {
        g.saidT = g.t;
        KIT.sayCs("Hups!");
      }
    }
  }
  function levelDone(g) {
    for (const p of g.players) KIT.addStars(p, 3);
    TV.sound.win();
    TV.confetti(KIT.fx, 80);
    if (g.level >= LEVELS) {
      g.over = true;
      KIT.at(g, 1500, () => KIT.finish(g));
      return;
    }
    g.level++;
    KIT.toast(("Úroveň " + g.level).toUpperCase(), 1600);
    KIT.sayCs("Hurá! Další úroveň!");
    KIT.at(g, 1200, () => placeStars(g));
  }

  KIT.game({
    title: "Pinball",
    res: 0.5,
    init: paintBg,
    start(g) {
      g.flips = FL.map((f) => ({ ...f, ang: REST, w: 0 }));
      g.level = 1;
      g.over = false;
      placeStars(g);
      g.ball = null;
      g.wait = 0.5;
    },
    go(g) {
      KIT.sayCs(
        g.spolu
          ? "Maty má levou ploutev, Nela pravou!"
          : "Šipkami pohybuj ploutvemi!",
      );
    },
    key(g, p, e) {
      if (
        e.type === "down" &&
        ["left", "right", "ok", "action", "up"].includes(e.name)
      ) {
        g.lastFlip = p;
        KIT.tone(220, 0, 0.05, "square", 0.04);
      }
    },
    update(g, dt) {
      for (const o of BUMPERS) if (o.lit > 0) o.lit -= dt;
      if (g.spring > 0) g.spring -= dt;
      for (const s of g.stars) if (s.got) s.pop += dt;
      if (g.phase !== "play") return;
      // ploutve podle držených tlačítek
      g.flips.forEach((f, i) => {
        let on = false;
        for (const p of g.players) {
          const h = p.held;
          const both = h.ok || h.action || h.up;
          if (g.spolu) {
            if (p.idx === i && (both || h.left || h.right)) on = true;
          } else if (both || (i === 0 ? h.left : h.right)) on = true;
        }
        const target = on ? UP : REST;
        const sp = on ? 20 : 9;
        const prev = f.ang;
        f.ang += clamp(target - f.ang, -sp * dt, sp * dt);
        f.w = (f.ang - prev) / Math.max(dt, 0.0001);
      });
      if (!g.ball && !g.over) {
        g.wait -= dt;
        if (g.wait <= 0) newBall(g);
      }
      // malé kroky, ať kulička neproletí stěnou
      const N = 8;
      for (let k = 0; k < N; k++) physics(g, dt / N);
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      c.lineCap = "round";
      c.strokeStyle = "#7ff0ff";
      c.lineWidth = 10;
      c.beginPath();
      for (const w of WALLS) {
        c.moveTo(w[0], w[1]);
        c.lineTo(w[2], w[3]);
      }
      c.stroke();
      c.strokeStyle = "#ff6bd5";
      c.lineWidth = 14;
      c.beginPath();
      for (const s of SLINGS) {
        c.moveTo(s[0], s[1]);
        c.lineTo(s[2], s[3]);
      }
      c.stroke();
      // trubka nahoře
      c.fillStyle = "#cfd8e8";
      c.fillRect(920, 30, 80, 26);
      for (const o of BUMPERS) {
        const lit = o.lit > 0;
        c.fillStyle = lit ? "#fff59a" : "#ff4d8a";
        c.beginPath();
        c.arc(o.x, o.y, o.r + (lit ? 6 : 0), 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(o.x, o.y, o.r * 0.55, 0, Math.PI * 2);
        c.fill();
        KIT.text(c, "★", o.x, o.y + 2, 40, lit ? "#ff4d8a" : "#ffd23d");
      }
      for (const s of g.stars) {
        if (s.got && s.pop > 0.6) continue;
        const k = s.got ? 1 + s.pop * 2 : 1 + Math.sin(g.t * 4 + s.x) * 0.08;
        c.globalAlpha = s.got ? 1 - s.pop / 0.6 : 1;
        KIT.text(c, "★", s.x, s.y, 76 * k, "#ffd23d");
        c.globalAlpha = 1;
      }
      if (g.mode === "maty") {
        c.fillStyle = g.spring > 0 ? "#fff59a" : "#5cc93b";
        KIT.roundRect(c, 850, 1040, 220, 18, 9);
        c.fill();
      }
      // ploutve
      g.flips.forEach((f, i) => {
        const [ex, ey] = flipEnd(f);
        const col = g.spolu ? g.players[i].color : "#ffd23d";
        c.strokeStyle = "rgba(0,0,0,0.35)";
        c.lineWidth = 30;
        c.beginPath();
        c.moveTo(f.px, f.py + 4);
        c.lineTo(ex, ey + 4);
        c.stroke();
        c.strokeStyle = col;
        c.lineWidth = 26;
        c.beginPath();
        c.moveTo(f.px, f.py);
        c.lineTo(ex, ey);
        c.stroke();
        c.fillStyle = "#fff";
        c.beginPath();
        c.arc(f.px, f.py, 7, 0, Math.PI * 2);
        c.fill();
      });
      const b = g.ball;
      if (b) c.drawImage(ballSprite(), b.x - BR, b.y - BR, BR * 2, BR * 2);
      // vlevo a vpravo: kdo ovládá kterou ploutev
      g.players.forEach((p, i) => {
        const x = g.spolu ? (i ? 1640 : 280) : 280;
        KIT.drawAvatar(c, p.who, x, 560, 110);
        KIT.text(c, g.spolu ? (i ? "▶" : "◀") : "◀ ▶", x, 720, 80, p.color);
      });
      // úroveň a zbývající hvězdy
      KIT.text(
        c,
        ("Úroveň " + g.level).toUpperCase(),
        1640,
        g.spolu ? 860 : 300,
        54,
        "#fff",
      );
      g.stars.forEach((s, i) =>
        KIT.text(
          c,
          "★",
          1540 + i * 50,
          g.spolu ? 930 : 380,
          48,
          s.got ? "#ffd23d" : "rgba(255,255,255,0.3)",
        ),
      );
      KIT.drawStars(c, g);
    },
  });
})();
