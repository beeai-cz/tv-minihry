/* Kostra nových her (Drahokamy, Křečci, Kulička, ...): menu MATY / NELA / SPOLU, párování dvou ovladačů,
 * odpočet, smyčka snímků, oslava s Hrát znovu / Menu. Hra dodá jen svou logiku:
 *
 *   KIT.game({
 *     title: "Drahokamy",
 *     res: 0.5,                       // rozlišení plátna vůči 1920x1080 (výkon slabé TV)
 *     images: { gem: "img/gem.png" }, // nepovinné obrázky; chybějící = KIT.img(name) vrátí null a hra kreslí sama
 *     countdown: true,                // 3-2-1-Start před hrou
 *     start(g) {},                    // nová hra: g.mode, g.players [{who, idx, held, stars}], g.level
 *     update(g, dt) {},               // dt v sekundách
 *     draw(g, ctx) {},                // ctx už má měřítko, kreslí se v logických 1920x1080
 *     key(g, p, e) {},                // stisk (e.type 'down' | 'repeat' | 'up', e.name), p = hráč
 *   });
 *
 * Konec hry: KIT.finish(g). Držené šipky jsou v p.held.left/right/up/down/ok/action. */
(function () {
  "use strict";

  const KIT = {};
  window.KIT = KIT;

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(stage);
  KIT.ctx = ctx;
  KIT.screen = screen;
  KIT.fx = fx;

  // ---------- pomocné ----------
  KIT.rnd = (a, b) => a + Math.random() * (b - a);
  KIT.irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  KIT.pick = (a) => a[Math.floor(Math.random() * a.length)];
  KIT.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  KIT.el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const el = KIT.el;
  KIT.sayCs = (t) => TV.say(t, "cs-CZ");
  KIT.avatarEl = (who) =>
    TV.picture(TV.PLAYERS[who].avatar, TV.PLAYERS[who].emoji, "avatar pic");
  /** Oslovení podle rodu: KIT.g("maty", "Dokázal", "Dokázala"). */
  KIT.g = (who, boy, girl) => (who === "nela" ? girl : boy);
  KIT.voc = (who) => TV.PLAYERS[who].voc;

  // ---------- obrázky ----------
  const IMG = {};
  KIT.IMG = IMG;
  function load(name, src) {
    const i = new Image();
    i.onload = () => (i.ok = true);
    i.onerror = () => (i.ok = false);
    i.src = src;
    IMG[name] = i;
    return i;
  }
  KIT.img = (name) => (IMG[name] && IMG[name].ok ? IMG[name] : null);
  // avatary dětí (do kuličky, do HUD)
  load("av-maty", TV.PLAYERS.maty.avatar);
  load("av-nela", TV.PLAYERS.nela.avatar);

  let RES = 1;
  /** Předzmenšená kopie obrázku (zmenšovat velké PNG v každém snímku je na TV drahé). */
  // velikosti se zaokrouhlí na násobky 8 px a mezipaměť má strop: animovaná velikost (pulzující plamen,
  // zoom úlovku) jinak tvoří stále nová plátna a slabé TV dochází paměť
  const q8 = (v) => Math.max(8, Math.round(v / 8) * 8);
  function sprite(i, w, h) {
    const cache = i.cache || (i.cache = new Map());
    const qw = q8(w),
      qh = q8(h);
    const key = qh * 8192 + qw;
    let c = cache.get(key);
    if (!c) {
      if (cache.size > 24) cache.clear();
      c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(qw * RES));
      c.height = Math.max(1, Math.round(qh * RES));
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      cache.set(key, c);
    }
    return c;
  }
  /** Poměr stran obrázku (výška / šířka), 1 když chybí. */
  KIT.aspect = (name) => {
    const i = KIT.img(name);
    return i ? i.naturalHeight / i.naturalWidth : 1;
  };
  /**
   * Nakreslí obrázek se středem (x, y) a šířkou w (výška podle poměru stran, nebo h).
   * flip = zrcadlit vodorovně, rot = otočení v radiánech. Vrací false, když obrázek není.
   */
  KIT.draw = function (c, name, x, y, w, h, flip, rot, alpha) {
    const i = KIT.img(name);
    if (!i) return false;
    h = h || (w * i.naturalHeight) / i.naturalWidth;
    const s = sprite(i, w, h);
    if (!flip && !rot && alpha == null) {
      c.drawImage(s, x - w / 2, y - h / 2, w, h);
      return true;
    }
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    if (flip) c.scale(-1, 1);
    if (alpha != null) c.globalAlpha = alpha;
    c.drawImage(s, -w / 2, -h / 2, w, h);
    c.restore();
    return true;
  };
  /** Kulatý avatar dítěte (s bílým okrajem), střed x, y, poloměr r. */
  KIT.drawAvatar = function (c, who, x, y, r, ring) {
    const i = KIT.img("av-" + who);
    c.save();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
    if (i) {
      c.clip();
      c.drawImage(sprite(i, r * 2, r * 2), x - r, y - r, r * 2, r * 2);
    }
    c.restore();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.lineWidth = Math.max(3, r * 0.12);
    c.strokeStyle = ring || TV.PLAYERS[who].color;
    c.stroke();
  };
  KIT.roundRect = function (c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  /** Text s obrysem (HUD). Verzálky dělá CSS jen v HTML, na plátně je potřeba toUpperCase. */
  // Text se vykreslí jednou do malého plátna a pak se jen kopíruje (psaní textu s obrysem je na TV drahé).
  const TEXT = new Map();
  const FONT = "'Trebuchet MS', Roboto, sans-serif";
  KIT.text = function (c, t, x, y, size, color, align) {
    size = Math.max(8, Math.round(size / 2) * 2);
    color = color || "#fff";
    const key = t + "|" + size + "|" + color;
    let s = TEXT.get(key);
    if (!s) {
      if (TEXT.size > 300) TEXT.clear();
      s = document.createElement("canvas");
      const m = s.getContext("2d");
      m.font = "900 " + size + "px " + FONT;
      const pad = size * 0.25;
      const w = m.measureText(t).width + pad * 2,
        h = size * 1.5;
      s.width = Math.max(1, Math.ceil(w * RES));
      s.height = Math.max(1, Math.ceil(h * RES));
      s.lw = w;
      s.lh = h;
      s.pad = pad;
      m.scale(RES, RES);
      m.font = "900 " + size + "px " + FONT;
      m.textAlign = "center";
      m.textBaseline = "middle";
      m.lineJoin = "round";
      m.lineWidth = size * 0.18;
      m.strokeStyle = "rgba(0,0,0,0.55)";
      m.strokeText(t, w / 2, h / 2);
      m.fillStyle = color;
      m.fillText(t, w / 2, h / 2);
      TEXT.set(key, s);
    }
    const left = align === "left" ? x - s.pad : align === "right" ? x - s.lw + s.pad : x - s.lw / 2;
    c.drawImage(s, left, y - s.lh / 2, s.lw, s.lh);
  };
  /** Hvězdičky hráčů nahoře v rozích (avatar + ★ počet). */
  KIT.drawStars = function (c, g) {
    g.players.forEach((p, i) => {
      const right = g.players.length > 1 && i === 1;
      const x = right ? 1920 - 90 : 90;
      KIT.drawAvatar(c, p.who, x, 80, 52);
      KIT.text(
        c,
        p.starTxt,
        right ? x - 80 : x + 80,
        82,
        58,
        "#ffd23d",
        right ? "right" : "left",
      );
    });
  };
  KIT.addStars = function (p, n) {
    p.stars = Math.max(0, p.stars + n);
    p.starTxt = "★ " + p.stars;
  };

  // ---------- vlastní tóny (siréna, hudba); kontext vznikne při prvním použití ----------
  let actx = null;
  KIT.audio = function () {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  };
  /** Tón: frekvence (nebo [od, do] pro klouzání), začátek za start s, délka, typ vlny, hlasitost. */
  KIT.tone = function (freq, start, dur, type, vol) {
    const a = KIT.audio();
    if (!a) return;
    const t0 = a.currentTime + (start || 0);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || "sine";
    if (Array.isArray(freq)) {
      o.frequency.setValueAtTime(freq[0], t0);
      o.frequency.exponentialRampToValueAtTime(freq[1], t0 + dur);
    } else o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  };
  /** Krátký šum (bubínek, šplouchnutí). */
  KIT.noise = function (start, dur, vol, freq) {
    const a = KIT.audio();
    if (!a) return;
    if (!KIT._nb) {
      const len = Math.floor(a.sampleRate * 0.5);
      KIT._nb = a.createBuffer(1, len, a.sampleRate);
      const d = KIT._nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + (start || 0);
    const src = a.createBufferSource();
    src.buffer = KIT._nb;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq || 1500;
    const g = a.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  // ---------- hlášky přes obrazovku ----------
  /** Velký text uprostřed na chvíli (úroveň, pochvala). */
  KIT.toast = function (text, ms, cls) {
    const t = el("div", "kit-toast" + (cls ? " " + cls : ""), text);
    screen.appendChild(t);
    setTimeout(() => t.remove(), ms || 1600);
    return t;
  };

  // ---------- stav ----------
  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    pair: null,
    game: null,
    raf: 0,
    def: null,
  };
  KIT.S = S;

  function showMenu() {
    cancelAnimationFrame(S.raf);
    S.screen = "menu";
    S.game = null;
    const modes = S.def.modes;
    S.focus = Math.max(0, modes.indexOf(S.mode));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screen.replaceChildren(el("div", "menu-bg"));
    if (S.def.menuBg) S.def.menuBg(screen.firstChild);
    const t = el("div", "title", S.def.title);
    t.style.top = "60px";
    t.style.fontSize = "120px";
    screen.appendChild(t);
    const row = el("div", "choices");
    row.style.top = "300px";
    for (const id of modes) {
      let node;
      if (id === "spolu") {
        node = el("div", "avatar-pair");
        node.append(KIT.avatarEl("maty"), KIT.avatarEl("nela"));
      } else node = KIT.avatarEl(id);
      const c = el("div", "choice");
      c.dataset.id = id;
      c.append(
        node,
        el("div", "label", id === "spolu" ? "Spolu" : TV.PLAYERS[id].name),
      );
      row.appendChild(c);
    }
    screen.appendChild(row);
    markFocus();
    KIT.sayCs("Kdo bude hrát?");
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
        KIT.avatarEl(who),
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
    KIT.sayCs(
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
    else afterMode();
  }

  // ---------- výběr varianty (např. Fotbal / Hokej), když ji hra má ----------
  function afterMode() {
    if (S.def.variants) showVariants();
    else startGame();
  }
  function showVariants() {
    S.screen = "variant";
    const vs = S.def.variants;
    S.vfocus = Math.max(0, vs.findIndex((v) => v.id === S.variant));
    screen.replaceChildren(el("div", "menu-bg"));
    const t = el("div", "title", S.def.variantTitle || "Vyber si");
    t.style.top = "70px";
    t.style.fontSize = "100px";
    screen.appendChild(t);
    const row = el("div", "choices");
    row.style.top = "290px";
    row.style.gap = vs.length > 4 ? "26px" : "50px";
    for (const v of vs) {
      const c = el("div", "choice track");
      if (vs.length > 4) c.style.width = "330px";
      const cv = document.createElement("canvas");
      cv.className = "track-pic";
      cv.width = 340;
      cv.height = 230;
      if (vs.length > 4) cv.style.width = "290px";
      if (v.paint) v.paint(cv.getContext("2d"), 340, 230);
      c.append(cv, el("div", "label", v.label));
      row.appendChild(c);
    }
    screen.appendChild(row);
    markVariant();
    KIT.sayCs(S.def.variantSay || "Vyber si.");
  }
  function markVariant() {
    screen
      .querySelectorAll(".choice")
      .forEach((c, i) => c.classList.toggle("focus", i === S.vfocus));
  }

  function makePlayer(who, idx) {
    return {
      who,
      idx,
      color: TV.PLAYERS[who].color,
      held: {
        left: false,
        right: false,
        up: false,
        down: false,
        ok: false,
        action: false,
      },
      stars: 0,
      starTxt: "★ 0",
    };
  }

  function startGame() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    const g = {
      mode: S.mode,
      spolu: S.mode === "spolu",
      variant: S.variant,
      devices: S.pair ? S.pair.devices : null,
      players: kids.map((k, i) => makePlayer(k, i)),
      level: 1,
      t: 0,
      phase: S.def.countdown === false ? "play" : "count",
    };
    S.game = g;
    S.screen = "game";
    screen.replaceChildren();
    S.def.start(g);
    if (S.def.countdown !== false) {
      const ready = kids.length > 1 ? "Připravte se!" : "Připrav se!";
      screen.appendChild(el("div", "count ready", ready));
      KIT.sayCs(ready);
      KIT.at(g, 2000, () => showCount(3));
      KIT.at(g, 3000, () => showCount(2));
      KIT.at(g, 4000, () => showCount(1));
      KIT.at(g, 5000, () => {
        showCount(0);
        g.phase = "play";
        if (S.def.go) S.def.go(g);
      });
    }
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  KIT.restart = startGame;
  /** Časovač jen pro tuhle hru: po návratu do menu nebo nové hře se nic nespustí. */
  KIT.at = function (g, ms, fn) {
    setTimeout(() => {
      if (S.game === g && S.screen === "game") fn();
    }, ms);
  };
  function showCount(n) {
    screen.querySelectorAll(".count").forEach((c) => c.remove());
    const c = el("div", "count", n > 0 ? String(n) : "Start!");
    screen.appendChild(c);
    if (n > 0) {
      TV.sound.beep();
      KIT.sayCs(["", "Jedna", "Dva", "Tři"][n]);
    } else {
      TV.sound.go();
      KIT.sayCs("Start!");
      setTimeout(() => c.remove(), 800);
    }
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    const g = S.game;
    if (S.screen !== "game" || !g) return;
    g.t += dt;
    // chyba v jednom snímku nesmí zastavit celou hru (obraz by zamrzl)
    try {
      S.def.update(g, dt);
      if (S.screen !== "game" || S.game !== g) return;
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      S.def.draw(g, ctx);
    } catch (err) {
      console.error("[KIT]", err);
    }
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- oslava ----------
  /**
   * Konec hry. opts.say = vlastní věty místo hvězdiček, opts.title = nápis (výchozí Hurá!).
   */
  KIT.finish = function (g, opts) {
    opts = opts || {};
    S.screen = "end";
    S.endAt = performance.now();
    S.focus = 0;
    cancelAnimationFrame(S.raf);
    // poslední snímek zůstane pod oslavou
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    S.def.draw(g, ctx);
    TV.sound.win();
    TV.confetti(fx, 140);
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", opts.title || "Hurá!"));
    const row = el("div", "end-players");
    for (const p of g.players) {
      const col = el("div", "end-player");
      col.append(
        KIT.avatarEl(p.who),
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
    if (opts.say) KIT.sayCs(opts.say);
    else if (g.players.length === 1) {
      const p = g.players[0];
      KIT.sayCs([
        p.who === "maty"
          ? "Hurá, Maty! Dokázal jsi to!"
          : "Hurá, Nelo! Dokázala jsi to!",
        p.stars === 0
          ? "Tentokrát nemáš žádnou hvězdičku."
          : p.stars >= 200
            ? "Máš spoustu hvězdiček!"
            : "Máš " +
              TV.csCount(p.stars, ["hvězdičku", "hvězdičky", "hvězdiček"]) +
              "!",
      ]);
    } else KIT.sayCs("Hurá! Oba jste to zvládli!");
  };

  // ---------- ovládání ----------
  function playerFor(g, e) {
    if (g.players.length === 1) return g.players[0];
    const d = g.devices || {};
    const now = performance.now();
    if (e.device === d.maty) return (g.players[0].last = now), g.players[0];
    if (e.device === d.nela) return (g.players[1].last = now), g.players[1];
    // gamepad po uspání / přepojení dostane nové číslo: přiřadit ho hráči, který se dlouho neozval
    if (e.isPad && e.type === "down") {
      const idle = g.players.filter((p) => now - (p.last || 0) > 8000);
      if (idle.length === 1) {
        d[idle[0].who] = e.device;
        idle[0].last = now;
        return idle[0];
      }
    }
    return null;
  }
  TV.onKey((e) => {
    const n = e.name;
    if (S.screen === "game") {
      const g = S.game;
      const p = playerFor(g, e);
      if (!p) return;
      if (n in p.held) p.held[n] = e.type !== "up";
      if (g.phase === "play" || S.def.keysAlways) S.def.key(g, p, e);
      return;
    }
    if (e.type === "up") return;
    if (S.screen === "menu") {
      const modes = S.def.modes;
      if (n === "left" && S.focus > 0) {
        S.focus--;
        TV.sound.move();
        markFocus();
      } else if (n === "right" && S.focus < modes.length - 1) {
        S.focus++;
        TV.sound.move();
        markFocus();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        S.mode = modes[S.focus];
        S.pair = null;
        if (S.mode === "spolu") showPairing();
        else afterMode();
      }
    } else if (S.screen === "variant") {
      const vs = S.def.variants;
      if (n === "left" && S.vfocus > 0) {
        S.vfocus--;
        TV.sound.move();
        markVariant();
      } else if (n === "right" && S.vfocus < vs.length - 1) {
        S.vfocus++;
        TV.sound.move();
        markVariant();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        S.variant = vs[S.vfocus].id;
        if (vs[S.vfocus].say) KIT.sayCs(vs[S.vfocus].say);
        startGame();
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

  // přepnutí appky: puštěné šipky by se ztratily a postavička by jela sama
  TV.onPause(() => {
    const g = S.game;
    if (g) for (const p of g.players) for (const k in p.held) p.held[k] = false;
  });
  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  KIT.game = function (def) {
    S.def = def;
    def.modes = def.modes || ["maty", "nela", "spolu"];
    RES = def.res || 0.5;
    canvas.width = Math.round(1920 * RES);
    canvas.height = Math.round(1080 * RES);
    for (const k in def.images || {}) load(k, def.images[k]);
    window.HRA = S; // ladění v náhledu
    TV.ready(
      () => {
        if (def.init) def.init();
        showMenu();
      },
      Object.values(IMG),
      [],
    );
  };
  KIT.showMenu = showMenu;
})();
