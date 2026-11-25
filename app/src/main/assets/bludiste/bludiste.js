/* Bludiště pro Matyho (3) a Nelu (5). Pohled shora na bludiště, 20 úrovní v pěti světech po čtyřech
 * (Zahrada, Zima, Poušť, Cukrová země, Hrad). Každá úroveň se generuje DFS s pevným seedem (vybraným
 * skriptem), takže se stejná úroveň hraje pokaždé stejně a Maty i Nela mají stejné bludiště.
 * Dítě chodí D-padem z políčka na políčko, držená šipka ho vede chodbou až ke křižovatce (malé dítě
 * nemusí mačkat po jednom políčku). Cíl je truhla s pokladem, po cestě hvězdičky, od 8. úrovně klíč,
 * od 13. zavádějící slepé uličky končící hned vedle truhly, smyčky, více klíčů a zamčené branky.
 * Nedá se prohrát ani zaseknout: plot jen ťukne. Když dítě dlouho nic nedělá, zablikají třpytky
 * na správné cestě (Maty dřív a delší kus). SPOLU = oba ve stejném bludišti z protějších rohů
 * ke společné truhle uprostřed. */
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

  // ---------- Obrázky (všechny volitelné, bez nich se kreslí náhradní tvary) ----------
  const IMG = {};
  [
    "chest",
    "chest-open",
    "key",
    "star",
    "footprints",
    "hedge",
    "wall-snow",
    "wall-sand",
    "wall-candy",
    "wall-stone",
  ].forEach((n) => {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = "img/" + n + ".png";
    IMG[n] = i;
  });
  const AV = {};
  for (const who of ["maty", "nela"]) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = TV.PLAYERS[who].avatar;
    AV[who] = i;
  }
  /** Předzmenšené plátno obrázku (cache podle velikosti), ať TV nešká velké PNG v každém snímku. */
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
  /** Procedurální plátno w x h (v jednotkách scény); draw kreslí v jednotkách scény. */
  function mk(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * RES));
    c.height = Math.max(1, Math.round(h * RES));
    const x = c.getContext("2d");
    x.scale(RES, RES);
    draw(x, w, h);
    return { cv: c, w, h };
  }
  /** Obrázek vepsaný do čtverce size, nebo náhradní kresba, když obrázek chybí. */
  function fromImg(name, size, fallback) {
    const i = IMG[name];
    if (i && i.ok) {
      const ar = i.naturalHeight / i.naturalWidth;
      const w = ar > 1 ? size / ar : size;
      const h = w * ar;
      return { cv: sprite(i, w, h), w, h };
    }
    return mk(size, size, fallback);
  }
  /** Vykreslí předpřipravené plátno se středem v (x, y). */
  function blit(s, x, y, k, alpha, rot) {
    const w = s.w * k,
      h = s.h * k;
    if (!rot && (alpha == null || alpha >= 1)) {
      ctx.drawImage(s.cv, x - w / 2, y - h / 2, w, h);
      return;
    }
    ctx.save();
    if (alpha != null) ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(s.cv, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function starPath(c, cx, cy, R, r, n) {
    c.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / n;
      const q = k % 2 ? r : R;
      c.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q);
    }
    c.closePath();
  }

  // ---------- Náhradní kresby ----------
  const drawStar = (x, w) => {
    starPath(x, w / 2, w / 2 + w * 0.03, w * 0.47, w * 0.2, 5);
    x.fillStyle = "#ffd23d";
    x.fill();
    x.lineJoin = "round";
    x.lineWidth = w * 0.06;
    x.strokeStyle = "#e08a00";
    x.stroke();
  };
  const drawKey = (x, w) => {
    x.lineWidth = w * 0.05;
    x.strokeStyle = "#a86e00";
    x.fillStyle = "#ffcf3a";
    rr(x, w * 0.42, w * 0.44, w * 0.52, w * 0.12, w * 0.03);
    x.fill();
    x.stroke();
    rr(x, w * 0.7, w * 0.52, w * 0.08, w * 0.18, w * 0.02);
    x.fill();
    x.stroke();
    rr(x, w * 0.84, w * 0.52, w * 0.08, w * 0.13, w * 0.02);
    x.fill();
    x.stroke();
    x.beginPath();
    x.arc(w * 0.28, w * 0.5, w * 0.2, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.beginPath();
    x.arc(w * 0.28, w * 0.5, w * 0.08, 0, Math.PI * 2);
    x.fillStyle = "#7a5200";
    x.fill();
  };
  function chestBody(x, w) {
    rr(x, w * 0.08, w * 0.44, w * 0.84, w * 0.46, w * 0.06);
    x.fillStyle = "#a0622d";
    x.fill();
    x.lineWidth = w * 0.04;
    x.strokeStyle = "#5a3416";
    x.stroke();
    x.fillStyle = "#ffc83d";
    x.fillRect(w * 0.24, w * 0.46, w * 0.08, w * 0.42);
    x.fillRect(w * 0.68, w * 0.46, w * 0.08, w * 0.42);
  }
  const drawChest = (x, w) => {
    chestBody(x, w);
    rr(x, w * 0.06, w * 0.2, w * 0.88, w * 0.28, w * 0.1);
    x.fillStyle = "#8a5124";
    x.fill();
    x.stroke();
    x.fillStyle = "#ffc83d";
    x.fillRect(w * 0.24, w * 0.22, w * 0.08, w * 0.24);
    x.fillRect(w * 0.68, w * 0.22, w * 0.08, w * 0.24);
    rr(x, w * 0.42, w * 0.4, w * 0.16, w * 0.18, w * 0.03);
    x.fill();
    x.lineWidth = w * 0.025;
    x.strokeStyle = "#7a4a12";
    x.stroke();
  };
  const drawChestOpen = (x, w) => {
    const gl = x.createRadialGradient(
      w / 2,
      w * 0.4,
      0,
      w / 2,
      w * 0.4,
      w * 0.5,
    );
    gl.addColorStop(0, "rgba(255,240,150,.9)");
    gl.addColorStop(1, "rgba(255,240,150,0)");
    x.fillStyle = gl;
    x.fillRect(0, 0, w, w);
    rr(x, w * 0.1, w * 0.04, w * 0.8, w * 0.26, w * 0.08);
    x.fillStyle = "#7a4520";
    x.fill();
    x.lineWidth = w * 0.04;
    x.strokeStyle = "#5a3416";
    x.stroke();
    x.fillStyle = "#ffd23d";
    x.strokeStyle = "#d18b00";
    x.lineWidth = w * 0.02;
    for (let k = 0; k < 7; k++) {
      x.beginPath();
      x.arc(
        w * (0.2 + k * 0.1),
        w * (0.43 - (k % 2) * 0.06),
        w * 0.08,
        0,
        Math.PI * 2,
      );
      x.fill();
      x.stroke();
    }
    chestBody(x, w);
  };
  const drawLock = (x, w) => {
    x.lineWidth = w * 0.12;
    x.strokeStyle = "#8a93a6";
    x.beginPath();
    x.arc(w * 0.5, w * 0.42, w * 0.2, Math.PI, 0);
    x.stroke();
    rr(x, w * 0.22, w * 0.42, w * 0.56, w * 0.44, w * 0.08);
    x.fillStyle = "#c9d0dd";
    x.fill();
    x.lineWidth = w * 0.05;
    x.strokeStyle = "#5d6578";
    x.stroke();
    x.fillStyle = "#5d6578";
    x.beginPath();
    x.arc(w * 0.5, w * 0.6, w * 0.07, 0, Math.PI * 2);
    x.fill();
  };
  /** Třpytka; barva hvězdičky podle světa (bílá by na sněhu zanikla). */
  const sparkDraw = (col) => (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,250,200,.95)");
    g.addColorStop(0.4, "rgba(255,230,120,.45)");
    g.addColorStop(1, "rgba(255,230,120,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    starPath(x, w / 2, w / 2, w * 0.48, w * 0.09, 4);
    x.fillStyle = col;
    x.fill();
  };
  /** Branka přes chodbu (vodorovná; pro svislou se otočí). w = šířka chodby, h = tloušťka. */
  function drawGate(x, w, h) {
    x.lineWidth = h * 0.12;
    x.strokeStyle = "#4a2a10";
    x.fillStyle = "#b06a2c";
    rr(x, h * 0.06, h * 0.12, w - h * 0.12, h * 0.76, h * 0.2);
    x.fill();
    x.stroke();
    x.fillStyle = "#8a4e1e";
    const n = Math.max(3, Math.round(w / (h * 0.9)));
    for (let k = 1; k < n; k++)
      x.fillRect((w * k) / n - h * 0.05, h * 0.18, h * 0.1, h * 0.64);
    // zlaté kování na koncích
    x.fillStyle = "#ffc83d";
    x.fillRect(h * 0.1, h * 0.36, h * 0.3, h * 0.28);
    x.fillRect(w - h * 0.4, h * 0.36, h * 0.3, h * 0.28);
  }
  /** Stopy v barvě dítěte (obrázek se jen obarví, ať je jasné, čí stopy to jsou). */
  function footSprite(size, color) {
    const i = IMG.footprints;
    return mk(size, size, (x, w) => {
      if (i && i.ok) {
        const ar = i.naturalHeight / i.naturalWidth;
        const iw = ar > 1 ? w / ar : w,
          ih = iw * ar;
        x.globalAlpha = 0.55;
        x.drawImage(i, (w - iw) / 2, (w - ih) / 2, iw, ih);
        x.globalCompositeOperation = "source-atop";
        x.globalAlpha = 0.45;
        x.fillStyle = color;
        x.fillRect(0, 0, w, w);
        return;
      }
      x.globalAlpha = 0.45;
      x.fillStyle = color;
      for (const [fx0, fy0] of [
        [0.33, 0.62],
        [0.67, 0.38],
      ]) {
        x.beginPath();
        x.ellipse(w * fx0, w * fy0, w * 0.1, w * 0.17, 0, 0, Math.PI * 2);
        x.fill();
        for (let k = -1; k <= 1; k++) {
          x.beginPath();
          x.arc(
            w * (fx0 + k * 0.06),
            w * (fy0 - 0.23),
            w * 0.035,
            0,
            Math.PI * 2,
          );
          x.fill();
        }
      }
    });
  }
  /** Kulatý avatar s barevným okrajem a tenkým bílým lemem (zelený okraj by na plotě zanikl). */
  function avatarSprite(who, d) {
    const P = TV.PLAYERS[who];
    return mk(d, d, (x) => {
      const r = d / 2;
      x.save();
      x.beginPath();
      x.arc(r, r, r * 0.9, 0, Math.PI * 2);
      x.fillStyle = "#fff";
      x.fill();
      x.clip();
      const a = AV[who];
      if (a && a.ok) x.drawImage(a, r * 0.1, r * 0.1, r * 1.8, r * 1.8);
      else {
        x.fillStyle = P.color;
        x.fillRect(0, 0, d, d);
        x.fillStyle = "#fff";
        x.font =
          "900 " +
          Math.round(d * 0.5) +
          'px "Trebuchet MS", Roboto, sans-serif';
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(P.name[0], r, r * 1.06);
      }
      x.restore();
      x.beginPath();
      x.arc(r, r, r * 0.84, 0, Math.PI * 2);
      x.lineWidth = r * 0.16;
      x.strokeStyle = P.color;
      x.stroke();
      x.beginPath();
      x.arc(r, r, r * 0.95, 0, Math.PI * 2);
      x.lineWidth = r * 0.07;
      x.strokeStyle = "#fff";
      x.stroke();
    });
  }

  // ---------- Úrovně ----------
  // c x r políček, hvězdičky, straight = jak moc chodby pokračují rovně (malé úrovně skoro rovná cesta),
  // keys = počet klíčů (truhla se otevře, až jsou všechny), kd = jak hluboko v odbočce leží klíč,
  // gates = zamčené branky na cestě (klíč k nim leží před nimi), decoy = slepá ulička, která končí
  // těsně vedle truhly (zavádějící), loops = kolik zdí se proboří na dlouhé smyčky (víc cest),
  // far = klíče co nejdál od truhly a od sebe. s / ss = pevný seed pro sólo / SPOLU, vybraný skriptem
  // (rozumně dlouhá cesta, pořádná past u truhly), ať se úroveň hraje pokaždé stejně.
  const LEVELS = [
    // Zahrada
    { c: 3, r: 2, stars: 1, straight: 0.95, s: 240, ss: 3 },
    { c: 4, r: 2, stars: 2, straight: 0.9, s: 234, ss: 108 },
    { c: 4, r: 3, stars: 2, straight: 0.85, s: 202, ss: 90 },
    { c: 5, r: 3, stars: 3, straight: 0.8, s: 151, ss: 55 },
    // Zima
    { c: 6, r: 3, stars: 3, straight: 0.75, s: 22, ss: 58 },
    { c: 6, r: 4, stars: 4, straight: 0.7, s: 354, ss: 124 },
    { c: 7, r: 4, stars: 4, straight: 0.6, s: 151, ss: 118 },
    { c: 8, r: 5, stars: 5, straight: 0.55, keys: 1, kd: 2, s: 103, ss: 28 },
    // Poušť
    { c: 9, r: 5, stars: 5, straight: 0.5, keys: 1, kd: 3, s: 25, ss: 45 },
    { c: 11, r: 6, stars: 6, straight: 0.45, keys: 1, kd: 3, s: 138, ss: 322 },
    { c: 13, r: 7, stars: 7, straight: 0.4, keys: 1, kd: 4, s: 221, ss: 14 },
    { c: 15, r: 8, stars: 8, straight: 0.35, keys: 1, kd: 5, s: 177, ss: 345 },
    // Cukrová země: jako dvanáctka, ale s pastí u truhly, pak smyčky, branka a dva klíče
    {
      c: 15,
      r: 8,
      stars: 8,
      straight: 0.35,
      keys: 1,
      kd: 5,
      decoy: true,
      s: 249,
      ss: 336,
    },
    {
      c: 16,
      r: 9,
      stars: 8,
      straight: 0.35,
      keys: 1,
      kd: 6,
      decoy: true,
      loops: 3,
      s: 226,
      ss: 383,
    },
    {
      c: 16,
      r: 9,
      stars: 9,
      straight: 0.3,
      keys: 2,
      gates: 1,
      kd: 4,
      decoy: true,
      s: 163,
      ss: 104,
    },
    {
      c: 17,
      r: 9,
      stars: 9,
      straight: 0.3,
      keys: 2,
      kd: 6,
      far: true,
      decoy: true,
      loops: 3,
      s: 386,
      ss: 189,
    },
    // Hrad
    {
      c: 18,
      r: 9,
      stars: 10,
      straight: 0.3,
      keys: 2,
      gates: 1,
      kd: 5,
      far: true,
      decoy: true,
      loops: 4,
      s: 134,
      ss: 115,
    },
    {
      c: 19,
      r: 10,
      stars: 10,
      straight: 0.3,
      keys: 2,
      gates: 1,
      kd: 6,
      far: true,
      decoy: true,
      loops: 5,
      s: 331,
      ss: 105,
    },
    {
      c: 20,
      r: 10,
      stars: 11,
      straight: 0.25,
      keys: 3,
      gates: 2,
      kd: 5,
      decoy: true,
      loops: 5,
      s: 365,
      ss: 382,
    },
    {
      c: 21,
      r: 11,
      stars: 12,
      straight: 0.25,
      keys: 3,
      gates: 2,
      kd: 6,
      far: true,
      decoy: true,
      loops: 6,
      s: 239,
      ss: 43,
    },
  ];
  const MAXLVL = LEVELS.length; // Maty, Nela i SPOLU mají všech 20 (Maty se úlevami, ne menším počtem)

  // Světy po čtyřech úrovních. wall = obrázek bezešvé textury zdi; bez něj tex (procedurální vzor).
  const WORLDS = [
    {
      name: "Zahrada",
      wall: "hedge",
      tex: null,
      sky: ["#7cc95c", "#4b9a37"],
      band: "rgba(10,40,10,.22)",
      floor: "#efdcaa",
      speck: "rgba(170,125,60,.16)",
      edge: "#2a5f1e",
      fill: "#4ea43a",
      light: "rgba(160,235,120,.4)",
      shadow: "rgba(50,35,10,.28)",
      dots: ["rgba(30,90,25,.45)", "rgba(180,245,140,.45)"],
      spark: "#fff",
    },
    {
      name: "Zima",
      wall: "wall-snow",
      tex: "snow",
      sky: ["#9fd3fb", "#4f8fd6"],
      band: "rgba(20,50,110,.22)",
      floor: "#d3e6f9", // modrobílá, ať jsou bílé sněhové zdi vidět
      speck: "rgba(255,255,255,.6)",
      edge: "#5f84b4",
      fill: "#f6faff",
      light: "rgba(255,255,255,.75)",
      shadow: "rgba(30,60,120,.25)",
      dots: ["rgba(255,255,255,.85)", "rgba(160,200,240,.6)"],
      spark: "#ffbf1f",
    },
    {
      name: "Poušť",
      wall: "wall-sand",
      tex: "sand",
      sky: ["#ffc272", "#ec8a3c"],
      band: "rgba(110,50,10,.22)",
      floor: "#f6dcaa",
      speck: "rgba(190,130,60,.2)",
      edge: "#8a5520",
      fill: "#dcaa62",
      light: "rgba(255,232,180,.45)",
      shadow: "rgba(110,60,15,.28)",
      dots: ["rgba(140,90,40,.4)", "rgba(255,238,195,.5)"],
      spark: "#fff",
    },
    {
      name: "Cukrová země",
      wall: "wall-candy",
      tex: "candy",
      sky: ["#f0a8e6", "#b267d0"],
      band: "rgba(80,20,90,.2)",
      floor: "#ffe0f0",
      speck: "rgba(255,120,185,.2)",
      edge: "#b1306c",
      fill: "#ff8fc0",
      light: "rgba(255,255,255,.45)",
      shadow: "rgba(110,30,90,.25)",
      dots: ["#fff36b", "#6be0ff", "#8cff7a", "#ffffff", "#c49bff"],
      spark: "#fff",
    },
    {
      name: "Hrad",
      wall: "wall-stone",
      tex: "stone",
      sky: ["#34509a", "#17235a"],
      band: "rgba(0,0,20,.25)",
      floor: "#a4977f",
      speck: "rgba(70,55,40,.2)",
      edge: "#2b2f3c",
      fill: "#c2c8d4",
      light: "rgba(255,255,255,.32)",
      shadow: "rgba(0,0,0,.35)",
      dots: ["rgba(70,75,95,.45)", "rgba(240,244,250,.45)"],
      spark: "#fff",
    },
  ];
  /** Svět podle úrovně: každé 4 úrovně jiný. */
  const worldOf = (n) => Math.min(WORLDS.length - 1, Math.floor((n - 1) / 4));

  const SPEED = { maty: 3.4, nela: 4.2 }; // políček za sekundu (strop)
  const PXS = { maty: 500, nela: 580 }; // px za sekundu (na velkých políčkách pomaleji)
  const JPAUSE = { maty: 0.45, nela: 0.3 }; // zastavení na křižovatce, než držená šipka vede dál
  /** Po kolika sekundách nečinnosti třpytky: Maty na větších bludištích dřív (nikdy se nezasekne). */
  const idleOf = (who, n) =>
    who === "maty" ? (n <= 6 ? 5 : n <= 12 ? 4 : 3) : 8;
  /** Kolik políček cesty třpytky ukážou: Maty na velkých bludištích dlouhý kus. */
  const hintOf = (who, n) =>
    who === "maty" ? (n <= 6 ? 4 : n <= 12 ? 6 : 9) : n <= 12 ? 4 : 5;
  const DIRS = { up: 0, right: 1, down: 2, left: 3 };
  const DX = [0, 1, 0, -1],
    DY = [-1, 0, 1, 0];
  const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]; // počet otevřených stran

  /** Seedovaný generátor (mulberry32): bludiště jde zopakovat podle L.seed. */
  function mulberry(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffleR(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /** Recursive backtracker z políčka root. open[c] = bitová maska otevřených stran (bit d = směr d).
   *  DFS nemá „příčné“ hrany: soused slepé uličky je vždy její předek, takže když DFS začne
   *  na startu, každá slepá ulička sousedí jen s cestou ke startu. Proto past u truhly potřebuje
   *  DFS začít jinde (root), pak vedle truhly končí i odbočky z úplně jiného konce bludiště. */
  function genMaze(C, R, rnd, straight, root) {
    const N = C * R,
      open = new Uint8Array(N),
      seen = new Uint8Array(N),
      came = new Int8Array(N).fill(-1);
    const stack = [root];
    seen[root] = 1;
    const opts = [0, 0, 0, 0];
    while (stack.length) {
      const c = stack[stack.length - 1],
        x = c % C,
        y = Math.floor(c / C);
      let n = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d],
          ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < C && ny < R && !seen[ny * C + nx])
          opts[n++] = d;
      }
      if (!n) {
        stack.pop();
        continue;
      }
      let d = opts[Math.floor(rnd() * n)];
      // rovně dál = delší chodby a méně zatáček (na malých úrovních skoro rovná cesta)
      const last = came[c];
      if (last >= 0 && rnd() < straight)
        for (let k = 0; k < n; k++) if (opts[k] === last) d = last;
      const nc = (y + DY[d]) * C + x + DX[d];
      open[c] |= 1 << d;
      open[nc] |= 1 << ((d + 2) % 4);
      seen[nc] = 1;
      came[nc] = d;
      stack.push(nc);
    }
    return open;
  }

  // Pole pro BFS se alokují jednou za úroveň, hledání cesty (nápověda) pak nic nealokuje.
  let Q = new Int16Array(1),
    DIST = new Int16Array(1),
    PREV = new Int16Array(1);
  /** BFS z více zdrojů naráz (nápověda k nejbližšímu klíči). Zamčenou brankou (L.lock) neprojde. */
  function bfsMulti(L, src, ns, blocked) {
    DIST.fill(-1);
    let h = 0,
      t = 0;
    for (let k = 0; k < ns; k++) {
      const s = src[k];
      if (DIST[s] >= 0) continue;
      Q[t++] = s;
      DIST[s] = 0;
      PREV[s] = -1;
    }
    while (h < t) {
      const c = Q[h++],
        o = L.open[c] & ~L.lock[c];
      for (let d = 0; d < 4; d++) {
        if (!(o & (1 << d))) continue;
        const n = c + L.step[d];
        if (DIST[n] >= 0 || n === blocked) continue;
        DIST[n] = DIST[c] + 1;
        PREV[n] = c;
        Q[t++] = n;
      }
    }
  }
  const SRC1 = [0];
  function bfs(L, from, blocked) {
    SRC1[0] = from;
    bfsMulti(L, SRC1, 1, blocked);
  }

  /** Truhla daleko od startu a s pastí: za zdí vedle ní končí odbočka, která od správné cesty
   *  vede daleko pryč (dítě vidí truhlu na dosah, ale tudy to nejde). Volá se po bfs ze startu. */
  function pickDecoyChest(L, rnd) {
    const { N, C, R, open } = L;
    const ds = Int16Array.from(DIST);
    let maxD = 0;
    for (let c = 0; c < N; c++) if (ds[c] > maxD) maxD = ds[c];
    let best = -1,
      bs = -1e9,
      bn = -1,
      bdep = 0;
    for (let c = 1; c < N; c++) {
      if (BITS[open[c]] !== 1 || ds[c] < maxD * 0.75) continue;
      bfs(L, c, -1);
      let dep = -1,
        dn = -1;
      const x = c % C,
        y = Math.floor(c / C);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d],
          ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= C || ny >= R || open[c] & (1 << d))
          continue;
        const nb = ny * C + nx;
        // ve stromu: jak daleko od cesty start -> c leží soused za zdí
        const v = (ds[nb] + DIST[nb] - ds[c]) / 2;
        if (v > dep) {
          dep = v;
          dn = nb;
        }
      }
      // past (aspoň 4 políčka odbočky) má přednost před pár políčky delší cesty
      const sc =
        (dep >= 4 ? 40 : 0) + Math.min(dep, 12) * 3 + ds[c] + rnd() * 0.5;
      if (sc > bs) {
        bs = sc;
        best = c;
        bn = dn;
        bdep = dep;
      }
    }
    L.chest = best;
    L.decoy = bdep >= 3 ? bn : -1;
    L.decoyDepth = bdep;
  }

  /** Branky na cestě start -> truhla tak, aby v každé oblasti mezi nimi byla odbočka na klíč. */
  function placeGates(L, P, ng, dep, anc, pidx, decoyBr, reg, kd) {
    const N = L.N,
      Lp = P.length - 1;
    const hd = new Int16Array(Lp + 1); // nejhlubší odbočka u každého políčka cesty
    for (let c = 0; c < N; c++)
      if (dep[c] > 0 && !decoyBr[c] && anc[c] >= 0) {
        const j = pidx[anc[c]];
        if (j >= 0 && dep[c] > hd[j]) hd[j] = dep[c];
      }
    const regMax = (a, b) => {
      let m = 0;
      for (let j = a; j <= b; j++) if (hd[j] > m) m = hd[j];
      return Math.min(m, kd);
    };
    const lo = (f) => Math.max(1, Math.round(Lp * f)),
      hi = (f) => Math.min(Lp - 2, Math.round(Lp * f));
    let best = null,
      bs = -1e9;
    if (ng === 1) {
      for (let s = lo(0.35); s <= hi(0.7); s++) {
        const sc =
          Math.min(regMax(0, s), regMax(s + 1, Lp - 1)) * 10 -
          Math.abs(s - Lp * 0.55);
        if (sc > bs) {
          bs = sc;
          best = [s];
        }
      }
    } else {
      for (let s1 = lo(0.2); s1 <= hi(0.45); s1++)
        for (let s2 = Math.max(s1 + 3, lo(0.55)); s2 <= hi(0.8); s2++) {
          const sc =
            Math.min(
              regMax(0, s1),
              regMax(s1 + 1, s2),
              regMax(s2 + 1, Lp - 1),
            ) *
              10 -
            Math.abs(s1 - Lp * 0.33) -
            Math.abs(s2 - Lp * 0.68);
          if (sc > bs) {
            bs = sc;
            best = [s1, s2];
          }
        }
    }
    if (!best) return; // příliš krátká cesta: bez branek (klíče pak leží všechny u startu)
    // oblast políčka = kolik branek je mezi ním a startem (odbočka podle své kotvy na cestě)
    for (let c = 0; c < N; c++) {
      const j = pidx[c] >= 0 ? pidx[c] : anc[c] >= 0 ? pidx[anc[c]] : 0;
      let r = 0;
      for (const s of best) if (j > s) r++;
      reg[c] = r;
    }
    best.forEach((s, k) => {
      const a = P[s],
        b = P[s + 1];
      let d = 0;
      while (a + L.step[d] !== b || !(L.open[a] & (1 << d))) d++;
      L.gates.push({ a, b, d });
      L.gateAt[a * 4 + d] = k;
      L.gateAt[b * 4 + ((d + 2) & 3)] = k;
    });
  }

  function buildMaze(n, mode) {
    const def = LEVELS[n - 1];
    const duo = mode === "spolu";
    // SPOLU potřebuje dva rohy a truhlu mezi nimi, proto aspoň 5 x 3
    const C = duo ? Math.max(def.c, 5) : def.c,
      R = duo ? Math.max(def.r, 3) : def.r,
      N = C * R;
    // pevný seed: stejná úroveň = stejné bludiště (Maty i Nela stejné, SPOLU vlastní)
    const seed = (duo ? def.ss : def.s) >>> 0;
    const rnd = mulberry(seed);
    // pasti: DFS z náhodného políčka (viz genMaze), jinak ze startu jako dřív
    const root = def.decoy && !duo ? Math.floor(rnd() * N) : 0;
    const open = genMaze(C, R, rnd, def.straight, root);
    Q = new Int16Array(N);
    DIST = new Int16Array(N);
    PREV = new Int16Array(N);
    // SPOLU bez branek (dvě cesty z protějších rohů), nejvýš dva klíče: každé dítě má „svůj“
    const nGates = duo ? 0 : def.gates || 0;
    const nKeys = duo ? Math.min(def.keys || 0, 2) : def.keys || 0;
    const L = {
      n,
      C,
      R,
      N,
      open,
      seed,
      world: worldOf(n),
      step: [-C, 1, C, -1],
      lock: new Uint8Array(N), // strany políček zavřené brankou
      keys: [],
      keyAt: new Int8Array(N).fill(-1),
      gates: [],
      gateAt: new Int8Array(N * 4).fill(-1),
      chest: -1,
      decoy: -1,
      decoyDepth: 0,
      starts: [],
      stars: [],
      starAt: new Int8Array(N).fill(-1),
    };
    const corners = [0, C - 1, (R - 1) * C, N - 1];
    if (!duo) {
      bfs(L, 0, -1);
      if (def.decoy) pickDecoyChest(L, rnd);
      else {
        // truhla na nejvzdálenějším políčku od startu = vždy slepá ulička, zamčená nic neodřízne
        let best = 0;
        for (let c = 0; c < N; c++) if (DIST[c] > DIST[best]) best = c;
        L.chest = best;
      }
      L.starts.push(0);
    } else {
      // truhla ve slepé uličce co nejblíž středu (ne v rohu, tam začínají děti)
      const mx = (C - 1) / 2,
        my = (R - 1) / 2;
      let best = -1,
        bd = 1e9;
      for (let pass = 0; pass < 2 && best < 0; pass++)
        for (let c = 0; c < N; c++) {
          if (corners.includes(c) || (pass === 0 && BITS[open[c]] !== 1))
            continue;
          const dx = (c % C) - mx,
            dy = Math.floor(c / C) - my;
          const d = dx * dx + dy * dy + rnd() * 0.01;
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
      L.chest = best;
      bfs(L, best, -1);
      // Maty z rohu blíž k truhle, Nela z protějšího
      let mi = 0;
      for (let k = 1; k < 4; k++)
        if (DIST[corners[k]] < DIST[corners[mi]]) mi = k;
      L.starts.push(corners[mi], corners[3 - mi]);
    }
    // cesty ze startů k truhle (zatím strom bez smyček)
    const onPath = new Uint8Array(N);
    bfs(L, L.chest, -1);
    const chestDist = Int16Array.from(DIST);
    for (const s of L.starts)
      for (let c = s; c >= 0; c = PREV[c]) onPath[c] = 1;
    const P = []; // sólo: cesta start -> truhla (na ní branky)
    for (let c = L.starts[0]; c >= 0; c = PREV[c]) P.push(c);
    // kam se dá dojít bez průchodu truhlou (klíč i hvězdičky musí být dosažitelné)
    const reach = new Uint8Array(N);
    for (const s of L.starts) {
      bfs(L, s, L.chest);
      for (let c = 0; c < N; c++) if (DIST[c] >= 0) reach[c] = 1;
    }
    const free = (c) =>
      reach[c] && c !== L.chest && !L.starts.includes(c) && L.keyAt[c] < 0;

    // hloubka odbočky = vzdálenost od cesty, kotva = políčko cesty, ze kterého odbočka vede
    const dep = new Int16Array(N).fill(-1),
      par = new Int16Array(N).fill(-1),
      anc = new Int16Array(N).fill(-1),
      pidx = new Int16Array(N).fill(-1);
    P.forEach((c, i) => (pidx[c] = i));
    {
      let h = 0,
        t = 0;
      for (let c = 0; c < N; c++)
        if (onPath[c] && c !== L.chest) {
          dep[c] = 0;
          anc[c] = c;
          Q[t++] = c;
        }
      while (h < t) {
        const c = Q[h++];
        for (let d = 0; d < 4; d++) {
          if (!(open[c] & (1 << d))) continue;
          const nn = c + L.step[d];
          if (dep[nn] >= 0 || nn === L.chest) continue;
          dep[nn] = dep[c] + 1;
          par[nn] = c;
          anc[nn] = anc[c];
          Q[t++] = nn;
        }
      }
    }
    // odbočka-past vedoucí k truhle: klíč do ní nedáme, ať je to opravdu slepá ulička
    const decoyBr = new Uint8Array(N);
    if (L.decoy >= 0)
      for (let c = L.decoy; c >= 0 && !onPath[c]; c = par[c]) decoyBr[c] = 1;

    const reg = new Uint8Array(N); // oblast mezi brankami (0 = u startu)
    if (nGates > 0)
      placeGates(L, P, nGates, dep, anc, pidx, decoyBr, reg, def.kd || 3);

    // klíče: i-tý klíč v i-té oblasti (poslední v oblasti s truhlou), v odbočce hloubky kd
    let side = null;
    if (duo && nKeys > 1) {
      bfs(L, L.starts[0], L.chest);
      const d0 = Int16Array.from(DIST);
      bfs(L, L.starts[1], L.chest);
      side = new Uint8Array(N);
      for (let c = 0; c < N; c++) side[c] = d0[c] <= DIST[c] ? 0 : 1;
    }
    for (let i = 0; i < nKeys; i++) {
      const r = Math.min(i, L.gates.length);
      const ok = (c) =>
        free(c) && reg[c] === r && (!side || i > 1 || side[c] === i);
      let kdist = null;
      if (L.keys.length) {
        bfsMulti(L, L.keys, L.keys.length, L.chest);
        kdist = Int16Array.from(DIST);
      }
      let pool = [];
      for (let c = 0; c < N; c++)
        if (ok(c) && !onPath[c] && !decoyBr[c]) pool.push(c);
      if (!pool.length)
        for (let c = 0; c < N; c++) if (ok(c) && !decoyBr[c]) pool.push(c);
      if (!pool.length) for (let c = 0; c < N; c++) if (ok(c)) pool.push(c);
      if (!pool.length) for (let c = 0; c < N; c++) if (free(c)) pool.push(c);
      let maxD = 0;
      for (const c of pool) if (dep[c] > maxD) maxD = dep[c];
      const want = Math.min(def.kd || 0, maxD);
      let pick = -1;
      if (!def.far && !kdist) {
        const cand = pool.filter((c) => dep[c] === want);
        const arr = cand.length ? cand : pool;
        pick = arr[Math.floor(rnd() * arr.length)];
      } else {
        // daleko od truhly a od ostatních klíčů = projít víc bludiště
        let bs = -1e9;
        for (const c of pool) {
          if (dep[c] < want) continue;
          const sc =
            (def.far ? chestDist[c] : 0) +
            (kdist ? Math.min(kdist[c], 12) * 1.5 : 0) +
            rnd();
          if (sc > bs) {
            bs = sc;
            pick = c;
          }
        }
        if (pick < 0) pick = pool[Math.floor(rnd() * pool.length)];
      }
      L.keyAt[pick] = L.keys.length;
      L.keys.push(pick);
    }

    // smyčky: proboří zeď jen uvnitř jedné oblasti (branka se nedá obejít), ne u truhly a ne v pasti
    const loops = def.loops || 0;
    if (loops) {
      const walls = [];
      for (let y = 0; y < R; y++)
        for (let x = 0; x < C; x++) {
          const c = y * C + x;
          if (x < C - 1 && !(open[c] & 2)) walls.push(c * 4 + 1);
          if (y < R - 1 && !(open[c] & 4)) walls.push(c * 4 + 2);
        }
      shuffleR(walls, rnd);
      let made = 0;
      for (let k = 0; k < walls.length && made < loops; k++) {
        const c = walls[k] >> 2,
          d = walls[k] & 3,
          nb = c + L.step[d];
        if (c === L.chest || nb === L.chest || decoyBr[c] || decoyBr[nb])
          continue;
        if (reg[c] !== reg[nb]) continue;
        bfs(L, c, -1);
        // krátká smyčka by byla jen díra v plotě, chceme opravdu jinou cestu
        if (DIST[nb] < 10) continue;
        open[c] |= 1 << d;
        open[nb] |= 1 << ((d + 2) & 3);
        made++;
      }
      // nejkratší cesta se smyčkami (hvězdičky „na cestě“ a nápověda)
      onPath.fill(0);
      bfs(L, L.chest, -1);
      for (const s of L.starts)
        for (let c = s; c >= 0; c = PREV[c]) onPath[c] = 1;
    }

    // hvězdičky: Maty hlavně na cestě (sebere je sám), Nela půl na cestě a půl ve slepých uličkách
    const count = def.stars + (duo ? 2 : 0);
    const path = [],
      dead = [],
      other = [];
    for (let c = 0; c < N; c++) {
      if (!free(c)) continue;
      if (onPath[c]) path.push(c);
      else if (BITS[open[c]] === 1) dead.push(c);
      else other.push(c);
    }
    shuffleR(path, rnd);
    shuffleR(dead, rnd);
    shuffleR(other, rnd);
    const onP = mode === "maty" ? count : Math.ceil(count / 2);
    const order = path.slice(0, onP).concat(dead, other, path.slice(onP));
    for (let k = 0; k < count && k < order.length; k++) {
      L.starAt[order[k]] = L.stars.length;
      L.stars.push({ c: order[k], taken: false });
    }

    // branky se zamknou až teď (generování výš s nimi počítá přes oblasti)
    for (const gt of L.gates) {
      L.lock[gt.a] |= 1 << gt.d;
      L.lock[gt.b] |= 1 << ((gt.d + 2) & 3);
    }

    // rozměry: plátno se přizpůsobí bludišti, vycentrované pod horní lištou
    const cs = Math.floor(Math.min(1840 / (C + 0.3), 890 / (R + 0.3), 240));
    L.cs = cs;
    L.th = Math.round(cs * 0.24);
    L.ox = Math.round(960 - (C * cs) / 2);
    L.oy = Math.round(160 + (900 - R * cs) / 2);
    return L;
  }

  // ---------- Pozadí (bludiště se kreslí jednou do offscreen plátna) ----------
  const bgCv = document.createElement("canvas");
  bgCv.width = 1920 * RES;
  bgCv.height = 1080 * RES;
  const bctx = bgCv.getContext("2d");

  // Náhradní bezešvé vzory zdí (64 x 64), když obrázek textury chybí.
  const TEX = {};
  function texCanvas(kind) {
    if (TEX[kind]) return TEX[kind];
    TEX[kind] = mk(64, 64, (x, w) => {
      if (kind === "snow") {
        x.fillStyle = "#f6faff";
        x.fillRect(0, 0, w, w);
        x.fillStyle = "rgba(160,195,235,.55)";
        for (const [a, b, r] of [
          [12, 14, 4],
          [40, 9, 3],
          [27, 36, 5],
          [52, 44, 3],
          [10, 52, 3],
        ]) {
          x.beginPath();
          x.arc(a, b, r, 0, Math.PI * 2);
          x.fill();
        }
      } else if (kind === "sand") {
        x.fillStyle = "#dcaa62";
        x.fillRect(0, 0, w, w);
        x.strokeStyle = "#c08a42";
        x.lineWidth = 4;
        for (const y0 of [16, 48]) {
          x.beginPath();
          for (let k = 0; k <= 64; k += 4)
            x.lineTo(k, y0 + Math.sin((k / 64) * Math.PI * 2) * 4);
          x.stroke();
        }
      } else if (kind === "candy") {
        // bonbonové proužky šikmo; perioda 32 dělí dlaždici, takže navazují
        x.fillStyle = "#ff8fc0";
        x.fillRect(0, 0, w, w);
        x.strokeStyle = "#fff";
        x.lineWidth = 9;
        for (let k = -2; k <= 2; k++) {
          x.beginPath();
          x.moveTo(k * 32, 0);
          x.lineTo(k * 32 + 64, 64);
          x.stroke();
        }
      } else {
        // kamenné cihly
        x.fillStyle = "#c2c8d4";
        x.fillRect(0, 0, w, w);
        x.fillStyle = "#b0b7c5";
        x.fillRect(16, 32, 32, 32);
        x.fillRect(0, 0, 32, 32);
        x.strokeStyle = "#868ea0";
        x.lineWidth = 3;
        x.beginPath();
        for (const y of [0, 32, 64]) {
          x.moveTo(0, y);
          x.lineTo(64, y);
        }
        for (const [a, y] of [
          [0, 0],
          [32, 0],
          [64, 0],
          [16, 32],
          [48, 32],
        ]) {
          x.moveTo(a, y);
          x.lineTo(a, y + 32);
        }
        x.stroke();
      }
    }).cv;
    return TEX[kind];
  }
  /** Výplň zdí: obrázek textury, bez něj procedurální vzor, nebo aspoň barva. */
  function wallFill(c, Wd) {
    const i = IMG[Wd.wall];
    let p = null;
    if (i && i.ok) p = c.createPattern(sprite(i, 192, 192), "repeat");
    else if (Wd.tex) p = c.createPattern(texCanvas(Wd.tex), "repeat");
    return p || Wd.fill;
  }

  /** Ozdoby pozadí podle světa (kreslí se jednou za úroveň do pozadí, ne v každém snímku). */
  function paintDeco(c, wi, rnd, ox, oy, W, H) {
    const TAU = Math.PI * 2;
    // místa po stranách bludiště na pochodně / kaktusy / lízátka (jen když je tam místo)
    const side = [];
    const sz = Math.min(ox * 0.75, 170);
    if (sz >= 70)
      for (const fy of [0.3, 0.8])
        side.push([ox / 2, oy + H * fy], [1920 - ox / 2, oy + H * fy]);
    if (wi === 0) {
      // trsy trávy
      for (let k = 0; k < 160; k++) {
        c.fillStyle = k % 2 ? "rgba(255,255,255,.07)" : "rgba(20,70,15,.1)";
        c.beginPath();
        c.ellipse(
          rnd() * 1920,
          rnd() * 1080,
          10 + rnd() * 16,
          4 + rnd() * 5,
          rnd() * 3,
          0,
          TAU,
        );
        c.fill();
      }
    } else if (wi === 1) {
      // závěje dole a padající sníh
      c.fillStyle = "rgba(255,255,255,.55)";
      for (let k = 0; k < 9; k++) {
        c.beginPath();
        c.ellipse(k * 240 + rnd() * 80, 1080, 200, 70 + rnd() * 40, 0, 0, TAU);
        c.fill();
      }
      for (let k = 0; k < 150; k++) {
        c.fillStyle = "rgba(255,255,255," + (0.35 + rnd() * 0.5) + ")";
        c.beginPath();
        c.arc(rnd() * 1920, rnd() * 1080, 2 + rnd() * 6, 0, TAU);
        c.fill();
      }
    } else if (wi === 2) {
      // duny, zrnka a kaktusy
      for (let k = 0; k < 8; k++) {
        c.fillStyle = k % 2 ? "rgba(255,230,170,.22)" : "rgba(160,70,20,.14)";
        c.beginPath();
        c.ellipse(rnd() * 1920, 200 + rnd() * 900, 320, 70, 0, 0, TAU);
        c.fill();
      }
      c.fillStyle = "rgba(120,60,20,.18)";
      for (let k = 0; k < 140; k++) {
        c.beginPath();
        c.arc(rnd() * 1920, rnd() * 1080, 2 + rnd() * 3, 0, TAU);
        c.fill();
      }
      for (const [x, y] of side) {
        const s = sz * 0.6;
        c.fillStyle = "#3f9b45";
        c.strokeStyle = "#24602a";
        c.lineWidth = s * 0.06;
        rr(c, x - s * 0.14, y - s * 0.6, s * 0.28, s * 1.2, s * 0.14);
        c.fill();
        c.stroke();
        rr(c, x - s * 0.5, y - s * 0.3, s * 0.22, s * 0.5, s * 0.11);
        c.fill();
        c.stroke();
        rr(c, x + s * 0.28, y - s * 0.45, s * 0.22, s * 0.5, s * 0.11);
        c.fill();
        c.stroke();
        c.fillRect(x - s * 0.4, y + s * 0.05, s * 0.3, s * 0.14);
        c.fillRect(x + s * 0.1, y - s * 0.1, s * 0.3, s * 0.14);
      }
    } else if (wi === 3) {
      // posypky a lízátka
      const pal = WORLDS[3].dots;
      for (let k = 0; k < 190; k++) {
        c.save();
        c.translate(rnd() * 1920, rnd() * 1080);
        c.rotate(rnd() * 3);
        c.fillStyle = pal[k % pal.length];
        c.globalAlpha = 0.75;
        rr(c, -9, -3, 18, 6, 3);
        c.fill();
        c.restore();
      }
      side.forEach(([x, y], k) => {
        const s = sz * 0.55;
        c.fillStyle = "#fff";
        c.fillRect(x - s * 0.05, y, s * 0.1, s * 0.9);
        c.fillStyle = ["#ff5fa2", "#7ad7ff", "#ffd23d", "#9b7bff"][k % 4];
        c.beginPath();
        c.arc(x, y, s * 0.45, 0, TAU);
        c.fill();
        c.strokeStyle = "rgba(255,255,255,.85)";
        c.lineWidth = s * 0.07;
        c.beginPath();
        for (let a = 0; a < 14; a += 0.3)
          c.lineTo(
            x + Math.cos(a) * a * s * 0.03,
            y + Math.sin(a) * a * s * 0.03,
          );
        c.stroke();
      });
    } else {
      // hvězdné nebe a veselé pochodně
      for (let k = 0; k < 120; k++) {
        c.fillStyle = "rgba(255,255,255," + (0.4 + rnd() * 0.5) + ")";
        c.beginPath();
        c.arc(rnd() * 1920, rnd() * 1080, 1.5 + rnd() * 2.5, 0, TAU);
        c.fill();
      }
      c.fillStyle = "#ffe27a";
      for (let k = 0; k < 14; k++) {
        starPath(c, rnd() * 1920, rnd() * 1080, 9 + rnd() * 8, 4, 5);
        c.fill();
      }
      for (const [x, y] of side) {
        const s = sz * 0.6;
        const gl = c.createRadialGradient(x, y - s * 0.3, 0, x, y - s * 0.3, s);
        gl.addColorStop(0, "rgba(255,190,80,.55)");
        gl.addColorStop(1, "rgba(255,190,80,0)");
        c.fillStyle = gl;
        c.fillRect(x - s, y - s * 1.3, s * 2, s * 2);
        c.fillStyle = "#6b4423";
        c.fillRect(x - s * 0.07, y - s * 0.1, s * 0.14, s * 0.7);
        c.fillStyle = "#8a8f9c";
        rr(c, x - s * 0.2, y - s * 0.2, s * 0.4, s * 0.16, s * 0.05);
        c.fill();
        c.fillStyle = "#ff8a1f";
        c.beginPath();
        c.ellipse(x, y - s * 0.42, s * 0.17, s * 0.27, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#ffe066";
        c.beginPath();
        c.ellipse(x, y - s * 0.36, s * 0.08, s * 0.15, 0, 0, TAU);
        c.fill();
      }
    }
  }

  function paintBg(g) {
    const L = g.L,
      c = bctx;
    const rnd = mulberry(L.seed ^ 0x5bd1e995);
    const Wd = WORLDS[L.world];
    c.setTransform(RES, 0, 0, RES, 0, 0);
    const gr = c.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, Wd.sky[0]);
    gr.addColorStop(1, Wd.sky[1]);
    c.fillStyle = gr;
    c.fillRect(0, 0, 1920, 1080);
    const { cs, ox, oy, C, R, th, open } = L;
    const W = C * cs,
      H = R * cs;
    paintDeco(c, L.world, rnd, ox, oy, W, H);
    c.fillStyle = Wd.band;
    c.fillRect(0, 0, 1920, 148);

    // cestičky (podlaha světa)
    rr(c, ox - th * 0.3, oy - th * 0.3, W + th * 0.6, H + th * 0.6, th);
    c.fillStyle = Wd.floor;
    c.fill();
    c.fillStyle = Wd.speck;
    for (let k = 0; k < C * R * 4; k++) {
      c.beginPath();
      c.arc(ox + rnd() * W, oy + rnd() * H, 2 + rnd() * 4, 0, Math.PI * 2);
      c.fill();
    }
    // startovní políčka v barvě dítěte
    g.players.forEach((p, i) => {
      const s = L.starts[i];
      c.globalAlpha = 0.3;
      c.fillStyle = TV.PLAYERS[p.who].color;
      c.beginPath();
      c.arc(cellX(L, s), cellY(L, s), cs * 0.38, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    });
    // ploty: všechny stěny jako jedna cesta, tahy s kulatými konci splynou v zaoblené pásy
    const segs = [];
    const path = new Path2D();
    path.moveTo(ox, oy);
    path.lineTo(ox + W, oy);
    path.lineTo(ox + W, oy + H);
    path.lineTo(ox, oy + H);
    path.closePath();
    for (let y = 0; y < R; y++)
      for (let x = 0; x < C; x++) {
        const o = open[y * C + x];
        if (x < C - 1 && !(o & 2))
          segs.push(
            ox + (x + 1) * cs,
            oy + y * cs,
            ox + (x + 1) * cs,
            oy + (y + 1) * cs,
          );
        if (y < R - 1 && !(o & 4))
          segs.push(
            ox + x * cs,
            oy + (y + 1) * cs,
            ox + (x + 1) * cs,
            oy + (y + 1) * cs,
          );
      }
    for (let k = 0; k < segs.length; k += 4) {
      path.moveTo(segs[k], segs[k + 1]);
      path.lineTo(segs[k + 2], segs[k + 3]);
    }
    c.lineCap = "round";
    c.lineJoin = "round";
    c.save();
    c.translate(th * 0.12, th * 0.24);
    c.strokeStyle = Wd.shadow;
    c.lineWidth = th;
    c.stroke(path);
    c.restore();
    c.strokeStyle = Wd.edge;
    c.lineWidth = th * 1.12;
    c.stroke(path);
    c.strokeStyle = wallFill(c, Wd);
    c.lineWidth = th * 0.88;
    c.stroke(path);
    // světlo shora
    c.save();
    c.translate(0, -th * 0.14);
    c.strokeStyle = Wd.light;
    c.lineWidth = th * 0.3;
    c.stroke(path);
    c.restore();
    // lístky / sníh / zrnka / posypky / kamínky na zdech (i po obvodu)
    const dots = Wd.dots;
    const outer = [
      ox,
      oy,
      ox + W,
      oy,
      ox + W,
      oy,
      ox + W,
      oy + H,
      ox,
      oy + H,
      ox + W,
      oy + H,
      ox,
      oy,
      ox,
      oy + H,
    ];
    const all = segs.concat(outer);
    for (let k = 0; k < all.length; k += 4) {
      const len = Math.hypot(all[k + 2] - all[k], all[k + 3] - all[k + 1]);
      const n = Math.max(2, Math.round(len / cs) * 3);
      for (let j = 0; j < n; j++) {
        const f = rnd();
        const lx =
          all[k] + (all[k + 2] - all[k]) * f + (rnd() - 0.5) * th * 0.5;
        const ly =
          all[k + 1] + (all[k + 3] - all[k + 1]) * f + (rnd() - 0.5) * th * 0.5;
        c.fillStyle = dots[(j + k) % dots.length];
        c.beginPath();
        c.arc(lx, ly, th * (0.07 + rnd() * 0.05), 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  /** Stopy se domalovávají přímo do pozadí: žádná práce navíc v každém snímku. */
  function footprint(g, p, cell, dir) {
    const bit = 1 << (dir + 4 * p.i);
    if (g.trail[cell] & bit) return;
    g.trail[cell] |= bit;
    const L = g.L,
      s = g.sp.foot[p.i],
      c = bctx;
    c.save();
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.translate(cellX(L, cell), cellY(L, cell));
    c.rotate((dir * Math.PI) / 2);
    // ve SPOLU stopy kousek vedle sebe, ať se nepřekryjí
    if (g.players.length > 1) c.translate((p.i ? 1 : -1) * L.cs * 0.1, 0);
    c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
    c.restore();
  }

  const cellX = (L, c) => L.ox + ((c % L.C) + 0.5) * L.cs;
  const cellY = (L, c) => L.oy + (Math.floor(c / L.C) + 0.5) * L.cs;

  // ---------- Stav, menu, párování, výběr úrovně ----------
  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    pair: null,
    game: null,
    raf: 0,
    lvlFocus: 0,
  };
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  const sayCs = (t) => TV.say(t, "cs-CZ");

  function clearCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function stopLoop() {
    cancelAnimationFrame(S.raf);
    S.raf = 0;
  }

  function showMenu() {
    stopLoop();
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    clearCanvas();
    screen.replaceChildren(el("div", "menu-bg garden"));
    const t = el("div", "title", "Bludiště");
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
    screen.replaceChildren(el("div", "menu-bg garden"), box);
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
    else showLevels();
  }

  // dohrané úrovně v localStorage, zvlášť pro Matyho, Nelu a SPOLU
  const doneKey = (mode) => "bludiste-done-" + mode;
  function loadDone(mode) {
    try {
      const a = JSON.parse(localStorage.getItem(doneKey(mode)) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function saveDone(mode, n) {
    const a = loadDone(mode);
    if (a.includes(n)) return;
    a.push(n);
    try {
      localStorage.setItem(doneKey(mode), JSON.stringify(a));
    } catch (e) {
      /* bez úložiště se jen nezapamatuje hvězda na dlaždici */
    }
  }

  /** Výběr úrovně: řada = svět (jméno vlevo, 4 dlaždice). focus = index dlaždice, bez něj první nedohraná. */
  const PER_ROW = 4;
  function showLevels(focus) {
    stopLoop();
    S.screen = "levels";
    S.game = null;
    clearCanvas();
    const max = MAXLVL;
    const done = loadDone(S.mode);
    if (focus == null) {
      focus = 0;
      while (focus < max - 1 && done.includes(focus + 1)) focus++;
      if (done.length >= max) focus = 0;
    }
    S.lvlFocus = Math.max(0, Math.min(max - 1, focus));
    const head = el("div", "lvl-title");
    if (S.mode === "spolu") {
      const both = el("div", "avatar-pair");
      both.append(avatarEl("maty"), avatarEl("nela"));
      head.appendChild(both);
    } else head.appendChild(avatarEl(S.mode));
    head.appendChild(el("div", "", "Vyber úroveň"));
    const grid = el("div", "levels");
    for (let w = 0; w * PER_ROW < max; w++) {
      const row = el("div", "lvl-row w" + w);
      row.appendChild(el("div", "lvl-world", WORLDS[w].name));
      for (let n = w * PER_ROW + 1; n <= Math.min(max, (w + 1) * PER_ROW); n++)
        row.appendChild(
          el("div", "lvl" + (done.includes(n) ? " done" : ""), String(n)),
        );
      grid.appendChild(row);
    }
    screen.replaceChildren(el("div", "menu-bg"), head, grid);
    markLevel();
    sayCs("Vyber si úroveň.");
  }
  function markLevel() {
    screen
      .querySelectorAll(".lvl")
      .forEach((c, i) => c.classList.toggle("focus", i === S.lvlFocus));
    // pozadí ve stylu světa, na kterém je fokus
    const bg = screen.querySelector(".menu-bg");
    if (bg) bg.className = "menu-bg w" + worldOf(S.lvlFocus + 1);
  }
  function levelsKey(e) {
    const n = e.name,
      max = MAXLVL;
    let f = S.lvlFocus;
    if (n === "left") f--;
    else if (n === "right") f++;
    else if (n === "up") f -= PER_ROW;
    else if (n === "down") f += PER_ROW;
    else if ((n === "ok" || n === "action") && e.type === "down") {
      TV.sound.flip();
      startRun(S.lvlFocus + 1);
      return;
    } else return;
    if (f < 0 || f >= max) return;
    S.lvlFocus = f;
    TV.sound.move();
    markLevel();
  }

  // ---------- Hra ----------
  function makePlayer(who, i) {
    return {
      who,
      i,
      c: 0, // políčko, na kterém stojí (při chůzi odkud jde)
      to: 0, // kam jde
      t: 0, // 0..1 cesta mezi políčky
      dir: 1,
      moving: false,
      spd: 3,
      held: [false, false, false, false],
      last: -1, // naposledy zmáčknutý směr
      buffer: -1, // zmáčknuto během chůze, zatočí na nejbližším možném místě
      bufT: 0,
      pause: 0,
      idle: 0,
      nudge: 0,
      nudgeDir: 0,
      bumpT: -9,
      stars: 0,
      starsTxt: "0",
      x: 0,
      y: 0,
      fx0: 0,
      fy0: 0,
      hint: new Int16Array(10),
      hintN: 0,
      idleLim: 8, // po kolika s nečinnosti třpytky (podle dítěte a úrovně)
      hintMax: 4, // kolik políček třpytky ukážou
    };
  }

  function startRun(n) {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    S.game = {
      mode: S.mode,
      startLevel: n,
      maxLevel: MAXLVL,
      players: kids.map(makePlayer),
      devices: S.pair ? S.pair.devices : null,
      t: 0,
      // předem připravené objekty pro oslavu a „+1“, ať se za hry nealokuje
      parts: Array.from({ length: 24 }, () => ({ x: 0, y: 0, vx: 0, vy: 0 })),
      pops: Array.from({ length: 6 }, () => ({ x: 0, y: 0, t: 9, s: null })),
      popI: 0,
    };
    S.screen = "game";
    buildLevel(S.game, n, true);
    last = 0;
    stopLoop();
    S.raf = requestAnimationFrame(frame);
  }

  /** first = první úroveň běhu (pak se vždy ohlásí svět, i když se začíná uprostřed). */
  function buildLevel(g, n, first) {
    const L = buildMaze(n, g.mode);
    g.L = L;
    g.level = n;
    g.phase = "intro";
    g.phaseT = 0;
    g.keysTaken = 0;
    g.keyGot = new Uint8Array(L.keys.length);
    g.gateOpen = new Uint8Array(L.gates.length);
    g.gateT = new Float32Array(L.gates.length);
    g.gwob = 0;
    g.gwobI = -1;
    g.trail = new Uint8Array(L.N);
    g.wob = 0;
    g.lockSaid = -9;
    g.winner = null;
    for (const pp of g.pops) pp.t = 9;
    const cs = L.cs;
    for (const p of g.players) {
      p.c = p.to = L.starts[p.i];
      p.t = 0;
      p.moving = false;
      p.buffer = -1;
      p.pause = 0;
      p.idle = 0;
      p.nudge = 0;
      p.hintN = 0;
      p.idleLim = idleOf(p.who, n);
      p.hintMax = hintOf(p.who, n);
      p.spd = Math.min(SPEED[p.who], PXS[p.who] / cs);
      p.x = cellX(L, p.c);
      p.y = cellY(L, p.c);
    }
    // plátna v přesné velikosti pro tuhle úroveň (v každém snímku se jen kopírují)
    g.sp = {
      star: fromImg("star", cs * 0.5, drawStar),
      starHud: fromImg("star", 60, drawStar),
      key: fromImg("key", cs * 0.62, drawKey),
      keyHud: fromImg("key", 70, drawKey),
      chest: fromImg("chest", cs * 0.9, drawChest),
      chestOpen: fromImg("chest-open", cs * 0.9, drawChestOpen),
      lock: mk(cs * 0.36, cs * 0.36, drawLock),
      spark: mk(cs * 0.42, cs * 0.42, sparkDraw(WORLDS[L.world].spark)),
      gate: mk(cs * 0.86, L.th * 1.3, drawGate),
      av: g.players.map((p) => avatarSprite(p.who, cs * 0.64)),
      avHud: g.players.map((p) => avatarSprite(p.who, 92)),
      foot: g.players.map((p) =>
        footSprite(cs * 0.44, TV.PLAYERS[p.who].color),
      ),
    };
    ctx.font = '900 60px "Trebuchet MS", Roboto, sans-serif';
    g.label = ("Úroveň " + n).toUpperCase();
    g.labelW = ctx.measureText(g.label).width;
    paintBg(g);
    const duo = g.players.length > 1;
    // nový svět (nebo začátek hry): krátce ohlásit jeho jméno
    const Wd = WORLDS[L.world];
    const announce = first || (n - 1) % 4 === 0;
    g.introT = announce ? 2.3 : 1.5;
    const box = el("div", "count ready" + (announce ? " intro" : ""));
    if (announce)
      box.append(
        el("div", "intro-world", Wd.name),
        el("div", "intro-lvl", "Úroveň " + n),
      );
    else box.textContent = "Úroveň " + n;
    screen.replaceChildren(box);
    const goal = L.keys.length
      ? duo
        ? "Najděte klíč!"
        : "Najdi klíč!"
      : duo
        ? "Najděte poklad!"
        : "Najdi poklad!";
    if (announce) TV.say([Wd.name + "!", goal], "cs-CZ");
    else sayCs(goal);
  }

  function playerOf(e) {
    const g = S.game;
    if (g.players.length === 1) return g.players[0];
    const d = g.devices || {};
    if (e.device === d.maty) return g.players[0];
    if (e.device === d.nela) return g.players[1];
    return null;
  }
  function heldPref(p) {
    if (p.last >= 0 && p.held[p.last]) return p.last;
    for (let d = 0; d < 4; d++) if (p.held[d]) return d;
    return -1;
  }
  /** Dá se jít směrem d? Zamčená truhla i branka jsou jako plot (report = zahoupat jimi). */
  function canMove(p, d, report) {
    const g = S.game,
      L = g.L;
    if (!(L.open[p.c] & (1 << d))) return false;
    if (L.lock[p.c] & (1 << d)) {
      if (report) lockedBump(p, L.gateAt[p.c * 4 + d]);
      return false;
    }
    if (p.c + L.step[d] === L.chest && g.keysTaken < L.keys.length) {
      if (report) lockedBump(p, -1);
      return false;
    }
    return true;
  }
  function tryStart(p, d, bump) {
    if (!canMove(p, d, bump)) {
      if (bump) nudge(p, d);
      return false;
    }
    p.dir = d;
    p.to = p.c + S.game.L.step[d];
    p.moving = true;
    p.t = 0;
    p.pause = 0;
    return true;
  }
  function nudge(p, d) {
    const g = S.game;
    p.nudge = 0.22;
    p.nudgeDir = d;
    if (g.t - p.bumpT > 0.3) {
      TV.sound.nope();
      p.bumpT = g.t;
    }
  }
  /** gi = index branky, -1 = truhla. */
  function lockedBump(p, gi) {
    const g = S.game;
    if (gi >= 0) {
      g.gwob = 0.7;
      g.gwobI = gi;
    } else g.wob = 0.7;
    if (g.t - g.lockSaid > 4) {
      g.lockSaid = g.t;
      sayCs(
        g.players.length > 1 ? "Nejdřív najděte klíč." : "Nejdřív najdi klíč.",
      );
    }
  }
  /** Co dál po příchodu na políčko: zatočit podle zmáčknutého, držená šipka vede chodbou dál. */
  function chooseNext(p) {
    const L = S.game.L,
      o = L.open[p.c],
      exits = BITS[o];
    if (p.buffer >= 0) {
      const b = p.buffer;
      p.buffer = -1;
      if (canMove(p, b, false)) return b;
    }
    const h = heldPref(p);
    if (h < 0) return -1;
    const dir = p.dir;
    if (h !== dir && canMove(p, h, false)) return h;
    if (!p.held[dir]) return -1;
    if (canMove(p, dir, false)) {
      if (exits <= 2) return dir;
      p.pause = JPAUSE[p.who]; // křižovatka: chvilku postát, ať má dítě čas vybrat
      return -1;
    }
    // Maty chodbu zatáčkou sám provede, Nela v zatáčce zastaví a zatočí sama
    if (exits === 2 && p.who === "maty") {
      for (let d = 0; d < 4; d++)
        if (d !== (dir + 2) % 4 && o & (1 << d) && canMove(p, d, false))
          return d;
    }
    return -1;
  }
  function arrive(p) {
    const g = S.game;
    footprint(g, p, p.c, p.dir);
    p.c = p.to;
    p.moving = false;
    onCell(p);
    const d = chooseNext(p);
    if (d >= 0 && tryStart(p, d, false)) return true;
    const h = heldPref(p);
    if (h >= 0 && p.pause <= 0) canMove(p, h, true); // drží šipku k zamčené truhle / brance
    return false;
  }
  function onCell(p) {
    const g = S.game,
      L = g.L;
    const k = L.starAt[p.c];
    if (k >= 0 && !L.stars[k].taken) {
      L.stars[k].taken = true;
      p.stars++;
      p.starsTxt = String(p.stars);
      TV.sound.ding();
      pop(g, cellX(L, p.c), cellY(L, p.c), g.sp.star);
    }
    const ki = L.keyAt[p.c];
    if (ki >= 0 && !g.keyGot[ki]) {
      g.keyGot[ki] = 1;
      g.keysTaken++;
      TV.sound.match();
      sayCs("Klíč!");
      pop(g, cellX(L, p.c), cellY(L, p.c), g.sp.key);
      // branky, na které už klíče stačí, jsou průchozí (i pro hledání cesty)
      L.gates.forEach((gt, i) => {
        if (i < g.keysTaken) {
          L.lock[gt.a] &= ~(1 << gt.d);
          L.lock[gt.b] &= ~(1 << ((gt.d + 2) & 3));
        }
      });
      // nápověda teď vede k dalšímu klíči nebo k truhle
      for (const q of g.players) if (q.idle >= q.idleLim) computeHint(q);
    }
    // branka se otevře, když k ní přijde dítě s klíčem
    for (let i = 0; i < L.gates.length; i++) {
      const gt = L.gates[i];
      if (g.gateOpen[i] || i >= g.keysTaken || (p.c !== gt.a && p.c !== gt.b))
        continue;
      g.gateOpen[i] = 1;
      g.gateT[i] = g.t;
      TV.sound.whoosh();
    }
  }
  function pop(g, x, y, s) {
    const pp = g.pops[g.popI++ % g.pops.length];
    pp.x = x;
    pp.y = y;
    pp.t = 0;
    pp.s = s;
  }

  /** Třpytky: další políčka nejkratší cesty k nejbližšímu nesebranému klíči (zavřenou brankou
   *  nevede, ta se otevře až s klíčem), když jsou klíče posbírané, tak k truhle. */
  const TG = new Int16Array(4);
  function computeHint(p) {
    const g = S.game,
      L = g.L;
    let n = 0;
    if (g.keysTaken < L.keys.length) {
      for (let k = 0; k < L.keys.length; k++) if (!g.keyGot[k]) TG[n++] = L.keys[k];
      bfsMulti(L, TG, n, L.chest);
    }
    if (!n || DIST[p.c] < 0) {
      // záchrana: aspoň k truhle (nemělo by nastat, klíč je vždy dosažitelný)
      TG[0] = L.chest;
      bfsMulti(L, TG, 1, -1);
    }
    p.hintN = 0;
    if (DIST[p.c] <= 0) return;
    for (let c = PREV[p.c]; c >= 0 && p.hintN < p.hintMax; c = PREV[c])
      p.hint[p.hintN++] = c;
  }

  function win(p) {
    const g = S.game,
      L = g.L;
    g.phase = "won";
    g.phaseT = 0;
    g.winner = p;
    saveDone(g.mode, g.level);
    TV.sound.win();
    // žádné DOM konfety, dokud běží canvas smyčka (na slabé TV se to trhá);
    // oslavu úrovně dělají hvězdičky z truhly na plátně, konfety jen na celkové oslavě
    sayCs("Poklad!");
    const x = cellX(L, L.chest),
      y = cellY(L, L.chest);
    for (const q of g.parts) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 500 + Math.random() * 600;
      q.x = x;
      q.y = y;
      q.vx = Math.cos(a) * v;
      q.vy = Math.sin(a) * v;
    }
    // ten druhý se k truhle „přenese“ (odkud zrovna je)
    for (const q of g.players) {
      q.fx0 = q.x;
      q.fy0 = q.y;
    }
  }

  function updatePlayer(p, dt) {
    const g = S.game,
      L = g.L;
    if (p.moving) {
      p.idle = 0;
      p.t += p.spd * dt;
      // do truhly se nevchází celý, zastaví se před ní a otevře ji
      if (p.to === L.chest && p.t >= 0.42) {
        p.t = 0.42;
        win(p);
        return;
      }
      if (p.t >= 1) {
        const left = p.t - 1;
        if (arrive(p)) p.t = Math.min(left, 0.5);
        else p.t = 0;
      }
    } else {
      if (p.pause > 0) {
        p.pause -= dt;
        if (p.pause <= 0) {
          const h = heldPref(p);
          if (h >= 0) tryStart(p, h, false);
        }
      }
      const lim = p.idleLim,
        before = p.idle;
      p.idle += dt;
      if (before < lim && p.idle >= lim) computeHint(p);
    }
    p.nudge = Math.max(0, p.nudge - dt);
    if (p.buffer >= 0) {
      p.bufT -= dt;
      if (p.bufT <= 0) p.buffer = -1;
    }
  }

  function update(dt) {
    const g = S.game,
      L = g.L;
    g.t += dt;
    g.wob = Math.max(0, g.wob - dt);
    g.gwob = Math.max(0, g.gwob - dt);
    for (const pp of g.pops) pp.t += dt;
    if (g.phase === "intro") {
      g.phaseT += dt;
      if (g.phaseT > g.introT) {
        g.phase = "play";
        screen.replaceChildren();
        // kdo už drží šipku, rovnou vyrazí
        for (const p of g.players) {
          const h = heldPref(p);
          if (h >= 0) tryStart(p, h, false);
        }
      }
    } else if (g.phase === "play") {
      for (const p of g.players) {
        updatePlayer(p, dt);
        if (g.phase !== "play") break;
      }
    } else if (g.phase === "won") {
      g.phaseT += dt;
      for (const q of g.parts) {
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vy += 1400 * dt;
      }
      if (g.phaseT > (g.players.length > 1 ? 3.1 : 2.7)) {
        if (g.level < g.maxLevel) buildLevel(g, g.level + 1);
        else showEnd();
        return;
      }
    }
    // polohy na scéně
    for (const p of g.players) {
      if (g.phase === "won" && p !== g.winner) {
        // let k truhle obloukem přes ploty
        const w = g.winner;
        const k = Math.max(0, Math.min(1, (g.phaseT - 0.6) / 0.9));
        const e = k * k * (3 - 2 * k);
        const tx = w.x + L.cs * 0.5,
          ty = w.y + L.cs * 0.1;
        p.x = p.fx0 + (tx - p.fx0) * e;
        p.y = p.fy0 + (ty - p.fy0) * e - Math.sin(k * Math.PI) * L.cs * 1.2;
        continue;
      }
      const ax = cellX(L, p.c),
        ay = cellY(L, p.c);
      if (p.moving) {
        p.x = ax + (cellX(L, p.to) - ax) * p.t;
        p.y = ay + (cellY(L, p.to) - ay) * p.t;
      } else {
        p.x = ax;
        p.y = ay;
      }
    }
  }

  // ---------- Kreslení ----------
  function draw() {
    const g = S.game,
      L = g.L,
      sp = g.sp,
      cs = L.cs,
      t = g.t;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.drawImage(bgCv, 0, 0, 1920, 1080);
    // hvězdičky
    for (let k = 0; k < L.stars.length; k++) {
      const s = L.stars[k];
      if (s.taken) continue;
      blit(
        sp.star,
        cellX(L, s.c),
        cellY(L, s.c) + Math.sin(t * 3 + k) * cs * 0.05,
        1,
      );
    }
    // klíče
    for (let k = 0; k < L.keys.length; k++)
      if (!g.keyGot[k])
        blit(
          sp.key,
          cellX(L, L.keys[k]),
          cellY(L, L.keys[k]),
          1 + Math.sin(t * 4 + k) * 0.07,
          1,
          Math.sin(t * 2 + k) * 0.18,
        );
    // branky (zavřené se zámkem, otevřená krátce zmizí)
    for (let i = 0; i < L.gates.length; i++) {
      const gt = L.gates[i];
      let a = 1,
        k = 1;
      if (g.gateOpen[i]) {
        const e = (t - g.gateT[i]) / 0.45;
        if (e >= 1) continue;
        a = 1 - e;
        k = 1 + e * 0.4;
      }
      let x = (cellX(L, gt.a) + cellX(L, gt.b)) / 2,
        y = (cellY(L, gt.a) + cellY(L, gt.b)) / 2;
      if (g.gwob > 0 && g.gwobI === i) {
        const sh = Math.sin(g.gwob * 40) * cs * 0.05 * (g.gwob / 0.7);
        if (gt.d & 1) y += sh;
        else x += sh;
      }
      blit(sp.gate, x, y, k, a, gt.d & 1 ? Math.PI / 2 : 0);
      if (i >= g.keysTaken) blit(sp.lock, x, y, 0.85, a);
    }
    // truhla
    const chx = cellX(L, L.chest),
      chy = cellY(L, L.chest);
    if (g.phase === "won") {
      const k = 1 + 0.3 * Math.sin(Math.min(1, g.phaseT * 2.5) * Math.PI);
      blit(sp.chestOpen, chx, chy, k);
    } else {
      const rot = g.wob > 0 ? Math.sin(g.wob * 28) * 0.16 * (g.wob / 0.7) : 0;
      blit(sp.chest, chx, chy, 1, 1, rot);
      if (g.keysTaken < L.keys.length)
        blit(sp.lock, chx, chy + cs * 0.16, 1, 1, rot);
    }
    // třpytky nápovědy
    if (g.phase === "play")
      for (const p of g.players) {
        if (p.moving || p.idle < p.idleLim) continue;
        for (let k = 0; k < p.hintN; k++) {
          const a = 0.55 + 0.45 * Math.sin(t * 7 - k * 0.9);
          blit(
            sp.spark,
            cellX(L, p.hint[k]),
            cellY(L, p.hint[k]),
            0.75 + 0.35 * a,
            a,
            t * 1.5 + k,
          );
        }
      }
    // děti
    const duo = g.players.length > 1;
    let sep = 0;
    if (duo && g.phase !== "won") {
      const a = g.players[0],
        b = g.players[1];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < cs * 0.5) sep = cs * 0.17; // na jednom políčku vedle sebe
    }
    for (const p of g.players) {
      let x = p.x + (p.i ? sep : -sep),
        y = p.y;
      if (p.moving && g.phase === "play")
        y -= Math.abs(Math.sin(p.t * Math.PI)) * cs * 0.07;
      if (p.nudge > 0) {
        const n = Math.sin((p.nudge / 0.22) * Math.PI) * cs * 0.12;
        x += DX[p.nudgeDir] * n;
        y += DY[p.nudgeDir] * n;
      }
      if (g.phase === "won" && p === g.winner)
        y -= Math.abs(Math.sin(g.phaseT * 7)) * cs * 0.12; // radost
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath();
      ctx.ellipse(
        p.x + (p.i ? sep : -sep),
        p.y + cs * 0.27,
        cs * 0.24,
        cs * 0.08,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      blit(sp.av[p.i], x, y, 1);
    }
    // +1 nad sebranou hvězdičkou / klíčem
    for (const pp of g.pops)
      if (pp.t < 0.8)
        blit(pp.s, pp.x, pp.y - pp.t * cs * 1.2, 1.1, 1 - pp.t / 0.8);
    // oslava: hvězdičky z truhly
    if (g.phase === "won" && g.phaseT < 1.6)
      for (const q of g.parts) blit(sp.star, q.x, q.y, 0.6, 1 - g.phaseT / 1.6);

    // horní lišta: avatar a hvězdičky každého dítěte, uprostřed úroveň a klíč
    ctx.textBaseline = "middle";
    ctx.font = '900 60px "Trebuchet MS", Roboto, sans-serif';
    for (let i = 0; i < g.players.length; i++) {
      const p = g.players[i];
      const x0 = i === 0 ? 30 : 1920 - 330;
      ctx.fillStyle = "rgba(10,30,10,.55)";
      rr(ctx, x0, 20, 300, 110, 55);
      ctx.fill();
      blit(sp.avHud[i], x0 + 56, 75, 1);
      blit(sp.starHud, x0 + 150, 75, 1);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd23d";
      ctx.fillText(p.starsTxt, x0 + 188, 78);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillText(g.label, 960, 81);
    ctx.fillStyle = "#fff";
    ctx.fillText(g.label, 960, 75);
    // klíče v liště: sebrané plné, chybějící průhledné
    for (let k = 0; k < L.keys.length; k++)
      blit(
        sp.keyHud,
        960 + g.labelW / 2 + 70 + k * 78,
        75,
        1,
        k < g.keysTaken ? 1 : 0.3,
      );
  }

  let last = 0;
  function frame(tm) {
    const dt = Math.min(0.05, last ? (tm - last) / 1000 : 0);
    last = tm;
    if (S.screen !== "game" || !S.game) {
      S.raf = 0;
      return;
    }
    update(dt);
    if (S.screen !== "game") return;
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- Celková oslava ----------
  function showEnd() {
    const g = S.game;
    S.screen = "end";
    S.endAt = performance.now();
    S.focus = 0;
    stopLoop();
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
  function gameKey(e) {
    const g = S.game;
    const p = playerOf(e);
    if (!p) return;
    const d = DIRS[e.name];
    if (d === undefined) {
      // OK = ukaž cestu hned, jen pro Matyho (Nele by to bralo výzvu, ta má třpytky jen po 8 s)
      if (
        p.who === "maty" &&
        (e.name === "ok" || e.name === "action") &&
        e.type === "down" &&
        g.phase === "play" &&
        !p.moving
      ) {
        p.idle = Math.max(p.idle, p.idleLim);
        computeHint(p);
      }
      return;
    }
    if (e.type === "up") {
      p.held[d] = false;
      return;
    }
    p.held[d] = true; // i opakování = drží (po pauze appky)
    if (e.type === "down") {
      p.last = d;
      p.idle = 0;
    }
    if (g.phase !== "play") return;
    if (e.type === "repeat") {
      if (!p.moving && p.pause <= 0) tryStart(p, d, false);
      return;
    }
    if (p.moving) {
      if (d === (p.dir + 2) % 4) {
        // otočka uprostřed cesty mezi políčky
        const c = p.c;
        p.c = p.to;
        p.to = c;
        p.dir = d;
        p.t = 1 - p.t;
      } else if (d !== p.dir) {
        p.buffer = d;
        p.bufT = 0.6;
      }
    } else {
      p.pause = 0;
      tryStart(p, d, true);
    }
  }

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
        else showLevels();
      }
    } else if (S.screen === "pair") {
      pairKey(e);
    } else if (S.screen === "levels") {
      levelsKey(e);
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
        if (S.focus === 0) startRun(S.game.startLevel);
        else showMenu();
      }
    }
  });

  // přepnutí appky: puštěné šipky by se ztratily a dítě by chodilo samo
  TV.onPause(() => {
    if (S.game)
      for (const p of S.game.players) {
        p.held.fill(false);
        p.buffer = -1;
      }
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    if (S.screen === "game") showLevels(S.game.level - 1);
    else if (S.screen === "end") showLevels();
    else showMenu();
    return true;
  });

  window.BLUDISTE = S; // ladění v náhledu
  // generátor a úrovně pro ověřovací skript (řešitelnost všech úrovní v Node)
  S.buildMaze = buildMaze;
  S.LEVELS = LEVELS;
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
