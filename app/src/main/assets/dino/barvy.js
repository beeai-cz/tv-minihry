/* Barevný Dinosaurus: hra (index.js) zůstává beze změny, tady se jen přemaluje.
 * - plátno v plném rozlišení TV (původně 600×150 roztažené CSS, kreslené obrázky by byly rozmazané),
 * - hra sedí dole přes celou šířku, nad ní barevná krajina (img/bg.jpg),
 * - kreslený dinosaurus, kaktusy, ptakoještěr a mraky místo šedých pixelů,
 * - žádné noční přepínání barev (to dělalo z obrazovky negativ).
 * Hitboxy a rychlost se nemění, obrázky se kreslí do stejných rámečků jako původní sprity.
 * Když některý obrázek chybí, kreslí se původní sprite. */
(function () {
  "use strict";
  if (!window.Runner || !window.DinoParts) return;
  const { Trex, Obstacle, Cloud, HorizonLine } = window.DinoParts;

  // ---------- obrázky ----------
  const IMG = {};
  [
    "dino-run1",
    "dino-run2",
    "dino-jump",
    "dino-duck1",
    "dino-duck2",
    "dino-hit",
    "ptero-up",
    "ptero-down",
    "cactus-small",
    "cactus-large",
    "cloud",
  ].forEach((n) => {
    const i = new Image();
    i.onload = () => (i.ok = true);
    i.src = "img/" + n + ".png";
    IMG[n] = i;
  });

  // Poměr zadního bufferu plátna k jeho logické velikosti (600×150): plátno pak má
  // tolik pixelů, kolik zabírá na obrazovce, a obrázky jsou ostré.
  let RATIO = 1;
  // Předzmenšené kopie obrázků (zmenšení velkého PNG v každém snímku je na slabé TV drahé).
  // Každý obrázek má vlastní mapu s číselným klíčem (žádné skládání řetězců v každém snímku);
  // při změně RATIO se mapy vyprázdní.
  function sprite(name, w, h) {
    const i = IMG[name];
    if (!i || !i.ok) return null;
    const cache = i.cache || (i.cache = new Map());
    const key = h * 4096 + w;
    let c = cache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * RATIO));
      c.height = Math.max(1, Math.round(h * RATIO));
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      cache.set(key, c);
    }
    return c;
  }
  /** Obrázek o výšce h (logické px), dole na `bottom`, vodorovně na středu `cx`. */
  function put(ctx, name, cx, bottom, h) {
    const i = IMG[name];
    if (!i || !i.ok) return false;
    const w = Math.round((h * i.naturalWidth) / i.naturalHeight);
    const c = sprite(name, w, h);
    ctx.drawImage(c, cx - w / 2, bottom - h, w, h);
    return true;
  }

  // ---------- plátno v plném rozlišení ----------
  Runner.updateCanvasScaling = function (canvas, optW, optH) {
    const ctx = canvas.getContext("2d");
    const w = optW || Runner.defaultDimensions.WIDTH;
    const h = optH || Runner.defaultDimensions.HEIGHT;
    // strop 2: plné rozlišení 1920×480 by slabá TV v každém snímku nestíhala mazat a kreslit
    const r = Math.max(
      1,
      Math.min(2, (window.innerWidth / w) * (window.devicePixelRatio || 1)),
    );
    if (r !== RATIO) for (const n in IMG) if (IMG[n].cache) IMG[n].cache.clear();
    RATIO = r;
    canvas.width = Math.round(w * r);
    canvas.height = Math.round(h * r);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(r, 0, 0, r, 0, 0);
    return true;
  };

  // Hra přes celou šířku a dolním okrajem na spodku obrazovky (původně nahoře v 10 % výšky).
  Runner.prototype.setArcadeModeContainerScale = function () {
    const el = this.containerEl;
    const scale = window.innerWidth / this.dimensions.WIDTH;
    el.style.transition = "none";
    el.style.transform = "none";
    const top = el.getBoundingClientRect().top;
    const ty =
      (window.innerHeight - top - this.dimensions.HEIGHT * scale) / scale;
    el.style.transform = "scale(" + scale + ") translateY(" + ty + "px)";
  };

  // Žádný noční režim (negativ celé obrazovky by na barevné krajině vypadal divně).
  Runner.prototype.invert = function () {
    document.body.classList.remove(Runner.classes.INVERTED);
    this.invertTimer = 0;
    this.inverted = false;
  };

  // ---------- dinosaurus ----------
  const trexDraw = Trex.prototype.draw;
  Trex.prototype.draw = function (x, y) {
    const S = Trex.status;
    const ctx = this.canvasCtx;
    const bottom = this.yPos + this.config.HEIGHT;
    let name;
    if (this.status === S.CRASHED) name = "dino-hit";
    else if (this.ducking) name = x === 264 ? "dino-duck1" : "dino-duck2";
    else if (this.status === S.JUMPING) name = "dino-jump";
    else name = x === 132 ? "dino-run2" : "dino-run1";
    const duck = name === "dino-duck1" || name === "dino-duck2";
    // o kousek větší než rámeček hitboxu, ať je kreslený dinosaurus dobře vidět
    const ok = duck
      ? put(ctx, name, this.xPos + this.config.WIDTH_DUCK / 2 + 3, bottom + 1, 34)
      : put(ctx, name, this.xPos + this.config.WIDTH / 2, bottom + 1, 54);
    if (!ok) trexDraw.call(this, x, y);
  };

  // ---------- kaktusy a ptakoještěr ----------
  const obstacleDraw = Obstacle.prototype.draw;
  Obstacle.prototype.draw = function () {
    const t = this.typeConfig;
    const ctx = this.canvasCtx;
    const bottom = this.yPos + t.height + 1;
    let ok = true;
    if (t.type === "PTERODACTYL") {
      ok = put(
        ctx,
        this.currentFrame ? "ptero-down" : "ptero-up",
        this.xPos + t.width / 2,
        bottom + 4,
        46,
      );
    } else {
      const name = t.type === "CACTUS_LARGE" ? "cactus-large" : "cactus-small";
      const h = t.type === "CACTUS_LARGE" ? 56 : 40;
      for (let k = 0; k < this.size && ok; k++) {
        // ve skupině se kaktusy střídavě trochu liší výškou, ať nevypadají jako kopie
        ok = put(
          ctx,
          name,
          this.xPos + t.width * (k + 0.5),
          bottom,
          k % 2 ? h - 5 : h,
        );
      }
    }
    if (!ok) obstacleDraw.call(this);
  };

  // ---------- mraky ----------
  const cloudDraw = Cloud.prototype.draw;
  Cloud.prototype.draw = function () {
    if (!put(this.canvasCtx, "cloud", this.xPos + 23, this.yPos + 22, 26))
      cloudDraw.call(this);
  };

  // ---------- zem: písková cesta s oblázky, posouvá se spolu s hrou ----------
  const GROUND_Y = 138; // logická y, kde stojí nohy dinosaura (150 - BOTTOM_PAD - kousek)
  let groundTile = null,
    groundRatio = 0;
  function makeGround() {
    const W = HorizonLine.dimensions.WIDTH,
      H = 150 - GROUND_Y;
    const c = document.createElement("canvas");
    c.width = Math.round(W * RATIO);
    c.height = Math.round(H * RATIO);
    const g = c.getContext("2d");
    g.scale(RATIO, RATIO);
    g.fillStyle = "#efc46b";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#d9a44a";
    g.fillRect(0, 0, W, 1.6);
    // oblázky a stébla v pevném (opakovatelném) vzoru
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 70; k++) {
      const x = rnd() * W,
        y = 3 + rnd() * (H - 5);
      g.fillStyle = k % 3 ? "#c98f3e" : "#b07a33";
      g.beginPath();
      g.ellipse(x, y, 1 + rnd() * 1.6, 0.6 + rnd() * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "#5cb83a";
    g.lineWidth = 0.9;
    for (let k = 0; k < 24; k++) {
      const x = rnd() * W;
      g.beginPath();
      g.moveTo(x, 1.5);
      g.lineTo(x - 1.2, -2.2);
      g.moveTo(x + 1, 1.5);
      g.lineTo(x + 2.2, -2.6);
      g.stroke();
    }
    groundTile = c;
    groundRatio = RATIO;
  }
  /** Světlá podložka pod šedý text hry (skóre, GAME OVER), jinak na pestré krajině zaniká. */
  function pad(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }
  const gameOver = Runner.prototype.gameOver;
  Runner.prototype.gameOver = function () {
    // Smazat snímek: jinak by pod omámeným dinosaurem zůstala skákací póza z tohoto snímku
    // (šedé sprity měly stejný obrys, kreslené pózy ne). Zem, mraky a kaktusy znovu na místě.
    this.clearCanvas();
    this.horizon.update(0, this.currentSpeed, true);
    pad(this.canvasCtx, 180, 30, 240, 66);
    return gameOver.apply(this, arguments);
  };

  HorizonLine.prototype.draw = function () {
    // skóre vpravo nahoře (kreslí se v každém snímku až po zemi, podložka tedy leží pod ním)
    pad(this.canvasCtx, 436, 3, 162, 17);
    if (!groundTile || groundRatio !== RATIO) makeGround();
    const W = HorizonLine.dimensions.WIDTH,
      H = 150 - GROUND_Y;
    for (let k = 0; k < 2; k++)
      this.canvasCtx.drawImage(groundTile, this.xPos[k], GROUND_Y, W, H);
  };
})();
