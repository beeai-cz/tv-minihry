/* Tanec (inspirace: tančící hry SEGA Dreamcastu, „ukaž a zopakuj“ do rytmu).
 * Hraje veselá hudba. Papoušek předvede řadu pohybů (vlevo, vpravo, nahoru, dolů, tlesk = OK),
 * pak řekne „Teď ty!“ a zajíček (dítě) je zopakuje šipkami. Povedlo se = hvězdičky a delší řada.
 * Chyba nevadí: zajíček se zakymácí a papoušek řadu ukáže znovu. Maty: jen vlevo a vpravo,
 * krátké řady, pomaleji. SPOLU = dva zajíčci, každý opakuje sám za sebe. */
(function () {
  "use strict";

  const { pick } = KIT;
  const MOVES = ["left", "right", "up", "down", "clap"];
  const NAME = {
    left: "Vlevo!",
    right: "Vpravo!",
    up: "Nahoru!",
    down: "Dolů!",
    clap: "Tlesk!",
  };
  const ICON = { left: "◀", right: "▶", up: "▲", down: "▼", clap: "👏" };
  const COL = {
    left: "#4dd2ff",
    right: "#ff6b9a",
    up: "#7bdc65",
    down: "#ffd23d",
    clap: "#b68cff",
  };
  const RULES = {
    maty: {
      moves: ["left", "right"],
      lens: [1, 2, 2, 3, 3, 3, 4, 4],
      bpm: 90,
      step: 2,
    },
    nela: { moves: MOVES, lens: [2, 3, 3, 4, 4, 5, 5, 6], bpm: 105, step: 1 },
    spolu: {
      moves: ["left", "right", "up"],
      lens: [1, 2, 2, 3, 3, 4, 4],
      bpm: 95,
      step: 1,
    },
  };
  // hudba: akordy C G Am F, basa, buben, činel, melodie
  const CHORDS = [
    [261.6, 329.6, 392.0],
    [196.0, 246.9, 293.7],
    [220.0, 261.6, 329.6],
    [174.6, 220.0, 261.6],
  ];
  const MEL = [0, 1, 2, 1, 2, 0, 1, 2];
  const TONE = { left: 523, right: 659, up: 784, down: 392, clap: 0 };

  let bg = null;
  function paintBg() {
    bg = document.createElement("canvas");
    bg.width = 960;
    bg.height = 540;
    const c = bg.getContext("2d");
    c.scale(0.5, 0.5);
    const g = c.createLinearGradient(0, 0, 0, 1080);
    g.addColorStop(0, "#2a0f4f");
    g.addColorStop(1, "#5b1f7a");
    c.fillStyle = g;
    c.fillRect(0, 0, 1920, 1080);
    // pódium
    c.fillStyle = "#3b1460";
    c.beginPath();
    c.ellipse(960, 960, 1000, 200, 0, 0, Math.PI * 2);
    c.fill();
    for (let k = 0; k < 10; k++) {
      c.fillStyle = ["#ff6b9a", "#ffd23d", "#4dd2ff", "#7bdc65", "#b68cff"][
        k % 5
      ];
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(160 + k * 178, 980 + (k % 2) * 30, 60, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // opona
    c.fillStyle = "#b0203a";
    for (const s of [0, 1]) {
      c.beginPath();
      const x = s ? 1920 : 0,
        d = s ? -1 : 1;
      c.moveTo(x, 0);
      c.lineTo(x + d * 260, 0);
      c.quadraticCurveTo(x + d * 140, 500, x + d * 200, 1080);
      c.lineTo(x, 1080);
      c.fill();
    }
    c.fillRect(0, 0, 1920, 70);
  }

  function makeSeq(g) {
    const R = RULES[g.mode];
    const n = R.lens[Math.min(g.round, R.lens.length - 1)];
    const seq = [];
    for (let i = 0; i < n; i++) {
      let m;
      do m = pick(R.moves);
      while (i > 0 && m === seq[i - 1] && Math.random() < 0.6);
      seq.push(m);
    }
    return seq;
  }
  function startShow(g, again) {
    g.state = "show";
    g.showI = -1;
    g.showWait = 1; // dobu na první pohyb v dobách
    if (!again) {
      g.seq = makeSeq(g);
      for (const d of g.dancers) d.misses = 0;
    } else if (g.dancers.some((d) => (d.misses || 0) >= 2) && g.seq.length > 1) {
      // po dvou chybách kratší řada, ať se to vždycky podaří
      g.seq = g.seq.slice(0, g.seq.length - 1);
      for (const d of g.dancers) d.misses = 0;
    }
    for (const d of g.dancers) {
      d.pos = 0;
      d.done = false;
      d.wrong = 0;
    }
    if (!again && g.round === 0) KIT.sayCs("Dívej se na papouška!");
  }
  function onBeat(g) {
    const R = RULES[g.mode];
    const b = g.beatN++;
    // hudba
    const ch = CHORDS[Math.floor(b / 4) % 4];
    KIT.tone(ch[0] / 2, 0, 0.35, "triangle", 0.12);
    if (b % 2 === 0) KIT.noise(0, 0.12, 0.25, 150);
    else KIT.noise(0, 0.08, 0.12, 2500);
    KIT.tone(ch[MEL[b % 8]] * 2, 0, 0.18, "square", 0.025);
    g.pulse = 1;
    // ukázka papouška
    if (g.state === "show" && b % R.step === 0) {
      g.showWait--;
      if (g.showWait < 0) {
        g.showI++;
        if (g.showI < g.seq.length) {
          const m = g.seq[g.showI];
          g.parrot = { m, t: 0 };
          sfx(m);
          // povel nahlas jen z nahrávky (TTS by na TV zaostával za papouškem)
          if (TV.hasClip(NAME[m], "cs-CZ")) KIT.sayCs(NAME[m]);
        } else {
          g.state = "go";
          g.goT = 0;
          g.parrot = null;
          KIT.sayCs(g.spolu ? "Teď vy!" : "Teď ty!");
        }
      }
    }
  }
  function sfx(m) {
    if (m === "clap") {
      KIT.noise(0, 0.08, 0.35, 1800);
      KIT.noise(0.09, 0.08, 0.3, 1800);
    } else KIT.tone(TONE[m], 0, 0.2, "triangle", 0.12);
  }
  function input(g, d, m) {
    if (g.state !== "go" || d.done) return;
    d.pose = { m, t: 0 };
    sfx(m);
    if (g.seq[d.pos] === m) {
      d.pos++;
      if (d.pos >= g.seq.length) {
        d.done = true;
        KIT.addStars(d.p, g.seq.length);
        TV.sound.match();
        if (g.dancers.every((x) => x.done)) roundWon(g);
      }
    } else {
      d.wrong = 0.8;
      TV.sound.miss();
      d.pos = 0;
      d.misses = (d.misses || 0) + 1;
      if (!g.spolu || g.dancers.every((x) => x.done || x.wrong > 0)) {
        g.state = "oops";
        g.oopsT = 0;
        KIT.sayCs("Skoro! Zkus to znovu!");
      }
    }
  }
  function roundWon(g) {
    g.state = "good";
    g.goodT = 0;
    g.round++;
    TV.sound.win();
    TV.confetti(KIT.fx, 50);
    KIT.toast(pick(["Super!", "Paráda!", "Výborně!"]), 1200, "small");
    if (g.round >= RULES[g.mode].lens.length) {
      g.over = true;
      KIT.at(g, 1800, () => KIT.finish(g));
    }
  }

  function drawBunny(c, g, d, x, y, s) {
    const pose = d.pose && d.pose.t < 0.45 ? d.pose.m : "idle";
    let name = "bunny-idle",
      sy = 1,
      extra = null;
    if (pose === "left") name = "bunny-left";
    else if (pose === "right") name = "bunny-right";
    else if (pose === "up") name = "bunny-up";
    else if (pose === "down") sy = 0.78;
    else if (pose === "clap") {
      name = "bunny-up";
      extra = "clap";
    }
    const bob = Math.sin(g.beatPhase * Math.PI) * 10;
    const wob = d.wrong > 0 ? Math.sin(g.t * 30) * 0.15 : 0;
    c.save();
    c.translate(x, y);
    c.scale(1, sy);
    const img = KIT.img(name);
    const h = s,
      w = img ? (s * img.naturalWidth) / img.naturalHeight : s * 0.6;
    if (!KIT.draw(c, name, 0, -h / 2 - bob, w, h, false, wob)) {
      c.fillStyle = "#fff";
      c.beginPath();
      c.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    if (extra === "clap")
      for (let k = 0; k < 5; k++)
        KIT.text(
          c,
          "✦",
          x + Math.cos(k * 1.3 + g.t * 5) * 110,
          y - s * 1.05 + Math.sin(k * 1.3) * 40,
          40,
          "#ffd23d",
        );
    // kruh v barvě dítěte
    c.strokeStyle = d.p.color;
    c.lineWidth = 10;
    c.beginPath();
    c.ellipse(x, y + 8, s * 0.42, s * 0.09, 0, 0, Math.PI * 2);
    c.stroke();
  }

  KIT.game({
    title: "Tanec",
    res: 0.5,
    images: {
      "bunny-idle": "img/bunny-idle.png",
      "bunny-left": "img/bunny-left.png",
      "bunny-right": "img/bunny-right.png",
      "bunny-up": "img/bunny-up.png",
      parrot: "img/parrot.png",
      "parrot-point": "img/parrot-point.png",
      discoball: "img/discoball.png",
    },
    init: paintBg,
    start(g) {
      g.dancers = g.players.map((p) => ({
        p,
        pos: 0,
        done: false,
        wrong: 0,
        pose: null,
      }));
      g.round = 0;
      g.beatN = 0;
      g.beatT = 0;
      g.beatPhase = 0;
      g.pulse = 0;
      g.over = false;
      g.state = "wait";
      g.parrot = null;
    },
    go(g) {
      startShow(g);
    },
    key(g, p, e) {
      if (e.type !== "down") return;
      const m = {
        left: "left",
        right: "right",
        up: "up",
        down: "down",
        ok: "clap",
        action: "clap",
      }[e.name];
      if (!m) return;
      const d = g.dancers[p.idx];
      if (g.mode === "maty" && !RULES.maty.moves.includes(m)) return;
      input(g, d, m);
    },
    update(g, dt) {
      const R = RULES[g.mode];
      const T = 60 / R.bpm;
      g.beatT += dt;
      if (g.beatT >= T) {
        g.beatT -= T;
        if (g.phase === "play" && !g.over) onBeat(g);
      }
      g.beatPhase = g.beatT / T;
      g.pulse = Math.max(0, g.pulse - dt * 3);
      if (g.parrot) g.parrot.t += dt;
      for (const d of g.dancers) {
        if (d.pose) d.pose.t += dt;
        if (d.wrong > 0) d.wrong -= dt;
      }
      if (g.state === "oops") {
        g.oopsT += dt;
        if (g.oopsT > 1.4) startShow(g, true);
      } else if (g.state === "good" && !g.over) {
        g.goodT += dt;
        if (g.goodT > 1.8) startShow(g);
      } else if (g.state === "go") {
        g.goT += dt;
        // SPOLU: kdo je hotový, počká; když druhý dlouho nic, ukáže se znovu
        if (g.goT > 14) startShow(g, true);
      }
    },
    draw(g, c) {
      c.drawImage(bg, 0, 0, 1920, 1080);
      // světla do rytmu
      for (let k = 0; k < 5; k++) {
        c.fillStyle = ["#ff6b9a", "#ffd23d", "#4dd2ff", "#7bdc65", "#b68cff"][
          (k + g.beatN) % 5
        ];
        c.globalAlpha = 0.12 + g.pulse * 0.15;
        c.beginPath();
        c.moveTo(300 + k * 330, 70);
        c.lineTo(160 + k * 330, 1000);
        c.lineTo(440 + k * 330, 1000);
        c.fill();
      }
      c.globalAlpha = 1;
      KIT.draw(c, "discoball", 960, 150, 160, 0, false, g.t);
      // papoušek vlevo
      const pm = g.parrot && g.parrot.t < 0.5 ? g.parrot.m : null;
      const px = 380,
        py = 870;
      KIT.draw(
        c,
        pm ? "parrot-point" : "parrot",
        px + (pm === "left" ? -40 : pm === "right" ? 40 : 0),
        py - 170 - (pm === "up" ? 40 : 0) + (pm === "down" ? 30 : 0),
        300,
        0,
        pm === "left",
      );
      if (pm) KIT.text(c, ICON[pm], px, py - 420, 150, COL[pm]);
      // zajíčci
      const xs = g.dancers.length > 1 ? [1150, 1580] : [1350];
      g.dancers.forEach((d, i) => drawBunny(c, g, d, xs[i], 900, 420));
      // řada pohybů nahoře
      if (g.seq && g.state !== "wait") {
        const n = g.seq.length;
        g.seq.forEach((m, i) => {
          const x = 960 - (n - 1) * 70 + i * 140,
            y = 330;
          const shown = g.state !== "show" || i <= g.showI;
          if (!shown) return;
          c.fillStyle = "rgba(0,0,0,0.35)";
          KIT.roundRect(c, x - 58, y - 58, 116, 116, 24);
          c.fill();
          let done = 0;
          for (const d of g.dancers) if (d.pos > i || d.done) done++;
          c.lineWidth = 8;
          c.strokeStyle = done
            ? "#7bdc65"
            : g.state === "go" && g.dancers.some((d) => d.pos === i && !d.done)
              ? "#fff"
              : "rgba(255,255,255,0.3)";
          c.stroke();
          KIT.text(c, ICON[m], x, y + 4, 74, COL[m]);
        });
        if (g.state === "go")
          KIT.text(c, g.spolu ? "TEĎ VY!" : "TEĎ TY!", 960, 470, 70, "#fff");
      }
      KIT.drawStars(c, g);
    },
  });
})();
