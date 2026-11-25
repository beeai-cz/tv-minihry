/* Rakety pro Matyho (3) a Nelu (5). Raketa letí vesmírem nahoru, šipkami se hýbe po obrazovce,
 * OK / A střílí (oba drží nebo mačkají tlačítko). Sestřelují se asteroidy, ufouni a slizouni,
 * bonusové bubliny dávají lepší zbraně (trojitá střela, kulomet, plamenomet, rakety) nebo štít.
 * Nedá se prohrát: náraz jen zabliká a vezme lepší zbraň. Na konci přiletí velká chobotnice. */
(function () {
  "use strict";

  const canvas = document.getElementById("road");
  const ctx = canvas.getContext("2d");
  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // Výkon na TV: kreslení v polovičním rozlišení (jako Závody a Skákačka).
  const RES = 0.5;
  canvas.width = 1920 * RES;
  canvas.height = 1080 * RES;

  // ---------- Obrázky ----------
  const NAMES = [
    "rocket-green",
    "rocket-pink",
    "asteroid",
    "ufo",
    "slime",
    "comet",
    "boss",
    "star",
    "orb-flame",
    "orb-bolt",
    "orb-triple",
    "orb-rocket",
    "orb-shield",
    "boom",
    "fireball",
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
  /** Obrázek se středem v (x, y), šířka w, volitelně otočený a průhledný. */
  function drawImg(name, x, y, w, rot, alpha) {
    const i = IMG[name];
    if (!i || !i.ok) {
      ctx.fillStyle = "#ff6b9a";
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const h = (w * i.naturalHeight) / i.naturalWidth;
    const s = sprite(i, w, h);
    if (!rot && alpha == null) {
      ctx.drawImage(s, x - w / 2, y - h / 2, w, h);
      return;
    }
    ctx.save();
    if (alpha != null) ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(s, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---------- Pomocné ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  /** Vyhodí z pole prvky, pro které keep vrátí false (bez nového pole v každém snímku). */
  function compact(arr, keep) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
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

  const WEAPONS = {
    triple: { orb: "orb-triple", say: "Trojitá střela!" },
    bolt: { orb: "orb-bolt", say: "Kulomet!" },
    flame: { orb: "orb-flame", say: "Plamenomet!" },
    rocket: { orb: "orb-rocket", say: "Rakety!" },
  };
  const WEAPON_TIME = 15;
  const SHIELD_TIME = 8;

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
    screen.replaceChildren(el("div", "menu-bg space"));
    const t = el("div", "title", "Rakety");
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
    sayCs("Kdo poletí?");
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
    screen.replaceChildren(el("div", "menu-bg space"), box);
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
  function makePlayer(who, i, n) {
    return {
      who,
      x: n === 1 ? 960 : i === 0 ? 700 : 1220,
      y: 880,
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      weapon: null,
      wt: 0,
      cd: 0,
      inv: 0,
      shield: 0,
      stars: 0,
      side: 1,
    };
  }

  function startGame() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    const hard = S.mode === "nela";
    S.game = {
      hard,
      players: kids.map((k, i) => makePlayer(k, i, kids.length)),
      bullets: [],
      flames: [],
      enemies: [],
      items: [],
      booms: [],
      popups: [],
      boss: null,
      phase: "count",
      t: 0,
      fly: hard ? 120 : 100,
      spawnT: 1.5,
      powerT: 6,
      starT: 3,
      endTimer: 0,
      devices: S.pair ? S.pair.devices : null,
      scroll: 0,
      dots: Array.from({ length: 70 }, () => ({
        x: rnd(0, 1920),
        y: rnd(0, 1080),
        s: rnd(2, 5),
        v: rnd(200, 420),
      })),
    };
    S.screen = "game";
    const g = S.game;
    prewarm();
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
      g.phase = "fly";
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
      TV.sound.whoosh();
      sayCs("Start!");
      const g = S.game;
      setTimeout(() => {
        if (S.game === g && S.screen === "game") screen.replaceChildren();
      }, 800);
    }
  }
  function prewarm() {
    const w = (n, width) => {
      const i = IMG[n];
      if (i && i.ok)
        sprite(i, width, (width * i.naturalHeight) / i.naturalWidth);
    };
    // stejné velikosti jako v draw(), ať se plátna nevyrábí až za hry
    for (const n of ["rocket-green", "rocket-pink"]) {
      w(n, 130);
      w(n, 44);
    }
    for (const r of [45, 60, 80]) w("asteroid", r * 2.1);
    for (const r of [50, 56]) w("slime", r * 2.2);
    w("ufo", 150);
    w("comet", 100);
    for (const n of [64, 90]) w("star", n);
    w("boss", 460);
    w("boss", 64);
    bgTall();
    for (const k in WEAPONS) {
      w(WEAPONS[k].orb, 100);
      w(WEAPONS[k].orb, 76);
    }
    w("orb-shield", 100);
    w("orb-shield", 76);
    w("orb-rocket", 46);
    for (let s = 24; s <= 96; s += 8) w("fireball", s);
    for (let s = 40; s <= 340; s += 8) w("boom", s);
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
    const down = e.type !== "up"; // i opakování = drží (po pauze nebo Hrát znovu)
    if (e.name === "left") p.left = down;
    else if (e.name === "right") p.right = down;
    else if (e.name === "up") p.up = down;
    else if (e.name === "down") p.down = down;
    else if (e.name === "ok" || e.name === "action") p.fire = down;
  }

  // ---------- Střelba ----------
  function shoot(p, g) {
    const color = TV.PLAYERS[p.who].color;
    const w = p.weapon;
    if (!w) {
      g.bullets.push({
        x: p.x,
        y: p.y - 80,
        vx: 0,
        vy: -1500,
        r: 16,
        dmg: 1,
        color,
        p,
      });
      p.cd = 0.26;
    } else if (w === "triple") {
      for (const a of [-0.22, 0, 0.22])
        g.bullets.push({
          x: p.x,
          y: p.y - 80,
          vx: Math.sin(a) * 1500,
          vy: -Math.cos(a) * 1500,
          r: 16,
          dmg: 1,
          color,
          p,
        });
      p.cd = 0.3;
    } else if (w === "bolt") {
      p.side = -p.side;
      g.bullets.push({
        x: p.x + p.side * 24,
        y: p.y - 70,
        vx: rnd(-40, 40),
        vy: -1800,
        r: 14,
        dmg: 1,
        color: "#ffe14d",
        p,
      });
      p.cd = 0.085;
      p.pews = ((p.pews || 0) + 1) % 3;
      if (p.pews) return; // piu jen u každé třetí, ať to nepraská
    } else if (w === "flame") {
      for (let k = 0; k < 2; k++)
        g.flames.push({
          x: p.x + rnd(-10, 10),
          y: p.y - 70,
          vx: rnd(-200, 200),
          vy: -rnd(750, 950),
          t: 0,
          life: rnd(0.4, 0.55),
          p,
        });
      p.cd = 0.04;
      return; // plamenomet bez „piu“
    } else if (w === "rocket") {
      for (const s of [-1, 1])
        g.bullets.push({
          x: p.x + s * 40,
          y: p.y - 30,
          vx: s * 380,
          vy: -500,
          r: 22,
          dmg: 3,
          homing: true,
          color,
          p,
        });
      p.cd = 0.5;
    }
    TV.sound.pew();
  }

  // ---------- Nepřátelé ----------
  function spawnEnemy(g) {
    const hard = g.hard;
    const kinds = hard
      ? ["asteroid", "asteroid", "ufo", "slime", "comet"]
      : ["asteroid", "asteroid", "ufo", "slime"];
    const kind = pick(kinds);
    const x = kind === "ufo" ? rnd(320, 1600) : rnd(140, 1780); // UFO kmitá ±220
    const e = {
      kind,
      x,
      x0: x,
      y: -120,
      vx: rnd(-60, 60),
      vy: 0,
      r: 60,
      hp: 1,
      rot: rnd(0, 6),
      vr: rnd(-1.5, 1.5),
      t: rnd(0, 6),
      flash: 0,
      stars: 1,
    };
    if (kind === "asteroid") {
      const big = hard && Math.random() < 0.45;
      e.r = big ? 80 : 60;
      e.hp = big ? 3 : hard ? 2 : 1;
      e.big = big;
      e.vy = rnd(150, 240);
    } else if (kind === "ufo") {
      e.r = 70;
      e.hp = hard ? 4 : 3;
      e.vy = rnd(110, 150);
      e.stars = 2;
    } else if (kind === "slime") {
      e.r = 56;
      e.hp = 2;
      e.vy = rnd(160, 210);
    } else if (kind === "comet") {
      e.r = 46;
      e.hp = 1;
      e.vy = 560;
      e.vx = rnd(-120, 120);
    }
    g.enemies.push(e);
  }
  function kill(g, e, p, silent) {
    e.dead = true;
    g.booms.push({ x: e.x, y: e.y, t: 0, size: e.r * 2.6 });
    if (!silent) TV.sound.boom(e.r > 70);
    if (p) {
      p.stars += e.stars;
      g.popups.push({ x: e.x, y: e.y, t: 0, n: e.stars });
    }
    if (e.big) {
      // velký asteroid se rozpadne na dva malé
      for (const s of [-1, 1])
        g.enemies.push({
          kind: "asteroid",
          x: e.x + s * 40,
          x0: e.x,
          y: e.y,
          vx: s * 220,
          vy: 200,
          r: 45,
          hp: 1,
          rot: 0,
          vr: s * 2,
          t: 0,
          flash: 0,
          stars: 1,
        });
    }
  }
  function damage(g, e, dmg, p) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.1;
    if (e.hp <= 0) kill(g, e, p);
  }

  function spawnItem(g, type) {
    const x = rnd(200, 1720);
    g.items.push({ type, x, x0: x, y: -80, t: rnd(0, 6) });
  }

  function hitPlayer(p) {
    if (p.inv > 0 || p.shield > 0) return false;
    p.inv = 2;
    p.weapon = null;
    p.wt = 0;
    TV.sound.bump();
    return true;
  }

  // ---------- Aktualizace ----------
  function update(dt) {
    const g = S.game;
    g.scroll += dt * (g.phase === "boss" ? 70 : 140);
    for (const d of g.dots) {
      d.y += d.v * dt;
      if (d.y > 1090) {
        d.y = -10;
        d.x = rnd(0, 1920);
      }
    }
    if (g.phase === "count") return;
    g.t += dt;
    const flying = g.phase === "fly" || g.phase === "boss";

    // hráči
    for (const p of g.players) {
      const mx = (p.right ? 1 : 0) - (p.left ? 1 : 0);
      const my = (p.down ? 1 : 0) - (p.up ? 1 : 0);
      const sp = 720;
      p.x = Math.max(90, Math.min(1830, p.x + mx * sp * dt));
      p.y = Math.max(480, Math.min(950, p.y + my * sp * dt));
      p.tilt = mx * 0.15;
      p.inv = Math.max(0, p.inv - dt);
      p.shield = Math.max(0, p.shield - dt);
      if (p.weapon) {
        p.wt -= dt;
        if (p.wt <= 0) p.weapon = null;
      }
      p.cd -= dt;
      if (flying && p.fire && p.cd <= 0) shoot(p, g);
    }

    // střely
    for (const b of g.bullets) {
      if (b.homing) {
        let best = null,
          bd = 1e9;
        for (const e of g.enemies) {
          if (e.dead || e.y < 0 || e.y > b.y + 40) continue; // jen před sebou
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        let tx = 0,
          ty = -1;
        if (best) {
          tx = (best.x - b.x) / (bd || 1);
          ty = (best.y - b.y) / (bd || 1);
        } else if (g.boss && g.boss.hp > 0) {
          const d = Math.hypot(g.boss.x - b.x, g.boss.y - b.y) || 1;
          tx = (g.boss.x - b.x) / d;
          ty = (g.boss.y - b.y) / d;
        }
        const sp = 1150;
        const k = Math.min(1, dt * 5);
        b.vx += (tx * sp - b.vx) * k;
        b.vy += (ty * sp - b.vy) * k;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -60 || b.x < -60 || b.x > 1980 || b.y > 1140) b.dead = true;
    }
    for (const f of g.flames) {
      f.t += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy *= 1 - dt * 1.5;
      if (f.t > f.life) f.dead = true;
    }

    // nepřátelé
    for (const e of g.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.rot += e.vr * dt;
      e.y += e.vy * dt;
      if (e.kind === "ufo") e.x = e.x0 + Math.sin(e.t * 1.6) * 220;
      else e.x += e.vx * dt;
      if (e.x < 60) e.vx = Math.abs(e.vx);
      if (e.x > 1860) e.vx = -Math.abs(e.vx);
      if (e.y > 1200) e.dead = true;
    }

    // zásahy střel
    for (const b of g.bullets) {
      if (b.dead) continue;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.x - b.x,
          dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          b.dead = true;
          damage(g, e, b.dmg, b.p);
          break;
        }
      }
      if (!b.dead && g.boss && g.boss.hp > 0 && bossHit(g.boss, b.x, b.y)) {
        b.dead = true;
        hurtBoss(g, b.dmg);
      }
    }
    for (const f of g.flames) {
      if (f.dead) continue;
      const r = 20 + (f.t / f.life) * 40;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.x - f.x,
          dy = e.y - f.y;
        if (dx * dx + dy * dy < (e.r + r) * (e.r + r)) {
          f.dead = true;
          damage(g, e, 0.3, f.p);
          break;
        }
      }
      if (!f.dead && g.boss && g.boss.hp > 0 && bossHit(g.boss, f.x, f.y)) {
        f.dead = true;
        hurtBoss(g, 0.3);
      }
    }

    // náraz do rakety
    for (const p of g.players) {
      for (const e of g.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x,
          dy = e.y - p.y;
        if (dx * dx + dy * dy < (e.r + 45) * (e.r + 45)) {
          if (p.shield > 0) kill(g, e, p);
          else if (hitPlayer(p)) kill(g, e, null);
        }
      }
    }

    // bonusy a hvězdičky
    for (const it of g.items) {
      it.t += dt;
      it.y += (it.type === "star" ? 230 : 170) * dt;
      it.x = it.x0 + Math.sin(it.t * 2) * 60;
      if (it.y > 1150) it.dead = true;
      for (const p of g.players) {
        if (it.dead) break;
        const dx = it.x - p.x,
          dy = it.y - p.y;
        if (dx * dx + dy * dy < 100 * 100) {
          it.dead = true;
          if (it.type === "star") {
            p.stars++;
            TV.sound.ding();
          } else if (it.type === "shield") {
            p.shield = SHIELD_TIME;
            TV.sound.match();
            sayCs("Štít!");
          } else {
            p.weapon = it.type;
            p.wt = WEAPON_TIME;
            TV.sound.match();
            sayCs(WEAPONS[it.type].say);
          }
        }
      }
    }

    for (const b of g.booms) b.t += dt;
    for (const pp of g.popups) pp.t += dt;
    compact(g.bullets, (b) => !b.dead);
    compact(g.flames, (f) => !f.dead);
    compact(g.enemies, (e) => !e.dead);
    compact(g.items, (i) => !i.dead);
    compact(g.booms, (b) => b.t < 0.5);
    compact(g.popups, (p) => p.t < 0.9);

    // vlny nepřátel, bonusy, konec letu
    if (g.phase === "fly") {
      const prog = Math.min(1, g.t / g.fly);
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        spawnEnemy(g);
        const rate = g.hard ? 0.95 + prog * 0.9 : 0.6 + prog * 0.45; // nepřátel za sekundu
        g.spawnT = rnd(0.6, 1.4) / rate;
      }
      g.powerT -= dt;
      if (g.powerT <= 0) {
        spawnItem(
          g,
          Math.random() < 0.2
            ? "shield"
            : pick(g.t > g.fly - 16 ? ["triple", "bolt", "rocket"] : Object.keys(WEAPONS)),
        );
        g.powerT = rnd(9, 13);
      }
      g.starT -= dt;
      if (g.starT <= 0) {
        spawnItem(g, "star");
        g.starT = rnd(2, 4);
      }
      if (g.t >= g.fly) startBoss(g);
    } else if (g.phase === "boss") {
      updateBoss(g, dt);
    } else if (g.phase === "won") {
      g.endTimer += dt;
      if (g.endTimer > 0.25 && g.endTimer < 1.6 && Math.random() < dt * 12)
        g.booms.push({
          x: g.boss.x + rnd(-200, 200),
          y: g.boss.y + rnd(-150, 150),
          t: 0,
          size: rnd(140, 260),
        });
      if (g.endTimer > 2.4) showEnd();
    }
  }
  // ---------- Velká chobotnice ----------
  function startBoss(g) {
    g.phase = "boss";
    // plamenomet na chobotnici nedosáhne, vyměnit za kulomet
    for (const p of g.players) if (p.weapon === "flame") p.weapon = "bolt";
    const hp = (g.hard ? 70 : 40) * (g.players.length > 1 ? 1.5 : 1);
    g.boss = { x: 960, y: -300, hp, max: hp, t: 0, dir: 1, dropT: 3, flash: 0 };
    TV.sound.beep();
    sayCs("Pozor, velká chobotnice!");
  }
  function updateBoss(g, dt) {
    const b = g.boss;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.y < 250) {
      b.y += 160 * dt;
      return;
    }
    b.x += b.dir * (g.hard ? 260 : 180) * dt;
    if (b.x > 1600) b.dir = -1;
    if (b.x < 320) b.dir = 1;
    b.dropT -= dt;
    if (b.dropT <= 0) {
      // pustí slizouna
      g.enemies.push({
        kind: "slime",
        x: b.x,
        x0: b.x,
        y: b.y + 160,
        vx: rnd(-80, 80),
        vy: 220,
        r: 50,
        hp: 1,
        rot: 0,
        vr: 0,
        t: 0,
        flash: 0,
        stars: 1,
      });
      b.dropT = g.hard ? rnd(1.1, 1.7) : rnd(1.8, 2.6);
    }
    if (Math.random() < dt * 0.25) spawnItem(g, "star");
  }
  function bossHit(b, x, y) {
    const dx = (x - b.x) / 210,
      dy = (y - b.y) / 170;
    return dx * dx + dy * dy < 1;
  }
  function hurtBoss(g, dmg) {
    const b = g.boss;
    b.hp -= dmg;
    b.flash = 0.08;
    if (b.hp <= 0) {
      b.hp = 0;
      g.phase = "won";
      g.endTimer = 0;
      for (const e of g.enemies) if (!e.dead) kill(g, e, null, true);
      for (const p of g.players) p.stars += 10;
      g.popups.push({ x: b.x, y: b.y, t: 0, n: 10 });
      TV.sound.boom(true);
      TV.confetti(fx, 80);
    }
  }

  // ---------- Kreslení ----------
  // Pozadí nenavazuje nahoře a dole: pod obraz dáme jeho zrcadlo, pak se dá opakovat bez švu.
  let tallCanvas = null;
  function bgTall() {
    if (tallCanvas) return tallCanvas;
    const i = IMG.bg;
    if (!i || !i.ok) return null;
    const c = document.createElement("canvas");
    c.width = 1920 * RES;
    c.height = 2160 * RES;
    const x = c.getContext("2d");
    x.drawImage(i, 0, 0, c.width, c.height / 2);
    x.save();
    x.translate(0, c.height);
    x.scale(1, -1);
    x.drawImage(i, 0, 0, c.width, c.height / 2);
    x.restore();
    // ztlumit, ať nepřátelé a bonusy vyniknou
    x.fillStyle = "rgba(6,8,32,.35)";
    x.fillRect(0, 0, c.width, c.height);
    tallCanvas = c;
    return c;
  }
  function draw() {
    const g = S.game;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    // pozadí jede dolů (raketa letí nahoru)
    const tall = bgTall();
    if (tall) {
      const off = g.scroll % 2160;
      ctx.drawImage(tall, 0, off - 2160, 1920, 2160);
      ctx.drawImage(tall, 0, off, 1920, 2160);
    } else {
      ctx.fillStyle = "#0d1240";
      ctx.fillRect(0, 0, 1920, 1080);
    }
    ctx.fillStyle = "rgba(255,255,255,.8)";
    for (const d of g.dots) ctx.fillRect(d.x, d.y, d.s, d.s * 3);

    for (const it of g.items) {
      if (it.type === "star")
        drawImg("star", it.x, it.y, 64, Math.sin(it.t * 3) * 0.3);
      else
        drawImg(
          it.type === "shield" ? "orb-shield" : WEAPONS[it.type].orb,
          it.x,
          it.y,
          100 + Math.sin(it.t * 6) * 6,
        );
    }
    for (const e of g.enemies) {
      const w =
        e.kind === "asteroid"
          ? e.r * 2.1
          : e.kind === "ufo"
            ? 150
            : e.kind === "comet"
              ? 100
              : e.r * 2.2;
      const rot =
        e.kind === "asteroid"
          ? e.rot
          : e.kind === "comet"
            ? Math.atan2(e.vy, e.vx) - (3 * Math.PI) / 4
            : 0;
      drawImg(e.kind, e.x, e.y, w, rot, e.flash > 0 ? 0.5 : null);
    }
    const b = g.boss;
    if (b && (b.hp > 0 || g.endTimer < 0.6)) {
      const wob = Math.sin(b.t * 3) * 0.04;
      drawImg(
        "boss",
        b.x,
        b.y,
        460,
        wob,
        b.hp <= 0 ? 1 - g.endTimer / 0.6 : b.flash > 0 ? 0.55 : null,
      );
    }
    for (const bl of g.bullets) {
      if (bl.homing) {
        drawImg("orb-rocket", bl.x, bl.y, 46);
        continue;
      }
      ctx.fillStyle = bl.color;
      ctx.fillRect(bl.x - 7, bl.y - 24, 14, 48);
      ctx.fillStyle = "#fff";
      ctx.fillRect(bl.x - 3, bl.y - 18, 6, 36);
    }
    const fb = IMG.fireball;
    if (fb && fb.ok)
      for (const f of g.flames) {
        const k = f.t / f.life;
        const w = 30 + k * 60;
        ctx.globalAlpha = 1 - k * k;
        ctx.drawImage(sprite(fb, w, w), f.x - w / 2, f.y - w / 2, w, w);
      }
    ctx.globalAlpha = 1;
    for (const p of g.players) {
      if (p.inv > 0 && Math.floor(p.inv * 10) % 2) continue;
      // plamen motoru
      const fl = 40 + Math.random() * 30;
      ctx.fillStyle = "rgba(255,170,40,.9)";
      ctx.beginPath();
      ctx.moveTo(p.x - 20, p.y + 100);
      ctx.lineTo(p.x + 20, p.y + 100);
      ctx.lineTo(p.x, p.y + 100 + fl);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,150,.95)";
      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y + 100);
      ctx.lineTo(p.x + 10, p.y + 100);
      ctx.lineTo(p.x, p.y + 100 + fl * 0.55);
      ctx.fill();
      drawImg(
        p.who === "maty" ? "rocket-green" : "rocket-pink",
        p.x,
        p.y,
        130,
        p.tilt || 0,
      );
      if (p.shield > 0) {
        // ke konci bliká
        const a = p.shield < 2 ? 0.5 + 0.5 * Math.sin(g.t * 20) : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 5, 135, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(140,220,255," + 0.22 * a + ")";
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(190,240,255," + 0.85 * a + ")";
        ctx.stroke();
      }
    }
    for (const bm of g.booms)
      drawImg(
        "boom",
        bm.x,
        bm.y,
        bm.size * (0.5 + bm.t * 1.4),
        0,
        1 - bm.t * 2,
      );
    for (const pp of g.popups)
      drawImg("star", pp.x, pp.y - pp.t * 160, pp.n > 1 ? 90 : 64, 0, 1 - pp.t);

    // HUD: avatar, hvězdičky a zbraň každého hráče
    g.players.forEach((p, i) => {
      const x0 = i === 0 ? 30 : 1920 - 410;
      ctx.fillStyle = "rgba(10,16,50,.6)";
      roundRect(x0, 20, 380, 110, 55);
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
      const orb =
        p.shield > 0 ? "orb-shield" : p.weapon ? WEAPONS[p.weapon].orb : null;
      if (orb) {
        const left = p.shield > 0 ? p.shield / SHIELD_TIME : p.wt / WEAPON_TIME;
        drawImg(orb, x0 + 320, 75, 76);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(
          x0 + 320,
          75,
          44,
          -Math.PI / 2,
          -Math.PI / 2 + left * Math.PI * 2,
        );
        ctx.stroke();
      }
    });
    // nahoře: cesta k chobotnici, pak její zdraví
    const bx = 640,
      bw = 640,
      by = 62;
    ctx.fillStyle = "rgba(10,16,50,.55)";
    roundRect(bx - 24, by - 28, bw + 100, 56, 28);
    if (g.phase === "boss" || g.phase === "won") {
      ctx.fillStyle = "rgba(255,255,255,.25)";
      roundRect(bx, by - 12, bw, 24, 12);
      ctx.fillStyle = "#ff5a7a";
      if (b.hp > 0)
        roundRect(bx, by - 12, Math.max(24, (bw * b.hp) / b.max), 24, 12);
      drawImg("boss", bx + bw + 40, by, 64);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      roundRect(bx, by - 6, bw, 12, 6);
      drawImg("boss", bx + bw + 40, by, 64);
      const f = Math.min(1, g.t / g.fly);
      drawImg(
        g.players[0].who === "maty" ? "rocket-green" : "rocket-pink",
        bx + f * bw,
        by,
        44,
        Math.PI / 2,
      );
    }
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
  let fpsN = 0,
    fpsT = 0;
  function frame(t) {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    if (S.screen !== "game" || !S.game) return;
    update(dt);
    if (S.screen !== "game") return;
    draw();
    fpsN++;
    fpsT += dt;
    if (fpsT > 3) {
      console.log(
        "FPS " + Math.round(fpsN / fpsT) + " nepřátel " + S.game.enemies.length,
      );
      fpsN = 0;
      fpsT = 0;
    }
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
      TV.say(
        [
          p.who === "maty"
            ? "Hurá, Maty! Vyhrál jsi!"
            : "Hurá, Nelo! Vyhrála jsi!",
          p.stars === 0
            ? "Tentokrát nemáš žádnou hvězdičku."
            : p.stars >= 200
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
      // chvíli nereagovat, ať držená střelba hned nespustí novou hru
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

  // přepnutí appky: puštěná tlačítka by se ztratila a raketa by letěla sama
  TV.onPause(() => {
    if (S.game)
      for (const p of S.game.players) p.left = p.right = p.up = p.down = p.fire = false;
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.RAKETY = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
