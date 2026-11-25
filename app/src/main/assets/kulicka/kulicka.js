/* Kulička (inspirace: koulení kuličky po dráze v oblacích z her SEGA).
 * Pohled shora, šipky naklánějí dráhu a kulička s dítětem uvnitř se kutálí. Sbírá ovoce, projede
 * vlaječkou (místo návratu) a dojede do cíle. Spadnout se dá jen Nele: kulička se vrátí na poslední
 * vlaječku. Matyho kulička má kolem dráhy zábradlí (odrazí se). OK / B = malý poskok pro radost.
 * Nárazníky odrážejí, šipky na zemi postrčí. SPOLU = dvě kuličky na stejné dráze. */
(function () {
  "use strict";

  const T = 140; // velikost dlaždice
  const R = 44; // poloměr kuličky
  // ' ' propast, '.' dráha, S start, G cíl, * ovoce, F vlaječka, o nárazník, > < ^ v postrkovač
  const LEVELS = [
    {
      name: "Rovinka",
      map: [
        "                  ",
        " ................ ",
        " .S..*...*...*..G ",
        " ................ ",
        "                  ",
      ],
    },
    {
      name: "Zatáčka",
      map: [
        "              ",
        " ........     ",
        " .S.*..*.     ",
        " ........     ",
        "      ...     ",
        "      .*.     ",
        "      .F.     ",
        "      .*.     ",
        "      ......  ",
        "      ..*.*.. ",
        "      ......G ",
        "              ",
      ],
    },
    {
      name: "Hádek",
      map: [
        "                   ",
        " ......   ........ ",
        " .S.*..   ..*...*. ",
        " ...... F ........ ",
        "   ..........  ..  ",
        "   ..*....*..  .*  ",
        "               ..  ",
        "           ......  ",
        "           .G..*.  ",
        "           ......  ",
        "                   ",
      ],
    },
    {
      name: "Nárazníky",
      map: [
        "                  ",
        " ................ ",
        " .S..o....o...*.. ",
        " ...*...o....o... ",
        " ..o....*...o...F ",
        " ......o....*.... ",
        " ..*.........o..G ",
        " ................ ",
        "                  ",
      ],
    },
    {
      name: "Most",
      map: [
        "                    ",
        " .....        ..... ",
        " .S*..........F.*.. ",
        " .....        ..... ",
        "                .   ",
        "                .   ",
        "  .....         .   ",
        "  ..G.*.........*.. ",
        "  .....         ... ",
        "                    ",
      ],
    },
    {
      name: "Rychlíky",
      map: [
        "                      ",
        " .....                ",
        " .S.*.>>>>>>.....     ",
        " .....     ..*F.      ",
        "           .....      ",
        "            .v.       ",
        "            .v.       ",
        "            .v.       ",
        "         .........    ",
        "         .*..o..*.    ",
        "         >>>>....G    ",
        "         .........    ",
        "                      ",
      ],
    },
    {
      name: "Klikatice",
      map: [
        "                    ",
        " ...                ",
        " .S.  ......        ",
        " .*.  .*..*.  ..... ",
        " ...  ..  ..  .*.G. ",
        " .F....    ......o. ",
        "  ...*.       .*..  ",
        "                    ",
      ],
    },
    {
      name: "Ostrovy",
      map: [
        "                       ",
        " .....         .....   ",
        " .S.*.>>>>>>>>>..*..   ",
        " .....         ..F..   ",
        "                 v     ",
        "                 .     ",
        "   .....       .....   ",
        "   .G.*.<<<<<<<.o.*.   ",
        "   .....       .....   ",
        "                       ",
      ],
    },
  ];
  const LEVEL_COUNT = { maty: 6, nela: 8, spolu: 6 };
  const ACC = { maty: 900, nela: 1150 };
  const VMAX = { maty: 470, nela: 640 };
  const FRUITS = [
    "strawberry",
    "cherry",
    "apple",
    "banana",
    "grapes",
    "orange",
  ];

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const gr = c.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, "#5ec8ff");
    gr.addColorStop(1, "#c6efff");
    c.fillStyle = gr;
    c.fillRect(0, 0, 1920, 1080);
    let s = 3;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.fillStyle = "rgba(255,255,255,0.85)";
    for (let k = 0; k < 14; k++) {
      const x = r() * 1920,
        y = r() * 1080,
        w = 120 + r() * 200;
      for (let a = 0; a < 5; a++) {
        c.beginPath();
        c.arc(
          x + (a - 2) * w * 0.22,
          y + (a % 2) * -w * 0.12,
          w * 0.22,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
  }

  function parse(def) {
    const rows = def.map;
    const h = rows.length,
      w = Math.max(...rows.map((r) => r.length));
    const L = {
      w,
      h,
      tile: new Array(w * h).fill(" "),
      fruits: [],
      bumpers: [],
      start: null,
      goal: null,
      flags: [],
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] || " ";
        const i = y * w + x;
        const cx = (x + 0.5) * T,
          cy = (y + 0.5) * T;
        L.tile[i] = ch === " " ? " " : ch;
        if (ch === "S") L.start = { x: cx, y: cy };
        else if (ch === "G") L.goal = { x: cx, y: cy };
        else if (ch === "*")
          L.fruits.push({
            x: cx,
            y: cy,
            img: FRUITS[L.fruits.length % FRUITS.length],
            got: false,
          });
        else if (ch === "o") L.bumpers.push({ x: cx, y: cy, hit: 0 });
        else if (ch === "F") L.flags.push({ x: cx, y: cy, on: false });
      }
    return L;
  }
  const tileAt = (L, x, y) => {
    const tx = Math.floor(x / T),
      ty = Math.floor(y / T);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return " ";
    return L.tile[ty * L.w + tx];
  };
  const solid = (L, x, y) => tileAt(L, x, y) !== " ";

  function makeBall(p, L, k) {
    return {
      p,
      who: p.who,
      x: L.start.x + k * 50,
      y: L.start.y,
      vx: 0,
      vy: 0,
      roll: 0,
      hop: 0,
      fall: 0,
      done: false,
      check: { x: L.start.x + k * 50, y: L.start.y },
      rails: p.who === "maty",
      spark: 0,
    };
  }
  function loadLevel(g, n) {
    g.level = n;
    g.L = parse(LEVELS[n - 1]);
    g.balls = g.players.map((p, k) =>
      makeBall(p, g.L, g.players.length > 1 ? (k ? 1 : -1) * 0.6 : 0),
    );
    g.cam = { x: g.L.start.x, y: g.L.start.y, z: 1 };
    g.endT = 0;
    KIT.toast(("Úroveň " + n).toUpperCase(), 1500);
  }

  function updateBall(g, b, dt) {
    const L = g.L;
    if (b.done) {
      // v cíli: krouží kolem středu
      const a = g.t * 3;
      b.x += (L.goal.x + Math.cos(a) * 22 - b.x) * Math.min(1, dt * 5);
      b.y += (L.goal.y + Math.sin(a) * 22 - b.y) * Math.min(1, dt * 5);
      return;
    }
    if (b.fall > 0) {
      b.fall += dt;
      b.x += b.vx * dt * 0.3;
      b.y += b.vy * dt * 0.3;
      if (b.fall > 0.9) {
        b.fall = 0;
        b.x = b.check.x;
        b.y = b.check.y;
        b.vx = b.vy = 0;
        b.hop = 0.01;
      }
      return;
    }
    const h = b.p.held;
    const a = ACC[b.who];
    const ax = (h.right ? 1 : 0) - (h.left ? 1 : 0),
      ay = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    b.vx += ax * a * dt;
    b.vy += ay * a * dt;
    // tření (bez šipek se kulička rychle zastaví, ať se dá zamířit)
    const fr = ax || ay ? 0.9 : 2.2;
    b.vx *= Math.max(0, 1 - fr * dt);
    b.vy *= Math.max(0, 1 - fr * dt);
    const sp = Math.hypot(b.vx, b.vy),
      vmax = VMAX[b.who] * (b.boost > 0 ? 1.7 : 1);
    if (sp > vmax) {
      b.vx *= vmax / sp;
      b.vy *= vmax / sp;
    }
    if (b.boost > 0) b.boost -= dt;
    if (b.hop > 0) b.hop = Math.max(0, b.hop - dt);
    if (b.spark > 0) b.spark -= dt;
    // pohyb po osách (kvůli zábradlí)
    const nx = b.x + b.vx * dt;
    if (b.rails && !solid(L, nx + Math.sign(b.vx) * R * 0.6, b.y)) {
      b.vx *= -0.45;
      bonk(b);
    } else b.x = nx;
    const ny = b.y + b.vy * dt;
    if (b.rails && !solid(L, b.x, ny + Math.sign(b.vy) * R * 0.6)) {
      b.vy *= -0.45;
      bonk(b);
    } else b.y = ny;
    b.roll += (sp * dt) / R;
    const tile = tileAt(L, b.x, b.y);
    if (tile === " " && b.hop <= 0) {
      b.fall = 0.001;
      TV.sound.miss();
      KIT.sayCs("Hups!");
      return;
    }
    // postrkovače
    const push = { ">": [1, 0], "<": [-1, 0], "^": [0, -1], v: [0, 1] }[tile];
    // postrkovač, který by tlačil do zábradlí (kulička s ním nemůže nic dělat), se ignoruje
    if (push && !(b.rails && !solid(L, b.x + push[0] * T, b.y + push[1] * T))) {
      const v = VMAX[b.who] * 1.6;
      if (push[0]) b.vx = push[0] * v;
      if (push[1]) b.vy = push[1] * v;
      b.boost = 0.5;
      if (!b.whooshT || g.t - b.whooshT > 0.8) {
        TV.sound.whoosh();
        b.whooshT = g.t;
      }
    }
    // nárazníky
    for (const o of L.bumpers) {
      const dx = b.x - o.x,
        dy = b.y - o.y,
        d = Math.hypot(dx, dy);
      if (d < R + 34 && d > 0.01) {
        const nx2 = dx / d,
          ny2 = dy / d;
        b.x = o.x + nx2 * (R + 35);
        b.y = o.y + ny2 * (R + 35);
        const sp2 = Math.max(420, Math.hypot(b.vx, b.vy) * 1.1);
        b.vx = nx2 * sp2;
        b.vy = ny2 * sp2;
        o.hit = 0.3;
        TV.sound.bump();
      }
    }
    // ovoce
    for (const f of L.fruits)
      if (!f.got && Math.hypot(b.x - f.x, b.y - f.y) < R + 36) {
        f.got = true;
        f.pop = 0;
        KIT.addStars(b.p, 1);
        TV.sound.ding();
      }
    for (const f of L.flags)
      if (Math.hypot(b.x - f.x, b.y - f.y) < R + 40) {
        b.check = { x: f.x, y: f.y };
        if (!f.on) {
          f.on = true;
          TV.sound.flip();
        }
      }
    if (Math.hypot(b.x - L.goal.x, b.y - L.goal.y) < 62) {
      b.done = true;
      KIT.addStars(b.p, 3);
      TV.sound.match();
      if (g.balls.some((x) => !x.done)) KIT.toast("Cíl!", 1200, "small");
    }
  }
  function bonk(b) {
    if (b.spark <= 0) {
      TV.sound.nope();
      b.spark = 0.25;
    }
  }

  function drawLevel(c, g) {
    const L = g.L;
    const z = g.cam.z;
    const vx0 = g.cam.x - 960 / z,
      vy0 = g.cam.y - 540 / z;
    const x0 = Math.max(0, Math.floor(vx0 / T) - 1),
      y0 = Math.max(0, Math.floor(vy0 / T) - 1);
    const x1 = Math.min(L.w - 1, Math.ceil((g.cam.x + 960 / z) / T)),
      y1 = Math.min(L.h - 1, Math.ceil((g.cam.y + 540 / z) / T) + 1);
    const pal = [
      ["#ffd9e8", "#ffc2d9"],
      ["#d9f5c7", "#c2ecab"],
      ["#fff0c2", "#ffe39a"],
      ["#dfe2ff", "#c8ccff"],
    ][(g.level - 1) % 4];
    // boky dlaždic (tloušťka ostrova)
    c.fillStyle = "#b07a45";
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (
          L.tile[y * L.w + x] !== " " &&
          (y + 1 >= L.h || L.tile[(y + 1) * L.w + x] === " ")
        )
          c.fillRect(x * T, y * T + T, T, 34);
    c.fillStyle = "#7d5228";
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (
          L.tile[y * L.w + x] !== " " &&
          (y + 1 >= L.h || L.tile[(y + 1) * L.w + x] === " ")
        )
          c.fillRect(x * T, y * T + T + 24, T, 10);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const ch = L.tile[y * L.w + x];
        if (ch === " ") continue;
        c.fillStyle = pal[(x + y) % 2];
        c.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        const push = { ">": 0, v: 1, "<": 2, "^": 3 }[ch];
        if (push != null) {
          c.save();
          c.translate((x + 0.5) * T, (y + 0.5) * T);
          c.rotate((push * Math.PI) / 2);
          const ph = (g.t * 2) % 1;
          for (let k = 0; k < 2; k++) {
            c.globalAlpha = 0.5 + 0.5 * Math.sin((ph + k * 0.5) * Math.PI);
            c.fillStyle = "#ff8a3d";
            c.beginPath();
            c.moveTo(-34 + k * 34, -34);
            c.lineTo(4 + k * 34, 0);
            c.lineTo(-34 + k * 34, 34);
            c.lineTo(-18 + k * 34, 0);
            c.closePath();
            c.fill();
          }
          c.restore();
        }
      }
    // zábradlí jen tam, kde ho má jediná kulička (Maty sám)
    if (g.balls.length === 1 && g.balls[0].rails) {
      c.strokeStyle = "#5cc93b";
      c.lineWidth = 10;
      c.lineCap = "round";
      c.beginPath();
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          if (L.tile[y * L.w + x] === " ") continue;
          const e = (xx, yy) =>
            xx < 0 ||
            yy < 0 ||
            xx >= L.w ||
            yy >= L.h ||
            L.tile[yy * L.w + xx] === " ";
          if (e(x, y - 1)) {
            c.moveTo(x * T, y * T + 5);
            c.lineTo(x * T + T, y * T + 5);
          }
          if (e(x, y + 1)) {
            c.moveTo(x * T, y * T + T - 5);
            c.lineTo(x * T + T, y * T + T - 5);
          }
          if (e(x - 1, y)) {
            c.moveTo(x * T + 5, y * T);
            c.lineTo(x * T + 5, y * T + T);
          }
          if (e(x + 1, y)) {
            c.moveTo(x * T + T - 5, y * T);
            c.lineTo(x * T + T - 5, y * T + T);
          }
        }
      c.stroke();
    }
    // cíl
    const G = L.goal;
    c.save();
    c.translate(G.x, G.y);
    for (let k = 0; k < 12; k++) {
      c.fillStyle = k % 2 ? "#222" : "#fff";
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, 62, (k * Math.PI) / 6 + g.t, ((k + 1) * Math.PI) / 6 + g.t);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 0, 62, 0, Math.PI * 2);
    c.lineWidth = 8;
    c.strokeStyle = "#ffd23d";
    c.stroke();
    c.restore();
    // vlaječky
    for (const f of L.flags) {
      c.fillStyle = "#6b4a2a";
      c.fillRect(f.x - 4, f.y - 70, 8, 80);
      c.fillStyle = f.on ? "#3fbf3a" : "#e14b3b";
      c.beginPath();
      const wv = Math.sin(g.t * 6) * 6;
      c.moveTo(f.x + 4, f.y - 70);
      c.lineTo(f.x + 60, f.y - 52 + wv);
      c.lineTo(f.x + 4, f.y - 34);
      c.fill();
    }
    // nárazníky
    for (const o of L.bumpers) {
      if (o.hit > 0) o.hit -= 1 / 60;
      const r = 34 + Math.max(0, o.hit) * 30;
      c.fillStyle = "rgba(0,0,0,0.2)";
      c.beginPath();
      c.ellipse(o.x, o.y + 16, r, r * 0.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ff4d8a";
      c.beginPath();
      c.arc(o.x, o.y, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(o.x, o.y, r * 0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ffd23d";
      c.beginPath();
      c.arc(o.x, o.y, r * 0.28, 0, Math.PI * 2);
      c.fill();
    }
    // ovoce
    for (const f of L.fruits) {
      if (f.got) {
        if (f.pop == null || f.pop > 1) continue;
        f.pop += 1 / 40;
        KIT.draw(c, f.img, f.x, f.y - f.pop * 90, 70, 0, false, 0, 1 - f.pop);
        continue;
      }
      const bob = Math.sin(g.t * 3 + f.x) * 6;
      if (!KIT.draw(c, f.img, f.x, f.y + bob, 76)) {
        c.fillStyle = "#e8283c";
        c.beginPath();
        c.arc(f.x, f.y + bob, 28, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  function drawBall(c, g, b) {
    const s = b.fall > 0 ? Math.max(0, 1 - b.fall / 0.9) : 1;
    const lift = b.hop > 0 ? Math.sin((b.hop / 0.4) * Math.PI) * 40 : 0;
    if (b.fall <= 0) {
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.beginPath();
      c.ellipse(b.x, b.y + R * 0.75, R * 0.9, R * 0.35, 0, 0, Math.PI * 2);
      c.fill();
    }
    const x = b.x,
      y = b.y - lift;
    const r = R * s;
    if (r < 1) return;
    KIT.drawAvatar(c, b.who, x, y, r * 0.72, "rgba(255,255,255,0)");
    // průhledná koule s pruhem, který se otáčí podle kutálení
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.clip();
    const dir = Math.atan2(b.vy, b.vx);
    c.translate(x, y);
    c.rotate(dir);
    const off = (((b.roll * r) % (r * 2)) + r * 2) % (r * 2);
    c.strokeStyle =
      b.who === "maty" ? "rgba(92,201,59,0.7)" : "rgba(255,107,154,0.7)";
    c.lineWidth = r * 0.22;
    for (const k of [-2, 0, 2]) {
      c.beginPath();
      c.ellipse(off - r + k * r, 0, r * 0.35, r * 1.1, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "rgba(200,240,255,0.18)";
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = b.spark > 0 ? "#ffd23d" : TV.PLAYERS[b.who].color;
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.ellipse(
      x - r * 0.38,
      y - r * 0.42,
      r * 0.22,
      r * 0.13,
      -0.7,
      0,
      Math.PI * 2,
    );
    c.fill();
  }

  KIT.game({
    title: "Kulička",
    res: 0.5,
    images: Object.fromEntries(
      FRUITS.map((f) => [f, "../had/img/" + f + ".png"]),
    ),
    init: paintBg,
    start(g) {
      g.maxLevel = LEVEL_COUNT[g.mode];
      loadLevel(g, 1);
    },
    key(g, p, e) {
      if ((e.name === "ok" || e.name === "action") && e.type === "down") {
        const b = g.balls[p.idx];
        if (b && b.hop <= 0 && b.fall <= 0 && !b.done) {
          b.hop = 0.4;
          TV.sound.move();
        }
      }
    },
    update(g, dt) {
      if (g.phase === "play") for (const b of g.balls) updateBall(g, b, dt);
      // kamera: střed mezi kuličkami, při SPOLU oddálit, ať jsou vidět obě
      let mx = 0,
        my = 0;
      for (const b of g.balls) {
        mx += b.x / g.balls.length;
        my += b.y / g.balls.length;
      }
      let z = 1;
      if (g.balls.length > 1) {
        const dx = Math.abs(g.balls[0].x - g.balls[1].x) + 500,
          dy = Math.abs(g.balls[0].y - g.balls[1].y) + 400;
        z = Math.max(0.5, Math.min(1, 1920 / dx, 1080 / dy));
      }
      const k = Math.min(1, dt * 4);
      g.cam.x += (mx - g.cam.x) * k;
      g.cam.y += (my - g.cam.y) * k;
      g.cam.z += (z - g.cam.z) * k;
      if (g.balls.every((b) => b.done)) {
        if (g.endT === 0) {
          TV.sound.win();
          TV.confetti(KIT.fx, 60);
          KIT.toast("Hurá!", 1500);
          KIT.sayCs(g.level < g.maxLevel ? "Hurá! Další úroveň!" : "Hurá!");
        }
        g.endT += dt;
        if (g.endT > 2.4) {
          if (g.level >= g.maxLevel) {
            g.balls.forEach((b) => (b.done = false));
            KIT.finish(g);
          } else loadLevel(g, g.level + 1);
        }
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      c.save();
      c.translate(960, 540);
      c.scale(g.cam.z, g.cam.z);
      c.translate(-g.cam.x, -g.cam.y);
      drawLevel(c, g);
      for (const b of g.balls) drawBall(c, g, b);
      c.restore();
      KIT.drawStars(c, g);
    },
  });
})();
