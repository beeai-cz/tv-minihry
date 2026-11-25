/* Chytačka pro Matyho (3) a Nelu (5). Ze stromu padá ovoce, dítě dole jezdí košíkem (šipky)
 * a chytá ho; chycené ovoce cinkne a řekne svůj anglický název. Spadlé ovoce se jen odkutálí
 * (žádný trest). Zlatá hvězda = +3. Od 4. úrovně občas padá mrak s deštěm nebo šiška: chycená
 * jen na chvilku rozhoupe košík. Úroveň končí po nachytání daného počtu ovoce. SPOLU = dva košíky. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // Výkon na TV: kreslení v polovičním rozlišení.
  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;

  // Ovoce a anglická slova stejně jako v Hadovi (nahrané klipy en-US sdílí obě hry).
  const FRUITS = [
    { img: "apple", en: "apple", col: "#e8352b" },
    { img: "banana", en: "banana", col: "#ffd93b" },
    { img: "strawberry", en: "strawberry", col: "#e8283c" },
    { img: "cherry", en: "cherries", col: "#b3122a" },
    { img: "pear", en: "pear", col: "#b5d33b" },
    { img: "orange", en: "orange", col: "#ff9a1f" },
    { img: "grapes", en: "grapes", col: "#8e44ad" },
    { img: "watermelon", en: "watermelon", col: "#3fa34d" },
    { img: "carrot", en: "carrot", col: "#ff7a1a" },
    { img: "pineapple", en: "pineapple", col: "#f2c230" },
    { img: "peach", en: "peach", col: "#ffb38a" },
    { img: "lemon", en: "lemon", col: "#fff04a" },
    { img: "blueberry", en: "blueberries", col: "#3b4fc4" },
  ];

  // ---------- Úrovně ----------
  // Úrovně jsou hlavně o rychlosti: ovoce padá kdekoli pod korunou, s každou úrovní rychleji.
  // speed = rychlost pádu (px/s), maxOn = kolik kusů najednou, gap = pauza mezi kusy (s),
  // wind = boční vítr (px/s), w = šířka košíku, hazard/star = šance na mrak či šišku / hvězdu,
  // gust = vítr mění směr.
  const LEVELS = {
    maty: [
      {
        speed: 140,
        maxOn: 1,
        gap: 1.2,
        wind: 0,
        w: 330,
        hazard: 0,
        star: 0.08,
      },
      { speed: 175, maxOn: 1, gap: 1.0, wind: 0, w: 320, hazard: 0, star: 0.1 },
      {
        speed: 210,
        maxOn: 1,
        gap: 0.9,
        wind: 0,
        w: 310,
        hazard: 0.08,
        star: 0.1,
      },
      {
        speed: 245,
        maxOn: 2,
        gap: 1.6,
        wind: 0,
        w: 300,
        hazard: 0.1,
        star: 0.1,
      },
      {
        speed: 280,
        maxOn: 2,
        gap: 1.4,
        wind: 30,
        w: 290,
        hazard: 0.12,
        star: 0.12,
      },
    ],
    nela: [
      {
        speed: 220,
        maxOn: 1,
        gap: 0.8,
        wind: 0,
        w: 300,
        hazard: 0,
        star: 0.08,
      },
      { speed: 265, maxOn: 1, gap: 0.7, wind: 0, w: 290, hazard: 0, star: 0.1 },
      {
        speed: 310,
        maxOn: 2,
        gap: 1.6,
        wind: 0,
        w: 280,
        hazard: 0.1,
        star: 0.1,
      },
      {
        speed: 355,
        maxOn: 2,
        gap: 1.4,
        wind: 40,
        w: 270,
        hazard: 0.12,
        star: 0.1,
      },
      {
        speed: 400,
        maxOn: 2,
        gap: 1.25,
        wind: 60,
        w: 260,
        hazard: 0.14,
        star: 0.12,
      },
      {
        speed: 440,
        maxOn: 3,
        gap: 1.3,
        wind: 80,
        w: 250,
        hazard: 0.16,
        star: 0.12,
        gust: true,
      },
      {
        speed: 480,
        maxOn: 3,
        gap: 1.15,
        wind: 100,
        w: 240,
        hazard: 0.18,
        star: 0.12,
        gust: true,
      },
      {
        speed: 520,
        maxOn: 3,
        gap: 1.0,
        wind: 110,
        w: 230,
        hazard: 0.2,
        star: 0.14,
        gust: true,
      },
    ],
  };
  const LEVEL_COUNT = { maty: 5, nela: 8, spolu: 6 };
  const TARGET = { maty: 8, nela: 12, spolu: 16 };
  // Kolik ovoce za sebou spadne vedle, než přijde „dárek“: padá pomaleji a déle visí (pořád ale jinde než košík).
  const ASSIST = { maty: 2, nela: 3 };
  // Dopad aspoň tak daleko od minulého kusu a od košíku, ať se pokaždé musí jet jinam.
  const JUMP = { maty: 330, nela: 400 };
  // Ovoce chvíli visí a třese se na větvi, ať dítě vidí, odkud spadne (Maty déle).
  const HANG = { maty: 0.9, nela: 0.55 };
  // Tolerance chycení navíc k šířce košíku (Maty má výrazně větší).
  const TOL = { maty: 45, nela: 15 };
  const MOVE = {
    maty: { max: 760, acc: 2400 },
    nela: { max: 1050, acc: 3600 },
  };
  const lvl = (who, n) => LEVELS[who][Math.min(n, LEVELS[who].length) - 1];

  // ---------- Scéna ----------
  const BASE_Y = 1025; // spodek košíku
  const GROUND_Y = 1000; // tráva, kam dopadá ovoce
  const TREE_W = 1500,
    TREE_X0 = 210,
    TREE_X1 = TREE_X0 + TREE_W;
  let SPAWN_Y = 310; // spodek koruny, odkud ovoce padá (dopočítá se z obrázku stromu)
  const SIZE = { fruit: 115, star: 105, cloud: 190, cone: 95 };
  const IN_BASKET = 95; // ovoce vykukující z košíku
  const RIM = 0.56; // výška okraje košíku nad dnem (zlomek výšky obrázku, nad ním je už jen madlo)

  // ---------- Obrázky ----------
  const IMG = {};
  function load(key, src) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = src;
    IMG[key] = i;
  }
  for (const n of [
    "basket-green",
    "basket-pink",
    "cloud",
    "sun",
    "tree",
    "fence",
    "bush",
  ])
    load(n, "img/" + n + ".png");
  load("bg", "img/bg.jpg");
  for (const f of FRUITS) load(f.img, "../had/img/" + f.img + ".png");
  const AV = {};
  for (const who of ["maty", "nela"]) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = TV.PLAYERS[who].avatar;
    AV[who] = i;
  }
  const iw = (i) => i.naturalWidth || i.width;
  const ih = (i) => i.naturalHeight || i.height;

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
  /** Obrázek se středem v (x, y), šířka w (výška podle poměru), k = zvětšení bez nového sprite. */
  function drawImg(name, x, y, w, rot, alpha, k) {
    const i = IMG[name];
    if (!i || !i.ok) return;
    const h = (w * ih(i)) / iw(i);
    const s = sprite(i, w, h);
    k = k || 1;
    const dw = w * k,
      dh = h * k;
    if (alpha != null && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    if (!rot) ctx.drawImage(s, x - dw / 2, y - dh / 2, dw, dh);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(s, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Náhradní obrázky (dokud nedorazí z Higgsfieldu) ----------
  function canvasOf(w, h, paint) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    paint(c.getContext("2d"), w, h);
    c.ok = true;
    return c;
  }
  function blob(c, pts, fill) {
    c.fillStyle = fill;
    for (const [x, y, r] of pts) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
  function face(c, x, y, r) {
    c.fillStyle = "#3a3a5a";
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.1, r * 0.1, 0, 7);
    c.arc(x + r * 0.35, y - r * 0.1, r * 0.1, 0, 7);
    c.fill();
    c.strokeStyle = "#3a3a5a";
    c.lineWidth = r * 0.09;
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y + r * 0.05, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();
  }
  function basketFake(col, dark) {
    return canvasOf(400, 260, (c) => {
      // tělo košíku (lichoběžník) s proplétáním
      c.beginPath();
      c.moveTo(10, 70);
      c.lineTo(390, 70);
      c.lineTo(345, 250);
      c.lineTo(55, 250);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.save();
      c.clip();
      c.strokeStyle = dark;
      c.lineWidth = 8;
      for (let y = 110; y < 250; y += 36) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(400, y);
        c.stroke();
      }
      for (let x = 30; x < 400; x += 44) {
        c.beginPath();
        c.moveTo(x, 70);
        c.lineTo(x + (200 - x) * 0.12, 250);
        c.stroke();
      }
      c.restore();
      c.lineWidth = 8;
      c.strokeStyle = dark;
      c.stroke();
      // okraj
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(18, 48);
      c.arcTo(398, 48, 398, 92, 20);
      c.arcTo(398, 92, 2, 92, 20);
      c.arcTo(2, 92, 2, 48, 20);
      c.arcTo(2, 48, 398, 48, 20);
      c.fill();
    });
  }
  function makeFallbacks() {
    const fake = {
      "basket-green": () => basketFake("#5cc93b", "#2f7a1f"),
      "basket-pink": () => basketFake("#ff6b9a", "#c23d6a"),
      cloud: () =>
        canvasOf(300, 190, (c) => {
          blob(
            c,
            [
              [80, 110, 60],
              [150, 80, 75],
              [225, 110, 60],
              [150, 130, 55],
            ],
            "#cfd8e6",
          );
          blob(
            c,
            [
              [80, 104, 55],
              [150, 74, 70],
              [225, 104, 55],
              [150, 124, 50],
            ],
            "#fff",
          );
          face(c, 150, 110, 55);
        }),
      sun: () =>
        canvasOf(200, 200, (c) => {
          c.strokeStyle = "#ffb52e";
          c.lineWidth = 14;
          c.lineCap = "round";
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            c.beginPath();
            c.moveTo(100 + Math.cos(a) * 70, 100 + Math.sin(a) * 70);
            c.lineTo(100 + Math.cos(a) * 92, 100 + Math.sin(a) * 92);
            c.stroke();
          }
          blob(c, [[100, 100, 58]], "#ffd23d");
          face(c, 100, 100, 50);
        }),
      tree: () =>
        canvasOf(1500, 500, (c) => {
          c.fillStyle = "#7a4a22";
          c.fillRect(700, 330, 100, 170);
          const pts = [];
          for (let x = 60; x <= 1440; x += 120)
            pts.push([x, 230 + ((x * 7) % 90), 120 + ((x * 13) % 40)]);
          for (let x = 120; x <= 1380; x += 160) pts.push([x, 90, 130]);
          blob(c, pts, "#3d8f3a");
          blob(
            c,
            pts.map(([x, y, r]) => [x - 10, y - 14, r * 0.8]),
            "#4fae47",
          );
          blob(
            c,
            pts.map(([x, y, r]) => [x - 24, y - 34, r * 0.4]),
            "#69c45a",
          );
        }),
      fence: () =>
        canvasOf(300, 150, (c) => {
          c.fillStyle = "#f4e6c8";
          c.strokeStyle = "#b08a5a";
          c.lineWidth = 5;
          c.fillRect(0, 50, 300, 22);
          c.strokeRect(0, 50, 300, 22);
          c.fillRect(0, 105, 300, 22);
          c.strokeRect(0, 105, 300, 22);
          for (let x = 20; x < 300; x += 70) {
            c.beginPath();
            c.moveTo(x, 150);
            c.lineTo(x, 22);
            c.lineTo(x + 20, 4);
            c.lineTo(x + 40, 22);
            c.lineTo(x + 40, 150);
            c.closePath();
            c.fill();
            c.stroke();
          }
        }),
      bush: () =>
        canvasOf(280, 170, (c) => {
          const pts = [
            [60, 120, 55],
            [130, 90, 70],
            [210, 115, 60],
            [140, 135, 50],
          ];
          blob(c, pts, "#2f7d2f");
          blob(
            c,
            pts.map(([x, y, r]) => [x - 8, y - 10, r * 0.75]),
            "#45a33f",
          );
        }),
    };
    for (const n in fake) if (!IMG[n].ok) IMG[n] = fake[n]();
    for (const f of FRUITS)
      if (!IMG[f.img].ok)
        IMG[f.img] = canvasOf(160, 160, (c) => {
          blob(c, [[80, 88, 64]], f.col);
          blob(c, [[58, 66, 18]], "rgba(255,255,255,.45)");
          c.fillStyle = "#3f9a2e";
          c.beginPath();
          c.ellipse(96, 22, 22, 10, -0.5, 0, Math.PI * 2);
          c.fill();
        });
    // hvězda a šiška nemají obrázek v zadání: kreslí se vždy
    IMG.star = canvasOf(200, 200, (c) => {
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 ? 42 : 92;
        c.lineTo(100 + Math.cos(a) * r, 106 + Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = "#ffd23d";
      c.fill();
      c.lineWidth = 9;
      c.lineJoin = "round";
      c.strokeStyle = "#e09a00";
      c.stroke();
      blob(c, [[84, 84, 12]], "rgba(255,255,255,.7)");
      face(c, 100, 112, 34);
    });
    IMG.cone = canvasOf(140, 190, (c) => {
      c.fillStyle = "#8a5a2b";
      c.beginPath();
      c.ellipse(70, 100, 52, 82, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#5e3a17";
      c.lineWidth = 6;
      for (let y = 40; y < 180; y += 26)
        for (let x = 30 + ((y / 26) % 2) * 20; x < 120; x += 40) {
          c.beginPath();
          c.arc(x, y, 16, 0.1 * Math.PI, 0.9 * Math.PI);
          c.stroke();
        }
    });
  }

  // ---------- Louka předkreslená do plátna (statická, kreslí se jen jednou) ----------
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
      const gr = c.createLinearGradient(0, 0, 0, 900);
      gr.addColorStop(0, "#6ec6ff");
      gr.addColorStop(1, "#d8f3ff");
      c.fillStyle = gr;
      c.fillRect(0, 0, 1920, 900);
      c.fillStyle = "#7ccf4f";
      c.fillRect(0, 900, 1920, 180);
      c.fillStyle = "#5fb53a";
      c.fillRect(0, 900, 1920, 14);
    }
    const put = (name, x, y, w) => {
      const i = IMG[name];
      const h = (w * ih(i)) / iw(i);
      c.drawImage(i, x - w / 2, y - h / 2, w, h);
      return h;
    };
    put("sun", 1800, 280, 190);
    // kmen od koruny až do trávy (za plotem), s kořeny, ať strom nevisí ve vzduchu
    const tx = (TREE_X0 + TREE_X1) / 2,
      // vršek kmene schovaný v koruně i u nižšího obrázku stromu
      tTop = Math.min(
        360,
        Math.min((TREE_W * ih(IMG.tree)) / iw(IMG.tree), 600) - 40,
      ),
      tBot = 990;
    c.fillStyle = "#7a4a22";
    c.beginPath();
    c.moveTo(tx - 62, tTop);
    c.lineTo(tx + 62, tTop);
    c.bezierCurveTo(tx + 70, 760, tx + 80, 900, tx + 150, tBot);
    c.lineTo(tx - 150, tBot);
    c.bezierCurveTo(tx - 80, 900, tx - 70, 760, tx - 62, tTop);
    c.fill();
    // kůra: pár svislých rýh a světlejší strana
    c.fillStyle = "#93602f";
    c.beginPath();
    c.moveTo(tx - 46, tTop);
    c.lineTo(tx - 10, tTop);
    c.bezierCurveTo(tx - 14, 760, tx - 30, 900, tx - 70, tBot);
    c.lineTo(tx - 120, tBot);
    c.bezierCurveTo(tx - 64, 900, tx - 54, 760, tx - 46, tTop);
    c.fill();
    c.strokeStyle = "#5e3818";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    for (const [dx, y0, y1] of [
      [22, 420, 560],
      [-28, 520, 680],
      [34, 640, 800],
      [-8, 760, 900],
    ]) {
      c.moveTo(tx + dx, y0);
      c.quadraticCurveTo(tx + dx + 8, (y0 + y1) / 2, tx + dx, y1);
    }
    c.stroke();
    // plot podél obzoru za košíkem
    const f = IMG.fence,
      fh = 150,
      fw = (fh * iw(f)) / ih(f);
    for (let x = 0; x < 1920; x += fw - 1) c.drawImage(f, x, 975 - fh, fw, fh);
    // strom: koruna přes horní část; vysoký obrázek se ořízne, ať nezakryje celou louku
    const t = IMG.tree;
    const th = (TREE_W * ih(t)) / iw(t);
    const hd = Math.min(th, 600);
    c.drawImage(t, 0, 0, iw(t), (ih(t) * hd) / th, TREE_X0, 0, TREE_W, hd);
    SPAWN_Y = Math.max(200, Math.min(380, hd * 0.62));
    put("bush", 130, 930, 280);
    put("bush", 1795, 935, 250);
  }

  // ---------- Pomocné ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  const sayCs = (t) => TV.say(t, "cs-CZ");

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
    const t = el("div", "title", "Chytačka");
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
  function makePlayer(who, x) {
    return {
      who,
      x,
      vx: 0,
      left: false,
      right: false,
      w: 300,
      h: 200,
      rimY: 850,
      stars: 0,
      starTxt: "★ 0",
      miss: 0,
      wobble: 0,
      rain: 0,
      hop: 0,
      inB: [], // poslední chycené ovoce, vykukuje z košíku
      img: who === "maty" ? "basket-green" : "basket-pink",
      spawnT: 0,
      spawned: 0,
      lastLand: -9999,
      lastLandAt: 0,
    };
  }
  function addStars(p, n) {
    p.stars += n;
    p.starTxt = "★ " + p.stars; // text se skládá jen při změně, ne v každém snímku
  }

  function startGame() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    paintField();
    const g = {
      mode: S.mode,
      devices: S.pair ? S.pair.devices : null,
      players:
        kids.length > 1
          ? [makePlayer("maty", 560), makePlayer("nela", 1360)]
          : [makePlayer(kids[0], 960)],
      items: [],
      pops: [],
      slots: [], // obrázky chyceného ovoce v ukazateli nahoře
      level: 1,
      maxLevel: LEVEL_COUNT[S.mode],
      target: TARGET[S.mode],
      count: 0,
      phase: "count",
      t: 0,
      windDir: 1,
      windNow: 0,
      gustT: 0,
      leaves: [],
      levelTxt: "",
    };
    for (let k = 0; k < 14; k++)
      g.leaves.push({
        x: rnd(0, 1920),
        y: rnd(250, 900),
        ph: rnd(0, 6),
        s: rnd(0.7, 1.2),
      });
    S.game = g;
    S.screen = "game";
    setLevel(g, 1);
    prewarm(g);
    const ready = kids.length > 1 ? "Připravte se!" : "Připrav se!";
    screen.replaceChildren(el("div", "count ready", ready));
    sayCs(ready);
    at(g, 2000, () => showCount(3));
    at(g, 3000, () => showCount(2));
    at(g, 4000, () => showCount(1));
    at(g, 5000, () => {
      showCount(0);
      g.phase = "play";
    });
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  /** Časovač jen pro tuhle hru: po návratu do menu nebo nové hře se nic nespustí. */
  function at(g, ms, fn) {
    setTimeout(() => {
      if (S.game === g && S.screen === "game") fn();
    }, ms);
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
      at(g, 800, () => {
        if (g.phase === "play") screen.replaceChildren();
      });
    }
  }

  function setLevel(g, n) {
    g.level = n;
    g.count = 0;
    g.slots.length = 0;
    g.items.length = 0;
    g.levelTxt = ("Úroveň " + n).toUpperCase();
    g.windDir = Math.random() < 0.5 ? -1 : 1;
    g.gustT = rnd(6, 9);
    for (const p of g.players) {
      const L = lvl(p.who, n);
      const i = IMG[p.img];
      p.w = L.w;
      p.h = (L.w * ih(i)) / iw(i);
      p.rimY = BASE_Y - p.h * RIM; // horní okraj košíku, ne madlo
      p.miss = 0;
      p.spawned = 0;
      p.lastLand = -9999;
      p.lastLandAt = 0;
      // SPOLU: Maty a Nela nezačínají ve stejnou chvíli
      p.spawnT = p.who === "nela" && g.players.length > 1 ? 1.1 : 0.3;
    }
  }
  function prewarm(g) {
    for (const f of FRUITS) {
      const i = IMG[f.img];
      sprite(i, SIZE.fruit, (SIZE.fruit * ih(i)) / iw(i));
      sprite(i, IN_BASKET, (IN_BASKET * ih(i)) / iw(i));
      const s = slotSize(g) * 0.95;
      sprite(i, s, (s * ih(i)) / iw(i));
    }
    for (const n of ["star", "cone", "cloud"]) {
      const i = IMG[n];
      sprite(i, SIZE[n], (SIZE[n] * ih(i)) / iw(i));
    }
    for (const p of g.players)
      for (const L of LEVELS[p.who]) {
        const i = IMG[p.img];
        sprite(i, L.w, (L.w * ih(i)) / iw(i));
      }
  }
  const slotSize = (g) => Math.min(72, 1120 / g.target);

  function playerOf(e) {
    const g = S.game;
    if (g.players.length === 1) return g.players[0];
    const d = g.devices || {};
    if (e.device === d.maty) return g.players[0];
    if (e.device === d.nela) return g.players[1];
    return null;
  }
  function gameKey(e) {
    const p = playerOf(e);
    if (!p) return;
    const down = e.type !== "up"; // repeat = pořád drží
    if (e.name === "left") p.left = down;
    else if (e.name === "right") p.right = down;
    else if (
      (e.name === "ok" || e.name === "action") &&
      e.type === "down" &&
      p.hop <= 0
    ) {
      // jen pro radost: košík poskočí (na chytání to nemá vliv)
      p.hop = 0.3;
      TV.sound.move();
    }
  }

  function playerByWho(g, who) {
    for (const p of g.players) if (p.who === who) return p;
    return g.players[0];
  }
  function activeFor(g, who) {
    let n = 0;
    for (const it of g.items)
      if (it.who === who && (it.st === "hang" || it.st === "fall")) n++;
    return n;
  }

  /** Rozsah dopadu pro hráče: celá koruna, ve SPOLU jen hráčova polovina (košíky se nepředjíždějí). */
  function spanFor(g, p) {
    const a = TREE_X0 + 60,
      b = TREE_X1 - 60,
      mid = (TREE_X0 + TREE_X1) / 2;
    if (g.players.length < 2) return [a, b];
    return p.who === "maty" ? [a, mid - 30] : [mid + 30, b];
  }

  /** Kam košík za čas t (s) z klidu nejdál dojede, včetně 0,3 s na reakci a tolerance chycení. */
  function reach(p, t) {
    const m = MOVE[p.who],
      ta = m.max / m.acc;
    t = Math.max(0, t - 0.3);
    const d =
      t <= ta ? 0.5 * m.acc * t * t : (m.max * ta) / 2 + m.max * (t - ta);
    return d + p.w * 0.42 + TOL[p.who];
  }

  /** Nový kus ze stromu: dopadne náhodně pod korunou, daleko od minulého kusu i od košíku. */
  function spawn(g, p) {
    const L = lvl(p.who, g.level);
    let kind = "fruit";
    if (p.spawned >= 2) {
      const r = Math.random();
      if (r < L.star) kind = "star";
      else if (r < L.star + L.hazard)
        kind = Math.random() < 0.5 ? "cloud" : "cone";
    }
    const assist = kind === "fruit" && p.miss >= ASSIST[p.who];
    const speed =
      L.speed *
      (kind === "cloud" ? 0.6 : kind === "star" ? 0.9 : 1) *
      (assist ? 0.75 : 1);
    // dárek padá rovně (bez větru), pomaleji a déle visí
    const vx =
      L.wind && !assist
        ? g.windDir * L.wind * rnd(0.8, 1.1) * (kind === "cloud" ? 0.6 : 1)
        : 0;
    const y0 = kind === "cloud" ? 190 : SPAWN_Y + rnd(-30, 15);
    const fallT = Math.max(0.5, (p.rimY - y0) / speed);
    const hang = kind === "cloud" ? 0.3 : HANG[p.who] * (assist ? 1.6 : 1);
    const landAt = g.t + hang + fallT;
    // Dopad náhodně pod korunou, ale jen tak daleko od minulého, kam košík za ten čas dojede
    // (0,3 s na reakci), a aspoň kus od minulého i od košíku, ať se pokaždé musí jet jinam.
    const [a0, b0] = spanFor(g, p);
    const fruit = kind === "fruit" || kind === "star";
    let a = a0,
      b = b0;
    if (fruit && p.lastLand > 0) {
      const maxD = reach(p, landAt - p.lastLandAt);
      a = Math.max(a0, p.lastLand - maxD);
      b = Math.min(b0, p.lastLand + maxD);
    }
    const far = Math.min(JUMP[p.who], (b - a) * 0.3);
    let land = rnd(a, b),
      best = -1;
    for (let k = 0; k < 12; k++) {
      const c = k ? rnd(a, b) : land;
      // mrak a šiška klidně i na stojící košík (dá se jim ujet)
      const score = Math.min(
        p.lastLand > 0 ? Math.abs(c - p.lastLand) / far : 1,
        fruit ? Math.abs(c - p.x) / (p.w * 0.6) : 1,
      );
      if (score > best) {
        best = score;
        land = c;
      }
      if (best >= 1) break;
    }
    // start nad dopadem (vítr ho během pádu posune); u kraje koruny se start ořízne
    const x0 = clamp(land - vx * fallT, TREE_X0 + 50, TREE_X1 - 50);
    if (fruit) {
      p.lastLand = clamp(x0 + vx * fallT, 60, 1860);
      p.lastLandAt = landAt;
    }
    const f = kind === "fruit" ? pick(FRUITS) : null;
    g.items.push({
      kind,
      img: f ? f.img : kind,
      en: f ? f.en : kind === "star" ? "star" : null,
      who: p.who,
      x: x0,
      y: y0,
      vx,
      vy: speed,
      st: "hang",
      t: 0,
      hang,
      size: SIZE[kind],
      rot: 0,
      a: 1,
      k: 1,
      by: null, // kdo chytil
    });
    p.spawned++;
  }

  function catchItem(g, it, p) {
    it.st = "caught";
    it.t = 0;
    it.by = p;
    playerByWho(g, it.who).spawnT = Math.max(
      playerByWho(g, it.who).spawnT,
      0.5,
    );
    if (it.kind === "fruit") {
      addStars(p, 1);
      p.miss = 0;
      g.count++;
      g.slots.push(it.img);
      p.inB.push(it.img);
      if (p.inB.length > 3) p.inB.shift();
      TV.sound.ding();
      TV.say(it.en, "en-US");
    } else if (it.kind === "star") {
      addStars(p, 3);
      g.pops.push({ x: p.x, y: p.rimY - 160, t: 0 });
      TV.sound.match();
      TV.say("star", "en-US");
    } else {
      // mrak nebo šiška: jen se zhoupne košík, žádný trest
      p.wobble = 1;
      if (it.kind === "cloud") p.rain = 1;
      TV.sound.miss();
      sayCs("Hups!");
    }
  }

  function update(dt) {
    const g = S.game;
    g.t += dt;

    // vítr: od 6. úrovně Nely občas změní směr, lístky ukazují, kam fouká
    let windMax = 0,
      gust = false;
    for (const p of g.players) {
      const L = lvl(p.who, g.level);
      windMax = Math.max(windMax, L.wind);
      if (L.gust) gust = true;
    }
    if (gust && g.phase === "play") {
      g.gustT -= dt;
      if (g.gustT <= 0) {
        g.windDir = -g.windDir;
        g.gustT = rnd(6, 9);
      }
    }
    g.windNow += (g.windDir * windMax - g.windNow) * Math.min(1, dt * 1.2);
    if (Math.abs(g.windNow) > 5)
      for (const l of g.leaves) {
        l.x += g.windNow * 4 * l.s * dt;
        l.y += (40 + Math.sin(g.t * 2 + l.ph) * 60) * dt;
        l.ph += dt * 3;
        if (l.x > 1980) l.x = -60;
        if (l.x < -60) l.x = 1980;
        if (l.y > 950) l.y = 250;
      }

    // košíky: plynulý rozjezd i brzdění
    for (const p of g.players) {
      const m = MOVE[p.who];
      const want = (p.right ? 1 : 0) - (p.left ? 1 : 0);
      if (want) {
        if (want * p.vx < 0) p.vx *= 0.5; // rychlé otočení
        p.vx = clamp(p.vx + want * m.acc * dt, -m.max, m.max);
      } else {
        const d = 5200 * dt;
        p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d;
      }
      p.x += p.vx * dt;
      if (p.x < p.w / 2) {
        p.x = p.w / 2;
        p.vx = 0;
      } else if (p.x > 1920 - p.w / 2) {
        p.x = 1920 - p.w / 2;
        p.vx = 0;
      }
      p.wobble = Math.max(0, p.wobble - dt);
      p.rain = Math.max(0, p.rain - dt);
      p.hop = Math.max(0, p.hop - dt);
    }
    // SPOLU: košíky se nepřekrývají, Maty je vždy vlevo od Nely (ten, kdo vjíždí, zastaví)
    if (g.players.length > 1) {
      const [m, n] = g.players;
      const d = m.x + m.w / 2 + 10 - (n.x - n.w / 2);
      if (d > 0) {
        const vm = Math.max(0, m.vx),
          vn = Math.max(0, -n.vx);
        const fm = vm + vn > 0 ? vm / (vm + vn) : 0.5;
        m.x -= d * fm;
        n.x += d * (1 - fm);
        if (m.vx > 0) m.vx = 0;
        if (n.vx < 0) n.vx = 0;
        if (m.x < m.w / 2) {
          n.x += m.w / 2 - m.x;
          m.x = m.w / 2;
        }
        if (n.x > 1920 - n.w / 2) {
          m.x -= n.x - (1920 - n.w / 2);
          n.x = 1920 - n.w / 2;
        }
      }
    }

    // nové kusy ze stromu
    if (g.phase === "play")
      for (const p of g.players) {
        const L = lvl(p.who, g.level);
        p.spawnT -= dt;
        if (p.spawnT <= 0 && activeFor(g, p.who) < L.maxOn) {
          spawn(g, p);
          p.spawnT = L.gap * rnd(0.85, 1.15);
        }
      }

    // padající, chycené a odkutálené kusy
    for (const it of g.items) {
      it.t += dt;
      if (it.st === "hang") {
        if (it.t >= it.hang) {
          it.st = "fall";
          it.t = 0;
        }
      } else if (it.st === "fall") {
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        if (it.kind === "cloud") it.x += Math.sin(it.t * 2) * 25 * dt;
        if (it.kind === "star") it.rot += 2.5 * dt;
        if (it.x < 60 || it.x > 1860) {
          it.x = clamp(it.x, 60, 1860);
          it.vx = 0;
        }
        for (const p of g.players) {
          if (it.y < p.rimY - 5 || it.y > p.rimY + p.h * 0.15) continue;
          // mrak a šiška mají užší zásah, ať se dají snadno objet
          const tol =
            it.kind === "cloud" || it.kind === "cone"
              ? p.w * 0.35
              : p.w * 0.42 + TOL[p.who];
          if (Math.abs(it.x - p.x) < tol) {
            catchItem(g, it, p);
            break;
          }
        }
        if (it.st === "fall" && it.y >= GROUND_Y - it.size * 0.35) {
          // dopad do trávy: jen se odkutálí a zmizí
          it.st = "ground";
          it.t = 0;
          it.y = GROUND_Y - it.size * 0.35;
          it.roll =
            (it.vx ? Math.sign(it.vx) : Math.random() < 0.5 ? -1 : 1) *
            rnd(90, 150);
          const owner = playerByWho(g, it.who);
          if (it.kind === "fruit") owner.miss++;
          owner.spawnT = Math.max(owner.spawnT, 0.5);
        }
      } else if (it.st === "ground") {
        if (it.kind === "cloud") it.y -= 40 * dt;
        else {
          it.x += it.roll * dt;
          it.rot += (it.roll / (it.size / 2)) * dt;
        }
        it.a = 1 - it.t / 1.2;
      } else if (it.st === "caught") {
        // vletí do košíku a zmenší se
        const p = it.by;
        const k = Math.min(1, it.t / 0.25);
        it.x += (p.x - it.x) * k;
        it.y += (p.rimY + 30 - it.y) * k; // zapadne za přední stěnu košíku
        it.k = 1 - k * 0.5;
        it.a = it.kind === "fruit" ? 1 : 1 - k;
      } else if (it.st === "poof") {
        it.a = 1 - it.t / 0.4;
        it.k = 1 + it.t;
      }
    }
    // smazat hotové (na místě, bez nového pole)
    let j = 0;
    for (const it of g.items) {
      const done =
        (it.st === "ground" && it.t >= 1.2) ||
        (it.st === "caught" && it.t >= 0.25) ||
        (it.st === "poof" && it.t >= 0.4);
      if (!done) g.items[j++] = it;
    }
    g.items.length = j;
    for (const pp of g.pops) pp.t += dt;
    if (g.pops.length && g.pops[0].t >= 1) g.pops.shift();

    if (g.phase === "play" && g.count >= g.target) levelDone(g);
  }

  function levelDone(g) {
    g.phase = "levelup";
    for (const it of g.items)
      if (it.st === "hang" || it.st === "fall") {
        it.st = "poof";
        it.t = 0;
      }
    // bez konfet: DOM animace souběžně s canvas smyčkou by na slabé TV trhala (konfety až v cíli)
    TV.sound.match();
    const lv = g.level;
    if (lv >= g.maxLevel) {
      at(g, 1600, showEnd);
      return;
    }
    screen.replaceChildren(el("div", "count ready", "Výborně!"));
    TV.say("Great job!", "en-US");
    at(g, 1800, () => {
      setLevel(g, lv + 1);
      screen.replaceChildren(el("div", "count ready", "Úroveň " + (lv + 1)));
      sayCs(g.players.length > 1 ? "Připravte se!" : "Připrav se!");
    });
    at(g, 3600, () => {
      screen.replaceChildren();
      g.phase = "play";
    });
  }

  // ---------- Kreslení ----------
  function drawItem(g, it) {
    let x = it.x,
      rot = it.rot;
    if (it.st === "hang") {
      // třese se na větvi a „naroste“
      x += Math.sin(it.t * 30) * 5;
      rot = Math.sin(it.t * 24) * 0.12;
    }
    const grow = it.st === "hang" ? Math.min(1, 0.4 + it.t * 3) : it.k;
    if (it.kind === "cloud" && (it.st === "fall" || it.st === "hang")) {
      // déšť pod mrakem
      ctx.strokeStyle = "rgba(80,150,255,.75)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const dx = -60 + k * 30;
        const dy = 50 + ((g.t * 260 + k * 37) % 90);
        ctx.moveTo(x + dx, it.y + dy);
        ctx.lineTo(x + dx - 4, it.y + dy + 18);
      }
      ctx.stroke();
    }
    drawImg(it.img, x, it.y, it.size, rot, it.a, grow);
  }

  function drawBasket(g, p) {
    const hopY = p.hop > 0 ? Math.sin((p.hop / 0.3) * Math.PI) * 40 : 0;
    ctx.save();
    ctx.translate(p.x, BASE_Y - hopY);
    if (p.wobble > 0) ctx.rotate(Math.sin(g.t * 22) * 0.14 * p.wobble);
    // chycené ovoce vykukuje z košíku
    const n = p.inB.length;
    for (let k = 0; k < n; k++)
      drawImg(
        p.inB[k],
        (k - (n - 1) / 2) * p.w * 0.22,
        -p.h * (RIM + 0.04),
        IN_BASKET,
      );
    drawImg(p.img, 0, -p.h / 2, p.w);
    ctx.restore();
    if (p.rain > 0) {
      ctx.globalAlpha = 0.8 * p.rain;
      ctx.strokeStyle = "#5096ff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const dx = (k - 2.5) * p.w * 0.15;
        const dy = (g.t * 300 + k * 41) % 120;
        ctx.moveTo(p.x + dx, p.rimY - 240 + dy);
        ctx.lineTo(p.x + dx - 4, p.rimY - 222 + dy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const g = S.game;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    if (field) ctx.drawImage(field, 0, 0, 1920, 1080);
    // lístky ve větru
    const wa = Math.min(1, Math.abs(g.windNow) / 60);
    if (wa > 0.05) {
      ctx.globalAlpha = wa;
      ctx.fillStyle = "#4fae47";
      for (const l of g.leaves) {
        ctx.beginPath();
        ctx.ellipse(
          l.x,
          l.y,
          16 * l.s,
          8 * l.s,
          Math.sin(l.ph) * 0.8,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const it of g.items) drawItem(g, it);
    for (const p of g.players) drawBasket(g, p);
    // +3 nad košíkem po chycené hvězdě
    ctx.font = '900 80px "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pp of g.pops) {
      ctx.globalAlpha = Math.max(0, 1 - pp.t);
      ctx.fillStyle = "#ffd23d";
      ctx.fillText("+3", pp.x, pp.y - pp.t * 120);
      drawImg("star", pp.x - 100, pp.y - pp.t * 120, 70, 0, 1 - pp.t);
    }
    ctx.globalAlpha = 1;

    // horní lišta: avatar a hvězdičky každého hráče
    ctx.textAlign = "left";
    ctx.font = '900 60px "Trebuchet MS", Roboto, sans-serif';
    for (let i = 0; i < g.players.length; i++) {
      const p = g.players[i];
      const x0 = i === 0 ? 30 : 1920 - 330;
      ctx.fillStyle = "rgba(10,16,50,.55)";
      roundRect(x0, 20, 300, 110, 55);
      const a = AV[p.who];
      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + 55, 75, 45, 0, Math.PI * 2);
      ctx.fillStyle = TV.PLAYERS[p.who].color;
      ctx.fill();
      ctx.clip();
      if (a && a.ok) ctx.drawImage(sprite(a, 90, 90), x0 + 10, 30, 90, 90);
      ctx.restore();
      ctx.fillStyle = "#ffd23d";
      ctx.fillText(p.starTxt, x0 + 120, 78);
    }
    // ukazatel uprostřed: políčka, která se plní chyceným ovocem
    const s = slotSize(g),
      n = g.target,
      x0 = 960 - ((n - 1) * s) / 2;
    ctx.fillStyle = "rgba(10,16,50,.55)";
    roundRect(x0 - s * 0.75, 30, (n - 1) * s + s * 1.5, s + 20, (s + 20) / 2);
    ctx.fillStyle = "rgba(255,255,255,.3)";
    for (let k = 0; k < n; k++) {
      if (k < g.slots.length)
        drawImg(g.slots[k], x0 + k * s, 40 + s / 2, s * 0.95);
      else {
        ctx.beginPath();
        ctx.arc(x0 + k * s, 40 + s / 2, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.textAlign = "center";
    ctx.font = '900 40px "Trebuchet MS", Roboto, sans-serif';
    ctx.fillStyle = "#fff";
    ctx.fillText(g.levelTxt, 960, 40 + s + 45);
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
    for (const p of g.players) {
      const col = el("div", "end-player");
      col.append(
        avatarEl(p.who),
        el("div", "end-name", TV.PLAYERS[p.who].name),
        el("div", "end-stars", "★ " + p.stars),
      );
      row.appendChild(col);
    }
    box.appendChild(row);
    const btns = el("div", "end-buttons");
    btns.append(el("div", "btn focus", "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    if (g.players.length === 1) {
      const p = g.players[0];
      sayCs([
        p.who === "maty"
          ? "Hurá, Maty! Dokázal jsi to!"
          : "Hurá, Nelo! Dokázala jsi to!",
        p.stars === 0
          ? "Tentokrát nemáš žádnou hvězdičku."
          : p.stars >= 200 // csNumber od 200 vrací číslice
            ? "Máš spoustu hvězdiček!"
            : "Máš " +
              TV.csCount(p.stars, ["hvězdičku", "hvězdičky", "hvězdiček"]) +
              "!",
      ]);
    } else {
      sayCs("Hurá! Oba jste to zvládli!");
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
      // chvíli nereagovat, ať držená šipka nebo tlačítko hned nespustí novou hru
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

  // přepnutí appky: puštěné šipky by se ztratily a košík by jel sám
  TV.onPause(() => {
    if (S.game) for (const p of S.game.players) p.left = p.right = false;
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.CHYTACKA = S; // ladění v náhledu
  TV.ready(
    () => {
      makeFallbacks(); // chybějící obrázky nahradit nakreslenými, pak už se kreslí vše stejně
      showMenu();
    },
    Object.values(IMG).concat(Object.values(AV)),
    [],
  );
})();
