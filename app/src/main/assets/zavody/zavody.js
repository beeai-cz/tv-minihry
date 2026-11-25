/* Závody aut pro Matyho (3) a Nelu (5). Pohled shora, auto jede samo, šipky doleva/doprava
 * přejíždějí mezi třemi pruhy. Vyhýbá se překážkám, sbírá hvězdičky.
 * Náraz jen zatočí a zpomalí, prohrát se nedá. SPOLU = rozdělená obrazovka, každý svůj ovladač.
 * Po výběru hráče se vybírá trasa (Louka, Poušť, Zima, Cukrová země) - viz TRACKS. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  // Výkon na TV (MT5887): kreslíme v polovičním rozlišení 960x540 a obraz se roztáhne přes celou
  // obrazovku. Kód dál počítá v souřadnicích 1920x1080, škálu řeší transformace v draw().
  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;
  // Obrázky předpřipravené v cílové velikosti (zmenšování 400px PNG každý snímek je drahé).
  const spriteCache = new Map();
  function sprite(i, w, h) {
    w = Math.round(w / 8) * 8; // velikosti po 8 px: méně kopií v cache
    h = Math.round(h / 8) * 8;
    const key = i.src + "|" + w;
    let c = spriteCache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * RES));
      c.height = Math.max(1, Math.round(h * RES));
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      spriteCache.set(key, c);
    }
    return c;
  }
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // ---------- Trasy ----------
  // Každá trasa = jeden objekt: barvy okrajů a silnice, dekorace vedle silnice, překážky na ní.
  // Délka i hustota překážek jsou pro všechny stejné (GAPS), liší se jen vzhledem.
  // Novou trasu stačí přidat sem (a její obrázky do img/).
  const TRACKS = [
    {
      id: "louka",
      name: "Louka",
      say: "Louka",
      side: ["#76c955", "#6abd4b"], // pruhy vedle silnice (střídají se)
      road: "#5d6170",
      edge: null, // pruh uvnitř silnice u obrubníku (sníh, písek), null = žádný
      curb: ["#ffffff", "#e8413c"],
      lines: "rgba(255,255,255,.85)",
      deco: ["bush", "tree"],
      obstacles: ["cone", "puddle", "hay"],
      snow: false,
    },
    {
      id: "poust",
      name: "Poušť",
      say: "Poušť",
      side: ["#f2d38a", "#e6c26e"],
      road: "#9c7b55",
      edge: "#d9b874",
      curb: ["#ffffff", "#e8413c"],
      lines: "rgba(255,255,255,.85)",
      deco: ["cactus", "palm"],
      obstacles: ["cone", "rock", "tumbleweed"],
      snow: false,
    },
    {
      id: "zima",
      name: "Zima",
      say: "Zima",
      side: ["#f4f9ff", "#dfeaf7"],
      road: "#6b7080",
      edge: "#eef5ff",
      curb: ["#ffffff", "#3d7fd9"],
      lines: "rgba(255,255,255,.85)",
      deco: ["pine-snow", "snowman"],
      obstacles: ["cone", "ice", "snowball"],
      snow: true,
    },
    {
      id: "cukrova",
      name: "Cukrová země",
      say: "Cukrová země",
      side: ["#ffc6e2", "#e4c8ff"],
      road: "#c8875a", // karamel: tmavá čokoládová louže na něm musí být vidět
      edge: null,
      curb: ["#ffffff", "#e8413c"], // cukrová hůlka
      lines: "rgba(255,240,248,.95)",
      deco: ["lollipop", "cupcake"],
      obstacles: ["candy-cane", "chocolate", "gummy"],
      snow: false,
    },
  ];
  // Chování překážek: w = šířka v pruzích, fly = po nárazu odletí, roll = kutálí se v pruhu,
  // slip = auto po najetí klouže (místo otočky), flat = náhradní tvar je plochá elipsa.
  const OBST = {
    cone: { w: 0.5, fly: true },
    puddle: { w: 0.62, flat: true },
    hay: { w: 0.5 },
    rock: { w: 0.5 },
    tumbleweed: { w: 0.5, fly: true, roll: true },
    ice: { w: 0.62, flat: true, slip: true },
    snowball: { w: 0.5 },
    "candy-cane": { w: 0.5, fly: true },
    chocolate: { w: 0.62, flat: true },
    gummy: { w: 0.5 },
  };
  // Náhradní barvy, dokud obrázek chybí.
  const FALLBACK = {
    cone: "#ff8a3d",
    puddle: "#4dabff",
    hay: "#f2c94c",
    star: "#ffd23d",
    bush: "#3f9a3a",
    tree: "#2f7d32",
    flag: "#fff",
    cactus: "#4caf50",
    palm: "#2e8b57",
    rock: "#8d8478",
    tumbleweed: "#c8a165",
    "pine-snow": "#2f6d4a",
    snowman: "#ffffff",
    ice: "#bfe9ff",
    snowball: "#ffffff",
    lollipop: "#ff5fa8",
    cupcake: "#f7a8c8",
    "candy-cane": "#e8413c",
    chocolate: "#a0643c",
    gummy: "#3fd16b",
  };

  // ---------- Obrázky (s náhradou kreslenou tvary, dokud nejsou) ----------
  // Načítají se všechny předem (jsou malé); chybějící obrázek TV.ready nezdrží,
  // protože i nenačtený obrázek má po chybě complete = true.
  const IMG = {};
  const names = new Set(["car-green", "car-pink", "star", "flag"]);
  for (const t of TRACKS)
    for (const n of t.deco.concat(t.obstacles)) names.add(n);
  names.forEach((n) => {
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

  // ---------- Nastavení ----------
  const SPEED = 430; // px za sekundu při plné rychlosti
  const LENGTH = SPEED * (location.search.includes("kratka") ? 9 : 50); // ?kratka = test
  const CAR_Y = 830; // kde je auto na obrazovce (střed)
  // Maty má překážky řidčeji než Nela; ve SPOLU má každý svou obtížnost na své silnici.
  const GAPS = { maty: [950, 1300], nela: [520, 760] };
  const CAR = { maty: "car-green", nela: "car-pink" };

  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    track: 0, // index do TRACKS
    race: null,
    pair: null,
    raf: 0,
    endAt: 0,
  };
  const T = () => TRACKS[S.track] || TRACKS[0];

  // Vločky v Zimě: pevné pole (žádné alokace během jízdy), souřadnice přes celou obrazovku.
  const FLAKES = [];
  for (let k = 0; k < 40; k++)
    FLAKES.push({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      vy: 60 + Math.random() * 90,
      ph: Math.random() * 6.28,
      s: 6 + Math.random() * 8,
    });

  const rnd = (a, b) => a + Math.random() * (b - a);
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

  // ---------- Menu: kdo jede ----------
  function showMenu() {
    stopLoop();
    S.screen = "menu";
    S.race = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Závody");
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
    sayCs("Kdo pojede?");
  }
  function markFocus() {
    screen
      .querySelectorAll(".choice")
      .forEach((c, i) => c.classList.toggle("focus", i === S.focus));
  }

  // ---------- SPOLU: každé dítě zmáčkne tlačítko na svém ovladači ----------
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
    } // stejný ovladač jako Maty
    p.devices[who] = e.device;
    TV.sound.ding();
    p.step++;
    if (p.step < 2) renderPairing();
    else showTracks();
  }

  // ---------- Výběr trasy ----------
  function showTracks() {
    S.screen = "tracks";
    S.focus = S.track || 0;
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", "Vyber si trasu");
    t.style.top = "70px";
    t.style.fontSize = "100px";
    screen.appendChild(t);
    const row = el("div", "choices");
    row.style.top = "300px";
    row.style.gap = "46px"; // 4 karty se musí vejít na šířku (bez :has, starší WebView ho nemá)
    TRACKS.forEach((tr) => {
      const c = el("div", "choice track");
      const pic = el("canvas", "track-pic");
      pic.width = 340;
      pic.height = 230;
      drawPreview(pic.getContext("2d"), tr, pic.width, pic.height);
      c.append(pic, el("div", "label", tr.name));
      row.appendChild(c);
    });
    screen.appendChild(row);
    markFocus();
    sayCs("Vyber si trasu.");
  }

  // Náhled trasy kreslený jednou při otevření obrazovky (vlastní obrázek náhledu není).
  // Kreslí se přímo z původních obrázků, sprite cache závodu se tím nezaplňuje.
  function drawPreview(c, tr, w, h) {
    const band = h / 4;
    for (let k = 0; k < 4; k++) {
      c.fillStyle = tr.side[k & 1];
      c.fillRect(0, k * band, w, band + 1);
    }
    const rw = w * 0.46,
      rx = (w - rw) / 2,
      lw = rw / 3;
    c.fillStyle = tr.road;
    c.fillRect(rx, 0, rw, h);
    if (tr.edge) {
      c.fillStyle = tr.edge;
      c.fillRect(rx, 0, 7, h);
      c.fillRect(rx + rw - 7, 0, 7, h);
    }
    const seg = 20;
    for (let y = 0, k = 0; y < h; y += seg, k++) {
      c.fillStyle = tr.curb[k & 1];
      c.fillRect(rx - 8, y, 8, seg);
      c.fillRect(rx + rw, y, 8, seg);
    }
    c.fillStyle = tr.lines;
    for (let l = 1; l < 3; l++)
      for (let y = 6; y < h; y += 44) c.fillRect(rx + lw * l - 2, y, 4, 22);
    thing(c, tr.deco[0], rx / 2, h * 0.28, 58);
    thing(c, tr.deco[1], rx / 2, h * 0.74, 58);
    thing(c, tr.deco[1], rx + rw + (w - rx - rw) / 2, h * 0.3, 58);
    thing(c, tr.deco[0], rx + rw + (w - rx - rw) / 2, h * 0.76, 58);
    thing(c, tr.obstacles[0], rx + lw * 0.5, h * 0.22, lw * 0.6);
    thing(c, tr.obstacles[1], rx + lw * 2.5, h * 0.45, lw * 0.75);
    thing(c, tr.obstacles[2], rx + lw * 0.5, h * 0.7, lw * 0.6);
    thing(c, "star", rx + lw * 1.5, h * 0.28, lw * 0.5);
    thing(c, "car-green", rx + lw * 1.5, h * 0.78, lw * 0.6);
  }

  // ---------- Závod ----------
  function makeRoad(who, view) {
    const solo = S.mode !== "spolu";
    const tr = T();
    const roadW = Math.round(view.w * (solo ? 0.5 : 0.68));
    const r = {
      who,
      view,
      roadW,
      roadX: Math.round(view.x + (view.w - roadW) / 2),
      laneW: roadW / 3,
      lane: 1,
      carX: 0,
      d: 0,
      speed: 0,
      slow: 0,
      boost: 0,
      spin: 0,
      slip: 0, // klouzání po ledu (místo otočky)
      stars: 0,
      finished: false,
      place: 0,
      items: [],
      scenery: [],
    };
    r.carX = r.roadX + r.laneW * 1.5;
    // Překážky po jedné v řadě (vždy zbývají dva volné pruhy), mezi nimi hvězdičky.
    let d = 1300;
    const [g0, g1] = GAPS[who];
    while (d < LENGTH - 500) {
      const lane = Math.floor(Math.random() * 3);
      // ph = fáze kutálení (jen u kutálejících se překážek, ať se nehoupou všechny stejně)
      r.items.push({ d, lane, kind: pick(tr.obstacles), ph: rnd(0, 6.28) });
      const gap = rnd(g0, g1);
      if (Math.random() < 0.75) {
        const sl = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++)
          r.items.push({
            d: d + gap * 0.5 + (k - (n - 1) / 2) * 130,
            lane: sl,
            kind: "star",
          });
      }
      d += gap;
    }
    // Dekorace trasy (keře, kaktusy, sněhuláci...) po obou stranách silnice.
    const left = [view.x + 20, r.roadX - 60],
      right = [r.roadX + roadW + 60, view.x + view.w - 20];
    for (let s = -1200; s < LENGTH + 1600; s += rnd(220, 380)) {
      const side = Math.random() < 0.5 ? left : right;
      if (side[1] - side[0] < 60) continue;
      r.scenery.push({
        d: s,
        x: rnd(side[0], side[1]),
        kind: pick(tr.deco),
        size: rnd(90, 150),
      });
    }
    return r;
  }

  // Připraví zmenšené obrázky do cache předem (během „Připrav se“), ať se jízda nezasekává.
  // Jen pro hranou trasu - ostatní trasy by zbytečně držely plátna v paměti.
  let warmedTrack = null;
  function prewarm(roads) {
    const tr = T();
    // Jiná trasa = staré předzmenšené obrázky už nejsou potřeba (2 GB RAM na TV).
    if (warmedTrack !== tr) spriteCache.clear();
    warmedTrack = tr;
    const warm = (name, w) => {
      const i = IMG[name];
      if (i && i.ok) sprite(i, w, (w * i.naturalHeight) / i.naturalWidth);
    };
    for (const r of roads) {
      for (let k = 0.9; k <= 1.1; k += 0.02) warm("star", r.laneW * 0.42 * k);
      for (const o of tr.obstacles) warm(o, r.laneW * OBST[o].w);
      warm(CAR[r.who], r.laneW * 0.6);
      for (let w = 88; w <= 152; w += 8) for (const n of tr.deco) warm(n, w);
    }
    warm("flag", 110);
    warm("flag", 64);
  }

  function startRace() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    const roads =
      kids.length === 1
        ? [makeRoad(kids[0], { x: 0, w: 1920 })]
        : [
            makeRoad("maty", { x: 0, w: 960 }),
            makeRoad("nela", { x: 960, w: 960 }),
          ];
    S.race = {
      roads,
      count: 1, // > 0 = ještě se nejede (příprava a odpočet)
      t: 0, // čas jízdy (kutálení překážek)
      finishedOrder: [],
      endTimer: 0,
      devices: S.pair ? S.pair.devices : null,
    };
    S.screen = "race";
    const race = S.race;
    prewarm(roads);
    // 2 s „Připrav se“: TV mezitím načte hlas a připraví obrázky (první snímek je pomalý).
    // Odpočet pak běží podle hodin (setTimeout), ne podle snímků, aby seděl s hlasem.
    screen.replaceChildren(el("div", "count ready", "Připrav se!"));
    sayCs(roads.length > 1 ? "Připravte se!" : "Připrav se!");
    startLoop();
    const at = (ms, fn) =>
      setTimeout(() => {
        if (S.race === race && S.screen === "race") fn();
      }, ms);
    at(2200, () => showCount(3));
    at(3200, () => showCount(2));
    at(4200, () => showCount(1));
    at(5200, () => {
      showCount(0);
      race.count = 0;
    });
  }

  function showCount(n) {
    const c = el("div", "count", n > 0 ? String(n) : "Jeď!");
    screen.replaceChildren(c);
    if (n > 0) {
      TV.sound.beep();
      sayCs(["", "Jedna", "Dva", "Tři"][n]);
    } else {
      TV.sound.go();
      sayCs("Jeď!");
      setTimeout(() => {
        if (S.screen === "race") screen.replaceChildren();
      }, 800);
    }
  }

  function roadFor(e) {
    const race = S.race;
    if (race.roads.length === 1) return race.roads[0];
    const dev = race.devices || {};
    if (e.device === dev.maty) return race.roads[0];
    if (e.device === dev.nela) return race.roads[1];
    return null; // cizí ovladač (např. dálkový) ve SPOLU nejede
  }

  function steer(e) {
    if (e.type !== "down" || S.race.count > 0) return;
    const r = roadFor(e);
    if (!r || r.finished) return;
    if (e.name === "left" && r.lane > 0) {
      r.lane--;
      TV.sound.move();
    } else if (e.name === "right" && r.lane < 2) {
      r.lane++;
      TV.sound.move();
    }
  }

  function update(dt) {
    const race = S.race;
    if (T().snow) moveFlakes(dt); // sněží i během odpočtu
    if (race.count > 0) return; // stojí se, dokud odpočet neřekne JEĎ
    race.t += dt;
    for (const r of race.roads) {
      const target = r.finished
        ? 0
        : SPEED * (r.slow > 0 ? 0.35 : r.boost > 0 ? 1.75 : 1);
      r.speed +=
        (target - r.speed) * Math.min(1, dt * (r.finished ? 1.5 : 2.2));
      r.d += r.speed * dt;
      r.slow = Math.max(0, r.slow - dt);
      r.boost = Math.max(0, r.boost - dt);
      r.spin = Math.max(0, r.spin - dt);
      r.slip = Math.max(0, r.slip - dt);
      const tx = r.roadX + r.laneW * (r.lane + 0.5);
      r.carX += (tx - r.carX) * Math.min(1, dt * 12);

      for (const it of r.items) {
        if (it.fly) {
          it.fly.t += dt;
          continue;
        }
        if (it.taken) continue;
        const y = CAR_Y - (it.d - r.d);
        if (Math.abs(y - CAR_Y) > 95) continue;
        const x = itemX(r, it, race.t);
        if (Math.abs(x - r.carX) > r.laneW * 0.55) continue;
        it.taken = true;
        if (it.kind === "star") {
          // Hvězdička = turbo: na chvilku rychleji (a náraz turbo zruší).
          r.stars++;
          r.boost = 1.5;
          TV.sound.ding();
          TV.sound.whoosh();
        } else {
          const o = OBST[it.kind] || {};
          r.slow = 1.1;
          r.boost = 0;
          // Led: auto se jen zakolébá a klouže, neotočí se dokola (jemnější než náraz).
          if (o.slip) {
            r.slip = 1;
            r.spin = 0;
            TV.sound.whoosh();
          } else {
            r.spin = 0.8;
            r.slip = 0;
            TV.sound.bump();
          }
          // Lehké věci (kužel, chuchvalec, cukrová hůlka) odletí stranou.
          if (o.fly) it.fly = { t: 0, dir: x < r.carX ? -1 : 1, x0: x };
        }
      }
      if (!r.finished && r.d >= LENGTH) {
        r.finished = true;
        race.finishedOrder.push(r.who);
        r.place = race.finishedOrder.length;
        TV.sound.match();
        TV.confetti(fx, 50);
        if (race.roads.length > 1 && r.place === 1) {
          sayCs(
            r.who === "nela"
              ? "Nela je v cíli první!"
              : "Maty je v cíli první!",
          );
        }
      }
    }
    if (race.roads.every((r) => r.finished)) {
      race.endTimer += dt;
      if (race.endTimer > 1.6) showEnd();
    }
  }

  // Vodorovná poloha překážky: kutálející se chuchvalec se houpe jen uvnitř svého pruhu
  // (±0,18 pruhu), takže nikdy nevjede do pruhu, kam dítě uhnulo - férovost zůstává.
  function itemX(r, it, t) {
    const x = r.roadX + r.laneW * (it.lane + 0.5);
    const o = OBST[it.kind];
    return o && o.roll ? x + Math.sin(t * 1.6 + it.ph) * r.laneW * 0.18 : x;
  }

  function moveFlakes(dt) {
    for (const f of FLAKES) {
      f.y += f.vy * dt;
      f.ph += dt * 1.5;
      if (f.y > 1090) {
        f.y = -10;
        f.x = Math.random() * 1920;
      }
    }
  }
  function drawFlakes() {
    // Jedna cesta a jedno fill pro všechny vločky = levné.
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    for (const f of FLAKES) ctx.rect(f.x + Math.sin(f.ph) * 25, f.y, f.s, f.s);
    ctx.fill();
  }

  // ---------- Kreslení ----------
  // Náhradní tvar, dokud obrázek chybí: kruh (u louží plochá elipsa) s jemným obrysem.
  function fallback(c, name, w, h) {
    c.fillStyle = FALLBACK[name] || "#999";
    c.beginPath();
    c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = "rgba(0,0,0,.25)";
    c.stroke();
  }
  const isFlat = (name) => !!(OBST[name] && OBST[name].flat);

  function img(name, x, y, w, rot) {
    const i = IMG[name];
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    let h = w;
    if (i && i.ok) {
      h = (w * i.naturalHeight) / i.naturalWidth;
      ctx.drawImage(sprite(i, w, h), -w / 2, -h / 2, w, h);
    } else {
      if (isFlat(name)) h = w * 0.6;
      fallback(ctx, name, w, h);
    }
    ctx.restore();
    return h;
  }

  // Totéž pro libovolné plátno bez sprite cache (náhled trasy se kreslí jen jednou).
  function thing(c, name, x, y, w) {
    const i = IMG[name];
    c.save();
    c.translate(x, y);
    if (i && i.ok) {
      const h = (w * i.naturalHeight) / i.naturalWidth;
      c.drawImage(i, -w / 2, -h / 2, w, h);
    } else if (name === "car-green") {
      c.fillStyle = "#5cc93b";
      c.fillRect(-w / 2, -w * 0.75, w, w * 1.5);
    } else {
      fallback(c, name, w, isFlat(name) ? w * 0.6 : w);
    }
    c.restore();
  }

  function drawCar(r, x, y) {
    const w = r.laneW * 0.6;
    let rot = r.spin > 0 ? (1 - r.spin / 0.8) * Math.PI * 2 : 0;
    if (r.slip > 0) {
      // Klouzání: kolébání ze strany na stranu, slábne s časem
      rot = Math.sin(r.slip * 16) * 0.4 * r.slip;
      x += Math.sin(r.slip * 11) * r.laneW * 0.12 * r.slip;
    }
    const i = IMG[CAR[r.who]];
    let h = w * 1.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (i && i.ok) h = (w * i.naturalHeight) / i.naturalWidth;
    if (r.boost > 0) {
      // Plamínky turba za autem (kreslí se pod auto)
      const fl = 0.75 + 0.25 * Math.sin(performance.now() / 40);
      for (let s = -1; s <= 1; s += 2) {
        const fx0 = s * w * 0.22;
        ctx.beginPath();
        ctx.moveTo(fx0 - w * 0.13, h * 0.42);
        ctx.lineTo(fx0 + w * 0.13, h * 0.42);
        ctx.lineTo(fx0, h * 0.42 + w * 0.75 * fl);
        ctx.closePath();
        ctx.fillStyle = "#ff8a3d";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(fx0 - w * 0.07, h * 0.42);
        ctx.lineTo(fx0 + w * 0.07, h * 0.42);
        ctx.lineTo(fx0, h * 0.42 + w * 0.45 * fl);
        ctx.closePath();
        ctx.fillStyle = "#ffd23d";
        ctx.fill();
      }
    }
    if (i && i.ok) {
      ctx.drawImage(sprite(i, w, h), -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = r.who === "nela" ? "#ff6b9a" : "#5cc93b";
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    // Avatar na střeše
    const a = AV[r.who];
    const rad = w * 0.24;
    ctx.beginPath();
    ctx.arc(0, h * 0.08, rad, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    if (a && a.ok) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(a, -rad, h * 0.08 - rad, rad * 2, rad * 2);
      ctx.restore();
    }
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
  }

  function drawRoad(r) {
    const v = r.view;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, 0, v.w, 1080);
    ctx.clip();

    const tr = T();
    // Okraje (tráva / písek / sníh / cukr) s pruhy, které jedou dolů
    const band = 180;
    const off = r.d % (band * 2);
    for (let y = -band * 2 + off; y < 1080; y += band) {
      const k = Math.floor((r.d - y) / band);
      ctx.fillStyle = k & 1 ? tr.side[0] : tr.side[1];
      ctx.fillRect(v.x, y, v.w, band + 1);
    }
    // Silnice, zasněžený / písečný okraj a obrubníky
    ctx.fillStyle = tr.road;
    ctx.fillRect(r.roadX, 0, r.roadW, 1080);
    if (tr.edge) {
      ctx.fillStyle = tr.edge;
      ctx.fillRect(r.roadX, 0, 22, 1080);
      ctx.fillRect(r.roadX + r.roadW - 22, 0, 22, 1080);
    }
    const seg = 60;
    const co = r.d % (seg * 2);
    for (let y = -seg * 2 + co; y < 1080; y += seg) {
      const k = Math.floor((r.d - y) / seg);
      ctx.fillStyle = k & 1 ? tr.curb[0] : tr.curb[1];
      ctx.fillRect(r.roadX - 24, y, 24, seg + 1);
      ctx.fillRect(r.roadX + r.roadW, y, 24, seg + 1);
    }
    // Přerušované čáry mezi pruhy
    ctx.fillStyle = tr.lines;
    const dash = 70;
    const dof = r.d % (dash * 2);
    for (let l = 1; l < 3; l++) {
      const x = r.roadX + r.laneW * l - 5;
      for (let y = -dash * 2 + dof; y < 1080; y += dash * 2)
        ctx.fillRect(x, y, 10, dash);
    }
    // Cílová páska
    const fy = CAR_Y - (LENGTH - r.d);
    if (fy > -80 && fy < 1160) {
      const sq = r.roadW / 12;
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) & 1 ? "#111" : "#fff";
          ctx.fillRect(r.roadX + i * sq, fy - sq + j * sq, sq, sq);
        }
      }
      img("flag", r.roadX - 70, fy - 60, 110);
      img("flag", r.roadX + r.roadW + 70, fy - 60, 110);
    }
    // Dekorace vedle silnice
    for (const s of r.scenery) {
      const y = CAR_Y - (s.d - r.d);
      if (y < -200 || y > 1280) continue;
      img(s.kind, s.x, y, s.size);
    }
    // Překážky a hvězdičky
    const now = performance.now() / 1000;
    for (const it of r.items) {
      const y = CAR_Y - (it.d - r.d);
      if (y < -150 || y > 1230) continue;
      if (it.taken && !it.fly) continue;
      let x,
        rot = 0;
      if (it.fly) {
        if (it.fly.t > 1.2) continue;
        x = it.fly.x0 + it.fly.dir * it.fly.t * 700;
        rot = it.fly.dir * it.fly.t * 9;
      } else {
        x = itemX(r, it, S.race.t);
        // kutálející se chuchvalec se točí podle toho, kam se zrovna valí
        if (OBST[it.kind] && OBST[it.kind].roll)
          rot = Math.cos(S.race.t * 1.6 + it.ph) * 1.2;
      }
      const w =
        it.kind === "star"
          ? r.laneW * 0.42 * (1 + 0.08 * Math.sin(now * 6 + it.d))
          : r.laneW * (OBST[it.kind] ? OBST[it.kind].w : 0.5);
      img(it.kind, x, y, w, rot);
    }
    drawCar(r, r.carX, CAR_Y);

    // Horní lišta: avatar, hvězdy, ukazatel cesty do cíle
    const pad = 30;
    ctx.fillStyle = "rgba(10,16,50,.55)";
    ctx.fillRect(v.x, 0, v.w, 120);
    const a = AV[r.who];
    if (a && a.ok) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(v.x + pad + 45, 60, 45, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#fff";
      ctx.fillRect(v.x + pad, 15, 90, 90);
      ctx.drawImage(a, v.x + pad, 15, 90, 90);
      ctx.restore();
    }
    ctx.fillStyle = "#ffd23d";
    ctx.font = '900 56px "Trebuchet MS", Roboto, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("★ " + r.stars, v.x + pad + 110, 62);
    const x0 = v.x + 330,
      x1 = v.x + v.w - 90;
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x0, 54, x1 - x0, 14);
    const prog = Math.min(1, r.d / LENGTH);
    ctx.fillStyle = r.who === "nela" ? "#ff6b9a" : "#5cc93b";
    ctx.fillRect(x0, 54, (x1 - x0) * prog, 14);
    img("flag", x1 + 40, 58, 64);
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * prog, 61, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();

    if (r.finished) {
      ctx.save();
      ctx.font = '900 130px "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd23d";
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 12;
      const label = S.race.roads.length > 1 && r.place === 1 ? "1. 👑" : "CÍL!";
      ctx.strokeText(label, v.x + v.w / 2, 420);
      ctx.fillText(label, v.x + v.w / 2, 420);
      ctx.restore();
    }
  }

  function draw() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.clearRect(0, 0, 1920, 1080);
    for (const r of S.race.roads) drawRoad(r);
    if (T().snow) drawFlakes();
    if (S.race.roads.length > 1) {
      ctx.fillStyle = "#0b1030";
      ctx.fillRect(954, 0, 12, 1080);
    }
  }

  let last = 0;
  const fps = { n: 0, t: 0 };
  function frame(t) {
    const dt = Math.min(0.1, last ? (t - last) / 1000 : 0);
    last = t;
    fps.n++;
    if (t - fps.t > 3000) {
      console.log("FPS " + Math.round((fps.n * 1000) / (t - fps.t)));
      fps.n = 0;
      fps.t = t;
    }
    if (S.screen === "race" && S.race) {
      update(dt);
      if (S.race) draw();
    }
    if (S.screen === "race") S.raf = requestAnimationFrame(frame);
  }
  function startLoop() {
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    cancelAnimationFrame(S.raf);
    ctx.clearRect(0, 0, 1920, 1080);
  }

  // ---------- Oslava ----------
  function showEnd() {
    const race = S.race;
    S.screen = "end";
    S.focus = 0;
    cancelAnimationFrame(S.raf);
    TV.sound.win();
    TV.confetti(fx, 140);
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", "Cíl!"));
    const row = el("div", "end-players");
    for (const r of race.roads) {
      const col = el("div", "end-player");
      if (race.roads.length > 1 && r.place === 1)
        col.appendChild(el("div", "crown", "👑"));
      col.append(
        avatarEl(r.who),
        el("div", "end-name", TV.PLAYERS[r.who].name),
        el("div", "end-stars", "★ " + r.stars),
      );
      row.appendChild(col);
    }
    box.appendChild(row);
    // Dokud zbývá nějaká trasa, první tlačítko veze dál (jako „Další svět“ ve Skákačce).
    const btns = el("div", "end-buttons");
    const nextTrack = S.track < TRACKS.length - 1;
    btns.append(
      el("div", "btn focus", nextTrack ? "Další trasa" : "Jet znovu"),
      el("div", "btn", "Menu"),
    );
    S.endAt = performance.now();
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    if (race.roads.length === 1) {
      const n = race.roads[0].stars;
      TV.say(
        [
          "Hurá, " + TV.PLAYERS[race.roads[0].who].voc + "! Jsi v cíli!",
          n === 0
            ? "Tentokrát nemáš žádnou hvězdičku."
            : "Máš " +
              TV.csCount(n, ["hvězdičku", "hvězdičky", "hvězdiček"]) +
              "!",
        ],
        "cs-CZ",
      );
    } else {
      const w = race.finishedOrder[0];
      sayCs(
        "Vyhrál" +
          (w === "nela" ? "a Nela" : " Maty") +
          "! Oba jste skvělí řidiči!",
      );
    }
  }

  // ---------- Ovládání ----------
  TV.onKey((e) => {
    if (e.type === "up") return;
    const n = e.name;
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
        else showTracks();
      }
    } else if (S.screen === "tracks") {
      if (n === "left" && S.focus > 0) {
        S.focus--;
        TV.sound.move();
        markFocus();
        sayCs(TRACKS[S.focus].say); // malí ještě nečtou - název trasy řekneme
      } else if (n === "right" && S.focus < TRACKS.length - 1) {
        S.focus++;
        TV.sound.move();
        markFocus();
        sayCs(TRACKS[S.focus].say);
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        S.track = S.focus;
        startRace();
      }
    } else if (S.screen === "pair") {
      pairKey(e);
    } else if (S.screen === "race") {
      steer(e);
    } else if (S.screen === "end" && performance.now() - S.endAt > 1800) {
      // chvíli nereagovat, ať držené tlačítko hned nespustí další jízdu
      if (n === "left" || n === "right") {
        S.focus = 1 - S.focus;
        TV.sound.move();
        screen
          .querySelectorAll(".end .btn")
          .forEach((b, i) => b.classList.toggle("focus", i === S.focus));
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        if (S.focus === 0) {
          if (S.track < TRACKS.length - 1) S.track++;
          startRace();
        } else showMenu();
      }
    }
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.ZAVODY = S; // ladění v náhledu
  window.ZAVODY_TRACKS = TRACKS;
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
