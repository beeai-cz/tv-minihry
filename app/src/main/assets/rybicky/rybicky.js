/* Rybičky pro Matyho (3) a Nelu (5). Pohled z boku pod vodou, D-pad plave všemi směry (i šikmo),
 * OK = krátké „šup“ dopředu. Menší rybky (pod 0,9 mé velikosti) sním a rostu, větší mě „spolknou“
 * jen naoko: zmenším se o kousek, bliknu a chvíli jsem nedotknutelný. Nedá se prohrát.
 * Úroveň končí, když dorostu (ukazatel nahoře); v poslední je legrační žralok, kterého nakonec spolknu. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // Výkon na TV: kreslení v polovičním rozlišení (jako ostatní hry).
  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;
  const TAU = Math.PI * 2;

  // Hranice vody: nahoře lišta, dole písek.
  const TOP = 170;
  const BOTTOM = 1000;
  const S0 = 120; // velikost (šířka) rybičky na začátku každé úrovně
  const FULL = 250; // dorostlá rybička v běžné úrovni
  const SHARK_SIZE = 300;
  const ACC = 1500; // zrychlení a odpor vody -> max. rychlost asi ACC / DRAG
  const DRAG = 2.8;

  // ---------- Úrovně ----------
  // need = kolik soust do dorostení, small/mid/big/puffer = kolik takových ryb je naráz ve vodě,
  // *F = velikost vůči rybičce hráče, *Spd = rychlost px/s, shark = rychlost žraloka (poslední úroveň).
  const HI_SAY = "Papej menší rybičky!";
  const DANGER_SAY = "Pozor na velké ryby!";
  const SHARK_SAY = "Pozor, žralok!";
  const LEVELS = {
    // Maty: velké ryby vzácné a pomalé, málo soust, 4 úrovně
    maty: [
      { need: 5, small: 6, spd: [45, 80], say: HI_SAY },
      {
        need: 6,
        small: 6,
        mid: 1,
        midF: [1, 1.15],
        midSpd: [35, 55],
        spd: [50, 90],
        say: DANGER_SAY,
      },
      {
        need: 7,
        small: 6,
        mid: 1,
        midF: [1, 1.15],
        midSpd: [40, 60],
        big: 1,
        bigF: [1.3, 1.55],
        bigSpd: [40, 60],
        puffer: 1,
        spd: [55, 95],
      },
      {
        need: 7,
        full: 360,
        small: 7,
        spd: [55, 95],
        shark: 55,
        flee: 110,
        say: SHARK_SAY,
      },
    ],
    nela: [
      { need: 8, small: 7, spd: [70, 120], say: HI_SAY },
      {
        need: 9,
        small: 6,
        mid: 2,
        midF: [1, 1.25],
        midSpd: [50, 80],
        spd: [80, 140],
        say: DANGER_SAY,
      },
      {
        need: 10,
        small: 6,
        mid: 1,
        midF: [1, 1.25],
        midSpd: [70, 100],
        big: 2,
        bigF: [1.35, 1.8],
        bigSpd: [70, 110],
        puffer: 1,
        spd: [100, 170],
      },
      {
        need: 11,
        small: 6,
        mid: 2,
        midF: [1, 1.25],
        midSpd: [80, 120],
        big: 2,
        bigF: [1.4, 2],
        bigSpd: [100, 150],
        puffer: 1,
        spd: [120, 190],
      },
      {
        need: 12,
        small: 6,
        mid: 2,
        midF: [1, 1.25],
        midSpd: [100, 140],
        big: 3,
        bigF: [1.4, 2.1],
        bigSpd: [120, 180],
        puffer: 2,
        spd: [140, 220],
      },
      {
        need: 13,
        full: 360,
        small: 7,
        mid: 2,
        midF: [1, 1.2],
        midSpd: [80, 120],
        puffer: 1,
        spd: [130, 210],
        shark: 90,
        flee: 170,
        say: SHARK_SAY,
      },
    ],
    // Spolu: need je Nelin, Maty potřebuje 70 % (a dorostlá rybka posílá sousta kamarádovi)
    spolu: [
      { need: 7, small: 8, spd: [60, 110], say: "Papejte menší rybičky!" },
      {
        need: 8,
        small: 7,
        mid: 2,
        midF: [1, 1.2],
        midSpd: [45, 70],
        spd: [70, 120],
        say: DANGER_SAY,
      },
      {
        need: 9,
        small: 7,
        mid: 1,
        midF: [1, 1.2],
        midSpd: [55, 80],
        big: 1,
        bigF: [1.35, 1.7],
        bigSpd: [60, 90],
        puffer: 1,
        spd: [80, 140],
      },
      {
        need: 10,
        small: 7,
        mid: 2,
        midF: [1, 1.2],
        midSpd: [70, 100],
        big: 2,
        bigF: [1.35, 1.8],
        bigSpd: [80, 120],
        puffer: 1,
        spd: [100, 160],
      },
      {
        need: 11,
        full: 360,
        small: 8,
        mid: 1,
        midF: [1, 1.2],
        midSpd: [60, 90],
        puffer: 1,
        spd: [90, 150],
        shark: 75,
        flee: 150,
        say: SHARK_SAY,
      },
    ],
  };
  const SMALL_F = [0.42, 0.72];
  const NPC = ["fish-yellow", "fish-blue", "fish-orange", "fish-purple"];
  // poloměr těla vůči šířce obrázku (žralok je dlouhý a nízký, ježík kulatý)
  // [poloosa x, poloosa y] těla vůči šířce obrázku, změřeno na img/*.png (oříznuté na obrys):
  // ryby 240x176-196 (tělo bez ocasu a ploutví asi 0,8 x 0,6), žralok 420x289 (dlouhý, nízký,
  // ploutev nahoře se nepočítá), ježík 240x227 (kulatý, ostny se nepočítají).
  const BODY = {
    fish: [0.4, 0.29],
    player: [0.4, 0.3],
    shark: [0.44, 0.24],
    puffer: [0.4, 0.38],
  };

  // ---------- Obrázky ----------
  const NAMES = [
    "fish-green",
    "fish-pink",
    "fish-yellow",
    "fish-blue",
    "fish-orange",
    "fish-purple",
    "shark",
    "puffer",
    "starfish",
    "bg",
  ];
  const IMG = {};
  for (const n of NAMES) {
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

  // Náhradní kresby, dokud obrázky nejsou: nakreslí se jednou do plátna a dál se chovají jako obrázek.
  const FALL = {};
  function art(name) {
    const i = IMG[name];
    if (i && i.ok) return i;
    return FALL[name] || (FALL[name] = makeFallback(name));
  }
  const aspect = (src) =>
    src.naturalWidth
      ? src.naturalHeight / src.naturalWidth
      : src.height / src.width;
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
  /** Obrázek se středem v (x, y), šířka w; sx < 0 = zrcadlo (ryby v obrázku plavou doprava). */
  function drawArt(name, x, y, w, sx, sy, rot, alpha) {
    const src = art(name);
    const h = w * aspect(src);
    const s = sprite(src, w, h);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (alpha != null) ctx.globalAlpha = Math.max(0, alpha);
    ctx.drawImage(s, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  const FISH_COLORS = {
    "fish-green": "#5cc93b",
    "fish-pink": "#ff6b9a",
    "fish-yellow": "#ffd23d",
    "fish-blue": "#4da6ff",
    "fish-orange": "#ff8a3d",
    "fish-purple": "#a77bff",
  };
  function makeFallback(name) {
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    if (FISH_COLORS[name]) {
      c.width = 400;
      c.height = 260;
      fishArt(x, FISH_COLORS[name]);
    } else if (name === "shark") {
      c.width = 640;
      c.height = 300;
      sharkArt(x);
    } else if (name === "puffer") {
      c.width = 320;
      c.height = 300;
      pufferArt(x);
    } else if (name === "starfish") {
      c.width = 260;
      c.height = 260;
      starPath(x, 130, 135, 122, 54);
      x.fillStyle = "#ff8f6b";
      x.fill();
      x.lineWidth = 8;
      x.lineJoin = "round";
      x.strokeStyle = "#d9603f";
      x.stroke();
      x.fillStyle = "rgba(255,255,255,.6)";
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * TAU) / 5;
        x.beginPath();
        x.arc(130 + Math.cos(a) * 80, 135 + Math.sin(a) * 80, 7, 0, TAU);
        x.fill();
      }
      eye(x, 110, 125, 15);
      eye(x, 150, 125, 15);
      x.strokeStyle = "#7a2b1a";
      x.lineWidth = 5;
      x.beginPath();
      x.arc(130, 145, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      x.stroke();
    } else {
      c.width = c.height = 8;
    }
    return c;
  }
  function eye(x, cx, cy, r) {
    x.fillStyle = "#fff";
    x.strokeStyle = "rgba(0,0,0,.45)";
    x.lineWidth = Math.max(3, r * 0.16);
    x.beginPath();
    x.arc(cx, cy, r, 0, TAU);
    x.fill();
    x.stroke();
    x.fillStyle = "#1b1b2f";
    x.beginPath();
    x.arc(cx + r * 0.22, cy + r * 0.1, r * 0.52, 0, TAU);
    x.fill();
    x.fillStyle = "#fff";
    x.beginPath();
    x.arc(cx + r * 0.38, cy - r * 0.14, r * 0.18, 0, TAU);
    x.fill();
  }
  function starPath(x, cx, cy, R, r) {
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const d = k % 2 ? r : R;
      x.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    }
    x.closePath();
  }
  function fishArt(x, col) {
    x.lineJoin = "round";
    x.strokeStyle = "rgba(0,0,0,.28)";
    x.lineWidth = 8;
    x.fillStyle = col;
    // ocas a hřbetní ploutev
    x.beginPath();
    x.moveTo(120, 130);
    x.lineTo(14, 40);
    x.quadraticCurveTo(50, 130, 14, 220);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(160, 64);
    x.quadraticCurveTo(205, -2, 278, 54);
    x.closePath();
    x.fill();
    x.stroke();
    // tělo
    x.beginPath();
    x.ellipse(220, 135, 160, 98, 0, 0, TAU);
    x.fill();
    x.stroke();
    x.fillStyle = "rgba(255,255,255,.35)";
    x.beginPath();
    x.ellipse(235, 182, 105, 38, 0, 0, TAU);
    x.fill();
    x.fillStyle = "rgba(0,0,0,.13)";
    x.beginPath();
    x.ellipse(190, 150, 42, 22, 0.5, 0, TAU);
    x.fill();
    eye(x, 300, 108, 32);
    x.fillStyle = "rgba(255,110,140,.45)";
    x.beginPath();
    x.arc(300, 165, 16, 0, TAU);
    x.fill();
    x.strokeStyle = "rgba(0,0,0,.55)";
    x.lineWidth = 7;
    x.beginPath();
    x.arc(344, 148, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    x.stroke();
  }
  function sharkArt(x) {
    const col = "#8fb3cc";
    x.lineJoin = "round";
    x.strokeStyle = "rgba(20,40,60,.35)";
    x.lineWidth = 8;
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(110, 150);
    x.lineTo(16, 36);
    x.quadraticCurveTo(52, 150, 16, 268);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.moveTo(250, 86);
    x.lineTo(330, 10);
    x.quadraticCurveTo(352, 60, 404, 86);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.ellipse(350, 160, 270, 100, 0, 0, TAU);
    x.fill();
    x.stroke();
    x.fillStyle = "#eef6fb";
    x.beginPath();
    x.ellipse(390, 202, 200, 46, 0, 0, TAU);
    x.fill();
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(320, 212);
    x.lineTo(270, 290);
    x.lineTo(392, 222);
    x.closePath();
    x.fill();
    x.stroke();
    // žábry
    x.strokeStyle = "rgba(20,40,60,.35)";
    x.lineWidth = 6;
    for (const gx of [450, 472, 494]) {
      x.beginPath();
      x.arc(gx - 30, 160, 34, -0.45, 0.45);
      x.stroke();
    }
    // velké legrační oko, tvářička a široký úsměv s pár zoubky
    eye(x, 540, 118, 38);
    x.fillStyle = "rgba(255,120,150,.4)";
    x.beginPath();
    x.arc(520, 176, 18, 0, TAU);
    x.fill();
    x.fillStyle = "#fff";
    x.strokeStyle = "rgba(20,40,60,.6)";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(470, 192);
    x.quadraticCurveTo(560, 246, 618, 180);
    x.quadraticCurveTo(560, 214, 470, 192);
    x.closePath();
    x.fill();
    x.stroke();
  }
  function pufferArt(x) {
    x.lineJoin = "round";
    x.fillStyle = "#e0a030";
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      x.beginPath();
      x.moveTo(170 + Math.cos(a - 0.13) * 104, 150 + Math.sin(a - 0.13) * 104);
      x.lineTo(170 + Math.cos(a) * 142, 150 + Math.sin(a) * 142);
      x.lineTo(170 + Math.cos(a + 0.13) * 104, 150 + Math.sin(a + 0.13) * 104);
      x.closePath();
      x.fill();
    }
    x.fillStyle = "#ffb347";
    x.beginPath();
    x.moveTo(66, 150);
    x.lineTo(12, 104);
    x.lineTo(12, 196);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(0,0,0,.25)";
    x.lineWidth = 8;
    x.fillStyle = "#ffcf4d";
    x.beginPath();
    x.arc(170, 150, 112, 0, TAU);
    x.fill();
    x.stroke();
    x.fillStyle = "rgba(255,255,255,.45)";
    x.beginPath();
    x.ellipse(180, 198, 76, 40, 0, 0, TAU);
    x.fill();
    x.fillStyle = "rgba(200,130,20,.45)";
    for (const [dx, dy] of [
      [-50, -50],
      [-70, 10],
      [-20, -80],
      [20, -60],
    ]) {
      x.beginPath();
      x.arc(170 + dx, 150 + dy, 9, 0, TAU);
      x.fill();
    }
    eye(x, 218, 118, 30);
    x.strokeStyle = "rgba(0,0,0,.6)";
    x.lineWidth = 6;
    x.beginPath();
    x.arc(272, 168, 11, 0, TAU);
    x.stroke();
  }

  // Hvězdička do „+1“ a bublina: malá plátna, kreslí se jen škálováním (rychlé).
  const starIcon = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const x = c.getContext("2d");
    starPath(x, 48, 50, 44, 20);
    x.fillStyle = "#ffd23d";
    x.fill();
    x.lineJoin = "round";
    x.lineWidth = 6;
    x.strokeStyle = "#e09b00";
    x.stroke();
    return c;
  })();
  const bubbleIcon = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.beginPath();
    x.arc(32, 32, 27, 0, TAU);
    x.fillStyle = "rgba(255,255,255,.18)";
    x.fill();
    x.lineWidth = 4;
    x.strokeStyle = "rgba(255,255,255,.8)";
    x.stroke();
    x.beginPath();
    x.arc(23, 22, 7, 0, TAU);
    x.fillStyle = "rgba(255,255,255,.85)";
    x.fill();
    return c;
  })();

  // Pozadí: img/bg.jpg, jinak přechod tyrkysová -> modrá, paprsky světla, písek a řasy. Kreslí se jednou.
  let bgCanvas = null;
  let bgFromImg = false;
  function background() {
    if (bgCanvas && (bgFromImg || !IMG.bg.ok)) return bgCanvas;
    const c = document.createElement("canvas");
    c.width = 1920 * RES;
    c.height = 1080 * RES;
    const x = c.getContext("2d");
    bgFromImg = !!IMG.bg.ok;
    if (bgFromImg) {
      x.drawImage(IMG.bg, 0, 0, c.width, c.height);
    } else {
      x.setTransform(RES, 0, 0, RES, 0, 0);
      const gr = x.createLinearGradient(0, 0, 0, 1080);
      gr.addColorStop(0, "#7fe3e8");
      gr.addColorStop(0.45, "#2b9ad6");
      gr.addColorStop(1, "#1c5fae");
      x.fillStyle = gr;
      x.fillRect(0, 0, 1920, 1080);
      x.fillStyle = "rgba(255,255,255,.07)";
      for (const k of [180, 640, 1120, 1560]) {
        x.beginPath();
        x.moveTo(k, 0);
        x.lineTo(k + 150, 0);
        x.lineTo(k - 60, 960);
        x.lineTo(k - 300, 960);
        x.closePath();
        x.fill();
      }
      x.lineCap = "round";
      x.strokeStyle = "#2f9e5a";
      x.lineWidth = 20;
      for (const sx of [110, 230, 1640, 1780]) {
        x.beginPath();
        x.moveTo(sx, 1010);
        x.bezierCurveTo(sx - 50, 920, sx + 50, 860, sx, 760);
        x.stroke();
      }
      x.fillStyle = "#e8d08c";
      x.beginPath();
      x.moveTo(0, 1080);
      for (let xx = 0; xx <= 1920; xx += 60)
        x.lineTo(xx, 990 + Math.sin(xx / 170) * 14);
      x.lineTo(1920, 1080);
      x.closePath();
      x.fill();
      x.fillStyle = "rgba(160,120,60,.35)";
      for (let k = 0; k < 40; k++) {
        x.beginPath();
        x.arc(
          (k * 397) % 1920,
          1015 + ((k * 53) % 55),
          4 + (k % 3) * 2,
          0,
          TAU,
        );
        x.fill();
      }
    }
    bgCanvas = c;
    return c;
  }

  // ---------- Pomocné ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  /** Vyhodí z pole mrtvé prvky (bez nového pole v každém snímku). */
  function compactDead(arr) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
    arr.length = j;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  const sayCs = (t) => TV.say(t, "cs-CZ");
  const fishOf = (p) => (p.who === "maty" ? "fish-green" : "fish-pink");

  // ---------- Stav, menu, párování ----------
  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    pair: null,
    game: null,
    raf: 0,
    endAt: 0,
  };

  function showMenu() {
    cancelAnimationFrame(S.raf);
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screen.replaceChildren(el("div", "menu-bg sea"));
    const t = el("div", "title", "Rybičky");
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
    screen.replaceChildren(el("div", "menu-bg sea"), box);
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
  function makePlayer(who) {
    return {
      who,
      x: 400,
      y: 600,
      vx: 0,
      vy: 0,
      face: 1,
      fx: 1, // plynulé natočení (-1 doleva .. 1 doprava)
      size: S0,
      pts: 0,
      need: 5,
      inv: 0,
      swallowed: 0,
      swFish: null,
      gulp: 0,
      dashCd: 0,
      bonkT: 0,
      bubT: 0,
      up: false,
      down: false,
      left: false,
      right: false,
      stars: 0,
      starTxt: "★ 0",
      // Maty má štědřejší „pusu“, ať se mu sousto snáz trefí
      eatK: who === "maty" ? 1.45 : 1.2,
    };
  }

  // Bubliny: pevné zásobníky, nic se nealokuje za hry.
  const AMBIENT = [];
  for (let k = 0; k < 26; k++)
    AMBIENT.push({
      x: rnd(0, 1920),
      y: rnd(TOP, 1080),
      r: rnd(6, 16),
      v: rnd(40, 90),
      ph: rnd(0, 6),
    });
  const PARTS = [];
  for (let k = 0; k < 70; k++)
    PARTS.push({ on: false, x: 0, y: 0, r: 0, vx: 0, vy: 0, t: 0, life: 1 });
  function puff(x, y, n, spread) {
    for (let k = 0, i = 0; k < n && i < PARTS.length; i++) {
      const b = PARTS[i];
      if (b.on) continue;
      b.on = true;
      b.x = x + rnd(-spread, spread) * 0.4;
      b.y = y + rnd(-spread, spread) * 0.4;
      b.r = rnd(6, 15);
      b.vx = rnd(-spread, spread);
      b.vy = rnd(-spread, spread * 0.3) - 60;
      b.t = 0;
      b.life = rnd(0.6, 1.1);
      k++;
    }
  }

  function startGame() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    S.game = {
      mode: S.mode,
      levels: LEVELS[S.mode],
      level: -1,
      cfg: null,
      players: kids.map(makePlayer),
      fish: [],
      popups: [],
      gifts: [],
      star: null,
      starT: 0,
      spawnT: 0,
      bigDelay: 0,
      shark: null,
      sharkT: 0,
      sharkEdible: false,
      sharkEaten: false,
      phase: "intro",
      t: 0,
      doneT: 0,
      devices: S.pair ? S.pair.devices : null,
    };
    S.screen = "game";
    startLevel(S.game, 0);
  }

  function startLevel(g, n) {
    const c = g.levels[n];
    g.level = n;
    g.levelTxt = ("Úroveň " + (n + 1)).toUpperCase(); // text jen při změně, ne v každém snímku
    g.cfg = c;
    g.fish.length = 0;
    g.popups.length = 0;
    g.gifts.length = 0;
    g.star = null;
    g.starT = rnd(10, 16);
    g.spawnT = 0.5;
    g.bigDelay = 3; // velké ryby až chvíli po startu
    g.shark = null;
    g.sharkT = 2.5;
    g.sharkEdible = false;
    g.sharkEaten = false;
    g.phase = "intro";
    g.t = 0;
    g.doneT = 0;
    for (const b of PARTS) b.on = false;
    const two = g.players.length > 1;
    g.players.forEach((p, i) => {
      p.x = 380;
      p.y = two ? (i === 0 ? 440 : 760) : 600;
      p.vx = p.vy = 0;
      p.face = p.fx = 1;
      p.size = S0; // každá úroveň začíná zase malou rybičkou
      p.pts = 0;
      p.need = two && p.who === "maty" ? Math.ceil(c.need * 0.7) : c.need;
      p.inv = 0;
      p.swallowed = 0;
      p.swFish = null;
      p.gulp = 0;
    });
    for (let k = 0; k < c.small; k++) spawnFish(g, "small", true);
    prewarm(g);

    const at = (ms, fn) =>
      setTimeout(() => {
        if (S.game === g && S.screen === "game" && g.level === n) fn();
      }, ms);
    const ready = two ? "Připravte se!" : "Připrav se!";
    if (n === 0) {
      screen.replaceChildren(el("div", "count ready", ready));
      sayCs(ready);
      at(2000, () => showCount(3));
      at(3000, () => showCount(2));
      at(4000, () => showCount(1));
      at(5000, () => {
        showCount(0);
        go(g);
      });
      if (c.say) at(6000, () => sayCs(c.say));
    } else {
      screen.replaceChildren(el("div", "count ready", "Úroveň " + (n + 1)));
      sayCs(ready);
      at(2200, () => {
        TV.sound.go();
        screen.replaceChildren();
        go(g);
      });
      if (c.say) at(2700, () => sayCs(c.say));
    }
    startLoop();
  }
  function go(g) {
    g.phase = "swim";
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
        if (S.game === g && S.screen === "game" && g.phase === "swim")
          screen.replaceChildren();
      }, 800);
    }
  }
  // Plátna všech velikostí rybičky hráče předem, ať se nevyrábí za hry.
  function prewarm(g) {
    const full = g.cfg.full || FULL;
    for (const p of g.players) {
      const src = art(fishOf(p));
      for (let w = S0 - 16; w <= full + 16; w += 8)
        sprite(src, w, w * aspect(src));
      sprite(src, 74, 74 * aspect(src)); // ikonka v liště
    }
  }

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
    const down = e.type !== "up"; // i opakování = drží (po pauze nebo mezi úrovněmi)
    if (e.name === "left") p.left = down;
    else if (e.name === "right") p.right = down;
    else if (e.name === "up") p.up = down;
    else if (e.name === "down") p.down = down;
    else if ((e.name === "ok" || e.name === "action") && e.type === "down")
      dash(p);
  }
  // Bonusové tlačítko: krátké šupnutí dopředu s bublinkami.
  function dash(p) {
    const g = S.game;
    if (!g || g.phase === "intro" || p.swallowed > 0 || p.dashCd > 0) return;
    let ix = (p.right ? 1 : 0) - (p.left ? 1 : 0);
    let iy = (p.down ? 1 : 0) - (p.up ? 1 : 0);
    if (!ix && !iy) ix = p.face;
    const l = Math.hypot(ix, iy);
    p.vx += (ix / l) * 520;
    p.vy += (iy / l) * 520;
    p.dashCd = 0.7;
    puff(p.x - p.face * p.size * 0.4, p.y, 4, 60);
    TV.sound.move();
  }

  // ---------- Ryby ----------
  function minSize(g) {
    let s = 1e9;
    for (const p of g.players) s = Math.min(s, p.size);
    return s;
  }
  function maxSize(g) {
    let s = 0;
    for (const p of g.players) s = Math.max(s, p.size);
    return s;
  }
  function nearPlayer(g, x, y, d) {
    for (const p of g.players)
      if (Math.abs(p.x - x) < d && Math.abs(p.y - y) < d * 0.6) return true;
    return false;
  }
  function spawnFish(g, cls, inside) {
    const c = g.cfg;
    let ref, fr, spd;
    if (cls === "small") {
      // vůči nejmenší rybičce, ať je sousto vždy pro všechny
      ref = minSize(g);
      fr = SMALL_F;
      spd = c.spd;
    } else if (cls === "mid") {
      ref = pick(g.players).size;
      fr = c.midF || [1, 1.2];
      spd = c.midSpd || c.spd;
    } else if (cls === "big") {
      ref = maxSize(g);
      fr = c.bigF || [1.35, 1.7];
      spd = c.bigSpd || c.spd;
    } else {
      ref = minSize(g);
      fr = [0.62, 0.8];
      spd = [40, 70];
    }
    const size = Math.min(520, ref * rnd(fr[0], fr[1]));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = inside
      ? rnd(760, 1800)
      : dir > 0
        ? -size * 0.6
        : 1920 + size * 0.6;
    const ymin = TOP + 40 + size * 0.25;
    const ymax = BOTTOM - 30 - size * 0.25;
    let y = rnd(ymin, ymax);
    // větší ryba nemá vjet z kraje rovnou do hráče
    if (cls !== "small")
      for (let k = 0; k < 6 && nearPlayer(g, x, y, 430); k++)
        y = rnd(ymin, ymax);
    g.fish.push({
      kind: cls === "puffer" ? "puffer" : pick(NPC),
      cls,
      x,
      y,
      y0: y,
      vx: dir * rnd(spd[0], spd[1]),
      vy: 0,
      dir,
      size,
      eff: size,
      t: rnd(0, 6),
      wf: rnd(0.8, 1.6),
      amp: rnd(10, 40),
      inflate: 1,
      puffT: 0,
      cool: 0,
      chomp: 0,
      inside: true,
      dead: false,
    });
  }
  function spawnShark(g) {
    const sp = g.cfg.shark;
    const f = {
      kind: "shark",
      cls: "shark",
      x: 1920 + SHARK_SIZE * 0.6,
      y: 600,
      y0: 600,
      vx: -sp,
      vy: 0,
      dir: -1,
      size: SHARK_SIZE,
      eff: SHARK_SIZE,
      t: 0,
      wf: 0.7,
      amp: 150,
      inflate: 1,
      puffT: 0,
      cool: 0,
      chomp: 0,
      inside: false,
      dead: false,
    };
    g.shark = f;
    g.fish.push(f);
  }
  const CNT = { small: 0, mid: 0, big: 0, puffer: 0, shark: 0 };
  function spawning(g, dt) {
    const c = g.cfg;
    g.bigDelay -= dt;
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      g.spawnT = 0.45;
      CNT.small = CNT.mid = CNT.big = CNT.puffer = CNT.shark = 0;
      for (const f of g.fish) if (!f.dead) CNT[f.cls]++;
      // když už se jde na žraloka, žádné další strašáky
      const calm = g.sharkEdible;
      const late = g.bigDelay <= 0;
      if (CNT.small < c.small) spawnFish(g, "small", false);
      else if (late && !calm && CNT.mid < (c.mid || 0))
        spawnFish(g, "mid", false);
      else if (late && !calm && CNT.big < (c.big || 0))
        spawnFish(g, "big", false);
      else if (late && CNT.puffer < (c.puffer || 0))
        spawnFish(g, "puffer", false);
    }
    if (c.shark && !g.shark) {
      g.sharkT -= dt;
      if (g.sharkT <= 0) {
        spawnShark(g);
        TV.sound.bump();
      }
    }
  }

  function updateFish(g, dt) {
    for (const f of g.fish) {
      if (f.dead) continue;
      f.t += dt;
      f.chomp = Math.max(0, f.chomp - dt);
      if (f.cls === "shark") {
        moveShark(g, f, dt);
      } else {
        f.x += f.vx * dt;
        f.y = f.y0 + Math.sin(f.t * f.wf) * f.amp;
        if ((f.dir > 0 && f.x > 1920 + f.size) || (f.dir < 0 && f.x < -f.size))
          f.dead = true;
      }
      if (f.cls === "puffer") {
        // ježík se při blízkosti nafoukne (a pak zase splaskne, ať se dá sníst)
        f.cool -= dt;
        f.puffT -= dt;
        if (
          f.puffT <= 0 &&
          f.cool <= 0 &&
          g.phase === "swim" &&
          closeToPlayer(g, f, 170)
        ) {
          f.puffT = 2.2;
          f.cool = 4.8;
          TV.sound.flip();
        }
        const target = f.puffT > 0 ? 1.7 : 1;
        f.inflate +=
          (target - f.inflate) *
          Math.min(1, dt * (target > f.inflate ? 9 : 2.5));
      }
      f.eff = f.size * f.inflate;
    }
  }
  function closeToPlayer(g, f, gap) {
    for (const p of g.players) {
      if (p.swallowed > 0) continue;
      const d = Math.hypot(f.x - p.x, f.y - p.y);
      if (d - p.size * 0.35 - f.size * 0.42 < gap) return true;
    }
    return false;
  }
  function moveShark(g, f, dt) {
    const minX = f.size * 0.5 + 20;
    const maxX = 1920 - f.size * 0.5 - 20;
    if (!f.inside) {
      f.x += f.vx * dt;
      f.y = f.y0 + Math.sin(f.t * f.wf) * f.amp;
      if (f.x < maxX) f.inside = true;
      return;
    }
    if (g.sharkEdible) {
      // vystrašený žralok pomalu utíká od nejbližší rybičky, ale zůstává ve vodě (dá se chytit)
      let best = null;
      let bd = 1e9;
      for (const p of g.players) {
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      const k = Math.min(1, dt * 2);
      const tx = best ? ((f.x - best.x) / (bd || 1)) * g.cfg.flee : 0;
      const ty = best ? ((f.y - best.y) / (bd || 1)) * g.cfg.flee : 0;
      f.vx += (tx - f.vx) * k;
      f.vy += (ty - f.vy) * k;
      f.x = clamp(f.x + f.vx * dt, minX, maxX);
      f.y = clamp(f.y + f.vy * dt, TOP + 90, BOTTOM - 90);
    } else {
      // pomalu pluje sem a tam přes celou vodu
      f.x += f.vx * dt;
      if (f.x > maxX) f.vx = -Math.abs(f.vx);
      if (f.x < minX) f.vx = Math.abs(f.vx);
      f.y = f.y0 + Math.sin(f.t * f.wf) * f.amp;
    }
    if (f.vx > 20) f.dir = 1;
    else if (f.vx < -20) f.dir = -1;
  }

  // ---------- Rybičky hráčů ----------
  function targetSize(g, p) {
    const full = g.cfg.full || FULL;
    return S0 + (full - S0) * Math.min(1, p.pts / p.need);
  }
  function updatePlayers(g, dt) {
    for (const p of g.players) {
      p.inv = Math.max(0, p.inv - dt);
      p.gulp = Math.max(0, p.gulp - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.bonkT = Math.max(0, p.bonkT - dt);
      p.size += (targetSize(g, p) - p.size) * Math.min(1, dt * 4);
      if (p.swallowed > 0) {
        // „v břiše“ velké ryby: jede s ní, za chvíli ji vyplivne
        const f = p.swFish;
        p.x = f.x + f.dir * f.eff * 0.2;
        p.y = f.y;
        p.swallowed -= dt;
        if (p.swallowed <= 0) spit(g, p);
        continue;
      }
      let ix = (p.right ? 1 : 0) - (p.left ? 1 : 0);
      let iy = (p.down ? 1 : 0) - (p.up ? 1 : 0);
      if (ix && iy) {
        ix *= 0.7071;
        iy *= 0.7071;
      }
      if (g.phase === "intro" && g.level === 0 && g.t < 5) ix = iy = 0; // během odpočtu stojí
      p.vx += ix * ACC * dt;
      p.vy += iy * ACC * dt;
      const drag = Math.exp(-DRAG * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const rx = p.size * 0.42;
      const ry = p.size * 0.36;
      if (p.x < rx) {
        p.x = rx;
        p.vx = 0;
      } else if (p.x > 1920 - rx) {
        p.x = 1920 - rx;
        p.vx = 0;
      }
      if (p.y < TOP + ry) {
        p.y = TOP + ry;
        p.vy = 0;
      } else if (p.y > BOTTOM - ry) {
        p.y = BOTTOM - ry;
        p.vy = 0;
      }
      if (p.vx > 40) p.face = 1;
      else if (p.vx < -40) p.face = -1;
      p.fx += (p.face - p.fx) * Math.min(1, dt * 9);
      // bublinky z pusy, když plave
      const sp = Math.abs(p.vx) + Math.abs(p.vy);
      p.bubT -= dt * (sp / 300);
      if (p.bubT <= 0 && sp > 150) {
        p.bubT = 0.5;
        puff(p.x + p.face * p.size * 0.45, p.y - p.size * 0.05, 1, 20);
      }
    }
  }

  function collisions(g) {
    for (const p of g.players) {
      if (p.swallowed > 0) continue;
      // Ryby jsou širší než vyšší: srážka jako elipsa (součet poloos hráče a ryby),
      // ať sedí s tím, co je vidět - i u dlouhého žraloka.
      const prx = p.size * BODY.player[0];
      const pry = p.size * BODY.player[1];
      for (const f of g.fish) {
        if (f.dead) continue;
        const dx = f.x - p.x;
        const dy = f.y - p.y;
        const b = BODY[f.kind] || BODY.fish;
        const frx = f.eff * b[0];
        const fry = f.eff * b[1];
        const edible = f.cls === "shark" ? g.sharkEdible : f.eff < 0.9 * p.size;
        // jíst se dá štědřeji (eatK), nebezpečí jen při jasném překryvu (0,85)
        const k = edible ? 1 : 0.85;
        const ex = dx / ((prx * (edible ? p.eatK : 1) + frx) * k);
        const ey = dy / ((pry * (edible ? p.eatK : 1) + fry) * k);
        if (ex * ex + ey * ey >= 1) continue;
        if (edible) {
          eat(g, p, f);
          continue;
        }
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (f.cls === "puffer" && f.inflate > 1.2) {
          bonk(p, dx, dy, d, 650);
        } else if (f.cls === "shark" || f.eff > 1.1 * p.size) {
          if (p.inv <= 0) swallow(p, f);
        } else {
          bonk(p, dx, dy, d, 380); // stejně velká ryba jen ťukne
        }
      }
    }
  }
  function bonk(p, dx, dy, d, force) {
    p.vx = (-dx / d) * force;
    p.vy = (-dy / d) * force;
    p.x -= (dx / d) * 6;
    p.y -= (dy / d) * 6;
    if (p.bonkT <= 0) {
      TV.sound.nope();
      p.bonkT = 0.4;
    }
  }
  // Hvězdičky vždy přes tuhle funkci: text do lišty se skládá jen při změně.
  function addStars(p, n) {
    p.stars += n;
    p.starTxt = "★ " + p.stars;
  }
  function eat(g, p, f) {
    f.dead = true;
    if (f.cls === "shark") g.sharkEaten = true;
    const n = f.cls === "shark" ? 5 : f.cls === "small" ? 1 : 2;
    addStars(p, n);
    p.gulp = 0.3;
    g.popups.push({ x: f.x, y: f.y, t: 0, n, txt: "+" + n });
    puff(f.x, f.y, f.cls === "shark" ? 14 : 5, f.cls === "shark" ? 160 : 70);
    TV.sound.ding();
    if (f.cls === "shark") TV.sound.match();
    const gain = f.cls === "small" ? 1 : 2;
    // Spolu: kdo už dorostl, posílá sousto kamarádovi (spolupráce, nikdo nezůstane malý)
    if (p.pts >= p.need && g.players.length > 1) {
      const q = g.players[0] === p ? g.players[1] : g.players[0];
      if (q.pts < q.need)
        g.gifts.push({
          to: q,
          sx: f.x,
          sy: f.y,
          x: f.x,
          y: f.y,
          t: 0,
          gain,
          dead: false,
        });
      return;
    }
    p.pts = Math.min(p.need, p.pts + gain);
  }
  function swallow(p, f) {
    p.swallowed = 0.55;
    p.swFish = f;
    p.vx = p.vy = 0;
    f.chomp = 0.55;
    TV.sound.bump();
    sayCs("Haps!"); // velká ryba hráče spolkla (za chvíli ho zase vyplivne)
  }
  function spit(g, p) {
    const f = p.swFish;
    p.swFish = null;
    p.swallowed = 0;
    p.pts = Math.max(0, p.pts - 1); // zmenší se o kousek
    p.inv = 2.2;
    // vyplivne ho dozadu a nahoru/dolů, ať velká ryba plave dál od něj
    p.x = clamp(f.x - f.dir * f.eff * 0.25, 80, 1840);
    p.vx = -f.dir * 480;
    p.vy = (f.y < 590 ? 1 : -1) * 420;
    p.face = -f.dir;
    puff(p.x, p.y, 8, 90);
    TV.sound.miss();
  }

  function updateStar(g, dt) {
    if (!g.star) {
      g.starT -= dt;
      if (g.starT <= 0)
        g.star = { x: rnd(300, 1620), y: TOP, t: 0, rot: 0, landed: 0 };
      return;
    }
    const s = g.star;
    s.t += dt;
    if (s.y < BOTTOM - 30) {
      s.y += 55 * dt; // hvězdice pomalu klesá
      s.rot += dt * 0.6;
      s.x += Math.sin(s.t * 1.5) * 25 * dt;
    } else {
      s.landed += dt;
      if (s.landed > 8) {
        g.star = null;
        g.starT = rnd(14, 22);
        return;
      }
    }
    for (const p of g.players) {
      if (p.swallowed > 0) continue;
      const r = p.size * 0.4 + 60;
      if ((s.x - p.x) * (s.x - p.x) + (s.y - p.y) * (s.y - p.y) < r * r) {
        addStars(p, 3);
        g.popups.push({ x: s.x, y: s.y, t: 0, n: 3, txt: "+3" });
        puff(s.x, s.y, 8, 90);
        TV.sound.match();
        sayCs("Hvězdice!");
        g.star = null;
        g.starT = rnd(14, 22);
        return;
      }
    }
  }

  function updateGifts(g, dt) {
    for (const gf of g.gifts) {
      gf.t += dt * 1.6;
      const k = Math.min(1, gf.t);
      gf.x = gf.sx + (gf.to.x - gf.sx) * k;
      gf.y = gf.sy + (gf.to.y - gf.sy) * k - Math.sin(k * Math.PI) * 140;
      if (gf.t >= 1) {
        gf.dead = true;
        gf.to.pts = Math.min(gf.to.need, gf.to.pts + gf.gain);
        gf.to.gulp = 0.3;
        TV.sound.ding();
      }
    }
    compactDead(g.gifts);
  }

  function checkDone(g) {
    let all = true;
    for (const p of g.players) if (p.pts < p.need) all = false;
    if (g.cfg.shark) {
      if (all && g.shark && !g.sharkEdible) {
        g.sharkEdible = true; // až jsou všichni velcí, žralok se lekne a dá se spolknout
        sayCs(
          g.players.length > 1
            ? "Teď spolkněte žraloka!"
            : "Teď spolkni žraloka!",
        );
      }
      if (g.sharkEaten) levelDone(g);
    } else if (all && !g.gifts.length) {
      levelDone(g);
    }
  }
  function levelDone(g) {
    g.phase = "done";
    g.doneT = 0;
    TV.sound.match();
    for (const p of g.players) puff(p.x, p.y, 10, 140);
  }

  // ---------- Aktualizace ----------
  function update(dt) {
    const g = S.game;
    g.t += dt;
    for (const b of AMBIENT) {
      b.y -= b.v * dt;
      if (b.y < TOP - 30) {
        b.y = 1060;
        b.x = rnd(0, 1920);
      }
    }
    for (const b of PARTS) {
      if (!b.on) continue;
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - dt * 2;
      b.vy -= 120 * dt; // bublina stoupá
      if (b.t > b.life) b.on = false;
    }
    updatePlayers(g, dt);
    updateFish(g, dt);
    if (g.phase === "swim") {
      collisions(g);
      spawning(g, dt);
      updateStar(g, dt);
      updateGifts(g, dt);
      checkDone(g);
    } else if (g.phase === "done") {
      g.doneT += dt;
      if (g.doneT > 1.3) {
        celebrate(g);
        return;
      }
    }
    compactDead(g.fish);
    for (const pp of g.popups) {
      pp.t += dt;
      if (pp.t > 1) pp.dead = true;
    }
    compactDead(g.popups);
  }

  // ---------- Kreslení ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }
  function drawBubble(x, y, r) {
    ctx.drawImage(bubbleIcon, x - r, y - r, r * 2, r * 2);
  }
  function draw() {
    const g = S.game;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(background(), 0, 0, 1920, 1080);
    for (const b of AMBIENT)
      drawBubble(b.x + Math.sin(g.t * 2 + b.ph) * 10, b.y, b.r);

    const s = g.star;
    if (s) {
      const a = s.landed > 6 ? 1 - (s.landed - 6) / 2 : null;
      drawArt(
        "starfish",
        s.x,
        s.y,
        110 + Math.sin(s.t * 4) * 6,
        1,
        1,
        Math.sin(s.rot) * 0.5,
        a,
      );
    }

    for (const f of g.fish) {
      if (f.cls === "shark") continue;
      let k = f.inflate;
      if (f.chomp > 0)
        k *= 1 + 0.12 * Math.sin((1 - f.chomp / 0.55) * Math.PI * 3);
      drawArt(
        f.kind,
        f.x,
        f.y,
        f.size,
        f.dir * k,
        k,
        Math.sin(f.t * f.wf * 3) * 0.05,
      );
    }
    const sh = g.shark;
    if (sh && !sh.dead) {
      let k = 1;
      if (sh.chomp > 0)
        k = 1 + 0.1 * Math.sin((1 - sh.chomp / 0.55) * Math.PI * 3);
      const shake = g.sharkEdible ? Math.sin(g.t * 40) * 5 : 0;
      drawArt(
        "shark",
        sh.x + shake,
        sh.y,
        sh.size,
        sh.dir * k,
        k,
        Math.sin(sh.t * 2) * 0.04,
      );
      if (g.sharkEdible) {
        // vystrašený: kapičky potu nad hlavou
        ctx.fillStyle = "rgba(190,235,255,.95)";
        for (let i = 0; i < 3; i++) {
          const ph = (g.t * 1.5 + i / 3) % 1;
          ctx.beginPath();
          ctx.arc(
            sh.x + sh.dir * (40 + i * 40),
            sh.y - sh.size * 0.3 - ph * 50,
            11,
            0,
            TAU,
          );
          ctx.fill();
        }
      }
    }

    for (const p of g.players) {
      if (p.swallowed > 0) continue;
      if (p.inv > 0 && Math.floor(p.inv * 10) % 2) continue; // bliká
      let k = p.fx;
      if (Math.abs(k) < 0.18) k = k < 0 ? -0.18 : 0.18;
      const gk =
        p.gulp > 0 ? 1 + 0.16 * Math.sin((1 - p.gulp / 0.3) * Math.PI) : 1;
      const tilt = clamp(p.vy / 600, -1, 1) * 0.35 * (p.face < 0 ? -1 : 1);
      drawArt(fishOf(p), p.x, p.y, p.size, k * gk, gk, tilt);
      if (g.players.length > 1 && p.pts >= p.need) {
        // dorostl: hvězdička nad hlavou (čeká na kamaráda)
        ctx.drawImage(
          starIcon,
          p.x - 28,
          p.y - p.size * 0.45 - 70 + Math.sin(g.t * 5) * 8,
          56,
          56,
        );
      }
    }

    for (const b of PARTS) {
      if (!b.on) continue;
      ctx.globalAlpha = 1 - b.t / b.life;
      drawBubble(b.x, b.y, b.r);
    }
    ctx.globalAlpha = 1;
    for (const gf of g.gifts) {
      drawBubble(gf.x, gf.y, 34);
      ctx.drawImage(starIcon, gf.x - 22, gf.y - 22, 44, 44);
    }
    ctx.font = '900 54px "Trebuchet MS", Roboto, sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    for (const pp of g.popups) {
      const y = pp.y - pp.t * 150;
      ctx.globalAlpha = Math.min(1, 2 - pp.t * 2);
      ctx.drawImage(starIcon, pp.x - 70, y - 34, 68, 68);
      ctx.fillStyle = "#fff";
      ctx.fillText(pp.txt, pp.x + 4, y);
    }
    ctx.globalAlpha = 1;
    drawHud(g);
  }

  function drawHud(g) {
    for (let i = 0; i < g.players.length; i++) {
      const p = g.players[i];
      const x0 = i === 0 ? 30 : 1270;
      ctx.fillStyle = "rgba(0,30,70,.55)";
      roundRect(x0, 18, 620, 122, 61);
      // avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + 61, 79, 50, 0, TAU);
      ctx.fillStyle = TV.PLAYERS[p.who].color;
      ctx.fill();
      ctx.clip();
      const a = AV[p.who];
      if (a && a.ok) ctx.drawImage(a, x0 + 11, 29, 100, 100);
      ctx.restore();
      // hvězdičky
      ctx.fillStyle = "#ffd23d";
      ctx.font = '900 52px "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(p.starTxt, x0 + 130, 54);
      // ukazatel růstu: rybička na konci = cílová velikost
      const bx = x0 + 130;
      const bw = 380;
      const k = Math.min(1, p.pts / p.need);
      ctx.fillStyle = "rgba(255,255,255,.25)";
      roundRect(bx, 92, bw, 30, 15);
      const full = k >= 1;
      ctx.fillStyle = full
        ? Math.floor(g.t * 4) % 2
          ? "#ffd23d"
          : "#fff3a8"
        : TV.PLAYERS[p.who].color;
      roundRect(bx, 92, Math.max(30, bw * k), 30, 15);
      drawArt(fishOf(p), x0 + 562, 96, 74, 1, 1, 0);
    }
    // číslo úrovně a tečky úrovní
    const n = g.levels.length;
    ctx.fillStyle = "rgba(0,30,70,.55)";
    roundRect(760, 18, 400, 122, 40);
    ctx.fillStyle = "#fff";
    ctx.font = '900 50px "Trebuchet MS", Roboto, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g.levelTxt, 960, 58);
    ctx.textAlign = "left";
    const gap = 44;
    const x1 = 960 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x1 + i * gap, 108, 12, 0, TAU);
      ctx.fillStyle =
        i < g.level
          ? "#ffd23d"
          : i === g.level
            ? "#fff"
            : "rgba(255,255,255,.3)";
      ctx.fill();
    }
  }

  let last = 0;
  let fpsN = 0;
  let fpsT = 0;
  function startLoop() {
    cancelAnimationFrame(S.raf); // ochrana proti dvojí smyčce
    last = 0;
    S.raf = requestAnimationFrame(frame);
  }
  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    const g = S.game;
    if (S.screen !== "game" || !g || g.phase === "party") return;
    update(dt);
    if (S.screen !== "game" || S.game !== g || g.phase === "party") return;
    draw();
    fpsN++;
    fpsT += dt;
    if (fpsT > 3) {
      console.log("FPS " + Math.round(fpsN / fpsT) + " ryb " + g.fish.length);
      fpsN = 0;
      fpsT = 0;
    }
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- Oslavy ----------
  function celebrate(g) {
    g.phase = "party"; // smyčka stojí, plátno zůstane s posledním snímkem
    cancelAnimationFrame(S.raf);
    if (g.level >= g.levels.length - 1) {
      showEnd();
      return;
    }
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.append(
      el("div", "end-title", "Hurá!"),
      el("div", "level-next", "Další úroveň!"),
    );
    const row = el("div", "end-players");
    for (const p of g.players) {
      const col = el("div", "end-player");
      col.append(avatarEl(p.who), el("div", "end-stars", "★ " + p.stars));
      row.appendChild(col);
    }
    box.appendChild(row);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    TV.sound.win();
    TV.confetti(fx, 70);
    sayCs("Hurá! Další úroveň!");
    const lvl = g.level;
    setTimeout(() => {
      if (S.game === g && S.screen === "game" && g.level === lvl)
        startLevel(g, lvl + 1);
    }, 3600);
  }

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
      TV.say(
        [
          p.who === "maty"
            ? "Hurá, Maty! Dokázal jsi to!"
            : "Hurá, Nelo! Dokázala jsi to!",
          p.stars === 0
            ? "Tentokrát nemáš žádnou hvězdičku."
            : p.stars >= 200 // csNumber umí slovy jen do 199
              ? "Máš spoustu hvězdiček!"
              : "Máš " +
                TV.csCount(p.stars, ["hvězdičku", "hvězdičky", "hvězdiček"]) +
                "!",
        ],
        "cs-CZ",
      );
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
      // chvíli nereagovat, ať držené tlačítko hned nespustí novou hru
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

  // přepnutí appky: puštěná tlačítka by se ztratila a rybička by plavala sama
  TV.onPause(() => {
    if (S.game)
      for (const p of S.game.players) p.left = p.right = p.up = p.down = false;
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.RYBICKY = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
