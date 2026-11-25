/* Pexeso pro Matyho (3) a Nelu (5). Hraje se šipkami a OK.
 * Menu: kdo hraje (Maty / Nela / spolu) -> téma -> hra -> oslava.
 * Spolu se střídají: kdo najde dvojici, hraje znovu; kdo netrefí, předá tah. */
(function () {
  "use strict";

  const screen = document.getElementById("screen");
  const fx = document.getElementById("fx");
  TV.fitStage(document.getElementById("stage"));

  // Počet dvojic a mřížka podle toho, kdo hraje. Maty je nejmladší: méně karet.
  const MODES = {
    maty: { players: ["maty"], pairs: 6, cols: 4 },
    nela: { players: ["nela"], pairs: 10, cols: 5 },
    spolu: { players: ["maty", "nela"], pairs: 8, cols: 4 },
  };

  const S = {
    screen: "loading",
    focus: 0,
    mode: null,
    topic: null,
    game: null,
    busy: false,
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const cardSrc = (id) => "cards/" + id + ".png";
  const sayCs = (t) => TV.say(t, "cs-CZ");
  const sayEn = (t) => TV.say(t, "en-US");

  function avatar(who) {
    const p = TV.PLAYERS[who];
    return TV.picture(p.avatar, p.emoji, "avatar pic");
  }

  // ---------- Menu: kdo hraje ----------
  function showMenu() {
    S.screen = "menu";
    S.focus = S.mode ? Object.keys(MODES).indexOf(S.mode) : 0;
    screen.replaceChildren();
    const t = el("div", "title", "PEXESO");
    t.style.top = "60px";
    t.style.fontSize = "120px";
    screen.appendChild(t);

    const row = el("div", "choices");
    row.style.top = "300px";
    const items = [
      { id: "maty", node: avatar("maty"), label: "Maty" },
      { id: "nela", node: avatar("nela"), label: "Nela" },
      {
        id: "spolu",
        node: (() => {
          const d = el("div", "avatar-pair");
          d.append(avatar("maty"), avatar("nela"));
          return d;
        })(),
        label: "Spolu",
      },
    ];
    for (const it of items) {
      const c = el("div", "choice");
      c.dataset.id = it.id;
      c.append(it.node, el("div", "label", it.label));
      row.appendChild(c);
    }
    screen.appendChild(row);
    markFocus();
    sayCs("Kdo bude hrát?");
  }

  // ---------- Výběr tématu ----------
  function showTopics() {
    S.screen = "topic";
    S.focus = S.topic ? TOPICS.findIndex((t) => t.id === S.topic) : 0;
    screen.replaceChildren();
    const t = el("div", "title", "Co budeme hledat?");
    t.style.top = "80px";
    t.style.fontSize = "90px";
    screen.appendChild(t);

    const row = el("div", "choices topics");
    row.style.top = "330px";
    for (const tp of TOPICS) {
      const c = el("div", "choice");
      c.dataset.id = tp.id;
      const pic = tp.pic
        ? TV.picture(cardSrc(tp.pic), tp.emoji, "topic-pic pic")
        : allPic();
      c.append(pic, el("div", "label", tp.label));
      row.appendChild(c);
    }
    screen.appendChild(row);
    markFocus();
    sayCs("Co budeme hledat?");
  }
  function allPic() {
    const d = el("div", "topic-pic all-pic");
    for (const id of ["cat", "banana", "bus", "frog"]) {
      const w = WORDS.find((x) => x.id === id);
      d.appendChild(TV.picture(cardSrc(id), w.emoji, "pic"));
    }
    return d;
  }

  function markFocus() {
    const list = screen.querySelectorAll(".choice");
    list.forEach((c, i) => c.classList.toggle("focus", i === S.focus));
  }

  // ---------- Hra ----------
  function startGame() {
    const m = MODES[S.mode];
    const pool = WORDS.filter((w) => S.topic === "all" || w.cat === S.topic);
    const chosen = TV.shuffle(pool.slice()).slice(0, m.pairs);
    const cards = TV.shuffle(
      chosen
        .concat(chosen)
        .map((w, i) => ({ w, key: i, up: false, done: false })),
    );
    S.game = {
      cards,
      cols: m.cols,
      rows: Math.ceil(cards.length / m.cols),
      players: m.players.map((id) => ({ id, pairs: 0 })),
      turn: 0,
      open: [],
    };
    S.screen = "game";
    S.focus = 0;
    S.busy = false;
    renderGame();
    if (m.players.length > 1) announceTurn();
    else sayCs("Najdi dvojice!");
  }

  function renderGame() {
    const g = S.game;
    screen.replaceChildren();

    // Hlavička: hráči a skóre.
    const head = el("div", "head");
    g.players.forEach((p, i) => {
      const box = el("div", "player");
      box.dataset.i = i;
      box.style.setProperty("--pc", TV.PLAYERS[p.id].color);
      const score = el("div", "score");
      score.append(
        el("span", "name", TV.PLAYERS[p.id].name),
        el("span", "stars"),
      );
      box.append(avatar(p.id), score);
      head.appendChild(box);
    });
    if (g.players.length > 1)
      head.insertBefore(el("div", "turn-arrow", ""), head.children[1]);
    screen.appendChild(head);

    // Mřížka karet, velikost podle počtu řad a sloupců.
    const gap = 26;
    const areaW = 1760,
      areaH = 870;
    let w = Math.floor((areaW - gap * (g.cols - 1)) / g.cols);
    let h = Math.floor(w * 1.04);
    const maxH = Math.floor((areaH - gap * (g.rows - 1)) / g.rows);
    if (h > maxH) {
      h = maxH;
      w = Math.floor(h / 1.04);
    }
    const board = el("div", "board");
    board.style.gridTemplateColumns = "repeat(" + g.cols + ", " + w + "px)";
    board.style.gridAutoRows = h + "px";
    board.style.gap = gap + "px";
    board.style.setProperty("--cw", w + "px");
    g.cards.forEach((c, i) => {
      const card = el("div", "card");
      card.dataset.i = i;
      const inner = el("div", "inner");
      const back = el("div", "face back");
      back.appendChild(el("div", "back-star", "★"));
      const front = el("div", "face front");
      front.append(
        TV.picture(cardSrc(c.w.id), c.w.emoji, "card-pic pic"),
        el("div", "word", c.w.en),
        el("div", "word-cs", c.w.cs),
      );
      inner.append(back, front);
      card.appendChild(inner);
      board.appendChild(card);
    });
    screen.appendChild(board);
    updateGame();
  }

  function updateGame() {
    const g = S.game;
    screen.querySelectorAll(".card").forEach((node, i) => {
      const c = g.cards[i];
      node.classList.toggle("up", c.up || c.done);
      node.classList.toggle("done", c.done);
      node.classList.toggle("focus", i === S.focus);
    });
    screen.querySelectorAll(".player").forEach((node, i) => {
      const p = g.players[i];
      node.classList.toggle("active", g.players.length > 1 && i === g.turn);
      node.querySelector(".stars").textContent = p.pairs ? "★ " + p.pairs : "";
    });
    const arrow = screen.querySelector(".turn-arrow");
    if (arrow) arrow.textContent = g.turn === 0 ? "◀" : "▶";
  }

  function announceTurn() {
    const g = S.game;
    sayCs(TV.PLAYERS[g.players[g.turn].id].voc + ", jsi na řadě!");
  }

  function moveFocus(dx, dy) {
    const g = S.game;
    const col = S.focus % g.cols;
    const row = Math.floor(S.focus / g.cols);
    const nc = col + dx,
      nr = row + dy;
    if (nc < 0 || nc >= g.cols || nr < 0 || nr >= g.rows) {
      TV.sound.nope();
      return;
    }
    const ni = nr * g.cols + nc;
    if (ni >= g.cards.length) {
      TV.sound.nope();
      return;
    }
    S.focus = ni;
    TV.sound.move();
    updateGame();
  }

  function flip() {
    const g = S.game;
    const c = g.cards[S.focus];
    if (S.busy || c.up || c.done) {
      TV.sound.nope();
      return;
    }
    c.up = true;
    g.open.push(c);
    TV.sound.flip();
    sayEn(c.w.en);
    updateGame();
    if (g.open.length < 2) return;

    S.busy = true;
    const [a, b] = g.open;
    if (a.w.id === b.w.id) {
      setTimeout(() => {
        a.done = b.done = true;
        a.up = b.up = false;
        g.open = [];
        g.players[g.turn].pairs++;
        TV.sound.match();
        TV.confetti(fx, 40);
        TV.say([a.w.en, "Great job!"], "en-US");
        updateGame();
        const node = screen.querySelectorAll(".card");
        g.cards.forEach((c2, i) => {
          if (c2 === a || c2 === b) node[i].classList.add("pop");
        });
        S.busy = false;
        if (g.cards.every((x) => x.done)) setTimeout(showEnd, 1600);
      }, 900);
    } else {
      setTimeout(() => {
        TV.sound.miss();
        a.up = b.up = false;
        g.open = [];
        if (g.players.length > 1) g.turn = 1 - g.turn;
        updateGame();
        S.busy = false;
        if (g.players.length > 1) setTimeout(announceTurn, 400);
      }, 1700);
    }
  }

  // ---------- Oslava ----------
  function showEnd() {
    S.screen = "end";
    S.focus = 0;
    const g = S.game;
    TV.sound.win();
    TV.confetti(fx, 140);
    const ov = el("div", "end");
    const box = el("div", "end-box");
    box.appendChild(el("div", "end-title", "Hurá!"));
    const row = el("div", "end-players");
    const best = Math.max(...g.players.map((p) => p.pairs));
    const winners = g.players.filter((p) => p.pairs === best);
    g.players.forEach((p) => {
      const col = el("div", "end-player");
      if (g.players.length > 1 && winners.length === 1 && p.pairs === best)
        col.appendChild(el("div", "crown", "👑"));
      col.append(
        avatar(p.id),
        el("div", "end-name", TV.PLAYERS[p.id].name),
        el("div", "end-stars", "★ " + p.pairs),
      );
      row.appendChild(col);
    });
    box.appendChild(row);
    const btns = el("div", "end-buttons");
    btns.append(el("div", "btn focus", "Hrát znovu"), el("div", "btn", "Menu"));
    box.appendChild(btns);
    ov.appendChild(box);
    screen.appendChild(ov);

    if (g.players.length === 1) {
      sayCs(g.players[0].id === "nela" ? "Hurá, Nelo! Dokázala jsi to!" : "Hurá, Maty! Dokázal jsi to!");
    } else if (winners.length === 1) {
      sayCs(
        "Hurá! Vyhrál" +
          (winners[0].id === "nela" ? "a Nela" : " Maty") +
          "! Oba jste byli skvělí!",
      );
    } else {
      sayCs("Remíza! Oba jste byli skvělí!");
    }
  }
  function markEndFocus() {
    screen
      .querySelectorAll(".end .btn")
      .forEach((b, i) => b.classList.toggle("focus", i === S.focus));
  }

  // ---------- Ovládání ----------
  TV.onKey((e) => {
    if (e.type === "up") return;
    const n = e.name;
    if (S.screen === "menu" || S.screen === "topic") {
      const count = screen.querySelectorAll(".choice").length;
      if (n === "left" && S.focus > 0) {
        S.focus--;
        TV.sound.move();
        markFocus();
      } else if (n === "right" && S.focus < count - 1) {
        S.focus++;
        TV.sound.move();
        markFocus();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        const id = screen.querySelectorAll(".choice")[S.focus].dataset.id;
        if (S.screen === "menu") {
          S.mode = id;
          showTopics();
        } else {
          S.topic = id;
          startGame();
        }
      }
    } else if (S.screen === "game") {
      if (n === "left") moveFocus(-1, 0);
      else if (n === "right") moveFocus(1, 0);
      else if (n === "up") moveFocus(0, -1);
      else if (n === "down") moveFocus(0, 1);
      else if ((n === "ok" || n === "action") && e.type === "down") flip();
    } else if (S.screen === "end") {
      if (n === "left" || n === "right") {
        S.focus = 1 - S.focus;
        TV.sound.move();
        markEndFocus();
      } else if ((n === "ok" || n === "action") && e.type === "down") {
        TV.sound.flip();
        if (S.focus === 0) startGame();
        else showMenu();
      }
    }
  });

  TV.onBack(() => {
    if (S.screen === "menu" || S.screen === "loading") return false; // zavřít aplikaci
    if (S.screen === "topic") showMenu();
    else showTopics();
    return true;
  });

  TV.ready(showMenu, [], []);
})();
