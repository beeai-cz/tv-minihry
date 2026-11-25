/* Napojení Dino Runneru na ovládání aplikace Hry: OK / nahoru = skok, dolů = skrčit se,
 * doleva / doprava = předat hru zpět automatu. Zpět zavře hru. */
(function () {
  'use strict';
  const MAP = { ok: 'jump', up: 'jump', action: 'jump', down: 'duck', left: 'auto', right: 'auto' };
  TV.onKey((e) => {
    const k = MAP[e.name];
    if (!k || e.type === 'repeat' || !window.dinoKey) return;
    window.dinoKey(k, e.type === 'down');
  });
  TV.onBack(() => false);

  // Dětská rychlost pro Matyho a Nelu: původní hra startuje na 6 a zrychluje až na 13, to malé děti
  // nestíhají. Pomaleji, pozvolnější zrychlení, větší mezery mezi kaktusy. Pod rychlostí ~8,5 nelétají
  // ptáci, takže se nemusí ani skrčit. Runner.config se čte až při DOMContentLoaded, tady ještě platí.
  if (window.Runner && Runner.config) {
    Runner.config.SPEED = 4;
    Runner.config.ACCELERATION = 0.0002;
    Runner.config.MAX_SPEED = 7;
    Runner.config.GAP_COEFFICIENT = 1.3;
  }
})();
