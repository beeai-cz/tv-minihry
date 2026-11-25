/* Bedýnky pro Matyho (3) a Nelu (5): posouvačka beden na zahradě. Dítě chodí D-padem po políčkách,
 * bednu vedle sebe zatlačí (když je za ní volno). Cíl: všechny bedny na hvězdičky.
 * B (action) = krok zpět, držet OK 1,5 s = úroveň znovu. Zaseknutá bedna (neřešitelná pozice)
 * se po 3 s sama vrátí („Zkusíme to znovu?“) - prohrát ani zaseknout se nedá.
 * Maty hraje úrovně 1-8, Nela 1-20, SPOLU má vlastních 8 úrovní pro dvě postavičky. */
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

  // ---------- Úrovně ----------
  // # živý plot, X zeď, mezera tráva, . cíl (hvězdička), $ bedna, * bedna na cíli,
  // @ start Matyho / jediného hráče, + hráč na cíli, & start Nely (SPOLU).
  // min = nejmenší počet kroků (chůze + tlačení), ověřeno BFS řešičem (bedynky-solver.js).
  // Řešič čte blok mezi značkami LEVELS-START/END - formát neměnit.
  /*LEVELS-START*/
  const SOLO = [
    { min: 1, m: ["#####", "#@$.#", "#####"] },
    { min: 2, m: ["######", "#@$ .#", "######"] },
    { min: 4, m: ["#####", "#   #", "#@$ #", "#   #", "# . #", "#####"] },
    {
      min: 6,
      m: ["#######", "#     #", "#@$   #", "#     #", "#   . #", "#######"],
    },
    { min: 8, m: ["#######", "#@$ . #", "#     #", "# $ . #", "#######"] },
    {
      min: 9,
      m: [
        "#######",
        "#     #",
        "#@$ . #",
        "#     #",
        "# $   #",
        "#   . #",
        "#######",
      ],
    },
    {
      min: 11,
      m: [
        "#######",
        "#     #",
        "#  X  #",
        "#@$X .#",
        "#     #",
        "#     #",
        "#######",
      ],
    },
    {
      min: 16,
      m: ["#######", "#     #", "#@$X. #", "#     #", "# $ . #", "#######"],
    },
    // --- od tady jen Nela ---
    {
      min: 5,
      m: [
        "#######",
        "#  .  #",
        "# #$# #",
        "#.$@$.#",
        "# # # #",
        "#     #",
        "#######",
      ],
    },
    {
      min: 12,
      m: [" ######", "##    #", "#@ $X #", "# $ . #", "#X  . #", "#######"],
    },
    {
      min: 15,
      m: [
        "########",
        "#      #",
        "# $$$  #",
        "#@     #",
        "# ...  #",
        "########",
      ],
    },
    {
      min: 16,
      m: [
        "#######",
        "# .   #",
        "#.$#  #",
        "# $ $ #",
        "#   #.#",
        "#@    #",
        "#######",
      ],
    },
    { min: 19, m: ["#########", "#.. $ $ #", "#@      #", "#########"] },
    {
      min: 20,
      m: [
        "########",
        "#      #",
        "#@$ X  #",
        "#   X. #",
        "# $    #",
        "#    . #",
        "########",
      ],
    },
    {
      min: 22,
      m: [
        "########",
        "##  .  #",
        "#  $X$ #",
        "# . @  #",
        "#  $X  #",
        "##   . #",
        "########",
      ],
    },
    { min: 23, m: ["#######", "#.   .#", "# $X$ #", "#  @  #", "#######"] },
    {
      min: 27,
      m: [
        "########",
        "#  .   #",
        "# $##$ #",
        "#  .   #",
        "## #$ ##",
        "#  . @ #",
        "########",
      ],
    },
    {
      min: 31,
      m: [
        "########",
        "#  #   #",
        "#  $ $ #",
        "## # # #",
        "#.  @ .#",
        "#   $  #",
        "#  .   #",
        "########",
      ],
    },
    {
      min: 36,
      m: [
        " ######",
        " #    #",
        "##$## #",
        "#  .  #",
        "# $#$ #",
        "#.  @.#",
        "#######",
      ],
    },
    {
      min: 40,
      m: [
        " #######",
        " #  .  #",
        "##$#$# #",
        "#  @   #",
        "# $#.# #",
        "#.     #",
        "########",
      ],
    },
  ];
  // SPOLU: min = nejmenší součet kroků obou dětí.
  const DUO = [
    { min: 2, m: ["#########", "#@$.#&$.#", "#########"] },
    {
      min: 4,
      m: ["##########", "#   ##   #", "#@$ .. $&#", "#   ##   #", "##########"],
    },
    {
      min: 8,
      m: [
        "#########",
        "#   #   #",
        "#@$ # $&#",
        "#   #   #",
        "# . # . #",
        "#########",
      ],
    },
    {
      min: 9,
      m: [
        "###########",
        "#   ##    #",
        "#@$ .# $  #",
        "#   ## # .#",
        "#    #&   #",
        "###########",
      ],
    },
    {
      min: 10,
      m: [
        "#########",
        "#       #",
        "#@ $ $ &#",
        "#       #",
        "#  . .  #",
        "#########",
      ],
    },
    {
      min: 10,
      m: ["#########", "#.  #  .#", "# $ # $ #", "#@  #  &#", "#########"],
    },
    {
      min: 14,
      m: [
        "#########",
        "#.     .#",
        "#  $ $  #",
        "#@  $  &#",
        "#   .   #",
        "#########",
      ],
    },
    {
      min: 22,
      m: [
        "#########",
        "#.  #  .#",
        "# $ # $ #",
        "#@  #  &#",
        "##  $  ##",
        " #  .  # ",
        " ####### ",
      ],
    },
  ];
  /*LEVELS-END*/
  const SETS = { maty: SOLO.slice(0, 8), nela: SOLO, spolu: DUO };

  // ---------- Obrázky ----------
  const IMG = {};
  function loadImg(key, src) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = src;
    IMG[key] = i;
  }
  ["crate", "crate-done", "target", "wall", "hedge", "grass", "flower"].forEach(
    (n) => loadImg(n, "img/" + n + ".png"),
  );
  // Postavičky sdílíme se Skákačkou (dítě zepředu).
  loadImg("maty", "../skakacka/img/maty-stand.png");
  loadImg("nela", "../skakacka/img/nela-stand.png");
  const AV = {};
  for (const who of ["maty", "nela"]) {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = TV.PLAYERS[who].avatar;
    AV[who] = i;
  }
  /** Předzmenšené plátno obrázku (drawImage z velkého PNG je na TV drahé). */
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
  const ok = (n) => IMG[n] && IMG[n].ok;

  // ---------- Příprava úrovně ----------
  const K = { FLOOR: 0, HEDGE: 1, WALL: 2, OUT: 3 };
  function parseLevel(def) {
    const rows = def.m;
    const H = rows.length;
    const W = Math.max(...rows.map((r) => r.length));
    const kind = new Uint8Array(W * H).fill(K.OUT);
    const target = new Uint8Array(W * H);
    const boxes = [];
    const starts = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ch = rows[y][x] || " ";
        const i = y * W + x;
        if (ch === "#") kind[i] = K.HEDGE;
        else if (ch === "X") kind[i] = K.WALL;
        if (ch === "." || ch === "*" || ch === "+") target[i] = 1;
        if (ch === "$" || ch === "*") boxes.push(i);
        if (ch === "@" || ch === "+") starts[0] = i;
        if (ch === "&") starts[1] = i;
      }
    // tráva = vše dosažitelné ze startů; ostatní volná místa jsou mimo zahradu (kytičky)
    const st = starts.slice();
    for (const s of st) kind[s] = K.FLOOR;
    while (st.length) {
      const c = st.pop();
      for (const d of [1, -1, W, -W]) {
        const n = c + d;
        // plot a zeď mají vlastní druh, takže OUT = volné místo; hlídáme jen přetečení řádku
        if (kind[n] !== K.OUT) continue;
        if ((d === 1 && n % W === 0) || (d === -1 && c % W === 0)) continue;
        kind[n] = K.FLOOR;
        st.push(n);
      }
    }
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = kind[i] !== K.FLOOR ? 1 : 0;
    return {
      W,
      H,
      kind,
      solid,
      target,
      boxes,
      starts,
      min: def.min,
      dead: deadSquares(W, H, solid, target),
      segs: wallSegments(W, H, solid, target),
    };
  }

  /** Úseky podél zdi uzavřené z obou konců: bedna z nich nikdy nevyjede (od zdi ji nikdo
   * neodtlačí, na koncích je zeď). Víc beden než cílů v úseku = neřešitelné. */
  function wallSegments(W, H, solid, target) {
    const segs = [];
    // [strana se zdí, směr úseku]
    for (const [side, step] of [
      [-W, 1],
      [W, 1],
      [-1, W],
      [1, W],
    ]) {
      const along = (c) => !solid[c] && solid[c + side] === 1;
      for (let c = 0; c < W * H; c++) {
        if (!along(c) || along(c - step)) continue; // jen začátky úseků
        const cells = [];
        let e = c;
        while (along(e)) {
          cells.push(e);
          e += step;
        }
        if (cells.length < 2 || !solid[c - step] || !solid[e]) continue;
        let t = 0;
        for (const x of cells) t += target[x];
        segs.push({ cells, t });
      }
    }
    return segs;
  }

  /** Mrtvá políčka: odtud se bedna nikdy nedostane na cíl (zpětné „tahání“ od cílů). */
  function deadSquares(W, H, solid, target) {
    const live = new Uint8Array(W * H);
    const st = [];
    for (let i = 0; i < W * H; i++)
      if (target[i] && !solid[i]) {
        live[i] = 1;
        st.push(i);
      }
    while (st.length) {
      const c = st.pop();
      for (const d of [1, -1, W, -W]) {
        const a = c - d,
          b = c - 2 * d;
        if (!solid[a] && !solid[b] && !live[a]) {
          live[a] = 1;
          st.push(a);
        }
      }
    }
    const dead = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) dead[i] = !solid[i] && !live[i] ? 1 : 0;
    return dead;
  }

  /** Je pozice neřešitelná? Bedna mimo cíl na mrtvém políčku nebo zamrzlá (nehne se vodorovně
   * ani svisle kvůli zdi / jiné zamrzlé bedně). Stejný algoritmus řešič ověřil na všech
   * dosažitelných stavech: řešitelnou pozici nikdy neoznačí. */
  const guard = [];
  /** occ[c] != 0 = na políčku je bedna, cells = políčka beden. */
  function isStuck(L, occ, cells) {
    const W = L.W;
    const frozen = (b) => {
      guard.push(b);
      const r = axis(b, 1) && axis(b, W);
      guard.pop();
      return r;
    };
    const axis = (b, d) => {
      const a = b - d,
        c = b + d;
      if (L.solid[a] || L.solid[c]) return true;
      if (guard.includes(a) || guard.includes(c)) return true;
      if (L.dead[a] && L.dead[c]) return true;
      if (occ[a] && frozen(a)) return true;
      if (occ[c] && frozen(c)) return true;
      return false;
    };
    guard.length = 0;
    for (const b of cells) {
      if (L.target[b]) continue;
      if (L.dead[b] || frozen(b)) return true;
    }
    for (const sg of L.segs) {
      let n = 0;
      for (const c of sg.cells) if (occ[c]) n++;
      if (n > sg.t) return true;
    }
    return false;
  }
  function gameStuck(g) {
    for (let i = 0; i < g.boxes.length; i++) g.cellBuf[i] = g.boxes[i].c;
    return isStuck(g.L, g.boxAt, g.cellBuf);
  }

  /** Pojistka „dlouho bez pokroku“: je současná pozice ještě řešitelná? BFS po kouscích
   * (pár ms za snímek, slabé CPU). Ve SPOLU zkouší každé dítě zvlášť bez toho druhého -
   * řešitelné pro jedno = nenabízet. Příliš velké hledání = raději nenabízet. */
  const NOPROGRESS = { maty: 30, nela: 45, spolu: 45 };
  const JOB_CAP = 200000;
  function startCheck(g) {
    const nB = g.boxes.length;
    const cells = g.boxes.map((b) => b.c).sort((a, b) => a - b);
    let base = 0;
    for (const c of cells) base = base * 256 + c;
    const M = Math.pow(256, nB);
    g.job = {
      seeds: g.players.map((p) => p.c * M + base),
      si: -1,
      q: [],
      head: 0,
      seen: new Set(),
      ver: g.undoVer,
      M,
      nB,
      occ: new Uint8Array(g.L.W * g.L.H),
      buf: new Array(nB),
    };
  }
  /** Vrací null (ještě počítá), true (řešitelné) nebo false (neřešitelné). */
  function runCheck(g, ms) {
    const j = g.job,
      L = g.L,
      W = L.W;
    const t0 = performance.now();
    for (let it = 0; ; it++) {
      if ((it & 63) === 0 && performance.now() - t0 > ms) return null;
      if (j.head >= j.q.length) {
        if (++j.si >= j.seeds.length) return false;
        j.q = [j.seeds[j.si]];
        j.head = 0;
        j.seen = new Set(j.q);
      }
      if (j.seen.size > JOB_CAP) return true;
      let k = j.q[j.head++];
      const p = Math.floor(k / j.M);
      k -= p * j.M;
      let all = true;
      for (let i = j.nB - 1; i >= 0; i--) {
        const c = k % 256;
        k = (k - c) / 256;
        j.buf[i] = c;
        j.occ[c] = 1;
        if (!L.target[c]) all = false;
      }
      if (all) {
        for (const c of j.buf) j.occ[c] = 0;
        return true;
      }
      for (const d of [1, -1, W, -W]) {
        const n = p + d;
        if (L.solid[n]) continue;
        let key = 0;
        if (j.occ[n]) {
          const b2 = n + d;
          if (L.solid[b2] || j.occ[b2]) continue;
          const nc = j.buf.map((c) => (c === n ? b2 : c)).sort((a, b) => a - b);
          j.occ[n] = 0;
          j.occ[b2] = 1;
          const st = isStuck(L, j.occ, nc);
          j.occ[n] = 1;
          j.occ[b2] = 0;
          if (st) continue;
          for (const c of nc) key = key * 256 + c;
        } else for (const c of j.buf) key = key * 256 + c;
        key += n * j.M;
        if (!j.seen.has(key)) {
          j.seen.add(key);
          j.q.push(key);
        }
      }
      for (const c of j.buf) j.occ[c] = 0;
    }
  }
  function offer(g, kind) {
    g.offerAt = g.t;
    g.offerKind = kind;
    g.job = null;
    TV.sound.miss();
    sayCs("Zkusíme to znovu?");
  }
  /** Jak dlouho se drží OK (ve SPOLU musí držet oba, jinak -1). */
  function holdTime(g) {
    let t = Infinity;
    for (const p of g.players) {
      if (p.okAt < 0) return -1;
      t = Math.min(t, g.t - p.okAt);
    }
    return t;
  }

  // ---------- Stav, uložení ----------
  const S = {
    screen: "loading",
    focus: 0,
    mode: null, // maty | nela | spolu
    pair: null,
    game: null,
    raf: 0,
    lvFocus: 0,
  };
  const saveKey = (mode) => "bedynky-" + mode;
  function loadStars(mode) {
    const n = SETS[mode].length;
    let a = [];
    try {
      a = JSON.parse(localStorage.getItem(saveKey(mode)) || "[]");
    } catch (e) {
      a = [];
    }
    if (!Array.isArray(a)) a = []; // např. uložené "null"
    const out = [];
    for (let i = 0; i < n; i++) out.push(Math.max(0, Math.min(3, a[i] | 0)));
    return out;
  }
  function saveStars(mode, arr) {
    try {
      localStorage.setItem(saveKey(mode), JSON.stringify(arr));
    } catch (e) {
      /* bez úložiště se jen nic nepamatuje */
    }
  }
  /** Odemčené jsou úrovně nejvýš o 1 za poslední dohranou. */
  function unlockedUpTo(stars) {
    let hi = -1;
    stars.forEach((s, i) => {
      if (s > 0) hi = i;
    });
    return Math.min(stars.length - 1, hi + 1);
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
  const kidsOf = (mode) => (mode === "spolu" ? ["maty", "nela"] : [mode]);

  // ---------- Menu ----------
  function stopLoop() {
    cancelAnimationFrame(S.raf);
    S.raf = 0;
  }
  function clearCanvas() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function showMenu() {
    stopLoop();
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    clearCanvas();
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Bedýnky");
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

  // ---------- Párování ovladačů (SPOLU) ----------
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
    else showLevels(true);
  }

  // ---------- Výběr úrovně ----------
  const GRID = {
    maty: { cols: 4, size: 250 },
    nela: { cols: 5, size: 170 },
    spolu: { cols: 4, size: 250 },
  };
  function showLevels(speak) {
    stopLoop();
    S.screen = "levels";
    S.game = null;
    S.levelsAt = performance.now();
    clearCanvas();
    const stars = loadStars(S.mode);
    const open = unlockedUpTo(stars);
    if (speak) S.lvFocus = open;
    S.lvFocus = Math.min(S.lvFocus, SETS[S.mode].length - 1);
    const head = el("div", "lv-head");
    if (S.mode === "spolu") {
      const both = el("div", "avatar-pair");
      both.append(avatarEl("maty"), avatarEl("nela"));
      head.appendChild(both);
    } else head.appendChild(avatarEl(S.mode));
    head.appendChild(el("div", "lv-title", "Vyber úroveň"));
    const gd = GRID[S.mode];
    const grid = el("div", "lv-grid");
    grid.style.gridTemplateColumns =
      "repeat(" + gd.cols + ", " + gd.size + "px)";
    grid.style.top = S.mode === "nela" ? "240px" : "330px";
    SETS[S.mode].forEach((lv, i) => {
      const t = el(
        "div",
        "lv" + (stars[i] ? " done" : "") + (i > open ? " locked" : ""),
      );
      t.style.width = t.style.height = gd.size + "px";
      const num = el("div", "num", i > open ? "🔒" : String(i + 1));
      num.style.fontSize =
        Math.round(gd.size * (i > open ? 0.34 : 0.44)) + "px";
      const st = el("div", "st");
      st.style.fontSize = Math.round(gd.size * 0.17) + "px";
      for (let k = 0; k < 3; k++) {
        const s = el(k < stars[i] ? "b" : "span", null, "★");
        st.appendChild(s);
      }
      t.append(num, st);
      grid.appendChild(t);
    });
    screen.replaceChildren(el("div", "menu-bg"), head, grid);
    markLevel();
    if (speak) sayCs("Vyber si úroveň.");
  }
  function markLevel() {
    screen
      .querySelectorAll(".lv")
      .forEach((c, i) => c.classList.toggle("focus", i === S.lvFocus));
  }
  function levelsKey(e) {
    if (e.type === "up") return;
    const n = SETS[S.mode].length,
      cols = GRID[S.mode].cols;
    let f = S.lvFocus;
    if (e.name === "left") f = Math.max(0, f - 1);
    else if (e.name === "right") f = Math.min(n - 1, f + 1);
    else if (e.name === "up") f = f - cols >= 0 ? f - cols : f;
    else if (e.name === "down") f = f + cols < n ? f + cols : f;
    else if ((e.name === "ok" || e.name === "action") && e.type === "down") {
      // chvilka klidu, ať tlačítko z párování hned nespustí úroveň
      if (performance.now() - S.levelsAt < 500) return;
      if (S.lvFocus > unlockedUpTo(loadStars(S.mode))) {
        TV.sound.nope();
        return;
      }
      TV.sound.flip();
      startLevel(S.lvFocus);
      return;
    }
    if (f !== S.lvFocus) {
      S.lvFocus = f;
      TV.sound.move();
      markLevel();
    }
  }

  // ---------- Hra ----------
  const DIRS = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1],
  };
  const STEP = 0.15; // délka kroku v s
  const HOLD_RESTART = 1.5; // držet OK = znovu
  const HOLD_WALK = 0.3; // za jak dlouho držená šipka chodí sama (krátké ťuknutí = 1 krok)

  /** Plynule animovaná pozice (políčko). */
  function anim(o, c, dur) {
    const W = S.game.L.W;
    const k = ease(o.k);
    o.ax = o.ax + (o.bx - o.ax) * k;
    o.ay = o.ay + (o.by - o.ay) * k;
    o.bx = c % W;
    o.by = (c / W) | 0;
    o.k = 0;
    o.dur = dur;
  }
  const ease = (k) => (k >= 1 ? 1 : k * (2 - k));
  const posX = (o) => o.ax + (o.bx - o.ax) * ease(o.k);
  const posY = (o) => o.ay + (o.by - o.ay) * ease(o.k);

  function startLevel(idx) {
    stopLoop();
    const set = SETS[S.mode];
    const L = parseLevel(set[idx]);
    const kids = kidsOf(S.mode);
    const W = L.W;
    const g = {
      L,
      idx,
      kids,
      t: 0,
      state: "play", // play | rewind | won
      hist: [],
      boxAt: new Int16Array(W * L.H),
      boxes: [],
      players: [],
      stuckAt: -1,
      offerAt: -1,
      offerKind: "",
      progressAt: 0, // poslední pokrok (bedna na cíli, krok zpět, znovu)
      undoVer: 0, // mění se při vracení: rozpracovaná kontrola řešitelnosti pak neplatí
      job: null,
      cellBuf: new Array(L.boxes.length),
      rewindT: 0,
      wonAt: 0,
      hudDirty: true,
      devices: S.pair ? S.pair.devices : null,
    };
    S.game = g;
    S.lvFocus = idx;
    L.boxes.forEach((c, i) => {
      g.boxes.push({
        c,
        start: c,
        ax: c % W,
        ay: (c / W) | 0,
        bx: c % W,
        by: (c / W) | 0,
        k: 1,
        dur: STEP,
        pop: 1,
      });
      g.boxAt[c] = i + 1;
    });
    kids.forEach((who, i) => {
      const c = L.starts[i];
      g.players.push({
        who,
        c,
        start: c,
        ax: c % W,
        ay: (c / W) | 0,
        bx: c % W,
        by: (c / W) | 0,
        k: 1,
        dur: STEP,
        face: i === 1 ? -1 : 1,
        held: null,
        heldAt: 0,
        queue: null,
        okAt: -1,
        bumpX: 0,
        bumpY: 0,
        bumpK: 1,
        hop: 1,
        undoAt: -1,
      });
    });
    layout(g);
    paintStatic(g);
    S.screen = "game";
    screen.replaceChildren();
    TV.sound.beep();
    last = 0;
    S.raf = requestAnimationFrame(frame);
  }

  /** Velikost políčka podle rozměru úrovně, plán vycentrovaný pod horní lištou. */
  function layout(g) {
    const L = g.L;
    const T = Math.floor(Math.min(110, 1840 / L.W, 880 / L.H));
    g.T = T;
    g.ox = Math.round((1920 - L.W * T) / 2);
    g.oy = Math.round(150 + (910 - L.H * T) / 2);
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
    const g = S.game;
    if (g.state === "won") {
      // po oslavě může OK přeskočit čekání na další úroveň
      if (
        e.name === "ok" &&
        e.type === "down" &&
        g.celebrated &&
        performance.now() - g.celebratedAt > 1500
      )
        nextLevel(g);
      return;
    }
    const p = playerOf(e);
    if (!p) return;
    const n = e.name;
    if (DIRS[n]) {
      if (e.type === "up") {
        if (p.held === n) p.held = null;
        return;
      }
      if (e.type === "repeat") {
        // opakování = drží (po pauze by se jinak „ztratilo“ stisknutí)
        if (p.held !== n) {
          p.held = n;
          p.heldAt = g.t - HOLD_WALK;
        }
        return;
      }
      p.held = n;
      p.heldAt = g.t;
      if (g.state !== "play") return;
      if (p.k < 1) p.queue = n;
      else tryMove(g, p, n);
    } else if (n === "ok") {
      if (e.type === "down") p.okAt = g.t;
      else if (e.type === "up") {
        // krátké ťuknutí = poskočí radostí (aby OK „něco dělalo“)
        if (p.okAt >= 0 && g.t - p.okAt < 0.35 && p.hop >= 1) p.hop = 0;
        p.okAt = -1;
      }
    } else if (n === "action" && e.type !== "up") {
      if (g.state !== "play") return;
      // držené B vrací krok za krokem, ale ne rychleji než po 0,12 s
      if (e.type === "repeat" && g.t - p.undoAt < 0.12) return;
      p.undoAt = g.t;
      // SPOLU: vrátit smí jen ten, kdo udělal poslední tah (ať jeden nerozebere práci druhého)
      const h = g.hist[g.hist.length - 1];
      if (g.players.length > 1 && h && g.players[h.pi] !== p) {
        TV.sound.nope();
        return;
      }
      if (undo(g, true)) {
        g.progressAt = g.t; // dítě samo opravuje = pokrok
        if (g.offerKind === "restart") g.offerAt = -1;
      }
    }
  }

  function playerAt(g, c, except) {
    for (const q of g.players) if (q !== except && q.c === c) return true;
    return false;
  }

  function tryMove(g, p, dir) {
    const L = g.L;
    const [dx, dy] = DIRS[dir];
    const d = dx + dy * L.W;
    if (dx) p.face = dx;
    const n = p.c + d;
    const bump = () => {
      p.bumpX = dx;
      p.bumpY = dy;
      p.bumpK = 0;
      TV.sound.nope();
    };
    if (L.solid[n] || playerAt(g, n, p)) return bump();
    const bi = g.boxAt[n] - 1;
    if (bi >= 0) {
      const b2 = n + d;
      if (L.solid[b2] || g.boxAt[b2] || playerAt(g, b2, null)) return bump();
      const b = g.boxes[bi];
      g.boxAt[n] = 0;
      g.boxAt[b2] = bi + 1;
      b.c = b2;
      anim(b, b2, STEP);
      if (L.target[b2])
        b.landed = true; // cinknutí a zezlátnutí až po dojetí
      else TV.sound.move();
    }
    g.hist.push({ pi: g.players.indexOf(p), from: p.c, bi, bfrom: n });
    p.c = n;
    anim(p, n, STEP);
    g.hudDirty = true;
    if (bi >= 0) afterPush(g);
  }

  /** Krok zpět. user=true: dítě zmáčklo B (při prázdné historii jen jemné „ne“). */
  function undo(g, user) {
    const h = g.hist.pop();
    if (!h) {
      if (user) TV.sound.nope();
      return false;
    }
    const p = g.players[h.pi];
    if (h.bi >= 0) {
      const b = g.boxes[h.bi];
      g.boxAt[b.c] = 0;
      g.boxAt[h.bfrom] = h.bi + 1;
      b.c = h.bfrom;
      b.landed = false;
      anim(b, h.bfrom, 0.1);
    }
    p.c = h.from;
    p.queue = null;
    g.undoVer++;
    anim(p, h.from, 0.1);
    if (user) TV.sound.flip();
    g.hudDirty = true;
    if (h.bi >= 0) afterPush(g);
    return true;
  }

  /** Po pohnutí bednou: hotovo? zaseknuto? */
  function afterPush(g) {
    if (g.boxes.every((b) => g.L.target[b.c])) {
      g.state = "won";
      g.wonAt = g.t;
      for (const p of g.players) p.queue = null;
      return;
    }
    if (gameStuck(g)) {
      if (g.stuckAt < 0) g.stuckAt = g.t;
    } else {
      g.stuckAt = -1;
      if (g.offerKind === "rewind") g.offerAt = -1;
    }
  }

  /** Úroveň znovu: bedny a postavičky se svezou na start. */
  function restart(g) {
    g.hist.length = 0;
    g.boxAt.fill(0);
    g.boxes.forEach((b, i) => {
      b.c = b.start;
      b.landed = false;
      g.boxAt[b.c] = i + 1;
      anim(b, b.c, 0.35);
    });
    for (const p of g.players) {
      p.c = p.start;
      p.queue = null;
      anim(p, p.c, 0.35);
    }
    g.stuckAt = g.offerAt = -1;
    g.state = "play";
    g.hudDirty = true;
    g.job = null;
    g.undoVer++;
    g.progressAt = g.t;
    TV.sound.whoosh();
  }

  function update(dt) {
    const g = S.game;
    g.t += dt;
    for (const b of g.boxes) {
      if (b.k < 1) {
        b.k = Math.min(1, b.k + dt / b.dur);
        if (b.k >= 1 && b.landed) {
          b.landed = false;
          b.pop = 0;
          g.progressAt = g.t;
          TV.sound.ding();
          g.hudDirty = true;
        }
      }
      if (b.pop < 1) b.pop = Math.min(1, b.pop + dt / 0.35);
    }
    for (const p of g.players) {
      if (p.k < 1) p.k = Math.min(1, p.k + dt / p.dur);
      if (p.bumpK < 1) p.bumpK = Math.min(1, p.bumpK + dt / 0.18);
      if (p.hop < 1) p.hop = Math.min(1, p.hop + dt / 0.35);
      if (g.state === "play" && p.k >= 1) {
        // další krok: nejdřív zapamatovaný stisk, pak držená šipka
        const next =
          p.queue || (p.held && g.t - p.heldAt >= HOLD_WALK ? p.held : null);
        p.queue = null;
        if (next) tryMove(g, p, next);
      }
    }
    // držené OK = úroveň znovu (ve SPOLU musí držet oba)
    if (holdTime(g) >= HOLD_RESTART) {
      for (const p of g.players) p.okAt = -1;
      if (g.state !== "won") restart(g);
    }
    if (g.state === "play") {
      if (g.offerAt < 0) {
        if (g.stuckAt >= 0) {
          if (g.t - g.stuckAt > 3) offer(g, "rewind");
        } else if (g.job) {
          const r = runCheck(g, 4);
          if (r !== null) {
            const valid = g.job.ver === g.undoVer;
            g.job = null;
            // neřešitelné platí i po dalších krocích vpřed; po vracení výsledek zahodíme
            if (r) g.progressAt = g.t;
            else if (valid) offer(g, "restart");
          }
        } else if (g.t - g.progressAt > NOPROGRESS[S.mode]) startCheck(g);
      } else if (g.t - g.offerAt > 1.8) {
        if (g.offerKind === "rewind") {
          g.state = "rewind";
          g.rewindT = 0;
        } else restart(g);
      }
    }
    if (g.state === "rewind") {
      // vracíme po jednom tlačení, dokud pozice není zase řešitelná (chůzi vrátíme naráz)
      g.rewindT -= dt;
      if (g.rewindT <= 0) {
        g.rewindT = 0.2;
        let h;
        do {
          h = g.hist[g.hist.length - 1];
          if (!undo(g, false)) break;
        } while (h.bi < 0);
        TV.sound.flip();
        if (!gameStuck(g) || !g.hist.length) {
          g.state = "play";
          g.stuckAt = g.offerAt = -1;
          g.progressAt = g.t;
        }
      }
    }
    if (g.state === "won" && !g.celebrated && g.t - g.wonAt > 0.45)
      celebrate(g);
  }

  // ---------- Oslava ----------
  function starsFor(g) {
    const moves = g.hist.length,
      min = g.L.min;
    return moves <= min * 1.5 ? 3 : moves <= min * 3 ? 2 : 1;
  }
  function celebrate(g) {
    g.celebrated = true;
    g.celebratedAt = performance.now(); // smyčka se po oslavě zastaví, g.t pak stojí
    const n = starsFor(g);
    g.stars = n;
    const all = loadStars(S.mode);
    all[g.idx] = Math.max(all[g.idx], n);
    saveStars(S.mode, all);
    TV.sound.win();
    TV.confetti(fx, 70);
    const box = el("div", "win");
    box.appendChild(el("div", "win-title", "Hurá!"));
    const st = el("div", "win-stars");
    for (let k = 0; k < 3; k++)
      st.appendChild(el("span", k < n ? "on" : "", "★"));
    box.appendChild(st);
    screen.replaceChildren(box);
    if (S.mode === "spolu") sayCs("Hurá!");
    else
      sayCs([
        "Hurá!",
        "Máš " + TV.csCount(n, ["hvězdičku", "hvězdičky", "hvězdiček"]) + "!",
      ]);
    setTimeout(() => {
      if (S.game === g && S.screen === "game") nextLevel(g);
    }, 4200);
  }
  function nextLevel(g) {
    if (g.next) return;
    g.next = true;
    if (g.idx + 1 < SETS[S.mode].length) {
      S.lvFocus = g.idx + 1;
      startLevel(g.idx + 1);
    } else showEnd();
  }

  function showEnd() {
    stopLoop();
    S.screen = "end";
    S.endAt = performance.now();
    S.focus = 0;
    S.game = null;
    clearCanvas();
    TV.sound.win();
    TV.confetti(fx, 140);
    const total = loadStars(S.mode).reduce((a, b) => a + b, 0);
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", "Hurá!"));
    const row = el("div", "end-players");
    for (const who of kidsOf(S.mode)) {
      const col = el("div", "end-player");
      col.append(avatarEl(who), el("div", "end-name", TV.PLAYERS[who].name));
      row.appendChild(col);
    }
    box.appendChild(row);
    box.appendChild(el("div", "end-stars", "★ " + total));
    const btns = el("div", "end-buttons");
    btns.style.marginTop = "40px";
    btns.append(el("div", "btn focus", "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(el("div", "menu-bg"), ov);
    if (S.mode === "spolu") sayCs("Hurá! Oba jste to zvládli!");
    else
      sayCs([
        S.mode === "nela"
          ? "Hurá, Nelo! Dokázala jsi to!"
          : "Hurá, Maty! Dokázal jsi to!",
        "Máš " +
          TV.csCount(total, ["hvězdičku", "hvězdičky", "hvězdiček"]) +
          "!",
      ]);
  }

  // ---------- Kreslení ----------
  let staticLayer = null;
  /** Tráva, kytičky, ploty, zdi a cíle se nemění: předkreslíme je jednou za úroveň. */
  function paintStatic(g) {
    const L = g.L,
      T = g.T;
    if (!staticLayer) {
      staticLayer = document.createElement("canvas");
      staticLayer.width = canvas.width;
      staticLayer.height = canvas.height;
    }
    const c = staticLayer.getContext("2d");
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.fillStyle = "#3e8c37";
    c.fillRect(0, 0, 1920, 1080);
    const gx0 = -Math.ceil(g.ox / T) - 1,
      gy0 = -Math.ceil(g.oy / T) - 1;
    const gx1 = Math.ceil((1920 - g.ox) / T) + 1,
      gy1 = Math.ceil((1080 - g.oy) / T) + 1;
    const grass = ok("grass") ? sprite(IMG.grass, T, T) : null;
    for (let gy = gy0; gy < gy1; gy++)
      for (let gx = gx0; gx < gx1; gx++) {
        const x = g.ox + gx * T,
          y = g.oy + gy * T;
        const inMap = gx >= 0 && gy >= 0 && gx < L.W && gy < L.H;
        const k = inMap ? L.kind[gy * L.W + gx] : K.OUT;
        if (grass) c.drawImage(grass, x, y, T + 1, T + 1);
        else {
          c.fillStyle = (gx + gy) & 1 ? "#72c44a" : "#7fcf55";
          c.fillRect(x, y, T + 1, T + 1);
        }
        if (k === K.OUT) {
          // mimo zahradu tmavší tráva a sem tam kytička
          c.fillStyle = "rgba(20, 60, 25, 0.38)";
          c.fillRect(x, y, T + 1, T + 1);
          const h = hash(gx, gy);
          if (h % 100 < 30) {
            const fx2 = x + T / 2 + ((h >> 8) % 30) - 15,
              fy2 = y + T / 2 + ((h >> 13) % 30) - 15;
            drawFlower(c, fx2, fy2, T * (0.45 + ((h >> 18) % 20) / 100), h);
          }
        }
      }
    // cíle, pak ploty a zdi
    for (let i = 0; i < L.W * L.H; i++) {
      const x = g.ox + (i % L.W) * T,
        y = g.oy + ((i / L.W) | 0) * T;
      if (L.target[i]) drawTarget(c, x + T / 2, y + T / 2, T * 0.8);
      if (L.kind[i] === K.HEDGE) drawBlock(c, "hedge", x, y, T);
      else if (L.kind[i] === K.WALL) drawBlock(c, "wall", x, y, T);
    }
  }
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function drawFlower(c, x, y, s, h) {
    if (ok("flower")) {
      c.drawImage(sprite(IMG.flower, s, s), x - s / 2, y - s / 2, s, s);
      return;
    }
    const cols = ["#ff8fb1", "#ffd23d", "#ffffff", "#b68cff"];
    c.fillStyle = cols[h % 4];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.beginPath();
      c.arc(
        x + Math.cos(a) * s * 0.22,
        y + Math.sin(a) * s * 0.22,
        s * 0.16,
        0,
        7,
      );
      c.fill();
    }
    c.fillStyle = "#ffb830";
    c.beginPath();
    c.arc(x, y, s * 0.12, 0, 7);
    c.fill();
  }
  function drawTarget(c, x, y, s) {
    if (ok("target")) {
      c.drawImage(sprite(IMG.target, s, s), x - s / 2, y - s / 2, s, s);
      return;
    }
    c.save();
    c.fillStyle = "rgba(255, 220, 80, 0.35)";
    c.beginPath();
    c.arc(x, y, s * 0.46, 0, 7);
    c.fill();
    starPath(c, x, y, s * 0.36, s * 0.16);
    c.fillStyle = "#ffd23d";
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = "#c98a00";
    c.stroke();
    c.restore();
  }
  function starPath(c, x, y, r1, r2) {
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k & 1 ? r2 : r1;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      if (k) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function drawBlock(c, name, x, y, T) {
    if (ok(name)) {
      c.drawImage(sprite(IMG[name], T, T), x, y, T + 1, T + 1);
      return;
    }
    if (name === "hedge") {
      roundRect(c, x + 2, y + 2, T - 4, T - 4, T * 0.28, "#2f7a2a", "#1d4f1a");
      c.fillStyle = "#3f9a37";
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.arc(
          x + T * (0.3 + (k % 2) * 0.4),
          y + T * (0.3 + (k >> 1) * 0.4),
          T * 0.14,
          0,
          7,
        );
        c.fill();
      }
    } else {
      roundRect(c, x + 2, y + 2, T - 4, T - 4, T * 0.12, "#9aa1a8", "#5b6168");
      c.strokeStyle = "#6f767d";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x + 4, y + T / 2);
      c.lineTo(x + T - 4, y + T / 2);
      c.moveTo(x + T / 2, y + 4);
      c.lineTo(x + T / 2, y + T / 2);
      c.moveTo(x + T / 4, y + T / 2);
      c.lineTo(x + T / 4, y + T - 4);
      c.moveTo(x + (3 * T) / 4, y + T / 2);
      c.lineTo(x + (3 * T) / 4, y + T - 4);
      c.stroke();
    }
  }
  function roundRect(c, x, y, w, h, r, fill, stroke) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.lineWidth = 5;
      c.strokeStyle = stroke;
      c.stroke();
    }
  }

  function drawBox(g, b) {
    const T = g.T;
    const gold = g.L.target[b.c] && b.k >= 1 && !b.landed;
    // zezlátnutí: krátké nafouknutí po dojetí na hvězdičku
    const s = T * 0.9 * (b.pop < 1 ? 1 + 0.22 * Math.sin(b.pop * Math.PI) : 1);
    const x = g.ox + (posX(b) + 0.5) * T,
      y = g.oy + (posY(b) + 0.5) * T;
    const name = gold ? "crate-done" : "crate";
    if (ok(name)) {
      ctx.drawImage(sprite(IMG[name], s, s), x - s / 2, y - s / 2, s, s);
    } else {
      roundRect(
        ctx,
        x - s / 2,
        y - s / 2,
        s,
        s,
        s * 0.12,
        gold ? "#ffc83d" : "#c98a4b",
        gold ? "#a8740a" : "#5a3416",
      );
      ctx.strokeStyle = gold ? "#a8740a" : "#7a4a22";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.36, y - s * 0.36);
      ctx.lineTo(x + s * 0.36, y + s * 0.36);
      ctx.moveTo(x + s * 0.36, y - s * 0.36);
      ctx.lineTo(x - s * 0.36, y + s * 0.36);
      ctx.stroke();
    }
    if (gold && b.pop < 1) {
      // jiskřičky kolem zlaté bedny
      ctx.fillStyle = "rgba(255, 230, 120," + (1 - b.pop) + ")";
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const r = s * (0.5 + b.pop * 0.4);
        starPath(
          ctx,
          x + Math.cos(a) * r,
          y + Math.sin(a) * r,
          T * 0.1,
          T * 0.045,
        );
        ctx.fill();
      }
    }
  }

  function drawPlayer(g, p) {
    const T = g.T;
    const col = TV.PLAYERS[p.who].color;
    let x = g.ox + (posX(p) + 0.5) * T,
      y = g.oy + (posY(p) + 1) * T;
    // náraz do zdi: kousek tam a zpátky
    if (p.bumpK < 1) {
      const o = Math.sin(p.bumpK * Math.PI) * T * 0.12;
      x += p.bumpX * o;
      y += p.bumpY * o;
    }
    // barevný stín pod nohama (ve SPOLU je hned vidět, kdo je kdo)
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y - T * 0.12, T * 0.36, T * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // pohupování při chůzi a poskočení po OK
    const walking = p.k < 1;
    const lift =
      (walking ? Math.sin(p.k * Math.PI) * T * 0.12 : 0) +
      (p.hop < 1 ? Math.sin(p.hop * Math.PI) * T * 0.3 : 0);
    const tilt = walking ? Math.sin(p.k * Math.PI * 2) * 0.07 : 0;
    const i = IMG[p.who];
    const h = T * 1.25;
    ctx.save();
    ctx.translate(x, y - T * 0.08 - lift);
    ctx.rotate(tilt);
    if (p.face < 0) ctx.scale(-1, 1);
    if (i && i.ok) {
      const w = (h * i.naturalWidth) / i.naturalHeight;
      ctx.drawImage(sprite(i, w, h), -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -T * 0.42, T * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font =
        "900 " + Math.round(T * 0.42) + 'px "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.who === "maty" ? "M" : "N", 0, -T * 0.4);
    }
    ctx.restore();
    // držené OK: kroužek, který se plní do „znovu“
    const ht = holdTime(g);
    if (ht > 0.25) {
      const f = Math.min(1, ht / HOLD_RESTART);
      const cy = y - h - T * 0.3;
      ctx.lineWidth = T * 0.1;
      ctx.strokeStyle = "rgba(10,16,50,.5)";
      ctx.beginPath();
      ctx.arc(x, cy, T * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffd23d";
      ctx.beginPath();
      ctx.arc(x, cy, T * 0.28, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.stroke();
    }
  }

  // Horní lišta: předkreslená, mění se jen po tahu.
  let hud = null;
  function paintHud(g) {
    if (!hud) {
      hud = document.createElement("canvas");
      hud.width = canvas.width;
      hud.height = Math.round(140 * RES);
    }
    const c = hud.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, hud.width, hud.height);
    c.setTransform(RES, 0, 0, RES, 0, 0);
    const font = (px) => "900 " + px + 'px "Trebuchet MS", Roboto, sans-serif';
    c.textBaseline = "middle";
    // vlevo: avatar(y) a číslo úrovně
    const n = g.kids.length;
    roundRect(c, 24, 18, 150 + n * 80 + 260, 104, 52, "rgba(10,16,50,.55)");
    g.kids.forEach((who, k) => {
      const ax = 76 + k * 80;
      c.save();
      c.beginPath();
      c.arc(ax, 70, 44, 0, Math.PI * 2);
      c.fillStyle = TV.PLAYERS[who].color;
      c.fill();
      c.clip();
      const a = AV[who];
      if (a && a.ok) c.drawImage(a, ax - 44, 26, 88, 88);
      c.restore();
      c.lineWidth = 5;
      c.strokeStyle = "#fff";
      c.beginPath();
      c.arc(ax, 70, 44, 0, Math.PI * 2);
      c.stroke();
    });
    c.fillStyle = "#fff";
    c.font = font(54);
    c.textAlign = "left";
    c.fillText(("Úroveň " + (g.idx + 1)).toUpperCase(), 50 + n * 80 + 20, 72);
    // uprostřed: nápověda ovládání (pro rodiče)
    c.textAlign = "center";
    c.font = font(30);
    c.fillStyle = "rgba(255,255,255,.85)";
    c.fillText(
      n > 1
        ? "B = KROK ZPĚT  ·  DRŽTE OBA OK = ZNOVU"
        : "B = KROK ZPĚT  ·  DRŽ OK = ZNOVU",
      1060,
      54,
    );
    c.font = font(34);
    c.fillStyle = "#ffd23d";
    c.fillText(("Kroky: " + g.hist.length).toUpperCase(), 1060, 98);
    // vpravo: bedničky - zlaté jsou hotové
    const nb = g.boxes.length;
    const bw = 76;
    const x0 = 1896 - nb * bw - 24;
    roundRect(c, x0 - 10, 18, nb * bw + 30, 104, 52, "rgba(10,16,50,.55)");
    g.boxes.forEach((b, k) => {
      const done = g.L.target[b.c] && b.k >= 1 && !b.landed;
      const s = 62;
      const x = x0 + 8 + k * bw,
        y = 39;
      const name = done ? "crate-done" : "crate";
      if (ok(name)) c.drawImage(sprite(IMG[name], s, s), x, y, s, s);
      else
        roundRect(
          c,
          x,
          y,
          s,
          s,
          10,
          done ? "#ffc83d" : "#c98a4b",
          done ? "#a8740a" : "#5a3416",
        );
    });
  }

  function draw() {
    const g = S.game;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    for (const b of g.boxes) drawBox(g, b);
    // kdo je níž, je blíž: kreslí se později (hlava přes políčko nad ním)
    const ps = g.players;
    if (ps.length === 2 && posY(ps[0]) > posY(ps[1])) {
      drawPlayer(g, ps[1]);
      drawPlayer(g, ps[0]);
    } else for (const p of ps) drawPlayer(g, p);
    if (g.hudDirty) {
      g.hudDirty = false;
      paintHud(g);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(hud, 0, 0);
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    // jemná nabídka po zaseknutí
    if (g.offerAt >= 0 || g.state === "rewind") {
      const a = Math.min(1, (g.t - g.offerAt) / 0.3);
      ctx.globalAlpha = a;
      roundRect(ctx, 560, 470, 800, 140, 70, "rgba(10,16,50,.8)", "#ffd23d");
      ctx.fillStyle = "#fff";
      ctx.font = '900 64px "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Zkusíme to znovu?".toUpperCase(), 960, 542);
      ctx.globalAlpha = 1;
    }
  }

  let last = 0;
  function frame(t) {
    S.raf = 0;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    if (S.screen !== "game" || !S.game) return;
    const g = S.game;
    update(dt);
    if (S.game !== g || S.screen !== "game") return; // update mohl přepnout úroveň
    draw();
    // po oslavě se už nic nehýbe: smyčku zastavíme (šetří slabé CPU, běží jen CSS oslava)
    if (g.celebrated && g.t - g.wonAt > 1.2) return;
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- Ovládání ----------
  TV.onKey((e) => {
    const n = e.name;
    if (S.screen === "game" && S.game) {
      gameKey(e);
      return;
    }
    if (S.screen === "levels") {
      levelsKey(e);
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
        else showLevels(true);
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
        if (S.focus === 0) {
          S.lvFocus = 0;
          startLevel(0);
        } else showMenu();
      }
    }
  });

  // přepnutí appky: puštěná tlačítka by se ztratila a dítě by chodilo samo / úroveň by se restartovala
  TV.onPause(() => {
    if (S.game)
      for (const p of S.game.players) {
        p.held = null;
        p.queue = null;
        p.okAt = -1;
      }
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    if (S.screen === "game") showLevels(false);
    else showMenu();
    return true;
  });

  S.debug = { isStuck, parseLevel, SETS }; // pro testy řešitelnosti
  window.BEDYNKY = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
