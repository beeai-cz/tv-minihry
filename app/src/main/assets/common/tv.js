/* Společné pro všechny hry: scéna 1920x1080, ovládání, hlas, zvuky, konfety.
 * Na TV přicházejí klávesy z GameActivity přes window.tvKey(type, name, deviceId, isPad).
 * Na PC (vývoj v prohlížeči) to samé obstará klávesnice: šipky, Enter/mezerník = ok, X = B (action),
 * Esc/Backspace = zpět, WASD + F (ok) + G (action) jako druhý hráč. */
(function () {
  "use strict";

  const TV = {};
  window.TV = TV;

  // --- Scéna: hra se kreslí v pevných 1920x1080 a zmenší se na velikost obrazovky.
  TV.fitStage = function (stage) {
    const fit = () => {
      const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      stage.style.transform = "translate(-50%, -50%) scale(" + k + ")";
    };
    window.addEventListener("resize", fit);
    fit();
  };

  // --- Ovládání. Handler dostane {type:'down'|'repeat'|'up', name, player}.
  // player: 0 = první ovladač, který se ozval (dálkový ovladač nebo gamepad), 1 = druhý atd.
  const handlers = [];
  const deviceToPlayer = new Map();
  TV.onKey = (fn) => handlers.push(fn);
  TV.playerOf = (deviceId) => {
    if (!deviceToPlayer.has(deviceId))
      deviceToPlayer.set(deviceId, deviceToPlayer.size);
    return deviceToPlayer.get(deviceId);
  };
  function emit(type, name, deviceId, isPad) {
    const ev = {
      type,
      name,
      device: deviceId,
      player: TV.playerOf(deviceId),
      isPad: !!isPad,
    };
    unlockAudio();
    for (const h of handlers) h(ev);
  }
  window.tvKey = emit;

  let backHandler = null;
  TV.onBack = (fn) => {
    backHandler = fn;
  };
  // Vrací true, když hra zpět zpracovala (např. z hry do menu). false = zavřít aplikaci.
  window.tvBack = () => (backHandler ? !!backHandler() : false);

  let pauseHandler = null;
  TV.onPause = (fn) => {
    pauseHandler = fn;
  };
  window.tvPause = () => {
    if (pauseHandler) pauseHandler();
  };

  const PC_KEYS = {
    ArrowUp: ["up", 1],
    ArrowDown: ["down", 1],
    ArrowLeft: ["left", 1],
    ArrowRight: ["right", 1],
    Enter: ["ok", 1],
    " ": ["ok", 1],
    Escape: ["back", 1],
    Backspace: ["back", 1],
    w: ["up", 2],
    s: ["down", 2],
    a: ["left", 2],
    d: ["right", 2],
    f: ["ok", 2],
    // tlačítko B (action): X pro prvního, G pro druhého hráče
    x: ["action", 1],
    g: ["action", 2],
  };
  const isAndroid = typeof window.Android !== "undefined";
  if (!isAndroid) {
    window.addEventListener("keydown", (e) => {
      const m = PC_KEYS[e.key] || PC_KEYS[e.key.toLowerCase()];
      if (!m) return;
      e.preventDefault();
      if (m[0] === "back") {
        if (!e.repeat && !window.tvBack())
          console.log("[TV] zpět by zavřel aplikaci");
        return;
      }
      emit(e.repeat ? "repeat" : "down", m[0], m[1], false);
    });
    window.addEventListener("keyup", (e) => {
      const m = PC_KEYS[e.key] || PC_KEYS[e.key.toLowerCase()];
      if (m && m[0] !== "back") emit("up", m[0], m[1], false);
    });
  }

  // --- Hlas. Nejdřív předem nahraná hláška (common/voice, viz tools/voice_*.py): přehraje se hned
  // a vždy stejně. Jen co nahrané není, řekne Google TTS (na PC hlas prohlížeče).
  // TV.say("Připrav se!", "cs-CZ") nebo TV.say(["Hurá, Nelo! Jsi v cíli!", "Máš tři hvězdičky!"], "cs-CZ").
  let clip = null;
  let clipQueue = [];
  let sayTok = 0;
  const VOICE_BASE = "../common/";
  function playNext() {
    const item = clipQueue.shift();
    if (!item) {
      clip = null;
      return;
    }
    const file = window.VOICE && window.VOICE[item.lang + "|" + item.text];
    if (!file) {
      // Nenahraná věta: TTS, a zbytek fronty až po odhadnuté délce.
      ttsSay(item.text, item.lang);
      const tok = sayTok;
      setTimeout(() => {
        if (tok === sayTok) playNext();
      }, 400 + item.text.length * 70);
      return;
    }
    clip = new Audio(VOICE_BASE + file);
    clip.onended = playNext;
    clip.onerror = () => {
      ttsSay(item.text, item.lang);
      playNext();
    };
    clip.play().catch(() => {
      ttsSay(item.text, item.lang);
      playNext();
    });
  }
  TV.say = function (text, lang) {
    lang = lang || "en-US";
    if (clip) {
      clip.onended = null;
      clip.pause();
      clip = null;
    }
    sayTok++;
    clipQueue = (Array.isArray(text) ? text : [text]).map((t) => ({
      text: t,
      lang,
    }));
    playNext();
    return true;
  };
  // Má hláška nahrávku? (hry tak poznají, že nemusí čekat na TTS)
  TV.hasClip = (text, lang) =>
    !!(window.VOICE && window.VOICE[(lang || "en-US") + "|" + text]);

  function ttsSay(text, lang) {
    if (isAndroid) {
      try {
        return window.Android.speak(text, lang);
      } catch (e) {
        return false;
      }
    }
    if (!("speechSynthesis" in window)) return false;
    // Jen hlas správného jazyka: český hlas anglické slovo hláskuje písmeno po písmenu.
    const prefix = lang.slice(0, 2).toLowerCase();
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (!voice) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = lang.startsWith("en") ? 0.85 : 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  }

  // --- Zvuky syntetizované přes WebAudio (žádné soubory).
  let ctx = null;
  function unlockAudio() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  function tone(freq, start, dur, type, vol) {
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  TV.sound = {
    move() {
      tone(520, 0, 0.07, "triangle", 0.08);
    },
    flip() {
      tone(660, 0, 0.12, "triangle", 0.15);
      tone(880, 0.06, 0.12, "triangle", 0.12);
    },
    match() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, i * 0.09, 0.25, "triangle", 0.18),
      );
    },
    miss() {
      tone(392, 0, 0.18, "sine", 0.12);
      tone(330, 0.14, 0.25, "sine", 0.12);
    },
    win() {
      [523, 659, 784, 659, 784, 1047, 1047].forEach((f, i) =>
        tone(f, i * 0.13, 0.3, "square", 0.07),
      );
    },
    nope() {
      tone(220, 0, 0.1, "sine", 0.08);
    },
    beep() {
      tone(440, 0, 0.25, "square", 0.08);
    },
    go() {
      tone(880, 0, 0.5, "square", 0.1);
    },
    ding() {
      tone(1318, 0, 0.15, "triangle", 0.15);
      tone(1760, 0.07, 0.2, "triangle", 0.12);
    },
    // Vžuuum: šum přeladěný nahoru (turbo)
    whoosh() {
      if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * 0.9);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 3;
      const t0 = ctx.currentTime;
      bp.frequency.setValueAtTime(300, t0);
      bp.frequency.exponentialRampToValueAtTime(3000, t0 + 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
      src.connect(bp).connect(g).connect(ctx.destination);
      src.start(t0);
    },
    bump() {
      tone(160, 0, 0.25, "sawtooth", 0.1);
      tone(110, 0.1, 0.3, "sine", 0.12);
    },
    // Tiché „piu“ výstřelu (hraje často, proto potichu a krátce)
    pew() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(1400, t0);
      o.frequency.exponentialRampToValueAtTime(500, t0 + 0.08);
      g.gain.setValueAtTime(0.025, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.1);
    },
    // Bum: krátký šum přes dolní propust (šum se generuje jen jednou)
    boom(big) {
      if (!ctx) return;
      if (!noiseBuf) {
        const len = Math.floor(ctx.sampleRate * 0.8);
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = ctx.currentTime;
      const dur = big ? 0.75 : 0.3;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(big ? 1200 : 1800, t0);
      lp.frequency.exponentialRampToValueAtTime(120, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(big ? 0.35 : 0.16, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(lp).connect(g).connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    },
  };
  let noiseBuf = null;

  // --- Konfety do daného prvku (absolutně pozicovaný kontejner přes celou scénu).
  TV.confetti = function (layer, count) {
    const colors = [
      "#ffc83d",
      "#ff6b9a",
      "#4dd2ff",
      "#7bdc65",
      "#b68cff",
      "#ff8a3d",
    ];
    for (let i = 0; i < (count || 80); i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.left = Math.random() * 1920 + "px";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      layer.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  };

  // Česká čísla slovy pro hlas: TTS čte "23" jako "dvacetitři", děti se mají učit "dvacet tři".
  // TV.csCount(23, ['hvězdičku', 'hvězdičky', 'hvězdiček']) -> "dvacet tři hvězdiček".
  // Tvary: [1 (akuzativ ženský), 2-4, 5+ a 0]. Rod jedničky a dvojky je ženský (jednu, dvě).
  const CS_UNITS = [
    "nula",
    "jednu",
    "dvě",
    "tři",
    "čtyři",
    "pět",
    "šest",
    "sedm",
    "osm",
    "devět",
    "deset",
    "jedenáct",
    "dvanáct",
    "třináct",
    "čtrnáct",
    "patnáct",
    "šestnáct",
    "sedmnáct",
    "osmnáct",
    "devatenáct",
  ];
  const CS_TENS = [
    "",
    "",
    "dvacet",
    "třicet",
    "čtyřicet",
    "padesát",
    "šedesát",
    "sedmdesát",
    "osmdesát",
    "devadesát",
  ];
  TV.csNumber = function (n) {
    n = Math.max(0, Math.floor(n));
    if (n < 20) return CS_UNITS[n];
    if (n < 100) {
      const u = n % 10;
      // ve složeném čísle se říká "dvacet jedna", ne "dvacet jednu"
      return (
        CS_TENS[Math.floor(n / 10)] +
        (u ? " " + (u === 1 ? "jedna" : CS_UNITS[u]) : "")
      );
    }
    if (n < 200) {
      const r = n - 100;
      return "sto" + (r === 0 ? "" : r === 1 ? " jedna" : " " + TV.csNumber(r));
    }
    return String(n);
  };
  TV.csCount = function (n, forms) {
    if (n === 0) return "žádnou " + forms[0];
    const form = n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2];
    return TV.csNumber(n) + " " + form;
  };

  // --- Načítání: hra se spustí, až je připravený hlas (Android.isReady) a obrázky.
  // TV.ready(start, [Image, ...], ['cs-CZ', 'en-US']) ukáže NAČÍTÁM HRU… aspoň 1,5 s, nejvýš 35 s.
  // Studený hlasový engine Google potřebuje na TV na první větu i ~20 s, pak už je rychlý.
  TV.ready = function (start, images, langs) {
    langs = langs || ["cs-CZ"];
    const stage = document.getElementById("stage");
    const box = document.createElement("div");
    box.className = "loading";
    const kids = document.createElement("div");
    kids.className = "loading-kids";
    kids.append(
      TV.picture(TV.PLAYERS.maty.avatar, TV.PLAYERS.maty.emoji, "avatar pic"),
      TV.picture(TV.PLAYERS.nela.avatar, TV.PLAYERS.nela.emoji, "avatar pic"),
    );
    const title = document.createElement("div");
    title.className = "loading-title";
    title.textContent = "Načítám hru…";
    const bar = document.createElement("div");
    bar.className = "loading-bar";
    const fill = document.createElement("div");
    bar.appendChild(fill);
    box.append(kids, title, bar);
    stage.appendChild(box);

    const t0 = Date.now();
    const imgsDone = () => (images || []).every((i) => i.complete);
    const voiceDone = () => {
      if (!isAndroid || !langs.length) return true;
      try {
        return !!window.Android.isReady(langs.join(","));
      } catch (e) {
        return true;
      }
    };
    const tick = () => {
      const el = Date.now() - t0;
      const done = (voiceDone() && imgsDone() && el > 1500) || el > 35000;
      if (el > 4000 && !done) title.textContent = "Probouzím hlas…";
      fill.style.width = (done ? 100 : Math.min(95, 5 + el / 260)) + "%";
      if (!done) {
        setTimeout(tick, 150);
        return;
      }
      console.log("NACTENO za " + el + " ms (hlas " + voiceDone() + ")");
      setTimeout(() => {
        box.remove();
        start();
      }, 250);
    };
    tick();
  };

  TV.shuffle = function (a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  TV.PLAYERS = {
    maty: {
      name: "Maty",
      voc: "Maty", // 5. pád (oslovení)
      avatar: "../common/img/avatar-maty.png",
      color: "#5cc93b",
      emoji: "👦",
    },
    nela: {
      name: "Nela",
      voc: "Nelo", // 5. pád (oslovení)
      avatar: "../common/img/avatar-nela.png",
      color: "#ff6b9a",
      emoji: "👧",
    },
  };

  // Obrázek s náhradou za emoji, dokud obrázky z Higgsfieldu nejsou.
  TV.picture = function (src, emoji, cls) {
    const box = document.createElement("div");
    box.className = cls || "pic";
    const img = new Image();
    img.alt = "";
    img.onerror = () => {
      img.remove();
      const s = document.createElement("span");
      s.className = "emoji";
      s.textContent = emoji;
      box.appendChild(s);
    };
    img.src = src;
    box.appendChild(img);
    return box;
  };
})();
