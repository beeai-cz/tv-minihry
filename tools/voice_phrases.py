"""Seznam pevných hlášek her -> app/src/main/assets/common/voice/phrases.txt (id|jazyk|text).

Nahrávky se vyrábí na TV hlasem Google (GameActivity s extra export_voice) a hra je pak jen přehrává,
místo aby čekala na pomalé načítání TTS. Vokativ: k Nele mluvíme „Nelo“, o ní „Nela“.
Spuštění: python tools/voice_phrases.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "app/src/main/assets"

UNITS = ["nula", "jednu", "dvě", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět", "deset", "jedenáct",
         "dvanáct", "třináct", "čtrnáct", "patnáct", "šestnáct", "sedmnáct", "osmnáct", "devatenáct"]
TENS = ["", "", "dvacet", "třicet", "čtyřicet", "padesát", "šedesát", "sedmdesát", "osmdesát", "devadesát"]


def cs_number(n):
    if n >= 100:
        r = n - 100
        return "sto" + ("" if r == 0 else " jedna" if r == 1 else " " + cs_number(r))
    if n < 20:
        return UNITS[n]
    u = n % 10
    return TENS[n // 10] + ((" " + ("jedna" if u == 1 else UNITS[u])) if u else "")


def stars(n):
    if n == 0:
        return "Tentokrát nemáš žádnou hvězdičku."
    form = "hvězdičku" if n == 1 else "hvězdičky" if 2 <= n <= 4 else "hvězdiček"
    return f"Máš {cs_number(n)} {form}!"


cs = [
    # společné / pexeso
    "Kdo bude hrát?", "Co budeme hledat?", "Najdi dvojice!",
    "Maty, jsi na řadě!", "Nelo, jsi na řadě!",
    "Hurá, Maty! Dokázal jsi to!", "Hurá, Nelo! Dokázala jsi to!",
    "Vyhrál Maty! Oba jste byli skvělí!", "Vyhrála Nela! Oba jste byli skvělí!", "Remíza! Oba jste byli skvělí!",
    # závody
    "Kdo pojede?", "Maty, zmáčkni tlačítko na svém ovladači.", "Nelo, zmáčkni tlačítko na svém ovladači.",
    "Připrav se!", "Připravte se!", "Tři", "Dva", "Jedna", "Jeď!",
    "Maty je v cíli první!", "Nela je v cíli první!",
    "Hurá, Maty! Jsi v cíli!", "Hurá, Nelo! Jsi v cíli!",
    "Vyhrál Maty! Oba jste skvělí řidiči!", "Vyhrála Nela! Oba jste skvělí řidiči!",
] + [stars(n) for n in range(0, 61)] + [
    # skákačka (přidáno na konec, ať se nemění čísla starších nahrávek)
    "Kdo bude skákat?", "Jdeme na to!", "Hups!", "Hurá! Oba jste to zvládli!",
] + [stars(n) for n in range(61, 200)] + [
    # rakety
    "Kdo poletí?", "Start!", "Trojitá střela!", "Kulomet!", "Plamenomet!", "Rakety!", "Štít!",
    "Pozor, velká chobotnice!", "Hurá, Maty! Vyhrál jsi!", "Hurá, Nelo! Vyhrála jsi!",
    "Máš spoustu hvězdiček!",
] + [
    # bojovka
    "Maty, vyber si bojovníka.", "Nelo, vyber si bojovníka.", "Žabák", "Králíček", "Panda", "Liška",
    "Kolo jedna!", "Kolo dva!", "Kolo tři!", "Bojuj!",
    "Vyhrál Žabák!", "Vyhrál Králíček!", "Vyhrála Panda!", "Vyhrála Liška!", "Skoro! Zkus to znovu!",
] + [
    # rybičky, bedýnky, bludiště, chytačka
    "Papej menší rybičky!", "Papejte menší rybičky!", "Pozor na velké ryby!", "Pozor, žralok!",
    "Teď spolkni žraloka!", "Teď spolkněte žraloka!", "Hvězdice!", "Hurá! Další úroveň!",
    "Vyber si úroveň.", "Zkusíme to znovu?", "Hurá!",
    "Najdi poklad!", "Najděte poklad!", "Najdi klíč!", "Najděte klíč!", "Klíč!", "Poklad!", "Nejdřív najdi klíč.", "Nejdřív najděte klíč.",
    "Vyber si svět.",
    "Haps!",
    # trasy Závodů a světy Bludiště
    "Vyber si trasu.", "Louka", "Poušť", "Zima", "Cukrová země",
    "Zahrada!", "Zima!", "Poušť!", "Cukrová země!", "Hrad!",
] + [
    # nové hry 24. 11. (SEGA inspirace, hasiči, sporty, kostky, ježci)
    "Uklidíme!",
    "Zmáčkni zelené tlačítko a křeček poběží domů.",
    "Položte šipku, aby křečci došli domů. Pak zmáčkněte zelené tlačítko.",
    "Polož šipku, aby křeček došel domů. Pak zmáčkni zelené tlačítko.",
    "Pomůžu ti. Teď zmáčkni zelené tlačítko.",
    "Hurá! Všichni jsou doma!",
    "Hurá! Křeček je doma!",
    "Zmáčkni zelené tlačítko.",
    "Všechny šipky už leží. Zmáčkni zelené tlačítko.",
    "Hasiči, jedeme! Uhaste požár!",
    "Hasiči, jedeme! Uhas požár!",
    "Koťátko je zachráněné!",
    "Výborně, hasiči!",
    "Uhašeno!",
    "Paráda!",
    "Pomoc! Koťátko je na stromě!",
    "Došla voda. Jeď k hydrantu.",
    "Gól! Puk je v bráně!",
    "Gól! Nela dala gól!",
    "Gól! Maty dal gól!",
    "Chytil to! Zkus to znovu!",
    "Jdeme na to! Dejte gól!",
    "Jdeme na to! Dej gól!",
    "Plav!",
    "Odkrývej trávu a hledej kytičky. Tečky ukazují, kolik ježků spí kolem.",
    "Odkrývej trávu. Číslo ukazuje, kolik ježků spí kolem.",
    "Au!",
    "Hurá! Všechny kytičky jsou venku!",
    "Maty má levou ploutev, Nela pravou!",
    "Šipkami pohybuj ploutvemi!",
    "Najdi ztracená delfíňata a přivez je k mamince.",
    "Zpívejte tlačítkem a najděte ztracená delfíňata!",
    "Zpívej tlačítkem a najdi ztracená delfíňata!",
    "Zazpívej, krystal se rozpustí!",
    "Pojď se mnou domů!",
    "Děkuju! Jsme zase spolu!",
    "Posbírej kuřátka a doveď je do kurníku!",
    "Pozor na kocoura!",
    "Hurá! Všechna kuřátka jsou doma!",
    "Dívej se na papouška!",
    "Teď vy!",
    "Teď ty!",
    "Stará bota! Ha ha!",
    "Zmáčkni tlačítko a nahoď udici!",
    "Nahoď udici a chyť rybu!",
    "Navíjej!",
    "Vlevo!",
    "Vpravo!",
    "Nahoru!",
    "Dolů!",
    "Tlesk!",
    "Fotbal!",
    "Hokej!",
    "Park!",
    "Dráha!",
    "Lyže!",
    "Snowboard!",
    "Plavání!",
    "Zelená rybka!",
    "Růžová rybka!",
    "Žlutá rybka!",
    "Modrá rybka!",
    "Oranžová rybka!",
    "Fialová rybka!",
    "Ježík!",
    "Krab!",
    "Fotbal, nebo hokej?",
    "Na čem pojedeme?",
]

words = re.findall(r"en:\s*['\"]([^'\"]+)['\"]", (ASSETS / "pexeso/words.js").read_text(encoding="utf-8"))
en = words + ["Great job!"] + ["cherries", "orange", "watermelon", "pineapple", "peach", "lemon", "blueberries"] + ["star"]  # had, chytačka

lines = [f"cs{i:03d}|cs-CZ|{t}" for i, t in enumerate(cs)] + [f"en{i:03d}|en-US|{t}" for i, t in enumerate(en)]
out = ASSETS / "common/voice/phrases.txt"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(len(cs), "cs,", len(en), "en ->", out)
