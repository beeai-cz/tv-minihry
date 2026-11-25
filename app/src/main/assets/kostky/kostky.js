/* Kostky (dětské padající kostky, nápad Máji; inspirace klasikou z 90. let, vlastní vzhled).
 * Tvar padá do studny: šipky vlevo/vpravo posun, OK / B / nahoru otočení, dolů rychleji.
 * Plná řada zmizí. Studna plná až nahoru = vysavač ji vyčistí (žádný konec hry).
 * Maty: užší studna a jen malé tvary (2-3 kostičky a čtverec). Nela: tvary ze čtyř kostiček.
 * SPOLU = dvě studny vedle sebe. Kostičky mají veselé obličeje. */
(function () {
  "use strict";

  const SHAPES = {
    maty: [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
    ],
    nela: [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
    ],
  };
  const RULES = {
    maty: {
      cols: 8,
      rows: 14,
      cell: 62,
      speed: [0.9, 1.1, 1.3],
      goal: 6,
      lock: 0.7,
    },
    nela: {
      cols: 10,
      rows: 18,
      cell: 50,
      speed: [1.1, 1.4, 1.8, 2.2],
      goal: 8,
      lock: 0.5,
    },
  };
  const COLORS = [
    "#ff4d5e",
    "#3fa8ff",
    "#5fd34a",
    "#ffd23d",
    "#b77cff",
    "#ff9a3d",
    "#33d1c4",
  ];
  const FAST = 18;
  const BLOCK = {};

  function makeBlock(col, s) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const c = cv.getContext("2d");
    const g = c.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.18, col);
    g.addColorStop(1, col);
    c.fillStyle = g;
    KIT.roundRect(c, 1.5, 1.5, s - 3, s - 3, s * 0.2);
    c.fill();
    c.lineWidth = s * 0.06;
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.stroke();
    // obličej
    c.fillStyle = "#2a1a10";
    c.beginPath();
    c.arc(s * 0.35, s * 0.42, s * 0.07, 0, Math.PI * 2);
    c.arc(s * 0.65, s * 0.42, s * 0.07, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = s * 0.05;
    c.strokeStyle = "#2a1a10";
    c.beginPath();
    c.arc(s * 0.5, s * 0.55, s * 0.14, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
    return cv;
  }
  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 1440;
    bg.height = 810;
    const c = bg.getContext("2d");
    c.scale(0.75, 0.75);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#1b1f5c");
    g.addColorStop(1, "#3b2a7a");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    let s = 21;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 140; k++) {
      c.globalAlpha = 0.3 + r() * 0.7;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(r() * 1920, r() * 1080, 1 + r() * 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // měsíc
    c.fillStyle = "#fff6c8";
    c.beginPath();
    c.arc(1740, 170, 70, 0, Math.PI * 2);
    c.fill();
  }

  function makeWell(p, cx) {
    const R = RULES[p.who];
    const w = {
      p,
      who: p.who,
      R,
      x0: cx - (R.cols * R.cell) / 2,
      y0: 1080 - 30 - R.rows * R.cell,
      grid: new Array(R.cols * R.rows).fill(-1),
      piece: null,
      next: null,
      level: 1,
      lines: 0,
      state: "fall",
      t: 0,
      lockT: 0,
      clear: null,
      done: false,
      bar: 0,
    };
    w.next = rndPiece(w);
    return w;
  }
  function rndPiece(w) {
    const list = SHAPES[w.who];
    const i = Math.floor(Math.random() * list.length);
    return {
      cells: list[i].map((c) => c.slice()),
      color: (i + (w.who === "maty" ? 2 : 0)) % COLORS.length,
    };
  }
  function fits(w, cells, x, y) {
    for (const [cx, cy] of cells) {
      const gx = x + cx,
        gy = y + cy;
      if (gx < 0 || gx >= w.R.cols || gy >= w.R.rows) return false;
      if (gy >= 0 && w.grid[gy * w.R.cols + gx] !== -1) return false;
    }
    return true;
  }
  function spawn(w) {
    const p = w.next;
    w.next = rndPiece(w);
    const width = Math.max(...p.cells.map((c) => c[0])) + 1;
    w.piece = {
      cells: p.cells,
      color: p.color,
      x: Math.floor((w.R.cols - width) / 2),
      y: -1,
      frac: 0,
    };
    w.state = "fall";
    w.lockT = 0;
    if (!fits(w, p.cells, w.piece.x, 0)) {
      w.state = "vacuum";
      w.t = 0;
      w.piece = null;
      TV.sound.whoosh();
      KIT.sayCs("Uklidíme!");
    }
  }
  function rotate(w) {
    const pc = w.piece;
    const maxY = Math.max(...pc.cells.map((c) => c[1]));
    const rot = pc.cells.map(([x, y]) => [maxY - y, x]);
    for (const dx of [0, -1, 1, -2, 2])
      if (fits(w, rot, pc.x + dx, pc.y)) {
        pc.cells = rot;
        pc.x += dx;
        TV.sound.flip();
        return;
      }
    TV.sound.nope();
  }
  function lock(w) {
    const pc = w.piece;
    w.piece = null;
    TV.sound.move();
    let over = false;
    for (const [cx, cy] of pc.cells) {
      const gy = pc.y + cy;
      if (gy < 0) over = true;
      else w.grid[gy * w.R.cols + pc.x + cx] = pc.color;
    }
    if (over) {
      w.state = "vacuum";
      w.t = 0;
      TV.sound.whoosh();
      KIT.sayCs("Uklidíme!");
      return;
    }
    const full = [];
    for (let r = 0; r < w.R.rows; r++) {
      let ok = true;
      for (let c = 0; c < w.R.cols; c++)
        if (w.grid[r * w.R.cols + c] === -1) ok = false;
      if (ok) full.push(r);
    }
    if (full.length) {
      w.clear = full;
      w.state = "flash";
      w.t = 0;
      TV.sound.match();
    } else spawn(w);
  }
  function clearRows(w) {
    const C = w.R.cols;
    for (const r of w.clear) {
      w.grid.splice(r * C, C);
      w.grid.unshift(...new Array(C).fill(-1));
    }
    const n = w.clear.length;
    w.clear = null;
    KIT.addStars(w.p, n * 2 + (n > 1 ? n : 0));
    w.lines += n;
    if (n >= 2) KIT.toast(n >= 3 ? "Paráda!" : "Super!", 900, "small");
    if (w.lines >= w.R.goal) {
      w.lines = 0;
      w.level++;
      if (w.level > w.R.speed.length) {
        w.done = true;
        w.state = "done";
        TV.sound.win();
        const g = KIT.S.game;
        if (g.wells.every((x) => x.done)) KIT.at(g, 1500, () => KIT.finish(g));
        else
          KIT.sayCs(
            KIT.g(
              w.who,
              "Hurá, Maty! Dokázal jsi to!",
              "Hurá, Nelo! Dokázala jsi to!",
            ),
          );
        return;
      }
      KIT.toast(("Úroveň " + w.level).toUpperCase(), 1500);
      KIT.sayCs("Hurá! Další úroveň!");
      TV.sound.win();
      w.state = "pause";
      w.t = 0;
      return;
    }
    spawn(w);
  }

  KIT.game({
    title: "Kostky",
    res: 0.75,
    init() {
      for (const who of ["maty", "nela"]) {
        BLOCK[who] = COLORS.map((c) =>
          makeBlock(c, Math.round(RULES[who].cell * 0.75)),
        );
      }
      paintBg();
    },
    start(g) {
      g.wells = g.spolu
        ? [makeWell(g.players[0], 560), makeWell(g.players[1], 1360)]
        : [makeWell(g.players[0], 960)];
    },
    go(g) {
      for (const w of g.wells) spawn(w);
      KIT.sayCs("Jdeme na to!");
    },
    key(g, p, e) {
      const w = g.wells[p.idx];
      if (!w || !w.piece || w.state !== "fall" || e.type === "up") return;
      const pc = w.piece;
      if (e.name === "left" || e.name === "right") {
        const d = e.name === "left" ? -1 : 1;
        if (fits(w, pc.cells, pc.x + d, pc.y)) {
          pc.x += d;
          TV.sound.move();
        }
      } else if (
        (e.name === "ok" || e.name === "action" || e.name === "up") &&
        e.type === "down"
      )
        rotate(w);
    },
    update(g, dt) {
      for (const w of g.wells) {
        w.bar +=
          (Math.min(1, w.lines / w.R.goal) - w.bar) * Math.min(1, dt * 6);
        if (g.phase !== "play") continue;
        w.t += dt;
        if (w.state === "fall" && w.piece) {
          const pc = w.piece;
          const sp = w.p.held.down
            ? FAST
            : w.R.speed[Math.min(w.level, w.R.speed.length) - 1];
          if (fits(w, pc.cells, pc.x, pc.y + 1)) {
            w.lockT = 0;
            pc.frac += sp * dt;
            while (pc.frac >= 1 && fits(w, pc.cells, pc.x, pc.y + 1)) {
              pc.y++;
              pc.frac -= 1;
            }
            if (!fits(w, pc.cells, pc.x, pc.y + 1)) pc.frac = 0;
          } else {
            pc.frac = 0;
            w.lockT += w.p.held.down ? dt * 4 : dt;
            if (w.lockT >= w.R.lock) lock(w);
          }
        } else if (w.state === "flash" && w.t > 0.4) clearRows(w);
        else if (w.state === "pause" && w.t > 1.4) spawn(w);
        else if (w.state === "vacuum" && w.t > 1.1) {
          w.grid.fill(-1);
          spawn(w);
        }
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      for (const w of g.wells) drawWell(c, g, w);
      KIT.drawStars(c, g);
    },
  });

  function drawWell(c, g, w) {
    const R = w.R,
      S = R.cell,
      W = R.cols * S,
      H = R.rows * S;
    const B = BLOCK[w.who];
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, w.x0 - 12, w.y0 - 12, W + 24, H + 24, 22);
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = w.p.color;
    c.stroke();
    const vac = w.state === "vacuum" ? Math.min(1, w.t / 1.1) : 0;
    const flashOn = w.state === "flash" && Math.floor(w.t * 12) % 2 === 0;
    for (let r = 0; r < R.rows; r++) {
      const flashRow = w.clear && w.clear.includes(r);
      for (let k = 0; k < R.cols; k++) {
        const v = w.grid[r * R.cols + k];
        if (v === -1) continue;
        let y = w.y0 + r * S;
        if (vac) {
          y -= vac * vac * (900 + k * 30);
          c.globalAlpha = 1 - vac;
        }
        c.drawImage(B[v], w.x0 + k * S, y, S, S);
        c.globalAlpha = 1;
        if (flashRow && flashOn) {
          c.fillStyle = "rgba(255,255,255,0.8)";
          c.fillRect(w.x0 + k * S, y, S, S);
        }
      }
    }
    const pc = w.piece;
    if (pc && w.state === "fall") {
      c.save();
      c.beginPath();
      c.rect(w.x0, w.y0, W, H);
      c.clip();
      let gy = pc.y;
      while (fits(w, pc.cells, pc.x, gy + 1)) gy++;
      c.globalAlpha = 0.25;
      for (const [cx, cy] of pc.cells)
        c.drawImage(
          B[pc.color],
          w.x0 + (pc.x + cx) * S,
          w.y0 + (gy + cy) * S,
          S,
          S,
        );
      c.globalAlpha = 1;
      for (const [cx, cy] of pc.cells)
        c.drawImage(
          B[pc.color],
          w.x0 + (pc.x + cx) * S,
          w.y0 + (pc.y + pc.frac + cy) * S,
          S,
          S,
        );
      c.restore();
    }
    // další tvar a ukazatel úrovně
    const right = !g.spolu || w.p.idx === 1;
    const sx = right ? w.x0 + W + 36 : w.x0 - 36 - 150;
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, sx, w.y0, 150, 190, 22);
    c.fill();
    KIT.text(c, "DALŠÍ", sx + 75, w.y0 + 30, 30, "#fff");
    const ns = 40;
    const nw = (Math.max(...w.next.cells.map((q) => q[0])) + 1) * ns,
      nh = (Math.max(...w.next.cells.map((q) => q[1])) + 1) * ns;
    for (const [cx, cy] of w.next.cells)
      c.drawImage(
        B[w.next.color],
        sx + 75 - nw / 2 + cx * ns,
        w.y0 + 115 - nh / 2 + cy * ns,
        ns,
        ns,
      );
    const by = w.y0 + 220,
      bh = 380;
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, sx, by, 150, bh + 70, 22);
    c.fill();
    KIT.text(
      c,
      String(Math.min(w.level, R.speed.length)),
      sx + 75,
      by + 38,
      46,
      "#ffd23d",
    );
    c.fillStyle = "rgba(255,255,255,0.12)";
    KIT.roundRect(c, sx + 50, by + 70, 50, bh - 20, 25);
    c.fill();
    const fh = (bh - 20) * (w.done ? 1 : w.bar);
    if (fh > 4) {
      c.fillStyle = "#5fd34a";
      KIT.roundRect(c, sx + 50, by + 70 + bh - 20 - fh, 50, fh, 25);
      c.fill();
    }
    if (w.done) {
      c.fillStyle = "rgba(10,8,30,0.55)";
      c.fillRect(w.x0, w.y0, W, H);
      KIT.text(c, "HOTOVO!", w.x0 + W / 2, w.y0 + H / 2, 70, "#ffd23d");
    }
  }
})();
