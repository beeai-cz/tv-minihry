/* Brusle (inspirace: závodní a sportovní hry SEGA 90. let, pohled z boku).
 * Varianty: Park a Dráha (inline brusle), Lyže, Snowboard, Plavání. Jede se samo, šipka vpravo
 * zrychlí, vlevo zpomalí, OK / B = skok (ve vodě výskok). Hvězdy ve vzduchu se sbírají skokem,
 * překážka jen zbrzdí (Hups!), na můstku se vyletí vysoko a ve vzduchu jde OK = otočka za hvězdy.
 * Do cíle se vždy dojede. SPOLU = dvě dráhy nad sebou, kdo dřív v cíli. */
(function () {
  "use strict";

  const { rnd, pick, clamp } = KIT;
  const LEN = { maty: 16000, nela: 24000 };
  const SPEED = { maty: 330, nela: 420 };
  const GRAV = { maty: 2000, nela: 2400 };
  const VARIANTS = {
    park: {
      label: "Park",
      sprite: "inline",
      obst: ["cone", "puddle", "bush"],
      bg: "../skakacka/img/bg.jpg",
    },
    draha: {
      label: "Dráha",
      sprite: "inline",
      obst: ["cone", "hurdle"],
      bg: null,
    },
    lyze: {
      label: "Lyže",
      sprite: "ski",
      obst: ["snowman", "mogul"],
      bg: "../skakacka/img/bg-winter.jpg",
    },
    snowboard: {
      label: "Snowboard",
      sprite: "snow",
      obst: ["snowman", "mogul"],
      bg: "../skakacka/img/bg-winter.jpg",
    },
    plavani: {
      label: "Plavání",
      sprite: "swim",
      obst: ["duck", "ring"],
      bg: null,
    },
  };
  const SAY = {
    park: "Park!",
    draha: "Dráha!",
    lyze: "Lyže!",
    snowboard: "Snowboard!",
    plavani: "Plavání!",
  };

  // ---------- pozadí (náhledy i hra) ----------
  function paintScene(c, w, h, v) {
    c.save();
    c.scale(w / 1920, h / 1080);
    const bgi = VARIANTS[v].bg && KIT.img("bg-" + v);
    if (bgi) c.drawImage(bgi, 0, 0, 1920, 1080);
    else if (v === "draha") {
      const g = c.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, "#7cc8ff");
      g.addColorStop(0.6, "#d9f0ff");
      c.fillStyle = g;
      c.fillRect(0, 0, 1920, 1080);
      // tribuna s diváky
      c.fillStyle = "#4a5d8a";
      c.fillRect(0, 380, 1920, 330);
      const cols = [
        "#ff6b9a",
        "#ffd23d",
        "#5cc93b",
        "#4dd2ff",
        "#fff",
        "#ff8a3d",
      ];
      for (let r = 0; r < 6; r++)
        for (let k = 0; k < 64; k++) {
          c.fillStyle = cols[(k * 7 + r * 3) % cols.length];
          c.beginPath();
          c.arc(15 + k * 30 + (r % 2) * 15, 410 + r * 50, 11, 0, Math.PI * 2);
          c.fill();
        }
      c.fillStyle = "#e14b3b";
      c.fillRect(0, 700, 1920, 30);
    } else {
      // plavání: venkovní bazén u moře
      const g = c.createLinearGradient(0, 0, 0, 1080);
      g.addColorStop(0, "#6fd0ff");
      g.addColorStop(0.45, "#c8f0ff");
      c.fillStyle = g;
      c.fillRect(0, 0, 1920, 1080);
      c.fillStyle = "#2e9be0";
      c.fillRect(0, 430, 1920, 120);
      c.fillStyle = "#f5deb0";
      c.fillRect(0, 550, 1920, 90);
      for (let k = 0; k < 8; k++) {
        const x = 120 + k * 250;
        c.fillStyle = "#8a5a2b";
        c.fillRect(x, 470, 10, 130);
        c.fillStyle = ["#ff6b9a", "#ffd23d", "#4dd2ff"][k % 3];
        c.beginPath();
        c.arc(x + 5, 470, 70, Math.PI, 0);
        c.fill();
      }
    }
    c.restore();
  }

  // ---------- dráha jednoho dítěte ----------
  function makeLane(p, v) {
    const L = {
      p,
      who: p.who,
      x: 0,
      y: 0,
      vy: 0,
      air: false,
      speed: SPEED[p.who],
      stumble: 0,
      spin: 0,
      spins: 0,
      done: false,
      place: 0,
      objs: [],
      t: 0,
    };
    // překážky a hvězdy po celé délce, na začátku volno
    const len = LEN[p.who];
    let x = 900;
    const ob = VARIANTS[v].obst;
    const gap = p.who === "maty" ? [900, 1400] : [650, 1100];
    while (x < len - 600) {
      const r = Math.random();
      if (r < 0.5) L.objs.push({ x, type: pick(ob) });
      else if (r < 0.68 && v !== "plavani" && v !== "draha")
        L.objs.push({ x, type: "ramp" });
      else if (r < 0.68 && v === "draha") L.objs.push({ x, type: "ramp" });
      // hvězdy: řada při zemi nebo oblouk nad překážkou
      if (Math.random() < 0.75) {
        const high = L.objs.length && L.objs[L.objs.length - 1].x === x;
        for (let k = 0; k < 3; k++)
          L.objs.push({
            x: x + (k - 1) * 90 + (high ? 0 : 400),
            type: "star",
            h: high ? 230 + (k === 1 ? 50 : 0) : 70,
          });
      }
      x += rnd(gap[0], gap[1]);
    }
    L.objs.push({ x: len, type: "finish" });
    L.len = len;
    return L;
  }

  function jump(L, power) {
    if (L.air) return false;
    L.air = true;
    L.vy = -(power || (L.who === "maty" ? 980 : 1050));
    TV.sound.move();
    return true;
  }

  function updateLane(g, L, dt) {
    if (L.done) {
      L.speed = Math.max(0, L.speed - 300 * dt);
      L.x += L.speed * dt;
      return;
    }
    const h = L.p.held;
    let sp = SPEED[L.who] * (h.right ? 1.4 : h.left ? 0.65 : 1);
    if (L.stumble > 0) {
      L.stumble -= dt;
      sp *= 0.35;
    }
    L.speed += (sp - L.speed) * Math.min(1, dt * 3);
    L.x += L.speed * dt;
    L.t += dt;
    if (L.air) {
      L.vy += GRAV[L.who] * dt;
      L.y += L.vy * dt;
      if (L.spin > 0) {
        L.spin -= dt * 2.4;
        if (L.spin <= 0) {
          L.spin = 0;
          L.spins++;
          KIT.addStars(L.p, 2);
          TV.sound.ding();
        }
      }
      if (L.y >= 0) {
        L.y = 0;
        L.vy = 0;
        L.air = false;
        if (L.spin > 0) {
          // přistál uprostřed otočky: nevadí, jen se dotočí
          L.spin = 0;
        }
      }
    }
    const px = L.x + 60; // přední hrana postavy
    for (const o of L.objs) {
      if (o.gone || o.x > px + 60 || o.x < L.x - 200) continue;
      if (o.type === "star") {
        const sy = -o.h;
        if (Math.abs(o.x - L.x) < 70 && Math.abs(sy - (L.y - 80)) < 110) {
          o.gone = true;
          KIT.addStars(L.p, 1);
          TV.sound.ding();
        }
      } else if (o.type === "finish") {
        if (L.x >= o.x) finishLane(g, L);
      } else if (o.type === "ramp") {
        if (!o.used && Math.abs(o.x - L.x) < 60 && !L.air) {
          o.used = true;
          jump(L, 1350);
          TV.sound.whoosh();
        }
      } else if (o.type === "ring") {
        // kruh na vodě: proplavat = hvězda
        if (!o.used && Math.abs(o.x - L.x) < 50) {
          o.used = true;
          if (!L.air) {
            KIT.addStars(L.p, 1);
            TV.sound.flip();
          }
        }
      } else if (!o.hit && Math.abs(o.x - L.x) < 55 && L.y > -70) {
        o.hit = true;
        L.stumble = L.who === "maty" ? 0.5 : 0.8;
        TV.sound.bump();
        if (g.t - (L.saidHups || -9) > 4) {
          L.saidHups = g.t;
          KIT.sayCs("Hups!");
        }
      }
    }
  }
  function finishLane(g, L) {
    L.done = true;
    g.places++;
    L.place = g.places;
    KIT.addStars(L.p, 5);
    TV.sound.match();
    if (g.lanes.length > 1)
      KIT.sayCs(L.who === "maty" ? "Hurá, Maty! Jsi v cíli!" : "Hurá, Nelo! Jsi v cíli!");
    if (g.lanes.every((x) => x.done))
      KIT.at(g, 1800, () =>
        KIT.finish(
          g,
          g.lanes.length > 1
            ? { say: "Hurá! Oba jste to zvládli!" }
            : undefined,
        ),
      );
  }

  // ---------- kreslení ----------
  const GROUND = {
    park: ["#9aa3ad", "#6cc04a"],
    draha: ["#d0533f", "#3f8fe0"],
    lyze: ["#ffffff", "#dbeeff"],
    snowboard: ["#ffffff", "#dbeeff"],
    plavani: ["#3fb4ef", "#1f86c9"],
  };
  function drawLane(c, g, L, y0, h, k) {
    const v = g.variant;
    const gy = y0 + h - 150 * k; // zem (spodek postavy)
    const camX = L.x - 420 / 1; // postava 420 px od levého kraje
    c.save();
    c.beginPath();
    c.rect(0, y0, 1920, h);
    c.clip();
    // pozadí s pomalým posunem
    const bg = g.bgc;
    const off = (camX * 0.15) % 1920;
    const sy = h < 1080 ? 1080 - h * 1.6 : 0;
    c.drawImage(
      bg,
      0,
      Math.max(0, sy) / 2,
      960,
      Math.min(540, (h * 1.6) / 2),
      -off,
      y0,
      1920,
      h,
    );
    c.drawImage(
      bg,
      0,
      Math.max(0, sy) / 2,
      960,
      Math.min(540, (h * 1.6) / 2),
      1920 - off,
      y0,
      1920,
      h,
    );
    // zem
    const [g1, g2] = GROUND[v];
    c.fillStyle = g2;
    c.fillRect(0, gy, 1920, y0 + h - gy);
    c.fillStyle = g1;
    c.fillRect(0, gy - 10 * k, 1920, 70 * k);
    if (v === "draha" || v === "park") {
      c.fillStyle = "rgba(255,255,255,0.8)";
      const step = 160;
      for (let x = -(((camX % step) + step) % step); x < 1920; x += step)
        c.fillRect(x, gy + 22 * k, 70, 7 * k);
    }
    if (v === "plavani") {
      // plovoucí lano dráhy
      const step = 60;
      for (let x = -(((camX % step) + step) % step); x < 1920; x += step) {
        c.fillStyle = Math.floor((x + camX) / step) % 2 ? "#ff4d5e" : "#fff";
        c.beginPath();
        c.arc(x, gy + 50 * k, 14 * k, 0, Math.PI * 2);
        c.fill();
      }
    }
    // objekty
    for (const o of L.objs) {
      const sx = o.x - camX;
      if (sx < -200 || sx > 2100 || o.gone) continue;
      drawObj(c, g, o, sx, gy, k);
    }
    // postava
    const name = VARIANTS[v].sprite + "-" + L.who;
    const bob = L.air ? 0 : Math.sin(L.t * (v === "plavani" ? 6 : 9)) * 6 * k;
    const rot =
      L.spin > 0
        ? (1 - L.spin) * Math.PI * 2
        : L.stumble > 0
          ? Math.sin(L.t * 30) * 0.2
          : v === "plavani"
            ? Math.sin(L.t * 6) * 0.06
            : 0;
    const ch = (v === "plavani" ? 120 : 210) * k;
    const cx = 420,
      cy = gy + L.y * k - ch / 2 + bob + (v === "plavani" ? 30 * k : 0);
    // stín
    if (v !== "plavani") {
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.beginPath();
      c.ellipse(
        cx,
        gy + 4,
        70 * k * (1 + L.y / 900),
        14 * k,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    const img = KIT.img(name);
    const w = img ? (ch * img.naturalWidth) / img.naturalHeight : ch * 0.6;
    if (!KIT.draw(c, name, cx, cy, w, ch, false, rot)) {
      KIT.drawAvatar(c, L.who, cx, cy, 60 * k);
    }
    // vlnky kolem plavce
    if (v === "plavani") {
      c.strokeStyle = "rgba(255,255,255,0.8)";
      c.lineWidth = 4;
      for (let s = 0; s < 3; s++) {
        c.beginPath();
        c.arc(
          cx - 90 * k - s * 40 * k,
          gy + 10 * k,
          18 * k,
          Math.PI * 1.1,
          Math.PI * 1.9,
        );
        c.stroke();
      }
    }
    // ukazatel vzdálenosti nahoře v dráze
    const bx = 600,
      bw = 720,
      by = y0 + 28 * (h < 1080 ? 1 : 2.6);
    c.fillStyle = "rgba(0,0,0,0.35)";
    KIT.roundRect(c, bx, by - 14, bw, 28, 14);
    c.fill();
    c.fillStyle = L.p.color;
    KIT.roundRect(c, bx, by - 14, bw * clamp(L.x / L.len, 0, 1), 28, 14);
    c.fill();
    KIT.drawAvatar(c, L.who, bx + bw * clamp(L.x / L.len, 0, 1), by, 26);
    KIT.text(c, "🏁", bx + bw + 40, by, 40);
    if (L.done)
      KIT.text(
        c,
        "CÍL!",
        960,
        y0 + h * 0.42,
        110 * k,
        "#ffd23d",
      );
    c.restore();
  }
  function drawObj(c, g, o, x, gy, k) {
    const t = o.type;
    if (t === "star") {
      const y = gy - o.h * k - 40 * k + Math.sin(g.t * 4 + o.x) * 6;
      if (!KIT.draw(c, "star", x, y, 64 * k))
        KIT.text(c, "★", x, y, 64 * k, "#ffd23d");
      return;
    }
    if (t === "finish") {
      for (let r = 0; r < 12; r++)
        for (let q = 0; q < 2; q++) {
          c.fillStyle = (r + q) % 2 ? "#222" : "#fff";
          c.fillRect(x + q * 22, gy - 360 * k + r * 30 * k, 22, 30 * k);
        }
      return;
    }
    if (t === "ramp") {
      c.fillStyle =
        g.variant === "lyze" || g.variant === "snowboard"
          ? "#cfe6ff"
          : "#ff8a3d";
      c.beginPath();
      c.moveTo(x - 110 * k, gy);
      c.lineTo(x + 40 * k, gy - 90 * k);
      c.lineTo(x + 40 * k, gy);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.3)";
      c.lineWidth = 4;
      c.stroke();
      return;
    }
    if (t === "mogul") {
      c.fillStyle = "#f4fbff";
      c.beginPath();
      c.ellipse(x, gy, 90 * k, 45 * k, 0, Math.PI, 0);
      c.fill();
      c.strokeStyle = "#b9d6ef";
      c.lineWidth = 4;
      c.stroke();
      return;
    }
    if (t === "hurdle") {
      c.fillStyle = "#fff";
      c.fillRect(x - 40 * k, gy - 80 * k, 8, 80 * k);
      c.fillRect(x + 32 * k, gy - 80 * k, 8, 80 * k);
      c.fillStyle = "#e14b3b";
      c.fillRect(x - 46 * k, gy - 90 * k, 92 * k, 18 * k);
      return;
    }
    if (t === "ring") {
      c.lineWidth = 16 * k;
      c.strokeStyle = o.used ? "rgba(255,255,255,0.5)" : "#ff6b9a";
      c.beginPath();
      c.ellipse(x, gy + 20 * k, 50 * k, 22 * k, 0, 0, Math.PI * 2);
      c.stroke();
      return;
    }
    if (t === "duck") {
      // gumová kachnička
      const y = gy + Math.sin(g.t * 3 + o.x) * 5;
      c.fillStyle = "#ffd23d";
      c.beginPath();
      c.ellipse(x, y, 52 * k, 32 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(x + 30 * k, y - 38 * k, 26 * k, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#ff8a3d";
      c.beginPath();
      c.ellipse(x + 58 * k, y - 34 * k, 14 * k, 7 * k, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#222";
      c.beginPath();
      c.arc(x + 36 * k, y - 44 * k, 4 * k, 0, Math.PI * 2);
      c.fill();
      return;
    }
    const size = { cone: 90, puddle: 150, bush: 120, snowman: 150 }[t] || 100;
    const img = KIT.img(t);
    const hgt = img
      ? (size * k * img.naturalHeight) / img.naturalWidth
      : size * k;
    if (
      !KIT.draw(
        c,
        t,
        x,
        gy - hgt / 2 + (t === "puddle" ? hgt * 0.4 : 4),
        size * k,
      )
    ) {
      c.fillStyle = "#ff8a3d";
      c.beginPath();
      c.moveTo(x - 30 * k, gy);
      c.lineTo(x, gy - 80 * k);
      c.lineTo(x + 30 * k, gy);
      c.fill();
    }
  }

  const images = {
    star: "../zavody/img/star.png",
    cone: "img/cone.png",
    puddle: "../zavody/img/puddle.png",
    bush: "../zavody/img/bush.png",
    snowman: "../zavody/img/snowman.png",
  };
  for (const s of ["inline", "ski", "snow", "swim"])
    for (const w of ["maty", "nela"])
      images[s + "-" + w] = "img/" + s + "-" + w + ".png";
  for (const v in VARIANTS)
    if (VARIANTS[v].bg) images["bg-" + v] = VARIANTS[v].bg;

  KIT.game({
    title: "Brusle",
    res: 0.5,
    images,
    variantTitle: "Na čem pojedeme?",
    variantSay: "Na čem pojedeme?",
    variants: Object.keys(VARIANTS).map((id) => ({
      id,
      label: VARIANTS[id].label,
      say: SAY[id],
      paint: (c, w, h) => {
        paintScene(c, w, h, id);
        const img = KIT.img(VARIANTS[id].sprite + "-nela");
        if (img) {
          const ih = h * 0.62;
          c.drawImage(
            img,
            w / 2 - (ih * img.naturalWidth) / img.naturalHeight / 2,
            h - ih - 8,
            (ih * img.naturalWidth) / img.naturalHeight,
            ih,
          );
        }
      },
    })),
    start(g) {
      const v = g.variant;
      if (!g.bgc || g.bgv !== v) {
        g.bgc = document.createElement("canvas");
        g.bgc.width = 960;
        g.bgc.height = 540;
        paintScene(g.bgc.getContext("2d"), 960, 540, v);
        g.bgv = v;
      }
      g.lanes = g.players.map((p) => makeLane(p, v));
      g.places = 0;
    },
    go(g) {
      KIT.sayCs(g.variant === "plavani" ? "Plav!" : "Jeď!");
    },
    key(g, p, e) {
      const L = g.lanes[p.idx];
      if (
        (e.name === "ok" || e.name === "action" || e.name === "up") &&
        e.type === "down" &&
        !L.done
      ) {
        if (!jump(L) && L.vy < 200 && L.spin === 0 && L.y < -120) {
          // ve vzduchu: otočka
          L.spin = 1;
          TV.sound.whoosh();
        }
      }
    },
    update(g, dt) {
      if (g.phase !== "play") return;
      for (const L of g.lanes) updateLane(g, L, dt);
    },
    draw(g, c) {
      if (g.lanes.length === 1) drawLane(c, g, g.lanes[0], 0, 1080, 1);
      else {
        drawLane(c, g, g.lanes[0], 0, 540, 0.62);
        drawLane(c, g, g.lanes[1], 540, 540, 0.62);
        c.fillStyle = "#fff";
        c.fillRect(0, 536, 1920, 8);
      }
      KIT.drawStars(c, g);
    },
  });
})();
