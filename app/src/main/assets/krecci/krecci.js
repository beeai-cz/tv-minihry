/* Křečci domů (inspirace: logické hry se šipkami na podlaze ze SEGA Dreamcastu).
 * Křečci běží rovně a u keře zatočí doprava. Dítě kurzorem pokládá šipky (OK na políčku, pak šipka
 * směru), tlačítkem B nebo zeleným ▶ pustí křečky. Všichni v domečku = další úroveň. Když to nevyjde,
 * křečci se vrátí a zkouší se znovu; po neúspěších přijde nápověda, nakonec šipky položí hra sama.
 * Úrovně: krecci/levels.js (vygenerované a ověřené řešičem tools/krecci_levels.js). */
(function () {
  "use strict";

  const K = window.KRECCI;
  const LV = window.KRECCI_LEVELS;
  const DX = K.DX,
    DY = K.DY;
  const TICK = { maty: 0.42, nela: 0.32, spolu: 0.36 };
  const HINT_AT = { maty: 1, nela: 2, spolu: 2 };
  const GO = { x: 1240, y: 100, r: 62 };
  const BUDGET_X = 780;

  // ---------- kreslené náhrady obrázků ----------
  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 1920 * 0.75;
    bg.height = 1080 * 0.75;
    const c = bg.getContext("2d");
    c.scale(0.75, 0.75);
    const gr = c.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, "#9be36b");
    gr.addColorStop(1, "#4fae3a");
    c.fillStyle = gr;
    c.fillRect(0, 0, 1920, 1080);
    let s = 5;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const cols = ["#fff", "#ffd23d", "#ff8fb8", "#b9a6ff"];
    for (let k = 0; k < 160; k++) {
      const x = r() * 1920,
        y = r() * 1080;
      c.fillStyle = cols[k % 4];
      for (let a = 0; a < 5; a++) {
        c.beginPath();
        c.arc(
          x + Math.cos(a * 1.26) * 7,
          y + Math.sin(a * 1.26) * 7,
          5,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.fillStyle = "#ffb000";
      c.beginPath();
      c.arc(x, y, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawHamster(c, x, y, s, facing, step) {
    if (KIT.draw(c, step ? "ham2" : "ham1", x, y, s * 1.05, 0, facing < 0))
      return;
    c.save();
    c.translate(x, y);
    if (facing < 0) c.scale(-1, 1);
    const b = s * 0.42;
    // nožky
    c.fillStyle = "#f2b8a0";
    for (const fx of [-0.45, 0.35]) {
      c.beginPath();
      c.ellipse(
        b * fx + (step ? 4 : -4),
        b * 0.78,
        b * 0.18,
        b * 0.12,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.fillStyle = "#e9a23b";
    c.strokeStyle = "#7a4a12";
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(0, 0, b * 1.05, b * 0.82, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff3dc";
    c.beginPath();
    c.ellipse(b * 0.35, b * 0.25, b * 0.5, b * 0.45, 0, 0, Math.PI * 2);
    c.fill();
    // ucho
    c.fillStyle = "#e9a23b";
    c.beginPath();
    c.arc(b * 0.25, -b * 0.75, b * 0.24, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#ff9fb2";
    c.beginPath();
    c.arc(b * 0.25, -b * 0.75, b * 0.12, 0, Math.PI * 2);
    c.fill();
    // oko, nos, tvářička
    c.fillStyle = "#222";
    c.beginPath();
    c.arc(b * 0.62, -b * 0.22, b * 0.11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(b * 0.65, -b * 0.26, b * 0.04, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ff6f8f";
    c.beginPath();
    c.arc(b * 1.02, -b * 0.05, b * 0.08, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,120,140,0.45)";
    c.beginPath();
    c.arc(b * 0.6, b * 0.12, b * 0.13, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  function drawHouse(c, x, y, s) {
    if (KIT.draw(c, "house", x, y - s * 0.04, s * 0.98)) return;
    const w = s * 0.78,
      h = s * 0.5;
    c.save();
    c.translate(x, y + s * 0.18);
    c.lineWidth = 5;
    c.strokeStyle = "#5a3210";
    c.fillStyle = "#d9934a";
    c.fillRect(-w / 2, -h, w, h);
    c.strokeRect(-w / 2, -h, w, h);
    c.fillStyle = "#e14b3b";
    c.beginPath();
    c.moveTo(-w * 0.62, -h);
    c.lineTo(0, -h - s * 0.36);
    c.lineTo(w * 0.62, -h);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#3a2008";
    c.beginPath();
    c.arc(0, -h * 0.35, s * 0.15, Math.PI, 0);
    c.lineTo(s * 0.15, 0);
    c.lineTo(-s * 0.15, 0);
    c.fill();
    c.restore();
  }
  function drawBush(c, x, y, s) {
    if (KIT.draw(c, "hedge", x, y, s, s)) return;
    c.fillStyle = "#2f7d2a";
    KIT.roundRect(c, x - s / 2 + 3, y - s / 2 + 3, s - 6, s - 6, s * 0.25);
    c.fill();
    c.fillStyle = "#3f9b35";
    for (const [dx, dy] of [
      [-0.2, -0.2],
      [0.2, -0.15],
      [0, 0.15],
    ]) {
      c.beginPath();
      c.arc(x + dx * s, y + dy * s, s * 0.22, 0, Math.PI * 2);
      c.fill();
    }
  }
  function drawSeeds(c, x, y, s) {
    if (KIT.draw(c, "seeds", x, y, s * 0.5)) return;
    for (let k = 0; k < 5; k++) {
      c.save();
      c.translate(x + (k - 2) * s * 0.07, y + (k % 2) * s * 0.06);
      c.rotate(k * 0.7);
      c.fillStyle = "#3b3b3b";
      c.beginPath();
      c.ellipse(0, 0, s * 0.05, s * 0.09, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#e8e8e8";
      c.fillRect(-1.5, -s * 0.06, 3, s * 0.12);
      c.restore();
    }
  }
  /** Šipka na políčku (dlaždice s bílou šipkou). ghost = jen obrys (nápověda / výběr směru). */
  function drawArrow(c, x, y, s, d, col, ghost, alpha) {
    c.save();
    c.translate(x, y);
    c.globalAlpha = alpha == null ? 1 : alpha;
    if (!ghost) {
      c.fillStyle = col || "#ff8a3d";
      KIT.roundRect(c, -s * 0.42, -s * 0.42, s * 0.84, s * 0.84, s * 0.16);
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = "rgba(0,0,0,0.35)";
      c.stroke();
    }
    c.rotate((d * Math.PI) / 2);
    c.beginPath();
    c.moveTo(0, -s * 0.32);
    c.lineTo(s * 0.26, -s * 0.02);
    c.lineTo(s * 0.1, -s * 0.02);
    c.lineTo(s * 0.1, s * 0.3);
    c.lineTo(-s * 0.1, s * 0.3);
    c.lineTo(-s * 0.1, -s * 0.02);
    c.lineTo(-s * 0.26, -s * 0.02);
    c.closePath();
    c.fillStyle = ghost ? col || "#fff" : "#fff";
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = "rgba(0,0,0,0.5)";
    c.stroke();
    c.restore();
  }

  // ---------- úroveň ----------
  function levelsFor(g) {
    return LV[g.mode];
  }
  function loadLevel(g, n) {
    const def = levelsFor(g)[n - 1];
    g.level = n;
    g.def = def;
    g.L = K.parse(def.rows);
    const L = g.L;
    g.cell = Math.min(130, Math.floor(1640 / L.w), Math.floor(860 / L.h));
    g.bx = 960 - (L.w * g.cell) / 2;
    g.by = 190 + (860 - L.h * g.cell) / 2;
    g.arrows = new Int8Array(L.w * L.h).fill(-1);
    g.seeds = new Set(def.seeds);
    g.fails = 0;
    g.stops = 0;
    g.hint = null;
    resetHams(g);
    g.phase2 = "edit";
    // kurzory: kousek od prvního křečka
    const h0 = L.hams[0];
    g.players.forEach((p, i) => {
      p.cx = Math.min(L.w - 2, Math.max(1, h0.x + i));
      p.cy = h0.y;
      p.choosing = false;
      p.onGo = false;
    });
    g.toastAt = g.t;
    KIT.toast(("Úroveň " + n).toUpperCase(), 1400);
    if (def.k === 0) KIT.sayCs("Zmáčkni zelené tlačítko a křeček poběží domů.");
    else if (n === 1 || (n === 2 && g.mode === "maty"))
      KIT.sayCs(
        g.spolu
          ? "Položte šipku, aby křečci došli domů. Pak zmáčkněte zelené tlačítko."
          : "Polož šipku, aby křeček došel domů. Pak zmáčkni zelené tlačítko.",
      );
  }
  function resetHams(g) {
    g.hams = g.L.hams.map((m) => ({
      x: m.x,
      y: m.y,
      d: m.d,
      px: m.x,
      py: m.y,
      home: false,
      face: m.d === 3 ? -1 : 1,
      gone: 0,
    }));
  }
  const placed = (g) => g.arrows.reduce((n, a) => n + (a >= 0 ? 1 : 0), 0);
  const canPlace = (g, x, y) => K.free(g.L, x, y) && !g.L.house[y * g.L.w + x];

  function startRun(g) {
    if (g.phase2 !== "edit") return;
    for (const p of g.players) p.choosing = false;
    g.phase2 = "run";
    g.tick = 0;
    g.tickT = 0;
    g.seen = new Set([K.key(g.hams)]);
    TV.sound.go();
  }
  function stopRun(g, failed) {
    g.phase2 = "edit";
    resetHams(g);
    if (!failed) return;
    g.fails++;
    const h = HINT_AT[g.mode];
    const sol = g.def.sol;
    if (g.fails >= h + 2 && sol.length) {
      // pořád to nejde: šipky položí hra
      g.arrows.fill(-1);
      for (const [c, d] of sol) g.arrows[c] = d;
      g.hint = null;
      KIT.sayCs("Pomůžu ti. Teď zmáčkni zelené tlačítko.");
      return;
    }
    if (g.fails >= h + 1)
      // špatné šipky pryč
      for (let i = 0; i < g.arrows.length; i++)
        if (
          g.arrows[i] >= 0 &&
          !sol.some(([c, d]) => c === i && d === g.arrows[i])
        )
          g.arrows[i] = -1;
    if (g.fails >= h) {
      const miss = sol.find(([c, d]) => g.arrows[c] !== d);
      g.hint = miss || null;
    }
    KIT.sayCs("Skoro! Zkus to znovu!");
  }

  function stepRun(g) {
    for (const m of g.hams) {
      m.px = m.x;
      m.py = m.y;
    }
    K.step(g.L, g.arrows, g.hams);
    g.tick++;
    for (const m of g.hams) {
      if (m.x !== m.px) m.face = m.x > m.px ? 1 : -1;
      const i = m.y * g.L.w + m.x;
      if (g.seeds.has(i) && (m.x !== m.px || m.y !== m.py)) {
        g.seeds.delete(i);
        TV.sound.ding();
        for (const p of g.players) KIT.addStars(p, 1);
      }
      if (m.home && !m.counted) {
        m.counted = true;
        TV.sound.flip();
      }
    }
    if (g.hams.every((m) => m.home)) {
      g.phase2 = "win";
      g.winT = 0;
      for (const p of g.players) KIT.addStars(p, 3);
      TV.sound.win();
      TV.confetti(KIT.fx, 70);
      KIT.toast("Doma!", 1800);
      KIT.sayCs(
        g.hams.length > 1
          ? "Hurá! Všichni jsou doma!"
          : "Hurá! Křeček je doma!",
      );
      return;
    }
    const k = K.key(g.hams);
    if (g.seen.has(k) || g.tick > 300) {
      g.phase2 = "fail";
      g.winT = 0;
      TV.sound.miss();
      return;
    }
    g.seen.add(k);
  }

  // ---------- hra ----------
  KIT.game({
    title: "Křečci domů",
    res: 0.75,
    countdown: false,
    images: {
      ham1: "img/hamster1.png",
      ham2: "img/hamster2.png",
      house: "img/house.png",
      seeds: "img/seeds.png",
      hedge: "../bedynky/img/hedge.png",
    },
    init: paintBg,
    start(g) {
      loadLevel(g, 1);
    },
    key(g, p, e) {
      if (e.type === "up") return;
      const n = e.name;
      if (g.phase2 === "run") {
        if (n === "action" && e.type === "down") {
          // každé druhé ruční zastavení se počítá jako pokus (ať přijde nápověda)
          g.stops = (g.stops || 0) + 1;
          stopRun(g, g.stops % 2 === 0);
        }
        return;
      }
      if (g.phase2 !== "edit") return;
      const L = g.L;
      if (n === "action") {
        if (e.type === "down") startRun(g);
        return;
      }
      const dirs = { up: 0, right: 1, down: 2, left: 3 };
      if (n in dirs) {
        const d = dirs[n];
        if (p.choosing) {
          const i = p.cy * L.w + p.cx;
          if (g.arrows[i] < 0 && placed(g) >= g.def.k) {
            TV.sound.nope();
          } else {
            g.arrows[i] = d;
            TV.sound.flip();
            if (g.hint && g.hint[0] === i && g.hint[1] === d) g.hint = null;
          }
          p.choosing = false;
          return;
        }
        if (p.onGo) {
          if (d === 2) {
            p.onGo = false;
            TV.sound.move();
          }
          return;
        }
        const nx = p.cx + DX[d],
          ny = p.cy + DY[d];
        if (ny < 0) {
          p.onGo = true;
          TV.sound.move();
        } else if (nx >= 0 && nx < L.w && ny < L.h) {
          p.cx = nx;
          p.cy = ny;
          TV.sound.move();
        }
        return;
      }
      if (n === "ok" && e.type === "down") {
        if (p.onGo) {
          startRun(g);
          return;
        }
        const i = p.cy * L.w + p.cx;
        if (p.choosing) {
          p.choosing = false;
        } else if (g.arrows[i] >= 0) {
          g.arrows[i] = -1;
          TV.sound.miss();
        } else if (!canPlace(g, p.cx, p.cy)) {
          TV.sound.nope();
        } else if (placed(g) >= g.def.k) {
          TV.sound.nope();
          KIT.sayCs(
            g.def.k === 0
              ? "Zmáčkni zelené tlačítko."
              : "Všechny šipky už leží. Zmáčkni zelené tlačítko.",
          );
        } else {
          p.choosing = true;
          TV.sound.move();
        }
      }
    },
    update(g, dt) {
      if (g.phase2 === "run") {
        g.tickT += dt;
        const T = TICK[g.mode];
        if (g.tickT >= T) {
          g.tickT -= T;
          stepRun(g);
        }
      } else if (g.phase2 === "win") {
        g.winT += dt;
        if (g.winT > 2.6) {
          if (g.level >= levelsFor(g).length) {
            g.phase2 = "over";
            KIT.finish(g);
          } else loadLevel(g, g.level + 1);
        }
      } else if (g.phase2 === "fail") {
        g.winT += dt;
        if (g.winT > 1.2) stopRun(g, true);
      }
      for (const m of g.hams)
        if (m.home) m.gone = Math.min(1, m.gone + dt * 2.5);
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      const L = g.L,
        s = g.cell;
      // deska
      c.fillStyle = "rgba(40,80,20,0.35)";
      KIT.roundRect(c, g.bx - 16, g.by - 16, L.w * s + 32, L.h * s + 32, 28);
      c.fill();
      for (let y = 0; y < L.h; y++)
        for (let x = 0; x < L.w; x++) {
          const i = y * L.w + x;
          const cx = g.bx + x * s + s / 2,
            cy = g.by + y * s + s / 2;
          if (L.wall[i]) {
            drawBush(c, cx, cy, s);
            continue;
          }
          c.fillStyle = (x + y) % 2 ? "#f6e7b8" : "#fff3cf";
          c.fillRect(g.bx + x * s, g.by + y * s, s, s);
        }
      for (let y = 0; y < L.h; y++)
        for (let x = 0; x < L.w; x++) {
          const i = y * L.w + x;
          const cx = g.bx + x * s + s / 2,
            cy = g.by + y * s + s / 2;
          if (L.house[i]) drawHouse(c, cx, cy, s);
          if (g.seeds.has(i)) drawSeeds(c, cx, cy, s);
          if (g.arrows[i] >= 0) drawArrow(c, cx, cy, s, g.arrows[i], "#ff8a3d");
        }
      // nápověda: blikající šipka
      if (g.hint && g.phase2 === "edit") {
        const [hc, hd] = g.hint;
        const hx = g.bx + (hc % L.w) * s + s / 2,
          hy = g.by + Math.floor(hc / L.w) * s + s / 2;
        drawArrow(
          c,
          hx,
          hy,
          s,
          hd,
          "#ffd23d",
          true,
          0.35 + 0.45 * Math.abs(Math.sin(g.t * 4)),
        );
      }
      // křečci
      const T = TICK[g.mode];
      const k = g.phase2 === "run" ? Math.min(1, g.tickT / T) : 1;
      for (const m of g.hams) {
        if (m.gone >= 1) continue;
        const x = m.px + (m.x - m.px) * k,
          y = m.py + (m.y - m.py) * k;
        const step = g.phase2 === "run" && Math.floor(g.t * 8) % 2 === 0;
        const sc = 1 - m.gone;
        const cy =
          g.by +
          y * s +
          s / 2 -
          (g.phase2 === "run" ? Math.abs(Math.sin(g.t * 12)) * 6 : 0);
        drawHamster(c, g.bx + x * s + s / 2, cy, s * 0.82 * sc, m.face, step);
        if (g.phase2 === "edit" && !m.home) {
          // malá šipka: kam se křeček rozběhne
          const ax = g.bx + m.x * s + s / 2 + DX[m.d] * s * 0.42,
            ay = g.by + m.y * s + s / 2 + DY[m.d] * s * 0.42;
          drawArrow(c, ax, ay, s * 0.45, m.d, "#fff", true, 0.85);
        }
      }
      // kurzory
      if (g.phase2 === "edit")
        for (const p of g.players) {
          if (p.onGo) continue;
          const x = g.bx + p.cx * s,
            y = g.by + p.cy * s;
          const bob = Math.sin(g.t * 6) * 4;
          c.lineWidth = 9;
          c.strokeStyle = p.color;
          KIT.roundRect(
            c,
            x + 4 - bob / 2,
            y + 4 - bob / 2,
            s - 8 + bob,
            s - 8 + bob,
            18,
          );
          c.stroke();
          c.lineWidth = 3;
          c.strokeStyle = "#fff";
          c.stroke();
          if (p.choosing)
            for (let d = 0; d < 4; d++)
              drawArrow(
                c,
                x + s / 2 + DX[d] * s * 0.78,
                y + s / 2 + DY[d] * s * 0.78,
                s * 0.6,
                d,
                p.color,
                false,
                0.95,
              );
          if (g.spolu) KIT.drawAvatar(c, p.who, x + s - 8, y + 8, 22);
        }
      // horní lišta: kolik šipek zbývá a tlačítko ▶
      const left = g.def.k - placed(g);
      for (let i = 0; i < g.def.k; i++)
        drawArrow(
          c,
          BUDGET_X - (g.def.k - 1) * 50 + i * 100,
          100,
          90,
          1,
          i < left ? "#ff8a3d" : "rgba(255,255,255,0.25)",
        );
      const focus = g.players.some((p) => p.onGo);
      const pulse =
        g.phase2 === "edit" && (left === 0 || g.def.k === 0)
          ? Math.abs(Math.sin(g.t * 3)) * 10
          : 0;
      c.beginPath();
      c.arc(GO.x, GO.y, GO.r + pulse, 0, Math.PI * 2);
      c.fillStyle = g.phase2 === "run" ? "#e14b3b" : "#3fbf3a";
      c.fill();
      c.lineWidth = focus ? 12 : 6;
      c.strokeStyle = focus ? "#ffd23d" : "#fff";
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      if (g.phase2 === "run") c.rect(GO.x - 22, GO.y - 22, 44, 44);
      else {
        c.moveTo(GO.x - 18, GO.y - 30);
        c.lineTo(GO.x + 32, GO.y);
        c.lineTo(GO.x - 18, GO.y + 30);
      }
      c.fill();
      KIT.drawStars(c, g);
    },
  });
})();
