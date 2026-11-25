/* Drahokamy (inspirace: padající trojice drahokamů z her SEGA 90. let).
 * Shora padá sloupek tří drahokamů. Šipky vlevo/vpravo ho posouvají, OK / B / nahoru přehodí barvy
 * (spodní nahoru), dolů zrychlí pád. Tři stejné v řadě zmizí a nad nimi se drahokamy sesypou (řetězení).
 * Duhový sloupek smaže všechny drahokamy barvy, na kterou dopadne. Plná studna = vysavač ji vyčistí
 * (žádný konec hry). Maty: 3 barvy, jen vodorovně a svisle. Nela: víc barev, i šikmo. SPOLU: dvě studny. */
(function () {
  "use strict";

  const COLS = 6,
    ROWS = 12,
    CELL = 74;
  const COLORS = [
    { c: "#ff4d5e", d: "#a3122a", shape: "circle" },
    { c: "#3fa8ff", d: "#0f4c9e", shape: "diamond" },
    { c: "#5fd34a", d: "#24721a", shape: "square" },
    { c: "#ffd23d", d: "#b07c00", shape: "tri" },
    { c: "#b77cff", d: "#5626a8", shape: "hex" },
    { c: "#ff9a3d", d: "#a94c08", shape: "star" },
  ];
  const MAGIC = 9;
  // speed = řádků za sekundu podle úrovně; goal = kolik drahokamů smazat na úroveň
  const RULES = {
    maty: {
      colors: [3, 3, 3, 3],
      diag: false,
      speed: [0.8, 1, 1.2, 1.4],
      goal: 12,
      magicEvery: 6,
      lock: 0.6,
    },
    nela: {
      colors: [4, 4, 5, 5, 5],
      diag: true,
      speed: [1.2, 1.45, 1.7, 2, 2.3],
      goal: 21,
      magicEvery: 9,
      lock: 0.4,
    },
  };
  const FAST = 16; // dolů = rychlý pád
  const { rnd, el } = KIT;

  // ---------- obrázky drahokamů (kreslené jednou do malých pláten) ----------
  const GEM = [];
  let gemMagic = null;
  function shapePath(c, shape, s) {
    const r = s * 0.42;
    c.beginPath();
    if (shape === "circle") c.arc(0, 0, r, 0, Math.PI * 2);
    else if (shape === "diamond") {
      c.moveTo(0, -r * 1.08);
      c.lineTo(r * 0.95, 0);
      c.lineTo(0, r * 1.08);
      c.lineTo(-r * 0.95, 0);
    } else if (shape === "square")
      KIT.roundRect(c, -r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.3);
    else if (shape === "tri") {
      c.moveTo(0, -r * 1.05);
      c.lineTo(r * 1.05, r * 0.85);
      c.lineTo(-r * 1.05, r * 0.85);
    } else if (shape === "hex") {
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        c[k ? "lineTo" : "moveTo"](
          Math.cos(a) * r * 1.02,
          Math.sin(a) * r * 1.02,
        );
      }
    } else {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rr = k % 2 ? r * 0.5 : r * 1.08;
        c[k ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    c.closePath();
  }
  function makeGem(col, s, rainbow) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const c = cv.getContext("2d");
    c.translate(s / 2, s / 2);
    shapePath(c, rainbow ? "star" : col.shape, s);
    let gr;
    if (rainbow) {
      gr = c.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      ["#ff4d5e", "#ffd23d", "#5fd34a", "#3fa8ff", "#b77cff"].forEach((x, i) =>
        gr.addColorStop(i / 4, x),
      );
    } else {
      gr = c.createRadialGradient(
        -s * 0.12,
        -s * 0.16,
        s * 0.05,
        0,
        0,
        s * 0.5,
      );
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.25, col.c);
      gr.addColorStop(1, col.d);
    }
    c.fillStyle = gr;
    c.fill();
    c.lineWidth = s * 0.06;
    c.strokeStyle = rainbow ? "#fff" : col.d;
    c.stroke();
    // odlesk
    c.beginPath();
    c.ellipse(-s * 0.12, -s * 0.15, s * 0.1, s * 0.06, -0.6, 0, Math.PI * 2);
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fill();
    return cv;
  }
  let bg = null;
  function paintBg(res) {
    bg = document.createElement("canvas");
    bg.width = 1920 * res;
    bg.height = 1080 * res;
    const c = bg.getContext("2d");
    c.scale(res, res);
    const gr = c.createRadialGradient(960, 400, 100, 960, 540, 1200);
    gr.addColorStop(0, "#3b2a7a");
    gr.addColorStop(0.6, "#1d1648");
    gr.addColorStop(1, "#0c0a24");
    c.fillStyle = gr;
    c.fillRect(0, 0, 1920, 1080);
    // krystaly v jeskyni po okrajích
    let seed = 11;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 46; k++) {
      const left = k % 2 === 0;
      const x = left ? r() * 330 : 1920 - r() * 330;
      const y = 1080 - r() * 700;
      const h = 60 + r() * 170;
      const w = 22 + r() * 40;
      const col = COLORS[k % COLORS.length];
      c.save();
      c.translate(x, y);
      c.rotate((r() - 0.5) * 0.8);
      c.globalAlpha = 0.55 + r() * 0.35;
      c.beginPath();
      c.moveTo(0, -h);
      c.lineTo(w / 2, -h * 0.75);
      c.lineTo(w / 2, 0);
      c.lineTo(-w / 2, 0);
      c.lineTo(-w / 2, -h * 0.75);
      c.closePath();
      c.fillStyle = col.c;
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(-w / 2 + 4, -h * 0.72, w * 0.25, h * 0.65);
      c.restore();
    }
    for (let k = 0; k < 90; k++) {
      c.globalAlpha = 0.3 + r() * 0.6;
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(r() * 1920, r() * 1080, 1 + r() * 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // ---------- studna ----------
  function makeWell(p, cx) {
    const w = {
      p,
      who: p.who,
      R: RULES[p.who],
      x0: cx - (COLS * CELL) / 2,
      y0: 1080 - 34 - ROWS * CELL,
      grid: new Array(ROWS * COLS).fill(-1),
      piece: null,
      next: null,
      state: "fall",
      t: 0,
      cleared: 0,
      level: 1,
      pieces: 0,
      marks: null,
      chain: 0,
      done: false,
      lockT: 0,
      bar: 0,
      pops: [],
    };
    w.next = newTriple(w);
    return w;
  }
  const levelsOf = (w) => w.R.speed.length;
  function newTriple(w) {
    w.pieces++;
    const n = w.R.colors[Math.min(w.level, levelsOf(w)) - 1];
    if (w.pieces % w.R.magicEvery === 0)
      return { gems: [MAGIC, MAGIC, MAGIC], magic: true };
    const gems = [0, 1, 2].map(() => Math.floor(Math.random() * n));
    // Maty: aspoň dva stejné vedle sebe, ať se často něco povede
    if (w.who === "maty" && gems[0] !== gems[1] && gems[1] !== gems[2])
      gems[2] = gems[1];
    return { gems, magic: false };
  }
  const at = (w, r, c) =>
    r < 0 || r >= ROWS || c < 0 || c >= COLS ? -2 : w.grid[r * COLS + c];
  /** Vejde se sloupek se spodním drahokamem v řádku row do sloupce col? */
  function fits(w, col, row) {
    if (col < 0 || col >= COLS) return false;
    for (let k = 0; k < 3; k++) {
      const r = row - k;
      if (r >= ROWS) return false;
      if (r >= 0 && w.grid[r * COLS + col] !== -1) return false;
    }
    return true;
  }
  function spawn(w) {
    const t = w.next;
    w.next = newTriple(w);
    w.piece = { col: 2, row: -1, frac: 0, gems: t.gems, magic: t.magic };
    w.lockT = 0;
    w.state = "fall";
    if (!fits(w, 2, 0)) startVacuum(w);
  }
  function startVacuum(w) {
    w.state = "vacuum";
    w.t = 0;
    w.piece = null;
    TV.sound.whoosh();
    KIT.sayCs("Uklidíme!");
  }
  function landRow(w) {
    let r = w.piece.row;
    while (fits(w, w.piece.col, r + 1)) r++;
    return r;
  }

  function lock(w) {
    const pc = w.piece;
    w.piece = null;
    TV.sound.move();
    if (pc.row - 2 < 0 && !pc.magic) {
      // nevejde se celý: místo prohry vysavač
      startVacuum(w);
      return;
    }
    if (pc.magic) {
      const under = at(w, pc.row + 1, pc.col);
      const marks = new Set();
      if (under >= 0)
        for (let i = 0; i < w.grid.length; i++)
          if (w.grid[i] === under) marks.add(i);
      // duhové drahokamy samy zmizí taky (nepočítají se)
      for (let k = 0; k < 3; k++) {
        const r = pc.row - k;
        if (r >= 0) w.grid[r * COLS + pc.col] = MAGIC;
      }
      for (let i = 0; i < w.grid.length; i++)
        if (w.grid[i] === MAGIC) marks.add(i);
      TV.sound.whoosh();
      startFlash(w, marks);
      return;
    }
    for (let k = 0; k < 3; k++) {
      const r = pc.row - k;
      if (r >= 0) w.grid[r * COLS + pc.col] = pc.gems[2 - k];
    }
    w.chain = 0;
    resolve(w);
  }
  function findMatches(w) {
    const marks = new Set();
    const dirs = [
      [0, 1],
      [1, 0],
    ];
    if (w.R.diag) dirs.push([1, 1], [1, -1]);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const v = at(w, r, c);
        if (v < 0 || v === MAGIC) continue;
        for (const [dr, dc] of dirs) {
          if (at(w, r - dr, c - dc) === v) continue; // není začátek řady
          let n = 1;
          while (at(w, r + dr * n, c + dc * n) === v) n++;
          if (n >= 3)
            for (let k = 0; k < n; k++)
              marks.add((r + dr * k) * COLS + c + dc * k);
        }
      }
    return marks;
  }
  function resolve(w) {
    const m = findMatches(w);
    if (m.size) startFlash(w, m);
    else afterSettle(w);
  }
  function startFlash(w, marks) {
    w.marks = marks;
    w.state = "flash";
    w.t = 0;
    w.chain++;
    TV.sound.match();
  }
  function clearMarks(w) {
    let n = 0;
    for (const i of w.marks) {
      if (w.grid[i] >= 0 && w.grid[i] !== MAGIC) n++;
      const r = Math.floor(i / COLS),
        c = i % COLS;
      w.pops.push({
        x: w.x0 + (c + 0.5) * CELL,
        y: w.y0 + (r + 0.5) * CELL,
        t: 0,
        v: w.grid[i],
      });
      w.grid[i] = -1;
    }
    w.marks = null;
    // sesypat
    for (let c = 0; c < COLS; c++) {
      let dst = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const v = w.grid[r * COLS + c];
        if (v === -1) continue;
        w.grid[r * COLS + c] = -1;
        w.grid[dst * COLS + c] = v;
        dst--;
      }
    }
    KIT.addStars(w.p, n + (w.chain > 1 ? w.chain : 0));
    w.cleared += n;
    if (w.chain === 2) KIT.toast("Super!", 900, "small");
    if (w.chain >= 3) KIT.toast("Paráda!", 900, "small");
    if (w.chain >= 2) TV.sound.ding();
    w.state = "settle";
    w.t = 0;
  }
  function afterSettle(w) {
    if (w.cleared >= w.R.goal) {
      w.cleared = 0;
      w.level++;
      if (w.level > levelsOf(w)) {
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
      KIT.toast(("Úroveň " + w.level).toUpperCase(), 1600);
      KIT.sayCs("Hurá! Další úroveň!");
      TV.sound.win();
      w.state = "pause";
      w.t = 0;
      return;
    }
    spawn(w);
  }

  // ---------- hra ----------
  KIT.game({
    title: "Drahokamy",
    res: 0.75,
    init() {
      const s = Math.round(CELL * 0.75);
      COLORS.forEach((c, i) => (GEM[i] = makeGem(c, s)));
      gemMagic = makeGem(null, s, true);
      paintBg(0.75);
    },
    start(g) {
      g.wells = g.spolu
        ? [makeWell(g.players[0], 520), makeWell(g.players[1], 1400)]
        : [makeWell(g.players[0], 960)];
    },
    go(g) {
      for (const w of g.wells) spawn(w);
      KIT.sayCs(g.spolu ? "Jdeme na to!" : "Jdeme na to!");
    },
    key(g, p, e) {
      const w = g.wells[p.idx];
      if (!w || !w.piece || w.state !== "fall" || e.type === "up") return;
      const pc = w.piece;
      if (e.name === "left" || e.name === "right") {
        const d = e.name === "left" ? -1 : 1;
        if (fits(w, pc.col + d, pc.row)) {
          pc.col += d;
          TV.sound.move();
        } else if (e.type === "down") TV.sound.nope();
      } else if (
        (e.name === "ok" || e.name === "action" || e.name === "up") &&
        e.type === "down"
      ) {
        if (!pc.magic) {
          pc.gems.unshift(pc.gems.pop()); // spodní nahoru
          TV.sound.flip();
        }
      }
    },
    update(g, dt) {
      for (const w of g.wells) {
        for (const pp of w.pops) pp.t += dt;
        w.pops = w.pops.filter((pp) => pp.t < 0.6);
        w.bar +=
          (Math.min(1, w.cleared / w.R.goal) - w.bar) * Math.min(1, dt * 6);
        if (g.phase !== "play") continue;
        w.t += dt;
        if (w.state === "fall" && w.piece) {
          const pc = w.piece;
          const sp = w.p.held.down
            ? FAST
            : w.R.speed[Math.min(w.level, levelsOf(w)) - 1];
          if (fits(w, pc.col, pc.row + 1)) {
            w.lockT = 0;
            pc.frac += sp * dt;
            while (pc.frac >= 1 && fits(w, pc.col, pc.row + 1)) {
              pc.row++;
              pc.frac -= 1;
            }
            if (!fits(w, pc.col, pc.row + 1)) pc.frac = 0;
          } else {
            pc.frac = 0;
            w.lockT += w.p.held.down ? dt * 4 : dt;
            if (w.lockT >= w.R.lock) lock(w);
          }
        } else if (w.state === "flash" && w.t > 0.45) clearMarks(w);
        else if (w.state === "settle" && w.t > 0.2) resolve(w);
        else if (w.state === "pause" && w.t > 1.4) spawn(w);
        else if (w.state === "vacuum" && w.t > 1.1) {
          w.grid.fill(-1);
          spawn(w);
        }
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      for (const w of g.wells) drawWell(c, w, g);
      KIT.drawStars(c, g);
    },
  });

  function gemImg(v) {
    return v === MAGIC ? gemMagic : GEM[v];
  }
  function drawWell(c, w, g) {
    const W = COLS * CELL,
      H = ROWS * CELL;
    // rám
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, w.x0 - 14, w.y0 - 14, W + 28, H + 28, 26);
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = w.p.color;
    c.stroke();
    // jemná mřížka
    c.fillStyle = "rgba(255,255,255,0.04)";
    for (let r = 0; r < ROWS; r++)
      for (let k = r % 2; k < COLS; k += 2)
        c.fillRect(w.x0 + k * CELL, w.y0 + r * CELL, CELL, CELL);

    const vac = w.state === "vacuum" ? Math.min(1, w.t / 1.1) : 0;
    const flashOn = w.state === "flash" && Math.floor(w.t * 12) % 2 === 0;
    for (let r = 0; r < ROWS; r++)
      for (let k = 0; k < COLS; k++) {
        const v = w.grid[r * COLS + k];
        if (v === -1) continue;
        const i = r * COLS + k;
        let x = w.x0 + k * CELL,
          y = w.y0 + r * CELL;
        if (vac) {
          // vysavač: drahokamy vyletí nahoru a zmizí
          y -= vac * vac * (900 + k * 40);
          c.globalAlpha = 1 - vac;
        }
        c.drawImage(gemImg(v), x, y, CELL, CELL);
        if (w.marks && w.marks.has(i) && flashOn) {
          c.fillStyle = "rgba(255,255,255,0.7)";
          c.beginPath();
          c.arc(x + CELL / 2, y + CELL / 2, CELL * 0.44, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }

    const pc = w.piece;
    if (pc && w.state === "fall") {
      c.save();
      c.beginPath();
      c.rect(w.x0, w.y0, W, H);
      c.clip();
      // stín, kam sloupek dopadne
      const lr = landRow(w);
      c.globalAlpha = 0.28;
      for (let k = 0; k < 3; k++)
        c.drawImage(
          gemImg(pc.gems[k]),
          w.x0 + pc.col * CELL,
          w.y0 + (lr - 2 + k) * CELL,
          CELL,
          CELL,
        );
      c.globalAlpha = 1;
      const y = w.y0 + (pc.row + pc.frac - 2) * CELL;
      for (let k = 0; k < 3; k++)
        c.drawImage(
          gemImg(pc.gems[k]),
          w.x0 + pc.col * CELL,
          y + k * CELL,
          CELL,
          CELL,
        );
      c.restore();
    }
    // rozprsknuté drahokamy
    for (const pp of w.pops) {
      const k = pp.t / 0.6;
      c.globalAlpha = 1 - k;
      c.fillStyle = pp.v === MAGIC || pp.v < 0 ? "#fff" : COLORS[pp.v].c;
      for (let a = 0; a < 6; a++) {
        const an = (a * Math.PI) / 3 + pp.t * 3;
        c.beginPath();
        c.arc(
          pp.x + Math.cos(an) * k * 70,
          pp.y + Math.sin(an) * k * 70,
          9 * (1 - k) + 3,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.globalAlpha = 1;
    }

    // vedle studny: další sloupek a ukazatel úrovně
    const right = !g.spolu || w.p.idx === 1;
    const sx = right ? w.x0 + W + 40 : w.x0 - 40 - 130;
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, sx, w.y0, 130, 300, 22);
    c.fill();
    KIT.text(c, "DALŠÍ", sx + 65, w.y0 + 32, 30, "#fff");
    for (let k = 0; k < 3; k++)
      c.drawImage(
        gemImg(w.next.gems[k]),
        sx + 65 - 34,
        w.y0 + 58 + k * 74,
        68,
        68,
      );
    // úroveň: sloupec, který se plní
    const by = w.y0 + 340,
      bh = 420;
    c.fillStyle = "rgba(10,8,30,0.72)";
    KIT.roundRect(c, sx, by, 130, bh + 70, 22);
    c.fill();
    KIT.text(
      c,
      String(Math.min(w.level, levelsOf(w))),
      sx + 65,
      by + 38,
      46,
      "#ffd23d",
    );
    c.fillStyle = "rgba(255,255,255,0.12)";
    KIT.roundRect(c, sx + 40, by + 70, 50, bh - 20, 25);
    c.fill();
    const fh = (bh - 20) * (w.done ? 1 : w.bar);
    if (fh > 4) {
      if (!w.grad) {
        // ukazatel je pořád na stejném místě: gradient stačí vytvořit jednou
        w.grad = c.createLinearGradient(0, by + 70 + bh - 20, 0, by + 70);
        w.grad.addColorStop(0, "#5fd34a");
        w.grad.addColorStop(1, "#ffd23d");
      }
      c.fillStyle = w.grad;
      KIT.roundRect(c, sx + 40, by + 70 + bh - 20 - fh, 50, fh, 25);
      c.fill();
    }
    if (w.done) {
      c.fillStyle = "rgba(10,8,30,0.55)";
      c.fillRect(w.x0, w.y0, W, H);
      KIT.text(c, "HOTOVO!", w.x0 + W / 2, w.y0 + H / 2, 80, "#ffd23d");
    }
  }
})();
