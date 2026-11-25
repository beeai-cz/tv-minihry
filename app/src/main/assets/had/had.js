/* Had pro Matyho (3) a Nelu (5). Šipkami se točí, had sám leze a jí ovoce; každé ovoce řekne
 * svůj anglický název. Nedá se prohrát: okraje obrazovky jsou průchozí (vyleze na druhé straně),
 * přes sebe Maty prolézá bez trestu; Nela má na louce kameny a náraz do kamene nebo do sebe
 * jí jen ukousne kousek ocasu. Vyhrává se sesbíráním daného počtu ovoce. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;

  // Louka: 24 x 11 políček po 80 px pod horní lištou.
  const CELL = 80,
    COLS = 24,
    ROWS = 11,
    OY = 170;

  const FRUITS = [
    { img: "apple", en: "apple" },
    { img: "banana", en: "banana" },
    { img: "strawberry", en: "strawberry" },
    { img: "cherry", en: "cherries" },
    { img: "pear", en: "pear" },
    { img: "orange", en: "orange" },
    { img: "grapes", en: "grapes" },
    { img: "watermelon", en: "watermelon" },
    { img: "carrot", en: "carrot" },
    { img: "pineapple", en: "pineapple" },
    { img: "peach", en: "peach" },
    { img: "lemon", en: "lemon" },
    { img: "blueberry", en: "blueberries" },
  ];

  // ---------- Obrázky ----------
  const IMG = {};
  for (const n of ["snake-green", "snake-pink", "rock", "bush", "bg"].concat(
    FRUITS.map((f) => f.img),
  )) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = "img/" + n + (n === "bg" ? ".jpg" : ".png");
    IMG[n] = i;
  }
  const AV = {};
  for (const who of ["maty", "nela"]) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = TV.PLAYERS[who].avatar;
    AV[who] = i;
  }
  function sprite(i, w, h) {
    w = Math.max(8, Math.round(w / 8) * 8);
    h = Math.max(8, Math.round(h / 8) * 8);
    const cache = i.cache || (i.cache = new Map());
    const key = w * 4096 + h;
    let c = cache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = Math.round(w * RES);
      c.height = Math.round(h * RES);
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      cache.set(key, c);
    }
    return c;
  }
  /** Obrázek se středem v (x, y), delší strana = size, volitelně otočený. */
  function drawImg(name, x, y, size, rot) {
    const i = IMG[name];
    if (!i || !i.ok) {
      ctx.fillStyle = "#ff6b9a";
      ctx.beginPath();
      ctx.arc(x, y, size / 2.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const k = size / Math.max(i.naturalWidth, i.naturalHeight);
    const w = i.naturalWidth * k,
      h = i.naturalHeight * k;
    const s = sprite(i, w, h);
    if (!rot) {
      ctx.drawImage(s, x - w / 2, y - h / 2, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(s, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---------- Pomocné ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  const sayCs = (t) => TV.say(t, "cs-CZ");
  const cx = (c) => c * CELL + CELL / 2;
  const cy = (r) => OY + r * CELL + CELL / 2;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // ---------- Louka předkreslená do plátna ----------
  let field = null;
  function paintField() {
    field = document.createElement("canvas");
    field.width = 1920 * RES;
    field.height = 1080 * RES;
    const c = field.getContext("2d");
    c.scale(RES, RES);
    const bg = IMG.bg;
    if (bg && bg.ok) c.drawImage(bg, 0, 0, 1920, 1080);
    else {
      c.fillStyle = "#8fd16a";
      c.fillRect(0, 0, 1920, 1080);
    }
    // jemná šachovnice, ať jsou vidět políčka
    for (let r = 0; r < ROWS; r++)
      for (let k = 0; k < COLS; k++) {
        c.fillStyle =
          (r + k) % 2 ? "rgba(255,255,255,.10)" : "rgba(0,60,0,.06)";
        c.fillRect(k * CELL, OY + r * CELL, CELL, CELL);
      }
    c.fillStyle = "rgba(10,16,50,.55)";
    c.fillRect(0, 0, 1920, OY - 10);
  }

  // ---------- Stav, menu, párování ----------
  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    pair: null,
    game: null,
    raf: 0,
  };

  function showMenu() {
    cancelAnimationFrame(S.raf);
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Had");
    t.style.top = "60px";
    t.style.fontSize = "120px";
    screen.appendChild(t);
    const row = el("div", "choices");
    row.style.top = "300px";
    const both = el("div", "avatar-pair");
    both.append(avatarEl("maty"), avatarEl("nela"));
    for (const [id, node, label] of [
      ["maty", avatarEl("maty"), "Maty"],
      ["nela", avatarEl("nela"), "Nela"],
      ["spolu", both, "Spolu"],
    ]) {
      const c = el("div", "choice");
      c.dataset.id = id;
      c.append(node, el("div", "label", label));
      row.appendChild(c);
    }
    screen.appendChild(row);
    markFocus();
    sayCs("Kdo bude hrát?");
  }
  function markFocus() {
    screen
      .querySelectorAll(".choice")
      .forEach((c, i) => c.classList.toggle("focus", i === S.focus));
  }

  function showPairing() {
    S.screen = "pair";
    S.pair = { step: 0, devices: {} };
    renderPairing();
  }
  function renderPairing() {
    const p = S.pair;
    const box = el("div", "pair");
    box.appendChild(el("div", "pair-title", "Kdo má který ovladač?"));
    const row = el("div", "pair-row");
    ["maty", "nela"].forEach((who, i) => {
      const k = el(
        "div",
        "pair-kid" + (i === p.step ? " now" : "") + (i < p.step ? " ok" : ""),
      );
      k.append(
        avatarEl(who),
        el("div", "label", TV.PLAYERS[who].name),
        el(
          "div",
          "hint",
          i < p.step ? "✔ Připraven" : i === p.step ? "Zmáčkni tlačítko" : "",
        ),
      );
      row.appendChild(k);
    });
    box.appendChild(row);
    screen.replaceChildren(el("div", "menu-bg"), box);
    sayCs(
      (p.step === 0 ? "Maty" : "Nelo") + ", zmáčkni tlačítko na svém ovladači.",
    );
  }
  function pairKey(e) {
    const p = S.pair;
    if (!(e.name === "ok" || e.name === "action") || e.type !== "down") return;
    const who = p.step === 0 ? "maty" : "nela";
    if (p.step === 1 && e.device === p.devices.maty) {
      TV.sound.nope();
      return;
    }
    p.devices[who] = e.device;
    TV.sound.ding();
    p.step++;
    if (p.step < 2) renderPairing();
    else startGame();
  }

  // ---------- Hra ----------
  function makeSnake(who, row, n) {
    const segs = [];
    for (let k = 0; k < 4; k++) segs.push({ c: 6 - k, r: row });
    return {
      who,
      segs,
      prev: segs.map((s) => ({ ...s })),
      dir: [1, 0],
      queue: [],
      grow: 0,
      eaten: 0,
      step: n.hard ? 0.2 : 0.3,
      flash: 0,
    };
  }

  function startGame() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    const hard = S.mode === "nela";
    const g = {
      hard,
      devices: S.pair ? S.pair.devices : null,
      phase: "count",
      t: 0,
      acc: 0,
      fruits: [],
      rocks: [],
      pops: [],
      target: S.mode === "maty" ? 15 : S.mode === "nela" ? 25 : 30,
      endTimer: 0,
    };
    g.snakes = kids.map((k, i) =>
      makeSnake(k, kids.length > 1 ? (i === 0 ? 3 : 7) : 5, g),
    );
    if (hard) {
      // pár kamenů, ne u startu a ne ve stejném řádku jako had
      while (g.rocks.length < 7) {
        const c = ri(2, COLS - 3),
          r = ri(1, ROWS - 2);
        if (r === 5 || occupied(g, c, r) || (c < 10 && Math.abs(r - 5) < 2))
          continue;
        g.rocks.push({ c, r, kind: Math.random() < 0.5 ? "rock" : "bush" });
      }
    }
    for (let k = 0; k < (kids.length > 1 ? 3 : 2); k++) addFruit(g);
    S.game = g;
    S.screen = "game";
    paintField();
    screen.replaceChildren(
      el(
        "div",
        "count ready",
        kids.length > 1 ? "Připravte se!" : "Připrav se!",
      ),
    );
    sayCs(kids.length > 1 ? "Připravte se!" : "Připrav se!");
    const at = (ms, fn) =>
      setTimeout(() => {
        if (S.game === g && S.screen === "game") fn();
      }, ms);
    at(2000, () => showCount(3));
    at(3000, () => showCount(2));
    at(4000, () => showCount(1));
    at(5000, () => {
      showCount(0);
      g.phase = "play";
    });
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  function showCount(n) {
    screen.replaceChildren(el("div", "count", n > 0 ? String(n) : "Start!"));
    if (n > 0) {
      TV.sound.beep();
      sayCs(["", "Jedna", "Dva", "Tři"][n]);
    } else {
      TV.sound.go();
      sayCs("Start!");
      const g = S.game;
      setTimeout(() => {
        if (S.game === g && S.screen === "game") screen.replaceChildren();
      }, 800);
    }
  }

  function occupied(g, c, r) {
    for (const s of g.snakes || [])
      for (const p of s.segs) if (p.c === c && p.r === r) return true;
    for (const k of g.rocks) if (k.c === c && k.r === r) return true;
    for (const f of g.fruits) if (f.c === c && f.r === r) return true;
    return false;
  }
  function addFruit(g) {
    for (let tries = 0; tries < 200; tries++) {
      const c = ri(0, COLS - 1),
        r = ri(0, ROWS - 1);
      if (occupied(g, c, r)) continue;
      // ne hned před hlavou, ať je kam dojít
      let near = false;
      for (const s of g.snakes)
        if (Math.abs(s.segs[0].c - c) + Math.abs(s.segs[0].r - r) < 3)
          near = true;
      if (near) continue;
      g.fruits.push({ c, r, f: pick(FRUITS), t: 0 });
      return;
    }
    // pojistka: první volné políčko, ať ovoce nikdy nedojde
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!occupied(g, c, r)) {
          g.fruits.push({ c, r, f: pick(FRUITS), t: 0 });
          return;
        }
  }

  function playerSnake(e) {
    const g = S.game;
    if (g.snakes.length === 1) return g.snakes[0];
    const d = g.devices || {};
    if (e.device === d.maty) return g.snakes[0];
    if (e.device === d.nela) return g.snakes[1];
    return null;
  }
  function gameKey(e) {
    if (e.type !== "down") return;
    const s = playerSnake(e);
    const d = DIRS[e.name];
    if (!s || !d) return;
    // poslední plánovaný směr (nebo aktuální); obrátit se do sebe nejde
    const lastDir = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d[0] === -lastDir[0] && d[1] === -lastDir[1]) return;
    if (d[0] === lastDir[0] && d[1] === lastDir[1]) return;
    if (s.queue.length < 2) s.queue.push(d);
  }

  /** Hlava právě dojela na políčko segs[0] (konec animace kroku): sníst ovoce, Nela náraz. */
  function arrive(g, s) {
    const { c, r } = s.segs[0];
    for (let i = 0; i < g.fruits.length; i++) {
      const f = g.fruits[i];
      if (f.c !== c || f.r !== r) continue;
      g.fruits.splice(i, 1);
      s.grow += 1;
      s.eaten++;
      if (g.hard) s.step = Math.max(0.15, s.step - 0.003);
      g.pops.push({ x: cx(c), y: cy(r), t: 0, img: f.f.img });
      TV.sound.ding();
      TV.say(f.f.en, "en-US");
      addFruit(g);
      break;
    }
    // Nela: kámen nebo vlastní tělo = ukousne kousek ocasu (nikdy nekončí)
    if (g.hard && s.flash <= 0) {
      let bump = g.rocks.some((k) => k.c === c && k.r === r);
      for (let k = 1; k < s.segs.length && !bump; k++)
        if (s.segs[k].c === c && s.segs[k].r === r) bump = true;
      if (bump) {
        const lose = Math.min(3, s.segs.length - 3);
        for (let k = 0; k < lose; k++) {
          const t = s.segs.pop();
          s.prev.pop();
          g.pops.push({ x: cx(t.c), y: cy(t.r), t: 0, img: null });
        }
        s.flash = 1.2;
        TV.sound.bump();
      }
    }
  }

  function stepSnake(g, s) {
    arrive(g, s);
    if (s.queue.length) s.dir = s.queue.shift();
    const head = s.segs[0];
    // okraje jsou průchozí: vyleze na druhé straně
    const c = (head.c + s.dir[0] + COLS) % COLS,
      r = (head.r + s.dir[1] + ROWS) % ROWS;
    s.prev = s.segs.map((p) => ({ c: p.c, r: p.r }));
    s.segs.unshift({ c, r });
    if (s.grow > 0) {
      s.grow--;
      s.prev.push({ ...s.prev[s.prev.length - 1] });
    } else s.segs.pop();
  }

  function update(dt) {
    const g = S.game;
    g.t += dt;
    for (const f of g.fruits) f.t += dt;
    for (const p of g.pops) p.t += dt;
    if (g.pops.length && g.pops[0].t > 0.6) g.pops.shift();
    if (g.phase === "count") return;
    if (g.phase === "won") {
      g.endTimer += dt;
      if (g.endTimer > 1.5) showEnd();
      return;
    }
    for (const s of g.snakes) {
      s.flash = Math.max(0, s.flash - dt);
      s.acc = (s.acc || 0) + dt;
      while (s.acc >= s.step) {
        s.acc -= s.step;
        stepSnake(g, s);
      }
    }
    let total = 0;
    for (const s of g.snakes) total += s.eaten;
    if (total >= g.target) {
      g.phase = "won";
      g.endTimer = 0;
      TV.sound.match();
      TV.confetti(fx, 60);
    }
  }

  // ---------- Kreslení ----------
  function segPos(s, k, t) {
    const a = s.prev[k] || s.segs[k],
      b = s.segs[k];
    // přes okraj neplynule (skok na druhou stranu)
    if (Math.abs(a.c - b.c) > 1 || Math.abs(a.r - b.r) > 1)
      return [cx(b.c), cy(b.r)];
    return [cx(a.c + (b.c - a.c) * t), cy(a.r + (b.r - a.r) * t)];
  }
  function drawSnake(g, s) {
    const t = g.phase === "play" ? Math.min(1, (s.acc || 0) / s.step) : 1;
    const blink = s.flash > 0 && Math.floor(s.flash * 10) % 2;
    if (blink) ctx.globalAlpha = 0.35;
    const col = TV.PLAYERS[s.who].color;
    const dark = s.who === "maty" ? "#2f7a1f" : "#c23d6a";
    // tělo jako souvislá tlustá čára přes všechny články (přes okraj obrazovky se přeruší)
    const n = s.segs.length;
    const pts = s.pts || (s.pts = []);
    pts.length = 0;
    for (let k = 0; k < n; k++) pts.push(segPos(s, k, t));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? dark : col;
      ctx.lineWidth = pass === 0 ? CELL * 0.72 : CELL * 0.56;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < n; k++) {
        const [x, y] = pts[k];
        const [px, py] = pts[k - 1];
        if (Math.abs(x - px) > CELL * 1.5 || Math.abs(y - py) > CELL * 1.5) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // puntíky na zádech
    ctx.fillStyle = "rgba(255,255,255,.35)";
    for (let k = 2; k < n; k += 2) {
      const [x, y] = pts[k];
      ctx.beginPath();
      ctx.arc(x, y - 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const [hx, hy] = pts[0];
    const rot = Math.atan2(s.dir[1], s.dir[0]) + Math.PI / 2; // obrázek hlavy kouká nahoru
    drawImg(
      s.who === "maty" ? "snake-green" : "snake-pink",
      hx,
      hy,
      CELL * 1.35,
      rot,
    );
  }

  function draw() {
    const g = S.game;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    if (field) ctx.drawImage(field, 0, 0, 1920, 1080);
    for (const k of g.rocks) drawImg(k.kind, cx(k.c), cy(k.r), CELL * 1.05);
    for (const f of g.fruits)
      drawImg(
        f.f.img,
        cx(f.c),
        cy(f.r) + Math.sin(f.t * 4) * 4,
        CELL * (0.9 + Math.min(1, f.t * 4) * 0.1),
      );
    for (const s of g.snakes) drawSnake(g, s);
    for (const p of g.pops) {
      const k = p.t / 0.6;
      ctx.globalAlpha = 1 - k;
      if (p.img) drawImg(p.img, p.x, p.y - k * 60, CELL * (1 + k));
      else {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20 + k * 30, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // horní lišta: avatar, kolik snědl, kolik zbývá
    g.snakes.forEach((s, i) => {
      const x0 = i === 0 ? 30 : 1920 - 330;
      const a = AV[s.who];
      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + 55, 80, 50, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.clip();
      if (a && a.ok) ctx.drawImage(sprite(a, 104, 104), x0 + 3, 28, 104, 104);
      ctx.restore();
      drawImg("apple", x0 + 160, 80, 70);
      ctx.fillStyle = "#fff";
      ctx.font = '900 64px "Trebuchet MS", Roboto, sans-serif';
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.eaten), x0 + 205, 84);
    });
    // ukazatel: kolik ovoce zbývá do konce
    let total = 0;
    for (const s of g.snakes) total += s.eaten;
    const bx = 620,
      bw = 680;
    ctx.fillStyle = "rgba(255,255,255,.3)";
    roundRect(bx, 68, bw, 24, 12);
    ctx.fillStyle = "#ffd23d";
    if (total)
      roundRect(
        bx,
        68,
        Math.max(24, (bw * Math.min(total, g.target)) / g.target),
        24,
        12,
      );
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    if (S.screen !== "game" || !S.game) return;
    update(dt);
    if (S.screen !== "game") return;
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- Oslava ----------
  function showEnd() {
    const g = S.game;
    S.screen = "end";
    S.endAt = performance.now();
    S.focus = 0;
    cancelAnimationFrame(S.raf);
    TV.sound.win();
    TV.confetti(fx, 140);
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", "Hurá!"));
    const row = el("div", "end-players");
    for (const s of g.snakes) {
      const col = el("div", "end-player");
      col.append(
        avatarEl(s.who),
        el("div", "end-name", TV.PLAYERS[s.who].name),
        el("div", "end-stars", "🍎 " + s.eaten),
      );
      row.appendChild(col);
    }
    box.appendChild(row);
    const btns = el("div", "end-buttons");
    btns.append(el("div", "btn focus", "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    if (g.snakes.length === 1) {
      sayCs(
        g.snakes[0].who === "maty"
          ? "Hurá, Maty! Dokázal jsi to!"
          : "Hurá, Nelo! Dokázala jsi to!",
      );
    } else {
      const [a, b] = g.snakes;
      sayCs(
        a.eaten === b.eaten
          ? "Remíza! Oba jste byli skvělí!"
          : a.eaten > b.eaten
            ? "Vyhrál Maty! Oba jste byli skvělí!"
            : "Vyhrála Nela! Oba jste byli skvělí!",
      );
    }
  }

  // ---------- Ovládání ----------
  TV.onKey((e) => {
    const n = e.name;
    if (S.screen === "game") {
      gameKey(e);
      return;
    }
    if (e.type === "up") return;
    if (S.screen === "menu") {
      if (n === "left" && S.focus > 0) {
        S.focus--;
        TV.sound.move();
        markFocus();
      } else if (n === "right" && S.focus < 2) {
        S.focus++;
        TV.sound.move();
        markFocus();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        S.mode = ["maty", "nela", "spolu"][S.focus];
        S.pair = null;
        if (S.mode === "spolu") showPairing();
        else startGame();
      }
    } else if (S.screen === "pair") {
      pairKey(e);
    } else if (S.screen === "end" && performance.now() - S.endAt > 1800) {
      if (n === "left" || n === "right") {
        S.focus = 1 - S.focus;
        TV.sound.move();
        screen
          .querySelectorAll(".end .btn")
          .forEach((b, i) => b.classList.toggle("focus", i === S.focus));
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        if (S.focus === 0) startGame();
        else showMenu();
      }
    }
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.HAD = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
