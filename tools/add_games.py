"""Zapojí hry do aplikace: dlaždice v AndroidManifest.xml (activity-alias), název ve strings.xml
a odkaz v rozcestníku assets/index.html. Hry, které už zapojené jsou, přeskočí.
Spuštění: python tools/add_games.py <složka>:<Název>:<obrázek do rozcestníku>:<popisek> ..."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN = ROOT / "app/src/main"
man = (MAIN / "AndroidManifest.xml").read_text(encoding="utf-8")
strs = (MAIN / "res/values/strings.xml").read_text(encoding="utf-8")
hub = (MAIN / "assets/index.html").read_text(encoding="utf-8")

for arg in sys.argv[1:]:
    game, title, img, desc = arg.split(":", 3)
    alias = game[0].upper() + game[1:]
    if f'android:value="{game}"' not in man:
        block = f"""        <activity-alias
            android:name=".{alias}"
            android:targetActivity=".GameActivity"
            android:exported="true"
            android:label="@string/game_{game}"
            android:banner="@drawable/banner_{game}"
            android:icon="@drawable/banner_{game}">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
            <meta-data android:name="game" android:value="{game}" />
        </activity-alias>
"""
        man = man.replace("    </application>", block + "    </application>")
    if f'name="game_{game}"' not in strs:
        strs = strs.replace("</resources>", f'    <string name="game_{game}">{title}</string>\n</resources>')
    if f'href="{game}/index.html"' not in hub:
        link = (f'      <a href="{game}/index.html"\n        ><img src="{game}/{img}" alt="" />{title}<small\n'
                f'          >{desc}</small\n        ></a\n      >\n')
        i = hub.index("    </div>\n    <script>")
        hub = hub[:i] + link + hub[i:]
    if not (MAIN / f"res/drawable-xhdpi/banner_{game}.png").exists():
        raise SystemExit("chybí dlaždice banner_" + game)
    print("zapojeno", game)

(MAIN / "AndroidManifest.xml").write_text(man, encoding="utf-8")
(MAIN / "res/values/strings.xml").write_text(strs, encoding="utf-8")
(MAIN / "assets/index.html").write_text(hub, encoding="utf-8")
