/* Bojovka pro Matyho (3) a Nelu (5): čtyři zvířecí nindžové, souboj na dvě vítězná kola.
 * Šipky = chůze, nahoru skok, dolů kryt; OK / A = úder, B = kop, dolů + B = kouzelná koule.
 * Sám proti počítači (u Matyho je počítač hodně mírný), nebo SPOLU proti sobě.
 * Kreslené, bez krve: zásah je jen hvězdička a „BUM!“. */
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

  const FLOOR = 960; // y chodidel
  const G = 3600;
  const FIGHTERS = [
    {
      id: "frog",
      name: "Žabák",
      won: "Vyhrál Žabák!",
      color: "#5cc93b",
      shot: "#6fe0ff",
    },
    {
      id: "bunny",
      name: "Králíček",
      won: "Vyhrál Králíček!",
      color: "#ff6b9a",
      shot: "#ffb3e0",
    },
    {
      id: "panda",
      name: "Panda",
      won: "Vyhrála Panda!",
      color: "#e8463c",
      shot: "#ffe14d",
    },
    {
      id: "fox",
      name: "Liška",
      won: "Vyhrála Liška!",
      color: "#3b8bff",
      shot: "#ff9a3d",
    },
  ];
  const ROUND_TIME = 60; // s; pak vyhraje ten, kdo má víc zdraví (kdyby se jen kryli)
  const POSES = [
    "idle",
    "walk",
    "punch",
    "kick",
    "jump",
    "block",
    "hit",
    "win",
    "ko",
  ];
  const MOVES = {
    punch: { time: 0.3, from: 0.07, to: 0.18, reach: 290, dmg: 8, h: 0.62 },
    kick: { time: 0.42, from: 0.12, to: 0.26, reach: 330, dmg: 12, h: 0.4 },
  };

  // ---------- Obrázky ----------
  const IMG = {};
  const load = (key, src) => {
    const i = new Image();
    i.onload = () => {
      i.ok = true;
    };
    i.src = src;
    IMG[key] = i;
  };
  for (const f of FIGHTERS)
    for (const p of POSES)
      load(f.id + "-" + p, "img/" + f.id + "-" + p + ".png");
  load("bg", "img/bg.jpg");
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
  const HEIGHT = 380; // výška postavy na obrazovce
  function fighterImg(f, pose) {
    const i = IMG[f.id + "-" + pose];
    return i && i.ok ? i : IMG[f.id + "-idle"];
  }

  // ---------- Pomocné ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
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
    pick: null,
  };

  function showMenu() {
    cancelAnimationFrame(S.raf);
    S.screen = "menu";
    S.game = null;
    S.focus = S.mode ? ["maty", "nela", "spolu"].indexOf(S.mode) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    screen.replaceChildren(el("div", "menu-bg dojo"));
    const t = el("div", "title", "Bojovka");
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
    screen.replaceChildren(el("div", "menu-bg dojo"), box);
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
    else showSelect();
  }

  // ---------- Výběr bojovníka ----------
  function showSelect() {
    const kids = S.mode === "spolu" ? ["maty", "nela"] : [S.mode];
    S.pick = { kids, step: 0, chosen: [] };
    S.screen = "select";
    renderSelect();
  }
  function renderSelect() {
    const p = S.pick;
    const who = p.kids[p.step];
    // výchozí: Maty žabák (zelený), Nela králíček (růžová)
    S.focus = who === "maty" ? 0 : 1;
    if (p.chosen.includes(S.focus)) S.focus = (S.focus + 1) % FIGHTERS.length;
    const box = el("div", "select");
    const head = el("div", "select-head");
    head.append(avatarEl(who), el("div", "select-title", "Vyber si bojovníka"));
    box.appendChild(head);
    const row = el("div", "select-row");
    FIGHTERS.forEach((f, i) => {
      const c = el(
        "div",
        "fighter-card" + (p.chosen.includes(i) ? " taken" : ""),
      );
      c.style.setProperty("--c", f.color);
      const img = document.createElement("img");
      img.src = "img/" + f.id + "-idle.png";
      c.append(img, el("div", "label", f.name));
      row.appendChild(c);
    });
    box.appendChild(row);
    screen.replaceChildren(el("div", "menu-bg dojo"), box);
    markSelect();
    sayCs((who === "maty" ? "Maty" : "Nelo") + ", vyber si bojovníka.");
  }
  function markSelect() {
    screen
      .querySelectorAll(".fighter-card")
      .forEach((c, i) => c.classList.toggle("focus", i === S.focus));
  }
  function selectKey(e) {
    if (e.type !== "down") return;
    const p = S.pick;
    // ve SPOLU vybírá jen ten, kdo je na řadě (jeho ovladač)
    if (
      S.mode === "spolu" &&
      S.pair &&
      e.device !== S.pair.devices[p.kids[p.step]]
    )
      return;
    if (e.name === "left" || e.name === "right") {
      const d = e.name === "left" ? -1 : 1;
      let f = S.focus;
      for (let k = 0; k < FIGHTERS.length; k++) {
        f = (f + d + FIGHTERS.length) % FIGHTERS.length;
        if (!p.chosen.includes(f)) break;
      }
      S.focus = f;
      TV.sound.move();
      markSelect();
      sayCs(FIGHTERS[f].name);
    } else if (e.name === "ok" || e.name === "action") {
      TV.sound.flip();
      p.chosen.push(S.focus);
      p.step++;
      if (p.step < p.kids.length) renderSelect();
      else startGame();
    }
  }

  // ---------- Souboj ----------
  function makeFighter(fi, who, side, cpu) {
    return {
      f: FIGHTERS[fi],
      who,
      cpu,
      x: side < 0 ? 560 : 1360,
      y: FLOOR,
      vx: 0,
      vy: 0,
      face: side < 0 ? 1 : -1,
      hp: 100,
      state: "idle",
      st: 0,
      wins: 0,
      onGround: true,
      cd: 0,
      shotCd: 0,
      inp: {
        left: false,
        right: false,
        up: false,
        down: false,
        ok: false,
        action: false,
      },
      ai: { t: 0, plan: "walk" },
    };
  }

  function startGame() {
    const p = S.pick;
    const g = {
      fighters: [],
      shots: [],
      fx: [],
      round: 1,
      phase: "intro",
      t: 0,
      devices: S.pair ? S.pair.devices : null,
    };
    g.fighters.push(makeFighter(p.chosen[0], p.kids[0], -1, false));
    if (p.kids.length > 1)
      g.fighters.push(makeFighter(p.chosen[1], p.kids[1], 1, false));
    else {
      // počítač si vezme jiného bojovníka
      let c;
      do c = Math.floor(Math.random() * FIGHTERS.length);
      while (c === p.chosen[0]);
      g.fighters.push(makeFighter(c, "cpu", 1, true));
    }
    // obtížnost počítače: u Matyho hodně mírná, u Nely střední
    g.cpuLevel = S.mode === "maty" ? 0 : 1;
    S.game = g;
    S.screen = "game";
    prewarm(g);
    startRound(g);
    last = 0;
    cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
  }
  function prewarm(g) {
    for (const a of g.fighters)
      for (const pose of POSES) {
        const i = IMG[a.f.id + "-" + pose];
        if (i && i.ok)
          sprite(i, (HEIGHT * i.naturalWidth) / i.naturalHeight, HEIGHT);
      }
    const bg = IMG.bg;
    if (bg && bg.ok) sprite(bg, 1920, 1080);
  }
  function startRound(g) {
    g.phase = "intro";
    g.t = 0;
    g.shots.length = 0;
    g.fighters.forEach((a, i) => {
      a.x = i === 0 ? 560 : 1360;
      a.y = FLOOR;
      a.vx = a.vy = 0;
      a.hp = 100;
      a.state = "idle";
      a.st = 0;
      a.face = i === 0 ? 1 : -1;
      a.cd = a.shotCd = 0;
      a.hitDone = false;
      for (const k in a.inp) a.inp[k] = false; // držené z minulého kola neplatí
    });
    g.roundT = ROUND_TIME;
    screen.replaceChildren(el("div", "count ready", "Kolo " + g.round));
    sayCs(
      ["", "Kolo jedna!", "Kolo dva!", "Kolo tři!"][g.round] || "Kolo tři!",
    );
    const round = g.round;
    setTimeout(() => {
      if (S.game !== g || g.round !== round || S.screen !== "game") return;
      screen.replaceChildren(el("div", "count", "Bojuj!"));
      TV.sound.go();
      sayCs("Bojuj!");
      g.phase = "fight";
      setTimeout(() => {
        if (S.game === g && g.phase === "fight") screen.replaceChildren();
      }, 800);
    }, 1900);
  }

  function fighterOf(e) {
    const g = S.game;
    const humans = g.fighters.filter((a) => !a.cpu);
    if (humans.length === 1) return humans[0];
    const d = g.devices || {};
    if (e.device === d.maty) return g.fighters[0];
    if (e.device === d.nela) return g.fighters[1];
    return null;
  }
  function gameKey(e) {
    const a = fighterOf(e);
    if (!a || !(e.name in a.inp)) return;
    const down = e.type !== "up";
    const was = a.inp[e.name];
    a.inp[e.name] = down;
    if (down && !was && S.game.phase === "fight") press(a, e.name, S.game);
  }

  /** Jednorázové akce při stisku tlačítka. */
  function press(a, name, g) {
    if (a.state === "hit" || a.state === "ko" || a.state === "win") return;
    if (name === "up" && a.onGround && !attacking(a)) {
      a.vy = -1500;
      a.onGround = false;
      a.state = "jump";
      TV.sound.move();
    } else if (name === "ok") attack(a, "punch");
    else if (name === "action") {
      if (a.inp.down && a.onGround && a.shotCd <= 0) special(a, g);
      else attack(a, "kick");
    }
  }
  const attacking = (a) => a.state === "punch" || a.state === "kick";
  function attack(a, kind) {
    if (attacking(a) || a.cd > 0) return;
    a.state = kind;
    a.st = 0;
    a.hitDone = false;
    a.cd = MOVES[kind].time + 0.05;
    TV.sound.pew();
  }
  function special(a, g) {
    a.state = "punch";
    a.st = 0;
    a.hitDone = true; // úder samotný nic, letí koule
    a.cd = 0.4;
    a.shotCd = 1.6;
    g.shots.push({
      x: a.x + a.face * 120,
      y: a.y - HEIGHT * 0.55,
      vx: a.face * 950,
      owner: a,
      t: 0,
    });
    TV.sound.whoosh();
  }

  function other(g, a) {
    return g.fighters[0] === a ? g.fighters[1] : g.fighters[0];
  }
  function dmgMul(g, attacker) {
    // proti počítači má dítě výhodu, počítač u Matyho skoro nebolí
    if (attacker.cpu) return g.cpuLevel === 0 ? 0.45 : 0.8;
    const foe = other(g, attacker);
    return foe.cpu ? (g.cpuLevel === 0 ? 1.4 : 1.1) : 1;
  }
  function hit(g, target, attacker, dmg, x, y) {
    if (g.phase !== "fight" || target.state === "ko") return;
    if (target.state === "block") {
      target.vx = Math.sign(target.x - attacker.x || 1) * 260;
      g.fx.push({ x, y, t: 0, text: null, block: true });
      TV.sound.nope();
      return;
    }
    target.hp = Math.max(0, target.hp - dmg * dmgMul(g, attacker));
    target.state = "hit";
    target.st = 0;
    target.vx = Math.sign(target.x - attacker.x || 1) * 520;
    if (!target.onGround) target.vy = -400;
    g.fx.push({ x, y, t: 0, text: Math.random() < 0.5 ? "BUM!" : "PÁC!" });
    TV.sound.bump();
    if (target.hp <= 0) ko(g, target, attacker);
  }
  function ko(g, loser, winner, text) {
    loser.state = "ko";
    loser.st = 0;
    winner.wins++;
    g.phase = "ko";
    g.t = 0;
    g.lastWinner = winner;
    TV.sound.boom(true);
    screen.replaceChildren(el("div", "count", text || "K.O.!"));
    sayCs(winner.f.won);
  }

  // ---------- Počítač ----------
  function cpuThink(g, a, dt) {
    const foe = other(g, a);
    const dist = Math.abs(foe.x - a.x);
    const ai = a.ai;
    ai.t -= dt;
    const inp = a.inp;
    inp.left = inp.right = inp.down = false;
    const toward = foe.x > a.x ? "right" : "left";
    const away = foe.x > a.x ? "left" : "right";
    const lvl = g.cpuLevel;
    if (ai.t <= 0) {
      ai.t = lvl === 0 ? rnd(0.6, 1.2) : rnd(0.35, 0.8);
      const r = Math.random();
      if (dist > 260)
        ai.plan =
          r < (lvl === 0 ? 0.25 : 0.12) ? "wait" : r < 0.9 ? "walk" : "shoot";
      else if (lvl === 1 && attacking(foe) && r < 0.35) ai.plan = "block";
      else if (r < (lvl === 0 ? 0.35 : 0.6))
        ai.plan = Math.random() < 0.5 ? "punch" : "kick";
      else if (r < 0.8) ai.plan = "back";
      else ai.plan = lvl === 1 && Math.random() < 0.3 ? "jump" : "wait";
    }
    if (a.state === "hit" || a.state === "ko") return;
    if (ai.plan === "walk") inp[toward] = true;
    else if (ai.plan === "back") inp[away] = true;
    else if (ai.plan === "block") inp.down = true;
    else if (ai.plan === "punch" || ai.plan === "kick") {
      if (dist > MOVES[ai.plan].reach - 20) inp[toward] = true;
      else {
        press(a, ai.plan === "punch" ? "ok" : "action", g);
        ai.plan = "wait";
      }
    } else if (ai.plan === "shoot") {
      if (lvl === 1 && a.shotCd <= 0) {
        inp.down = true;
        press(a, "action", g);
      }
      ai.plan = "walk";
    } else if (ai.plan === "jump") {
      press(a, "up", g);
      ai.plan = "walk";
    }
  }

  // ---------- Aktualizace ----------
  function update(dt) {
    const g = S.game;
    g.t += dt;
    for (const e of g.fx) e.t += dt;
    if (g.fx.length && g.fx[0].t > 0.6) g.fx.shift();

    for (const a of g.fighters) {
      a.st += dt;
      a.cd = Math.max(0, a.cd - dt);
      a.shotCd = Math.max(0, a.shotCd - dt);
      if (a.cpu && g.phase === "fight") cpuThink(g, a, dt);
      const foe = other(g, a);
      const free =
        g.phase === "fight" &&
        a.state !== "hit" &&
        a.state !== "ko" &&
        !attacking(a);

      // chůze, kryt
      let want = 0;
      if (free) {
        want = (a.inp.right ? 1 : 0) - (a.inp.left ? 1 : 0);
        if (a.onGround && a.inp.down) {
          want = 0;
          a.state = "block";
        } else if (a.state === "block") a.state = "idle";
        if (a.onGround && a.state !== "block") a.state = want ? "walk" : "idle";
        a.face = foe.x > a.x ? 1 : -1;
      }
      if (a.state === "hit" || a.state === "ko")
        a.vx *= 1 - Math.min(1, dt * 6);
      else if (a.onGround) a.vx = want * 430;
      else if (free) a.vx = want * 380;

      // útok: zásah jen v aktivní chvíli úderu / kopu
      if (attacking(a)) {
        const m = MOVES[a.state];
        if (!a.hitDone && a.st >= m.from && a.st <= m.to) {
          const dx = (foe.x - a.x) * a.face;
          const fy = a.y - HEIGHT * m.h;
          if (
            dx > 0 &&
            dx < m.reach &&
            Math.abs(foe.y - HEIGHT * 0.5 - fy) < HEIGHT * 0.55
          ) {
            a.hitDone = true;
            hit(g, foe, a, m.dmg, a.x + a.face * m.reach * 0.75, fy);
          }
        }
        if (a.st >= m.time) a.state = a.onGround ? "idle" : "jump";
      }
      if (a.state === "hit" && a.st > 0.35)
        a.state = a.onGround ? "idle" : "jump";

      // fyzika
      a.vy += G * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.y >= FLOOR) {
        a.y = FLOOR;
        a.vy = 0;
        if (!a.onGround && a.state === "jump") a.state = "idle";
        a.onGround = true;
      } else a.onGround = false;
      a.x = Math.max(130, Math.min(1790, a.x));
    }
    // nepřekrývat se
    const [p, q] = g.fighters;
    const gap = 240 - Math.abs(p.x - q.x);
    if (gap > 0 && Math.abs(p.y - q.y) < HEIGHT * 0.6) {
      const s = p.x < q.x ? -1 : 1;
      p.x += (s * gap) / 2;
      q.x -= (s * gap) / 2;
      // po odstrčení znovu hlídat stěny (jinak u kraje cuká napůl mimo obraz)
      for (const a of g.fighters) a.x = Math.max(130, Math.min(1790, a.x));
    }

    // čas kola
    if (g.phase === "fight") {
      g.roundT -= dt;
      if (g.roundT <= 0) {
        g.roundT = 0;
        const win = p.hp >= q.hp ? p : q;
        ko(g, win === p ? q : p, win, "Čas!");
      }
    }

    // kouzelné koule
    for (const s of g.shots) {
      s.t += dt;
      s.x += s.vx * dt;
      const foe = other(g, s.owner);
      if (
        !s.dead &&
        Math.abs(foe.x - s.x) < 90 &&
        Math.abs(foe.y - HEIGHT * 0.5 - s.y) < HEIGHT * 0.5
      ) {
        s.dead = true;
        if (g.phase === "fight") hit(g, foe, s.owner, 10, s.x, s.y);
      }
      if (s.x < -100 || s.x > 2020) s.dead = true;
    }
    if (g.shots.some((s) => s.dead)) g.shots = g.shots.filter((s) => !s.dead);

    if (g.phase === "ko") {
      if (g.t > 1.2 && g.lastWinner.state !== "win") {
        g.lastWinner.state = "win";
        g.lastWinner.st = 0;
      }
      if (g.t > 3) {
        if (g.lastWinner.wins >= 2) showEnd();
        else {
          g.round++;
          startRound(g);
        }
      }
    }
  }

  // ---------- Kreslení ----------
  function drawFighter(a, t) {
    let pose = a.state;
    if (pose === "walk") pose = Math.floor(a.st / 0.18) % 2 ? "walk" : "idle";
    const i = fighterImg(a.f, pose);
    let w = 220,
      h = HEIGHT;
    if (i && i.ok) w = (HEIGHT * i.naturalWidth) / i.naturalHeight;
    const bob = pose === "idle" ? 1 + Math.sin(t * 5) * 0.015 : 1;
    // stín
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(
      a.x,
      FLOOR + 8,
      110 * Math.max(0.5, 1 - (FLOOR - a.y) / 600),
      18,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(a.face, bob);
    if (a.state === "hit" && Math.floor(a.st * 20) % 2) ctx.globalAlpha = 0.6;
    if (i && i.ok) ctx.drawImage(sprite(i, w, h), -w / 2, -h, w, h);
    else {
      ctx.fillStyle = a.f.color;
      ctx.fillRect(-70, -h, 140, h);
    }
    ctx.restore();
  }

  function draw() {
    const g = S.game;
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    const bg = IMG.bg;
    if (bg && bg.ok) ctx.drawImage(sprite(bg, 1920, 1080), 0, 0, 1920, 1080);
    else {
      ctx.fillStyle = "#ffe3c2";
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = "#c98a4b";
      ctx.fillRect(0, FLOOR, 1920, 120);
    }
    // vzadu ten, kdo je v klidu, vepředu útočník
    const [p, q] = g.fighters;
    const order = attacking(p) || p.state === "hit" ? [q, p] : [p, q];
    for (const a of order) drawFighter(a, g.t);

    for (const s of g.shots) {
      const col = s.owner.f.shot;
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = 0.25 * k;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(s.x - s.vx * 0.03 * k, s.y, 34 - k * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 38 + Math.sin(s.t * 30) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    // BUM! hvězdy
    for (const e of g.fx) {
      const k = e.t / 0.6;
      ctx.globalAlpha = 1 - k;
      star(e.x, e.y, 40 + k * 50, e.block ? "#bfe6ff" : "#ffd23d");
      if (e.text) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#5a1e00";
        ctx.lineWidth = 10;
        ctx.font = '900 64px "Trebuchet MS", Roboto, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(e.text, e.x, e.y - 90 - k * 40);
        ctx.fillText(e.text, e.x, e.y - 90 - k * 40);
        ctx.textAlign = "left";
      }
      ctx.globalAlpha = 1;
    }
    drawHud(g);
  }
  function star(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      const rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  function drawHud(g) {
    // odpočet kola uprostřed
    if (g.roundT != null) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(10,16,50,.85)";
      ctx.lineWidth = 10;
      ctx.font = '900 84px "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const txt = String(Math.ceil(g.roundT));
      ctx.strokeText(txt, 960, 36);
      ctx.fillText(txt, 960, 36);
      ctx.textAlign = "left";
    }
    g.fighters.forEach((a, i) => {
      const left = i === 0;
      const bw = 640,
        bx = left ? 190 : 1920 - 190 - bw,
        by = 50;
      // ikona: dítě, nebo hlava bojovníka u počítače
      const ix = left ? 95 : 1825;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ix, 85, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(ix, 85, 56, 0, Math.PI * 2);
      ctx.clip();
      const av = a.cpu ? fighterImg(a.f, "idle") : AV[a.who];
      if (av && av.ok) {
        if (a.cpu)
          ctx.drawImage(
            av,
            ix - 70,
            30,
            140,
            (140 * av.naturalHeight) / av.naturalWidth,
          );
        else ctx.drawImage(sprite(av, 112, 112), ix - 56, 29, 112, 112);
      }
      ctx.restore();
      // zdraví
      ctx.fillStyle = "rgba(10,16,50,.6)";
      ctx.fillRect(bx - 6, by - 6, bw + 12, 56);
      ctx.fillStyle = "#e8463c";
      ctx.fillRect(bx, by, bw, 44);
      ctx.fillStyle = "#ffd23d";
      const w = (bw * a.hp) / 100;
      ctx.fillRect(left ? bx + bw - w : bx, by, w, 44);
      // jméno bojovníka a vyhraná kola
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(10,16,50,.8)";
      ctx.lineWidth = 8;
      ctx.font = '900 44px "Trebuchet MS", Roboto, sans-serif';
      ctx.textBaseline = "top";
      ctx.textAlign = left ? "left" : "right";
      const label = a.f.name.toUpperCase();
      ctx.strokeText(label, left ? bx : bx + bw, by + 58);
      ctx.fillText(label, left ? bx : bx + bw, by + 58);
      ctx.textAlign = "left";
      for (let k = 0; k < 2; k++) {
        const x = left ? bx + bw - 30 - k * 50 : bx + 30 + k * 50;
        star(x, by + 88, 22, k < a.wins ? "#ffd23d" : "rgba(255,255,255,.35)");
      }
    });
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

  // ---------- Konec ----------
  function showEnd() {
    const g = S.game;
    const w = g.lastWinner;
    S.screen = "end";
    S.endAt = performance.now();
    S.focus = 0;
    cancelAnimationFrame(S.raf);
    const kidWon = !w.cpu;
    if (kidWon) {
      TV.sound.win();
      TV.confetti(fx, 140);
    } else TV.sound.miss();
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", kidWon ? "Hurá!" : "Skoro!"));
    const row = el("div", "end-players");
    for (const a of g.fighters) {
      const col = el("div", "end-player" + (a === w ? " winner" : ""));
      const img = document.createElement("img");
      img.className = "end-fighter";
      img.src = "img/" + a.f.id + (a === w ? "-win" : "-ko") + ".png";
      col.append(
        img,
        el("div", "end-name", a.cpu ? a.f.name : TV.PLAYERS[a.who].name),
        el("div", "end-stars", "★".repeat(a.wins) || "-"),
      );
      row.appendChild(col);
    }
    box.appendChild(row);
    const btns = el("div", "end-buttons");
    btns.append(el("div", "btn focus", "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.replaceChildren(ov);
    const humans = g.fighters.filter((a) => !a.cpu);
    if (humans.length === 2)
      sayCs(
        w.who === "maty"
          ? "Vyhrál Maty! Oba jste byli skvělí!"
          : "Vyhrála Nela! Oba jste byli skvělí!",
      );
    else if (kidWon)
      sayCs(
        w.who === "maty"
          ? "Hurá, Maty! Vyhrál jsi!"
          : "Hurá, Nelo! Vyhrála jsi!",
      );
    else sayCs("Skoro! Zkus to znovu!");
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
        else showSelect();
      }
    } else if (S.screen === "pair") pairKey(e);
    else if (S.screen === "select") selectKey(e);
    else if (S.screen === "end" && performance.now() - S.endAt > 1800) {
      if (n === "left" || n === "right") {
        S.focus = 1 - S.focus;
        TV.sound.move();
        screen
          .querySelectorAll(".end .btn")
          .forEach((b, i) => b.classList.toggle("focus", i === S.focus));
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        if (S.focus === 0) {
          // znovu se stejnými bojovníky
          S.pick.step = S.pick.kids.length;
          startGame();
        } else showMenu();
      }
    }
  });

  TV.onPause(() => {
    if (S.game)
      for (const a of S.game.fighters) for (const k in a.inp) a.inp[k] = false;
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false;
    showMenu();
    return true;
  });

  window.BOJOVKA = S; // ladění v náhledu
  TV.ready(showMenu, Object.values(IMG).concat(Object.values(AV)), []);
})();
