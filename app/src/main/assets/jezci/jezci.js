/* Ježci (dětské hledání min, nápad Máji; inspirace hrou z Windows 90. let).
 * Zahrádka zakrytá trávou, pod některými drny spí ježci. Kurzor šipkami, OK = odkrýt drn.
 * Odkrytý drn ukáže, kolik ježků je kolem (Maty vidí tečky, Nela čísla). Kde nikdo není, vykvete
 * kytička a odkryje se i okolí. Šlápnout na ježka = „Au!“, ježek vykoukne a hraje se dál.
 * B = položit / sebrat praporek („tady bude ježek“). Hotovo = všechny drny bez ježků odkryté.
 * První drn nikdy ježka nemá. SPOLU = dva kurzory na jedné zahrádce. */
(function () {
  "use strict";

  const { irnd } = KIT;
  const LEVELS = {
    maty: [
      [6, 4, 3],
      [7, 5, 4],
      [8, 5, 5],
    ],
    nela: [
      [8, 6, 7],
      [9, 6, 9],
      [10, 7, 12],
    ],
  };
  LEVELS.spolu = LEVELS.nela;
  const NUMCOL = [
    "",
    "#2f7de0",
    "#2a9a3a",
    "#e0402a",
    "#7a3ad8",
    "#b0601a",
    "#1a9aa0",
    "#333",
    "#888",
  ];

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#8fd6ff");
    g.addColorStop(0.3, "#c9f0ff");
    g.addColorStop(0.31, "#7cc85a");
    g.addColorStop(1, "#5aa83e");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    // plot
    c.fillStyle = "#d9a865";
    for (let x = 0; x < 1920; x += 54) {
      c.beginPath();
      c.moveTo(x + 8, 335);
      c.lineTo(x + 26, 300);
      c.lineTo(x + 44, 335);
      c.lineTo(x + 44, 420);
      c.lineTo(x + 8, 420);
      c.fill();
    }
    c.fillRect(0, 350, 1920, 14);
    c.fillRect(0, 395, 1920, 14);
  }
  function grassTile(s) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.round(s * 0.5);
    const c = cv.getContext("2d");
    c.scale(0.5, 0.5);
    c.fillStyle = "#4fb540";
    KIT.roundRect(c, 3, 3, s - 6, s - 6, s * 0.18);
    c.fill();
    c.fillStyle = "#67cc52";
    KIT.roundRect(c, 3, 3, s - 6, s * 0.55, s * 0.18);
    c.fill();
    c.strokeStyle = "#2f8a2a";
    c.lineWidth = s * 0.035;
    for (let k = 0; k < 6; k++) {
      const x = s * (0.18 + k * 0.13);
      c.beginPath();
      c.moveTo(x, s * 0.78);
      c.lineTo(x - s * 0.04, s * 0.6);
      c.moveTo(x, s * 0.78);
      c.lineTo(x + s * 0.05, s * 0.62);
      c.stroke();
    }
    return cv;
  }

  function loadLevel(g, n) {
    const [w, h, m] = LEVELS[g.mode][n - 1];
    g.level = n;
    g.W = w;
    g.H = h;
    g.mines = m;
    g.cell = Math.min(150, Math.floor(1700 / w), Math.floor(860 / h));
    g.bx = 960 - (w * g.cell) / 2;
    g.by = 190 + (860 - h * g.cell) / 2;
    g.hog = new Uint8Array(w * h);
    g.open = new Uint8Array(w * h);
    g.flag = new Uint8Array(w * h);
    g.ouch = new Uint8Array(w * h);
    g.cnt = new Uint8Array(w * h);
    g.placed = false;
    g.left = w * h - m;
    g.pops = [];
    g.tile = grassTile(g.cell);
    g.players.forEach((p, i) => {
      p.cx = g.players.length > 1 ? (i ? w - 2 : 1) : Math.floor(w / 2);
      p.cy = Math.floor(h / 2);
    });
    KIT.toast(("Úroveň " + n).toUpperCase(), 1400);
    if (n === 1)
      KIT.sayCs(
        g.mode === "maty"
          ? "Odkrývej trávu a hledej kytičky. Tečky ukazují, kolik ježků spí kolem."
          : "Odkrývej trávu. Číslo ukazuje, kolik ježků spí kolem.",
      );
  }
  function nbrs(g, i, fn) {
    const x = i % g.W,
      y = Math.floor(i / g.W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H) fn(ny * g.W + nx);
      }
  }
  function placeHogs(g, safe) {
    const ban = new Set([safe]);
    nbrs(g, safe, (j) => ban.add(j));
    let n = 0;
    while (n < g.mines) {
      const i = irnd(0, g.W * g.H - 1);
      if (ban.has(i) || g.hog[i]) continue;
      g.hog[i] = 1;
      n++;
    }
    for (let i = 0; i < g.W * g.H; i++) {
      let k = 0;
      nbrs(g, i, (j) => (k += g.hog[j]));
      g.cnt[i] = k;
    }
    g.placed = true;
  }
  function dig(g, p) {
    const i = p.cy * g.W + p.cx;
    if (g.open[i] || g.ouch[i]) {
      TV.sound.nope();
      return;
    }
    if (g.flag[i]) {
      if (g.mode !== "maty") {
        TV.sound.nope();
        return;
      }
      g.flag[i] = 0; // Maty praporek položil nejspíš omylem
    }
    if (!g.placed) placeHogs(g, i);
    if (g.hog[i]) {
      g.ouch[i] = 1;
      KIT.tone([700, 300], 0, 0.25, "triangle", 0.15);
      KIT.sayCs("Au!");
      g.pops.push({ i, t: 0, txt: "AU!" });
      return;
    }
    // odkrýt (prázdná místa se rozlijí)
    const st = [i];
    let n = 0;
    while (st.length) {
      const j = st.pop();
      if (g.open[j] || g.hog[j]) continue;
      g.open[j] = 1;
      g.flag[j] = 0;
      g.left--;
      n++;
      if (g.cnt[j] === 0) nbrs(g, j, (q) => !g.open[q] && st.push(q));
    }
    KIT.addStars(p, 1);
    n > 1 ? TV.sound.flip() : TV.sound.move();
    if (g.left <= 0) win(g);
  }
  function win(g) {
    g.won = true;
    // správně označení ježci = hvězdy navíc
    let ok = 0;
    for (let i = 0; i < g.W * g.H; i++) if (g.flag[i] && g.hog[i]) ok++;
    for (const p of g.players) KIT.addStars(p, 3 + ok);
    TV.sound.win();
    TV.confetti(KIT.fx, 70);
    KIT.toast("Hurá!", 1600);
    KIT.sayCs("Hurá! Všechny kytičky jsou venku!");
    KIT.at(g, 3000, () => {
      g.won = false;
      if (g.level >= LEVELS[g.mode].length) KIT.finish(g);
      else loadLevel(g, g.level + 1);
    });
  }

  function drawDots(c, x, y, n, s) {
    const r = s * 0.07;
    const pos = {
      1: [[0, 0]],
      2: [
        [-1, -1],
        [1, 1],
      ],
      3: [
        [-1, -1],
        [0, 0],
        [1, 1],
      ],
      4: [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ],
      5: [
        [-1, -1],
        [1, -1],
        [0, 0],
        [-1, 1],
        [1, 1],
      ],
      6: [
        [-1, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
      ],
    }[Math.min(6, n)];
    c.fillStyle = NUMCOL[n] || "#333";
    for (const [dx, dy] of pos) {
      c.beginPath();
      c.arc(x + dx * s * 0.2, y + dy * s * 0.2, r, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawFlower(c, x, y, s, i) {
    const col = ["#ff6b9a", "#ffd23d", "#b77cff", "#fff", "#ff8a3d"][i % 5];
    c.fillStyle = col;
    for (let a = 0; a < 5; a++) {
      c.beginPath();
      c.arc(
        x + Math.cos(a * 1.257) * s * 0.11,
        y + Math.sin(a * 1.257) * s * 0.11,
        s * 0.08,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.fillStyle = "#f0a020";
    c.beginPath();
    c.arc(x, y, s * 0.06, 0, Math.PI * 2);
    c.fill();
  }

  KIT.game({
    title: "Ježci",
    res: 0.5,
    countdown: false,
    images: { hedgehog: "img/hedgehog.png" },
    init: paintBg,
    start(g) {
      loadLevel(g, 1);
    },
    key(g, p, e) {
      if (e.type === "up" || g.won) return;
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[
        e.name
      ];
      if (d) {
        const nx = p.cx + d[0],
          ny = p.cy + d[1];
        if (nx >= 0 && ny >= 0 && nx < g.W && ny < g.H) {
          p.cx = nx;
          p.cy = ny;
          TV.sound.move();
        }
        return;
      }
      if (e.type !== "down") return;
      if (e.name === "ok") dig(g, p);
      else if (e.name === "action") {
        const i = p.cy * g.W + p.cx;
        if (g.open[i] || g.ouch[i]) return;
        g.flag[i] ^= 1;
        TV.sound.flip();
      }
    },
    update(g, dt) {
      for (const pp of g.pops) pp.t += dt;
      g.pops = g.pops.filter((pp) => pp.t < 1);
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      const s = g.cell;
      c.fillStyle = "#8a5a2b";
      KIT.roundRect(c, g.bx - 14, g.by - 14, g.W * s + 28, g.H * s + 28, 24);
      c.fill();
      for (let y = 0; y < g.H; y++)
        for (let x = 0; x < g.W; x++) {
          const i = y * g.W + x;
          const px = g.bx + x * s,
            py = g.by + y * s;
          const cx = px + s / 2,
            cy = py + s / 2;
          if (g.open[i] || g.ouch[i]) {
            c.fillStyle = (x + y) % 2 ? "#c9955a" : "#d4a26a";
            c.fillRect(px + 2, py + 2, s - 4, s - 4);
            if (g.ouch[i]) {
              const pop = g.pops.find((q) => q.i === i);
              const jump = pop ? Math.sin(pop.t * Math.PI) * s * 0.25 : 0;
              if (!KIT.draw(c, "hedgehog", cx, cy - jump, s * 0.8)) {
                c.fillStyle = "#7a5230";
                c.beginPath();
                c.arc(cx, cy - jump, s * 0.32, 0, Math.PI * 2);
                c.fill();
              }
            } else if (g.cnt[i] === 0) drawFlower(c, cx, cy, s, i);
            else if (g.mode === "maty") drawDots(c, cx, cy, g.cnt[i], s);
            else
              KIT.text(
                c,
                String(g.cnt[i]),
                cx,
                cy + 3,
                s * 0.55,
                NUMCOL[g.cnt[i]],
              );
          } else {
            c.drawImage(g.tile, px, py, s, s);
            if (g.flag[i]) {
              c.fillStyle = "#6b4a2a";
              c.fillRect(cx - 3, cy - s * 0.32, 6, s * 0.6);
              c.fillStyle = "#e14b3b";
              c.beginPath();
              c.moveTo(cx + 3, cy - s * 0.32);
              c.lineTo(cx + s * 0.3, cy - s * 0.2);
              c.lineTo(cx + 3, cy - s * 0.08);
              c.fill();
            }
          }
        }
      // kurzory
      for (const p of g.players) {
        const x = g.bx + p.cx * s,
          y = g.by + p.cy * s;
        const bob = Math.sin(g.t * 6) * 4;
        c.lineWidth = 9;
        c.strokeStyle = p.color;
        KIT.roundRect(
          c,
          x + 3 - bob / 2,
          y + 3 - bob / 2,
          s - 6 + bob,
          s - 6 + bob,
          16,
        );
        c.stroke();
        c.lineWidth = 3;
        c.strokeStyle = "#fff";
        c.stroke();
        if (g.spolu) KIT.drawAvatar(c, p.who, x + s - 8, y + 8, 20);
      }
      for (const pp of g.pops) {
        const x = g.bx + (pp.i % g.W) * s + s / 2,
          y = g.by + Math.floor(pp.i / g.W) * s;
        KIT.text(c, pp.txt, x, y - pp.t * 60, 60, "#fff");
      }
      // kolik ježků se schovává
      if (!KIT.draw(c, "hedgehog", 840, 95, 90)) KIT.text(c, "🦔", 840, 95, 70);
      KIT.text(c, "× " + g.mines, 950, 98, 64, "#fff");
      KIT.drawStars(c, g);
    },
  });
})();
