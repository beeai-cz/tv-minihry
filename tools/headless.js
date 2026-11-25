/* Zkouška hry bez prohlížeče: falešné DOM/plátno, hra běží po snímcích a skript mačká klávesy.
 * Odhalí výjimky a zacyklení (každý snímek má časový limit).
 * Použití: node tools/headless.js <hra> <režim maty|nela|spolu> [sekund] [skript.js]
 * Skript dostane (S, key, step) a může hrát: key('down','right',1), step(sekund). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const [, , game, mode = "maty", secs = "60", script] = process.argv;
const ASSETS = path.join(__dirname, "../app/src/main/assets");

const noop = () => ctxProxy;
const ctxProxy = new Proxy(function () {}, {
  get(t, k) {
    if (k === "measureText") return () => ({ width: 10 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
    if (k === Symbol.toPrimitive) return () => 0;
    return noop;
  },
  set() {
    return true;
  },
  apply() {
    return ctxProxy;
  },
});
function el(tag) {
  const e = {
    tagName: tag,
    style: {},
    dataset: {},
    children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    append(...c) {
      this.children.push(...c);
    },
    replaceChildren(...c) {
      this.children = c;
    },
    remove() {},
    querySelectorAll: () => [],
    addEventListener() {},
    getContext: () => ctxProxy,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      width: 1920,
      height: 1080,
    }),
    width: 0,
    height: 0,
    textContent: "",
  };
  Object.defineProperty(e, "firstChild", { get: () => e.children[0] });
  return e;
}
const els = {};
const document = {
  getElementById: (id) =>
    els[id] || (els[id] = el(id === "road" ? "canvas" : "div")),
  createElement: el,
  body: el("body"),
};
let rafCb = null;
const timers = [];
let now = 0;
class FakeImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 100;
    this.naturalHeight = 100;
  }
  remove() {}
  set src(v) {
    this._src = v;
    // obrázky ve zkoušce „nejsou“: hra musí umět kreslit náhrady
    if (this.onerror) timers.push({ at: now, fn: () => this.onerror() });
  }
}
const sandbox = {
  console,
  document,
  Image: FakeImage,
  Audio: class {
    play() {
      return Promise.resolve();
    }
    pause() {}
  },
  performance: { now: () => now },
  requestAnimationFrame: (cb) => ((rafCb = cb), 1),
  cancelAnimationFrame: () => (rafCb = null),
  setTimeout: (fn, ms) => timers.push({ at: now + (ms || 0), fn }),
  clearTimeout() {},
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1,
  addEventListener() {},
  Math,
  JSON,
  Map,
  Set,
  Date: { now: () => now },
  Promise,
  Uint8Array,
  Int8Array,
  Float32Array,
  Uint8ClampedArray,
  Array,
  Object,
  Number,
  String,
  Symbol,
  speechSynthesis: { getVoices: () => [], cancel() {}, speak() {} },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const html = fs.readFileSync(path.join(ASSETS, game, "index.html"), "utf8");
for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
  const f = path.join(ASSETS, game, m[1]);
  vm.runInContext(fs.readFileSync(f, "utf8"), sandbox, {
    filename: f,
    timeout: 2000,
  });
}
function advance(ms) {
  const end = now + ms;
  while (now < end) {
    now += 1000 / 60;
    for (let i = 0; i < timers.length; i++)
      if (timers[i].at <= now) {
        const t = timers.splice(i--, 1)[0];
        t.fn();
      }
    if (rafCb) {
      const cb = rafCb;
      rafCb = null;
      const t0 = performance.now();
      cb(now);
      if (performance.now() - t0 > 500)
        throw new Error(
          "snímek trval " + (performance.now() - t0) + " ms (zacyklení?)",
        );
    }
  }
}
const key = (type, name, dev) => sandbox.tvKey(type, name, dev || 1, true);
const step = (s) => advance(s * 1000);
// načtení + menu
step(2.5);
const S = sandbox.HRA;
const idx = { maty: 0, nela: 1, spolu: 2 }[mode];
for (let i = 0; i < idx; i++) key("down", "right");
key("down", "ok");
if (mode === "spolu") {
  key("down", "ok", 1);
  key("down", "ok", 2);
}
step(0.5);
if (S.screen === "variant") {
  // varianta hry: VAR=<pořadí od 0>
  for (let i = 0; i < +(process.env.VAR || 0); i++) key("down", "right");
  key("down", "ok");
}
step(6);
if (script) require(path.resolve(script))(S, key, step, sandbox);
else {
  // náhodné mačkání
  const names = ["left", "right", "up", "down", "ok", "action"];
  let t = 0;
  while (t < +secs) {
    const n = names[Math.floor(Math.random() * names.length)];
    const dev = mode === "spolu" ? 1 + Math.floor(Math.random() * 2) : 1;
    key("down", n, dev);
    step(Math.random() * 0.8);
    key("up", n, dev);
    step(Math.random() * 0.3);
    t += 0.6;
  }
}
console.log(
  "OK",
  game,
  mode,
  "obrazovka:",
  S.screen,
  "úroveň:",
  S.game && S.game.level,
  "hvězdy:",
  S.game && S.game.players.map((p) => p.stars).join("/"),
);
