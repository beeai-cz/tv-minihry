/* Skákačka pro Matyho (3) a Nelu (5). Běh šipkami, skok OK / A / nahoru (puštěním dřív nižší skok).
 * Sbírají se hvězdičky, na šneka a berušku se dá skočit (promění se ve hvězdičku), hříbek je trampolína.
 * Nedá se prohrát: pád do díry = „Hups!“ a zpátky na kraj. Cíl je vlajka. SPOLU = oba na jedné obrazovce. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // Výkon na TV: kreslení v polovičním rozlišení (jako Závody).
  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;

  // ---------- Obrázky ----------
  const IMG = {};
  [
    "maty-stand",
    "maty-jump",
    "nela-stand",
    "nela-jump",
    "snail",
    "ladybug",
    "star",
    "crate",
    "starblock",
    "bush",
    "snowman",
    "lollipop",
    "flag",
    "cloud",
    "mushroom",
    "penguin",
    "gummy",
    "bg",
    "bg-winter",
    "bg-candy",
  ].forEach((n) => {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = "img/" + n + (n.startsWith("bg") ? ".jpg" : ".png");
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
  /** Šířka postavičky tak, aby byla vždy stejně vysoká (stání i skok). */
  function kidW(name) {
    const i = IMG[name];
    return i && i.ok ? (185 * i.naturalWidth) / i.naturalHeight : 100;
  }
  /** Obrázek zarovnaný spodkem na (x, bottom), šířka w; flip = zrcadlově. Vrací výšku. */
  function drawImg(name, x, bottom, w, flip, alpha) {
    const i = IMG[name];
    if (!i || !i.ok) {
      ctx.fillStyle = "#ff6b9a";
      ctx.fillRect(x - w / 2, bottom - w, w, w);
      return w;
    }
    const h = (w * i.naturalHeight) / i.naturalWidth;
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(x, bottom - h / 2);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sprite(i, w, h), -w / 2, -h / 2, w, h);
    ctx.restore();
    return h;
  }

  // ---------- Světy: každý další je delší a má jiné barvy a zvířátka ----------
  const WORLDS = [
    { name: "Louka", bg: "bg", top: "#6cc04a", topDark: "#3f8a2c", edge: "#2b4d1f", dirt: "#b5743b",
      dirtDot: "#9a5f2c", foes: ["snail", "ladybug"], decor: "bush", extra: 0 },
    { name: "Zima", bg: "bg-winter", top: "#f4faff", topDark: "#b9d2ea", edge: "#5d7ea6", dirt: "#86a3c9",
      dirtDot: "#6f8db6", foes: ["penguin", "snail"], decor: "snowman", extra: 6, fade: 0.2 },
    { name: "Cukrová země", bg: "bg-candy", top: "#ff9bd2", topDark: "#e06aa8", edge: "#8a2f60", dirt: "#c9895a",
      dirtDot: "#a86d44", foes: ["gummy", "ladybug"], decor: "lollipop", extra: 12, fade: 0.35 },
  ];
  // rozměry zvířátek (zásah) a šířka obrázku
  const FOE = {
    snail: { w: 96, h: 80, img: 110, speed: 55 },
    ladybug: { w: 84, h: 66, img: 96, speed: 110 },
    penguin: { w: 80, h: 100, img: 100, speed: 80 },
    gummy: { w: 84, h: 96, img: 100, speed: 95 },
  };
  let TH = WORLDS[0];

  // ---------- Svět ----------
  const T = 96; // velikost dlaždice
  const ROWS = 11; // 11 * 96 = 1056 px, vejde se na výšku obrazovky
  const GROUND = 9; // horní řada běžné země
  const G = 3600; // gravitace px/s²
  const JUMP = 1650; // rychlost odrazu (~4 dlaždice vysoko)
  const RUN = 520;
  const E = { EMPTY: 0, GROUND: 1, CRATE: 2, STARBLOCK: 3, USED: 4, ISLAND: 5 };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /** Úroveň z dílků. Velikost děr a kopců podle obtížnosti, ať je vždy hratelná. */
  function buildLevel(diff) {
    const easy = diff === "maty";
    const cols = [];
    const items = []; // hvězdičky {x, y}
    const enemies = []; // {kind, x}
    const decor = []; // {kind, x, y}
    const springs = []; // hříbky-trampolíny {x, y}
    const col = (top) => {
      cols.push({ top, extra: {} });
      return cols.length - 1;
    };
    const flat = (n, top = GROUND) => {
      const s = cols.length;
      for (let i = 0; i < n; i++) col(top);
      return s;
    };
    const starsAt = (c0, n, row) => {
      for (let i = 0; i < n; i++)
        items.push({ x: (c0 + i) * T + T / 2, y: row * T + T / 2 });
    };

    flat(6);
    decor.push({ kind: TH.decor, c: 2 });
    // Dlouhá trasa: dílky v náhodném pořadí, stejný dílek nikdy dvakrát po sobě.
    const pool = easy
      ? [
          "flat",
          "gap",
          "platform",
          "enemy",
          "step",
          "crates",
          "spring",
          "stairs",
          "hill",
          "tunnel",
          "pools",
        ]
      : [
          "gap",
          "platform",
          "enemy",
          "step",
          "crates",
          "spring",
          "stairs",
          "hill",
          "tunnel",
          "pools",
          "enemy2",
          "gap",
        ];
    // další světy jsou delší (Maty o polovinu přídavku)
    const count = (easy ? 28 : 38) + (easy ? TH.extra / 2 : TH.extra);
    const segs = [];
    let bag = [];
    while (segs.length < count) {
      if (!bag.length) bag = TV.shuffle(pool.slice());
      const s = bag.pop();
      if (s === segs[segs.length - 1]) continue;
      segs.push(s);
    }

    const enemy = (c, kind) =>
      enemies.push({
        kind: kind || (easy ? TH.foes[0] : pick(TH.foes)),
        x: c * T,
      });
    for (const s of segs) {
      if (s === "flat") {
        const c = flat(ri(5, 7));
        starsAt(c + 1, 3, GROUND - 2);
        if (Math.random() < 0.6) decor.push({ kind: TH.decor, c: c + 4 });
      } else if (s === "gap") {
        flat(2);
        const n = easy ? ri(1, 2) : ri(2, 3);
        const g0 = cols.length;
        for (let i = 0; i < n; i++) col(null);
        starsAt(g0, n, GROUND - 3);
        flat(3);
      } else if (s === "step") {
        const h = easy ? 1 : ri(1, 2);
        flat(2);
        const c = flat(ri(4, 6), GROUND - h);
        starsAt(c + 1, 2, GROUND - h - 2);
        flat(2);
      } else if (s === "stairs") {
        // schody nahoru, nahoře plošina se hvězdičkami, schody dolů
        const h = easy ? 2 : 3;
        flat(2);
        for (let k = 1; k <= h; k++) flat(2, GROUND - k);
        const c = flat(4, GROUND - h);
        starsAt(c, 4, GROUND - h - 2);
        for (let k = h - 1; k >= 1; k--) flat(2, GROUND - k);
        flat(2);
      } else if (s === "hill") {
        // kopeček: pozvolna nahoru a dolů, pod ním zvířátko
        const h = easy ? 2 : 3;
        flat(1);
        for (let k = 1; k < h; k++) flat(3, GROUND - k);
        const c = flat(easy ? 4 : 5, GROUND - h);
        decor.push({ kind: TH.decor, c: c + 2 });
        starsAt(c + 1, 2, GROUND - h - 3);
        for (let k = h - 1; k >= 1; k--) flat(3, GROUND - k);
        const d = flat(7);
        enemy(d + 4);
      } else if (s === "tunnel") {
        // nízký tunel: podlézt (skrčit se) nebo vyskočit nahoru
        flat(3);
        const n = easy ? 4 : ri(5, 6);
        const c = flat(n);
        for (let i = 0; i < n; i++) {
          cols[c + i].extra[GROUND - 2] = E.GROUND;
          cols[c + i].extra[GROUND - 3] = E.GROUND;
        }
        starsAt(c, n, GROUND - 1);
        starsAt(c + 1, n - 2, GROUND - 5);
        flat(3);
      } else if (s === "pools") {
        // voda s ostrůvky, přeskákat z jednoho na druhý
        const islands = easy ? 2 : 3;
        flat(2);
        for (let k = 0; k < islands; k++) {
          const g0 = cols.length;
          const n = easy ? 1 : ri(1, 2);
          for (let i = 0; i < n; i++) col(null);
          starsAt(g0, n, GROUND - 3);
          flat(3, k % 2 ? GROUND : GROUND - 1);
        }
        for (let i = 0; i < (easy ? 1 : 2); i++) col(null);
        flat(3);
      } else if (s === "platform") {
        const c = flat(ri(7, 9));
        const row = GROUND - 3; // pod plošinkou se dá projít
        const p0 = c + 2,
          pn = ri(3, 4);
        for (let i = 0; i < pn; i++)
          cols[p0 + i].extra[row] =
            i === 1 && Math.random() < 0.7 ? E.STARBLOCK : E.ISLAND;
        starsAt(p0, pn, row - 1);
      } else if (s === "enemy") {
        const c = flat(ri(7, 9));
        enemy(c + 5);
        starsAt(c + 2, 2, GROUND - 3);
      } else if (s === "enemy2") {
        const c = flat(12);
        enemy(c + 4);
        enemy(c + 9);
        starsAt(c + 3, 6, GROUND - 3);
      } else if (s === "crates") {
        const c = flat(ri(6, 8));
        const h = easy ? 1 : ri(1, 2);
        for (let r = 0; r < h; r++) cols[c + 3].extra[GROUND - 1 - r] = E.CRATE;
        starsAt(c + 3, 1, GROUND - h - 2);
      } else if (s === "spring") {
        const c = flat(ri(6, 7));
        springs.push({ x: (c + 3) * T + T / 2, y: GROUND * T });
        starsAt(c + 3, 1, 2);
        starsAt(c + 3, 1, 3);
      }
    }
    const endC = flat(12);
    const flagX = (endC + 6) * T;
    decor.push({ kind: TH.decor, c: endC + 9 });
    // mraky na obloze
    const clouds = [];
    for (let x = 300; x < cols.length * T; x += rnd(1400, 2400))
      clouds.push({ x, y: rnd(80, 320), w: rnd(200, 320) });

    // mřížka dlaždic
    const W = cols.length;
    const grid = new Uint8Array(W * ROWS);
    cols.forEach((c, x) => {
      for (let y = 0; y < ROWS; y++) {
        let t = c.top != null && y >= c.top ? E.GROUND : E.EMPTY;
        if (c.extra[y] != null) t = c.extra[y];
        grid[y * W + x] = t;
      }
    });
    return {
      W,
      grid,
      items: items.map((s) => ({ ...s, taken: false })),
      enemies: enemies.map((e) => ({
        ...e,
        y: 0,
        dir: -1,
        dead: false,
        poof: 0,
        w: FOE[e.kind].w,
        h: FOE[e.kind].h,
      })),
      decor: decor.map((d) => ({
        kind: d.kind,
        x: d.c * T + T / 2,
        y: topOf(cols, d.c),
      })),
      springs,
      clouds,
      flagX,
    };
  }
  function topOf(cols, c) {
    const t = cols[c] && cols[c].top;
    return (t == null ? GROUND : t) * T;
  }

  function tile(L, cx, cy) {
    if (cx < 0 || cx >= L.W) return E.GROUND; // okraje světa jsou zeď
    if (cy < 0 || cy >= ROWS) return E.EMPTY; // dole díra
    return L.grid[cy * L.W + cx];
  }

  // Dlaždice předkreslené do plátek po 20 sloupcích (jedno obří plátno by slabá TV neunesla),
  // použité bloky a můstky se dokreslí.
  const CHUNK = 20;
  let chunks = [];
  function chunkCtx(cx) {
    const k = Math.floor(cx / CHUNK);
    const c = chunks[k].getContext("2d");
    c.save();
    c.scale(RES, RES);
    c.translate(-k * CHUNK * T, 0);
    return c;
  }
  function paintTile(L, cx, cy) {
    const c = chunkCtx(cx);
    const x = cx * T,
      y = cy * T,
      t = tile(L, cx, cy);
    c.clearRect(x, y, T, T);
    const above = tile(L, cx, cy - 1);
    if (t === E.GROUND) {
      c.fillStyle = TH.dirt;
      c.fillRect(x, y, T + 1, cy === ROWS - 1 ? 1080 - y : T + 1); // spodní řada až k okraji
      c.fillStyle = TH.dirtDot;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.arc(
          x + 20 + ((cx * 37 + cy * 11 + k * 29) % 56),
          y + 30 + ((cx * 13 + k * 41) % 50),
          7,
          0,
          7,
        );
        c.fill();
      }
      if (above !== E.GROUND) {
        c.fillStyle = TH.top;
        c.fillRect(x, y, T + 1, 30);
        c.fillStyle = TH.topDark;
        c.fillRect(x, y + 26, T + 1, 6);
        c.fillStyle = TH.edge;
        c.fillRect(x, y, T + 1, 5);
      }
    } else if (t === E.ISLAND) {
      round(c, x + 3, y + 6, T - 6, T - 20, 18, TH.dirt, "#5a3416");
      round(c, x + 3, y + 6, T - 6, 28, 14, TH.top, TH.edge);
    } else if (t === E.CRATE || t === E.STARBLOCK) {
      const i = IMG[t === E.CRATE ? "crate" : "starblock"];
      if (i && i.ok) c.drawImage(i, x + 2, y + 2, T - 4, T - 4);
      else
        round(
          c,
          x + 4,
          y + 4,
          T - 8,
          T - 8,
          10,
          t === E.CRATE ? "#c98a4b" : "#ffd23d",
          "#5a3416",
        );
    } else if (t === E.USED) {
      round(c, x + 4, y + 4, T - 8, T - 8, 12, "#d9a066", "#5a3416");
    }
    c.restore();
  }
  function round(c, x, y, w, h, r, fill, stroke) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = stroke;
    c.stroke();
  }
  function paintAll(L) {
    chunks = [];
    for (let k = 0; k * CHUNK < L.W; k++) {
      const cv = document.createElement("canvas");
      cv.width = Math.ceil(CHUNK * T * RES);
      cv.height = Math.ceil(1080 * RES);
      chunks.push(cv);
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < L.W; x++)
        if (tile(L, x, y) !== E.EMPTY) paintTile(L, x, y);
    // v dírách je voda, ať je jasné, že tam se nepadá
    for (let x = 0; x < L.W; x++) {
      if (tile(L, x, ROWS - 1) !== E.EMPTY) continue;
      const c = chunkCtx(x);
      const y0 = GROUND * T + 70;
      c.fillStyle = "#3aa7e8";
      c.fillRect(x * T, y0, T + 1, 1080 - y0);
      c.fillStyle = "#8fd6ff";
      c.fillRect(x * T, y0, T + 1, 12);
      c.restore();
    }
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
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  const sayCs = (t) => TV.say(t, "cs-CZ");

  function showMenu() {
    cancelAnimationFrame(S.raf);
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Skákačka");
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
    sayCs("Kdo bude skákat?");
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
    else showWorlds();
  }

  // ---------- Výběr světa ----------
  function showWorlds() {
    S.screen = "worlds";
    S.focus = S.world || 0;
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Vyber si svět");
    t.style.top = "70px";
    t.style.fontSize = "100px";
    screen.appendChild(t);
    const row = el("div", "choices");
    row.style.top = "300px";
    WORLDS.forEach((w) => {
      const c = el("div", "choice world");
      const pic = el("div", "world-pic");
      pic.style.backgroundImage = "url(img/" + w.bg + ".jpg)";
      c.append(pic, el("div", "label", w.name));
      row.appendChild(c);
    });
    screen.appendChild(row);
    markFocus();
    sayCs("Vyber si svět.");
  }

  // ---------- Hra ----------
  function makePlayer(who, i) {
    return {
      who,
      x: (2 + i) * T,
      y: GROUND * T - 160,
      w: 72,
      h: 160,
      vx: 0,
      vy: 0,
      onGround: false,
      face: 1,
      coyote: 0,
      jumpBuf: 0,
      jumpHeld: false,
      inv: 0,
      stars: 0,
      finished: false,
      safe: { x: (2 + i) * T, y: GROUND * T },
      left: false,
      right: false,
      squash: 0,
    };
  }

  function startGame() {
    TH = WORLDS[S.world || 0];
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    const L = buildLevel(S.mode === "nela" ? "nela" : "maty");
    paintAll(L);
    S.game = {
      L,
      players: kids.map(makePlayer),
      cam: 0,
      popups: [],
      endTimer: 0,
      started: false,
      devices: S.pair ? S.pair.devices : null,
      t: 0,
    };
    // nepřátelé na zem
    for (const e of L.enemies) e.y = groundBelow(L, e.x) - e.h;
    prewarm();
    S.screen = "game";
    screen.replaceChildren(el("div", "count ready", "Jdeme na to!"));
    sayCs("Jdeme na to!");
    const g = S.game;
    setTimeout(() => {
      if (S.game === g) {
        g.started = true;
        screen.replaceChildren();
      }
    }, 1500);
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  function groundBelow(L, x) {
    const cx = Math.floor(x / T);
    for (let y = 0; y < ROWS; y++) if (tile(L, cx, y) !== E.EMPTY) return y * T;
    return GROUND * T;
  }
  function prewarm() {
    const w = (n, width) => {
      const i = IMG[n];
      if (i && i.ok)
        sprite(i, width, (width * i.naturalHeight) / i.naturalWidth);
    };
    ["maty-stand", "maty-jump", "nela-stand", "nela-jump"].forEach((n) =>
      w(n, kidW(n)),
    );
    for (const k of TH.foes) w(k, FOE[k].img);
    w("star", 70);
    w(TH.decor, 150);
    w("flag", 200);
    w("mushroom", 130);
    for (let k = 200; k <= 320; k += 8) w("cloud", k);
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
    // opakování držené šipky = drží (po pauze nebo Hrát znovu by jinak stála)
    if (e.type === "repeat" && !(e.name === "left" || e.name === "right" || e.name === "down")) return;
    const down = e.type !== "up";
    if (e.name === "left") p.left = down;
    else if (e.name === "right") p.right = down;
    else if (e.name === "down") p.down = down;
    else if (e.name === "ok" || e.name === "action" || e.name === "up") {
      p.jumpHeld = down;
      if (down) p.jumpBuf = 0.15;
    }
  }

  function overlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }
  function solidAt(L, px, py) {
    return tile(L, Math.floor(px / T), Math.floor(py / T)) !== E.EMPTY;
  }

  function movePlayer(p, L, dt) {
    // SPOLU: nikdo neuteče z obrazovky (ten vepředu počká u okraje)
    if (p.lim) {
      const nx = p.x + p.vx * dt;
      if (p.vx > 0 && nx > p.lim.hi) p.vx = Math.max(0, (p.lim.hi - p.x) / dt);
      if (p.vx < 0 && nx < p.lim.lo) p.vx = Math.min(0, (p.lim.lo - p.x) / dt);
    }
    // vodorovně
    p.x += p.vx * dt;
    const top = Math.floor(p.y / T),
      bot = Math.floor((p.y + p.h - 1) / T);
    if (p.vx > 0) {
      const cx = Math.floor((p.x + p.w) / T);
      for (let cy = top; cy <= bot; cy++)
        if (tile(L, cx, cy) !== E.EMPTY) {
          p.x = cx * T - p.w;
          p.vx = 0;
          break;
        }
    } else if (p.vx < 0) {
      const cx = Math.floor(p.x / T);
      for (let cy = top; cy <= bot; cy++)
        if (tile(L, cx, cy) !== E.EMPTY) {
          p.x = (cx + 1) * T;
          p.vx = 0;
          break;
        }
    }
    // svisle
    p.y += p.vy * dt;
    const l = Math.floor((p.x + 4) / T),
      r = Math.floor((p.x + p.w - 4) / T);
    p.onGround = false;
    if (p.vy > 0) {
      const cy = Math.floor((p.y + p.h) / T);
      for (let cx = l; cx <= r; cx++) {
        if (tile(L, cx, cy) !== E.EMPTY) {
          if (p.vy > 900) p.squash = 0.12;
          p.y = cy * T - p.h;
          p.vy = 0;
          p.onGround = true;
          break;
        }
      }
    } else if (p.vy < 0) {
      const cy = Math.floor(p.y / T);
      for (let cx = l; cx <= r; cx++) {
        const t = tile(L, cx, cy);
        if (t !== E.EMPTY) {
          p.y = (cy + 1) * T;
          p.vy = 0;
          if (t === E.STARBLOCK) {
            L.grid[cy * L.W + cx] = E.USED;
            paintTile(L, cx, cy);
            p.stars++;
            TV.sound.ding();
            S.game.popups.push({ x: cx * T + T / 2, y: cy * T - 20, t: 0 });
          } else TV.sound.nope();
          break;
        }
      }
    }
  }

  const STAND = 160,
    CROUCH = 88;
  /** Skrčení: šipka dolů, nebo samo, když je před dítětem nízký tunel. Pod stropem se nedá vstát. */
  function crouch(p, L, want) {
    let c = !!p.down;
    if (!c && p.onGround && want) {
      const cx = Math.floor((want > 0 ? p.x + p.w + 8 : p.x - 8) / T);
      const foot = Math.floor((p.y + p.h - 1) / T);
      if (tile(L, cx, foot) === E.EMPTY && tile(L, cx, foot - 1) !== E.EMPTY)
        c = true;
    }
    if (p.crouched && !c) {
      const top = Math.floor((p.y + p.h - STAND) / T);
      const l = Math.floor((p.x + 4) / T),
        r = Math.floor((p.x + p.w - 4) / T);
      for (let cy = top; cy < Math.floor(p.y / T) + 1 && !c; cy++)
        for (let cx = l; cx <= r; cx++)
          if (tile(L, cx, cy) !== E.EMPTY && cy * T < p.y) c = true;
    }
    if (c === !!p.crouched) return;
    const nh = c ? CROUCH : STAND;
    p.y += p.h - nh;
    p.h = nh;
    p.crouched = c;
  }

  /** Můstek přes nejbližší díru napravo od sloupce c. Vrací, jestli nějaký postavil. */
  function bridge(L, c) {
    const hole = (x) => tile(L, x, GROUND) === E.EMPTY && tile(L, x, ROWS - 1) === E.EMPTY;
    // díra, kam spadlo (o kousek vedle, kdyby padalo šikmo)
    let h = -1;
    for (const d of [0, 1, -1, 2, -2]) if (hole(c + d)) { h = c + d; break; }
    if (h < 0) return false;
    let a = h, b = h;
    while (a > 0 && hole(a - 1)) a--;
    while (b < L.W - 1 && hole(b + 1)) b++;
    for (let x = a; x <= b; x++) {
      L.grid[GROUND * L.W + x] = E.ISLAND;
      paintTile(L, x, GROUND);
    }
    return true;
  }

  function update(dt) {
    const g = S.game,
      L = g.L;
    g.t += dt;
    for (const e of L.enemies) {
      if (e.dead) {
        e.poof += dt;
        continue;
      }
      const speed = FOE[e.kind].speed;
      e.x += e.dir * speed * dt;
      const front = e.dir < 0 ? e.x - 4 : e.x + e.w + 4;
      if (
        solidAt(L, front, e.y + e.h / 2) ||
        solidAt(L, front, e.y - 10) ||
        !solidAt(L, front, e.y + e.h + 10)
      )
        e.dir *= -1;
    }
    if (!g.started) return;

    for (const p of g.players) {
      if (p.finished) {
        p.vx = 0;
        continue;
      }
      p.stun = Math.max(0, (p.stun || 0) - dt);
      // po nárazu do zvířátka chvíli letí a neposlouchá
      const want = p.stun > 0 ? 0 : (p.right ? 1 : 0) - (p.left ? 1 : 0);
      if (want) p.face = want;
      crouch(p, L, want);
      const acc = p.stun > 0 ? 300 : p.onGround ? 4200 : 2600;
      const top = p.crouched ? RUN * 0.65 : RUN;
      p.vx += Math.max(-acc * dt, Math.min(acc * dt, want * top - p.vx));
      p.coyote = p.onGround ? 0.12 : p.coyote - dt;
      p.jumpBuf -= dt;
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = -JUMP;
        p.cut = true;
        p.jumpBuf = 0;
        p.coyote = 0;
        jumpSound();
      }
      // puštěné tlačítko = nižší skok (jen u vlastního skoku, hříbek odhodí vždy celý)
      if (p.cut && !p.jumpHeld && p.vy < -850) {
        p.vy = -850;
        p.cut = false;
      }
      if (p.vy >= 0) p.cut = false;
      p.vy = Math.min(1900, p.vy + G * dt);
      p.inv = Math.max(0, p.inv - dt);
      p.squash = Math.max(0, p.squash - dt);
      movePlayer(p, L, dt);

      // poslední bezpečné místo: stojí na zemi a pod oběma kraji je pevno
      if (
        p.onGround &&
        solidAt(L, p.x + 4, p.y + p.h + 10) &&
        solidAt(L, p.x + p.w - 4, p.y + p.h + 10)
      ) {
        p.safe.x = p.x;
        p.safe.y = p.y + p.h; // spodek postavičky (výška se mění při skrčení)
      }
      // pád do díry
      if (p.y > ROWS * T + 150) {
        const fellAt = Math.floor((p.x + p.w / 2) / T);
        p.x = p.safe.x;
        p.y = p.safe.y - p.h - 10;
        p.vx = 0;
        p.stun = 0;
        // potřetí na stejném místě = objeví se můstek přes vodu
        p.falls = Math.abs(fellAt - (p.fallKey ?? -9)) <= 2 ? (p.falls || 0) + 1 : 1;
        p.fallKey = fellAt;
        if (p.falls >= 3 && bridge(L, fellAt)) {
          p.falls = 0;
          TV.sound.match();
        }
        p.vy = 0;
        p.inv = 2.5;
        TV.sound.miss();
        sayCs("Hups!");
      }
      // hříbek = trampolína
      for (const s of L.springs) {
        if (
          p.vy > 0 &&
          Math.abs(p.x + p.w / 2 - s.x) < 60 &&
          p.y + p.h > s.y - 110 &&
          p.y + p.h < s.y - 40
        ) {
          p.vy = -2100;
          p.cut = false;
          p.y = s.y - 110 - p.h;
          s.boing = 0.3;
          boingSound();
        }
      }
      // hvězdičky
      for (const it of L.items) {
        if (it.taken) continue;
        if (
          Math.abs(p.x + p.w / 2 - it.x) < 60 &&
          Math.abs(p.y + p.h / 2 - it.y) < 90
        ) {
          it.taken = true;
          p.stars++;
          TV.sound.ding();
        }
      }
      // zvířátka
      for (const e of L.enemies) {
        if (e.dead || !overlap(p, e)) continue;
        if (p.vy > 0 && p.y + p.h - e.y < 45) {
          e.dead = true;
          p.vy = -1000;
          p.cut = false;
          p.stars++;
          TV.sound.match();
          g.popups.push({ x: e.x + e.w / 2, y: e.y - 20, t: 0 });
        } else if (p.inv <= 0) {
          // odhodí kus zpátky
          const dir = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
          // za zády voda? pak jen malé odstrčení, ať nespadne zpátky do díry
          const behind = solidAt(L, p.x + p.w / 2 + dir * T * 2.5, p.y + p.h + 10) && solidAt(L, p.x + p.w / 2 + dir * T, p.y + p.h + 10);
          p.vx = dir * (behind ? 1000 : 380);
          p.vy = -950;
          p.stun = 0.6;
          p.inv = 1.6;
          TV.sound.bump();
        }
      }
      // cíl
      if (p.x + p.w > L.flagX) {
        p.finished = true;
        TV.sound.match();
        TV.confetti(fx, 60);
      }
    }
    for (const s of L.springs) if (s.boing) s.boing = Math.max(0, s.boing - dt);
    for (const pp of g.popups) pp.t += dt;
    if (g.popups.length && g.popups[0].t >= 0.9) g.popups.shift();

    // SPOLU: kdo doběhl první, za chvíli „přenese“ i druhého
    let done = 0;
    for (const p of g.players) if (p.finished) done++;
    if (done === g.players.length && !g.allDone) {
      g.allDone = true;
      g.endTimer = 0; // chvilka radosti v cíli i pro druhého
    }
    if (done && done < g.players.length) {
      g.endTimer += dt;
      if (g.endTimer > 2.5)
        for (const p of g.players)
          if (!p.finished) {
            p.x = L.flagX + 20;
            p.y = GROUND * T - p.h;
            p.finished = true;
          }
    } else if (g.allDone) {
      g.endTimer += dt;
      if (g.endTimer > 1.4) showEnd();
    }

    // kamera
    const maxCam = L.W * T - 1920;
    if (g.players.length === 1) {
      const p = g.players[0];
      const target = Math.max(0, Math.min(maxCam, p.x + p.w / 2 - 760));
      g.cam += (target - g.cam) * Math.min(1, dt * 6);
    } else {
      const mid =
        g.players.reduce((a, p) => a + p.x + p.w / 2, 0) / g.players.length;
      const [a, b] = g.players;
      const back = a.x < b.x ? a : b;
      let target = Math.max(mid - 960, Math.max(a.x, b.x) + 82 - 1920);
      target = Math.min(target, back.x - 10); // ten pozadu je vždy vidět
      target = Math.max(0, Math.min(maxCam, target));
      g.cam += (target - g.cam) * Math.min(1, dt * 5);
      for (const p of g.players) {
        const lim = p.lim || (p.lim = { lo: 0, hi: 0 });
        lim.lo = g.cam + 10;
        // ani po „Hups!“ zadního (vrátí se na safe.x) nesmí přední zmizet vpravo
        lim.hi = Math.min(g.cam + 1920 - p.w - 10, back.safe.x + 1920 - p.w - 20);
      }
    }
  }

  function jumpSound() {
    TV.sound.move();
  }
  function boingSound() {
    TV.sound.flip();
    TV.sound.go();
  }

  // ---------- Kreslení ----------
  // Pozadí světa předkreslené jednou: obraz vedle svého zrcadla (navazuje) a u pestrých světů
  // lehce zesvětlené, ať hvězdičky a zvířátka vyniknou.
  const wideCache = {};
  function bgWide() {
    if (wideCache[TH.bg]) return wideCache[TH.bg];
    const i = IMG[TH.bg] && IMG[TH.bg].ok ? IMG[TH.bg] : IMG.bg;
    if (!i || !i.ok) return null;
    const c = document.createElement("canvas");
    c.width = 3840 * RES;
    c.height = 1080 * RES;
    const x = c.getContext("2d");
    // okraje obrázku bývají světlejší: 2 % z každé strany pryč, ať spoj není vidět
    const sx = i.naturalWidth * 0.02,
      sw = i.naturalWidth * 0.96;
    x.drawImage(i, sx, 0, sw, i.naturalHeight, 0, 0, c.width / 2, c.height);
    x.save();
    x.translate(c.width, 0);
    x.scale(-1, 1);
    x.drawImage(i, sx, 0, sw, i.naturalHeight, 0, 0, c.width / 2, c.height);
    x.restore();
    if (TH.fade) {
      x.fillStyle = "rgba(255,255,255," + TH.fade + ")";
      x.fillRect(0, 0, c.width, c.height);
    }
    wideCache[TH.bg] = c;
    return c;
  }
  function draw() {
    const g = S.game,
      L = g.L,
      cam = Math.round(g.cam);
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    // pozadí s paralaxou
    const wide = bgWide();
    if (wide) {
      // obraz + jeho zrcadlo = navazuje bez švu, perioda 3840
      const off = -((cam * 0.3) % 3840);
      ctx.drawImage(wide, off, 0, 3840, 1080);
      if (off + 3840 < 1920) ctx.drawImage(wide, off + 3840, 0, 3840, 1080);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 1080);
      gr.addColorStop(0, "#7fd0ff");
      gr.addColorStop(1, "#d8f3ff");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    // mraky (pomaleji než svět)
    for (const c of L.clouds) {
      const x = c.x - cam * 0.6;
      if (x < -400 || x > 2300) continue;
      drawImg("cloud", x, c.y + 120, c.w);
    }
    // dlaždice (předkreslené)
    const CW = CHUNK * T;
    for (let k = Math.floor(cam / CW); k <= Math.floor((cam + 1920) / CW); k++)
      if (chunks[k]) ctx.drawImage(chunks[k], k * CW - cam, 0, CW, 1080);
    ctx.translate(-cam, 0);
    // keře, hříbky, vlajka
    for (const d of L.decor)
      if (d.x > cam - 200 && d.x < cam + 2120)
        drawImg(d.kind, d.x, d.y + 8, 150);
    for (const s of L.springs) {
      const sq = s.boing ? 1 - s.boing : 1;
      drawImg("mushroom", s.x, s.y + 6, (130 * (2 - sq * 0.15)) / 1.85);
    }
    drawImg("flag", L.flagX + 60, GROUND * T + 6, 200);
    // hvězdičky
    for (const it of L.items) {
      if (it.taken || it.x < cam - 100 || it.x > cam + 2020) continue;
      drawImg("star", it.x, it.y + 35 + Math.sin(g.t * 4 + it.x) * 6, 70);
    }
    // zvířátka
    for (const e of L.enemies) {
      if (e.x < cam - 200 || e.x > cam + 2120) continue;
      if (e.dead) {
        if (e.poof < 0.5)
          drawImg(
            e.kind,
            e.x + e.w / 2,
            e.y + e.h,
            e.w * (1 - e.poof),
            e.dir < 0,
            1 - e.poof * 2,
          );
        continue;
      }
      drawImg(
        e.kind,
        e.x + e.w / 2,
        e.y + e.h + 4,
        FOE[e.kind].img,
        e.dir < 0,
      );
    }
    // hráči
    for (const p of g.players) {
      if (p.inv > 0 && Math.floor(p.inv * 10) % 2) continue; // blikání po nárazu
      const name = p.who + (p.onGround || p.crouched ? "-stand" : "-jump");
      const moving = p.onGround && Math.abs(p.vx) > 40;
      const bob = moving ? Math.abs(Math.sin(g.t * 14)) * 10 : 0;
      ctx.save();
      const cx = p.x + p.w / 2,
        bottom = p.y + p.h;
      const sq = p.squash > 0 ? 1 - p.squash : 1;
      ctx.translate(cx, bottom);
      if (p.crouched) ctx.scale(1.15, 0.56);
      else ctx.scale(2 - sq, sq);
      ctx.translate(-cx, -bottom);
      drawImg(name, cx, bottom + 6 - bob, kidW(name), p.face < 0);
      ctx.restore();
    }
    // +1 nad sebranou hvězdičkou z bloku / zvířátka
    for (const pp of g.popups)
      drawImg("star", pp.x, pp.y - pp.t * 140 + 35, 70, false, 1 - pp.t);
    ctx.setTransform(RES, 0, 0, RES, 0, 0);

    // ukazatel cesty: kolik zbývá do vlajky
    const bx = 620,
      bw = 680,
      by = 62;
    ctx.fillStyle = "rgba(10,16,50,.45)";
    roundRect(bx - 20, by - 26, bw + 90, 52, 26);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    roundRect(bx, by - 6, bw, 12, 6);
    drawImg("flag", bx + bw + 30, by + 30, 56);
    g.players.forEach((p) => {
      const f = Math.max(0, Math.min(1, (p.x - 2 * T) / (L.flagX - 2 * T)));
      ctx.beginPath();
      ctx.arc(bx + f * bw, by, 18, 0, Math.PI * 2);
      ctx.fillStyle = TV.PLAYERS[p.who].color;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    });
    // horní lišta: avatar a hvězdičky každého hráče
    g.players.forEach((p, i) => {
      const x0 = i === 0 ? 30 : 1920 - 330;
      ctx.fillStyle = "rgba(10,16,50,.55)";
      roundRect(x0, 20, 300, 110, 55);
      const a = AV[p.who];
      ctx.save();
      ctx.beginPath();
      ctx.arc(x0 + 55, 75, 45, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.clip();
      if (a && a.ok) ctx.drawImage(a, x0 + 10, 30, 90, 90);
      ctx.restore();
      ctx.fillStyle = "#ffd23d";
      ctx.font = '900 60px "Trebuchet MS", Roboto, sans-serif';
      ctx.textBaseline = "middle";
      ctx.fillText("★ " + p.stars, x0 + 120, 78);
    });
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
    if (S.screen === "game" && S.game) {
      // větší kroky dělíme, ať se nepropadá skrz dlaždice
      const steps = Math.ceil(dt / 0.017) || 1;
      for (let k = 0; k < steps && S.screen === "game"; k++) update(dt / steps);
      if (S.screen === "game") draw();
      S.raf = requestAnimationFrame(frame);
    }
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
    box.appendChild(el("div", "end-title", "Cíl!"));
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
    const nextWorld = (S.world || 0) < WORLDS.length - 1;
    btns.append(el("div", "btn focus", nextWorld ? "Další svět" : "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    if (g.players.length === 1) {
      const p = g.players[0];
      TV.say(
        [
          "Hurá, " + TV.PLAYERS[p.who].voc + "! Jsi v cíli!",
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
        else showWorlds();
      }
    } else if (S.screen === "worlds") {
      if (n === "left" && S.focus > 0) {
        S.focus--;
        TV.sound.move();
        markFocus();
      } else if (n === "right" && S.focus < WORLDS.length - 1) {
        S.focus++;
        TV.sound.move();
        markFocus();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        S.world = S.focus;
        startGame();
      }
    } else if (S.screen === "pair") {
      pairKey(e);
    } else if (S.screen === "end" && performance.now() - S.endAt > 1800) {
      // chvíli nereagovat, ať dupnutí na skok hned nespustí novou hru
      if (n === "left" || n === "right") {
        S.focus = 1 - S.focus;
        TV.sound.move();
        screen
          .querySelectorAll(".end .btn")
          .forEach((b, i) => b.classList.toggle("focus", i === S.focus));
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        if (S.focus === 0) {
          if ((S.world || 0) < WORLDS.length - 1) S.world = (S.world || 0) + 1;
          startGame();
        } else showMenu();
      }
    }
  });

  // přepnutí appky: puštěné šipky by se ztratily a dítě by běželo samo
  TV.onPause(() => {
    if (S.game)
      for (const p of S.game.players) p.left = p.right = p.down = p.jumpHeld = false;
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.SKAK = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
