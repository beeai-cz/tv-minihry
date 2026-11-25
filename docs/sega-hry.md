# 10 nových her inspirovaných SEGA 90. let (24. 11. 2026)

Zadání Vilíka: „Vytvoř dalších 10 zajímavých dětských her, můžou být i logické. Inspiruj se na SEGA hrách
v devadesátých letech." Inspirace = žánr a mechanika, ne kopie: vlastní jména, postavy, vzhled i úrovně.

Společná pravidla (stejná jako u prvních 11 her): Maty (3, zelená) / Nela (5, růžová, „Nelo") / Spolu (2 ovladače),
ovládání jen šipky + OK/B, nikdo nesmí prohrát ani se zaseknout, texty VERZÁLKAMI přes CSS, hlas normální text,
čísla přes `TV.csCount`, úroveň 1-2 minuty, žádný zvuk motoru. Společná kostra nových her: `assets/common/kit.js`
(menu, párování ovladačů, odpočet, oslava, smyčka snímků). Co nemá obrázek z Higgsfieldu, nakreslí hra sama.

| #   | Složka    | Název       | Inspirace (žánr)                          | Jádro hry                                                                                                                                                                       | Maty / Nela / Spolu                                                                  |
| --- | --------- | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | drahokamy | Drahokamy   | Columns (padající trojice)                | Sloupek 3 drahokamů padá, šipky posun, OK přehodí barvy, dolů zrychlí; 3 stejné v řadě zmizí, řetězení. Plná studna = vysavač vyčistí půlku.                                    | 3 barvy, jen vodorovně/svisle, pomalu / 5 barev i šikmo / dvě studny vedle sebe      |
| 2   | krecci    | Křečci domů | ChuChu Rocket (šipky na podlaze)          | Logika: kurzorem pokládáš šipky, B pustí křečky; jdou rovně, u zdi zatočí doprava. Všichni do domečku = hotovo; nepovedlo se = vrátí se a zkusíš znovu. Úrovně ověřené řešičem. | 1 šipka / až 4 šipky / dva kurzory na jedné desce                                    |
| 3   | kulicka   | Kulička     | Super Monkey Ball (koulení po dráze)      | Pohled shora, šipky naklání dráhu, kulička s dítětem uvnitř se kutálí, sbírá jahody, dojede do cíle. Spadnout = vrátí se na poslední vlaječku.                                  | Dráhy se zábradlím / užší dráhy, mosty / dvě kuličky                                 |
| 4   | pinball   | Pinball     | Sonic Spinball (pinball)                  | Šipka vlevo/vpravo = ploutve, OK obě, dolů vystřelí. Nárazníky, hvězdy, terče. Propadlá kulička se vrátí (nikdy konec), cíl = nasbírat hvězdy.                                  | Pomalá kulička, záchranná síť / rychlejší / Maty levá ploutev, Nela pravá            |
| 5   | delfin    | Delfín      | Ecco the Dolphin (plavání, sonar)         | Plaveš pod vodou, B = zpěv (sonar), který rozsvítí schované kamarády a otevře krystalové brány. Najdi 3 delfíňata a doplav k mamince. Medúzy jen odstrčí.                       | Malá zátoka, kamarádi blízko / větší moře, brány / dva delfíni                       |
| 6   | kuratka   | Kuřátka     | Flicky (sbírání kuřátek)                  | Slepička běhá a skáče po plošinkách, kuřátka jdou za ní v řadě, dovede je do kurníku. Kocour je jen rozprchne (žádná smrt).                                                     | Bez kocourů / kocouři / dvě slepičky                                                 |
| 7   | tanec     | Tanec       | Space Channel 5 / Samba de Amigo (rytmus) | Papoušek zatančí 2-4 pohyby (vlevo, vpravo, nahoru, dolů, tlesk = OK) a dítě je zopakuje do rytmu. Hudba syntetizovaná. Chyba = jen zopakuje.                                   | Jen vlevo/vpravo, 2 pohyby / všechny pohyby, delší řady / oba tančí, každý svou řadu |
| 8   | taxik     | Taxík       | Crazy Taxi (rozvoz pasažérů)              | Mapa města na jedné obrazovce, auto jede po silnicích, zvířátka čekají s bublinou, kam chtějí; vyzvedni a odvez. Šipka ukazuje cestu.                                           | Šipka + málo křižovatek / víc cílů / dvě auta                                        |
| 9   | rybareni  | Rybaření    | SEGA Bass Fishing (rybaření)              | Loďka, B nahodí, šipky vedou háček, ryba zabere = „!" a B, pak klepat B a navíjet. Album úlovků (anglická slova).                                                               | Ryby berou hned / chvilka čekání a navíjení / dva háčky                              |
| 10  | tenis     | Tenis       | Virtua Tennis (tenis)                     | Kurt v perspektivě, dítě běhá šipkami, odpal je sám, B = smeč. Medvěd vrací; body se jen přičítají. Spolu = společná výměna, počítá se, kolikrát si to přehrajete.              | Pomalý míček, velká raketa / rychlejší, směr odpalu / spolu proti zdi z balónků      |

## Obrázky (Higgsfield Nano Banana Pro, Unlimited, web přes Chrome)

Archy 3x3 na bílém pozadí ve stylu ostatních her (roztomilý kreslený styl, tlustý tmavý obrys), řezání
`tools/sega_sprites.py`. Bannery 16:9 s názvem hry a dětmi (kluk v zeleném tričku, holka s blond copánky v růžovém).
Prompty: `art/prompts-sega.md`.

## Stav

Obrázky hotové (`art/prompts-sega.md`). Taxík a Tenis zrušené (nahrazené Hasiči a Fotbalem). Všech 14 her
postavených, zapojených do aplikace a prošlých robotem (`tools/headless.js` + `tools/bots/`) ve všech třech režimech.
Nové hlášky (68) jsou v `tools/voice_phrases.py`, nahrát je jde až na TV (do té doby mluví Google TTS).

## Změna 24. 11. večer (přání Vilíka a Máji)
Děti jsou dobrovolní hasiči, Nela miluje fotbal a inline brusle; Mája chce dětské Tetris a hledání min.
- Taxík -> **Hasiči** (`hasici`): stejná mechanika (jízda po městě k cílům), cílem jsou požáry: dojet, roztáhnout hadici
  a šipkami hasit plamínky; zachránit koťátko ze stromu. Hydrant doplní vodu.
- Tenis -> **Fotbal a hokej** (`fotbal`): jedno hřiště shora, výběr Fotbal (tráva) / Hokej (led, klouže). Hráč běhá,
  míč se lepí k noze, OK = střela. Proti nám hodný brankář; Spolu = Maty a Nela v jednom týmu.
- Nová **Brusle** (`brusle`): závod bokem (jako Dinosaurus, ale s výběrem): inline v parku, inline dráha, lyže,
  snowboard, plavání. Jede se samo, OK = skok přes překážky, šipka vpravo = zrychlit. Spolu = dvě dráhy nad sebou.
- Nové **Pěnovky** (`penovky`): aréna shora ve stylu Bulánků, zvířátka s pěnovými pistolemi, zásah = jen ťuk
  a hvězdička pro střelce, zasažený na chvilku zbledne. Proti hodným robotům; Spolu = Maty a Nela proti robotům.
- Nové **Kostky** (`kostky`): dětské padající kostky (bez značky Tetris): Maty jen malé tvary a široká studna.
- Nové **Ježci** (`jezci`): dětské hledání min: odkrývá se tráva, čísla (Matymu tečky) říkají, kolik ježků je okolo;
  šlápnutí na ježka = „Au!“, ježek se ukáže, hra pokračuje. Cíl: najít všechny kytičky (bezpečná políčka).
Pořadí stavby: Hasiči, Fotbal a hokej, Brusle, Pěnovky, Kostky, Ježci, pak Pinball, Delfín, Kuřátka, Tanec, Rybaření.
